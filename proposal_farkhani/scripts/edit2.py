"""Round 2: drop literature from 1400 (2021) and earlier, add newer studies."""
import copy, os, re, sys
from lxml import etree

ROOT = sys.argv[1]
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ns = {'w': W}
XS = '{http://www.w3.org/XML/1998/namespace}space'
def q(t): return '{%s}%s' % (W, t)

docp = os.path.join(ROOT, 'word/document.xml'); fnp = os.path.join(ROOT, 'word/footnotes.xml')
doc = etree.parse(docp); fdoc = etree.parse(fnp)
body = doc.getroot().find('w:body', ns); froot = fdoc.getroot()

def ptext(p): return ''.join(t.text or '' for t in p.iter(q('t')))
def pars(): return list(body.iter(q('p')))
def par_with(s):
    hits = [p for p in pars() if s in ptext(p)]
    assert len(hits) == 1, (s, len(hits)); return hits[0]
def par_starting(s):
    hits = [p for p in pars() if ptext(p).startswith(s)]
    assert len(hits) == 1, (s, len(hits)); return hits[0]

FNREF = copy.deepcopy(next(body.iter(q('footnoteReference'))).getparent())
def fn_run(i):
    r = copy.deepcopy(FNREF); r.find('w:footnoteReference', ns).set(q('id'), str(i)); return r

def add_fn(text):
    fns = froot.findall('w:footnote', ns)
    nid = max(int(f.get(q('id'))) for f in fns) + 1
    tpl = next(f for f in fns if f.get(q('type')) is None)
    new = copy.deepcopy(tpl); new.set(q('id'), str(nid))
    p = new.find('w:p', ns)
    for ch in list(p):
        if etree.QName(ch).localname == 'pPr': continue
        if etree.QName(ch).localname == 'r' and ch.find('w:footnoteRef', ns) is not None: continue
        p.remove(ch)
    r = etree.SubElement(p, q('r')); t = etree.SubElement(r, q('t')); t.text = ' ' + text; t.set(XS, 'preserve')
    froot.append(new); return nid

def drop_par(p):
    for r in p.iter(q('footnoteReference')):
        f = froot.find(f'w:footnote[@w:id="{r.get(q("id"))}"]', ns)
        froot.remove(f)
    p.getparent().remove(p)

def make_par(template, segs):
    p = copy.deepcopy(template)
    runs = [r for r in p.findall('w:r', ns) if r.find('w:t', ns) is not None]
    bold_r = next(r for r in runs if r.find('w:rPr/w:b', ns) is not None)
    reg_r = next(r for r in runs if r.find('w:rPr/w:b', ns) is None)
    for ch in list(p):
        if etree.QName(ch).localname != 'pPr': p.remove(ch)
    for kind, val in segs:
        if kind == 'fn': p.append(fn_run(add_fn(val))); continue
        src = bold_r if kind == 'b' else reg_r
        r = etree.SubElement(p, q('r')); r.append(copy.deepcopy(src.find('w:rPr', ns)))
        t = etree.SubElement(r, q('t')); t.text = val; t.set(XS, 'preserve')
    return p

def simple_par(tpl, text):
    p = copy.deepcopy(tpl)
    for ch in list(p):
        if etree.QName(ch).localname != 'pPr': p.remove(ch)
    r0 = tpl.find('w:r', ns)
    r = etree.SubElement(p, q('r')); r.append(copy.deepcopy(r0.find('w:rPr', ns)))
    t = etree.SubElement(r, q('t')); t.text = text; t.set(XS, 'preserve')
    return p

def replace_text(p, old, new):
    n = 0
    for t in p.iter(q('t')):
        if t.text and old in t.text:
            n += 1; t.text = t.text.replace(old, new)
    assert n == 1, (old, n)

# ---------------------------------------------------------------- 4-7 domestic
for pre in ['منتخب یگانه، بشلیده', 'چهرازی، قلی‌پور', 'گل‌پرور، جوادیان']:
    drop_par(par_starting(pre))

hakkak = par_starting('حکاک و عظیمی (۱۴۰۲)')
TPL = hakkak

GORJI = [('b', 'گرجی و حسینی ملک‌آباد (۱۴۰۳) '),
 ('r', 'تحقیقی با عنوان «رهبری خدمتگزارانه به مثابه اتخاذ استراتژی جبران ناکارآمدی عملکردی در حاشیه‌نشینی شهری» ارائه کردند. هدف این پژوهش شناسایی پیامدهای رهبری خدمتگزار در سازمان و طرح آن به‌عنوان راهبردی برای جبران ناکارآمدی عملکردی بود. این مطالعه در اولین همایش حاشیه شهر مشهد ارائه شد. نتایج نشان داد ۲۷ متغیر سازمانی تحت تأثیر رهبری خدمتگزار قرار دارند؛ متغیرهایی مانند اثربخشی رهبری، عملکرد شغلی و رضایت شغلی از این سبک رهبری اثر مثبت و متغیرهایی مانند قصد ترک شغل، استرس شغلی و رفتار انحرافی از آن اثر منفی می‌پذیرند؛ یعنی رفتار انحرافی کارکنان به‌طور مستقیم و منفی تحت تأثیر رهبری خدمتگزار است.')]
HEMMATI = [('b', 'قائدامینی هارونی و همتی‌زاده (۱۴۰۳) '),
 ('r', 'تحقیقی با عنوان «تأثیر سرپرستی توهین‌آمیز بر رفتارهای انحرافی در محیط کار از طریق نقض قرارداد روانی» ارائه کردند. هدف این پژوهش بررسی تأثیر سرپرستی توهین‌آمیز بر رفتارهای انحرافی در محیط کار با نقش میانجی نقض قرارداد روانی معامله‌ای و رابطه‌ای بود. این مطالعه از نظر هدف کاربردی و از نظر شیوه گردآوری داده‌ها توصیفی از نوع همبستگی بود. نتایج نشان داد سرپرستی توهین‌آمیز بر رفتارهای انحرافی در محیط کار تأثیر مثبت دارد (ضریب تأثیر ۰/۵۵) و نقض قرارداد روانی، هم از نوع معامله‌ای و هم از نوع رابطه‌ای، در این رابطه نقش میانجی ایفا می‌کند.')]
OMIDI = [('b', 'قائدامینی هارونی، امیدی، اسکندری فارسانی و خسروی (۱۴۰۲) '),
 ('r', 'تحقیقی با عنوان «تأثیر بی‌نزاکتی سرپرست بر رفتارهای انحرافی در محیط کار از طریق هوش هیجانی و ناامنی شغلی» ارائه کردند. هدف این پژوهش بررسی تأثیر بی‌نزاکتی سرپرست بر رفتارهای انحرافی کارکنان با نقش میانجی هوش هیجانی و ناامنی شغلی بود. این مطالعه در دانشگاه آزاد اسلامی واحد اصفهان (خوراسگان) انجام شد و داده‌ها با مدل‌یابی معادلات ساختاری تحلیل شد. نتایج نشان داد بی‌نزاکتی سرپرست بر رفتارهای انحرافی در محیط کار تأثیر مثبت دارد (ضریب تأثیر ۰/۶۲) و هوش هیجانی و ناامنی شغلی در این رابطه نقش میانجی دارند؛ یعنی رفتار سرپرست مستقیم از عوامل تعیین‌کننده بروز رفتارهای نابهنجار کارکنان است.')]

hakkak.addprevious(make_par(TPL, GORJI))
hakkak.addprevious(make_par(TPL, HEMMATI))
hakkak.addnext(make_par(TPL, OMIDI))

# ---------------------------------------------------------------- 4-7 foreign
gig = par_starting('گیگول')
gig.addprevious(make_par(TPL, [
 ('b', 'باسعد، باجبع و باسهل'), ('fn', 'Basaad et al., 2023'), ('b', ' (۲۰۲۳) '),
 ('r', 'تحقیقی با عنوان «آشکارسازی وجه تاریک رهبری: رهبران استثمارگر چگونه از مسیر عدم‌درگیری اخلاقی به رفتار غیراخلاقی حامی سازمان دامن می‌زنند» ارائه کردند. هدف این پژوهش بررسی رابطه رهبری استثمارگر با رفتار غیراخلاقی حامی سازمان و نقش میانجی عدم‌درگیری اخلاقی در این رابطه بود. این مطالعه از نوع کمّی انجام شد و مدل میانجی پژوهش را آزمون کرد. نتایج نشان داد رهبری استثمارگر با رفتار غیراخلاقی حامی سازمان رابطه مثبت دارد و عدم‌درگیری اخلاقی این رابطه را به‌طور کامل میانجی‌گری می‌کند؛ یعنی کارکنان با خنثی کردن بار اخلاقی رفتار خود، به نفع سازمان از هنجارهای اخلاقی عبور می‌کنند.')]))
drop_par(gig)
# keep the foreign list in descending year order: put Basaad (2023) right after Luan (2023)
bas = par_starting('باسعد، باجبع و باسهل')
luan = par_starting('لوان، ژائو، وانگ و هو (۲۰۲۳)')
luan.addnext(bas)

# ---------------------------------------------------------------- gap summary
gap = par_starting('مرور پیشینه سه نکته را روشن می‌کند')
new_gap = make_par(TPL, [('r',
 'مرور پیشینه سه نکته را روشن می‌کند. نخست، در ادبیات خارجی رابطه رهبری خدمتگزار با رفتار غیراخلاقی حامی سازمان تأیید شده است، اما هر مطالعه تنها یک سازوکار را در مدل آورده: زنگ و همکاران (۲۰۲۵) معنای کار را، و گل و تیمور‌اوغلو (۲۰۲۶) و اویماز و آرسلان (۲۰۲۲) همزادپنداری با رهبر را؛ بنابراین سهم نسبی این دو مسیر ناشناخته مانده است. دوم، شواهد نشان می‌دهد اثر رهبری بر این رفتار دولبه است (لوان و همکاران، ۲۰۲۳)، از سازوکارهای شناختی مانند عدم‌درگیری اخلاقی عبور می‌کند (باسعد و همکاران، ۲۰۲۳) و فرهنگ ملی آن را تعدیل می‌کند (میشرا و همکاران، ۲۰۲۵)؛ پس تعمیم یافته‌های چین و ترکیه به ایران نیازمند آزمون مستقل است. سوم، در ادبیات داخلی رابطه رهبری با رفتارهای غیراخلاقی و انحرافی کارکنان سنجیده شده است: رهبری خدمتگزار رفتار انحرافی را کاهش می‌دهد (گرجی و حسینی ملک‌آباد، ۱۴۰۳)، رهبری فروتنانه رفتارهای غیراخلاقی به نفع سازمان را افزایش داده است (حکاک و عظیمی، ۱۴۰۲)، رهبری اسلامی رفتارهای انحرافی را کاهش داده (قائدامینی هارونی و همکاران، ۱۴۰۱) و بی‌نزاکتی سرپرست و سرپرستی توهین‌آمیز این رفتارها را افزایش داده‌اند (قائدامینی هارونی و همکاران، ۱۴۰۲؛ قائدامینی هارونی و همتی‌زاده، ۱۴۰۳). بنابراین در ادبیات داخلی، رهبری خدمتگزار کاهنده رفتار انحرافیِ زیان‌بار برای سازمان شناخته شده، اما هیچ پژوهشی پیامد آن را بر رفتار غیراخلاقیِ به نفع سازمان نسنجیده است. شکاف پژوهش حاضر از همین سه نکته برمی‌آید: برآورد هم‌زمان دو مسیر غیرمستقیم و یک مسیر مستقیم میان رهبری خدمتگزار و رفتار غیراخلاقی حامی سازمان، در یک نمونه ایرانی و در بافت صنعتی کارخانه سیمان شرق مشهد.')])
gap.addnext(new_gap); gap.getparent().remove(gap)

# ---------------------------------------------------------------- problem statement
replace_text(par_with('شکاف نظری پژوهش از همین‌جا شکل می‌گیرد'),
 'در ادبیات داخلی نیز رابطه سبک‌های رهبری با رفتارهای غیراخلاقی، انحرافی و ضدبهره‌وری بررسی شده است (گل‌پرور و همکاران، ۱۳۹۱؛ چهرازی و همکاران، ۱۳۹۴؛ حکاک و عظیمی، ۱۴۰۲)',
 'در ادبیات داخلی نیز رابطه رهبری با رفتارهای غیراخلاقی و انحرافی کارکنان بررسی شده است (قائدامینی هارونی و همکاران، ۱۴۰۱؛ حکاک و عظیمی، ۱۴۰۲؛ گرجی و حسینی ملک‌آباد، ۱۴۰۳)')

# ---------------------------------------------------------------- 4-11 references
FA_TPL = par_starting('حکاک، محمد و عظیمی، حسین (۱۴۰۲)')
EN_TPL = par_starting('Bandura, A. (1999)')
for pre in ['چهرازی، سامان', 'گل‌پرور، محسن', 'منتخب یگانه، محمد', 'Gigol, T. (2021)']:
    drop_par(par_starting(pre))
a = par_starting('قائدامینی هارونی، عباس؛ ابراهیم‌زاده دستجردی')
new_refs = [
 'قائدامینی هارونی، عباس؛ امیدی، صادق؛ اسکندری فارسانی، زهرا و خسروی، علی‌مراد (۱۴۰۲). تأثیر بی‌نزاکتی سرپرست بر رفتارهای انحرافی در محیط کار از طریق هوش هیجانی و ناامنی شغلی (مورد مطالعه: دانشگاه آزاد اسلامی واحد اصفهان (خوراسگان)). مدیریت دولتی تطبیقی، ۱(۳)، ۱۱۸-۱۵۸.',
 'قائدامینی هارونی، عباس و همتی‌زاده، مهسان (۱۴۰۳). تأثیر سرپرستی توهین‌آمیز بر رفتارهای انحرافی در محیط کار از طریق نقض قرارداد روانی. ارزیابی و رشد سرمایه انسانی، ۱(۱)، ۱۲۸-۱۴۳.',
 'گرجی، سیدمحمدجواد و حسینی ملک‌آباد، سیدعلی (۱۴۰۳). رهبری خدمتگزارانه به مثابه اتخاذ استراتژی جبران ناکارآمدی عملکردی در حاشیه‌نشینی شهری. مقاله ارائه‌شده در اولین همایش حاشیه شهر مشهد (شناسایی مسائل و ارائه راهکارها)، مشهد.',
]
anchor = a
for t in new_refs:
    p = simple_par(FA_TPL, t); anchor.addnext(p); anchor = p
EN_TPL.addnext(simple_par(EN_TPL,
 'Basaad, S., Bajaba, S., & Basahal, A. (2023). Uncovering the dark side of leadership: How exploitative leaders fuel unethical pro-organizational behavior through moral disengagement. Cogent Business & Management, 10(2), Article 2233775. https://doi.org/10.1080/23311975.2023.2233775'))

# ---------------------------------------------------------------- sanity
full = '\n'.join(ptext(p) for p in pars())
for gone in ['چهرازی', 'گل‌پرور', 'منتخب یگانه', 'گیگول', 'Gigol', '۱۳۹۱', '۱۳۹۴', '۱۳۹۵']:
    assert gone not in full, gone
doc.write(docp, xml_declaration=True, encoding='UTF-8', standalone=True)
fdoc.write(fnp, xml_declaration=True, encoding='UTF-8', standalone=True)
print('ok')
