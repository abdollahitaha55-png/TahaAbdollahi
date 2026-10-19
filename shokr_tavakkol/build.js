// Builds "شکر و توکل" (Gratitude & Trust in God) — Persian, RTL, 25 slides.
// Photos: drop files named <key>.jpg|.jpeg|.png into ./images (keys are listed in
// images/README.md). Any slot without a file is drawn as a designed icon panel.
const fs = require("fs");
const path = require("path");
const React = require("react");
const RDS = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(process.env.APPLY_THEME);

const IMG_DIR = path.join(__dirname, "images");
const OUT = path.join(__dirname, "shokr_va_tavakkol.pptx");

const THEME = {
  name: "Shokr Tavakkol",
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  colors: {
    dk1: "10302D", lt1: "FFFFFF", dk2: "0B5048", lt2: "EAF2EF",
    accent1: "C9A24B", accent2: "1F8A7A", accent3: "8CC1B2",
    accent4: "C8674A", accent5: "2F5F8F", accent6: "6A4C93",
    hlink: "1F8A7A", folHlink: "6A4C93",
  },
};
const HEX = THEME.colors;
const AR = "Times New Roman"; // Arabic (Quran / hadith) text

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.rtlMode = true;
pres.title = "شکر و توکل";
pres.subject = "اخلاق اسلامی";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const W = 13.333, H = 7.5, M = 0.6;

// ---------- layouts ----------
const titlePh = (color) => ({
  placeholder: {
    options: {
      name: "title", type: "title", x: M, y: 0.4, w: W - 2 * M, h: 0.95,
      fontSize: 34, bold: true, color, align: "right", valign: "middle",
      rtlMode: true, margin: 0,
    },
    text: "",
  },
});
pres.defineSlideMaster({
  title: "LIGHT", background: { color: C.background1 },
  objects: [titlePh(C.text2)],
  slideNumber: { x: M, y: 6.95, w: 0.6, h: 0.3, fontSize: 11, color: "7A8F8B" },
});
pres.defineSlideMaster({
  title: "DARK_TITLE", background: { color: C.text1 },
  objects: [titlePh(C.background1)],
  slideNumber: { x: M, y: 6.95, w: 0.6, h: 0.3, fontSize: 11, color: "8CC1B2" },
});
pres.defineSlideMaster({ title: "DARK_BLANK", background: { color: C.text1 } });

// ---------- helpers ----------
const iconCache = {};
async function icon(name, color) {
  const k = name + color;
  if (!iconCache[k]) {
    const svg = RDS.renderToStaticMarkup(
      React.createElement(fa[name], { color: "#" + color, size: 256 })
    );
    const buf = await sharp(Buffer.from(svg)).resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    iconCache[k] = "image/png;base64," + buf.toString("base64");
  }
  return iconCache[k];
}
async function addIcon(s, name, color, x, y, d) {
  s.addImage({ data: await icon(name, color), x, y, w: d, h: d, objectName: "icon " + name, altText: "" });
}
const shadow = () => ({ type: "outer", blur: 8, offset: 2, angle: 90, color: "000000", opacity: 0.14 });

function T(s, text, x, y, w, h, o = {}) {
  s.addText(text, Object.assign({
    x, y, w, h, fontSize: 16, color: C.text1, align: "right", valign: "top",
    rtlMode: true, margin: 0, isTextBox: true, lang: "fa-IR",
  }, o));
}
function Ar(s, text, x, y, w, h, o = {}) {
  T(s, text, x, y, w, h, Object.assign({ fontFace: AR, lang: "ar-SA", fontSize: 28, color: C.accent1 }, o));
}
function card(s, x, y, w, h, fill, o = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, Object.assign({
    x, y, w, h, rectRadius: 0.14, fill: { color: fill }, line: { color: fill, width: 0 },
  }, o));
}
async function badge(s, name, x, y, d, bg, fg) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg, width: 0 } });
  const p = d * 0.27;
  await addIcon(s, name, fg, x + p, y + p, d - 2 * p);
}
function numBadge(s, n, x, y, d, bg, fg, size = 20) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg, width: 0 } });
  T(s, String(n), x, y, d, d, { align: "center", valign: "middle", bold: true, fontSize: size, color: fg });
}
const fa_digits = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
function title(s, text) { s.addText(text, { placeholder: "title", lang: "fa-IR" }); }
function notes(s, text) { s.addNotes(text); }

function findImage(key) {
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    const p = path.join(IMG_DIR, `${key}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
// Picture slot: real photo if present (cover-cropped), otherwise a designed icon panel.
async function slot(s, key, x, y, w, h, o = {}) {
  const { ico = "FaImage", circle = false, tone = "dark", frame = false, bare = false } = o;
  if (frame) {
    s.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.16, y: y + 0.16, w, h, fill: { type: "none" },
      line: { color: C.accent1, width: 1.5 },
    });
  }
  const file = findImage(key);
  if (file) {
    const px = 150;
    const buf = await sharp(file).rotate().resize(Math.round(w * px), Math.round(h * px), { fit: "cover", position: "attention" }).sharpen({ sigma: 0.7 }).jpeg({ quality: 90 }).toBuffer();
    s.addImage({ data: "image/jpeg;base64," + buf.toString("base64"), x, y, w, h, rounding: circle, altText: key });
    return;
  }
  const fill = tone === "dark" ? HEX.dk2 : tone === "gold" ? HEX.accent1 : HEX.lt2;
  const mark = tone === "dark" ? HEX.accent3 : tone === "gold" ? HEX.dk2 : HEX.accent2;
  const shape = circle ? pres.shapes.OVAL : pres.shapes.RECTANGLE;
  s.addShape(shape, { x, y, w, h, fill: { color: fill }, line: { color: fill, width: 0 } });
  if (bare) return;
  const m = Math.min(w, h);
  s.addShape(pres.shapes.OVAL, {
    x: x + w / 2 - m * 0.34, y: y + h / 2 - m * 0.34, w: m * 0.68, h: m * 0.68,
    fill: { color: mark, transparency: 82 }, line: { color: mark, width: 0 },
  });
  await addIcon(s, ico, mark, x + w / 2 - m * 0.16, y + h / 2 - m * 0.16, m * 0.32);
}
// dark scrim over a full-bleed photo so text stays readable
function scrim(s, x, y, w, h, tr = 30) {
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.text1, transparency: tr }, line: { color: C.text1, width: 0 } });
}

// ---------- slides ----------
async function build() {
  let s;

  // 1 — Title
  pres.addSection({ title: "مقدمه" });
  s = pres.addSlide({ masterName: "DARK_BLANK", sectionTitle: "مقدمه" });
  await slot(s, "title", M, 0.9, 4.9, 5.7, { ico: "FaMosque", tone: "dark", frame: true });
  T(s, "درس اخلاق اسلامی", 6.3, 1.2, 6.43, 0.5, { fontSize: 22, color: C.accent1, bold: true });
  T(s, "شکر و توکل", 6.3, 1.9, 6.43, 1.6, { fontSize: 72, bold: true, color: C.background1, valign: "middle" });
  T(s, "سپاسِ نعمت‌های خدا و اعتماد به تدبیر او", 6.3, 3.7, 6.43, 0.9, { fontSize: 26, color: C.accent3 });
  T(s, "برگرفته از کتاب «اخلاق اسلامی»، محمد داوودی", 6.3, 5.4, 6.43, 0.5, { fontSize: 18, color: C.background1 });
  Ar(s, "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ", 6.3, 6.1, 6.43, 0.7, { fontSize: 30 });
  notes(s, "معرفی موضوع: شکر و توکل دو فضیلت ایمانی در اخلاق اسلامی.\nتصویر پیشنهادی: نمای گنبد و مناره‌های یک مسجد هنگام طلوع آفتاب.");

  // 2 — Outline
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "مقدمه" });
  title(s, "فهرست مطالب");
  const cw = (W - 2 * M - 0.7) / 3;
  const outline = [
    ["۱", "شکر", ["معنا و ارکان شکر", "نعمت‌های ظاهری و باطنی", "روایات و نمونه‌های شاکران", "آثار شکر و کفران نعمت", "راه‌های شکرگزاری"], HEX.dk2, "FFFFFF", HEX.accent1],
    ["۲", "توکل", ["معنا و جایگاه توکل", "توکل و تلاش", "مراتب توکل", "ریشه‌ها و آثار توکل", "نمونه‌های توکل"], HEX.lt2, HEX.dk1, HEX.accent2],
    ["۳", "جمع‌بندی", ["پیوند شکر و توکل", "برنامهٔ عملی یک روز", "نتیجه‌گیری"], HEX.lt2, HEX.dk1, HEX.accent2],
  ];
  for (let i = 0; i < 3; i++) {
    const [n, t, items, bg, fg, ac] = outline[i];
    const x = W - M - cw - i * (cw + 0.35);
    card(s, x, 1.65, cw, 5.0, bg);
    T(s, n, x + 0.35, 1.8, cw - 0.7, 0.9, { fontSize: 54, bold: true, color: ac });
    T(s, t, x + 0.35, 2.75, cw - 0.7, 0.6, { fontSize: 26, bold: true, color: fg });
    T(s, items.map((it, k) => ({ text: it, options: { bullet: true, breakLine: k < items.length - 1 } })), x + 0.35, 3.5, cw - 0.7, 2.9, { fontSize: 17, color: fg, paraSpaceAfter: 8 });
  }
  notes(s, "مسیر ارائه: ابتدا شکر، سپس توکل، و در پایان پیوند این دو و برنامهٔ عملی.");

  // 3 — Intro
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "مقدمه" });
  title(s, "جایگاه شکر و توکل در اخلاق اسلامی");
  await slot(s, "intro", M, 1.6, 4.6, 5.0, { ico: "FaSun", tone: "dark", frame: true });
  const intro = [
    ["FaQuran", "اخلاق، میوهٔ ایمان", "در اخلاق اسلامی، رفتار نیک از ریشهٔ ایمان و توحید می‌روید؛ فضایل ایمانی سرچشمهٔ فضیلت‌های دیگرند."],
    ["FaHandHoldingHeart", "شکر؛ نگاه به گذشته و حال", "شناخت نعمت‌های خدا و سپاس از او، دل را از ناسپاسی و حسرت پاک می‌کند."],
    ["FaShieldAlt", "توکل؛ نگاه به آینده", "اعتماد به خدا در کنار تلاش، انسان را از اضطراب و وابستگی به غیر خدا آزاد می‌کند."],
  ];
  for (let i = 0; i < 3; i++) {
    const y = 1.6 + i * 1.75;
    await badge(s, intro[i][0], W - M - 0.95, y + 0.2, 0.95, HEX.dk2, HEX.accent1);
    T(s, intro[i][1], 5.9, y, W - M - 1.25 - 5.9, 0.5, { fontSize: 22, bold: true, color: C.text2 });
    T(s, intro[i][2], 5.9, y + 0.55, W - M - 1.25 - 5.9, 1.0, { fontSize: 17 });
  }
  notes(s, "تصویر پیشنهادی: افق دریا یا کوهستان در طلوع آفتاب؛ نماد نور و امید.");

  // 4 — Divider: Shokr
  pres.addSection({ title: "شکر" });
  s = pres.addSlide({ masterName: "DARK_BLANK", sectionTitle: "شکر" });
  await slot(s, "shokr_div", M, 1.5, 4.8, 5.0, { ico: "FaHandsHelping", tone: "dark", frame: true });
  T(s, "بخش اول", 6.1, 1.9, 6.63, 0.5, { fontSize: 22, color: C.accent1, bold: true });
  T(s, "شکر", 6.1, 2.4, 6.63, 1.9, { fontSize: 96, bold: true, color: C.background1, valign: "middle" });
  T(s, "سپاسِ نعمت‌های بی‌شمار خداوند", 6.1, 4.4, 6.63, 0.7, { fontSize: 26, color: C.accent3 });
  Ar(s, "وَقَلِيلٌ مِّنْ عِبَادِيَ الشَّكُورُ", 6.1, 5.6, 6.63, 0.7, { fontSize: 30 });
  T(s, "سبأ، آیهٔ ۱۳", 6.1, 6.3, 6.63, 0.4, { fontSize: 14, color: C.accent3 });
  notes(s, "تصویر پیشنهادی: دست‌هایی که به آسمان بلند شده‌اند یا سفرهٔ نان و میوه.");

  // 5 — Meaning of shokr
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "شکر" });
  title(s, "معنای شکر");
  await slot(s, "shokr_def", M, 1.6, 4.4, 5.0, { ico: "FaSeedling", tone: "dark", frame: true });
  const defs = [
    ["در لغت", "شکر یعنی سپاس‌گزاری و ستایش در برابر نعمت؛ ضد آن «کفر» و «کفران» است.", 1.6, 2.2, HEX.lt2, HEX.dk1],
    ["در اصطلاح", "شناخت نعمت و نعمت‌دهنده، و به‌کار گرفتن نعمت در راهی که رضای او در آن است؛ همراه با سپاس قلبی و زبانی.", 4.0, 2.6, HEX.dk2, "FFFFFF"],
  ];
  for (const [lab, txt, y, h, bg, fg] of defs) {
    card(s, 5.6, y, W - M - 5.6, h, bg);
    T(s, lab, 5.95, y + 0.25, W - M - 5.6 - 0.7, 0.45, { fontSize: 20, bold: true, color: bg === HEX.dk2 ? C.accent1 : C.accent2 });
    T(s, txt, 5.95, y + 0.8, W - M - 5.6 - 0.7, h - 1.0, { fontSize: 20, color: fg === "FFFFFF" ? C.background1 : C.text1 });
  }
  notes(s, "تصویر پیشنهادی: نهالی که از خاک می‌روید؛ نماد رشد نعمت در پرتو شکر.");

  // 6 — Verse: Ibrahim 7
  s = pres.addSlide({ masterName: "DARK_BLANK", sectionTitle: "شکر" });
  await slot(s, "shokr_verse", M, 1.5, 4.0, 5.0, { ico: "FaQuran", tone: "dark", frame: true });
  T(s, "وعدهٔ الهی دربارهٔ شکر", 4.9, 0.8, 7.83, 0.6, { fontSize: 22, bold: true, color: C.accent3 });
  Ar(s, "لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ وَلَئِن كَفَرْتُمْ إِنَّ عَذَابِي لَشَدِيدٌ", 4.9, 1.7, 7.83, 2.3, { fontSize: 38, valign: "middle", lineSpacingMultiple: 1.2 });
  T(s, "«اگر شکرگزاری کنید، [نعمت] شما را افزون می‌کنم و اگر ناسپاسی کنید، عذاب من سخت است.»", 4.9, 4.2, 7.83, 1.2, { fontSize: 22, color: C.background1 });
  T(s, "ابراهیم، آیهٔ ۷", 4.9, 5.5, 7.83, 0.4, { fontSize: 15, color: C.accent3 });
  card(s, 4.9, 6.05, 3.7, 0.65, HEX.dk2);
  T(s, "شکر ← افزایش نعمت", 4.9, 6.05, 3.7, 0.65, { align: "center", valign: "middle", fontSize: 17, bold: true, color: C.accent1 });
  card(s, 8.8, 6.05, 3.93, 0.65, HEX.dk2);
  T(s, "کفران ← عذاب سخت", 8.8, 6.05, 3.93, 0.65, { align: "center", valign: "middle", fontSize: 17, bold: true, color: C.background1 });
  notes(s, "تصویر پیشنهادی: صفحهٔ قرآن کریم و نور ملایم.");

  // 7 — Three kinds of shokr
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "شکر" });
  title(s, "ارکان شکر: قلب، زبان، عمل");
  const kinds = [
    ["FaHeart", "شکر قلبی", "شناخت اینکه همهٔ نعمت‌ها از خداست و محبت به نعمت‌دهنده.", "هر نعمتی را از او دیدن"],
    ["FaCommentDots", "شکر زبانی", "ستایش و سپاس خدا با زبان و یادکردن نعمت‌های او.", "«الحمد لله رب العالمین»"],
    ["FaHandsHelping", "شکر عملی", "به‌کار بردن هر نعمت در همان راهی که برای آن آفریده شده و خدا می‌پسندد.", "علم و مال را در خدمت مردم گذاشتن"],
  ];
  for (let i = 0; i < 3; i++) {
    const x = W - M - cw - i * (cw + 0.35);
    card(s, x, 1.65, cw, 5.0, HEX.lt2);
    await badge(s, kinds[i][0], x + cw / 2 - 0.5, 1.95, 1.0, HEX.dk2, HEX.accent1);
    T(s, kinds[i][1], x + 0.3, 3.15, cw - 0.6, 0.55, { fontSize: 26, bold: true, color: C.text2, align: "center" });
    T(s, kinds[i][2], x + 0.3, 3.85, cw - 0.6, 1.5, { fontSize: 17 });
    card(s, x + 0.3, 5.5, cw - 0.6, 0.85, HEX.dk2);
    T(s, kinds[i][3], x + 0.45, 5.5, cw - 0.9, 0.85, { fontSize: 15, color: C.background1, valign: "middle", align: "center" });
  }
  notes(s, "شکر کامل در سه ساحت جلوه می‌کند: دل، زبان و رفتار.");

  // 8 — Blessings
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "شکر" });
  title(s, "نعمت‌های ظاهری و باطنی");
  card(s, M, 1.55, W - 2 * M, 1.25, HEX.dk2);
  Ar(s, "وَإِن تَعُدُّوا نِعْمَةَ اللَّهِ لَا تُحْصُوهَا", W - M - 6.5 - 0.25, 1.55, 6.5, 1.25, { fontSize: 28, valign: "middle" });
  T(s, "«اگر نعمت‌های خدا را بشمارید، نمی‌توانید آن‌ها را به شمار آورید.» (ابراهیم ۳۴)", M + 0.3, 1.55, 5.4, 1.25, { fontSize: 15, color: C.background1, valign: "middle" });
  const groups = [
    ["نعمت‌های ظاهری", HEX.accent2, [["FaHeartbeat", "سلامت و تندرستی"], ["FaTint", "آب و غذا"], ["FaUsers", "خانواده و دوستان"], ["FaSun", "زمین، آسمان و نور"]]],
    ["نعمت‌های باطنی", HEX.dk2, [["FaStar", "ایمان"], ["FaLightbulb", "عقل و اندیشه"], ["FaDove", "آرامش دل"], ["FaRoute", "هدایت"]]],
  ];
  const gw = (W - 2 * M - 0.4) / 2;
  for (let g = 0; g < 2; g++) {
    const gx = W - M - gw - g * (gw + 0.4);
    card(s, gx, 3.05, gw, 0.55, groups[g][1]);
    T(s, groups[g][0], gx, 3.05, gw, 0.55, { align: "center", valign: "middle", fontSize: 18, bold: true, color: C.background1 });
    for (let k = 0; k < 4; k++) {
      const col = k % 2, row = Math.floor(k / 2);
      const iw = (gw - 0.25) / 2;
      const ix = gx + gw - iw - col * (iw + 0.25);
      const iy = 3.8 + row * 1.5;
      card(s, ix, iy, iw, 1.3, HEX.lt2);
      await badge(s, groups[g][2][k][0], ix + iw - 0.8, iy + 0.3, 0.7, groups[g][1], "FFFFFF");
      T(s, groups[g][2][k][1], ix + 0.15, iy, iw - 1.1, 1.3, { fontSize: 16, bold: true, valign: "middle" });
    }
  }
  T(s, "لقمان ۲۰: «و نعمت‌های آشکار و پنهان خود را بر شما کامل کرد.»", M, 6.9, 9, 0.35, { fontSize: 13, color: "5A706C" });
  notes(s, "برای هر دسته چند نمونه از زندگی روزمره بیان شود. ممکن است جای هر آیکن عکس واقعی (مثلاً سفرهٔ غذا، خانواده، آسمان) قرار گیرد.");

  // 9 — Hadith
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "شکر" });
  title(s, "شکر در کلام معصومان (ع)");
  const had = [
    ["پیامبر اکرم (ص)", "هر که مخلوق را سپاس نگوید، خدا را سپاس نگفته است.", "مَنْ لَمْ يَشْكُرِ الْمَخْلُوقَ لَمْ يَشْكُرِ الْخَالِقَ"],
    ["امام علی (ع) — نهج‌البلاغه، حکمت ۳۳۱", "کمترین چیزی که بر شما لازم است، این است که از نعمت‌های خدا برای نافرمانی او کمک نگیرید.", "أَقَلُّ مَا يَلْزَمُكُمْ لِلَّهِ أَلَّا تَسْتَعِينُوا بِنِعَمِهِ عَلَى مَعَاصِيهِ"],
    ["امام صادق (ع) — اصول کافی", "شکر هر نعمت، هرچند بزرگ باشد، این است که خدا را بر آن سپاس بگویی.", "شُكْرُ كُلِّ نِعْمَةٍ وَإِنْ عَظُمَتْ أَنْ تَحْمَدَ اللَّهَ عَزَّ وَجَلَّ عَلَيْهَا"],
  ];
  for (let i = 0; i < 3; i++) {
    const y = 1.6 + i * 1.75;
    card(s, M, y, W - 2 * M, 1.55, HEX.lt2);
    await badge(s, "FaQuoteRight", W - M - 1.05, y + 0.38, 0.8, HEX.dk2, HEX.accent1);
    T(s, had[i][0], M + 0.3, y + 0.12, W - 2 * M - 1.65, 0.35, { fontSize: 14, bold: true, color: C.accent2 });
    T(s, had[i][1], M + 0.3, y + 0.48, W - 2 * M - 1.65, 0.6, { fontSize: 17, bold: true, valign: "top" });
    Ar(s, had[i][2], M + 0.3, y + 1.12, W - 2 * M - 1.65, 0.42, { fontSize: 18, color: C.text2 });
  }
  notes(s, "تصویر پیشنهادی (اختیاری): خوشنویسی «الحمد لله».");

  // 10 — Examples of grateful servants
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "شکر" });
  title(s, "الگوهای شکرگزاری");
  const ex = [
    ["noah", "FaShip", "حضرت نوح (ع)", "قرآن او را «بندهٔ بسیار شکرگزار» (عبداً شکوراً) می‌نامد. (اسراء ۳)"],
    ["solomon", "FaCrown", "حضرت سلیمان (ع)", "با همهٔ قدرت می‌گفت: «این از فضل پروردگار من است تا مرا بیازماید که شکر می‌کنم یا ناسپاسی.» (نمل ۴۰)"],
    ["prophet", "FaMoon", "پیامبر اکرم (ص)", "در روایات آمده است: آن‌قدر در نماز شب می‌ایستاد که پاهایش ورم می‌کرد و می‌فرمود: «آیا بندهٔ شکرگزار نباشم؟»"],
  ];
  for (let i = 0; i < 3; i++) {
    const x = W - M - cw - i * (cw + 0.35);
    await slot(s, ex[i][0], x + cw / 2 - 1.3, 1.65, 2.6, 2.6, { ico: ex[i][1], circle: true, tone: "dark" });
    T(s, ex[i][2], x, 4.5, cw, 0.5, { fontSize: 24, bold: true, color: C.text2, align: "center" });
    T(s, ex[i][3], x + 0.1, 5.15, cw - 0.2, 1.6, { fontSize: 17, align: "center" });
  }
  notes(s, "تصویر پیشنهادی: ۱) کشتی در دریا ۲) قلعه/کاخ تاریخی یا تاج ۳) آسمان شب و مهتاب بر مسجد.");

  // 11 — Effects of shokr (cycle)
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "شکر" });
  title(s, "آثار شکر");
  const cyc = [["FaGift", "نعمت"], ["FaEye", "شناخت نعمت‌دهنده"], ["FaHandHoldingHeart", "شکر"], ["FaSeedling", "افزایش نعمت"]];
  const nd = 1.5, gap = (W - 2 * M - 4 * nd) / 3;
  for (let i = 0; i < 4; i++) {
    const x = W - M - nd - i * (nd + gap);
    await badge(s, cyc[i][0], x, 1.75, nd, i === 3 ? HEX.accent1 : HEX.dk2, i === 3 ? HEX.dk2 : HEX.accent1);
    T(s, cyc[i][1], x - 0.3, 3.4, nd + 0.6, 0.5, { align: "center", fontSize: 18, bold: true, color: C.text2 });
    if (i < 3) {
      s.addShape(pres.shapes.LEFT_ARROW, { x: x - gap + 0.25, y: 2.25, w: gap - 0.5, h: 0.5, fill: { color: HEX.accent3 }, line: { color: HEX.accent3, width: 0 } });
    }
  }
  const eff = [
    ["FaCheckCircle", "رضایت خدا", "«و اگر شکر کنید، آن را برای شما می‌پسندد.» (زمر ۷)"],
    ["FaSmile", "آرامش و رضایت درونی", "دل شاکر به داشته‌ها می‌نگرد، نه به نداشته‌ها."],
    ["FaUsers", "محبت و پیوند انسانی", "قدردانی از مردم، روابط را گرم و پایدار می‌کند."],
  ];
  const ew = (W - 2 * M - 0.7) / 3;
  for (let i = 0; i < 3; i++) {
    const x = W - M - ew - i * (ew + 0.35);
    card(s, x, 4.3, ew, 2.35, HEX.lt2);
    await badge(s, eff[i][0], x + ew - 0.95, 4.55, 0.7, HEX.accent2, "FFFFFF");
    T(s, eff[i][1], x + 0.25, 5.35, ew - 0.5, 0.45, { fontSize: 19, bold: true, color: C.text2 });
    T(s, eff[i][2], x + 0.25, 5.8, ew - 0.5, 0.8, { fontSize: 15 });
  }
  notes(s, "وعدهٔ «لأزیدنکم»: شکر، چرخهٔ نعمت را بسته نگه می‌دارد و آن را افزون می‌کند.");

  // 12 — Kufran vs shokr
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "شکر" });
  title(s, "شکر و کفران نعمت");
  const cmp = [
    ["شکرگزاری", HEX.dk2, "FaSmileBeam", ["نعمت پایدار و افزون می‌شود", "خدا از بنده راضی می‌شود (زمر ۷)", "آرامش و رضایت درونی", "قدرشناسی در روابط انسانی"]],
    ["کفران نعمت", HEX.accent4, "FaFrown", ["نعمت از دست می‌رود یا برکتش کم می‌شود", "حسرت، حرص و نارضایتی", "غفلت از نعمت‌دهنده و غرور", "هشدار به عذاب سخت (ابراهیم ۷)"]],
  ];
  const cmw = (W - 2 * M - 0.5) / 2;
  for (let i = 0; i < 2; i++) {
    const x = W - M - cmw - i * (cmw + 0.5);
    card(s, x, 1.6, cmw, 3.85, cmp[i][1]);
    await badge(s, cmp[i][2], x + cmw - 1.05, 1.85, 0.8, "FFFFFF", cmp[i][1]);
    T(s, cmp[i][0], x + 0.3, 1.85, cmw - 1.6, 0.8, { fontSize: 26, bold: true, color: C.background1, valign: "middle" });
    T(s, cmp[i][3].map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < 3 } })), x + 0.35, 2.95, cmw - 0.7, 2.3, { fontSize: 17, color: C.background1, paraSpaceAfter: 8 });
  }
  card(s, M, 5.7, W - 2 * M, 1.0, HEX.lt2);
  T(s, "نحل ۱۱۲: خدا شهری را مثل می‌زند که امن و آرام بود و روزی‌اش از هر سو می‌رسید؛ پس نعمت‌های خدا را ناسپاسی کردند و خدا لباس گرسنگی و ترس را بر آنان پوشاند.", M + 0.3, 5.7, W - 2 * M - 0.6, 1.0, { fontSize: 15, valign: "middle" });
  notes(s, "تصویر پیشنهادی (اختیاری): زمین سرسبز در برابر زمین خشک و ترک‌خورده.");

  // 13 — Ways to be grateful
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "شکر" });
  title(s, "راه‌های رسیدن به شکرگزاری");
  await slot(s, "shokr_ways", M, 1.6, 3.9, 5.0, { ico: "FaLeaf", tone: "dark", frame: true });
  const ways = [
    ["شناخت نعمت‌ها", "نعمت‌های هر روز را یادآوری و فهرست کن."],
    ["نگاه به پایین‌تر در امور دنیا", "به کسی بنگر که کمتر داشته دارد، تا قدر داشته‌ها را بدانی."],
    ["شناخت نعمت‌دهنده", "سرچشمهٔ همهٔ نعمت‌ها را در نظر داشته باش."],
    ["سپاس زبانی و عملی", "حمد خدا بگو و نعمت را در خدمت مردم و راه درست خرج کن."],
    ["پرهیز از گناه با نعمت", "از نعمت خدا برای نافرمانی او کمک نگیر."],
  ];
  const rx = 4.9, rw = W - M - rx;
  for (let i = 0; i < 5; i++) {
    const y = 1.6 + i * 1.06;
    card(s, rx, y, rw, 0.93, HEX.lt2);
    numBadge(s, fa_digits(i + 1), rx + rw - 0.8, y + 0.14, 0.65, HEX.dk2, HEX.accent1, 20);
    T(s, ways[i][0], rx + 0.25, y + 0.1, rw - 1.2, 0.38, { fontSize: 18, bold: true, color: C.text2 });
    T(s, ways[i][1], rx + 0.25, y + 0.5, rw - 1.2, 0.35, { fontSize: 15 });
  }
  notes(s, "تصویر پیشنهادی: برگ‌های سبز و قطرهٔ باران، یا دفتر یادداشت نعمت‌ها.");

  // 14 — Divider: Tavakkol
  pres.addSection({ title: "توکل" });
  s = pres.addSlide({ masterName: "DARK_BLANK", sectionTitle: "توکل" });
  await slot(s, "tav_div", M, 1.5, 4.8, 5.0, { ico: "FaMountain", tone: "dark", frame: true });
  T(s, "بخش دوم", 6.1, 1.9, 6.63, 0.5, { fontSize: 22, color: C.accent1, bold: true });
  T(s, "توکل", 6.1, 2.4, 6.63, 1.9, { fontSize: 96, bold: true, color: C.background1, valign: "middle" });
  T(s, "اعتماد به خدا و سپردن کارها به او", 6.1, 4.4, 6.63, 0.7, { fontSize: 26, color: C.accent3 });
  Ar(s, "وَعَلَى اللَّهِ فَلْيَتَوَكَّلِ الْمُؤْمِنُونَ", 6.1, 5.6, 6.63, 0.7, { fontSize: 30 });
  T(s, "آل‌عمران، آیهٔ ۱۶۰", 6.1, 6.3, 6.63, 0.4, { fontSize: 14, color: C.accent3 });
  notes(s, "تصویر پیشنهادی: کوه استوار در مه، یا راهی که به افق می‌رسد.");

  // 15 — Meaning of tawakkul
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "توکل" });
  title(s, "معنای توکل");
  await slot(s, "tav_def", W - M - 4.4, 1.6, 4.4, 3.2, { ico: "FaRoute", tone: "dark", frame: false });
  card(s, W - M - 4.4, 5.0, 4.4, 1.6, HEX.dk2);
  T(s, "انسان با تمام قدرت تلاش می‌کند، اما نتیجه را به خدا می‌سپارد.", W - M - 4.4 + 0.3, 5.0, 3.8, 1.6, { fontSize: 18, bold: true, color: C.background1, valign: "middle" });
  const tdefs = [
    ["در لغت", "توکل از ریشهٔ «وَکَلَ» است؛ یعنی کار را به دیگری سپردن و او را وکیل گرفتن.", 1.6, 2.2, HEX.lt2, HEX.dk1],
    ["در اصطلاح", "اعتماد و اطمینان به خدا و سپردن کارها به او، پس از به‌کار گرفتن اسباب؛ با باور به اینکه سرچشمهٔ همهٔ تأثیرها اوست.", 4.0, 2.6, HEX.dk2, "FFFFFF"],
  ];
  const tdw = W - M - 4.4 - 0.5 - M;
  for (const [lab, txt, y, h, bg, fg] of tdefs) {
    card(s, M, y, tdw, h, bg);
    T(s, lab, M + 0.35, y + 0.25, tdw - 0.7, 0.45, { fontSize: 20, bold: true, color: bg === HEX.dk2 ? C.accent1 : C.accent2 });
    T(s, txt, M + 0.35, y + 0.8, tdw - 0.7, h - 1.0, { fontSize: 20, color: fg === "FFFFFF" ? C.background1 : C.text1 });
  }
  notes(s, "تصویر پیشنهادی: مسیری که میان کوه‌ها به افق می‌رسد؛ نماد حرکت با اعتماد.");

  // 16 — Verses on tawakkul
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "توکل" });
  title(s, "توکل در قرآن");
  const tv = [
    ["فَإِذَا عَزَمْتَ فَتَوَكَّلْ عَلَى اللَّهِ إِنَّ اللَّهَ يُحِبُّ الْمُتَوَكِّلِينَ", "«پس چون تصمیم گرفتی، بر خدا توکل کن؛ خدا توکل‌کنندگان را دوست دارد.»", "آل‌عمران ۱۵۹"],
    ["وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ إِنَّ اللَّهَ بَالِغُ أَمْرِهِ", "«و هر کس بر خدا توکل کند، او برایش کافی است؛ خدا فرمان خود را به انجام می‌رساند.»", "طلاق ۳"],
    ["وَعَلَى اللَّهِ فَتَوَكَّلُوا إِن كُنتُم مُّؤْمِنِينَ", "«و اگر مؤمنید، بر خدا توکل کنید.»", "مائده ۲۳"],
  ];
  for (let i = 0; i < 3; i++) {
    const y = 1.6 + i * 1.75;
    card(s, M, y, W - 2 * M, 1.55, HEX.dk2);
    Ar(s, tv[i][0], 5.2, y + 0.1, W - M - 0.3 - 5.2, 1.35, { fontSize: 24, valign: "middle" });
    T(s, tv[i][1], M + 0.3, y + 0.15, 4.4, 0.95, { fontSize: 15, color: C.background1, valign: "middle" });
    T(s, tv[i][2], M + 0.3, y + 1.1, 4.4, 0.35, { fontSize: 13, color: C.accent3, bold: true });
  }
  notes(s, "آیات توکل: دعوت به توکل، وعدهٔ کفایت الهی و محبت خدا به متوکلان.");

  // 17 — Tawakkul and effort
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "توکل" });
  title(s, "توکل یعنی تلاش، نه بیکاری");
  card(s, M, 1.6, 5.9, 5.0, HEX.dk2);
  Ar(s, "اعْقِلْهَا وَتَوَكَّلْ", M + 0.3, 1.85, 5.3, 1.1, { fontSize: 44, align: "center", valign: "middle" });
  T(s, "«شترت را ببند و [سپس] توکل کن.»", M + 0.4, 3.05, 5.1, 0.6, { fontSize: 21, bold: true, color: C.background1, align: "center" });
  T(s, "روایت شده مردی از پیامبر (ص) پرسید: شترم را رها کنم و توکل کنم، یا ببندم و توکل کنم؟ حضرت فرمود: «ببند و توکل کن.»", M + 0.4, 3.85, 5.1, 2.4, { fontSize: 17, color: C.accent3, align: "right" });
  const eq = [
    ["تلاش و به‌کارگیری اسباب", "برنامه‌ریزی، کار، مشورت، پیشگیری", "FaTools", HEX.lt2, HEX.dk1],
    ["اعتماد به خدا", "باور به اینکه اثر نهایی از اوست", "FaPrayingHands", HEX.lt2, HEX.dk1],
    ["توکل راستین", "حرکت همراه با آرامش دل", "FaCheckCircle", HEX.accent1, HEX.dk1],
  ];
  const ex0 = 6.9, ewid = W - M - ex0;
  const ys = [1.6, 3.35, 5.1];
  for (let i = 0; i < 3; i++) {
    card(s, ex0, ys[i], ewid, 1.5, eq[i][3]);
    await badge(s, eq[i][2], ex0 + ewid - 1.1, ys[i] + 0.35, 0.8, HEX.dk2, HEX.accent1);
    T(s, eq[i][0], ex0 + 0.3, ys[i] + 0.3, ewid - 1.6, 0.5, { fontSize: 20, bold: true, color: C.text1 });
    T(s, eq[i][1], ex0 + 0.3, ys[i] + 0.82, ewid - 1.6, 0.5, { fontSize: 15, color: C.text1 });
  }
  T(s, "+", ex0, 3.1, ewid, 0.25, { align: "center", fontSize: 18, bold: true, color: C.accent2, valign: "middle" });
  T(s, "=", ex0, 4.85, ewid, 0.25, { align: "center", fontSize: 18, bold: true, color: C.accent2, valign: "middle" });
  notes(s, "اشتباه رایج: توکل را ترک تلاش پنداشتن. در اسلام توکل با به‌کارگیری اسباب جمع می‌شود.");

  // 18 — Levels
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "توکل" });
  title(s, "مراتب توکل");
  const lv = [
    ["مرتبهٔ اول", "اعتماد به وکیل امین", "مانند اعتماد به وکیلی توانا و دلسوز که کارت را به او سپرده‌ای.", 3.3, HEX.accent3, HEX.dk1],
    ["مرتبهٔ دوم", "اعتماد کودک به مادر", "دل تنها به خدا نظر دارد، چنان‌که کودک در دشواری جز مادر را نمی‌جوید.", 4.2, HEX.accent2, "FFFFFF"],
    ["مرتبهٔ سوم", "تسلیم کامل", "انسان خود را کاملاً در اختیار اراده و حکمت خدا می‌بیند و آرام است.", 5.0, HEX.dk2, "FFFFFF"],
  ];
  for (let i = 0; i < 3; i++) {
    const [lab, tt, dd, h, bg, fg] = lv[i];
    const x = W - M - cw - i * (cw + 0.35);
    const y = 6.6 - h;
    card(s, x, y, cw, h, bg);
    T(s, fa_digits(i + 1), x + 0.3, y + 0.15, 1.0, 0.9, { fontSize: 48, bold: true, color: i === 0 ? HEX.dk2 : HEX.accent1 });
    T(s, lab, x + 0.3, y + 1.0, cw - 0.6, 0.35, { fontSize: 14, bold: true, color: fg === "FFFFFF" ? C.accent3 : C.text2 });
    T(s, tt, x + 0.3, y + 1.4, cw - 0.6, 0.5, { fontSize: 21, bold: true, color: fg === "FFFFFF" ? C.background1 : C.text1 });
    T(s, dd, x + 0.3, y + 2.0, cw - 0.6, h - 2.1, { fontSize: 16, color: fg === "FFFFFF" ? C.background1 : C.text1 });
  }
  notes(s, "مراتب توکل در متون اخلاقی با عبارت‌های نزدیک به هم آمده است؛ هرچه ایمان قوی‌تر باشد، توکل نیز بالاتر است.");

  // 19 — Roots
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "توکل" });
  title(s, "ریشه‌های توکل");
  const roots = [
    ["FaGlobeAsia", "توحید افعالی", "باور به اینکه مؤثر حقیقی در جهان خداست و دیگر اسباب به اذن او اثر دارند."],
    ["FaEye", "شناخت صفات خدا", "آگاهی از علم، قدرت و رحمت بی‌پایان او."],
    ["FaHeart", "حسن ظن به خدا", "گمان نیک به تدبیر و حکمت پروردگار."],
    ["FaCheckCircle", "یقین به وعده‌های او", "اطمینان به وعده‌هایی چون «فَهُوَ حَسْبُهُ» (طلاق ۳)."],
  ];
  const rw2 = (W - 2 * M - 0.35) / 2;
  for (let i = 0; i < 4; i++) {
    const col = i % 2, row = Math.floor(i / 2);
    const x = W - M - rw2 - col * (rw2 + 0.35);
    const y = 1.6 + row * 2.6;
    card(s, x, y, rw2, 2.4, i === 0 || i === 3 ? HEX.dk2 : HEX.lt2);
    const dark = i === 0 || i === 3;
    await badge(s, roots[i][0], x + rw2 - 1.25, y + 0.35, 0.95, dark ? HEX.accent1 : HEX.dk2, dark ? HEX.dk2 : HEX.accent1);
    T(s, roots[i][1], x + 0.3, y + 0.35, rw2 - 1.8, 0.55, { fontSize: 24, bold: true, color: dark ? C.background1 : C.text2 });
    T(s, roots[i][2], x + 0.3, y + 1.4, rw2 - 0.6, 0.9, { fontSize: 17, color: dark ? C.background1 : C.text1 });
  }
  notes(s, "توکل بر پایهٔ شناخت خدا شکل می‌گیرد؛ هرچه شناخت عمیق‌تر باشد، اعتماد بیشتر است.");

  // 20 — Effects of tawakkul
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "توکل" });
  title(s, "آثار توکل");
  card(s, M, 1.6, 5.4, 5.0, HEX.dk2);
  Ar(s, "الْغِنَى وَالْعِزُّ يَجُولَانِ فَإِذَا ظَفِرَا بِمَوْضِعِ التَّوَكُّلِ أَوْطَنَا", M + 0.3, 1.85, 4.8, 2.3, { fontSize: 25, valign: "middle", lineSpacingMultiple: 1.2 });
  T(s, "«بی‌نیازی و عزت در گردشند؛ چون به جایگاه توکل برسند، همان‌جا ساکن می‌شوند.»", M + 0.3, 4.3, 4.8, 1.4, { fontSize: 17, color: C.background1 });
  T(s, "امام صادق (ع) — اصول کافی", M + 0.3, 5.95, 4.8, 0.4, { fontSize: 14, bold: true, color: C.accent3 });
  const te = [
    ["FaDove", "آرامش و رفع اضطراب", "کسی که کار را به خدا سپرده، از نگرانی نتیجه آزاد می‌شود."],
    ["FaShieldAlt", "قوت قلب و عزت", "در روایات آمده: هر که می‌خواهد نیرومندترین مردم باشد، بر خدا توکل کند."],
    ["FaHandHoldingHeart", "کفایت و بی‌نیازی", "«و هر کس بر خدا توکل کند، او برایش کافی است.» (طلاق ۳)"],
  ];
  const tx = 6.3, tw = W - M - tx;
  for (let i = 0; i < 3; i++) {
    const y = 1.6 + i * 1.75;
    card(s, tx, y, tw, 1.55, HEX.lt2);
    await badge(s, te[i][0], tx + tw - 1.1, y + 0.37, 0.8, HEX.accent2, "FFFFFF");
    T(s, te[i][1], tx + 0.3, y + 0.2, tw - 1.6, 0.45, { fontSize: 20, bold: true, color: C.text2 });
    T(s, te[i][2], tx + 0.3, y + 0.7, tw - 1.6, 0.8, { fontSize: 15 });
  }
  notes(s, "تصویر پیشنهادی (اختیاری): قایق در دریای آرام یا درخت استوار در باد.");

  // 21 — Examples of tawakkul
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "توکل" });
  title(s, "نمونه‌های توکل در قرآن");
  const tex = [
    ["musa", "FaWater", "موسی (ع) و دریا", "در برابر دریا و لشکر فرعون گفت: «هرگز! پروردگارم با من است و مرا راهنمایی می‌کند.» (شعراء ۶۲)"],
    ["cave", "FaMountain", "پیامبر (ص) در غار", "به یار خود فرمود: «غمگین مباش، خدا با ماست.» (توبه ۴۰)"],
    ["mominin", "FaUsers", "مؤمنان و «حسبنا الله»", "گفتند: «خدا ما را بس است و او نیکو وکیلی است.» (آل‌عمران ۱۷۳)"],
  ];
  for (let i = 0; i < 3; i++) {
    const x = W - M - cw - i * (cw + 0.35);
    card(s, x, 1.65, cw, 5.0, HEX.lt2);
    await slot(s, tex[i][0], x, 1.65, cw, 2.2, { ico: tex[i][1], tone: "dark" });
    T(s, tex[i][2], x + 0.25, 4.05, cw - 0.5, 0.5, { fontSize: 21, bold: true, color: C.text2 });
    T(s, tex[i][3], x + 0.25, 4.65, cw - 0.5, 1.9, { fontSize: 15.5 });
  }
  notes(s, "تصویر پیشنهادی: ۱) دریا ۲) غار در کوه ۳) کاروانی در بیابان.");

  // 22 — Link between shokr and tawakkul
  pres.addSection({ title: "جمع‌بندی" });
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "جمع‌بندی" });
  title(s, "پیوند شکر و توکل");
  s.addShape(pres.shapes.OVAL, { x: 5.87, y: 1.6, w: 3.8, h: 3.8, fill: { color: HEX.accent2, transparency: 15 }, line: { color: HEX.accent2, width: 0 } });
  s.addShape(pres.shapes.OVAL, { x: 3.67, y: 1.6, w: 3.8, h: 3.8, fill: { color: HEX.accent1, transparency: 15 }, line: { color: HEX.accent1, width: 0 } });
  T(s, "شکر", 7.9, 2.9, 1.6, 0.9, { fontSize: 36, bold: true, color: C.background1, align: "center", valign: "middle" });
  T(s, "توکل", 3.85, 2.9, 1.6, 0.9, { fontSize: 36, bold: true, color: C.text1, align: "center", valign: "middle" });
  card(s, 5.85, 3.0, 1.65, 0.7, HEX.dk2);
  T(s, "توحید و آرامش", 5.85, 3.0, 1.65, 0.7, { fontSize: 14, bold: true, color: C.background1, align: "center", valign: "middle" });
  const bt = [
    ["شکر: گذشته و حال", "نعمت‌هایی که دریافت کرده‌ام را می‌بینم و سپاس می‌گویم.", HEX.accent2, 0],
    ["توکل: آینده", "با تلاش، کار را به خدا می‌سپارم و دل را آرام می‌کنم.", HEX.accent1, 1],
  ];
  for (const [t1, t2, col, k] of bt) {
    const x = W - M - 5.83 - k * 6.43;
    card(s, x, 5.65, 5.83, 1.1, HEX.lt2);
    T(s, t1, x + 0.3, 5.75, 5.2, 0.4, { fontSize: 18, bold: true, color: C.text2 });
    T(s, t2, x + 0.3, 6.2, 5.2, 0.5, { fontSize: 15 });
  }
  notes(s, "هر دو از توحید و حسن ظن به خدا سرچشمه می‌گیرند: شکر برای نعمت‌های گذشته و حال، توکل برای آینده.");

  // 23 — A day with shokr & tawakkul
  s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "جمع‌بندی" });
  title(s, "برنامهٔ عملی یک روز");
  const day = [
    ["day_morning", "FaSun", "صبح؛ توکل", ["با نام خدا و نیت خالص آغاز کن", "کارهای روز را به خدا بسپار", "برای توفیق دعا کن"]],
    ["day_work", "FaBriefcase", "روز؛ تلاش و شکر", ["با برنامه و تلاش کار کن", "از هر نعمت، و از مردم تشکر کن", "نعمت را در راه درست خرج کن"]],
    ["day_night", "FaMoon", "شب؛ شکر", ["سه نعمت امروز را یادداشت کن", "حمد و سپاس بگو", "نتیجه را به خدا واگذار و آرام بخواب"]],
  ];
  for (let i = 0; i < 3; i++) {
    const x = W - M - cw - i * (cw + 0.35);
    card(s, x, 1.65, cw, 5.0, HEX.lt2);
    await slot(s, day[i][0], x, 1.65, cw, 1.7, { ico: day[i][1], tone: i === 1 ? "gold" : "dark" });
    T(s, day[i][2], x + 0.25, 3.5, cw - 0.5, 0.5, { fontSize: 22, bold: true, color: C.text2 });
    T(s, day[i][3].map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < 2 } })), x + 0.25, 4.15, cw - 0.5, 2.4, { fontSize: 17, paraSpaceAfter: 10 });
  }
  notes(s, "تصویر پیشنهادی: ۱) طلوع آفتاب ۲) میز کار/تلاش ۳) آسمان پرستارهٔ شب.");

  // 24 — Summary
  s = pres.addSlide({ masterName: "DARK_TITLE", sectionTitle: "جمع‌بندی" });
  title(s, "جمع‌بندی");
  await slot(s, "summary", M, 1.6, 4.2, 5.0, { ico: "FaHandsHelping", tone: "dark", frame: true });
  const sum = [
    "شکر یعنی شناخت نعمت و نعمت‌دهنده و به‌کار بردن نعمت در راه رضای او.",
    "شکر در سه ساحت قلب، زبان و عمل جلوه می‌کند و نعمت را افزون می‌سازد.",
    "توکل یعنی تلاش همراه با اعتماد به خدا، نه ترک اسباب.",
    "شکر و توکل دو بال پرواز به سوی آرامش و نزدیکی به خدایند.",
  ];
  const sx = 5.2, sw = W - M - sx;
  for (let i = 0; i < 4; i++) {
    const y = 1.6 + i * 1.28;
    card(s, sx, y, sw, 1.12, HEX.dk2);
    numBadge(s, fa_digits(i + 1), sx + sw - 0.9, y + 0.2, 0.72, HEX.accent1, HEX.dk1, 22);
    T(s, sum[i], sx + 0.3, y, sw - 1.35, 1.12, { fontSize: 18, color: C.background1, valign: "middle" });
  }
  notes(s, "تصویر پیشنهادی: دو دست در حال دعا یا طلوع آفتاب.");

  // 25 — Closing
  s = pres.addSlide({ masterName: "DARK_BLANK", sectionTitle: "جمع‌بندی" });
  await slot(s, "closing", 0, 0, W, H, { ico: "FaMosque", tone: "dark", bare: true });
  if (findImage("closing")) scrim(s, 0, 0, W, H, 35);
  T(s, "سپاس از توجه شما", 1.2, 1.5, W - 2.4, 1.2, { fontSize: 54, bold: true, color: C.background1, align: "center", valign: "middle" });
  Ar(s, "وَعَلَيْهِ يَتَوَكَّلُ الْمُتَوَكِّلُونَ", 1.2, 3.1, W - 2.4, 0.9, { fontSize: 36, align: "center", valign: "middle" });
  T(s, "زمر، آیهٔ ۳۸", 1.2, 4.0, W - 2.4, 0.4, { fontSize: 14, color: C.accent3, align: "center" });
  Ar(s, "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ", 1.2, 4.6, W - 2.4, 0.8, { fontSize: 32, color: C.background1, align: "center", valign: "middle" });
  T(s, "منابع: قرآن کریم؛ نهج‌البلاغه؛ اصول کافی؛ اخلاق اسلامی، محمد داوودی؛ جامع‌السعادات، ملا‌مهدی نراقی", 1.0, 6.4, W - 2, 0.5, { fontSize: 14, color: C.accent3, align: "center" });
  notes(s, "پایان ارائه و پرسش و پاسخ.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("written", OUT);
}
build().catch((e) => { console.error(e); process.exit(1); });
