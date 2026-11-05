"""Build the conceptual-model figure (circles and arrows, Persian labels only).

Writes scripts/conceptual_model.html and renders it to proposal/conceptual_model.png
with the Chromium that ships with Playwright (see render step below).

Usage: python3 scripts/conceptual_model.py
Render: node scripts/render_conceptual_model.js
"""
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
R = 105  # circle radius (px)

NODES = {
    "ind": dict(x=820, y=340, role="متغیر مستقل", name="ارتقای شغلی",
                desc="سرعت و فرصت ادراک‌شده ارتقا", fill="#dbeafe", border="#1d4ed8"),
    "dep": dict(x=180, y=340, role="متغیر وابسته", name="عملکرد کارکنان",
                desc="", fill="#dcfce7", border="#15803d"),
    "dev": dict(x=500, y=215, role="متغیر میانجی", name="توسعه شغلی",
                desc="پیشرفت در اهداف شغلی، رشد توانایی حرفه‌ای", fill="#fef3c7", border="#b45309"),
    "mot": dict(x=500, y=515, role="متغیر میانجی", name="انگیزه شغلی",
                desc="انگیزش درونی و بیرونی تلاش در کار", fill="#fef3c7", border="#b45309"),
}


def clip(a, b):
    """Start and end points on the circles' edges along the segment a->b."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    d = math.hypot(dx, dy)
    ux, uy = dx / d, dy / d
    return (a[0] + ux * (R + 3), a[1] + uy * (R + 3)), (b[0] - ux * (R + 7), b[1] - uy * (R + 7))


def pt(n):
    return (NODES[n]["x"], NODES[n]["y"])


arrows = []  # (svg path d, label, label x, label y)
# H1 direct effect, drawn as an arc over the mediators
arrows.append(("M820,235 Q500,-75 180,235", "فرضیه ۱", 500, 80))
# H2 ind -> dev, H3 ind -> mot, H4 dev -> dep, H5 mot -> dep, H6 dev -> mot
for a, b, label in [("ind", "dev", "فرضیه ۲"), ("ind", "mot", "فرضیه ۳"),
                    ("dev", "dep", "فرضیه ۴"), ("mot", "dep", "فرضیه ۵"),
                    ("dev", "mot", "فرضیه ۶")]:
    p, q = clip(pt(a), pt(b))
    mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
    arrows.append((f"M{p[0]:.1f},{p[1]:.1f} L{q[0]:.1f},{q[1]:.1f}", label, mx, my))

svg_paths = "\n".join(
    f'<path d="{d}" class="arrow" marker-end="url(#ah)"/>' for d, _, _, _ in arrows)
svg_labels = "\n".join(
    f'<rect x="{x-38}" y="{y-14}" width="76" height="28" rx="14" class="tag"/>'
    f'<text x="{x}" y="{y+6}" class="tagtext">{t}</text>'
    for _, t, x, y in arrows)

circles = []
for key, n in NODES.items():
    desc = f'<div class="desc">{n["desc"]}</div>' if n["desc"] else ""
    circles.append(
        f'<div class="node" style="left:{n["x"]-R}px;top:{n["y"]-R}px;'
        f'background:{n["fill"]};border-color:{n["border"]}">'
        f'<div class="role" style="color:{n["border"]}">{n["role"]}</div>'
        f'<div class="name">{n["name"]}</div>{desc}</div>')

html = f"""<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<style>
  html, body {{ margin: 0; background: #ffffff; }}
  #fig {{ position: relative; width: 1000px; height: 640px;
          font-family: "DejaVu Sans", Tahoma, sans-serif; color: #111827; }}
  svg {{ position: absolute; left: 0; top: 0; }}
  .arrow {{ fill: none; stroke: #374151; stroke-width: 2.4; }}
  .tag {{ fill: #ffffff; stroke: #9ca3af; stroke-width: 1; }}
  .tagtext {{ font-size: 19px; text-anchor: middle; fill: #111827; font-family: "DejaVu Sans", Tahoma, sans-serif; }}
  .node {{ position: absolute; width: {2*R}px; height: {2*R}px; box-sizing: border-box;
           border: 2.5px solid; border-radius: 50%; display: flex; flex-direction: column;
           align-items: center; justify-content: center; text-align: center;
           padding: 0 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }}
  .role {{ font-size: 16px; margin-bottom: 4px; }}
  .name {{ font-size: 24px; font-weight: bold; line-height: 1.3; }}
  .desc {{ font-size: 18px; line-height: 1.5; margin-top: 4px; color: #374151; }}
</style>
</head>
<body>
<div id="fig">
<svg width="1000" height="640" viewBox="0 0 1000 640">
  <defs>
    <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8"
            orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#374151"/>
    </marker>
  </defs>
  {svg_paths}
  {svg_labels}
</svg>
{"".join(circles)}
</div>
</body>
</html>
"""

out = ROOT / "scripts" / "conceptual_model.html"
out.write_text(html, encoding="utf-8")
print("wrote", out)
