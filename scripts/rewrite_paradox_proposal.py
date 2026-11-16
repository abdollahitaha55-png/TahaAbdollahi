"""Rewrite sections 4-3, 4-4, 4-5, 4-7 and the reference list of the
paradoxical-leadership proposal (Astan Quds Razavi), starting from the
original upload.

* 4-3 problem statement: APA in-text citations. Foreign sources get a numbered
  note placed inside the same box, left-to-right, containing only the English
  surname(s) and year. Persian sources have no note.
* 4-4 objectives and 4-5 questions: the three items given by the user.
* 4-7 literature review: every entry in the order who / title / population /
  purpose / method / results. Foreign titles are translated into Persian.
  Notes are numbered again within this box.
* 4-10 reference list (APA): Persian entries, then English entries.
  Only sources whose bibliographic details were verified are listed.

Usage: python3 scripts/rewrite_paradox_proposal.py <in.docx> <out.docx>
"""
import copy
import sys
import zipfile

from lxml import etree

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = "{%s}" % W_NS
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"
src, dst = sys.argv[1:3]

zin = zipfile.ZipFile(src)
doc = etree.fromstring(zin.read("word/document.xml"))
fnroot = etree.fromstring(zin.read("word/footnotes.xml"))


def txt(el):
    return "".join(x.text or "" for x in el.iter(W + "t"))


def table_by_heading(needle):
    hits = []
    for tbl in doc.iter(W + "tbl"):
        rows = tbl.findall(W + "tr")
        if rows and needle in txt(rows[0]):
            hits.append(tbl)
    assert len(hits) == 1, (needle, len(hits))
    return hits[0]


def body_cell(tbl, row=-1):
    cell = tbl.findall(W + "tr")[row].findall(W + "tc")[0]
    assert cell.find(W + "tbl") is None
    return cell


def cell_size(cell, default=26):
    for r in cell.iter(W + "r"):
        sz = r.find(W + "rPr/" + W + "sz")
        if sz is not None:
            return int(sz.get(W + "val"))
    return default


def make_run(text, sz, bold=False, italic=False, sup=False, eng=False):
    r = etree.Element(W + "r")
    rpr = etree.SubElement(r, W + "rPr")
    fonts = etree.SubElement(rpr, W + "rFonts")
    if eng:
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
    etree.SubElement(rpr, W + "sz").set(W + "val", str(sz))
    etree.SubElement(rpr, W + "szCs").set(W + "val", str(sz))
    if sup:
        etree.SubElement(rpr, W + "vertAlign").set(W + "val", "superscript")
    if not eng:
        etree.SubElement(rpr, W + "rtl")
    t = etree.SubElement(r, W + "t")
    t.set(XML_SPACE, "preserve")
    t.text = text
    return r


def persian_ppr(justify="both", hanging=False, center=False):
    ppr = etree.Element(W + "pPr")
    etree.SubElement(ppr, W + "bidi")
    sp = etree.SubElement(ppr, W + "spacing")
    sp.set(W + "before", "60")
    sp.set(W + "after", "60")
    sp.set(W + "line", "360")
    sp.set(W + "lineRule", "auto")
    if hanging:
        ind = etree.SubElement(ppr, W + "ind")
        ind.set(W + "left", "567")
        ind.set(W + "hanging", "567")
    etree.SubElement(ppr, W + "jc").set(W + "val", "center" if center else justify)
    return ppr


def english_ppr(justify="left", hanging=True):
    ppr = etree.Element(W + "pPr")
    etree.SubElement(ppr, W + "bidi").set(W + "val", "0")
    sp = etree.SubElement(ppr, W + "spacing")
    sp.set(W + "before", "0")
    sp.set(W + "after", "160")
    sp.set(W + "line", "360")
    sp.set(W + "lineRule", "auto")
    if hanging:
        ind = etree.SubElement(ppr, W + "ind")
        ind.set(W + "left", "567")
        ind.set(W + "hanging", "567")
    etree.SubElement(ppr, W + "jc").set(W + "val", justify)
    return ppr


def split_italics(s):
    segs = []
    for k, part in enumerate(s.split("*")):
        if part:
            segs.append(("i", part) if k % 2 else ("t", part))
    return segs


def build_cell(ppr, sz, paragraphs):
    """paragraphs: list of segment lists.
    Segments: ("t", text) plain, ("b", text) bold, ("note", english) numbered note.
    Returns (paragraph elements, notes list)."""
    notes = []
    out = []
    for segs in paragraphs:
        p = etree.Element(W + "p")
        if ppr is not None:
            p.append(copy.deepcopy(ppr))
        for kind, val in segs:
            if kind == "t":
                p.append(make_run(val, sz))
            elif kind == "b":
                p.append(make_run(val, sz, bold=True))
            elif kind == "note":
                notes.append(val)
                p.append(make_run(str(len(notes)), sz, sup=True))
            else:
                raise ValueError(kind)
        out.append(p)
    return out, notes


def notes_block(notes):
    """Numbered notes inside the box: left-to-right, English text."""
    if not notes:
        return []
    sep = etree.Element(W + "p")
    ppr = etree.SubElement(sep, W + "pPr")
    bdr = etree.SubElement(ppr, W + "pBdr")
    top = etree.SubElement(bdr, W + "top")
    top.set(W + "val", "single")
    top.set(W + "sz", "4")
    top.set(W + "space", "1")
    top.set(W + "color", "auto")
    sp = etree.SubElement(ppr, W + "spacing")
    sp.set(W + "before", "120")
    sp.set(W + "after", "40")
    etree.SubElement(ppr, W + "jc").set(W + "val", "left")
    out = [sep]
    for n, text in enumerate(notes, start=1):
        p = etree.Element(W + "p")
        p.append(english_ppr(justify="left", hanging=False))
        p.append(make_run(str(n), 20, sup=True, eng=True))
        p.append(make_run(" " + text, 20, eng=True))
        out.append(p)
    return out


def replace_children(cell, paras):
    for p in cell.findall(W + "p"):
        cell.remove(p)
    for p in paras:
        cell.append(p)


# ------------------------------------------------------------ 4-3 problem statement
c43 = body_cell(table_by_heading("4-3- بیان مسئله"))
sz43 = cell_size(c43, 28)
ppr43 = c43.find(W + "p").find(W + "pPr")
P43 = [
    [
        ("t", "سازمان‌های امروزی به‌طور فزاینده با الزامات متضاد و هم‌زمان مواجه‌اند که مدیریت آن‌ها را دشوار می‌سازد؛ کنترل در برابر انعطاف، ثبات در برابر تغییر، و تمرکز در برابر تفویض اختیار از جمله این تناقض‌هاست. نظریه پارادوکس در مدیریت بر این فرض استوار است که چنین تناقض‌هایی را نمی‌توان با انتخاب یک قطب و کنار گذاشتن قطب دیگر حل کرد، بلکه باید هم‌زمان مدیریت شوند (اسمیت و لوئیس، ۲۰۱۱)"),
        ("note", "Smith & Lewis, 2011"),
        ("t", ". در پاسخ به این نیاز، مفهوم رهبری پارادوکسیکال شکل گرفت؛ سازه‌ای که ژانگ و همکاران (۲۰۱۵)"),
        ("note", "Zhang et al., 2015"),
        ("t", " با پنج بعد مفهوم‌پردازی شد: ترکیب خودمحوری با دیگرمحوری، حفظ هم‌زمان فاصله و نزدیکی با زیردستان، یکسان‌نگری در کنار فردی‌نگری، سخت‌گیری در اجرای الزامات کاری همراه با انعطاف‌پذیری، و حفظ کنترل در تصمیم‌گیری همراه با تفویض خودمختاری."),
    ],
    [
        ("t", "با وجود شکل‌گیری سریع ادبیات پیرامون پیامدهای رهبری پارادوکسیکال، پژوهش‌های مربوط به عوامل شکل‌دهنده و پیشایندهای این سبک رهبری همچنان محدودند. والدمن و بوون (۲۰۱۶)"),
        ("note", "Waldman & Bowen, 2016"),
        ("t", " تأکید می‌کنند که توسعه توانایی رهبری پارادوکسیکال نیازمند شرایط فردی و سازمانی خاصی است که باید شناسایی شوند. ژانگ و هان (۲۰۱۹)"),
        ("note", "Zhang & Han, 2019"),
        ("t", " نیز نشان دادند جهت‌گیری بلندمدت سازمان می‌تواند یکی از پیشایندهای این سبک رهبری باشد. در ادبیات داخلی ایران این سازه هنوز نوپاست و پژوهش‌های پارادوکس بیشتر به مدیریت پارادوکس‌های منابع انسانی و سازمانی پرداخته‌اند (دامغانیان و همکاران، ۱۳۹۹؛ جعفری و همکاران، ۱۳۹۹)، نه به عوامل مؤثر بر شکل‌گیری رهبری پارادوکسیکال."),
    ],
    [
        ("t", "از منظر عملی، آستان قدس رضوی، که یکی از موفق‌ترین نمونه‌های ماندگاری و اثربخشی نهادهای وقفی در جهان اسلام و سطح جهانی است (حسن‌آبادی، ۲۰۲۵)"),
        ("note", "Hasanabadi, 2025"),
        ("t", "، سازمانی چندمنظوره و ذاتاً پارادوکسیکال است؛ این نهاد باید هم‌زمان مأموریت مذهبی و فرهنگی خود را با مدیریت کارآمد واحدهای اقتصادی، فرهنگی و آموزشی وابسته تطبیق دهد. رهبرانی که در چنین بافتی فعالیت می‌کنند به‌طور مستمر میان الزامات متناقضی چون حفظ سنت و لزوم نوسازی، تمرکز تصمیم‌گیری در رأس و تفویض اختیار به مدیران واحدهای اقتصادی، و بازدهی مالی در برابر اهداف خیرخواهانه در نوسان‌اند. شناسایی و اولویت‌بندی عواملی که به شکل‌گیری این سبک رهبری در چنین سازمانی کمک می‌کنند، می‌تواند مستقیماً به طراحی برنامه‌های توسعه مدیران این نهاد کمک کند."),
    ],
    [
        ("t", "با توجه به کمبود پژوهش داخلی و خارجی در خصوص عوامل مؤثر بر شکل‌گیری رهبری پارادوکسیکال، برخلاف پیامدهای آن که بیشتر بررسی شده‌اند، و نبود مطالعه‌ای که این موضوع را در بافت یک نهاد چندمنظوره ایرانی مانند آستان قدس رضوی بررسی کرده باشد، این پژوهش در پی پاسخ به این خلأ نظری و عملی است."),
    ],
]
paras43, notes43 = build_cell(ppr43, sz43, P43)
replace_children(c43, paras43 + notes_block(notes43))
assert len(notes43) == 5, notes43

# ------------------------------------------------------------ 4-4 objectives
c44 = body_cell(table_by_heading("4-4- اهداف تحقیق"))
sz44 = cell_size(c44, 28)
ppr44 = c44.find(W + "p").find(W + "pPr")
OBJ = [
    "۱. شناسایی عوامل مؤثر بر شکل‌گیری رهبری پارادوکسیکال در آستان قدس رضوی",
    "۲. شناسایی روابط متقابل میان عوامل مؤثر بر شکل‌گیری رهبری پارادوکسیکال در آستان قدس رضوی",
    "۳. اولویت‌بندی و رتبه‌بندی عوامل مؤثر بر شکل‌گیری رهبری پارادوکسیکال در آستان قدس رضوی",
]
obj_paras, _ = build_cell(ppr44, sz44, [[("t", s)] for s in OBJ])
replace_children(c44, obj_paras)

# ------------------------------------------------------------ 4-5 questions
c45 = body_cell(table_by_heading("4-5- سؤال"), row=1)
QUESTIONS = {
    "1. عوامل مؤثر": "۱. عوامل مؤثر بر شکل‌گیری رهبری پارادوکسیکال در آستان قدس رضوی کدامند؟",
    "2. کدام یک": "۲. روابط متقابل میان عوامل مؤثر بر شکل‌گیری رهبری پارادوکسیکال در آستان قدس رضوی چگونه است؟",
    "3. اولویت و اهمیت": "۳. اولویت‌بندی و رتبه‌بندی عوامل مؤثر بر شکل‌گیری رهبری پارادوکسیکال در آستان قدس رضوی چگونه است؟",
}
done_q = 0
for p in c45.findall(W + "p"):
    t = txt(p)
    for prefix, new in QUESTIONS.items():
        if t.startswith(prefix):
            sz = cell_size(p, 28)
            for child in list(p):
                if child.tag != W + "pPr":
                    p.remove(child)
            p.append(make_run(new, sz))
            done_q += 1
assert done_q == 3, done_q

# ------------------------------------------------------------ 4-7 literature review
c47 = body_cell(table_by_heading("4-7- سابقۀ"))
sz47 = cell_size(c47, 26)
ppr47 = c47.findall(W + "p")[1].find(W + "pPr")
keep_head = copy.deepcopy(c47.findall(W + "p")[14])  # ج) heading, unchanged
keep_text = copy.deepcopy(c47.findall(W + "p")[15])  # ج) text, unchanged

EXT = [
    [("t", "کین و همکاران (۲۰۲۳)"), ("note", "Qin et al., 2023"),
     ("t", " در پژوهشی با عنوان «آیا رهبری پارادوکسیکال بر رفتار فعالانه کارکنان تأثیر دارد؟ مطالعه‌ای بر کارکنان شرکت‌های دولتی چین» با جامعه آماری ۵۴۰ کارمند شرکت‌های دولتی چین، با هدف بررسی اثر رهبری پارادوکسیکال بر رفتار فعالانه کارکنان و نقش میانجی رابطه سرپرست–زیردست و خودکارآمدی، با روش پیمایشی، تحلیل عاملی، رگرسیون و بوت‌استرپ، نشان دادند رهبری پارادوکسیکال رفتار فعالانه کارکنان را تقویت می‌کند و این اثر از طریق رابطه سرپرست–زیردست و خودکارآمدی منتقل می‌شود.")],
    [("t", "وولک و همکاران (۲۰۲۳)"), ("note", "Volk et al., 2023"),
     ("t", " در پژوهشی با عنوان «نظریه شبانه‌روزی رهبری پارادوکسیکال» با جامعه آماری ندارد (پژوهش نظری)، با هدف ارائه چارچوبی زمانی برای رهبری پارادوکسیکال بر پایه ریتم‌های شبانه‌روزی، با روش مفهوم‌پردازی نظری، استدلال کردند رهبران می‌توانند با ساختاردهی اپیزودهای رهبری بر پایه ریتم‌های زیستی خود و پیروان، دوگانگی‌هایی مانند کنترل در برابر توانمندسازی و قواعد جمعی در برابر نیازهای فردی پیروان را مدیریت کنند.")],
    [("t", "اسحاق و همکاران (۲۰۲۱)"), ("note", "Ishaq et al., 2021"),
     ("t", " در پژوهشی با عنوان «رفتارهای رهبر پارادوکسیکال: شخصیت رهبر و پیامدهای پیروان» با جامعه آماری ۱۳۱ مدیر و ۶۰۹ زیردست، با هدف بررسی اثر ویژگی‌های شخصیتی پنج‌عاملی رهبر بر رفتار پارادوکسیکال او و ارتباط این رفتار با عملکرد درون‌نقشی و نوآورانه زیردستان، با روش گردآوری داده از مدیران و زیردستانشان، نشان دادند توافق‌پذیری، وظیفه‌شناسی و روان‌رنجوری رهبر با ادراک زیردستان از رفتار پارادوکسیکال رابطه منفی دارد و این رفتار با عملکرد درون‌نقشی و نوآورانه زیردستان رابطه مثبت دارد؛ نقش سرمایه روان‌شناختی زیردستان نیز به‌عنوان تعدیل‌گر بررسی شد.")],
    [("t", "ژانگ و هان (۲۰۱۹)"),
     ("t", " در پژوهشی با عنوان «رفتار رهبر پارادوکسیکال در توسعه بلندمدت شرکت: پیشایندها و پیامدها» با جامعه آماری ۲۵ مدیر ارشد در مرحله مصاحبه، با هدف مفهوم‌پردازی رفتار رهبر پارادوکسیکال در توسعه بلندمدت شرکت و بررسی پیشایندها و پیامدهای آن، با روش مصاحبه و توسعه مقیاس ۲۴ گویه‌ای در دو مطالعه، نشان دادند جهت‌گیری بلندمدت سازمان با رفتار پارادوکسیکال رهبر رابطه مثبت دارد و این رفتار به افزایش سرمایه‌گذاری در تحقیق و توسعه، سهم بازار و اعتبار شرکت می‌انجامد.")],
    [("t", "والدمن و همکاران (۲۰۱۹)"), ("note", "Waldman et al., 2019"),
     ("t", " در پژوهشی با عنوان «نقش نظریه پارادوکس در تصمیم‌گیری و پژوهش‌های مدیریت» با جامعه آماری ندارد (پژوهش نظری)، با هدف تبیین نقش نظریه پارادوکس در پژوهش‌های مدیریت و تصمیم‌گیری، با روش مفهوم‌پردازی نظری، استدلال کردند نظریه پارادوکس چارچوبی برای فهم تناقض‌های هم‌زمان در رهبری فراهم می‌کند.")],
    [("t", "والدمن و بوون (۲۰۱۶)"),
     ("t", " در پژوهشی با عنوان «یادگیری رهبری پارادوکس‌آگاه» با جامعه آماری ندارد (پژوهش نظری)، با هدف تبیین چگونگی یادگیری رهبری پارادوکس‌محور، با روش مفهوم‌پردازی نظری، استدلال کردند توسعه این توانایی نیازمند شرایط فردی و سازمانی خاصی است که باید شناسایی شوند.")],
    [("t", "ژانگ و همکاران (۲۰۱۵)"),
     ("t", " در پژوهشی با عنوان «رفتارهای رهبر پارادوکسیکال در مدیریت نیروی انسانی: پیشایندها و پیامدها» با جامعه آماری ۷۶ سرپرست و ۵۱۶ زیردست از شش شرکت در مطالعه میدانی، با هدف مفهوم‌پردازی و سنجش این سازه با پنج بعد و بررسی پیشایندها و پیامدهای آن، با روش توسعه مقیاس در پنج نمونه چینی و پیمایش میدانی، نشان دادند تفکر کل‌نگر و پیچیدگی یکپارچه‌ساز سرپرستان با رفتار پارادوکسیکال آنان رابطه مثبت دارد و این رفتار با افزایش مهارت، سازگاری و کنشگری زیردستان همراه است.")],
]
INT = [
    [("t", "جعفری و همکاران (۱۳۹۹)"),
     ("t", " در پژوهشی با عنوان «طراحی الگوی مدیریت پارادوکس‌های بیرونی منابع انسانی (مطالعه موردی: نیروی هوایی ارتش جمهوری اسلامی ایران)» با جامعه آماری خبرگان منابع انسانی (در مصاحبه اکتشافی چهار خبره و در پانل دلفی سه‌مرحله‌ای، با انتخاب هدفمند و گلوله‌برفی)، با هدف طراحی الگوی مدیریت پارادوکس‌های بیرونی منابع انسانی برای هم‌راستایی فرایندهای منابع انسانی، با روش آمیخته، نشان دادند از ۲۱ پارادوکس بیرونی تأییدشده، ۱۰ مورد با راهبرد ترکیب و ۷ مورد با راهبرد تفکیک فضایی مدیریت می‌شوند.")],
    [("t", "دامغانیان و همکاران (۱۳۹۹)"),
     ("t", " در پژوهشی با عنوان «طراحی الگوی مدیریت پارادوکس‌های درونی منابع انسانی (موردمطالعه: نیروی هوایی ارتش جمهوری اسلامی ایران)» با جامعه آماری کارشناسان و متخصصان فرایندهای منابع انسانی نیروی هوایی ارتش، با هدف طراحی الگوی مدیریت پارادوکس‌های درونی منابع انسانی، با روش کاربردی، توصیفی-تبیینی و آمیخته (مصاحبه اکتشافی و پانل دلفی)، نشان دادند از ۱۶ پارادوکس درونی، چهار مورد با راهبرد پذیرش، هفت مورد با راهبرد ترکیب و سه مورد با راهبرد تفکیک فضایی قابل مدیریت‌اند.")],
]
HEAD_EXT = "الف) پیشینه‌های پژوهشی خارجی (از جدید به قدیم):"
HEAD_INT = "ب) پیشینه‌های پژوهشی داخلی (ایران) - از جدید به قدیم:"
lit_segments = [[("b", HEAD_EXT)]] + EXT + [[("b", HEAD_INT)]] + INT
lit_paras, notes47 = build_cell(ppr47, sz47, lit_segments)
assert len(notes47) == 4, notes47
replace_children(c47, lit_paras + [keep_head, keep_text] + notes_block(notes47))

# ------------------------------------------------------------ 4-10 reference list (APA)
tref = table_by_heading("منابع : (براساس")
head_cell = tref.findall(W + "tr")[0].findall(W + "tc")[0]
for t_el in head_cell.iter(W + "t"):
    if t_el.text and "APA" in t_el.text:
        t_el.text = t_el.text.replace("APA", "ای‌پی‌ای")
cr = body_cell(tref)
szr = cell_size(cr, 26)
FA_REFS = [
    "جعفری، کاظم؛ دامغانیان، حسین و عسگری، ناصر (۱۳۹۹). طراحی الگوی مدیریت پارادوکس‌های بیرونی منابع انسانی (مطالعه موردی: نیروی هوایی ارتش جمهوری اسلامی ایران). فصلنامه چشم‌انداز مدیریت دولتی، ۱۱(۴)، ۵۹–۸۸. https://doi.org/10.48308/jpap.2020.100646",
    "دامغانیان، حسین؛ عسگری، ناصر و جعفری، کاظم (۱۳۹۹). طراحی الگوی مدیریت پارادوکس‌های درونی منابع انسانی (موردمطالعه: نیروی هوایی ارتش جمهوری اسلامی ایران). پژوهش‌های مدیریت منابع انسانی، ۱۲(۳)، ۱۱۹–۱۶۰.",
]
EN_REFS = [
    "Hasanabadi, A. (2025). Key factors influencing the formation, expansion, and longevity of the waqf system in Astan-i Quds Razavi. *Razavi Heritage*, *1*(1), 1–19. https://doi.org/10.30513/rhj.2025.6976.1000",
    "Ishaq, E., Bashir, S., & Khan, A. K. (2021). Paradoxical leader behaviors: Leader personality and follower outcomes. *Applied Psychology*, *70*(1), 342–357. https://doi.org/10.1111/apps.12233",
    "Qin, Q., Wu, X., & Song, Q. (2023). Does paradoxical leadership influence employees' proactive work behavior? A study based on employees in Chinese state-owned enterprises. *Frontiers in Psychology*, *14*, Article 1269906. https://doi.org/10.3389/fpsyg.2023.1269906",
    "Smith, W. K., & Lewis, M. W. (2011). Toward a theory of paradox: A dynamic equilibrium model of organizing. *Academy of Management Review*, *36*(2), 381–403.",
    "Volk, S., Waldman, D. A., & Barnes, C. M. (2023). A circadian theory of paradoxical leadership. *Academy of Management Review*, *48*(4), 611–638. https://doi.org/10.5465/amr.2020.0468",
    "Waldman, D. A., & Bowen, D. E. (2016). Learning to be a paradox-savvy leader. *Academy of Management Perspectives*, *30*(3), 316–327.",
    "Waldman, D. A., Putnam, L. L., Miron-Spektor, E., & Siegel, D. (2019). The role of paradox theory in decision making and management research. *Organizational Behavior and Human Decision Processes*, *155*, 1–6.",
    "Zhang, Y., & Han, Y.-L. (2019). Paradoxical leader behavior in long-term corporate development: Antecedents and consequences. *Organizational Behavior and Human Decision Processes*, *155*, 42–54. https://doi.org/10.1016/j.obhdp.2019.03.007",
    "Zhang, Y., Waldman, D. A., Han, Y., & Li, X. (2015). Paradoxical leader behaviors in people management: Antecedents and consequences. *Academy of Management Journal*, *58*(2), 538–566. https://doi.org/10.5465/AMJ.2012.0995",
]

ref_paras = []
ref_paras.append(build_cell(persian_ppr(center=True), szr, [[("b", "منابع فارسی")]])[0][0])
for ref in FA_REFS:
    ref_paras.append(build_cell(persian_ppr(hanging=True), szr, [[("t", ref)]])[0][0])
ref_paras.append(build_cell(persian_ppr(center=True), szr, [[("b", "منابع انگلیسی")]])[0][0])
for ref in EN_REFS:
    p = etree.Element(W + "p")
    p.append(english_ppr())
    for kind, val in split_italics(ref):
        p.append(make_run(val, 22, italic=(kind == "i"), eng=True))
    ref_paras.append(p)
replace_children(cr, ref_paras)

# ------------------------------------------------------------ footnote part: no Word footnotes remain
for f in list(fnroot.findall(W + "footnote")):
    if f.get(W + "type") is None:
        fnroot.remove(f)

# ------------------------------------------------------------ write package
assert not list(doc.iter(W + "footnoteReference"))
new_doc = etree.tostring(doc, xml_declaration=True, encoding="UTF-8", standalone=True)
new_fn = etree.tostring(fnroot, xml_declaration=True, encoding="UTF-8", standalone=True)
with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
    for info in zin.infolist():
        if info.filename == "word/document.xml":
            data = new_doc
        elif info.filename == "word/footnotes.xml":
            data = new_fn
        else:
            data = zin.read(info.filename)
        zout.writestr(info, data)
print("written", dst, "notes 4-3:", len(notes43), "notes 4-7:", len(notes47))
