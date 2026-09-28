"""Charts for the three intangible capitals of the growth & learning domain (Chapter 4).

Component means are taken from the component ranking table of Chapter 4
(Likert 1-5, N=108); a capital's score is the mean of its components
(every component is measured by two items, so this equals the item mean).
"""
import os
import sys

import arabic_reshaper
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from bidi.algorithm import get_display
from matplotlib import font_manager

FONT_DIR = sys.argv[1] if len(sys.argv) > 1 else "fonts"
OUT_DIR = sys.argv[2] if len(sys.argv) > 2 else "figures"
for f in ("Vazirmatn-Regular.ttf", "Vazirmatn-Bold.ttf"):
    font_manager.fontManager.addfont(os.path.join(FONT_DIR, f))
plt.rcParams["font.family"] = "Vazirmatn"

NATIVE_BIDI = os.environ.get("NATIVE_BIDI", "1") == "1"  # matplotlib >= 3.11 shapes RTL itself
BLUE, RED, GREY, DARK = "#4472C4", "#C00000", "#7F7F7F", "#1F3864"
MIDPOINT = 3.0
GL_MEAN = 3.062  # growth & learning domain mean (Chapter 4 descriptive table)


def fa(text):
    shaped = arabic_reshaper.reshape(text)
    # Some matplotlib builds reorder RTL text themselves; only apply bidi when they don't.
    return shaped if NATIVE_BIDI else get_display(shaped)


CAPITALS = [
    ("human", "سرمایه انسانی", [
        ("توسعه شایستگی‌های چندگانه تخصصی", 2.657),
        ("آموزش تخصصی مبتنی بر شبیه‌ساز", 3.083),
        ("مدیریت استعداد و جانشین‌پروری", 3.213),
    ]),
    ("information", "سرمایه اطلاعاتی", [
        ("نظام یادگیری سازمانی پویا و مدیریت دانش دفاعی", 3.208),
    ]),
    ("organizational", "سرمایه سازمانی", [
        ("نوآوری، دکترین نبرد ناهمتراز و فرهنگ یادگیری", 3.148),
    ]),
]


def capital_mean(components):
    return round(sum(v for _, v in components) / len(components), 3)


def midpoint_line(ax, vertical):
    line = ax.axvline if vertical else ax.axhline
    line(MIDPOINT, color=RED, ls="--", lw=1.3, label=fa("حد متوسط مقیاس (3)"))


def style(ax):
    ax.set_xlim(0, 4.0)
    ax.set_xticks([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4])
    ax.grid(axis="x", color="#E6E6E6", lw=0.8)
    ax.set_axisbelow(True)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.yaxis.tick_right()  # RTL layout: labels on the right
    ax.spines["left"].set_visible(False)
    ax.set_xlabel(fa("میانگین وضعیت موجود (طیف لیکرت 1 تا 5)"), fontsize=10)


def capital_chart(key, title, components):
    labels = [c for c, _ in components]
    values = [v for _, v in components]
    colors = [RED if v < MIDPOINT else BLUE for v in values]
    if len(components) > 1:
        labels.append(f"میانگین {title}")
        values.append(capital_mean(components))
        colors.append(DARK)
    labels.append("میانگین کل حوزه رشد و یادگیری")
    values.append(GL_MEAN)
    colors.append(GREY)

    fig, ax = plt.subplots(figsize=(8, 1.9 + 0.75 * len(values)), dpi=150)
    y = list(range(len(values)))[::-1]
    ax.barh(y, values, color=colors, height=0.55)
    ax.set_yticks(y)
    ax.set_yticklabels([fa(l) for l in labels], fontsize=10)
    ax.set_ylim(-0.6, len(values) - 0.4)
    for yi, v in zip(y, values):
        ax.text(v + 0.04, yi, f"{v:.3f}", va="center", ha="right", fontsize=10,
                weight="bold")
    style(ax)
    ax.invert_xaxis()  # bars grow right-to-left, towards the labels
    midpoint_line(ax, vertical=True)
    ax.legend(loc="upper left", frameon=False, fontsize=9)
    ax.set_title(fa(f"میانگین مؤلفه‌های {title} در حوزه رشد و یادگیری (N=108)"),
                 fontsize=12, weight="bold", pad=12)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT_DIR, f"gl_{key}_capital.png"))
    plt.close(fig)


def comparison_chart():
    names = [t for _, t, _ in CAPITALS]
    means = [capital_mean(c) for _, _, c in CAPITALS]
    fig, ax = plt.subplots(figsize=(7.5, 4.6), dpi=150)
    x = range(len(names))[::-1]  # RTL order: first capital on the right
    bars = ax.bar(x, means, color=[RED if m < MIDPOINT else BLUE for m in means],
                  width=0.55)
    for b, m in zip(bars, means):
        ax.text(b.get_x() + b.get_width() / 2, m + 0.12, f"{m:.3f}",
                ha="center", fontsize=11, weight="bold")
    ax.set_xticks(list(x))
    ax.set_xticklabels([fa(n) for n in names], fontsize=11)
    ax.set_ylim(0, 4.0)
    midpoint_line(ax, vertical=False)
    ax.axhline(GL_MEAN, color=GREY, ls=":", lw=1.5,
               label=fa("میانگین کل حوزه رشد و یادگیری (3.062)"))
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.1), ncol=2,
              frameon=False, fontsize=9)
    ax.grid(axis="y", color="#E6E6E6", lw=0.8)
    ax.set_axisbelow(True)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.set_ylabel(fa("میانگین (طیف لیکرت 1 تا 5)"), fontsize=10)
    ax.set_title(fa("مقایسه وضعیت موجود سه سرمایه نامشهود حوزه رشد و یادگیری (N=108)"),
                 fontsize=12, weight="bold")
    fig.tight_layout()
    fig.savefig(os.path.join(OUT_DIR, "gl_capitals_comparison.png"))
    plt.close(fig)


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    for key, title, comps in CAPITALS:
        capital_chart(key, title, comps)
    comparison_chart()
    for key, title, comps in CAPITALS:
        print(key, capital_mean(comps))
