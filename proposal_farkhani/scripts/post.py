import sys, os, re
from lxml import etree
ROOT = sys.argv[1]
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ns = {'w': W}
def q(t): return '{%s}%s' % (W, t)
docp = os.path.join(ROOT, 'word/document.xml'); fnp = os.path.join(ROOT, 'word/footnotes.xml')
doc = etree.parse(docp); fdoc = etree.parse(fnp)
body = doc.getroot().find('w:body', ns); froot = fdoc.getroot()

# 1) renumber footnotes in document order and store them in that order
refs = list(body.iter(q('footnoteReference')))
fns = {f.get(q('id')): f for f in froot.findall('w:footnote', ns)}
seps = [f for f in froot.findall('w:footnote', ns) if f.get(q('type')) in ('separator', 'continuationSeparator')]
ordered = []
for new_id, r in enumerate(refs, 1):
    old = r.get(q('id'))
    f = fns[old]
    assert f not in ordered, old
    ordered.append(f)
    r.set(q('id'), str(new_id))
for f in ordered:
    f.set(q('id'), str(ordered.index(f) + 1))
for f in list(froot.findall('w:footnote', ns)):
    froot.remove(f)
for f in seps + ordered:
    froot.append(f)
unused = set(fns.values()) - set(ordered) - set(seps)
assert not unused, len(unused)

# 2) Latin-only paragraphs -> left-to-right
PERSIAN = re.compile(r'[؀-ۿ]')
ORDER = ['pStyle','keepNext','keepLines','pageBreakBefore','framePr','widowControl','numPr','suppressLineNumbers','pBdr','shd','tabs','suppressAutoHyphens','kinsoku','wordWrap','overflowPunct','topLinePunct','autoSpaceDE','autoSpaceDN','bidi']
n = 0
for p in body.iter(q('p')):
    t = ''.join(x.text or '' for x in p.iter(q('t')))
    if not t.strip() or PERSIAN.search(t) or not re.search(r'[A-Za-z]', t):
        continue
    pPr = p.find('w:pPr', ns)
    if pPr is None:
        pPr = etree.Element(q('pPr')); p.insert(0, pPr)
    b = pPr.find('w:bidi', ns)
    if b is None:
        b = etree.Element(q('bidi'))
        pos = 0
        for i, ch in enumerate(pPr):
            if etree.QName(ch).localname in ORDER:
                pos = i + 1
        pPr.insert(pos, b)
    b.set(q('val'), '0')
    n += 1
print('footnotes:', len(ordered), '| LTR paragraphs:', n)
doc.write(docp, xml_declaration=True, encoding='UTF-8', standalone=True)
fdoc.write(fnp, xml_declaration=True, encoding='UTF-8', standalone=True)
