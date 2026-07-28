/* ==========================================================================
   GROUP REGISTRATION — SCRIPT
   Lenis smooth scroll + GSAP/ScrollTrigger cinematic motion + form logic
   ========================================================================== */

(() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
     GOOGLE APPS SCRIPT ENDPOINT
     Paste your deployed Web App URL here (ends in /exec).
     ------------------------------------------------------------------ */
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby-5j7pSCmBUa0dlmayjhlmjYwCKD9HrE1uUXfZjp_1XJPrmreDmdc5Abk80Yd2hGvY/exec";

  // Network request timeout, in milliseconds. Prevents the submit button
  // from staying in a loading state forever if the network hangs.
  const REQUEST_TIMEOUT_MS = 15000;

  /* ------------------------------------------------------------------
     LENIS SMOOTH SCROLL
     ------------------------------------------------------------------ */
  let lenis;
  if (!prefersReducedMotion && window.Lenis) {
    lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.2,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // keep GSAP ScrollTrigger in sync with Lenis
    lenis.on("scroll", () => {
      if (window.ScrollTrigger) ScrollTrigger.update();
    });
  }

  /* ------------------------------------------------------------------
     SMOOTH ANCHOR SCROLL (CTA buttons -> #form)
     ------------------------------------------------------------------ */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const targetId = link.getAttribute("href");
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      if (lenis) {
        lenis.scrollTo(target, { offset: -20, duration: 1.4 });
      } else {
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  /* ------------------------------------------------------------------
     GSAP SETUP
     ------------------------------------------------------------------ */
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }

  /* ---------------- Hero entrance: split text + fades ---------------- */
  function playHeroEntrance() {
    if (!window.gsap) return;

    const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

    tl.to(".split-inner", {
      y: "0%",
      duration: 1.1,
      stagger: 0.12,
    }, 0.15);

    tl.from("[data-hero-fade]", {
      opacity: 0,
      y: 18,
      duration: 0.9,
      stagger: 0.12,
      filter: "blur(6px)",
    }, 0.5);
  }

  if (prefersReducedMotion) {
    document.querySelectorAll(".split-inner").forEach((el) => (el.style.transform = "translateY(0%)"));
  } else {
    playHeroEntrance();
  }

  /* ---------------- Hero scroll zoom + parallax ---------------- */
  if (window.gsap && window.ScrollTrigger && !prefersReducedMotion) {
    gsap.to("#hero-content", {
      scale: 1.08,
      opacity: 0.3,
      filter: "blur(4px)",
      ease: "none",
      scrollTrigger: {
        trigger: "#hero",
        start: "top top",
        end: "bottom top",
        scrub: 0.6,
      },
    });

    // Aurora blobs move at different speeds (parallax)
    gsap.to(".blob-a", {
      y: 120,
      ease: "none",
      scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: 1 },
    });
    gsap.to(".blob-b", {
      y: 220,
      ease: "none",
      scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: 1.4 },
    });
    gsap.to(".blob-c", {
      y: 80,
      ease: "none",
      scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: 0.8 },
    });

    /* ---------------- Feature cards: stagger reveal + slide up ---------------- */
    gsap.utils.toArray("#features [data-reveal]").forEach((el, i) => {
      gsap.from(el, {
        y: 60,
        opacity: 0,
        filter: "blur(8px)",
        duration: 1,
        ease: "power3.out",
        delay: i * 0.05,
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none reverse",
        },
      });
    });

    /* ---------------- Form: scale slightly while entering viewport ---------------- */
    gsap.from("#form-card", {
      scale: 0.94,
      opacity: 0,
      y: 40,
      filter: "blur(10px)",
      duration: 1.1,
      ease: "power3.out",
      scrollTrigger: {
        trigger: "#form-card",
        start: "top 85%",
        toggleActions: "play none none reverse",
      },
    });

    /* ---------------- Footer fades upward ---------------- */
    gsap.from("#footer", {
      y: 40,
      opacity: 0,
      duration: 1,
      ease: "power2.out",
      scrollTrigger: {
        trigger: "#footer",
        start: "top 95%",
        toggleActions: "play none none reverse",
      },
    });
  }

  /* ------------------------------------------------------------------
     MOUSE SPOTLIGHT
     ------------------------------------------------------------------ */
  const spotlight = document.getElementById("spotlight");
  if (spotlight && !prefersReducedMotion) {
    window.addEventListener("pointermove", (e) => {
      spotlight.style.setProperty("--x", `${e.clientX}px`);
      spotlight.style.setProperty("--y", `${e.clientY}px`);
    });
  }

  /* ------------------------------------------------------------------
     MOUSE PARALLAX ON HERO
     ------------------------------------------------------------------ */
  const heroSection = document.getElementById("hero");
  if (heroSection && window.gsap && !prefersReducedMotion) {
    heroSection.addEventListener("pointermove", (e) => {
      const { innerWidth: w, innerHeight: h } = window;
      const x = (e.clientX / w - 0.5) * 2;
      const y = (e.clientY / h - 0.5) * 2;
      gsap.to("#hero-content", { x: x * 12, y: y * 8, duration: 0.6, ease: "power2.out" });
      gsap.to(".blob-a", { x: x * -20, y: y * -14, duration: 1, ease: "power2.out" });
      gsap.to(".blob-b", { x: x * 24, y: y * 16, duration: 1.2, ease: "power2.out" });
    });
  }

  /* ------------------------------------------------------------------
     GLASS CARD 3D TILT (feature cards)
     ------------------------------------------------------------------ */
  if (!prefersReducedMotion) {
    document.querySelectorAll(".tilt-card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        const rotX = (py - 0.5) * -8;
        const rotY = (px - 0.5) * 8;
        card.style.transform = `perspective(700px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px)`;
        card.style.setProperty("--mx", `${px * 100}%`);
        card.style.setProperty("--my", `${py * 100}%`);
      });
      card.addEventListener("pointerleave", () => {
        card.style.transform = "perspective(700px) rotateX(0deg) rotateY(0deg) translateY(0)";
      });
    });
  }

  /* ------------------------------------------------------------------
     MAGNETIC BUTTONS
     ------------------------------------------------------------------ */
  if (window.gsap && !prefersReducedMotion) {
    document.querySelectorAll(".magnetic-btn").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        gsap.to(btn, { x: x * 0.25, y: y * 0.35, duration: 0.3, ease: "power2.out" });
      });
      btn.addEventListener("pointerleave", () => {
        gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });
      });
    });
  }

  /* ------------------------------------------------------------------
     RIPPLE CLICK EFFECT
     ------------------------------------------------------------------ */
  document.querySelectorAll(".magnetic-btn").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height);
      ripple.className = "ripple";
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      btn.appendChild(ripple);
      btn.style.position = btn.style.position || "relative";
      btn.style.overflow = "hidden";
      setTimeout(() => ripple.remove(), 700);
    });
  });

  /* ------------------------------------------------------------------
     FORM VALIDATION + SUBMISSION
     ------------------------------------------------------------------ */
  const form = document.getElementById("registration-form");
  const formCard = document.getElementById("form-card");
  const successCard = document.getElementById("success-card");
  const submitBtn = document.getElementById("submit-btn");
  const errorToast = document.getElementById("error-toast");
  const errorToastMessage = document.getElementById("error-toast-message");
  const resetBtn = document.getElementById("reset-btn");

  let isSubmitting = false;

  const fields = [
    { id: "groupName", label: "Group name" },
    { id: "m1name", label: "Member 1 full name" },
    { id: "m1id", label: "Member 1 student ID" },
    { id: "m2name", label: "Member 2 full name" },
    { id: "m2id", label: "Member 2 student ID" },
    { id: "m3name", label: "Member 3 full name" },
    { id: "m3id", label: "Member 3 student ID" },
  ];

  function showFieldError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errorEl = document.getElementById(`err-${fieldId}`);
    if (input) {
      input.classList.add("field-invalid");
      input.setAttribute("aria-invalid", "true");
      // restart shake animation
      input.style.animation = "none";
      requestAnimationFrame(() => (input.style.animation = ""));
    }
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add("visible");
    }
  }

  function clearFieldError(fieldId) {
    const input = document.getElementById(fieldId);
    const errorEl = document.getElementById(`err-${fieldId}`);
    if (input) {
      input.classList.remove("field-invalid");
      input.removeAttribute("aria-invalid");
    }
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.classList.remove("visible");
    }
  }

  // Live-clear errors as the user types
  fields.forEach(({ id }) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener("input", () => {
        if (input.value.trim() !== "") clearFieldError(id);
      });
    }
  });

  function validateForm() {
    let isValid = true;
    let firstInvalidField = null;

    fields.forEach(({ id, label }) => {
      const input = document.getElementById(id);
      const value = input ? input.value.trim() : "";

      if (!value) {
        showFieldError(id, `${label} is required.`);
        isValid = false;
        if (!firstInvalidField) firstInvalidField = input;
      } else {
        clearFieldError(id);
      }
    });

    return { isValid, firstInvalidField };
  }

  function showErrorToast(message) {
    errorToastMessage.textContent = message;
    errorToast.hidden = false;
    requestAnimationFrame(() => errorToast.classList.add("visible"));
    clearTimeout(showErrorToast._t);
    showErrorToast._t = setTimeout(() => {
      errorToast.classList.remove("visible");
      setTimeout(() => (errorToast.hidden = true), 400);
    }, 4200);
  }

  function setLoading(loading) {
    isSubmitting = loading;
    submitBtn.disabled = loading;
    submitBtn.classList.toggle("is-loading", loading);
    submitBtn.setAttribute("aria-busy", loading ? "true" : "false");
  }

  // Builds the FLAT payload shape the backend's validateData() expects:
  // { groupName, member1Name, member1Id, member2Name, member2Id, member3Name, member3Id }
  // (The backend intentionally ignores any extra properties, so this is
  // the cleaner fix vs. reshaping the Apps Script side.)
  function getPayload() {
    return {
      groupName: document.getElementById("groupName").value.trim(),
      member1Name: document.getElementById("m1name").value.trim(),
      member1Id: document.getElementById("m1id").value.trim(),
      member2Name: document.getElementById("m2name").value.trim(),
      member2Id: document.getElementById("m2id").value.trim(),
      member3Name: document.getElementById("m3name").value.trim(),
      member3Id: document.getElementById("m3id").value.trim(),
    };
  }

  // Custom error carrying a user-facing message straight from the backend
  // (or a client-side reason), so the UI can show something specific
  // instead of a generic "something went wrong".
  function makeSubmissionError(reason, userMessage) {
    const err = new Error(userMessage);
    err.reason = reason;
    return err;
  }

  async function submitRegistration(payload) {
    // Guards against a placeholder URL so the demo fails gracefully.
    if (!SCRIPT_URL || SCRIPT_URL === "PASTE_GOOGLE_SCRIPT_URL_HERE") {
      throw makeSubmissionError("NO_ENDPOINT", "Registration endpoint isn't configured yet.");
    }

    // Offline detection — fail fast with a clear message instead of
    // waiting on a doomed network request.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw makeSubmissionError("OFFLINE", "You're offline. Please check your connection and try again.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response;
    try {
      // IMPORTANT — CORS FIX:
      // Google Apps Script Web Apps do not support the CORS preflight
      // (OPTIONS) request that browsers send before a
      // "Content-Type: application/json" fetch. Sending the body as
      // text/plain makes the browser treat this as a "simple request"
      // and skip the preflight entirely — the request goes straight
      // through. The body content is still a JSON string; Code.gs
      // parses it with JSON.parse() exactly as before.
      response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: controller.signal,
        redirect: "follow",
      });
    } catch (networkErr) {
      if (networkErr.name === "AbortError") {
        throw makeSubmissionError("TIMEOUT", "The request timed out. Please try again.");
      }
      throw makeSubmissionError("NETWORK", "Network error. Please check your connection and try again.");
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw makeSubmissionError(`HTTP_${response.status}`, "Server error. Please try again shortly.");
    }

    let result;
    try {
      result = await response.json();
    } catch (parseErr) {
      throw makeSubmissionError("BAD_RESPONSE", "Unexpected server response. Please try again.");
    }

    if (!result || result.success !== true) {
      // Surface the backend's own message (e.g. "Group name already
      // exists.", "Registration deadline has passed.") when available.
      const backendMessage = (result && result.message) || "Registration could not be completed.";
      throw makeSubmissionError("REJECTED", backendMessage);
    }

    return result;
  }

  function playSuccessTransition() {
    if (window.gsap && !prefersReducedMotion) {
      const tl = gsap.timeline();
      tl.to(formCard, {
        opacity: 0,
        y: -20,
        filter: "blur(6px)",
        duration: 0.5,
        ease: "power2.in",
        onComplete: () => {
          formCard.hidden = true;
        },
      });
      tl.set(successCard, { hidden: false, opacity: 0, y: 20, scale: 0.97 });
      tl.to(successCard, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.7,
        ease: "power3.out",
      }, "-=0.1");
    } else {
      formCard.hidden = true;
      successCard.hidden = false;
    }
    fireConfetti();
  }

  function resetToForm() {
    form.reset();
    fields.forEach(({ id }) => clearFieldError(id));

    if (window.gsap && !prefersReducedMotion) {
      const tl = gsap.timeline();
      tl.to(successCard, {
        opacity: 0,
        y: -20,
        duration: 0.4,
        ease: "power2.in",
        onComplete: () => {
          successCard.hidden = true;
        },
      });
      tl.set(formCard, { hidden: false, opacity: 0, y: 20, scale: 0.97 });
      tl.to(formCard, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.6,
        ease: "power3.out",
      }, "-=0.05");
    } else {
      successCard.hidden = true;
      formCard.hidden = false;
    }

    // reset checkmark animation for next success
    const circle = document.querySelector(".check-circle");
    const path = document.querySelector(".check-path");
    if (circle && path) {
      [circle, path].forEach((el) => {
        el.style.animation = "none";
        void el.offsetWidth;
        el.style.animation = "";
      });
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const { isValid, firstInvalidField } = validateForm();
    if (!isValid) {
      showErrorToast("Please fill in all required fields.");
      if (firstInvalidField) {
        firstInvalidField.focus({ preventScroll: false });
      }
      return;
    }

    setLoading(true);

    try {
      const payload = getPayload();
      await submitRegistration(payload);
      setLoading(false);
      playSuccessTransition();
    } catch (err) {
      setLoading(false);
      const message = (err && err.message) || "Couldn't submit your registration. Please try again.";
      showErrorToast(message);
    }
  });

  // Re-check connectivity as it changes so a queued submission doesn't
  // silently hang if the user goes offline mid-session.
  window.addEventListener("offline", () => {
    showErrorToast("You're offline. Registrations will fail until you reconnect.");
  });

  resetBtn.addEventListener("click", resetToForm);

  /* ------------------------------------------------------------------
     CONFETTI CELEBRATION (lightweight canvas particle burst)
     ------------------------------------------------------------------ */
  const confettiCanvas = document.getElementById("confetti-canvas");
  const ctx = confettiCanvas ? confettiCanvas.getContext("2d") : null;

  function resizeConfettiCanvas() {
    if (!confettiCanvas) return;
    confettiCanvas.width = window.innerWidth * devicePixelRatio;
    confettiCanvas.height = window.innerHeight * devicePixelRatio;
    confettiCanvas.style.width = `${window.innerWidth}px`;
    confettiCanvas.style.height = `${window.innerHeight}px`;
  }
  resizeConfettiCanvas();
  window.addEventListener("resize", resizeConfettiCanvas);

  const CONFETTI_COLORS = ["#7C6CFF", "#5EEAD4", "#F472B6", "#F5F5F7"];

  function fireConfetti() {
    if (!ctx || prefersReducedMotion) return;

    const count = 90;
    const particles = Array.from({ length: count }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 9,
      vy: Math.random() * -9 - 4,
      size: Math.random() * 6 + 4,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      shape: Math.random() > 0.5 ? "rect" : "circle",
      opacity: 1,
    }));

    const gravity = 0.28;
    const drag = 0.985;
    let frame = 0;
    const maxFrames = 130;

    function animate() {
      frame++;
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      ctx.save();
      ctx.scale(devicePixelRatio, devicePixelRatio);

      particles.forEach((p) => {
        p.vy += gravity;
        p.vx *= drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        if (frame > maxFrames * 0.6) {
          p.opacity = Math.max(0, p.opacity - 0.04);
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      ctx.restore();

      if (frame < maxFrames) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      }
    }

    requestAnimationFrame(animate);
  }

  /* ------------------------------------------------------------------
     KEYBOARD ACCESSIBILITY: Enter key on non-submit focus shouldn't
     accidentally submit while fields are still empty; native validation
     is disabled via novalidate so we rely on our own handling above.
     ------------------------------------------------------------------ */
})();
