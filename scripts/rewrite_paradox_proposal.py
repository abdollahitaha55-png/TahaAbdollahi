"""Rewrite sections 4-3, 4-4, 4-5, 4-7 and the reference list of the
paradoxical-leadership proposal (Astan Quds Razavi).

* 4-3 problem statement: APA in-text citations (Persian name + year); footnotes
  only for foreign sources, English surname(s) and year; placeholder for the
  Astan Quds Razavi source, which could not be verified.
* 4-4 objectives and 4-5 questions: replaced with the three given items each.
* 4-7 literature review: every entry in the order who / title / population /
  purpose / method / results. Foreign titles are translated into Persian.
  Values that could not be verified from the source are highlighted placeholders.
* 4-10 reference list (APA): Persian entries, then English entries.

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


def body_cell(tbl):
    cell = tbl.findall(W + "tr")[-1].findall(W + "tc")[0]
    assert cell.find(W + "tbl") is None
    return cell


def cell_size(cell, default=26):
    for r in cell.iter(W + "r"):
        sz = r.find(W + "rPr/" + W + "sz")
        if sz is not None:
            return int(sz.get(W + "val"))
    return default


def make_run(text, sz, bold=False, italic=False, hl=False, eng=False):
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
    if hl:
        etree.SubElement(rpr, W + "highlight").set(W + "val", "yellow")
    if not eng:
        etree.SubElement(rpr, W + "rtl")
    t = etree.SubElement(r, W + "t")
    t.set(XML_SPACE, "preserve")
    t.text = text
    return r


# ------------------------------------------------------------ footnotes
FN = []  # (id, english text)
proto_fn = [f for f in fnroot.findall(W + "footnote") if f.get(W + "type") is None][0]


def fnref_run(fid):
    r = etree.Element(W + "r")
    rpr = etree.SubElement(r, W + "rPr")
    etree.SubElement(rpr, W + "rStyle").set(W + "val", "FootnoteReference")
    etree.SubElement(r, W + "footnoteReference").set(W + "id", str(fid))
    return r


def build_para(ppr, segments, sz, eng=False):
    p = etree.Element(W + "p")
    if ppr is not None:
        p.append(copy.deepcopy(ppr))
    for seg in segments:
        kind, value = seg
        if kind == "t":
            p.append(make_run(value, sz, eng=eng))
        elif kind == "b":
            p.append(make_run(value, sz, bold=True, eng=eng))
        elif kind == "i":
            p.append(make_run(value, sz, italic=True, eng=eng))
        elif kind == "ph":
            p.append(make_run(value, sz, hl=True, eng=eng))
        elif kind == "fn":
            fid = len(FN) + 1
            FN.append((fid, value))
            p.append(fnref_run(fid))
        else:
            raise ValueError(kind)
    return p


def replace_children(cell, paras):
    for p in cell.findall(W + "p"):
        cell.remove(p)
    for p in paras:
        cell.append(p)


def persian_ppr(cell_para, justify="both", bidi=True, hanging=False):
    ppr = etree.Element(W + "pPr")
    if bidi:
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
    etree.SubElement(ppr, W + "jc").set(W + "val", justify)
    return ppr


def english_ppr():
    ppr = etree.Element(W + "pPr")
    etree.SubElement(ppr, W + "bidi").set(W + "val", "0")
    sp = etree.SubElement(ppr, W + "spacing")
    sp.set(W + "before", "0")
    sp.set(W + "after", "160")
    sp.set(W + "line", "360")
    sp.set(W + "lineRule", "auto")
    ind = etree.SubElement(ppr, W + "ind")
    ind.set(W + "left", "567")
    ind.set(W + "hanging", "567")
    etree.SubElement(ppr, W + "jc").set(W + "val", "left")
    return ppr


def split_italics(s):
    segs = []
    for k, part in enumerate(s.split("*")):
        if part:
            segs.append(("i", part) if k % 2 else ("t", part))
    return segs


# ------------------------------------------------------------ 4-3 problem statement
t43 = table_by_heading("4-3- بیان مسئله")
c43 = body_cell(t43)
sz43 = cell_size(c43, 28)
ppr43 = c43.find(W + "p").find(W + "pPr")

P43 = [
    [
        ("t", "سازمان‌های امروزی به‌طور فزاینده با الزامات متضاد و هم‌زمان مواجه‌اند که مدیریت آن‌ها را دشوار می‌سازد؛ کنترل در برابر انعطاف، ثبات در برابر تغییر، و تمرکز در برابر تفویض اختیار از جمله این تناقض‌هاست. نظریه پارادوکس در مدیریت بر این فرض استوار است که چنین تناقض‌هایی را نمی‌توان با انتخاب یک قطب و کنار گذاشتن قطب دیگر حل کرد، بلکه باید هم‌زمان مدیریت شوند (اسمیت و لوئیس، ۲۰۱۱)"),
        ("fn", "Smith & Lewis, 2011"),
        ("t", ". در پاسخ به این نیاز، مفهوم رهبری پارادوکسیکال شکل گرفت؛ سازه‌ای که ژانگ و همکاران (۲۰۱۵)"),
        ("fn", "Zhang et al., 2015"),
        ("t", " با پنج بعد مفهوم‌پردازی شد: ترکیب خودمحوری با دیگرمحوری، حفظ هم‌زمان فاصله و نزدیکی با زیردستان، یکسان‌نگری در کنار فردی‌نگری، سخت‌گیری در اجرای الزامات کاری همراه با انعطاف‌پذیری، و حفظ کنترل در تصمیم‌گیری همراه با تفویض خودمختاری."),
    ],
    [
        ("t", "با وجود شکل‌گیری سریع ادبیات پیرامون پیامدهای رهبری پارادوکسیکال، پژوهش‌های مربوط به عوامل شکل‌دهنده و پیشایندهای این سبک رهبری همچنان محدودند. والدمن و بوون (۲۰۱۶)"),
        ("fn", "Waldman & Bowen, 2016"),
        ("t", " تأکید می‌کنند که توسعه توانایی رهبری پارادوکسیکال نیازمند شرایط فردی و سازمانی خاصی است که باید شناسایی شوند. ژانگ و هان (۲۰۱۹)"),
        ("fn", "Zhang & Han, 2019"),
        ("t", " نیز نشان دادند جهت‌گیری بلندمدت سازمان می‌تواند یکی از پیشایندهای این سبک رهبری باشد؛ اما در ادبیات داخلی ایران این سازه هنوز نوپاست و مطالعات موجود عمدتاً به پیامدهای آن، مانند خلاقیت کارکنان (قربانی و همکاران، ۱۴۰۲)، پرداخته‌اند، نه به عوامل مؤثر بر شکل‌گیری آن."),
    ],
    [
        ("t", "از منظر عملی، آستان قدس رضوی به‌عنوان بزرگ‌ترین نهاد موقوفاتی ایران، سازمانی چندمنظوره و ذاتاً پارادوکسیکال است "),
        ("ph", "(آستان قدس رضوی، [سال])"),
        ("t", "؛ این نهاد باید هم‌زمان مأموریت مذهبی و فرهنگی خود را با مدیریت کارآمد ده‌ها شرکت و نهاد اقتصادی، درمانی، کشاورزی و آموزشی وابسته تطبیق دهد. رهبرانی که در چنین بافتی فعالیت می‌کنند به‌طور مستمر میان الزامات متناقضی چون حفظ سنت و لزوم نوسازی، تمرکز تصمیم‌گیری در رأس و تفویض اختیار به مدیران واحدهای اقتصادی، و بازدهی مالی در برابر اهداف خیرخواهانه در نوسان‌اند. شناسایی و اولویت‌بندی عواملی که به شکل‌گیری این سبک رهبری در چنین سازمانی کمک می‌کنند، می‌تواند مستقیماً به طراحی برنامه‌های توسعه مدیران این نهاد کمک کند."),
    ],
    [
        ("t", "با توجه به کمبود پژوهش داخلی و خارجی در خصوص عوامل مؤثر بر شکل‌گیری رهبری پارادوکسیکال، برخلاف پیامدهای آن که بیشتر بررسی شده‌اند، و نبود مطالعه‌ای که این موضوع را در بافت یک نهاد چندمنظوره ایرانی مانند آستان قدس رضوی بررسی کرده باشد، این پژوهش در پی پاسخ به این خلأ نظری و عملی است."),
    ],
]
c43_paras = [build_para(ppr43, segs, sz43) for segs in P43]
replace_children(c43, c43_paras)

# ------------------------------------------------------------ 4-4 objectives
t44 = table_by_heading("4-4- اهداف تحقیق")
c44 = body_cell(t44)
sz44 = cell_size(c44, 28)
ppr44 = c44.find(W + "p").find(W + "pPr")
OBJ = [
    "۱. شناسایی عوامل مؤثر بر شکل‌گیری رهبری پارادوکسیکال در آستان قدس رضوی",
    "۲. شناسایی روابط متقابل میان عوامل مؤثر بر شکل‌گیری رهبری پارادوکسیکال در آستان قدس رضوی",
    "۳. اولویت‌بندی و رتبه‌بندی عوامل مؤثر بر شکل‌گیری رهبری پارادوکسیکال در آستان قدس رضوی",
]
replace_children(c44, [build_para(ppr44, [("t", s)], sz44) for s in OBJ])

# ------------------------------------------------------------ 4-5 questions (only the three question paragraphs)
t45 = table_by_heading("4-5- سؤال")
c45 = t45.findall(W + "tr")[1].findall(W + "tc")[0]  # row 1 is the 4-5 body
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
t47 = table_by_heading("4-7- سابقۀ")
c47 = body_cell(t47)
sz47 = cell_size(c47, 26)
ppr47 = c47.findall(W + "p")[1].find(W + "pPr")
keep_pa = copy.deepcopy(c47.findall(W + "p")[14])  # ج) heading
keep_pb = copy.deepcopy(c47.findall(W + "p")[15])  # ج) text (unchanged)

HEAD_EXT = "الف) پیشینه‌های پژوهشی خارجی (از جدید به قدیم):"
HEAD_INT = "ب) پیشینه‌های پژوهشی داخلی (ایران) - از جدید به قدیم:"

ENTRIES = [
    [("t", "لو و همکاران (۲۰۲۶)"), ("fn", "Lu et al., 2026"),
     ("t", " در پژوهشی با عنوان «پیامدهای متناقض عملکرد بالا: چگونگی و شرایط تأثیر عملکرد زیردستان بر رفتارهای رهبری پارادوکسیکال» با جامعه آماری "),
     ("ph", "[باید از متن کامل مقاله تکمیل شود]"),
     ("t", "، با هدف شناسایی عملکرد زیردستان به‌عنوان پیشایند رفتارهای رهبری پارادوکسیکال، با روش "),
     ("ph", "[باید از متن کامل مقاله تکمیل شود]"),
     ("t", " نشان دادند عملکرد بالای زیردستان می‌تواند رهبران را به سمت بروز رفتارهای پارادوکسیکال سوق دهد.")],
    [("t", "شو و همکاران (۲۰۲۵)"), ("fn", "Xu et al., 2025"),
     ("t", " در پژوهشی با عنوان «ابهام‌آفرینی رهبر پارادوکسیکال: چگونگی و شرایط بازداری رهبری پارادوکسیکال از رفتار فعالانه کارکنان» با جامعه آماری ۱۴۲ کارمند در مطالعه آزمایشی سناریومحور و ۴۰۴ دایاد سرپرست–کارمند در پیمایش چندموجی دوسویه، با هدف بررسی اثر رهبری پارادوکسیکال بر رفتار فعالانه کارکنان، با روش آزمایش سناریومحور و پیمایش چندموجی، نشان دادند رهبری پارادوکسیکال از طریق افزایش ابهام نقش رهبر و کارمند، رفتار فعالانه کارکنان را کاهش می‌دهد.")],
    [("t", "وولک و همکاران (۲۰۲۳)"), ("fn", "Volk et al., 2023"),
     ("t", " در پژوهشی با عنوان «نظریه شبانه‌روزی رهبری پارادوکسیکال» با جامعه آماری ندارد (پژوهش نظری)، با هدف ارائه چارچوبی زمانی برای رهبری پارادوکسیکال بر پایه ریتم‌های شبانه‌روزی، با روش مفهوم‌پردازی نظری، استدلال کردند رهبران می‌توانند با ساختاردهی اپیزودهای رهبری بر پایه ریتم‌های زیستی خود و پیروان، دوگانگی‌هایی مانند کنترل در برابر توانمندسازی و قواعد جمعی در برابر نیازهای فردی پیروان را مدیریت کنند.")],
    [("t", "اسحاق و همکاران (۲۰۲۱)"), ("fn", "Ishaq et al., 2021"),
     ("t", " در پژوهشی با عنوان «رفتارهای رهبر پارادوکسیکال: شخصیت رهبر و پیامدهای پیروان» با جامعه آماری ۱۳۱ مدیر و ۶۰۹ زیردست، با هدف بررسی اثر ویژگی‌های شخصیتی پنج‌عاملی رهبر بر رفتار پارادوکسیکال او و ارتباط این رفتار با عملکرد درون‌نقشی و نوآورانه زیردستان، با روش گردآوری داده از مدیران و زیردستانشان، نشان دادند توافق‌پذیری، وظیفه‌شناسی و روان‌رنجوری رهبر با ادراک زیردستان از رفتار پارادوکسیکال رابطه منفی دارد و این رفتار با عملکرد درون‌نقشی و نوآورانه زیردستان رابطه مثبت دارد؛ نقش سرمایه روان‌شناختی زیردستان نیز به‌عنوان تعدیل‌گر بررسی شد.")],
    [("t", "ژانگ و هان (۲۰۱۹)"),
     ("t", " در پژوهشی با عنوان «رفتار رهبر پارادوکسیکال در توسعه بلندمدت شرکت: پیشایندها و پیامدها» با جامعه آماری ۲۵ مدیر ارشد در مرحله مفهوم‌پردازی و مصاحبه، و نمونه‌های چندگانه در مطالعات کمّی "),
     ("ph", "[تعداد نمونه‌های کمّی باید از متن کامل مقاله تکمیل شود]"),
     ("t", "، با هدف مفهوم‌پردازی رفتار رهبر پارادوکسیکال در توسعه بلندمدت شرکت و بررسی پیشایندها و پیامدهای آن، با روش توسعه مقیاس در دو مطالعه با نمونه‌های چندگانه، نشان دادند جهت‌گیری بلندمدت سازمان با رفتار پارادوکسیکال رهبر رابطه مثبت دارد و این رفتار به افزایش سرمایه‌گذاری در تحقیق و توسعه، سهم بازار و اعتبار شرکت می‌انجامد.")],
    [("t", "والدمن و همکاران (۲۰۱۹)"), ("fn", "Waldman et al., 2019"),
     ("t", " در پژوهشی با عنوان «نقش نظریه پارادوکس در تصمیم‌گیری و پژوهش‌های مدیریت» با جامعه آماری ندارد (پژوهش نظری)، با هدف تبیین نقش نظریه پارادوکس در پژوهش‌های مدیریت و تصمیم‌گیری، با روش مفهوم‌پردازی نظری، استدلال کردند نظریه پارادوکس چارچوبی برای فهم تناقض‌های هم‌زمان در رهبری فراهم می‌کند.")],
    [("t", "والدمن و بوون (۲۰۱۶)"),
     ("t", " در پژوهشی با عنوان «یادگیری رهبری پارادوکس‌آگاه» با جامعه آماری ندارد (پژوهش نظری)، با هدف تبیین چگونگی یادگیری رهبری پارادوکس‌محور، با روش مفهوم‌پردازی نظری، استدلال کردند توسعه این توانایی نیازمند شرایط فردی و سازمانی خاصی است که باید شناسایی شوند.")],
    [("t", "ژانگ و همکاران (۲۰۱۵)"),
     ("t", " در پژوهشی با عنوان «رفتارهای رهبر پارادوکسیکال در مدیریت نیروی انسانی: پیشایندها و پیامدها» با جامعه آماری ۷۶ سرپرست و ۵۱۶ زیردست از شش شرکت در مطالعه میدانی، با هدف مفهوم‌پردازی و سنجش این سازه با پنج بعد و بررسی پیشایندها و پیامدهای آن، با روش توسعه مقیاس در پنج نمونه چینی و پیمایش میدانی، نشان دادند تفکر کل‌نگر و پیچیدگی یکپارچه‌ساز سرپرستان با رفتار پارادوکسیکال آنان رابطه مثبت دارد و این رفتار با افزایش مهارت، سازگاری و کنشگری زیردستان همراه است.")],
]

INTERNAL = [
    [("t", "احسانی (۱۴۰۵)"),
     ("t", " در پژوهشی با عنوان «مدیریت دوگانگی بروکراسی و نوآوری در فرمانداری‌ها: نقش رهبری پارادوکسیکال در تسهیل پذیرش سامانه مدیریت هوشمند خدمات شهری» با جامعه آماری "),
     ("ph", "[نامشخص؛ باید از متن مقاله تکمیل شود]"),
     ("t", "، با هدف بررسی نقش رهبری پارادوکسیکال در مدیریت دوگانگی بروکراسی و نوآوری در فرمانداری‌ها، با روش تحلیلی-توصیفی، نشان داد این سبک رهبری از طریق تقویت اعتماد و یادگیری سازمانی، هم‌راستاسازی ساختار بروکراتیک با الزامات نوآوری را تسهیل می‌کند.")],
    [("t", "نادی‌مقدم و همکاران (۱۴۰۴)"),
     ("t", " در پژوهشی با عنوان «ارائه الگوی مدیریت پارادوکس‌های رهبری عمومی» با جامعه آماری مدیران دولتی و متخصصان "),
     ("ph", "[تعداد نمونه باید تکمیل شود]"),
     ("t", "، با هدف شناسایی پارادوکس‌های رهبری عمومی و ارائه الگوی مدیریت آن‌ها، با روش پدیدارشناسی و مصاحبه اکتشافی و سپس پانل دلفی، نشان دادند از سیزده پارادوکس شناسایی‌شده، چهار مورد با راهبرد پذیرش، سه مورد با تفکیک فضایی، دو مورد با تفکیک زمانی و چهار مورد با راهبرد ترکیب قابل مدیریت‌اند.")],
    [("t", "امانی و همکاران (۱۴۰۳)"),
     ("t", " در پژوهشی با عنوان «رهبری متناقض‌نما: مروری بر مفاهیم، نظریه‌ها و کاربردهای سازمانی» با جامعه آماری ندارد (مطالعه مروری)، با هدف مرور نظام‌مند مفاهیم، نظریه‌ها و کاربردهای سازمانی رهبری متناقض‌نما، با روش مطالعه مروری-تحلیلی، چارچوبی جامع از مبانی نظری و کاربردهای این سبک رهبری در ادبیات داخلی ارائه کردند.")],
    [("t", "قربانی و همکاران (۱۴۰۲)"),
     ("t", " در پژوهشی با عنوان «بررسی تأثیر رهبری متناقض‌نما بر خلاقیت با نقش میانجی خودکارآمدی خلاقانه و هویت‌یابی با رهبر» با جامعه آماری کارکنان سازمان‌های دولتی شهر مشهد، با هدف بررسی تأثیر رهبری متناقض‌نما بر خلاقیت کارکنان، با روش پیمایشی و پرسشنامه، نشان دادند این سبک رهبری از طریق خودکارآمدی خلاقانه و هویت‌یابی با رهبر بر خلاقیت کارکنان اثر می‌گذارد؛ فشار کاری و نیاز به ثبات شناختی نیز به‌عنوان تعدیل‌گر در این روابط بررسی شدند.")],
]


def lit_paras():
    out = []
    out.append(build_para(ppr47, [("b", HEAD_EXT)], sz47))
    for segs in ENTRIES:
        out.append(build_para(ppr47, segs, sz47))
    out.append(build_para(ppr47, [("b", HEAD_INT)], sz47))
    for segs in INTERNAL:
        out.append(build_para(ppr47, segs, sz47))
    out.append(keep_pa)
    out.append(keep_pb)
    return out


replace_children(c47, lit_paras())

# ------------------------------------------------------------ 4-10 reference list (APA)
tref = table_by_heading("منابع : (براساس")
head_cell = tref.findall(W + "tr")[0].findall(W + "tc")[0]
for r in head_cell.iter(W + "t"):
    if r.text and "APA" in r.text:
        r.text = r.text.replace("APA", "ای‌پی‌ای")  # the heading is written in Persian
cr = body_cell(tref)
szr = cell_size(cr, 26)
ppr_r = persian_ppr(None, justify="both", bidi=True, hanging=True)
ppr_head = persian_ppr(None, justify="center", bidi=True, hanging=False)

FA_REFS = [
    "احسانی، حسین (۱۴۰۵). مدیریت دوگانگی بروکراسی و نوآوری در فرمانداری‌ها: نقش رهبری پارادوکسیکال در تسهیل پذیرش سامانه مدیریت هوشمند خدمات شهری. هشتمین همایش بین‌المللی روان‌شناسی، علوم تربیتی و مطالعات اجتماعی.",
    "آستان قدس رضوی. ([سال]). [عنوان صفحه معرفی آستان قدس رضوی؛ باید تکمیل شود]. [نشانی وب‌گاه رسمی؛ باید تکمیل شود]",
    "امانی، انورشاه؛ مهارتی، یعقوب؛ اسلامی، قاسم؛ ملک‌زاد، غلامرضا (۱۴۰۳). رهبری متناقض‌نما: مروری بر مفاهیم، نظریه‌ها و کاربردهای سازمانی. مدیریت استراتژیک هوشمند، دوره ۳، شماره ۴، صفحات ۴۰۱-۴۲۴.",
    "قربانی، فاطمه؛ گرجی‌پور، حسین؛ اصغری صارم، علی (۱۴۰۲). بررسی تأثیر رهبری متناقض‌نما بر خلاقیت با نقش میانجی خودکارآمدی خلاقانه و هویت‌یابی با رهبر. مطالعات رفتار سازمانی، دوره ۱۲.",
    "نادی‌مقدم، صحرا؛ خراسانی طرقی، حامد؛ میرزایی، وحید (۱۴۰۴). ارائه الگوی مدیریت پارادوکس‌های رهبری عمومی. دومین کنفرانس بین‌المللی جهش علوم مدیریت، اقتصاد و حسابداری.",
]
EN_REFS = [
    "Ishaq, E., Bashir, S., & Khan, A. K. (2021). Paradoxical leader behaviors: Leader personality and follower outcomes. *Applied Psychology*, *70*(1), 342–357. https://doi.org/10.1111/apps.12233",
    "Lu, L., Zhou, Y., & Li, G. (2026). The paradoxical consequences of high performers: How and when subordinate performance drives paradoxical leader behaviors. *Journal of Business Research*, *207*.",
    "Smith, W. K., & Lewis, M. W. (2011). Toward a theory of paradox: A dynamic equilibrium model of organizing. *Academy of Management Review*, *36*(2), 381–403.",
    "Volk, S., Waldman, D. A., & Barnes, C. M. (2023). A circadian theory of paradoxical leadership. *Academy of Management Review*, *48*(4), 611–638. https://doi.org/10.5465/amr.2020.0468",
    "Waldman, D. A., & Bowen, D. E. (2016). Learning to be a paradox-savvy leader. *Academy of Management Perspectives*, *30*(3), 316–327.",
    "Waldman, D. A., Putnam, L. L., Miron-Spektor, E., & Siegel, D. (2019). The role of paradox theory in decision making and management research. *Organizational Behavior and Human Decision Processes*, *155*, 1–6.",
    "Xu, C., Zhang, M., Chen, C., Sun, J., Wang, Y., & Ma, K. (2025). Ambiguous by a paradoxical leader: How and when paradoxical leadership hinders employee proactive behavior. *Current Psychology*, *44*, 153–168. https://doi.org/10.1007/s12144-024-07145-4",
    "Zhang, Y., & Han, Y.-L. (2019). Paradoxical leader behavior in long-term corporate development: Antecedents and consequences. *Organizational Behavior and Human Decision Processes*, *155*, 42–54. https://doi.org/10.1016/j.obhdp.2019.03.007",
    "Zhang, Y., Waldman, D. A., Han, Y., & Li, X. (2015). Paradoxical leader behaviors in people management: Antecedents and consequences. *Academy of Management Journal*, *58*(2), 538–566. https://doi.org/10.5465/AMJ.2012.0995",
]

ref_paras = [build_para(ppr_head, [("b", "منابع فارسی")], szr)]
for ref in FA_REFS:
    if ref.startswith("آستان قدس رضوی. ([سال])"):
        # the placeholder entry: highlight the two bracketed parts
        ref_paras.append(build_para(ppr_r, [
            ("t", "آستان قدس رضوی. ("), ("ph", "[سال]"), ("t", "). "),
            ("ph", "[عنوان صفحه معرفی آستان قدس رضوی؛ باید تکمیل شود]"), ("t", ". "),
            ("ph", "[نشانی وب‌گاه رسمی؛ باید تکمیل شود]"),
        ], szr))
    else:
        ref_paras.append(build_para(ppr_r, [("t", ref)], szr))
ref_paras.append(build_para(ppr_head, [("b", "منابع انگلیسی")], szr))
for ref in EN_REFS:
    ref_paras.append(build_para(english_ppr(), split_italics(ref), 22, eng=True))
replace_children(cr, ref_paras)

# ------------------------------------------------------------ footnotes part
for f in list(fnroot.findall(W + "footnote")):
    if f.get(W + "type") is None:
        fnroot.remove(f)
for fid, text in FN:
    fn = copy.deepcopy(proto_fn)
    fn.set(W + "id", str(fid))
    for el in fn.iter():
        for attr in list(el.attrib):
            if "paraId" in attr or "textId" in attr:
                del el.attrib[attr]
    p = fn.find(W + "p")
    runs = p.findall(W + "r")
    ref_run = [r for r in runs if r.find(W + "footnoteRef") is not None][0]
    text_proto = [r for r in runs if r.find(W + "t") is not None][0]
    for r in runs:
        p.remove(r)
    p.append(ref_run)
    nr = copy.deepcopy(text_proto)
    nt = nr.find(W + "t")
    nt.text = " " + text
    nt.set(XML_SPACE, "preserve")
    p.append(nr)
    fnroot.append(fn)

# ------------------------------------------------------------ write package
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
print("written", dst, "footnotes:", len(FN))
