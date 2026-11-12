// Home: strings. The name and the three doors (music / education / design) are real HTML
// that ride four tuned strings. Strum across them; tap a word to go there; grab and pull to bend.
const SEG = 60;
let strings = [], prev = null, held = null, downAt = null, moved = false, ready = false;
// Colour rule: each gesture that plays the strings (a strum, a tap, a bend) steps to the next colour once,
// when you let go. Hover plucks and keyboard focus never change it.
let played = false;
// Dm9 voicing, top string highest: E4 F3 A2 D2.
const TUNING = [329.63, 174.61, 110.0, 73.42];

function setup() {
  const c = createCanvas(windowWidth, windowHeight);
  c.elt.setAttribute("aria-hidden", "true");
  chrome("strings", { hint: null }); // no instructions: the top string shows you (see hintPluck)
  // Fonts must be loaded before glyphs are measured.
  document.fonts.ready.then(() => { build(); ready = true; document.body.classList.add("live"); scheduleHints(); });
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); if (ready) build(); }

function x0() { return width * 0.08; }
function x1() { return width * 0.92; }

// Split each element's text into positioned glyph spans (once), then measure them.
function glyphsFor(el) {
  if (!el.dataset.split) {
    const text = el.textContent; el.textContent = ""; el.setAttribute("aria-label", text); el.dataset.split = "1";
    for (const ch of text) { const g = document.createElement("span"); g.className = "glyph"; g.textContent = ch; g.setAttribute("aria-hidden", "true"); el.appendChild(g); }
  }
  return [...el.children].map((g) => { g.style.transform = "none"; const r = g.getBoundingClientRect(); return { el: g, w: r.width, h: r.height }; });
}

function build() {
  const els = [document.querySelector(".home h1"), ...document.querySelectorAll(".home .doors a")];
  const top = height * 0.2, bottom = height * 0.74;
  strings = els.map((el, i) => {
    const old = strings[i];
    const s = { el, name: i === 0, link: el.tagName === "A", y: map(i, 0, els.length - 1, top, bottom), freq: TUNING[i],
      u: old ? old.u : new Float32Array(SEG + 1), v: old ? old.v : new Float32Array(SEG + 1), glow: 0, hover: false };
    s.glyphs = glyphsFor(el); s.tw = s.glyphs.reduce((t, g) => t + g.w, 0);
    if (!el.dataset.wired) wire(s, i);
    return s;
  });
}

// Links: a tap plucks (in mouseReleased) and then follows the link after the note has started.
// A drag or bend never navigates. Cmd/ctrl/shift-click and keyboard Enter behave like normal links.
function wire(s, i) {
  const el = s.el; el.dataset.wired = "1";
  el.addEventListener("pointerenter", () => (strings[i].hover = true));
  el.addEventListener("pointerleave", () => (strings[i].hover = false));
  if (!s.link) return;
  el.addEventListener("focus", () => { strings[i].hover = true; if (Audio.ctx && el.matches(":focus-visible")) pluck(strings[i], 0.5, 14, 1, 0.3); }); // keyboard focus only
  el.addEventListener("blur", () => (strings[i].hover = false));
  el.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    if (moved && e.detail !== 0) return; // it was a strum or bend, not a tap
    if (e.detail === 0) pluck(strings[i], 0.5, 30, 1); // keyboard activation
    setTimeout(() => (location.href = el.href), 340);
  });
}

function draw() {
  background(theme().bg);
  if (!ready) return;
  for (const s of strings) {
    // Damped wave equation on SEG segments, pinned ends.
    for (let k = 0; k < 3; k++) {
      for (let i = 1; i < SEG; i++) s.v[i] += 0.45 * (s.u[i - 1] + s.u[i + 1] - 2 * s.u[i]);
      for (let i = 1; i < SEG; i++) { s.v[i] *= 0.994; s.u[i] += s.v[i] * 0.33; }
    }
    if (held && held.s === s) bendTo(s, ptr.x, ptr.y);
    s.glow *= 0.92;
    drawString(s);
  }
}

function bendTo(s, mx, my) {
  const t = constrain((mx - x0()) / (x1() - x0()), 0.02, 0.98);
  const pull = constrain(my - held.y0, -90, 90); // relative to where it was grabbed, so a tap doesn't jump
  for (let i = 0; i <= SEG; i++) {
    const p = i / SEG;
    s.u[i] = pull * (p < t ? p / t : (1 - p) / (1 - t)); s.v[i] = 0;
  }
  held.t = t; held.pull = pull;
}

function uAt(s, x) {
  const segW = (x1() - x0()) / SEG, f = constrain((x - x0()) / segW, 0, SEG), k = floor(f), fr = f - k;
  return s.u[k] * (1 - fr) + (s.u[min(SEG, k + 1)] || 0) * fr;
}

// Hint by doing, not telling. The top string plucks itself and shimmers once after load (silently:
// browsers block sound until the first tap), once more if nobody has touched the page after a while,
// and audibly on a first tap that didn't land on a string, so that tap makes a sound.
let engaged = false;
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
function hintPluck(audible) {
  const s = strings[0]; if (!s) return;
  if (!calm) for (let i = 1; i < SEG; i++) { const p = i / SEG, t = 0.32; s.v[i] += 2.2 * (p < t ? p / t : (1 - p) / (1 - t)); }
  s.shimmer = 1;
  if (audible) Audio.pluck(s.freq, 0.3, 0.6, 0.45);
}
function scheduleHints() {
  setTimeout(() => { if (!engaged) hintPluck(false); }, 900);
  setTimeout(() => { if (!engaged) hintPluck(false); }, 9000);
}
window.addEventListener("keydown", () => (engaged = true));

function drawString(s) {
  s.shimmer = (s.shimmer || 0) * 0.978;
  const sh = s.shimmer > 0.01 ? s.shimmer : 0;
  const a = x0(), b = x1(), segW = (b - a) / SEG, lit = (s.hover ? 0.35 : 0) + sh * 0.6 * (0.5 + 0.5 * Math.sin(millis() / 60));
  // The string (canvas).
  noFill(); stroke(theme().fg); strokeWeight(1 + (s.glow + lit) * 1.5); drawingContext.globalAlpha = 0.45 + min(0.55, (s.glow + lit) * 0.5);
  beginShape(); for (let i = 0; i <= SEG; i++) vertex(a + i * segW, s.y + s.u[i]); endShape();
  drawingContext.globalAlpha = 1;
  // The words (HTML), riding just above the string.
  const gap = s.name ? 10 : 7, scale = 1 + s.glow * 0.08;
  let x = (a + b) / 2 - s.tw / 2, gi = 0;
  for (const g of s.glyphs) {
    // shimmer: a soft band of light running along the word
    g.el.style.opacity = sh ? (1 - sh * 0.55 * (0.5 + 0.5 * Math.sin(millis() / 110 - gi * 0.7))).toFixed(3) : "";
    gi++;
    const cx = x + g.w / 2, slope = (uAt(s, cx + 2) - uAt(s, cx - 2)) / 4;
    const y = s.y + uAt(s, cx) - gap - g.h;
    g.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${atan(slope).toFixed(3)}rad) scale(${scale.toFixed(3)})`;
    x += g.w;
  }
}

function pluck(s, t, strength, dir, vel) {
  const amp = constrain(strength, 8, 60) * dir;
  for (let i = 1; i < SEG; i++) {
    const p = i / SEG; s.v[i] += amp * 0.25 * (p < t ? p / t : (1 - p) / (1 - t)) * 0.4;
  }
  s.glow = 1;
  // Plucking near the middle is darker, near the ends brighter.
  Audio.pluck(s.freq, vel ?? constrain(strength / 40, 0.25, 1), round(map(abs(t - 0.5), 0, 0.5, 0.3, 1) * 10) / 10);
  if (ptr.down) played = true;
}

function crossings(px, py, qx, qy, strength, vel) {
  for (const s of strings) {
    if ((py - s.y) * (qy - s.y) < 0 && qx > x0() && qx < x1()) {
      pluck(s, (qx - x0()) / (x1() - x0()), strength, Math.sign(qy - py), vel);
    }
  }
}

// Pointer events (not p5's mouse/touch handlers) so a tap on a phone is one event, not two.
let ptr = { x: 0, y: 0, down: false };
function onChrome(e) { return e.target.closest && e.target.closest(".set"); }

window.addEventListener("pointerdown", (e) => {
  if (onChrome(e)) return;
  ptr = { x: e.clientX, y: e.clientY, down: true };
  prev = { x: ptr.x, y: ptr.y }; downAt = { x: ptr.x, y: ptr.y }; moved = false;
  const first = !engaged; engaged = true;
  for (const s of strings) {
    if (ptr.y > s.y - (s.name ? 64 : 40) && ptr.y < s.y + 12 && ptr.x > x0() && ptr.x < x1()) { held = { s, y0: ptr.y }; return; }
  }
  if (first) setTimeout(() => hintPluck(true), 40); // first tap missed the strings: answer it with the top string
});

window.addEventListener("pointermove", (e) => {
  const q = { x: e.clientX, y: e.clientY };
  if (ptr.down && prev) {
    if (dist(downAt.x, downAt.y, q.x, q.y) > 8) moved = true;
    if (!held) crossings(prev.x, prev.y, q.x, q.y, dist(prev.x, prev.y, q.x, q.y));
    prev = q;
  } else if (e.pointerType === "mouse" && Audio.ctx && !onChrome(e)) {
    // Desktop, once sound is on: moving across a string plucks it softly, like a harp.
    crossings(ptr.x, ptr.y, q.x, q.y, 14, 0.22);
  }
  ptr.x = q.x; ptr.y = q.y;
});

function release() {
  if (held) {
    const s = held.s, pull = abs(held.pull || 0);
    s.glow = 1;
    if (!moved) pluck(s, held.t ?? 0.5, 30, 1); // a tap plucks; if it was a link, the click handler then navigates
    else if (pull > 4) { Audio.pluck(s.freq, constrain(pull / 70, 0.25, 1), round(map(abs(held.t - 0.5), 0, 0.5, 0.3, 1) * 10) / 10); played = true; }
    held = null;
  }
  if (played) nextTheme();
  played = false; ptr.down = false; prev = null; downAt = null;
}
window.addEventListener("pointerup", release);
window.addEventListener("pointercancel", release);
