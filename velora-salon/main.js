/* Velora — interactions */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
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

  /* ---------- Hero pointer parallax ---------- */
  const hero = $(".hero");
  if (!reduceMotion) {
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      hero.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
  }

  /* ---------- Lines slider: each slide recolors the section ---------- */
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
    slides.forEach((s, i) => s.setAttribute("aria-hidden", String(i !== current)));
  }

  const next = () => goTo(current + 1);
  const prev = () => goTo(current - 1);
  nextBtn.addEventListener("click", next);
  prevBtn.addEventListener("click", prev);

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
    if (e.key === "ArrowLeft") next();
    if (e.key === "ArrowRight") prev();
  });

  goTo(0);

  /* ---------- Price list: picking a service pre-selects it in the form ---------- */
  const serviceSelect = $('select[name="service"]');
  $$(".price-list a").forEach((link) => {
    link.addEventListener("click", () => {
      serviceSelect.value = link.dataset.service;
    });
  });

  /* ---------- Booking form (builds a WhatsApp message; no backend) ---------- */
  const WHATSAPP_NUMBER = "989193220038"; // salon WhatsApp number (09193220038)
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
    status.textContent = "درخواست شما آماده است. برای تأیید نهایی نوبت، آن را در واتساپ ارسال کنید.";
  });

  /* ---------- Custom cursor (fine pointers only) ---------- */
  const cursor = $(".cursor");
  const finePointer = matchMedia("(pointer: fine) and (hover: hover)").matches;

  if (finePointer && !reduceMotion) {
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    window.addEventListener("pointermove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
      cursor.classList.add("is-on");
    });

    const follow = () => {
      cx += (tx - cx) * 0.25;
      cy += (ty - cy) * 0.25;
      cursor.style.transform = `translate(${cx}px, ${cy}px)`;
      requestAnimationFrame(follow);
    };
    follow();

    document.addEventListener("pointerover", (e) => {
      cursor.classList.toggle("is-hover", Boolean(e.target.closest("a, button, .round, [data-prev], [data-next]")));
    });
  }
})();
