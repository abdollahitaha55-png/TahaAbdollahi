"""Rework citations, footnotes, abstracts and the APA reference list of the
master's thesis proposal form (فرم پیشنهاده / پروپوزال).

Rules applied:
  * In-text citations are APA author-year: Persian author name (with
    "و همکاران" for three or more authors) followed by the year in parentheses.
  * Footnotes are kept only for foreign (English-language) sources, at their
    first mention, and contain only the English surname(s) and year.
  * Footnotes that were only English term glosses are removed; the English
    term is put in parentheses in the text instead.
  * Abstracts (فارسی and English) are rewritten as one continuous paragraph.
  * Section 4-11 becomes an APA reference list: Persian entries, then English
    entries, both alphabetical, hanging indent, italics for English titles.

Usage: python3 edit_proposal.py <in.docx> <out.docx>
"""
import copy
import re
import sys
import zipfile

from lxml import etree

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = "{%s}" % W_NS
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"

src, dst = sys.argv[1:3]

zin = zipfile.ZipFile(src)
doc_root = etree.fromstring(zin.read("word/document.xml"))
fn_root = etree.fromstring(zin.read("word/footnotes.xml"))


# ---------------------------------------------------------------- helpers
def para_text(p):
    return "".join((t.text or "") for t in p.iter(W + "t"))


def all_paragraphs():
    return list(doc_root.iter(W + "p"))


def find_para(prefix=None, contains=None):
    hits = []
    for p in all_paragraphs():
        t = para_text(p)
        if prefix is not None and t.startswith(prefix):
            hits.append(p)
        elif contains is not None and contains in t:
            hits.append(p)
    assert len(hits) == 1, (prefix or contains, len(hits))
    return hits[0]


def to_tokens(p):
    """Flatten a paragraph into tokens: chars, footnote refs, other elements."""
    toks = []
    for child in p:
        if child.tag == W + "pPr":
            continue
        if child.tag == W + "r":
            rpr = child.find(W + "rPr")
            fr = child.find(W + "footnoteReference")
            if fr is not None:
                toks.append({"k": "fn", "id": fr.get(W + "id"), "rpr": rpr})
                continue
            for sub in child:
                if sub.tag == W + "rPr":
                    continue
                if sub.tag == W + "t":
                    for ch in sub.text or "":
                        toks.append({"k": "c", "ch": ch, "rpr": rpr})
                elif sub.tag == W + "tab":
                    toks.append({"k": "c", "ch": "\t", "rpr": rpr})
                else:
                    raise ValueError("unexpected run child " + sub.tag)
        else:
            toks.append({"k": "el", "el": child})
    return toks


def rebuild(p, toks):
    for child in list(p):
        if child.tag != W + "pPr":
            p.remove(child)
    buf, buf_rpr = [], None

    def flush():
        nonlocal buf, buf_rpr
        if not buf:
            return
        r = etree.SubElement(p, W + "r")
        if buf_rpr is not None:
            r.append(copy.deepcopy(buf_rpr))
        t = etree.SubElement(r, W + "t")
        t.set(XML_SPACE, "preserve")
        t.text = "".join(buf)
        buf, buf_rpr = [], None

    for t in toks:
        if t["k"] == "c":
            if buf and t["rpr"] is not buf_rpr:
                flush()
            buf_rpr = t["rpr"]
            buf.append(t["ch"])
        elif t["k"] == "fn":
            flush()
            r = etree.SubElement(p, W + "r")
            if t["rpr"] is not None:
                r.append(copy.deepcopy(t["rpr"]))
            fr = etree.SubElement(r, W + "footnoteReference")
            fr.set(W + "id", t["id"])
        else:
            flush()
            p.append(t["el"])
    flush()


def plain(toks):
    return "".join(t["ch"] for t in toks if t["k"] == "c")


def char_positions(toks):
    return [i for i, t in enumerate(toks) if t["k"] == "c"]


def find_span(toks, needle, occurrence=None):
    """Return (start, end) token indices of the chars spelling `needle`."""
    s = plain(toks)
    idx = [m.start() for m in re.finditer(re.escape(needle), s)]
    assert idx, ("not found", needle)
    if occurrence is None:
        assert len(idx) == 1, ("ambiguous", needle, len(idx))
        k = idx[0]
    else:
        k = idx[occurrence]
    pos = char_positions(toks)
    start, end = pos[k], pos[k + len(needle) - 1]
    assert all(toks[i]["k"] == "c" for i in range(start, end + 1)), ("span crosses element", needle)
    return start, end


def fn_index(toks, fid):
    hits = [i for i, t in enumerate(toks) if t["k"] == "fn" and t["id"] == str(fid)]
    assert len(hits) == 1, ("footnote ref", fid, len(hits))
    return hits[0]


def char_tokens(text, rpr):
    return [{"k": "c", "ch": ch, "rpr": rpr} for ch in text]


def replace_text(toks, old, new):
    s, e = find_span(toks, old)
    rpr = toks[s]["rpr"]
    return toks[:s] + char_tokens(new, rpr) + toks[e + 1:]


def insert_chars_at(toks, idx, text, rpr=None):
    if rpr is None:
        rpr = toks[idx - 1]["rpr"] if idx > 0 else toks[idx]["rpr"]
    return toks[:idx] + char_tokens(text, rpr) + toks[idx:]


def cite_footnote(toks, fid, name_suffix="", year=None):
    """Keep a foreign-source footnote, placed after the APA citation.

    name_suffix: text added before the marker (e.g. ' و همکاران').
    year: year to insert before the marker when the text had none.
    Otherwise the marker moves to just after the existing '(year)'.
    """
    i = fn_index(toks, fid)
    if name_suffix:
        toks = insert_chars_at(toks, i, name_suffix, toks[i - 1]["rpr"])
        i = fn_index(toks, fid)
    if year:
        toks = insert_chars_at(toks, i, year, toks[i - 1]["rpr"])
        i = fn_index(toks, fid)
        return toks
    # find the closing parenthesis of the year that follows the marker
    j = i + 1
    while not (toks[j]["k"] == "c" and toks[j]["ch"] == ")"):
        assert toks[j]["k"] in ("c", "el") and j - i < 20, ("no closing paren", fid)
        j += 1
    between = plain(toks[i + 1:j + 1])
    assert re.match(r"^\s*\(\S+\)$", between), ("unexpected citation shape", fid, between)
    marker = toks.pop(i)
    j -= 1  # the ')' moved one step left after the pop
    toks.insert(j + 1, marker)
    return toks


def term_footnote(toks, fid, text):
    """Replace a glossary footnote by the English term in parentheses."""
    i = fn_index(toks, fid)
    rpr = toks[i - 1]["rpr"]
    toks.pop(i)
    return insert_chars_at(toks, i, text, rpr)


def edit_paragraph(p, ops):
    toks = to_tokens(p)
    for op in ops:
        toks = op(toks)
    rebuild(p, toks)


# ------------------------------------------------ 1. body citations and glosses
# Footnote ids in the source are 1..22, in order of appearance.
TERM = {
    1: " (Employee Performance)",
    2: " (Job Promotion)",
    4: " (Expectancy Theory)",
    8: " (Ability-Motivation-Opportunity; AMO)",
    15: " (Career Development)",
    16: " (Job Motivation)",
}
CITE = {
    # id: (name_suffix, year_to_insert, english footnote text)
    3: ("", None, "Jiang et al., 2012"),
    5: ("", None, "Vroom, 1964"),
    6: (" و همکاران", None, "Herzberg et al., 1959"),
    7: ("", None, "Blau, 1964"),
    9: ("", None, "Appelbaum et al., 2000"),
    10: ("", None, "Udayar et al., 2024"),
    11: ("", None, "Dartono et al., 2026"),
    12: ("", None, "Kraimer et al., 2011"),
    13: ("", None, "Mahardiansyah & Mauludin, 2025"),
    14: ("", None, "Handayani et al., 2025"),
    17: ("", None, "Weng et al., 2010"),
    18: ("", None, "Cerasoli et al., 2014"),
    19: ("", None, "Nyaga & Omuya, 2024"),
    20: ("", " (۱۹۷۷)", "Cochran, 1977"),
    21: ("", " (۱۹۸۱)", "Fornell & Larcker, 1981"),
    22: ("", " (۲۰۰۸)", "Preacher & Hayes, 2008"),
}
# Persian-language names of the cited foreign authors are kept in the text;
# the English form appears only in the footnote.

# Paragraph that holds each footnote marker.
fn_para = {}
for p in all_paragraphs():
    for fr in p.iter(W + "footnoteReference"):
        fn_para[fr.get(W + "id")] = p
assert sorted(fn_para, key=int) == [str(i) for i in range(1, 23)], sorted(fn_para, key=int)

done_paras = set()
for fid in [str(i) for i in range(1, 23)]:
    p = fn_para[fid]
    key = id(p)
    ops = []
    # group every edit to this paragraph into one token pass
    if key in done_paras:
        continue
    done_paras.add(key)
    ids_here = [f for f in fn_para if fn_para[f] is p]
    toks = to_tokens(p)
    for f in sorted(ids_here, key=int):
        n = int(f)
        if n in TERM:
            toks = term_footnote(toks, f, TERM[n])
        else:
            suffix, year, _ = CITE[n]
            toks = cite_footnote(toks, f, suffix, year)
    rebuild(p, toks)

# Name changes for sources with three or more authors (text, no footnote).
NAME_FIXES = [
    ("ابغری، ابغری، وزیری و فولادی (۱۴۰۵)", "ابغری و همکاران (۱۴۰۵)"),
    ("حسینی، صمیمی، عباسی‌رائی، صدری‌آزاد و نجفی (۱۴۰۴)", "حسینی و همکاران (۱۴۰۴)"),
    ("اسکندرنژاد، بهزادنیا و عباس (۱۴۰۴)", "اسکندرنژاد و همکاران (۱۴۰۴)"),
    ("دارتونو، راهارجو و نورواتی (۲۰۲۶)", "دارتونو و همکاران (۲۰۲۶)"),
    ("اودایار، اورباناویچیوته، ماجیوری و روسیه (۲۰۲۴)", "اودایار و همکاران (۲۰۲۴)"),
    ("هندایانی، سوجیونو، افندی و حسن‌الدین (۲۰۲۵)", "هندایانی و همکاران (۲۰۲۵)"),
]
for old, new in NAME_FIXES:
    hits = [p for p in all_paragraphs() if old in para_text(p)]
    assert len(hits) == 1, (old, len(hits))
    edit_paragraph(hits[0], [lambda t, o=old, n=new: replace_text(t, o, n)])

# ------------------------------------------------ 2. footnotes part
KEEP_TEXT = {
    3: "Jiang et al., 2012",
    5: "Vroom, 1964",
    6: "Herzberg et al., 1959",
    7: "Blau, 1964",
    9: "Appelbaum et al., 2000",
    10: "Udayar et al., 2024",
    11: "Dartono et al., 2026",
    12: "Kraimer et al., 2011",
    13: "Mahardiansyah & Mauludin, 2025",
    14: "Handayani et al., 2025",
    17: "Weng et al., 2010",
    18: "Cerasoli et al., 2014",
    19: "Nyaga & Omuya, 2024",
    20: "Cochran, 1977",
    21: "Fornell & Larcker, 1981",
    22: "Preacher & Hayes, 2008",
}
footnotes = [f for f in fn_root.findall(W + "footnote") if f.get(W + "type") is None]
assert len(footnotes) == 22
kept = []
for f in footnotes:
    n = int(f.get(W + "id"))
    if n in TERM:
        fn_root.remove(f)
        continue
    p = f.find(W + "p")
    runs = p.findall(W + "r")
    text_run = [r for r in runs if r.find(W + "t") is not None]
    assert text_run, n
    proto = text_run[0]
    for r in text_run:
        p.remove(r)
    r = copy.deepcopy(proto)
    r.find(W + "t").text = " " + KEEP_TEXT[n]
    r.find(W + "t").set(XML_SPACE, "preserve")
    p.append(r)
    kept.append(n)

# renumber remaining footnotes 1..N in order, and update body references
old_to_new = {str(old): str(new) for new, old in enumerate(kept, start=1)}
for f in footnotes:
    old = int(f.get(W + "id"))
    if str(old) in old_to_new:
        f.set(W + "id", old_to_new[str(old)])
for fr in doc_root.iter(W + "footnoteReference"):
    fr.set(W + "id", old_to_new[fr.get(W + "id")])

# ------------------------------------------------ 3. abstracts (one paragraph each)
ABSTRACT_FA = (
    "پژوهش حاضر با هدف بررسی تأثیر ارتقای شغلی بر عملکرد کارکنان، با نقش میانجی توسعه شغلی و انگیزه شغلی، "
    "در شرکت آب و فاضلاب استان خراسان رضوی انجام می‌شود. این پژوهش از نظر هدف کاربردی و از نظر روش توصیفی–همبستگی است. "
    "جامعه آماری آن شامل ۲۰۰ نفر از کارکنان این شرکت در سال ۱۴۰۵ است و به دلیل محدود بودن جامعه، "
    "با روش نمونه‌گیری کل‌شمار، همه ۲۰۰ نفر به‌عنوان نمونه در نظر گرفته می‌شوند. گردآوری داده‌ها با پرسشنامه انجام می‌شود؛ "
    "انگیزه شغلی با پرسشنامه انگیزش شغلی پیرس و همکاران، عملکرد کارکنان با پرسشنامه عملکرد سازمانی حسینی و همکاران، "
    "توسعه شغلی با پرسشنامه استاندارد توسعه شغلی و ارتقای شغلی با گویه‌های سرعت و فرصت ادراک‌شده ارتقا سنجیده می‌شود. "
    "روایی محتوایی ابزارها با نظر خبرگان و روایی سازه آن‌ها با تحلیل عاملی تأییدی بررسی می‌شود و پایایی آن‌ها با ضریب آلفای "
    "کرونباخ و پایایی ترکیبی سنجیده می‌شود. پس از بررسی نرمال بودن داده‌ها با آزمون کولموگروف–اسمیرنوف، "
    "تحلیل داده‌ها با نرم‌افزارهای SPSS و PLS و به روش مدل‌یابی معادلات ساختاری انجام می‌شود و معناداری اثرهای میانجی "
    "با روش بوت‌استرپ آزمون می‌شود. انتظار می‌رود نتایج نشان دهد ارتقای شغلی بر عملکرد کارکنان این شرکت اثر معناداری دارد "
    "و سهم هر یک از دو مسیر توسعه شغلی و انگیزه شغلی در انتقال این اثر مشخص شود. بر این اساس، سازمان می‌تواند تعیین کند "
    "که برای تبدیل ارتقا به عملکرد، بر برنامه‌های توسعه فردی سرمایه‌گذاری کند یا بر شفافیت و عدالت نظام ارتقا."
)
ABSTRACT_EN = (
    "The present study aims to investigate the effect of job promotion on employee performance, with the mediating roles "
    "of career development and job motivation, at the Khorasan Razavi Province Water and Wastewater Company. The research "
    "is applied in purpose and descriptive-correlational in method. The statistical population comprises the 200 employees "
    "of the company in 1405; because the population is limited, the census method is used and all 200 employees form the "
    "sample. Data are collected with a questionnaire: job motivation is measured with the job motivation questionnaire of "
    "Pierce et al., employee performance with the organizational performance questionnaire of Hosseini et al., career "
    "development with a standard career development questionnaire, and job promotion with items on the perceived speed of "
    "and perceived opportunity for promotion. Content validity is examined by experts, construct validity by confirmatory "
    "factor analysis, and reliability by Cronbach’s alpha and composite reliability. After the normality of the data is "
    "checked with the Kolmogorov–Smirnov test, the data are analysed in SPSS and PLS using structural equation modelling, "
    "and the significance of the mediating effects is tested by bootstrapping. The results are expected to show that job "
    "promotion has a significant effect on employee performance at the company and to establish the relative share of the "
    "two paths, career development and job motivation, in transmitting this effect. On this basis, the organization can "
    "decide whether, to turn promotion into performance, it should invest in individual development programmes or in the "
    "transparency and fairness of its promotion system."
)


def set_single_paragraph_text(p, text):
    runs = p.findall(W + "r")
    assert len(runs) == 1, len(runs)
    t = runs[0].find(W + "t")
    t.text = text
    t.set(XML_SPACE, "preserve")


set_single_paragraph_text(find_para(prefix="پژوهش حاضر با هدف بررسی"), ABSTRACT_FA)
set_single_paragraph_text(find_para(prefix="The present study is conducted"), ABSTRACT_EN)

# ------------------------------------------------ 4. APA reference list (section 4-11)
FA_HEAD = "منابع فارسی"
EN_HEAD = "منابع انگلیسی"
FA_REFS = [
    "ابغری، آرمام؛ ابغری، رامین؛ وزیری، سعید و فولادی، فاطمه (۱۴۰۵). تبیین پیوستگی انگیزش، رضایت شغلی و فرسودگی شغلی با میانجی‌گری استراتژی‌های عملکرد در صنعت نساجی. علوم و فناوری نساجی و پوشاک، ۱۵(۲)، ۵۸–۸۱.",
    "اسکندرنژاد، مهتا؛ بهزادنیا، بهزاد و عباس، حسین (۱۴۰۴). ارتباط بین ساختارهای انگیزش با عملکرد شغلی معلمان تربیت بدنی بر اساس نقش میانجی‌گری خودکارآمدی. مطالعات روان‌شناسی ورزشی، ۱۴(۵۱)، ۱۳۰–۱۴۴.",
    "اصغری‌نژاد، منیره (۱۴۰۱). بررسی تأثیر حمایت سازمان از سرمایه اجتماعی بر تعهد و عملکرد شغلی کارکنان. مدیریت تبلیغات و فروش، ۳(۳)، ۳۰۷–۳۱۵.",
    "حسینی، سید حسن؛ صمیمی، مهدی؛ عباسی‌رائی، علی؛ صدری‌آزاد، عادل و نجفی، احسان (۱۴۰۴). تأثیر توسعه آموزش‌های ضمن خدمت بر توانمندسازی شغلی کارکنان نزاجا با نقش میانجی انگیزش در راستای کاربست‌پذیری بیانیه گام دوم انقلاب. مدیریت هوشمند سرمایه انسانی، ۲(۴)، ۱۶۱–۱۹۰.",
    "شهدادی، علی و مهدوی، داوود (۱۴۰۵). شناسایی و تبیین الگوی رضایت شغلی برای ارتقای سطح عملکرد سازمانی با هم‌افزایی در سرمایه انسانی در بین یاوران علمی. مطالعات مدیریت راهبردی، ۱۷(۶۵)، ۲۵۵–۲۷۵.",
]
# English entries; *text* is italic (book titles, journal names, volumes).
EN_REFS = [
    "Appelbaum, E., Bailey, T., Berg, P., & Kalleberg, A. L. (2000). *Manufacturing advantage: Why high-performance work systems pay off*. Cornell University Press.",
    "Blau, P. M. (1964). *Exchange and power in social life*. John Wiley & Sons.",
    "Cerasoli, C. P., Nicklin, J. M., & Ford, M. T. (2014). Intrinsic motivation and extrinsic incentives jointly predict performance: A 40-year meta-analysis. *Psychological Bulletin*, *140*(4), 980–1008. https://doi.org/10.1037/a0035661",
    "Cochran, W. G. (1977). *Sampling techniques* (3rd ed.). John Wiley & Sons.",
    "Dartono, T., Raharjo, P. G., & Nurwati, E. (2026). Training, career development, and environment to improve employee performance with work motivation as a mediating variable. *Journal of Management: Small and Medium Enterprises (SMEs)*, *19*(2), 1597–1614. https://doi.org/10.35508/jom.v19i2.29046",
    "Fornell, C., & Larcker, D. F. (1981). Evaluating structural equation models with unobservable variables and measurement error. *Journal of Marketing Research*, *18*(1), 39–50.",
    "Handayani, A. J., Sugiono, E., Efendi, S., & Hasanudin. (2025). Enhancing employee performance through career development, training, and human resource planning: The mediating effect of motivation. *Jurnal Ilmiah Manajemen Kesatuan*, *13*(6), 4361–4374. https://doi.org/10.37641/jimkes.v13i6.4076",
    "Herzberg, F., Mausner, B., & Snyderman, B. B. (1959). *The motivation to work* (2nd ed.). John Wiley & Sons.",
    "Jiang, K., Lepak, D. P., Hu, J., & Baer, J. C. (2012). How does human resource management influence organizational outcomes? A meta-analytic investigation of mediating mechanisms. *Academy of Management Journal*, *55*(6), 1264–1294. https://doi.org/10.5465/amj.2011.0088",
    "Kraimer, M. L., Seibert, S. E., Wayne, S. J., Liden, R. C., & Bravo, J. (2011). Antecedents and outcomes of organizational support for development: The critical role of career opportunities. *Journal of Applied Psychology*, *96*(3), 485–500. https://doi.org/10.1037/a0021452",
    "Mahardiansyah, & Mauludin, H. (2025). The effect of job promotion on work motivation and work engagement. *Journal of Industrial Engineering & Management Research*, *6*(3).",
    "Nyaga, A. W., & Omuya, J. (2024). Effects of promotion practices on employee performance in the National Bank of Kenya. *International Journal of Business, Economics and Social Development*, *5*(2), 219–226.",
    "Preacher, K. J., & Hayes, A. F. (2008). Asymptotic and resampling strategies for assessing and comparing indirect effects in multiple mediator models. *Behavior Research Methods*, *40*(3), 879–891.",
    "Udayar, S., Urbanaviciute, I., Maggiori, C., & Rossier, J. (2024). Does promotion foster career sustainability? A comparative three-wave study on the role of promotion in work stress, job satisfaction, and career-related performance. *International Journal for Educational and Vocational Guidance*. https://doi.org/10.1007/s10775-024-09694-3",
    "Vroom, V. H. (1964). *Work and motivation*. John Wiley & Sons.",
    "Weng, Q., McElroy, J. C., Morrow, P. C., & Liu, R. (2010). The relationship between career growth and organizational commitment. *Journal of Vocational Behavior*, *77*(3), 391–400.",
]

# the references cell is the last table cell that holds the entry paragraphs
ref_anchor = find_para(prefix="ابغری، آرمام")
cell = next(a for a in ref_anchor.iterancestors() if a.tag == W + "tc")
old_paras = cell.findall(W + "p")
fa_proto = copy.deepcopy(ref_anchor)
en_proto = copy.deepcopy(find_para(prefix="Appelbaum"))
for p in old_paras:
    cell.remove(p)


def make_para(proto, segments, *, bold=False, heading=False, english=False):
    """Build a reference paragraph; pPr children are written in schema order
    (bidi, spacing, ind, jc) so Word accepts the file."""
    p = etree.Element(W + "p")
    ppr = etree.SubElement(p, W + "pPr")
    bidi = etree.SubElement(ppr, W + "bidi")
    if english:
        bidi.set(W + "val", "0")  # the table is bidiVisual; keep English left-to-right
    spacing = etree.SubElement(ppr, W + "spacing")
    spacing.set(W + "before", "120" if heading else "0")
    spacing.set(W + "after", "160")
    spacing.set(W + "line", "360")
    spacing.set(W + "lineRule", "auto")
    if not heading:
        ind = etree.SubElement(ppr, W + "ind")
        ind.set(W + "left", "567")
        ind.set(W + "hanging", "567")
    jc = etree.SubElement(ppr, W + "jc")
    if heading:
        jc.set(W + "val", "center")
    else:
        jc.set(W + "val", "left" if english else "both")
    for text, italic in segments:
        r = etree.SubElement(p, W + "r")
        rpr = etree.SubElement(r, W + "rPr")
        fonts = etree.SubElement(rpr, W + "rFonts")
        if english:
            for k in ("ascii", "hAnsi", "cs"):
                fonts.set(W + k, "Times New Roman")
        else:
            fonts.set(W + "cs", "B Nazanin")
        if bold:
            etree.SubElement(rpr, W + "b")
            etree.SubElement(rpr, W + "bCs")
        if italic:
            etree.SubElement(rpr, W + "i")
            etree.SubElement(rpr, W + "iCs")
        sz = "24" if (heading or not english) else "22"
        etree.SubElement(rpr, W + "sz").set(W + "val", sz)
        etree.SubElement(rpr, W + "szCs").set(W + "val", sz)
        if not english:
            etree.SubElement(rpr, W + "rtl")
        t = etree.SubElement(r, W + "t")
        t.set(XML_SPACE, "preserve")
        t.text = text
    return p


def split_italics(s):
    segs = []
    for k, part in enumerate(s.split("*")):
        if part:
            segs.append((part, k % 2 == 1))
    return segs


cell.append(make_para(fa_proto, [(FA_HEAD, False)], bold=True, heading=True))
for ref in FA_REFS:
    cell.append(make_para(fa_proto, [(ref, False)]))
cell.append(make_para(fa_proto, [(EN_HEAD, False)], bold=True, heading=True))
for ref in EN_REFS:
    cell.append(make_para(en_proto, split_italics(ref), english=True))

# ------------------------------------------------ 5. write the package
new_doc = etree.tostring(doc_root, xml_declaration=True, encoding="UTF-8", standalone=True)
new_fn = etree.tostring(fn_root, xml_declaration=True, encoding="UTF-8", standalone=True)
with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
    for info in zin.infolist():
        if info.filename == "word/document.xml":
            data = new_doc
        elif info.filename == "word/footnotes.xml":
            data = new_fn
        else:
            data = zin.read(info.filename)
        zout.writestr(info, data)
print("written", dst, "footnotes kept:", len(kept))
