// Builds the Persian (RTL) class presentation:
// «بررسی حقوقی مزاحمت‌های فضای مجازی در حقوق ایران» — ارائه‌دهنده: نگین جوان
//
// Requires pptxgenjs, react, react-dom, react-icons, sharp (resolvable via NODE_PATH) and the
// pptx skill's apply_theme.js (path in APPLY_THEME env var).
//
// Usage: NODE_PATH=... APPLY_THEME=.../apply_theme.js node scripts/build_cyber_harassment_slides.js [out.pptx]

const fs = require("fs");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const JSZip = require(require.resolve("jszip", { paths: [require.resolve("pptxgenjs")] }));
const fa = require("react-icons/fa");
const { applyTheme } = require(process.env.APPLY_THEME);

const OUT = process.argv[2] || "cyber_harassment_slides_negin_javan.pptx";

// ---------- theme ----------
const FA = "B Nazanin"; // body (Persian)
const FA_HEAD = "B Titr"; // headings (Persian)
const EN = "Calibri";
const THEME = {
  name: "Cyber Law Violet",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1F1A2E", lt1: "FFFFFF", dk2: "2D2350", lt2: "F3F1FA",
    accent1: "E4572E", accent2: "5B4B9A", accent3: "17A398", accent4: "F2B134",
    accent5: "8E8AA8", accent6: "C9C3E6", hlink: "5B4B9A", folHlink: "8E8AA8",
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.author = "نگین جوان";
pres.title = "بررسی حقوقی مزاحمت‌های فضای مجازی در حقوق ایران";
pres.subject = "ارائه کلاسی - مقطع کارشناسی";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

const W = 13.333, M = 0.6, CW = W - 2 * M, R = W - M; // content width / right edge

// ---------- helpers ----------
async function icon(name, color = "FFFFFF", size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(fa[name], { color: "#" + color, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

const faOpts = (o = {}) => ({
  fontFace: o.head ? FA_HEAD : FA,
  rtlMode: true,
  lang: "fa-IR",
  align: o.align || "right",
  valign: o.valign || "top",
  color: o.color || C.text1,
  fontSize: o.size || 18,
  bold: !!o.bold,
  margin: o.margin ?? 0.05,
  isTextBox: true,
  paraSpaceAfter: o.paraSpaceAfter ?? 0,
  lineSpacingMultiple: o.lineSpacingMultiple ?? 1.0,
  fit: "none",
});

function T(slide, text, x, y, w, h, o = {}) {
  slide.addText(text, { x, y, w, h, ...faOpts(o), objectName: o.name });
}

// rich paragraphs: [{t, bold, color, size, bullet}]
function P(slide, paras, x, y, w, h, o = {}) {
  const runs = paras.map((p, i) => ({
    text: p.t,
    options: {
      bold: !!p.bold,
      color: p.color || o.color || C.text1,
      fontSize: p.size || o.size || 18,
      fontFace: p.head ? FA_HEAD : FA,
      bullet: p.bullet ? { code: "25CF", indent: 18 } : false,
      breakLine: i < paras.length - 1,
      rtlMode: true,
      lang: "fa-IR",
      paraSpaceAfter: p.after ?? o.paraSpaceAfter ?? 4,
    },
  }));
  slide.addText(runs, { x, y, w, h, ...faOpts(o), objectName: o.name });
}

function EnT(slide, text, x, y, w, h, o = {}) {
  slide.addText(text, {
    x, y, w, h, fontFace: EN, fontSize: o.size || 12, color: o.color || C.accent5,
    align: o.align || "left", valign: o.valign || "top", italic: !!o.italic, margin: 0.05,
    isTextBox: true, objectName: o.name,
  });
}

function card(slide, x, y, w, h, o = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: o.radius ?? 0.12,
    fill: { color: o.fill || C.background2, transparency: o.transparency || 0 },
    line: o.line ? { color: o.line, width: 1 } : { type: "none" },
    shadow: o.shadow ? { type: "outer", color: "000000", blur: 8, offset: 2, angle: 90, opacity: 0.12 } : undefined,
    objectName: o.name,
  });
}

function circleIcon(slide, img, x, y, d, fill, name) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { type: "none" }, objectName: name ? name + " circle" : undefined });
  const pad = d * 0.24;
  slide.addImage({ data: img, x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad, objectName: name ? name + " icon" : undefined });
}

function badge(slide, text, x, y, w, h, fill, color = C.background1, size = 16) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: h / 2, fill: { color: fill }, line: { type: "none" } });
  slide.addText(text, { x, y, w, h, ...faOpts({ align: "center", valign: "middle", color, size, bold: true }) });
}

// columns laid out right-to-left: index 0 is the right-most
const colX = (i, n, gap, left = M, width = CW) => {
  const w = (width - gap * (n - 1)) / n;
  return { x: left + width - (i + 1) * w - i * gap, w };
};

// ---------- layouts ----------
pres.defineSlideMaster({
  title: "TITLE_DARK",
  background: { color: HEX.dk2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 4.7, y: 1.95, w: 8.03, h: 2.0, fontFace: FA_HEAD, fontSize: 38, bold: true, color: C.background1, align: "right", valign: "middle", rtlMode: true }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 4.7, y: 4.05, w: 8.03, h: 0.7, fontFace: FA, fontSize: 24, color: C.accent6, align: "right", valign: "top", rtlMode: true }, text: "" } },
  ],
});

pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: HEX.lt1 },
  margin: [0.4, 0.6, 0.6, 0.6],
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.32, w: CW, h: 0.95, fontFace: FA_HEAD, fontSize: 30, bold: true, color: C.text2, align: "right", valign: "middle", rtlMode: true }, text: "" } },
    { text: { text: "بررسی حقوقی مزاحمت‌های فضای مجازی در حقوق ایران — نگین جوان", options: { x: 6.4, y: 6.98, w: 6.333, h: 0.35, fontFace: FA, fontSize: 11, color: C.accent5, align: "right", valign: "middle", rtlMode: true, lang: "fa-IR" } } },
  ],
  slideNumber: { x: M, y: 6.98, w: 0.8, h: 0.35, fontFace: FA, fontSize: 11, color: HEX.accent5, align: "left" },
});

pres.defineSlideMaster({
  title: "CLOSING_DARK",
  background: { color: HEX.dk2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.55, w: CW, h: 1.0, fontFace: FA_HEAD, fontSize: 32, bold: true, color: C.background1, align: "right", valign: "middle", rtlMode: true }, text: "" } },
  ],
});

const titleOpts = { placeholder: "title", rtlMode: true, lang: "fa-IR", align: "right" };

// ---------- build ----------
async function main() {
  const I = {};
  const names = [
    "FaUserShield", "FaSms", "FaCommentSlash", "FaExclamationTriangle", "FaImage", "FaTheaterMasks", "FaBullhorn",
    "FaUserLock", "FaChild", "FaUserSecret", "FaGlobe", "FaCopy", "FaMobileAlt", "FaCoins", "FaLandmark",
    "FaEnvelopeOpenText", "FaBalanceScale", "FaBookOpen", "FaCommentDots", "FaBinoculars", "FaUsers", "FaQuoteRight",
    "FaGavel", "FaFemale", "FaPuzzlePiece", "FaQuestionCircle", "FaSyncAlt", "FaBalanceScaleLeft", "FaRobot",
    "FaSearch", "FaEyeSlash", "FaShieldAlt", "FaCheck", "FaBook", "FaComments", "FaFolderOpen", "FaFlag",
    "FaFileSignature", "FaMoneyBillWave", "FaHandPaper", "FaLaptopCode", "FaBan", "FaClipboardList",
  ];
  for (const n of names) I[n] = await icon(n);
  const Iv = { quote: await icon("FaQuoteRight", HEX.accent6) };

  // ===== 1. Title =====
  pres.addSection({ title: "مقدمه" });
  let s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "مقدمه" });
  s.addShape(pres.shapes.OVAL, { x: 0.95, y: 1.55, w: 3.3, h: 3.3, fill: { color: C.accent2 }, line: { type: "none" }, objectName: "hero circle" });
  s.addShape(pres.shapes.OVAL, { x: 0.75, y: 1.35, w: 3.7, h: 3.7, fill: { type: "none" }, line: { color: C.accent6, width: 1.5 }, objectName: "hero ring" });
  s.addImage({ data: I.FaUserShield, x: 1.75, y: 2.35, w: 1.7, h: 1.7, objectName: "hero icon" });
  T(s, "ارائه کلاسی  |  مقطع کارشناسی", 4.7, 1.35, 8.03, 0.5, { color: C.accent4, size: 18, bold: true, name: "kicker" });
  s.addText("بررسی حقوقی مزاحمت‌های فضای مجازی در حقوق ایران", titleOpts);
  s.addText("ارائه‌دهنده: نگین جوان", { placeholder: "body", rtlMode: true, lang: "fa-IR", align: "right" });
  T(s, "درس: ............................          استاد: ............................", 4.7, 4.95, 8.03, 0.5, { color: C.background1, size: 16, name: "course" });
  T(s, "آبان ۱۴۰۵", 4.7, 5.55, 8.03, 0.5, { color: C.accent6, size: 16, name: "date" });
  s.addNotes("سلام و وقت بخیر. موضوع ارائه من بررسی حقوقی مزاحمت‌های فضای مجازی در حقوق ایران است. در این ارائه می‌بینیم مزاحمت سایبری چیست، قانون ایران با چه موادی با آن برخورد می‌کند، بزه‌دیده چه مسیری برای شکایت دارد و قانون ما چه خلأهایی دارد.");

  // ===== 2. Agenda =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "مقدمه" });
  s.addText("نقشه ارائه", titleOpts);
  const agenda = [
    ["مقدمه و بیان مسئله", "اهمیت موضوع و سؤالات پژوهش"],
    ["مفاهیم و مبانی", "تعریف، ویژگی‌ها و مبانی حمایت"],
    ["چارچوب قانونی", "ماده ۶۴۱، قانون جرائم رایانه‌ای و سایر مقررات"],
    ["دادرسی و جبران خسارت", "مسیر شکایت، ادله و مسئولیت مدنی"],
    ["نگاه تطبیقی", "انگلستان و اسناد بین‌المللی"],
    ["چالش‌ها و پیشنهادها", "خلأهای قانونی و راهکارها"],
  ];
  const digits = ["۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸"];
  agenda.forEach(([t, d], i) => {
    const { x, w } = colX(i % 3, 3, 0.35);
    const y = i < 3 ? 1.6 : 4.1;
    card(s, x, y, w, 2.15, { name: `agenda card ${i + 1}` });
    s.addShape(pres.shapes.OVAL, { x: x + w - 1.05, y: y + 0.3, w: 0.75, h: 0.75, fill: { color: i === 2 ? C.accent1 : C.accent2 }, line: { type: "none" } });
    T(s, digits[i], x + w - 1.05, y + 0.3, 0.75, 0.75, { align: "center", valign: "middle", color: C.background1, size: 22, bold: true, head: true });
    T(s, t, x + 0.25, y + 0.32, w - 1.45, 0.7, { size: 20, bold: true, valign: "middle", color: C.text2 });
    T(s, d, x + 0.3, y + 1.2, w - 0.6, 0.8, { size: 16, color: C.text1 });
  });
  s.addNotes("ارائه در شش بخش تنظیم شده است. تمرکز اصلی بر بخش سوم، یعنی چارچوب قانونی است؛ چون مهم‌ترین پرسش این است که کدام مواد قانونی بر این رفتارها حاکم‌اند.");

  // ===== 3. Problem & questions =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "مقدمه" });
  s.addText("مزاحمت: از کوچه و خیابان تا گوشی همراه", titleOpts);
  T(s, "نمونه‌هایی از مسئله", 7.0, 1.55, 5.733, 0.5, { size: 20, bold: true, color: C.accent2 });
  const probs = [
    ["FaCommentDots", "پیام‌های مکرر و آزاردهنده در پیام‌رسان‌ها، حتی نیمه‌شب"],
    ["FaUserSecret", "ساختن صفحه جعلی به نام دیگری و نسبت دادن مطالب به او"],
    ["FaImage", "انتشار تصویر یا فیلم خصوصی بدون رضایت صاحب آن"],
  ];
  probs.forEach(([ic, t], i) => {
    const y = 2.2 + i * 1.05;
    circleIcon(s, I[ic], R - 0.8, y, 0.8, i === 2 ? C.accent1 : C.accent2, `problem ${i + 1}`);
    T(s, t, 7.0, y, 4.8, 0.8, { size: 18, valign: "middle" });
  });
  card(s, 7.0, 5.45, 5.733, 1.15, { fill: C.accent1, transparency: 88, name: "harm card" });
  T(s, "پیامد: آسیب به آرامش روانی، حیثیت و گاه امنیت جانی افراد", 7.2, 5.45, 5.333, 1.15, { size: 18, bold: true, valign: "middle", color: C.text2 });
  card(s, M, 1.55, 5.9, 5.05, { name: "questions card" });
  T(s, "سؤالات پژوهش", M + 0.3, 1.75, 5.3, 0.5, { size: 20, bold: true, color: C.accent2 });
  P(s, [
    { t: "۱. مزاحمت سایبری چیست و چه مصادیقی دارد؟", after: 16 },
    { t: "۲. کدام مقررات حقوق ایران بر آن حاکم است؟", after: 16 },
    { t: "۳. خلأها و چالش‌ها کدام‌اند و چه راهکاری می‌توان پیشنهاد کرد؟", after: 16 },
  ], M + 0.3, 2.45, 5.3, 2.9, { size: 20 });
  badge(s, "روش: توصیفی ـ تحلیلی و کتابخانه‌ای", M + 0.3, 5.55, 5.3, 0.6, C.accent2, C.background1, 16);
  s.addNotes("فضای مجازی بخشی از زندگی روزمره ما شده است، اما همان ویژگی‌هایی که آن را کارآمد کرده، یعنی سرعت، گمنامی و نبود مرز، آن را به بستر مزاحمت هم تبدیل کرده است. سه سؤال اصلی پژوهش را روی اسلاید می‌بینید. روش پژوهش توصیفی ـ تحلیلی و مبتنی بر منابع کتابخانه‌ای است.");

  // ===== 4. Definition =====
  pres.addSection({ title: "مفاهیم و مبانی" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "مفاهیم و مبانی" });
  s.addText("مزاحمت سایبری چیست؟", titleOpts);
  card(s, M, 1.5, CW, 1.6, { fill: C.text2, name: "definition card" });
  s.addImage({ data: Iv.quote, x: R - 0.95, y: 1.75, w: 0.6, h: 0.6, objectName: "quote icon" });
  T(s, "«هر رفتار عمدی که با استفاده از سامانه‌های رایانه‌ای یا مخابراتی، آرامش روانی، امنیت، حیثیت یا حریم خصوصی دیگری را بدون رضایت او مختل کند.»", M + 0.4, 1.6, CW - 1.6, 1.4, { size: 20, color: C.background1, valign: "middle", bold: true });
  const concepts = [
    ["FaCommentSlash", "مزاحمت سایبری", "Cyber Harassment", "مفهوم عام: سلب آسایش دیگری با ابزارهای ارتباطی"],
    ["FaBinoculars", "تعقیب سایبری", "Cyberstalking", "الگوی رفتار مکرر برای ردیابی، کنترل یا ترساندن بزه‌دیده"],
    ["FaUsers", "قلدری سایبری", "Cyberbullying", "آزار میان همسالان، به‌ویژه در میان نوجوانان"],
  ];
  concepts.forEach(([ic, t, en, d], i) => {
    const { x, w } = colX(i, 3, 0.35);
    card(s, x, 3.4, w, 3.25, { name: `concept ${i + 1}` });
    circleIcon(s, I[ic], x + w - 1.1, 3.65, 0.8, [C.accent2, C.accent1, C.accent3][i], `concept ${i + 1}`);
    T(s, t, x + 0.25, 3.65, w - 1.45, 0.55, { size: 21, bold: true, color: C.text2, valign: "middle" });
    EnT(s, en, x + 0.25, 4.2, w - 1.45, 0.35, { align: "right", size: 13, italic: true });
    T(s, d, x + 0.3, 4.75, w - 0.6, 1.6, { size: 17 });
  });
  s.addNotes("قانون‌گذار ایران تعریفی از مزاحمت ارائه نکرده و تشخیص آن را به عرف سپرده است. تعریفی که در مقاله پیشنهاد کرده‌ام روی اسلاید است. سه اصطلاح نزدیک به هم داریم: مزاحمت سایبری به‌عنوان مفهوم عام، تعقیب سایبری که بر تکرار و الگوی رفتاری تکیه دارد، و قلدری سایبری که بیشتر میان نوجوانان مطرح است.");

  // ===== 5. Definitional disagreement (stats) =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "مفاهیم و مبانی" });
  s.addText("حتی تعریف هم محل اختلاف است", titleOpts);
  const stats = [
    ["۳۳", "پژوهش کمّی درباره تعقیب سایبری مرور شده است", C.accent2],
    ["۴۵٪", "حداقل تعداد معینی از تکرار رفتار را شرط دانسته‌اند", C.accent1],
    ["۳۰٪", "ایجاد ترس در بزه‌دیده را معیار قرار داده‌اند", C.accent3],
  ];
  stats.forEach(([n, l, col], i) => {
    const { x, w } = colX(i, 3, 0.35);
    card(s, x, 1.55, w, 2.9, { name: `stat ${i + 1}` });
    T(s, n, x, 1.7, w, 1.4, { align: "center", valign: "middle", size: 60, bold: true, color: col, head: true });
    T(s, l, x + 0.35, 3.2, w - 0.7, 1.1, { align: "center", size: 18 });
  });
  card(s, M, 4.75, CW, 1.55, { fill: C.accent4, transparency: 80, name: "takeaway card" });
  circleIcon(s, I.FaQuestionCircle, R - 1.15, 5.08, 0.9, C.accent4, "takeaway");
  P(s, [
    { t: "پرسش‌های بنیادین برای قانون‌گذار:", bold: true, color: C.text2, after: 4 },
    { t: "آیا یک پیام آزاردهنده کافی است یا تکرار لازم است؟  آیا ترس واقعی بزه‌دیده شرط تحقق جرم است؟" },
  ], M + 0.3, 4.9, CW - 1.8, 1.3, { size: 18, valign: "middle" });
  EnT(s, "Source: Wilson, Sheridan & Garratt-Reed (2022), Journal of Interpersonal Violence", M, 6.45, 8, 0.35, { size: 12 });
  s.addNotes("یک مرور علمی روی ۳۳ پژوهش نشان داده که فقط ۴۵ درصد آن‌ها تکرار رفتار را شرط دانسته‌اند و فقط ۳۰ درصد ترس بزه‌دیده را معیار گذاشته‌اند. یعنی حتی در سطح جهانی تعریف یکسانی وجود ندارد و قانون‌گذار باید به این پرسش‌ها پاسخ روشن بدهد.");

  // ===== 6. Characteristics =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "مفاهیم و مبانی" });
  s.addText("چه چیزی مزاحمت سایبری را متفاوت می‌کند؟", titleOpts);
  const feats = [
    ["FaUserSecret", "گمنامی", "حساب جعلی و ابزارهای پنهان‌سازی هویت"],
    ["FaGlobe", "فرامرزی بودن", "مرتکب، بزه‌دیده و سرور در کشورهای مختلف"],
    ["FaCopy", "ماندگاری", "کپی و بازنشر آسان؛ حذف کامل تقریباً ناممکن"],
    ["FaMobileAlt", "دسترسی دائمی", "گوشی همیشه همراه بزه‌دیده است"],
    ["FaCoins", "هزینه کم", "ابزارهای ارزان و روش‌های بسیار متنوع"],
  ];
  feats.forEach(([ic, t, d], i) => {
    const { x, w } = colX(i, 5, 0.3);
    card(s, x, 1.65, w, 4.6, { name: `feature ${i + 1}` });
    circleIcon(s, I[ic], x + (w - 1.2) / 2, 2.0, 1.2, i % 2 ? C.accent1 : C.accent2, `feature ${i + 1}`);
    T(s, t, x + 0.15, 3.45, w - 0.3, 0.6, { align: "center", size: 21, bold: true, color: C.text2, valign: "middle" });
    T(s, d, x + 0.2, 4.15, w - 0.4, 1.9, { align: "center", size: 17 });
  });
  EnT(s, "See also: Weekes, Storey & Pina (2025), Trauma, Violence, & Abuse", M, 6.45, 8, 0.35, { size: 12 });
  s.addNotes("این پنج ویژگی باعث می‌شود آثار مزاحمت سایبری گاهی از مزاحمت سنتی شدیدتر باشد: مرتکب می‌تواند پنهان بماند، از کشور دیگری عمل کند، محتوای منتشرشده از بین نمی‌رود و مزاحم همیشه به بزه‌دیده دسترسی دارد.");

  // ===== 7. Foundations =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "مفاهیم و مبانی" });
  s.addText("مبانی حمایت از بزه‌دیدگان", titleOpts);
  const found = [
    ["FaLandmark", "اصل ۲۲ قانون اساسی", "حیثیت، جان، مال، حقوق، مسکن و شغل اشخاص از تعرض مصون است"],
    ["FaEnvelopeOpenText", "اصل ۲۵ قانون اساسی", "ممنوعیت تجسس، ضبط و افشای مکالمات و مخابرات جز به حکم قانون"],
    ["FaBalanceScale", "اصل ۴۰ قانون اساسی", "اعمال حق نباید وسیله اضرار به غیر شود؛ آزادی در فضای مجازی مطلق نیست"],
    ["FaBookOpen", "مبانی فقهی", "قاعده لاضرر، حرمت آزار دیگران و نهی از تجسس در زندگی خصوصی"],
  ];
  found.forEach(([ic, t, d], i) => {
    const { x, w } = colX(i % 2, 2, 0.35);
    const y = i < 2 ? 1.6 : 4.15;
    card(s, x, y, w, 2.3, { name: `foundation ${i + 1}` });
    circleIcon(s, I[ic], x + w - 1.2, y + 0.35, 0.9, i === 3 ? C.accent3 : C.accent2, `foundation ${i + 1}`);
    T(s, t, x + 0.3, y + 0.35, w - 1.75, 0.6, { size: 21, bold: true, color: C.text2, valign: "middle" });
    T(s, d, x + 0.3, y + 1.05, w - 1.75, 1.1, { size: 17 });
  });
  s.addNotes("حمایت از بزه‌دیدگان مزاحمت سایبری ریشه در قانون اساسی دارد: اصل ۲۲ درباره مصونیت حیثیت و حقوق افراد، اصل ۲۵ که امروز می‌توان آن را مبنای حمایت از حریم ارتباطات الکترونیکی دانست، و اصل ۴۰ که می‌گوید آزادی نباید وسیله آزار دیگران شود. در فقه هم قاعده لاضرر و حرمت تجسس پشتوانه این حمایت‌اند.");

  // ===== 8. Typology =====
  pres.addSection({ title: "چارچوب قانونی" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "چارچوب قانونی" });
  s.addText("مصادیق رایج و مستند قانونی آن‌ها", titleOpts);
  const types = [
    ["FaSms", "پیام و تماس مکرر", "ماده ۶۴۱"],
    ["FaCommentSlash", "توهین و فحاشی برخط", "ماده ۶۰۸"],
    ["FaExclamationTriangle", "تهدید و اخاذی جنسی", "ماده ۶۶۹"],
    ["FaImage", "انتشار تصاویر خصوصی", "ماده ۷۴۵"],
    ["FaTheaterMasks", "جعل عمیق و تحریف", "ماده ۷۴۴"],
    ["FaBullhorn", "نشر اکاذیب", "ماده ۷۴۶"],
    ["FaUserLock", "هک حساب و شنود", "مواد ۷۲۹ و ۷۳۰"],
    ["FaChild", "اغفال کودکان", "ماده ۱۰ قانون ۱۳۹۹"],
  ];
  types.forEach(([ic, t, a], i) => {
    const { x, w } = colX(i % 4, 4, 0.3);
    const y = i < 4 ? 1.55 : 4.1;
    card(s, x, y, w, 2.3, { name: `type ${i + 1}` });
    circleIcon(s, I[ic], x + w - 0.95, y + 0.3, 0.7, i === 7 ? C.accent3 : C.accent2, `type ${i + 1}`);
    T(s, t, x + 0.2, y + 1.1, w - 0.4, 0.55, { size: 19, bold: true, color: C.text2, valign: "middle" });
    badge(s, a, x + 0.25, y + 1.7, w - 0.5, 0.45, C.accent1, C.background1, 15);
  });
  s.addNotes("در حقوق ایران یک عنوان واحد به نام مزاحمت سایبری نداریم؛ هر رفتار ممکن است زیر یک ماده جداگانه قرار بگیرد. این هشت مصداق رایج‌ترین موارد هستند. شماره‌ها مربوط به کتاب تعزیرات قانون مجازات اسلامی است، جز مورد آخر که در قانون حمایت از اطفال و نوجوانان آمده است.");

  // ===== 9. Article 641 =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "چارچوب قانونی" });
  s.addText("ماده ۶۴۱: مزاحمت تلفنی و مخابراتی", titleOpts);
  card(s, M, 1.5, CW, 1.45, { fill: C.text2, name: "article 641 text" });
  T(s, "«هرگاه کسی به وسیله تلفن یا دستگاه‌های مخابراتی دیگر برای اشخاص ایجاد مزاحمت نماید، علاوه بر اجرای مقررات خاص شرکت مخابرات، مرتکب به حبس از یک تا شش ماه محکوم خواهد شد.»", M + 0.35, 1.55, CW - 0.7, 1.35, { size: 19, color: C.background1, valign: "middle" });
  const pillars = [
    ["FaHandPaper", "رکن مادی", ["ایجاد مزاحمت با فعل مثبت: تماس، پیامک یا پیام", "وسیله: تلفن یا «دستگاه‌های مخابراتی دیگر»", "در رویه، پیام‌رسان‌ها را هم در بر می‌گیرد"]],
    ["FaUserSecret", "رکن معنوی", ["عمد و آگاهی از ناخواسته بودن ارتباط", "پاسخ دادن بزه‌دیده مانع تحقق جرم نیست (نظریه مشورتی ۷/۱۴۰۳/۴۴)"]],
    ["FaGavel", "مجازات و گذشت", ["حبس یک تا شش ماه", "قابل گذشت پس از اصلاح ماده ۱۰۴ (۱۳۹۹)", "حداقل و حداکثر حبس به نصف کاهش می‌یابد"]],
  ];
  pillars.forEach(([ic, t, items], i) => {
    const { x, w } = colX(i, 3, 0.35);
    card(s, x, 3.2, w, 3.45, { name: `pillar ${i + 1}` });
    circleIcon(s, I[ic], x + w - 0.95, 3.4, 0.7, [C.accent2, C.accent2, C.accent1][i], `pillar ${i + 1}`);
    T(s, t, x + 0.25, 3.4, w - 1.3, 0.7, { size: 21, bold: true, color: C.text2, valign: "middle" });
    P(s, items.map((it) => ({ t: it, bullet: true, after: 6 })), x + 0.25, 4.25, w - 0.5, 2.3, { size: 16 });
  });
  s.addNotes("ماده ۶۴۱ اصلی‌ترین ماده برای مزاحمت از طریق تماس و پیام است. این ماده پیش از اینترنت نوشته شده، اما عبارت «دستگاه‌های مخابراتی دیگر» باعث شده در عمل پیامک و پیام‌رسان‌ها را هم شامل شود. طبق نظریه مشورتی سال ۱۴۰۳، اگر بزه‌دیده به پیام‌ها جواب داده باشد، باز هم جرم محقق است. از سال ۱۳۹۹ این جرم قابل گذشت شده است.");

  // ===== 10. Computer Crimes Law =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "چارچوب قانونی" });
  s.addText("قانون جرائم رایانه‌ای (۱۳۸۸): مواد کلیدی", titleOpts);
  const ccl = [
    ["۷۴۴", "تحریف و انتشار تصویر، صدا یا فیلم دیگری", "هتک حیثیت عرفی؛ در صورت مستهجن بودن، حداکثر هر دو مجازات (مرتبط با جعل عمیق)"],
    ["۷۴۵", "انتشار محتوای خصوصی بدون رضایت", "ملاک، رضایت به «انتشار» است نه «تهیه»؛ ورود ضرر یا هتک حیثیت لازم است"],
    ["۷۴۶", "نشر اکاذیب رایانه‌ای", "با قصد اضرار به غیر یا تشویش اذهان؛ همراه با اعاده حیثیت"],
    ["۷۲۹ و ۷۳۰", "دسترسی غیرمجاز و شنود", "هک حساب کاربری و نصب پنهانی نرم‌افزار جاسوسی"],
    ["۷۴۲", "محتوای مستهجن", "ارسال برای کمتر از ده نفر: فقط جزای نقدی (تبصره ۲)"],
  ];
  ccl.forEach(([n, t, d], i) => {
    const y = 1.5 + i * 0.92;
    card(s, M, y, CW, 0.8, { name: `ccl row ${i + 1}` });
    badge(s, n, R - 1.85, y + 0.12, 1.65, 0.56, i === 1 ? C.accent1 : C.accent2, C.background1, 18);
    T(s, t, R - 6.35, y, 4.35, 0.8, { size: 18, bold: true, color: C.text2, valign: "middle" });
    T(s, d, M + 0.25, y, 5.6, 0.8, { size: 15, valign: "middle" });
  });
  card(s, M, 6.15, CW, 0.62, { fill: C.accent4, transparency: 75, name: "penalty note" });
  T(s, "مجازات مواد ۷۴۴ تا ۷۴۶: حبس از ۹۱ روز تا ۲ سال یا جزای نقدی یا هر دو", M + 0.3, 6.15, CW - 0.6, 0.62, { size: 17, bold: true, valign: "middle", color: C.text2 });
  s.addNotes("قانون جرائم رایانه‌ای مهم‌ترین قانون ویژه است و موادش به کتاب تعزیرات اضافه شده. ماده ۷۴۴ برای تصاویر دست‌کاری‌شده و جعل عمیق مهم است. ماده ۷۴۵ همان چیزی است که در مورد انتشار انتقام‌جویانه تصاویر خصوصی استفاده می‌شود؛ نکته مهم این است که حتی اگر عکس با رضایت گرفته شده باشد، انتشار بدون رضایت جرم است. توجه کنید که ارسال محتوای مستهجن برای کمتر از ده نفر فقط جزای نقدی دارد.");

  // ===== 11. Other offences =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "چارچوب قانونی" });
  s.addText("سایر جرائم مرتبط در کتاب تعزیرات", titleOpts);
  const other = [
    ["FaCommentSlash", "توهین", "ماده ۶۰۸", "فحاشی و الفاظ رکیک؛ پس از ۱۳۹۹ جزای نقدی درجه شش"],
    ["FaExclamationTriangle", "تهدید", "ماده ۶۶۹", "تهدید «به هر نحو»؛ شامل اخاذی با تهدید به انتشار تصاویر"],
    ["FaBullhorn", "افترا و نشر اکاذیب", "مواد ۶۹۷، ۶۹۸ و ۷۰۰", "و نیز هجو (۷۰۰)؛ در ارتکاب رایانه‌ای، ماده ۷۴۶ مقرره خاص است"],
  ];
  other.forEach(([ic, t, a, d], i) => {
    const { x, w } = colX(i, 3, 0.35);
    card(s, x, 1.55, w, 2.75, { name: `offence ${i + 1}` });
    circleIcon(s, I[ic], x + w - 0.95, 1.8, 0.7, C.accent2, `offence ${i + 1}`);
    T(s, t, x + 0.25, 1.8, w - 1.3, 0.7, { size: 20, bold: true, color: C.text2, valign: "middle" });
    badge(s, a, x + w - 2.95, 2.65, 2.7, 0.45, C.accent1, C.background1, 15);
    T(s, d, x + 0.25, 3.25, w - 0.5, 0.95, { size: 16 });
  });
  const limits = [
    ["FaBan", "ماده ۶۱۹ قابل تسری نیست", "این ماده به «اماکن عمومی یا معابر» محدود است و اصل تفسیر مضیق اجازه گسترش آن به فضای مجازی را نمی‌دهد."],
    ["FaBalanceScaleLeft", "نقد استناد به ماده ۶۳۷", "اعمال «رابطه نامشروع» بر تبادل پیام و تصویر مجازی محل انتقاد است؛ ماده ۱۴ ق.ج.ر. مناسب‌تر دانسته شده."],
  ];
  limits.forEach(([ic, t, d], i) => {
    const { x, w } = colX(i, 2, 0.35);
    card(s, x, 4.55, w, 1.85, { fill: C.accent1, transparency: 88, name: `limit ${i + 1}` });
    circleIcon(s, I[ic], x + w - 0.95, 4.75, 0.7, C.accent1, `limit ${i + 1}`);
    T(s, t, x + 0.25, 4.72, w - 1.3, 0.6, { size: 19, bold: true, color: C.text2, valign: "middle" });
    T(s, d, x + 0.25, 5.5, w - 0.5, 0.85, { size: 15 });
  });
  EnT(s, "Ghiasi & Saghafi (2021)", M, 6.45, 4, 0.35, { size: 12 });
  s.addNotes("جرائم عمومی مثل توهین، تهدید و افترا چون «به هر وسیله» قابل ارتکاب‌اند، در فضای مجازی هم اعمال می‌شوند. در مقابل، ماده ۶۱۹ درباره مزاحمت زنان و اطفال فقط مربوط به اماکن عمومی و معابر است و به فضای مجازی تسری پیدا نمی‌کند. همچنین برخی دادگاه‌ها پیام‌های مجازی را رابطه نامشروع دانسته‌اند که پژوهشگران آن را نقد کرده‌اند.");

  // ===== 12. Children & women =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "چارچوب قانونی" });
  s.addText("حمایت ویژه از کودکان و زنان", titleOpts);
  const groups = [
    ["FaChild", "کودکان و نوجوانان", "قانون حمایت از اطفال و نوجوانان (۱۳۹۹)", C.accent3, [
      "ارتباط در فضای مجازی به منظور آزار جنسی: مجازات درجه شش",
      "ارائه محتوای مستهجن یا مبتذل به طفل و نوجوان: جرم",
      "صلاحیت دادگاه‌های ایران بدون توجه به تابعیت (ماده ۶۶۴ ق.آ.د.ک.)",
      "نقد: سیاست جنایی پراکنده؛ پیشنهاد عنوان مجرمانه مستقل",
    ]],
    ["FaFemale", "زنان", "لایحه پیشگیری از آسیب‌دیدگی زنان و ارتقای امنیت آنان", C.accent1, [
      "تصویب کلیات در مجلس: فروردین ۱۴۰۲",
      "جرم‌انگاری ارسال پیام یا تصویر مستهجن یا مبتذل بدون رضایت (جزای نقدی)",
      "تا آبان ۱۴۰۵ هنوز به قانون تبدیل نشده است",
      "فعلاً باید به مقررات عمومی استناد کرد",
    ]],
  ];
  groups.forEach(([ic, t, sub, col, items], i) => {
    const { x, w } = colX(i, 2, 0.35);
    card(s, x, 1.55, w, 4.75, { name: `group ${i + 1}` });
    circleIcon(s, I[ic], x + w - 1.25, 1.8, 0.95, col, `group ${i + 1}`);
    T(s, t, x + 0.3, 1.8, w - 1.75, 0.55, { size: 22, bold: true, color: C.text2, valign: "middle" });
    T(s, sub, x + 0.3, 2.35, w - 1.75, 0.65, { size: 15, color: C.accent2, bold: true });
    P(s, items.map((it) => ({ t: it, bullet: true, after: 8 })), x + 0.3, 3.15, w - 0.6, 3.0, { size: 17 });
  });
  EnT(s, "عیاده‌پور و کلانتری (۱۴۰۳)", M, 6.45, 4, 0.35, { size: 12 });
  s.addNotes("قانون حمایت از اطفال و نوجوانان در سال ۱۳۹۹ گام مهمی برداشت و برقراری ارتباط مجازی با کودک برای آزار جنسی را جرم دانست. اما برای زنان هنوز قانون ویژه‌ای نداریم: لایحه حمایت از زنان در سال ۱۴۰۲ کلیاتش تصویب شد اما تا امروز قانون نشده است.");

  // ===== 13. Procedure & remedies =====
  pres.addSection({ title: "دادرسی و تطبیق" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "دادرسی و تطبیق" });
  s.addText("مسیر پیگیری حقوقی برای بزه‌دیده", titleOpts);
  const steps = [
    ["FaFolderOpen", "حفظ ادله", "پیام‌ها را پاک نکنید؛ با نام کاربری و تاریخ تصویر بگیرید"],
    ["FaFlag", "گزارش", "به پلیس فتا و به خود سکوی ارتباطی"],
    ["FaFileSignature", "شکوائیه", "ثبت در دفاتر خدمات الکترونیک قضایی"],
    ["FaMoneyBillWave", "مطالبه خسارت", "مادی و معنوی، همراه با شکایت کیفری"],
    ["FaBan", "مقابله به مثل نکنید", "تهدید یا انتشار متقابل خود جرم است"],
  ];
  steps.forEach(([ic, t, d], i) => {
    const { x, w } = colX(i, 5, 0.25);
    circleIcon(s, I[ic], x + (w - 0.95) / 2, 1.55, 0.95, i === 4 ? C.accent1 : C.accent2, `step ${i + 1}`);
    if (i < 4) {
      // arrow from this step's circle to the next step (which sits to the left)
      const next = colX(i + 1, 5, 0.25);
      const fromX = x + w / 2 - 0.475 - 0.12;
      const toX = next.x + next.w / 2 + 0.475 + 0.12;
      s.addShape(pres.shapes.LINE, { x: toX, y: 2.025, w: fromX - toX, h: 0, line: { color: C.accent5, width: 1.5, beginArrowType: "triangle" }, objectName: `arrow ${i + 1}` });
    }
    T(s, `${digits[i]}. ${t}`, x, 2.6, w, 0.5, { align: "center", size: 18, bold: true, color: C.text2 });
    T(s, d, x + 0.1, 3.1, w - 0.2, 1.05, { align: "center", size: 15 });
  });
  const proc = [
    ["FaSearch", "ادله الکترونیکی", "اسکرین‌شات به‌تنهایی کافی نیست؛ کارشناسی پلیس فتا و حفظ صحت و تمامیت داده‌ها لازم است"],
    ["FaGavel", "صلاحیت", "ماده ۶۶۴ ق.آ.د.ک.؛ اگر محل وقوع معلوم نباشد، دادسرای محل کشف یا گزارش جرم"],
    ["FaBalanceScale", "جبران خسارت", "مواد ۱ و ۱۰ ق.م.م. و ماده ۱۴ ق.آ.د.ک.: خسارت معنوی، الزام به عذرخواهی و درج حکم"],
  ];
  proc.forEach(([ic, t, d], i) => {
    const { x, w } = colX(i, 3, 0.35);
    card(s, x, 4.45, w, 2.2, { name: `procedure ${i + 1}` });
    circleIcon(s, I[ic], x + w - 0.9, 4.65, 0.65, C.accent3, `procedure ${i + 1}`);
    T(s, t, x + 0.25, 4.65, w - 1.25, 0.65, { size: 19, bold: true, color: C.text2, valign: "middle" });
    T(s, d, x + 0.25, 5.35, w - 0.5, 1.2, { size: 15 });
  });
  s.addNotes("از نظر عملی، مهم‌ترین توصیه به بزه‌دیده این است که ادله را حفظ کند و پیام‌ها را پاک نکند. سپس به پلیس فتا گزارش دهد و از طریق دفاتر خدمات الکترونیک قضایی شکوائیه ثبت کند. می‌تواند همراه شکایت کیفری، خسارت معنوی هم مطالبه کند. نباید مقابله به مثل کند، چون خودش ممکن است مرتکب جرم شود.");

  // ===== 14. Comparative =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "دادرسی و تطبیق" });
  s.addText("نگاه تطبیقی: ایران، انگلستان و سازمان ملل", titleOpts);
  const cellOpt = (o = {}) => ({
    fontFace: FA, fontSize: o.size || 16, rtlMode: true, lang: "fa-IR", align: "right", valign: "middle",
    color: o.color || C.text1, bold: !!o.bold, fill: o.fill ? { color: o.fill } : undefined, margin: [0.06, 0.12, 0.06, 0.12],
  });
  const head = ["موضوع", "حقوق ایران", "حقوق انگلستان", "کنوانسیون ملل متحد (۲۰۲۴)"];
  const rows = [
    ["جرم مستقل مزاحمت یا تعقیب", "ندارد؛ مقررات پراکنده", "دارد (قانون ۱۹۹۷)", "موضوع مستقیم کنوانسیون نیست"],
    ["انتشار غیرتوافقی تصاویر خصوصی", "ماده ۷۴۵", "جرم مستقل (اصلاحات ۲۰۲۳)", "ماده ۱۶"],
    ["ارسال ناخواسته تصاویر جنسی", "تبصره ۲ ماده ۷۴۲ (جزای نقدی)", "جرم مستقل (۲۰۲۳)", "پیش‌بینی خاصی ندارد"],
    ["دستور فوری منع مزاحمت", "سازوکار ویژه‌ای ندارد", "دستور منع مزاحمت", "—"],
  ];
  // columns are reversed so that the first logical column sits on the right (RTL table)
  const tbl = [
    head.slice().reverse().map((h) => ({ text: h, options: cellOpt({ bold: true, color: C.background1, fill: C.text2, size: 17 }) })),
    ...rows.map((r, ri) =>
      r.slice().reverse().map((c, ci) => ({
        text: c,
        options: cellOpt({ bold: ci === 3, fill: ri % 2 ? C.background2 : C.background1, color: ci === 2 ? C.accent2 : C.text1 }),
      }))
    ),
  ];
  s.addTable(tbl, { x: M, y: 1.55, w: CW, colW: [2.95, 2.95, 2.95, 3.283], rowH: 0.78, border: { type: "solid", pt: 0.75, color: HEX.accent6 }, objectName: "comparison table" });
  card(s, M, 5.65, CW, 0.95, { fill: C.accent3, transparency: 85, name: "comparison takeaway" });
  circleIcon(s, I.FaSyncAlt, R - 0.9, 5.8, 0.65, C.accent3, "comparison takeaway");
  T(s, "وجه مشترک نظام‌های پیشرو: توجه به «الگوی رفتاری مکرر» و «اثر آن بر بزه‌دیده»؛ حقوق ایران بیشتر بر رفتارهای منفرد تمرکز دارد.", M + 0.3, 5.65, CW - 1.5, 0.95, { size: 17, bold: true, valign: "middle", color: C.text2 });
  s.addNotes("در انگلستان از سال ۱۹۹۷ قانون مستقل مزاحمت وجود دارد که بر الگوی رفتاری، یعنی دست‌کم دو رفتار، تکیه دارد و دادگاه می‌تواند دستور منع مزاحمت صادر کند. قانون ایمنی برخط ۲۰۲۳ هم ارسال ناخواسته تصاویر جنسی را جرم مستقل کرده است. کنوانسیون سازمان ملل که در دسامبر ۲۰۲۴ تصویب شد، در ماده ۱۶ انتشار غیرتوافقی تصاویر خصوصی را جرم‌انگاری کرده است. ایران عضو کنوانسیون بوداپست نیست.");

  // ===== 15. Challenges =====
  pres.addSection({ title: "جمع‌بندی" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "جمع‌بندی" });
  s.addText("خلأها و چالش‌های حقوق ایران", titleOpts);
  const ch = [
    ["FaPuzzlePiece", "پراکندگی مقررات", "نبود عنوان مستقل؛ قوانین ۱۳۷۵، ۱۳۸۸ و ۱۳۹۹"],
    ["FaQuestionCircle", "ابهام ماده ۶۴۱", "شمول کامنت، تگ و دنبال کردن آزارنده روشن نیست"],
    ["FaSyncAlt", "الگوی رفتاری", "تعقیب سایبری (رفتار مکرر) جرم‌انگاری نشده است"],
    ["FaBalanceScaleLeft", "عدم تناسب مجازات", "حبس کوتاه ماده ۶۴۱ و جزای نقدی تبصره ۲ ماده ۷۴۲"],
    ["FaRobot", "فناوری‌های نوظهور", "جعل عمیق تمام‌ساختگی و نرم‌افزارهای جاسوسی"],
    ["FaSearch", "اثبات و شناسایی", "حساب جعلی، سکوهای خارجی، همکاری محدود"],
    ["FaEyeSlash", "رقم سیاه", "ترس از آبرو و گزارش نکردن، به‌ویژه زنان و نوجوانان"],
    ["FaShieldAlt", "ضمانت‌های غیرکیفری", "نبود دستور فوری حذف محتوا و منع تماس"],
  ];
  ch.forEach(([ic, t, d], i) => {
    const { x, w } = colX(i % 4, 4, 0.3);
    const y = i < 4 ? 1.55 : 4.15;
    card(s, x, y, w, 2.4, { name: `challenge ${i + 1}` });
    circleIcon(s, I[ic], x + w - 0.95, y + 0.3, 0.7, C.accent1, `challenge ${i + 1}`);
    T(s, digits[i], x + 0.25, y + 0.3, 0.7, 0.7, { size: 26, bold: true, color: C.accent6, head: true, align: "left", valign: "middle" });
    T(s, t, x + 0.2, y + 1.08, w - 0.4, 0.5, { size: 18, bold: true, color: C.text2, valign: "middle" });
    T(s, d, x + 0.2, y + 1.6, w - 0.4, 0.75, { size: 15 });
  });
  s.addNotes("مهم‌ترین چالش، پراکندگی مقررات و نبود عنوان مستقل است. ماده ۶۴۱ برای دوران تلفن نوشته شده و شمول آن بر رفتارهایی مثل کامنت‌گذاری مکرر روشن نیست. تعقیب سایبری به‌عنوان یک الگوی رفتاری جرم‌انگاری نشده و قانون از فناوری‌هایی مثل جعل عمیق عقب مانده است. بسیاری از بزه‌دیدگان هم از ترس آبرو شکایت نمی‌کنند.");

  // ===== 16. Recommendations =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "جمع‌بندی" });
  s.addText("پیشنهادها", titleOpts);
  const rec = [
    ["جرم‌انگاری مستقل", "مزاحمت و تعقیب سایبری با تعریف روشن و کیفیات مشدده"],
    ["به‌روزرسانی مواد موجود", "شمول ۶۴۱ بر پیام‌رسان‌ها؛ گسترش ۷۴۴ به جعل عمیق؛ بازنگری تبصره ۲ ماده ۷۴۲"],
    ["حمایت ویژه از زنان", "تعیین تکلیف لایحه و مقررات خاص مزاحمت جنسی برخط"],
    ["دستور حمایتی فوری", "منع تماس و حذف محتوا پیش از صدور حکم نهایی"],
    ["سکوها و همکاری بین‌المللی", "گزارش‌دهی سریع و بهره‌گیری از کنوانسیون ملل متحد (۲۰۲۴)"],
    ["آموزش و پیشگیری", "آموزش قضات و ضابطان؛ سواد رسانه‌ای و امنیت دیجیتال"],
  ];
  rec.forEach(([t, d], i) => {
    const { x, w } = colX(i % 2, 2, 0.35);
    const y = 1.55 + Math.floor(i / 2) * 1.72;
    card(s, x, y, w, 1.5, { name: `recommendation ${i + 1}` });
    circleIcon(s, I.FaCheck, x + w - 0.95, y + 0.4, 0.7, C.accent3, `recommendation ${i + 1}`);
    T(s, t, x + 0.25, y + 0.15, w - 1.35, 0.55, { size: 19, bold: true, color: C.text2, valign: "middle" });
    T(s, d, x + 0.25, y + 0.7, w - 1.35, 0.7, { size: 15 });
  });
  s.addNotes("پیشنهاد اصلی، جرم‌انگاری مستقل مزاحمت و تعقیب سایبری با تعریف روشن است. در کنار آن، مواد موجود باید به‌روز شوند، لایحه حمایت از زنان تعیین تکلیف شود و امکان صدور دستور فوری برای منع تماس و حذف محتوا فراهم شود. آموزش قضات و سواد رسانه‌ای کاربران هم بخش مهمی از پیشگیری است.");

  // ===== 17. Conclusion (dark) =====
  s = pres.addSlide({ masterName: "CLOSING_DARK", sectionTitle: "جمع‌بندی" });
  s.addText("جمع‌بندی", titleOpts);
  T(s, "حقوق ایران برای مقابله با مزاحمت سایبری ابزار کم ندارد؛ مشکل اصلی، پراکندگی و ناهماهنگی این ابزارهاست.", M, 1.75, CW, 1.3, { size: 26, bold: true, color: C.accent4, valign: "middle" });
  const take = [
    ["تعریف", "هر رفتار عمدی با ابزار رایانه‌ای یا مخابراتی که آرامش، امنیت، حیثیت یا حریم دیگری را مختل کند"],
    ["مقررات", "ماده ۶۴۱، قانون جرائم رایانه‌ای، جرائم عمومی تعزیرات و قانون حمایت از اطفال (۱۳۹۹)"],
    ["راهکار", "قانونی منسجم، دقیق و متناسب؛ نه صرفاً تشدید مجازات، با احترام به آزادی بیان و حریم خصوصی"],
  ];
  take.forEach(([t, d], i) => {
    const { x, w } = colX(i, 3, 0.35);
    card(s, x, 3.4, w, 2.75, { fill: C.accent2, name: `takeaway ${i + 1}` });
    T(s, `${digits[i]}. ${t}`, x + 0.3, 3.6, w - 0.6, 0.6, { size: 22, bold: true, color: C.background1, head: true });
    T(s, d, x + 0.3, 4.3, w - 0.6, 2.0, { size: 17, color: C.background1 });
  });
  s.addNotes("در جمع‌بندی، پاسخ سه سؤال پژوهش روی اسلاید است. پیام اصلی من این است که مشکل حقوق ایران کمبود مقررات نیست، بلکه پراکندگی و ناهماهنگی آن‌هاست؛ و راه‌حل، قانونی منسجم و متناسب است که هم از بزه‌دیده حمایت کند و هم آزادی بیان را محترم بشمارد.");

  // ===== 18. References =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "جمع‌بندی" });
  s.addText("منابع کلیدی", titleOpts);
  card(s, 6.85, 1.5, 5.883, 5.15, { name: "persian refs" });
  T(s, "منابع فارسی و قوانین", 7.1, 1.65, 5.4, 0.5, { size: 19, bold: true, color: C.accent2 });
  P(s, [
    { t: "کردعلیوند و میرزایی (۱۳۹۷). گونه‌شناسی جرایم سایبری با نگاهی به قانون جرایم رایانه‌ای و آمار پلیس فتا. مجله حقوقی دادگستری.", bullet: true, after: 8 },
    { t: "عبدی و غنی‌زاده بافقی (۱۴۰۴). تحلیل حقوقی عوامل نقض حق بر تصویر در فضای مجازی.", bullet: true, after: 8 },
    { t: "عیاده‌پور و کلانتری (۱۴۰۳). جرم‌انگاری شکار کودکان و نوجوانان در فضای سایبر در حقوق ایران.", bullet: true, after: 8 },
    { t: "قانون مجازات اسلامی (تعزیرات)، قانون جرائم رایانه‌ای (۱۳۸۸)، قانون آیین دادرسی کیفری (۱۳۹۲)، قانون حمایت از اطفال و نوجوانان (۱۳۹۹).", bullet: true },
  ], 7.1, 2.25, 5.4, 4.3, { size: 15 });
  card(s, M, 1.5, 5.95, 5.15, { name: "english refs" });
  EnT(s, "International sources", M + 0.25, 1.65, 5.45, 0.5, { size: 17, color: C.accent2, align: "left" });
  s.addText([
    { text: "Kaur, P., et al. (2021). A systematic literature review on cyberstalking. Technological Forecasting and Social Change, 163, 120426.", options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: "Wilson, C., Sheridan, L., & Garratt-Reed, D. (2022). What is cyberstalking? A review of measurements. Journal of Interpersonal Violence, 37(11–12).", options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: "Weekes, C. J., Storey, J. E., & Pina, A. (2025). Cyberstalking perpetrators and their methods. Trauma, Violence, & Abuse.", options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: "Ghiasi, J., & Saghafi, P. (2021). Criminal Law and Criminology Modares Quarterly, 1(2). [In Persian]", options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: "United Nations (2024). Convention against Cybercrime.", options: { bullet: true } },
  ], { x: M + 0.25, y: 2.25, w: 5.45, h: 4.3, fontFace: EN, fontSize: 13, color: C.text1, align: "left", valign: "top", isTextBox: true, margin: 0.05, objectName: "english refs text" });
  s.addNotes("فهرست کامل منابع در متن مقاله آمده است؛ این‌ها مهم‌ترین منابعی هستند که در ارائه به آن‌ها استناد کردم.");

  // ===== 19. Thanks =====
  s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "جمع‌بندی" });
  s.addShape(pres.shapes.OVAL, { x: 0.95, y: 1.55, w: 3.3, h: 3.3, fill: { color: C.accent3 }, line: { type: "none" }, objectName: "thanks circle" });
  s.addShape(pres.shapes.OVAL, { x: 0.75, y: 1.35, w: 3.7, h: 3.7, fill: { type: "none" }, line: { color: C.accent6, width: 1.5 }, objectName: "thanks ring" });
  s.addImage({ data: I.FaComments, x: 1.75, y: 2.35, w: 1.7, h: 1.7, objectName: "thanks icon" });
  s.addText("با سپاس از توجه شما", titleOpts);
  s.addText("پرسش و پاسخ", { placeholder: "body", rtlMode: true, lang: "fa-IR", align: "right" });
  T(s, "نگین جوان", 4.7, 4.95, 8.03, 0.5, { color: C.background1, size: 18, bold: true, name: "presenter" });
  s.addNotes("از توجه شما سپاسگزارم. اگر پرسشی هست در خدمتم.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);

  // theme: give Persian (complex-script) text the Persian fonts by default
  const zip = await JSZip.loadAsync(fs.readFileSync(OUT));
  const part = "ppt/theme/theme1.xml";
  let xml = await zip.file(part).async("string");
  xml = xml.replace(/(<a:majorFont>[\s\S]*?)<a:cs typeface="[^"]*"\/>/, `$1<a:cs typeface="${FA_HEAD}"/>`)
    .replace(/(<a:minorFont>[\s\S]*?)<a:cs typeface="[^"]*"\/>/, `$1<a:cs typeface="${FA}"/>`)
    .replace(/(<a:majorFont>[\s\S]*?)<a:font script="Arab" typeface="[^"]*"\/>/, `$1<a:font script="Arab" typeface="${FA_HEAD}"/>`)
    .replace(/(<a:minorFont>[\s\S]*?)<a:font script="Arab" typeface="[^"]*"\/>/, `$1<a:font script="Arab" typeface="${FA}"/>`);
  zip.file(part, xml);
  fs.writeFileSync(OUT, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log("Wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
