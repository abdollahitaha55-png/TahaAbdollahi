import copy, re, sys, os, shutil
from lxml import etree

ROOT = sys.argv[1]          # unpacked docx dir
IMG = sys.argv[2]           # figure png
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
ns = {'w': W}
def q(t): return '{%s}%s' % (W, t)

docp = os.path.join(ROOT, 'word/document.xml')
fnp = os.path.join(ROOT, 'word/footnotes.xml')
doc = etree.parse(docp)
fdoc = etree.parse(fnp)
body = doc.getroot().find('w:body', ns)
fnroot = fdoc.getroot()

def ptext(p): return ''.join(t.text or '' for t in p.iter(q('t')))
def all_pars(): return list(body.iter(q('p')))
def par_with(s, n=1):
    hits = [p for p in all_pars() if s in ptext(p)]
    assert len(hits) == n, (s, len(hits))
    return hits if n > 1 else hits[0]
PERSIAN = re.compile(r'[؀-ۿ]')

# ------------------------------------------------------------------ footnotes
def fn_el(i):
    return fnroot.find(f'w:footnote[@w:id="{i}"]', ns)

def set_fn_text(i, text):
    fn = fn_el(i)
    p = fn.find('w:p', ns)
    for p2 in fn.findall('w:p', ns)[1:]:
        fn.remove(p2)
    keep = []
    for ch in list(p):
        tag = etree.QName(ch).localname
        if tag == 'pPr':
            continue
        if tag == 'r' and ch.find('w:footnoteRef', ns) is not None:
            continue
        p.remove(ch)
    r = etree.SubElement(p, q('r'))
    t = etree.SubElement(r, q('t'))
    t.text = ' ' + text
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')

def add_fn(text):
    ids = [int(f.get(q('id'))) for f in fnroot.findall('w:footnote', ns)]
    nid = max(ids) + 1
    new = copy.deepcopy(fn_el(1))
    new.set(q('id'), str(nid))
    fnroot.append(new)
    set_fn_text(nid, text)
    return nid

FN_TEXT = {
    1: 'Umphress et al., 2010', 2: 'Liden et al., 2008', 3: 'Luan et al., 2023',
    4: 'Meaning of Work', 5: 'Steger et al., 2012', 6: 'Cai et al., 2018',
    7: 'Zeng et al., 2025', 8: 'Identification with the Leader', 9: 'Kark et al., 2003',
    10: 'Gul & Timuroglu, 2026', 11: 'Social Exchange Theory', 12: 'Social Identity Theory',
    13: 'Moral Disengagement', 14: 'Mishra et al., 2025', 15: 'Uymaz & Arslan, 2022',
    16: 'Cochran, 1977', 17: 'Yoshida et al., 2014', 18: 'Podsakoff et al., 2003',
    19: 'Fornell & Larcker, 1981', 20: 'Preacher & Hayes, 2008',
}
for i, t in FN_TEXT.items():
    set_fn_text(i, t)

# template footnote-reference run (from document)
FNREF = copy.deepcopy(next(body.iter(q('footnoteReference'))).getparent())
def fn_run(i):
    r = copy.deepcopy(FNREF)
    r.find('w:footnoteReference', ns).set(q('id'), str(i))
    return r

def insert_fn_after(p, anchor, fid, occ=1):
    """split the run containing `anchor` right after it and put a footnote ref there"""
    seen = 0
    for t in p.iter(q('t')):
        s = t.text or ''
        k = s.find(anchor)
        while k != -1:
            seen += 1
            if seen == occ:
                cut = k + len(anchor)
                r = t.getparent()
                before, after = s[:cut], s[cut:]
                t.text = before
                t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
                fr = fn_run(fid)
                r.addnext(fr)
                if after:
                    r2 = copy.deepcopy(r)
                    for x in list(r2):
                        if etree.QName(x).localname != 'rPr':
                            r2.remove(x)
                    t2 = etree.SubElement(r2, q('t'))
                    t2.text = after
                    t2.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
                    fr.addnext(r2)
                return
            k = s.find(anchor, k + 1)
    raise AssertionError(('anchor not found', anchor))

# ------------------------------------------------------------ text replacing
def replace_text(p, old, new, count=1):
    n = 0
    for t in p.iter(q('t')):
        if t.text and old in t.text:
            n += t.text.count(old)
            t.text = t.text.replace(old, new)
            t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    assert n == count, (old, n)

def replace_persian_runs(old, new, expect=None):
    n = 0
    for t in body.iter(q('t')):
        if t.text and old in t.text and PERSIAN.search(t.text):
            n += t.text.count(old)
            t.text = t.text.replace(old, new)
    if expect is not None:
        assert n == expect, (old, n)
    return n

# 1) English title: "On the Effect of ..."
replace_text(par_with('The Effect of Servant Leadership on Unethical'), 'The Effect of Servant', 'On the Effect of Servant')

# 2) English / Latin tokens inside Persian text
replace_persian_runs('(z = ۱٫۹۶)', '(مقدار آماره توزیع نرمال استاندارد برابر ۱٫۹۶)', 1)
replace_persian_runs('(p = q = ۰٫۵)', '(هر یک برابر ۰٫۵)', 1)
replace_persian_runs('نرم‌افزارهای SPSS و AMOS', 'نرم‌افزارهای اس‌پی‌اس‌اس و ایموس', 1)   # Persian abstract
replace_persian_runs('در نرم‌افزار SPSS', 'در نرم‌افزار اس‌پی‌اس‌اس', 1)
replace_persian_runs('در نرم‌افزار AMOS', 'در نرم‌افزار ایموس', 1)
ORD = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم']
for i, o in enumerate(ORD, 1):
    replace_persian_runs(f'H{i}. ', f'فرضیه {o}: ', 1)

# 3) decimal / thousands separators that render as boxes in B Nazanin
replace_persian_runs('٫', '/')
replace_persian_runs('٬', '')
for t in body.iter(q('t')):
    assert '٫' not in (t.text or '') and '٬' not in (t.text or '')

# 4) footnotes in problem statement: Uymaz (move to first mention) + theory authors
p_ps2 = par_with('اویماز و آرسلان (۲۰۲۲) رفتار غیراخلاقی حامی سازمان را')
insert_fn_after(p_ps2, 'اویماز و آرسلان', 15)
p_th = par_with('مبانی نظری این دو مسیر روشن است')
insert_fn_after(p_th, '(بلاو', add_fn('Blau, 1964'))
insert_fn_after(p_th, '(تاجفل و ترنر', add_fn('Tajfel & Turner, 1979'))
insert_fn_after(p_th, '(بندورا', add_fn('Bandura, 1999'))

# 5) domestic-literature sentences in problem statement / necessity / novelty
replace_text(par_with('شکاف نظری پژوهش از همین‌جا شکل می‌گیرد'),
    'در ادبیات داخلی نیز این سازه عمدتاً در سطح مفهوم‌پردازی و مرور بررسی شده و پیوند آن با رهبری خدمتگزار آزمون نشده است.',
    'در ادبیات داخلی نیز رابطه سبک‌های رهبری با رفتارهای غیراخلاقی، انحرافی و ضدبهره‌وری بررسی شده است (گل‌پرور و همکاران، ۱۳۹۱؛ چهرازی و همکاران، ۱۳۹۴؛ حکاک و عظیمی، ۱۴۰۲)، اما رابطه رهبری خدمتگزار با رفتار غیراخلاقی حامی سازمان هنوز آزمون نشده است.')
replace_text(par_with('چهارمین دلیل، ضرورت آزمون این الگو در بافت ایران است'),
    'در ادبیات داخلی نیز این سازه عمدتاً در سطح مفهوم‌پردازی و مرور بررسی شده و رابطه آن با رهبری خدمتگزار آزمون نشده است.',
    'در ادبیات داخلی نیز پژوهش‌ها رابطه سبک‌های رهبری را با رفتارهای غیراخلاقی و انحرافی کارکنان سنجیده‌اند، اما رابطه رهبری خدمتگزار با رفتار غیراخلاقی حامی سازمان آزمون نشده است.')
replace_text(par_with('بافت صنعتی تولید پیوسته'),
    'پژوهش‌های موجود این الگو را در بخش سلامت و در شرکت‌های دانش‌بر آزموده‌اند',
    'پژوهش‌های موجود این الگو را عمدتاً در بخش سلامت آزموده‌اند')

# ------------------------------------------------------- paragraph builder
def make_par(template, segs):
    """segs: list of ('b'|'r', text) or ('fn', id). Formatting cloned from template paragraph."""
    p = copy.deepcopy(template)
    runs = [r for r in p.findall('w:r', ns) if r.find('w:t', ns) is not None]
    bold_r = next((r for r in runs if r.find('w:rPr/w:b', ns) is not None), None)
    reg_r = next((r for r in runs if r.find('w:rPr/w:b', ns) is None), None)
    for ch in list(p):
        if etree.QName(ch).localname != 'pPr':
            p.remove(ch)
    for kind, val in segs:
        if kind == 'fn':
            p.append(fn_run(val)); continue
        src = bold_r if kind == 'b' else reg_r
        r = etree.SubElement(p, q('r'))
        r.append(copy.deepcopy(src.find('w:rPr', ns)))
        t = etree.SubElement(r, q('t'))
        t.text = val
        t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    return p

# ------------------------------------------------------------- 4-7 background
bg_tc = par_with('پیشینه داخلی').getparent()
kids = [k for k in bg_tc if etree.QName(k).localname == 'p']
TPL = kids[1]   # bold names + regular body paragraph
def idx_of(s):
    for i, k in enumerate(kids):
        if ptext(k).startswith(s) or s in ptext(k)[:60]:
            return i
    raise AssertionError(s)

i_dom = idx_of('پیشینه داخلی'); i_for = idx_of('پیشینه خارجی')
for k in kids[i_dom + 1:i_for]:
    bg_tc.remove(k)

DOMESTIC = [
 [('b', 'حکاک و عظیمی (۱۴۰۲) '),
  ('r', 'تحقیقی با عنوان «تأثیر رهبری فروتنانه بر رفتارهای غیراخلاقی مصلحتی در سازمان به واسطه دلسوزی در کار» ارائه کردند. هدف این پژوهش بررسی تأثیر رهبری فروتنانه بر رفتارهای غیراخلاقی مصلحتی در سازمان، یعنی رفتارهای غیراخلاقی‌ای که به مصلحت و نفع سازمان انجام می‌شود، با نقش میانجی دلسوزی در کار بود. جامعه آماری این پژوهش را ۱۶۰ نفر از کارکنان اداره کل ورزش و جوانان استان لرستان تشکیل می‌دادند که بر اساس جدول مورگان ۱۱۳ نفر از آنان به روش تصادفی طبقه‌ای انتخاب شدند و داده‌ها با مدل‌یابی معادلات ساختاری در نرم‌افزار ایموس'),
  ('fn', 'AMOS'),
  ('r', ' تحلیل شد. نتایج نشان داد رهبری فروتنانه بر رفتارهای غیراخلاقی مصلحتی و بر دلسوزی در کار تأثیر مثبت و معنادار دارد و دلسوزی در کار این رابطه را به‌طور جزئی میانجی‌گری می‌کند؛ یعنی یک سبک رهبری مثبت و حمایتی می‌تواند زمینه رفتار غیراخلاقی به نفع سازمان را فراهم کند.')],
 [('b', 'قائدامینی هارونی، ابراهیم‌زاده دستجردی، صادقی و ماهرانی برزانی (۱۴۰۱) '),
  ('r', 'تحقیقی با عنوان «بررسی تأثیر رهبری اسلامی بر رفتارهای انحرافی در محیط کار از طریق اخلاق کار اسلامی و سرمایه اجتماعی» ارائه کردند. هدف این پژوهش تعیین تأثیر رهبری اسلامی بر رفتارهای انحرافی در محیط کار با نقش میانجی اخلاق کار اسلامی و سرمایه اجتماعی بود. این مطالعه از نظر هدف کاربردی و از نظر شیوه گردآوری داده‌ها توصیفی از نوع همبستگی بود و جامعه آن را کارکنان دانشگاه آزاد اسلامی واحد اصفهان (خوراسگان) تشکیل می‌دادند. نتایج نشان داد رهبری اسلامی بر رفتارهای انحرافی در محیط کار اثر مستقیم منفی و معنادار دارد؛ یعنی سبک رهبری ارزش‌محور، رفتارهای مغایر با هنجارهای سازمانی را کاهش می‌دهد.')],
 [('b', 'منتخب یگانه، بشلیده، شمسی و هزاریان (۱۳۹۵) '),
  ('r', 'تحقیقی با عنوان «بررسی رابطه رهبری اخلاقی با رفتارهای انحرافی در محیط کار: نقش میانجی تعهد عاطفی و جو اخلاقی» ارائه کردند. هدف این پژوهش بررسی رابطه رهبری اخلاقی با رفتارهای انحرافی در محیط کار و نقش میانجی تعهد عاطفی و جو اخلاقی در این رابطه بود. داده‌ها با پرسشنامه‌های رهبری اخلاقی، رفتارهای انحرافی در محیط کار، تعهد عاطفی و جو اخلاقی گردآوری و با روش مدل‌یابی معادلات ساختاری و بوت‌استرپ تحلیل شد. نتایج نشان داد رهبری اخلاقی هم به‌طور مستقیم و هم به‌طور غیرمستقیم از طریق تعهد عاطفی و جو اخلاقی بر رفتارهای انحرافی در محیط کار اثر دارد و به‌کارگیری این سبک رهبری با کاهش این رفتارها همراه است.')],
 [('b', 'چهرازی، قلی‌پور و پیران‌نژاد (۱۳۹۴) '),
  ('r', 'تحقیقی با عنوان «بررسی تأثیر سبک رهبری خدمتگزار بر رفتارهای ضدبهره‌وری کارکنان» ارائه کردند. هدف این پژوهش بررسی تأثیر رهبری خدمتگزار بر رفتارهای ضدبهره‌وری کارکنان و نقش توانمندسازی روان‌شناختی کارکنان در این رابطه بود. این مطالعه از نوع کمّی انجام شد و رابطه‌های میان رهبری خدمتگزار، توانمندسازی روان‌شناختی و رفتارهای ضدبهره‌وری را آزمون کرد. نتایج، اثر رهبری خدمتگزار بر رفتارهای ضدبهره‌وری کارکنان را تأیید کرد. این پژوهش از معدود مطالعات داخلی است که رهبری خدمتگزار را مستقیماً با یک رفتار نابهنجار کاری پیوند داده است؛ هرچند رفتار مورد سنجش آن، برخلاف رفتار غیراخلاقی حامی سازمان، به زیان سازمان انجام می‌شود.')],
 [('b', 'گل‌پرور، جوادیان، سلیمیان، اسماعیلیان اردستانی و احمدی (۱۳۹۱) '),
  ('r', 'تحقیقی با عنوان «رابطه رهبری ستمگرانه و رفتارهای غیراخلاقی: رویکرد نظام‌های آسیب‌شناختی هنجاری؛ مطالعه موردی در یک سازمان صنعتی و تولیدی» ارائه کردند. هدف این پژوهش بررسی رابطه رهبری ستمگرانه با رفتارهای غیراخلاقی کارکنان و نقش واسطه‌ای بی‌هنجاری سازمانی، بیگانگی شغلی و تعارض هنجاری ادراک‌شده در این رابطه بود. این مطالعه در یک سازمان صنعتی و تولیدی انجام شد و داده‌ها با پنج پرسشنامه رهبری ستمگرانه (۶ گویه)، بی‌هنجاری سازمانی (۸ گویه)، بیگانگی شغلی (۸ گویه)، تعارض هنجاری ادراک‌شده (۵ گویه) و رفتارهای غیراخلاقی (۴ گویه) گردآوری و با مدل‌یابی معادلات ساختاری تحلیل شد. نتایج نشان داد رهبری ستمگرانه از مسیری زنجیره‌ای، یعنی افزایش بی‌هنجاری سازمانی، بیگانگی شغلی و تعارض هنجاری ادراک‌شده، با رفتارهای غیراخلاقی کارکنان رابطه دارد و این سه متغیر نقش واسطه‌ای در این رابطه ایفا می‌کنند.')],
]
anchor = kids[i_dom]
for segs in DOMESTIC:
    segs = [('fn', add_fn(v)) if k == 'fn' else (k, v) for k, v in segs]
    np_ = make_par(TPL, segs)
    anchor.addnext(np_); anchor = np_

# foreign: Zeng (software names + footnotes), drop Mishra, Uymaz footnote moved, add Gigol
p_zeng = par_with('زنگ، کای، لی و یانگ (۲۰۲۵)')
replace_text(p_zeng, 'با نرم‌افزارهای SPSS و LISREL و', 'با نرم‌افزارهای اس‌پی‌اس‌اس و لیزرل و')
insert_fn_after(p_zeng, 'نرم‌افزارهای اس‌پی‌اس‌اس', add_fn('SPSS'))
insert_fn_after(p_zeng, ' و لیزرل', add_fn('LISREL'))

p_mishra = par_with('میشرا، شارما و ورما (۲۰۲۵)')
p_mishra.getparent().remove(p_mishra)

p_uymaz = par_with('رفتار غیراخلاقی حامی سازمان به‌عنوان پیامد رهبری خدمتگزار')
for r in p_uymaz.findall('w:r', ns):
    if r.find('w:footnoteReference', ns) is not None:
        p_uymaz.remove(r)

gig = make_par(TPL, [
  ('b', 'گیگول'), ('fn', add_fn('Gigol, 2021')), ('b', ' (۲۰۲۱) '),
  ('r', 'تحقیقی با عنوان «رهبری، دینداری، مالکیت دولتی بنگاه و رفتار غیراخلاقی حامی سازمان: نقش میانجی همزادپنداری سازمانی» ارائه کرد. هدف این پژوهش بررسی این بود که آیا همزادپنداری سازمانی، رابطه رهبری اصیل، دینداری و مالکیت دولتی بنگاه را با رفتار غیراخلاقی حامی سازمان میانجی‌گری می‌کند. این مطالعه از نوع کمّی و پیمایشی بود؛ نزدیک به نیمی از پاسخ‌دهندگان (۴۹/۱ درصد) در شرکت‌های دولتی شاغل بودند و داده‌ها با مدل‌یابی معادلات ساختاری مبتنی بر کوواریانس تحلیل شد. نتایج نشان داد رهبری اصیل، دینداری و مالکیت دولتی با افزایش همزادپنداری سازمانی همراه‌اند و همزادپنداری سازمانی به‌نوبه خود رفتار غیراخلاقی حامی سازمان را تشدید می‌کند؛ یعنی یک سبک رهبری مثبت می‌تواند از مسیر پیوند هویتی کارکنان به این رفتار بینجامد.')])
p_uymaz.addnext(gig)

# gap summary
p_gap = par_with('مرور پیشینه سه نکته را روشن می‌کند')
new_gap = make_par(TPL, [('r',
  'مرور پیشینه سه نکته را روشن می‌کند. نخست، در ادبیات خارجی رابطه رهبری خدمتگزار با رفتار غیراخلاقی حامی سازمان تأیید شده است، اما هر مطالعه تنها یک سازوکار را در مدل آورده: زنگ و همکاران (۲۰۲۵) معنای کار را، و گل و تیمور‌اوغلو (۲۰۲۶) و اویماز و آرسلان (۲۰۲۲) همزادپنداری با رهبر را؛ بنابراین سهم نسبی این دو مسیر ناشناخته مانده است. دوم، شواهد نشان می‌دهد سبک‌های رهبری مثبت نیز می‌توانند از مسیر پیوند هویتی به این رفتار بینجامند (گیگول، ۲۰۲۱)، اثر رهبری بر آن دولبه است (لوان و همکاران، ۲۰۲۳) و فرهنگ ملی این روابط را تعدیل می‌کند (میشرا و همکاران، ۲۰۲۵)؛ پس تعمیم یافته‌های چین و ترکیه به ایران نیازمند آزمون مستقل است. سوم، در ادبیات داخلی رابطه سبک‌های رهبری با رفتارهای غیراخلاقی و انحرافی کارکنان سنجیده شده است: رهبری فروتنانه رفتارهای غیراخلاقی به نفع سازمان را افزایش داده (حکاک و عظیمی، ۱۴۰۲)، رهبری اسلامی و رهبری اخلاقی رفتارهای انحرافی را کاهش داده‌اند (قائدامینی هارونی و همکاران، ۱۴۰۱؛ منتخب یگانه و همکاران، ۱۳۹۵)، رهبری خدمتگزار با رفتارهای ضدبهره‌وری مرتبط بوده است (چهرازی و همکاران، ۱۳۹۴) و رهبری ستمگرانه از مسیر بی‌هنجاری سازمانی و بیگانگی شغلی به رفتار غیراخلاقی انجامیده است (گل‌پرور و همکاران، ۱۳۹۱)؛ اما هیچ‌یک از این پژوهش‌ها رابطه رهبری خدمتگزار با رفتار غیراخلاقی حامی سازمان را نسنجیده‌اند. شکاف پژوهش حاضر از همین سه نکته برمی‌آید: برآورد هم‌زمان دو مسیر غیرمستقیم و یک مسیر مستقیم میان رهبری خدمتگزار و رفتار غیراخلاقی حامی سازمان، در یک نمونه ایرانی و در بافت صنعتی کارخانه سیمان شرق مشهد.')])
p_gap.addnext(new_gap); p_gap.getparent().remove(p_gap)

# --------------------------------------------- 4-10: drop sections و) and ز)
for head in ['و) ملاحظات اخلاقی', 'ز) زمان‌بندی اجرا']:
    h = par_with(head)
    nxt = h.getnext()
    assert nxt is not None and etree.QName(nxt).localname == 'p'
    h.getparent().remove(nxt); h.getparent().remove(h)

# ------------------------------------------------------------- 4-11 references
ref_tc = par_with('عبدالملکی، جمال و همکاران (۱۴۰۰)').getparent()
refs = [k for k in ref_tc if etree.QName(k).localname == 'p']
FA_TPL = refs[0]
EN_TPL = next(k for k in refs if ptext(k).startswith('Bandura'))
for k in refs:
    s = ptext(k)
    if PERSIAN.search(s[:3]):
        ref_tc.remove(k)

def simple_par(tpl, text):
    p = copy.deepcopy(tpl)
    for ch in list(p):
        if etree.QName(ch).localname != 'pPr':
            p.remove(ch)
    r0 = tpl.find('w:r', ns)
    r = etree.SubElement(p, q('r'))
    r.append(copy.deepcopy(r0.find('w:rPr', ns)))
    t = etree.SubElement(r, q('t')); t.text = text
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    return p

FA_REFS = [
 'چهرازی، سامان؛ قلی‌پور، آرین و پیران‌نژاد، علی (۱۳۹۴). بررسی تأثیر سبک رهبری خدمتگزار بر رفتارهای ضدبهره‌وری کارکنان. مطالعات رفتار سازمانی، ۴(۲)، ۹۹-۱۱۸.',
 'حکاک، محمد و عظیمی، حسین (۱۴۰۲). تأثیر رهبری فروتنانه بر رفتارهای غیراخلاقی مصلحتی در سازمان به واسطه دلسوزی در کار. مطالعات مدیریت راهبردی، ۱۴(۵۳)، ۱۶۷-۱۸۴.',
 ptext(FA_TPL),
 'قائدامینی هارونی، عباس؛ ابراهیم‌زاده دستجردی، رضا؛ صادقی، مهرداد و ماهرانی برزانی، مجید (۱۴۰۱). بررسی تأثیر رهبری اسلامی بر رفتارهای انحرافی در محیط کار از طریق اخلاق کار اسلامی و سرمایه اجتماعی. پژوهش‌های رهبری آموزشی، ۶(۲۲)، ۶۹-۹۹.',
 'گل‌پرور، محسن؛ جوادیان، زهرا؛ سلیمیان، نجمه؛ اسماعیلیان اردستانی، زهره و احمدی، اکرم (۱۳۹۱). رابطه رهبری ستمگرانه و رفتارهای غیراخلاقی: رویکرد نظام‌های آسیب‌شناختی هنجاری؛ مطالعه موردی در یک سازمان صنعتی و تولیدی. بهبود مدیریت، ۶(۲)، ۴-۲۲.',
 'منتخب یگانه، محمد؛ بشلیده، کیومرث؛ شمسی، مرجان و هزاریان، سولماز (۱۳۹۵). بررسی رابطه رهبری اخلاقی با رفتارهای انحرافی در محیط کار: نقش میانجی تعهد عاطفی و جو اخلاقی. مدیریت فرهنگ سازمانی، ۱۴(۱)، ۱۳۷-۱۵۳.',
]
anchor = ref_tc.find('w:tcPr', ns)
for txt in FA_REFS:
    np_ = simple_par(FA_TPL, txt)
    anchor.addnext(np_); anchor = np_

gul = next(k for k in ref_tc if ptext(k).startswith('Gul, E.'))
gul.addprevious(simple_par(EN_TPL,
  'Gigol, T. (2021). Leadership, religiousness, state ownership of an enterprise and unethical pro-organizational behavior: The mediating role of organizational identification. PLoS ONE, 16(5), e0251465. https://doi.org/10.1371/journal.pone.0251465'))

# ------------------------------------------------------------ conceptual model
caption = par_with('شکل ۱- مدل مفهومی پژوهش')
hyp_tc = caption.getparent()
lead = par_with('مدل زیر رابطه‌های فرضی پژوهش را نشان می‌دهد')
node = lead.getnext()
while node is not caption:
    nx = node.getnext(); hyp_tc.remove(node); node = nx

# image part
os.makedirs(os.path.join(ROOT, 'word/media'), exist_ok=True)
shutil.copy(IMG, os.path.join(ROOT, 'word/media/image1.png'))
relp = os.path.join(ROOT, 'word/_rels/document.xml.rels')
rel = etree.parse(relp)
RNS = 'http://schemas.openxmlformats.org/package/2006/relationships'
e = etree.SubElement(rel.getroot(), '{%s}Relationship' % RNS)
e.set('Id', 'rIdModelFig1'); e.set('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'); e.set('Target', 'media/image1.png')
rel.write(relp, xml_declaration=True, encoding='UTF-8', standalone=True)
ctp = os.path.join(ROOT, '[Content_Types].xml')
ct = etree.parse(ctp)
CNS = 'http://schemas.openxmlformats.org/package/2006/content-types'
if not any(d.get('Extension') == 'png' for d in ct.getroot().findall('{%s}Default' % CNS)):
    d = etree.Element('{%s}Default' % CNS); d.set('Extension', 'png'); d.set('ContentType', 'image/png')
    ct.getroot().insert(0, d)
ct.write(ctp, xml_declaration=True, encoding='UTF-8', standalone=True)

from PIL import Image
iw, ih = Image.open(IMG).size
cx = int(6.0 * 914400); cy = int(cx * ih / iw)
drawing = f'''<w:p xmlns:w="{W}" xmlns:r="{R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="{cx}" cy="{cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="501" name="ConceptualModel" descr="مدل مفهومی پژوهش"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="image1.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdModelFig1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'''
caption.addprevious(etree.fromstring(drawing))
# caption centred under the figure
cpPr = caption.find('w:pPr', ns)
jc = cpPr.find('w:jc', ns); jc.set(q('val'), 'center')

doc.write(docp, xml_declaration=True, encoding='UTF-8', standalone=True)
fdoc.write(fnp, xml_declaration=True, encoding='UTF-8', standalone=True)
print('ok')
