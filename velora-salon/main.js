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

  /* ---------- Price ledger: picking a service pre-selects it in the form ---------- */
  const serviceSelect = $('select[name="service"]');
  $$(".ledger a").forEach((link) => {
    link.addEventListener("click", () => {
      serviceSelect.value = link.dataset.service;
    });
  });

  /* ---------- Booking form (builds a WhatsApp message; optional endpoint) ---------- */
  const WHATSAPP_NUMBER = "989193220038"; // salon WhatsApp number (09193220038)
  // Optional: set to an HTTPS endpoint (Apps Script, a form service, an API) to store requests.
  // Leave empty to use WhatsApp only.
  const BOOKING_ENDPOINT = "";

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
})();
