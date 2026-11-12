// Shared bits for the homepage sketches: palette, audio engine, nav.
const BIO = "rodi kirk · producer, dj, film scorer · builds tools that help people learn to play · auckland & berlin · ";
const LINES = ["producer", "dj", "film scorer", "educator"];
// Bio candidates for keys + strings. Lines map to music / education / design.
// Pick with ?bio=N (1-12). Name is always the first line/string.
const BIOS = [
  ["the music", "the method", "the medium"],
  ["listen closely", "pass it on", "build the tools"],
  ["by ear", "by practice", "by design"],
  ["play it", "teach it", "build for it"],
  ["music I make", "music I teach", "tools I design"],
  ["I make music,", "teach people to play,", "and design the tools."],
  ["makes music", "teaches it", "designs the tools"],
  ["make music", "teach music", "design for music"],
  ["music · Blue Note, Tickled", "education · dBs Berlin", "design · Melodics"],
  ["sound", "practice", "tools"],
  ["musician", "educator", "designer"],
  ["music", "education", "design"],
];
const BIO_N = Math.min(BIOS.length, Math.max(1, +new URLSearchParams(location.search).get("bio") || 12)); // 12 = chosen: music / education / design
const BIO_LINES = ["rodi kirk", ...BIOS[BIO_N - 1]];

// Warm, saturated themes. Each bounce/hit steps to the next.
const THEMES = [
  { bg: "#1a1916", fg: "#faf8f4" },
  { bg: "#b4452e", fg: "#faf8f4" },
  { bg: "#e8b23a", fg: "#1a1916" },
  { bg: "#2f5d50", fg: "#faf8f4" },
  { bg: "#2a3fd1", fg: "#faf8f4" },
  { bg: "#f2a7c3", fg: "#2a0d18" },
  { bg: "#faf8f4", fg: "#1a1916" },
];
let themeIndex = 0;
const theme = () => THEMES[themeIndex];
function nextTheme() {
  themeIndex = (themeIndex + 1) % THEMES.length;
  document.body.style.background = theme().bg;
  document.body.style.color = theme().fg;
}

// D minor pentatonic across a few octaves.
const SCALE = [0, 3, 5, 7, 10];
function scaleFreq(step, base = 146.83) { // D3
  const oct = Math.floor(step / SCALE.length);
  const deg = ((step % SCALE.length) + SCALE.length) % SCALE.length;
  return base * Math.pow(2, oct + SCALE[deg] / 12);
}

// ---------- audio ----------
const Audio = {
  ctx: null, out: null, send: null,
  unlock() {
    if (this.ctx) { if (this.ctx.state !== "running") this.ctx.resume(); return this.ctx; }
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.out = ctx.createGain(); this.out.gain.value = 0.8;
    this.out.connect(comp).connect(ctx.destination);
    // Dotted-eighth-ish feedback delay with a darkening filter, as a space send.
    const d = ctx.createDelay(1); d.delayTime.value = 0.33;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
    this.send = ctx.createGain(); this.send.gain.value = 0.35;
    this.send.connect(d); d.connect(lp).connect(fb).connect(d); lp.connect(this.out);
    document.getElementById("hint")?.remove();
    return ctx;
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
  bell(freq, vel = 0.6, dur = 1.2, wet = 0.35) {
    if (!this.ctx) return; const t = this.now(), out = this.dest(wet);
    [[1, 1], [2.76, 0.18], [5.4, 0.05]].forEach(([r, a]) => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.frequency.value = freq * r; o.type = "sine";
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * a * 0.5, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur / r);
      o.connect(g).connect(out); o.start(t); o.stop(t + dur);
    });
  },
  kick(vel = 0.9) {
    if (!this.ctx) return; const t = this.now(), out = this.dest(0.05);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.5);
  },
  hat(vel = 0.4, open = false) {
    if (!this.ctx) return; const t = this.now(), out = this.dest(0.15);
    const n = this.ctx.createBufferSource(); n.buffer = this.noise();
    const hp = this.ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000;
    const g = this.ctx.createGain(); const len = open ? 0.35 : 0.06;
    g.gain.setValueAtTime(vel * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(hp).connect(g).connect(out); n.start(t); n.stop(t + len + 0.02);
  },
  clap(vel = 0.6) {
    if (!this.ctx) return; const t = this.now(), out = this.dest(0.4);
    const n = this.ctx.createBufferSource(); n.buffer = this.noise();
    const bp = this.ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1400; bp.Q.value = 0.8;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t);
    [0, 0.011, 0.023].forEach((o) => { g.gain.setValueAtTime(vel, t + o); g.gain.exponentialRampToValueAtTime(0.05, t + o + 0.01); });
    g.gain.setValueAtTime(vel * 0.7, t + 0.033); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    n.connect(bp).connect(g).connect(out); n.start(t); n.stop(t + 0.3);
  },
  // Karplus-Strong pluck, rendered once per (freq, brightness) and cached.
  _plucks: new Map(),
  pluck(freq, vel = 0.7, bright = 0.5, wet = 0.3) {
    if (!this.ctx) return;
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
    s.connect(g).connect(this.dest(wet)); s.start();
  },
};

// Unlock audio on first touch anywhere; show a small hint until then.
window.addEventListener("pointerdown", () => Audio.unlock(), { capture: true });
window.addEventListener("keydown", () => Audio.unlock(), { capture: true });

function chrome(name) {
  document.body.style.background = theme().bg;
  document.body.style.color = theme().fg;
  const nav = document.createElement("nav");
  const pages = ["bounce", "record", "strings", "orbits", "keys"];
  const q = `?bio=${BIO_N}`, wrap = (n) => ((n - 1 + BIOS.length) % BIOS.length) + 1;
  nav.innerHTML = pages.map((p, i) =>
    `<a href="${p}.html${q}" class="${p === name ? "on" : ""}">${i + 1} ${p}</a>`).join("") +
    `<a href="index.html">all</a>` +
    `<span>bio <a href="?bio=${wrap(BIO_N - 1)}">‹</a> ${BIO_N}/${BIOS.length} <a href="?bio=${wrap(BIO_N + 1)}">›</a></span>`;
  document.body.appendChild(nav);
  const hint = document.createElement("div"); hint.id = "hint"; hint.textContent = "tap anywhere for sound";
  document.body.appendChild(hint);
  window.addEventListener("keydown", (e) => { const i = +e.key - 1; if (pages[i]) location.href = pages[i] + ".html" + q;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") location.search = "?bio=" + wrap(BIO_N + (e.key === "ArrowRight" ? 1 : -1)); });
}
