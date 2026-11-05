"""Second pass on the proposal: keep the Persian body free of English words.

* Removes the English glosses added after Persian terms in sections 4-3 and 4-7.
* Writes software names in Persian (SPSS, PLS, SmartPLS).
* Writes "APA" as Persian in the 4-11 heading and hypothesis labels H1..H9 as Persian.
* Replaces the old text-table model with the circle-based figure
  (proposal/conceptual_model.png, built by scripts/conceptual_model.py).
English stays only where the form or the citation rules require it: the
English title, English abstract, English keywords, footnotes and the English
reference list.

Usage: python3 scripts/localize_proposal.py <in.docx> <out.docx> <figure.png>
"""
import copy
import re
import sys

import docx
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm
from lxml import etree

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = "{%s}" % W_NS
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"
src, dst, figure = sys.argv[1:4]

document = docx.Document(src)
body = document.element.body


# ------------------------------------------------------------ token helpers
def to_tokens(p):
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
                elif sub.tag == W + "br":
                    toks.append({"k": "br", "rpr": rpr})
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
            etree.SubElement(r, W + "footnoteReference").set(W + "id", t["id"])
        elif t["k"] == "br":
            flush()
            r = etree.SubElement(p, W + "r")
            if t["rpr"] is not None:
                r.append(copy.deepcopy(t["rpr"]))
            etree.SubElement(r, W + "br")
        else:
            flush()
            p.append(t["el"])
    flush()


def plain(toks):
    return "".join(t["ch"] for t in toks if t["k"] == "c")


def replace_first(toks, old, new):
    """Replace the first occurrence of `old` among character tokens."""
    s = plain(toks)
    k = s.find(old)
    if k < 0:
        return toks, False
    pos = [i for i, t in enumerate(toks) if t["k"] == "c"]
    start, end = pos[k], pos[k + len(old) - 1]
    assert all(toks[i]["k"] == "c" for i in range(start, end + 1)), old
    rpr = toks[start]["rpr"]
    chars = [{"k": "c", "ch": ch, "rpr": rpr} for ch in new]
    return toks[:start] + chars + toks[end + 1:], True


def para_text(p):
    return "".join((t.text or "") for t in p.iter(W + "t"))


def has_persian(s):
    return re.search(r"[؀-ۿ]", s) is not None


def edit_all(pairs, only_persian=True):
    """Apply (old, new) replacements to every matching body paragraph."""
    counts = {old: 0 for old, _ in pairs}
    for p in list(body.iter(W + "p")):
        text = para_text(p)
        if only_persian and not has_persian(text):
            continue
        if not any(old in text for old, _ in pairs):
            continue
        toks = to_tokens(p)
        changed = False
        for old, new in pairs:
            while True:
                toks, ok = replace_first(toks, old, new)
                if not ok:
                    break
                counts[old] += 1
                changed = True
        if changed:
            rebuild(p, toks)
    return counts


# ------------------------------------------------------------ 1. English glosses
GLOSSES = [
    (" (Employee Performance)", ""),
    (" (Job Promotion)", ""),
    (" (Expectancy Theory)", ""),
    (" (Ability-Motivation-Opportunity; AMO)", ""),
    (" (Career Development)", ""),
    (" (Job Motivation)", ""),
]
print("glosses removed:", edit_all(GLOSSES))

# ------------------------------------------------------------ 2. software names
SOFTWARE = [
    ("SmartPLS", "اسمارت‌پی‌ال‌اس"),
    ("SPSS", "اس‌پی‌اس‌اس"),
    ("PLS", "پی‌ال‌اس"),
]
print("software names:", edit_all(SOFTWARE))

# ------------------------------------------------------------ 3. APA and H labels
LABELS = [("روش APA", "شیوه ای‌پی‌ای")]
for n, fa in enumerate(["۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"], start=1):
    LABELS.append((f"H{n}. ", f"فرضیه {fa}. "))
print("labels:", edit_all(LABELS))

# ------------------------------------------------------------ 4. model figure
figure_tbl = None
for tbl in body.iter(W + "tbl"):
    has_text = "مسیر مستقیم آزمون" in "".join(t.text or "" for t in tbl.iter(W + "t"))
    has_inner_table = tbl.find(".//" + W + "tbl") is not None
    if has_text and not has_inner_table:
        figure_tbl = tbl  # innermost table that holds the figure
        break
assert figure_tbl is not None, "model table not found"
assert figure_tbl.getparent().tag == W + "tc", "expected the model table inside a cell"

pic_par = document.add_paragraph()  # appended at the end of the body, moved below
run = pic_par.add_run()
run.add_picture(figure, width=Cm(13.8))
pic_par.alignment = WD_ALIGN_PARAGRAPH.CENTER
pic_par.paragraph_format.keep_with_next = True
pic_el = pic_par._p
body.remove(pic_el)  # detach from the body before placing inside the cell
figure_tbl.addprevious(pic_el)
figure_tbl.getparent().remove(figure_tbl)

document.save(dst)
print("saved", dst)
