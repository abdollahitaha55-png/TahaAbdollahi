/* Velora — interactions */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const toFa = (n) => String(n).padStart(2, "0").replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

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

  // Capture only after a real drag starts, so clicks on links inside a slide still work.
  viewport.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging = true;
    dx = 0;
    startX = e.clientX;
  });

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

  /* ---------- Signature services: expanding panels ---------- */
  const panels = $$(".panel");

  const openPanel = (target) => {
    panels.forEach((p) => {
      const isOpen = p === target;
      p.classList.toggle("is-open", isOpen);
      p.setAttribute("aria-expanded", String(isOpen));
    });
  };

  panels.forEach((panel) => {
    panel.addEventListener("click", (e) => {
      if (e.target.closest(".panel-cta")) return;
      openPanel(panel);
    });
    panel.addEventListener("keydown", (e) => {
      if (e.target !== panel) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPanel(panel);
      }
    });
  });

  // "Book this service" pre-selects the service in the form
  const serviceSelect = $('select[name="service"]');
  $$(".panel-cta").forEach((cta) => {
    cta.addEventListener("click", () => {
      serviceSelect.value = cta.dataset.service;
    });
  });

  /* ---------- Before / after comparison ---------- */
  const compare = $(".compare");
  let pos = 50;
  let comparing = false;

  const setPos = (value) => {
    pos = Math.min(Math.max(value, 0), 100);
    compare.style.setProperty("--pos", `${pos}%`);
    compare.setAttribute("aria-valuenow", String(Math.round(pos)));
  };

  const posFromPointer = (e) => {
    const r = compare.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * 100;
  };

  compare.addEventListener("pointerdown", (e) => {
    comparing = true;
    compare.setPointerCapture(e.pointerId);
    setPos(posFromPointer(e));
  });
  compare.addEventListener("pointermove", (e) => {
    if (comparing) setPos(posFromPointer(e));
  });
  const stopCompare = () => (comparing = false);
  compare.addEventListener("pointerup", stopCompare);
  compare.addEventListener("pointercancel", stopCompare);

  compare.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") setPos(pos + 4);
    if (e.key === "ArrowRight") setPos(pos - 4);
  });
  setPos(pos);

  /* ---------- Testimonials ---------- */
  const voices = $$(".voice");
  const dots = $$(".voice-dots button");
  const voicesSection = $("#voices");
  let voiceIndex = 0;
  let voiceTimer = null;

  const showVoice = (i) => {
    voiceIndex = i;
    voices.forEach((v, k) => v.classList.toggle("is-active", k === i));
    dots.forEach((d, k) => d.setAttribute("aria-selected", String(k === i)));
  };

  const startVoices = () => {
    if (reduceMotion) return;
    clearInterval(voiceTimer);
    voiceTimer = setInterval(() => showVoice((voiceIndex + 1) % voices.length), 6500);
  };

  dots.forEach((dot, k) => {
    dot.addEventListener("click", () => {
      showVoice(k);
      startVoices();
    });
  });
  voicesSection.addEventListener("pointerenter", () => clearInterval(voiceTimer));
  voicesSection.addEventListener("pointerleave", startVoices);

  showVoice(0);
  startVoices();

  /* ---------- Booking form (builds a WhatsApp message; no backend) ---------- */
  const WHATSAPP_NUMBER = "989120000000"; // placeholder: replace with the salon's number
  const form = $("#booking-form");
  const status = $(".form-status");
  const waLink = $(".wa-link");

  const toLatinDigits = (s) => s.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const phone = toLatinDigits(data.phone || "").replace(/\s|-/g, "");

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
      data.time ? `ساعت: ${data.time}` : null,
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
      cursor.classList.toggle("is-hover", Boolean(e.target.closest("a, button, [role='button'], .compare, .round")));
    });
  }
})();
