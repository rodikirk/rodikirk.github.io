// Shared bits for the homepage sketches: palette, audio engine, nav.
const BIO = "rodi kirk · producer, dj, film scorer · builds tools that help people learn to play · auckland & berlin · ";
const LINES = ["producer", "dj", "film scorer", "educator"];
// Chosen bio (2026-11-12). Name, then the three doors to the sub pages.
const BIO_LINES = ["rodi kirk", "music", "education", "design"];
const SECTIONS = [
  { word: "music", href: "music/" },
  { word: "education", href: "education/" },
  { word: "design", href: "design/" },
];

// Palette, theme(), nextTheme() live in theme.js (loaded first on every page).

// D minor pentatonic across a few octaves.
const SCALE = [0, 3, 5, 7, 10];
function scaleFreq(step, base = 146.83) { // D3
  const oct = Math.floor(step / SCALE.length);
  const deg = ((step % SCALE.length) + SCALE.length) % SCALE.length;
  return base * Math.pow(2, oct + SCALE[deg] / 12);
}

// ---------- audio ----------
// Browsers only start sound from a gesture: on desktop the mouse press counts, on phones only the
// finger lifting does. So the first strum on a phone happens before audio may run. Notes asked for in
// that gap are kept and replayed, with their rhythm, the moment audio starts: the first gesture still
// sounds, just a beat late on phones.
const WHEN_ARG = { bell: 4, kick: 1, hat: 2, clap: 1, pluck: 4 };
const Audio = {
  ctx: null, out: null, send: null, _missed: [],
  muted: (() => { try { return localStorage.getItem("rk-muted") === "1"; } catch (e) { return false; } })(),
  get running() { return !!this.ctx && this.ctx.state === "running"; },
  get on() { return this.running && !this.muted; },
  unlock() {
    if (!this.ctx) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.out = ctx.createGain(); this.out.gain.value = this.muted ? 0 : 0.8;
      this.out.connect(comp).connect(ctx.destination);
      // Dotted-eighth-ish feedback delay with a darkening filter, as a space send.
      const d = ctx.createDelay(1); d.delayTime.value = 0.33;
      const fb = ctx.createGain(); fb.gain.value = 0.38;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
      this.send = ctx.createGain(); this.send.gain.value = 0.35;
      this.send.connect(d); d.connect(lp).connect(fb).connect(d); lp.connect(this.out);
      ctx.addEventListener("statechange", () => this._started());
      document.getElementById("hint")?.remove();
    }
    if (this.ctx.state !== "running") this.ctx.resume().then(() => this._started()).catch(() => {});
    else this._started();
    return this.ctx;
  },
  _started() { if (this.running) this._replay(); soundSwitch.update(); },
  setMuted(m) {
    this.muted = m; try { localStorage.setItem("rk-muted", m ? "1" : "0"); } catch (e) {}
    if (this.out) this.out.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.02);
    soundSwitch.update();
  },
  // Returns true if the voice must not play now. Immediate notes are kept for _replay.
  _gate(name, args) {
    if (this.running) return false;
    if (args[WHEN_ARG[name]] === undefined) { this._missed.push({ name, args: [...args], t: performance.now() }); if (this._missed.length > 8) this._missed.shift(); }
    return true;
  },
  _replay() {
    const t = performance.now(), recent = this._missed.filter((m) => t - m.t < 1500); this._missed = [];
    if (!recent.length || this.muted) return;
    const t0 = recent[0].t, span = Math.max(1, recent[recent.length - 1].t - t0), squeeze = Math.min(1, 400 / span);
    for (const m of recent) {
      const a = m.args.slice(); a[WHEN_ARG[m.name]] = this.ctx.currentTime + 0.02 + ((m.t - t0) * squeeze) / 1000;
      this[m.name](...a);
    }
  },
  now() { return this.ctx.currentTime; },
  dest(wet = 0.3) {
    const g = this.ctx.createGain(); g.connect(this.out);
    const s = this.ctx.createGain(); s.gain.value = wet; g.connect(s).connect(this.send);
    return g;
  },
  noise(seconds = 1) {
    if (this._noise) return this._noise;
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (this._noise = b);
  },
  // Soft mallet/bell tone: sine + quiet 2.76x partial.
  bell(freq, vel = 0.6, dur = 1.2, wet = 0.35, when) {
    if (!this.ctx || this._gate("bell", arguments)) return; const t = Math.max(this.now(), when || 0), out = this.dest(wet);
    [[1, 1], [2.76, 0.18], [5.4, 0.05]].forEach(([r, a]) => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.frequency.value = freq * r; o.type = "sine";
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * a * 0.5, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur / r);
      o.connect(g).connect(out); o.start(t); o.stop(t + dur);
    });
  },
  kick(vel = 0.9, when) {
    if (!this.ctx || this._gate("kick", arguments)) return; const t = Math.max(this.now(), when || 0), out = this.dest(0.05);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.5);
  },
  hat(vel = 0.4, open = false, when) {
    if (!this.ctx || this._gate("hat", arguments)) return; const t = Math.max(this.now(), when || 0), out = this.dest(0.15);
    const n = this.ctx.createBufferSource(); n.buffer = this.noise();
    const hp = this.ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000;
    const g = this.ctx.createGain(); const len = open ? 0.35 : 0.06;
    g.gain.setValueAtTime(vel * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(hp).connect(g).connect(out); n.start(t); n.stop(t + len + 0.02);
  },
  clap(vel = 0.6, when) {
    if (!this.ctx || this._gate("clap", arguments)) return; const t = Math.max(this.now(), when || 0), out = this.dest(0.4);
    const n = this.ctx.createBufferSource(); n.buffer = this.noise();
    const bp = this.ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1400; bp.Q.value = 0.8;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t);
    [0, 0.011, 0.023].forEach((o) => { g.gain.setValueAtTime(vel, t + o); g.gain.exponentialRampToValueAtTime(0.05, t + o + 0.01); });
    g.gain.setValueAtTime(vel * 0.7, t + 0.033); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    n.connect(bp).connect(g).connect(out); n.start(t); n.stop(t + 0.3);
  },
  // Karplus-Strong pluck, rendered once per (freq, brightness) and cached.
  _plucks: new Map(),
  pluck(freq, vel = 0.7, bright = 0.5, wet = 0.3, when) {
    if (!this.ctx || this._gate("pluck", arguments)) return;
    const key = Math.round(freq) + ":" + bright.toFixed(1);
    let buf = this._plucks.get(key);
    if (!buf) {
      const sr = this.ctx.sampleRate, len = Math.floor(sr * 3);
      buf = this.ctx.createBuffer(1, len, sr); const d = buf.getChannelData(0);
      const N = Math.max(2, Math.round(sr / freq)); const ring = new Float32Array(N);
      for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
      // Brightness: pre-smooth the excitation for darker plucks.
      for (let p = 0; p < Math.round((1 - bright) * 4); p++)
        for (let i = 0; i < N; i++) ring[i] = 0.5 * (ring[i] + ring[(i + 1) % N]);
      const decay = 0.996;
      for (let i = 0, j = 0; i < len; i++, j = (j + 1) % N) {
        const next = ring[(j + 1) % N];
        d[i] = ring[j];
        ring[j] = decay * 0.5 * (ring[j] + next);
      }
      this._plucks.set(key, buf);
    }
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vel * 0.6;
    s.connect(g).connect(this.dest(wet)); s.start(Math.max(this.now(), when || 0));
  },
};

// Start audio from any gesture the browser accepts: mouse press, finger lift, key press.
for (const type of ["pointerdown", "pointerup", "touchend", "keydown"]) window.addEventListener(type, () => Audio.unlock(), { capture: true });
// iPhone: treat the page as media playback, so the silent switch doesn't mute it (Safari 17+).
try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}

// Sound switch at the end of the set bar: says the site makes sound, shows whether it's on, mutes.
const soundSwitch = {
  el: null, shownOn: false,
  mount(parent) {
    const b = document.createElement("button"); b.type = "button"; b.className = "sound";
    b.addEventListener("click", () => {
      if (this.shownOn) Audio.setMuted(true);
      else { Audio.unlock(); Audio.setMuted(false); }
    });
    parent.appendChild(b); this.el = b; this.update();
  },
  update() {
    if (!this.el) return;
    this.shownOn = Audio.on;
    this.el.textContent = this.shownOn ? "● sound on" : "○ sound off";
    this.el.setAttribute("aria-pressed", String(this.shownOn));
  },
};

// The "set": a slow rolling strip of homepage variants along the bottom, like a DJ's running order.
const SET = [
  { id: "strings", label: "strings", href: "index.html" },
  { id: "rings", label: "rings", href: "rings.html" },
  { id: "keys", label: "keys", href: "keys.html" },
  { id: "bounce", label: "bounce", href: "bounce.html" },
  { id: "more", label: "more sketches", href: "sketches.html" },
];
function chrome(name, { hint = "tap anywhere for sound" } = {}) {
  const set = document.createElement("nav");
  set.className = "set"; set.setAttribute("aria-label", "homepage variants");
  const items = SET.map((v, i) =>
    `<a href="${v.href}"${v.id === name ? ' aria-current="page"' : ""}>${String(i + 1).padStart(2, "0")} ${v.label}${v.id === name ? " ◂ now" : ""}</a>`).join("<span>·</span>");
  // Two copies so the CSS loop is seamless; the second is hidden from screen readers.
  set.innerHTML = `<div class="roll"><div>${items}<span>·</span></div><div aria-hidden="true">${items.replaceAll("<a ", '<a tabindex="-1" ')}<span>·</span></div></div>`;
  document.body.appendChild(set);
  soundSwitch.mount(set);
  if (hint) { const h = document.createElement("div"); h.id = "hint"; h.textContent = hint; document.body.appendChild(h); }
  window.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea")) return;
    const i = +e.key - 1; if (SET[i] && name !== "keys") location.href = SET[i].href;
  });
}

// Bio header for keys + bounce: the bio is always in the page (searchable, clickable),
// shown as ghost text that gets inked in one letter per hit.
function bioHeader() {
  const header = document.createElement("header");
  header.className = "bio";
  const href = (h) => (location.protocol === "file:" ? h + "index.html" : h);
  header.innerHTML = `<h1>Rodi Kirk</h1><nav aria-label="sections">${SECTIONS.map((s) => `<a href="${href(s.href)}">${s.word}</a>`).join("")}</nav>`;
  document.body.prepend(header);
  const glyphs = [];
  for (const el of header.querySelectorAll("h1, nav a")) {
    const text = el.textContent; el.textContent = "";
    el.setAttribute("aria-label", text);
    for (const ch of text) {
      const span = document.createElement("span"); span.textContent = ch; span.setAttribute("aria-hidden", "true");
      el.appendChild(span); if (ch !== " ") glyphs.push(span);
    }
  }
  let i = 0;
  return {
    el: header,
    get done() { return i >= glyphs.length; },
    // Ink the next letter; returns it, or null when the bio is complete.
    next() {
      if (i >= glyphs.length) return null;
      const g = glyphs[i++]; g.classList.add("inked");
      g.parentElement.classList.toggle("whole", [...g.parentElement.children].every((c) => c.classList.contains("inked") || c.textContent === " "));
      return g.textContent.toLowerCase();
    },
  };
}

// Local preview only: file:// doesn't serve folder/index.html, so point folder links at it.
if (location.protocol === "file:") document.addEventListener("DOMContentLoaded", () => {
  for (const a of document.querySelectorAll("a[href]")) { const h = a.getAttribute("href"); if (h.endsWith("/")) a.setAttribute("href", h + "index.html"); }
});
