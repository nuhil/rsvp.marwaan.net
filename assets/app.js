(function () {
  "use strict";

  const cfg = window.RSVP_CONFIG || {};
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const STORAGE_KEY = "marwaan-rsvp-6";

  const start = new Date(cfg.startISO);
  const end = new Date(cfg.endISO);

  // ---------- details from config ----------
  const venue = cfg.venue || {};
  $$("[data-child]").forEach((el) => (el.textContent = cfg.child || el.textContent));
  $("[data-venue-name]").textContent = venue.name || "";
  $("[data-venue-addr]").textContent = venue.address || venue.city || "";
  $("[data-rsvp-by]").textContent = cfg.rsvpBy || "";
  if (!cfg.rsvpBy) $(".form-head p").hidden = true;

  const location = [venue.name, venue.address || venue.city].filter(Boolean).join(", ");
  $("[data-map]").href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(location);

  // ---------- calendar ----------
  const title = `${cfg.child}'s ${ordinal(cfg.age)} Birthday Party 🐯`;
  const details = `Celebrating ${cfg.child}'s ${ordinal(cfg.age)} birthday! RSVP: https://rsvp.marwaan.net`;
  const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  $("[data-gcal]").href =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    "&text=" + encodeURIComponent(title) +
    "&dates=" + stamp(start) + "/" + stamp(end) +
    "&details=" + encodeURIComponent(details) +
    "&location=" + encodeURIComponent(location);

  $("[data-ics]").addEventListener("click", () => {
    const esc = (s) => s.replace(/[\\,;]/g, (m) => "\\" + m);
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//rsvp.marwaan.net//EN", "BEGIN:VEVENT",
      "UID:marwaan-6th-birthday@rsvp.marwaan.net",
      "DTSTAMP:" + stamp(new Date()),
      "DTSTART:" + stamp(start), "DTEND:" + stamp(end),
      "SUMMARY:" + esc(title), "DESCRIPTION:" + esc(details), "LOCATION:" + esc(location),
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:" + esc(title), "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "marwaan-birthday.ics" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // ---------- countdown ----------
  const cd = { d: $("[data-d]"), h: $("[data-h]"), m: $("[data-m]"), s: $("[data-s]") };
  function tick() {
    const now = Date.now();
    let diff = start - now;
    if (diff <= 0) {
      $(".count-label").textContent = now < end ? "The party is happening now! 🎉" : "Thanks for celebrating with us! 🧡";
      $("[data-countdown]").hidden = true;
      return;
    }
    const pad = (n) => String(n).padStart(2, "0");
    cd.d.textContent = Math.floor(diff / 864e5);
    cd.h.textContent = pad(Math.floor((diff % 864e5) / 36e5));
    cd.m.textContent = pad(Math.floor((diff % 36e5) / 6e4));
    cd.s.textContent = pad(Math.floor((diff % 6e4) / 1e3));
    setTimeout(tick, 1000 - (now % 1000));
  }
  tick();

  // ---------- form ----------
  const form = $("#rsvp-form");
  const thanks = $(".thanks");
  const errorBox = $(".form-error");
  const submitBtn = $('button[type="submit"]', form);
  const attendingOnly = $(".attending-only");

  function syncAttending() {
    const v = form.attending.value;
    attendingOnly.hidden = v !== "yes";
  }
  $$('input[name="attending"]').forEach((r) => r.addEventListener("change", syncAttending));

  $$("[data-stepper]").forEach((s) => {
    const input = $("input", s);
    const clamp = (n) => Math.max(+input.min, Math.min(+input.max, isNaN(n) ? 0 : n));
    $("[data-dec]", s).addEventListener("click", () => (input.value = clamp(+input.value - 1)));
    $("[data-inc]", s).addEventListener("click", () => (input.value = clamp(+input.value + 1)));
    input.addEventListener("change", () => (input.value = clamp(parseInt(input.value, 10))));
  });

  $$("input, textarea", form).forEach((el) =>
    el.addEventListener("input", () => el.classList.remove("invalid"))
  );

  // Prefill from a previous RSVP on this device.
  const saved = load();
  if (saved) {
    fill(saved);
    showThanks(saved, true);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const data = collect();
    const problem = validate(data);
    if (problem) return showError(problem);

    if (!cfg.endpoint) {
      return showError("RSVPs aren't open yet — the host still needs to connect the RSVP sheet. Please try again soon!");
    }

    setLoading(true);
    try {
      await send(data);
      save(data);
      showThanks(data, false);
      if (data.attending === "yes") confetti();
    } catch (err) {
      console.error(err);
      showError("Hmm, that didn't go through. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  });

  $("[data-edit]").addEventListener("click", () => {
    thanks.hidden = true;
    form.hidden = false;
    form.name.focus();
  });

  function collect() {
    const f = new FormData(form);
    const get = (k) => String(f.get(k) || "").trim();
    const yes = get("attending") === "yes";
    return {
      attending: get("attending"),
      name: get("name"),
      email: get("email").toLowerCase(),
      phone: get("phone"),
      adults: yes ? parseInt(get("adults"), 10) || 0 : 0,
      kids: yes ? parseInt(get("kids"), 10) || 0 : 0,
      kidNames: yes ? get("kidNames") : "",
      dietary: yes ? get("dietary") : "",
      message: get("message"),
      website: get("website"),
    };
  }

  function validate(d) {
    if (!d.attending) return "Please let us know if you can make it.";
    if (!d.name) return mark("name", "Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return mark("email", "Please enter a valid email address.");
    if (d.attending === "yes" && d.adults + d.kids < 1) return "Please tell us how many guests are coming.";
    return null;
  }

  function mark(name, msg) {
    form[name].classList.add("invalid");
    form[name].focus();
    return msg;
  }

  async function send(data) {
    const body = JSON.stringify({ ...data, userAgent: navigator.userAgent });
    // text/plain keeps this a "simple" request, so no CORS preflight is needed for Apps Script.
    try {
      const res = await fetch(cfg.endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body,
        redirect: "follow",
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Server rejected RSVP");
      return json;
    } catch (err) {
      // Some browsers block reading the redirected response; fall back to an opaque request.
      if (err instanceof TypeError) {
        await fetch(cfg.endpoint, { method: "POST", mode: "no-cors", body });
        return { ok: true };
      }
      throw err;
    }
  }

  function showThanks(d, returning) {
    const first = d.name.split(/\s+/)[0];
    const yes = d.attending === "yes";
    const guests = [plural(d.adults, "adult"), plural(d.kids, "kid")].filter(Boolean).join(" and ");
    $("[data-thanks-title]").textContent = yes ? `Yay, see you there, ${first}!` : `Thanks for letting us know, ${first}`;
    $("[data-thanks-body]").textContent = yes
      ? `${returning ? "You're RSVP'd" : "We've saved your RSVP"} for ${guests}. ${cfg.child} can't wait to celebrate with you! 🐯`
      : `We'll miss you! ${returning ? "Your reply is saved." : "Your reply has been saved."} If plans change, you can update it anytime.`;
    $(".thanks-emoji").textContent = yes ? "🎈" : "💌";
    form.hidden = true;
    thanks.hidden = false;
    if (!returning) thanks.focus();
  }

  function fill(d) {
    ["name", "email", "phone", "kidNames", "dietary", "message"].forEach((k) => (form[k].value = d[k] || ""));
    if (d.attending === "yes") {
      form.adults.value = d.adults;
      form.kids.value = d.kids;
    }
    const radio = $(`input[name="attending"][value="${d.attending}"]`, form);
    if (radio) radio.checked = true;
    syncAttending();
  }

  function setLoading(on) {
    submitBtn.classList.toggle("loading", on);
    $(".btn-label", submitBtn).textContent = on ? "Sending…" : "Send RSVP";
  }
  function showError(msg) { errorBox.textContent = msg; errorBox.hidden = false; }
  function hideError() { errorBox.hidden = true; }

  function save(d) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...d, website: undefined })); } catch (_) {}
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (_) { return null; }
  }

  function plural(n, word) { return n ? `${n} ${word}${n === 1 ? "" : "s"}` : ""; }
  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // ---------- confetti ----------
  function confetti() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = $("#confetti");
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ["#ff7a1a", "#ffc93c", "#ff6fa5", "#8b6cff", "#19b3a6"];
    const pieces = Array.from({ length: 160 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: innerHeight * 0.55,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 16 - 6,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      c: colors[(Math.random() * colors.length) | 0],
    }));
    const t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      pieces.forEach((p) => {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (t - t0 < 3500) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(t0);
  }
})();
