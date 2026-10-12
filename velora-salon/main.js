/* Velora — interactions */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine) and (hover: hover)").matches;
  const toFa = (n) => String(n).padStart(2, "0").replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  const toLatinDigits = (s) => s.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));

  /* ---------- Header state ---------- */
  const header = $(".site-header");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  $$("[data-reveal]").forEach((el) => io.observe(el));

  /* ---------- Pointer-driven light and hero parallax ---------- */
  const glow = $(".glow");
  const hero = $(".hero");

  if (finePointer && !reduceMotion) {
    window.addEventListener(
      "pointermove",
      (e) => {
        glow.style.setProperty("--gx", `${e.clientX}px`);
        glow.style.setProperty("--gy", `${e.clientY}px`);
      },
      { passive: true }
    );

    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      hero.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
  }

  /* ---------- Lines slider: each slide recolors the section and draws its line-art ---------- */
  const linesSection = $("#lines");
  const viewport = $(".lines-viewport");
  const track = $(".lines-track");
  const slides = $$(".line-slide", track);
  const prevBtn = $("[data-prev]");
  const nextBtn = $("[data-next]");
  const counter = $(".lines-count");
  const progress = $(".lines-progress span");
  let current = 0;

  // In RTL the track starts at the right edge, so moving forward means shifting it right (+).
  const placeTrack = (offsetPx = 0) => {
    track.style.transform = `translateX(calc(${current * 100}% + ${offsetPx}px))`;
  };

  function goTo(index) {
    current = Math.min(Math.max(index, 0), slides.length - 1);
    placeTrack();

    const slide = slides[current];
    linesSection.style.setProperty("--bg", slide.dataset.bg);
    linesSection.style.setProperty("--fg", slide.dataset.fg);
    linesSection.style.setProperty("--accent", slide.dataset.accent);

    counter.textContent = `${toFa(current + 1)} / ${toFa(slides.length)}`;
    progress.style.transform = `scaleX(${(current + 1) / slides.length})`;
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === slides.length - 1;

    slides.forEach((s, i) => {
      const active = i === current;
      s.classList.toggle("is-active", active);
      s.setAttribute("aria-hidden", String(!active));
    });
  }

  nextBtn.addEventListener("click", () => goTo(current + 1));
  prevBtn.addEventListener("click", () => goTo(current - 1));

  // Pointer drag (mouse, touch, pen)
  let dragging = false;
  let startX = 0;
  let dx = 0;

  viewport.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging = true;
    dx = 0;
    startX = e.clientX;
  });

  // Capture only after a real drag starts, so links inside a slide still get clicks.
  viewport.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dx = e.clientX - startX;
    if (Math.abs(dx) < 6) return;
    if (!track.classList.contains("is-dragging")) {
      track.classList.add("is-dragging");
      viewport.setPointerCapture(e.pointerId);
    }
    placeTrack(dx);
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove("is-dragging");
    // Dragging right reveals the slide on the left, which is the next one in RTL.
    if (dx > 60) goTo(current + 1);
    else if (dx < -60) goTo(current - 1);
    else goTo(current);
  };
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);

  // Keyboard: arrow keys follow the visual direction of the track
  viewport.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") goTo(current + 1);
    if (e.key === "ArrowRight") goTo(current - 1);
  });

  goTo(0);

  /* ---------- Picking a service pre-selects it in the form ---------- */
  const serviceSelect = $('select[name="service"]');
  $$("[data-service]").forEach((link) => {
    link.addEventListener("click", () => {
      serviceSelect.value = link.dataset.service;
    });
  });

  /* ---------- Booking form (builds a WhatsApp message; optional endpoint) ---------- */
  const WHATSAPP_NUMBER = "989193220038"; // salon WhatsApp number (09193220038)
  // Optional: set to an HTTPS endpoint (Apps Script, a form service, an API) to store requests.
  // Leave empty to use WhatsApp only.
  const BOOKING_ENDPOINT = "";

  // Per-service WhatsApp buttons open a chat with a prefilled message
  $$("[data-wa-service]").forEach((link) => {
    const text = `سلام، می‌خواهم ${link.dataset.waService} رزرو کنم. لطفاً زمان‌های خالی را اعلام کنید.`;
    link.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  });

  const form = $("#booking-form");
  const status = $(".form-status");
  const waLink = $(".wa-link");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const phone = toLatinDigits(data.phone || "").replace(/[\s-]/g, "");

    if (!data.name?.trim() || !/^09\d{9}$/.test(phone)) {
      status.textContent = "لطفاً نام و شماره موبایل معتبر (۰۹…) را وارد کنید.";
      status.classList.add("is-error");
      waLink.hidden = true;
      return;
    }

    status.classList.remove("is-error");
    const message = [
      "سلام، می‌خواهم نوبت بگیرم.",
      `نام: ${data.name.trim()}`,
      `شماره: ${phone}`,
      `خدمت: ${data.service}`,
      data.date ? `تاریخ: ${data.date}` : null,
      data.note ? `توضیحات: ${data.note.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    waLink.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    waLink.hidden = false;

    if (!BOOKING_ENDPOINT) {
      status.textContent = "درخواست شما آماده است. برای تأیید نهایی نوبت، آن را در واتساپ ارسال کنید.";
      return;
    }

    status.textContent = "در حال ثبت درخواست…";
    fetch(BOOKING_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, phone, message }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(res.status);
        status.textContent = "درخواست شما ثبت شد. برای تأیید سریع‌تر، در واتساپ هم پیام دهید.";
        form.reset();
      })
      .catch(() => {
        status.textContent = "ثبت درخواست انجام نشد. لطفاً از طریق واتساپ پیام دهید.";
        status.classList.add("is-error");
      });
  });
  /* ---------- Morph gallery: original artwork in the Velora palette ---------- */
  const galleryRoot = $("[data-morph]");

  const artCanvas = (w = 1600, h = 1000) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };

  const almond = (g, cx, cy, rx, ry) => {
    g.beginPath();
    g.moveTo(cx, cy - ry);
    g.bezierCurveTo(cx + rx * 1.25, cy - ry * 0.35, cx + rx, cy + ry * 0.85, cx, cy + ry);
    g.bezierCurveTo(cx - rx, cy + ry * 0.85, cx - rx * 1.25, cy - ry * 0.35, cx, cy - ry);
    g.closePath();
  };

  const drawArt = {
    // Strands of hair in soft oxblood and champagne
    hair(c) {
      const g = c.getContext("2d");
      const w = c.width;
      const h = c.height;
      const bg = g.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#2a1219");
      bg.addColorStop(1, "#0d0b0a");
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      for (let k = 0; k < 46; k++) {
        const y0 = -60 + (k * (h + 120)) / 46;
        g.beginPath();
        g.moveTo(-20, y0);
        for (let x = 0; x <= w + 40; x += 40) {
          g.lineTo(x, y0 + Math.sin(x / 260 + k * 0.35) * 110 + Math.sin(x / 90 + k) * 18);
        }
        g.strokeStyle = `rgba(217, 185, 138, ${0.12 + (k % 7) / 30})`;
        g.lineWidth = 1 + (k % 3) * 0.6;
        g.stroke();
      }
    },

    // Almond forms in pale ivory and gold
    nails(c) {
      const g = c.getContext("2d");
      const w = c.width;
      const h = c.height;
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#f3e8d6");
      bg.addColorStop(1, "#d9c3a2");
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      [
        [w * 0.3, h * 0.46, 170, 330, 0.9],
        [w * 0.52, h * 0.52, 150, 300, 0.7],
        [w * 0.72, h * 0.44, 130, 260, 0.5],
      ].forEach(([cx, cy, rx, ry, a]) => {
        almond(g, cx, cy, rx, ry);
        const fill = g.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
        fill.addColorStop(0, `rgba(184, 148, 87, ${0.18 * a})`);
        fill.addColorStop(1, `rgba(140, 106, 54, ${0.32 * a})`);
        g.fillStyle = fill;
        g.fill();
        g.strokeStyle = `rgba(140, 106, 54, ${0.85 * a})`;
        g.lineWidth = 2.2;
        g.stroke();
      });
    },

    // An eye with a fine brow arc, on noir with a champagne glow
    brows(c) {
      const g = c.getContext("2d");
      const w = c.width;
      const h = c.height;
      g.fillStyle = "#0d0b0a";
      g.fillRect(0, 0, w, h);
      const glow = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.45);
      glow.addColorStop(0, "rgba(184, 148, 87, 0.28)");
      glow.addColorStop(1, "rgba(13, 11, 10, 0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);

      // Brow: a row of fine strokes following an arc
      for (let i = 0; i < 120; i++) {
        const t = i / 119;
        const x = w * 0.28 + t * w * 0.44;
        const y = h * 0.36 - Math.sin(t * Math.PI) * h * 0.13 + t * 6;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + 14, y + 26);
        g.strokeStyle = `rgba(243, 226, 191, ${0.35 + t * 0.2})`;
        g.lineWidth = 2.2;
        g.stroke();
      }

      // Eye: almond outline with an iris
      almond(g, w / 2, h * 0.6, 300, 120);
      g.strokeStyle = "rgba(217, 185, 138, 0.9)";
      g.lineWidth = 2.5;
      g.stroke();
      g.beginPath();
      g.arc(w / 2, h * 0.6, 58, 0, Math.PI * 2);
      g.fillStyle = "rgba(184, 148, 87, 0.5)";
      g.fill();
      g.beginPath();
      g.arc(w / 2, h * 0.6, 22, 0, Math.PI * 2);
      g.fillStyle = "#0d0b0a";
      g.fill();

      // Lashes along the upper lid
      for (let i = 0; i < 24; i++) {
        const t = (i + 1) / 25;
        const x = w / 2 - 300 + t * 600;
        const y = h * 0.6 - Math.sin(t * Math.PI) * 120 * 0.9;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - 6 + t * 12, y - 34);
        g.strokeStyle = "rgba(217, 185, 138, 0.8)";
        g.lineWidth = 2;
        g.stroke();
      }
    },

    // The wordmark on a champagne-to-noir gradient
    brand(c) {
      const g = c.getContext("2d");
      const w = c.width;
      const h = c.height;
      const bg = g.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#8c6a36");
      bg.addColorStop(0.35, "#f3e2bf");
      bg.addColorStop(0.6, "#b89457");
      bg.addColorStop(1, "#0d0b0a");
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(13, 11, 10, 0.35)";
      g.lineWidth = 2;
      g.strokeRect(60, 60, w - 120, h - 120);
      g.fillStyle = "rgba(13, 11, 10, 0.88)";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = "italic 300 240px Georgia, serif";
      g.fillText("VELORA", w / 2, h / 2 - 20);
      g.font = "300 44px Georgia, serif";
      g.fillText("ولورا", w / 2, h / 2 + 170);
    },
  };

  const makeThumb = (source) => {
    const t = document.createElement("canvas");
    t.width = 240;
    t.height = 150;
    t.getContext("2d").drawImage(source, 0, 0, t.width, t.height);
    return t.toDataURL("image/jpeg", 0.85);
  };

  const ARTWORK = [
    { kind: "hair", title: "مو", sub: "رنگ ریشه، رنگ‌ساژ و کوتاهی", alt: "طرح گرافیکی موهای بلند" },
    { kind: "nails", title: "ناخن", sub: "کاشت، ترمیم و ژلیش پا", alt: "طرح گرافیکی فرم ناخن بادامی" },
    { kind: "brows", title: "ابرو و مژه", sub: "فیبروز ابرو، اصلاح و مژه موقت", alt: "طرح گرافیکی چشم و ابرو" },
    { kind: "brand", title: "ولورا", sub: "تخفیف ویژه به مدت محدود", alt: "نشان ولورا" },
  ];

  if (galleryRoot && window.MorphGallery) {
    const items = ARTWORK.map((a) => {
      const source = artCanvas();
      drawArt[a.kind](source);
      return { source, alt: a.alt, title: a.title, sub: a.sub, thumb: makeThumb(source) };
    });

    const num = $(".morph-num", galleryRoot);
    const title = $(".morph-title", galleryRoot);
    const sub = $(".morph-sub", galleryRoot);
    const thumbList = $(".morph-thumbs", galleryRoot);

    items.forEach((item, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", "نمایش " + item.title);
      const img = document.createElement("img");
      img.src = item.thumb;
      img.alt = "";
      btn.appendChild(img);
      btn.addEventListener("click", () => gallery.go(i));
      li.appendChild(btn);
      thumbList.appendChild(li);
    });

    const render = (index) => {
      const item = items[index];
      num.textContent = `${toFa(index + 1)} / ${toFa(items.length)}`;
      title.textContent = item.title;
      sub.textContent = item.sub;
      $$("button", thumbList).forEach((b, i) => b.setAttribute("aria-current", String(i === index)));
    };

    const gallery = window.MorphGallery.create(galleryRoot, items, {
      autoplay: 5000,
      duration: 1500,
      onChange: render,
    });
    render(gallery.index);

    $(".morph-prev", galleryRoot).addEventListener("click", () => gallery.go(gallery.index - 1));
    $(".morph-next", galleryRoot).addEventListener("click", () => gallery.go(gallery.index + 1));
  }
})();
