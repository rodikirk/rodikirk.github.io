// 3. strings: the bio is four strings. Strum across them, grab and pull to bend.
const SEG = 60;
let strings = [], prev = null, held = null;
// Dm9 voicing, top string highest: E4 F3 A2 D2 for name + three lines (E4 C4 F3 A2 D2 if four).
const TUNING = BIO_LINES.length === 4 ? [329.63, 174.61, 110.0, 73.42] : [329.63, 261.63, 174.61, 110.0, 73.42];

function setup() {
  createCanvas(windowWidth, windowHeight);
  chrome("strings");
  textFont("IBM Plex Mono"); textAlign(CENTER, CENTER);
  build();
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); build(); }

function build() {
  strings = BIO_LINES.map((label, i) => {
    const y = map(i, 0, BIO_LINES.length - 1, height * 0.2, height * 0.8);
    return { label, text: label, y, name: i === 0, freq: TUNING[i], u: new Float32Array(SEG + 1), v: new Float32Array(SEG + 1), glow: 0 };
  });
}

function x0() { return width * 0.08; }
function x1() { return width * 0.92; }

function draw() {
  background(theme().bg);
  for (const s of strings) {
    // Damped wave equation on SEG segments, pinned ends.
    for (let k = 0; k < 3; k++) {
      for (let i = 1; i < SEG; i++) s.v[i] += 0.45 * (s.u[i - 1] + s.u[i + 1] - 2 * s.u[i]);
      for (let i = 1; i < SEG; i++) { s.v[i] *= 0.994; s.u[i] += s.v[i] * 0.33; }
    }
    if (held && held.s === s) bendTo(s, mouseX, mouseY);
    s.glow *= 0.92;
    drawString(s);
  }
}

function bendTo(s, mx, my) {
  const t = constrain((mx - x0()) / (x1() - x0()), 0.02, 0.98);
  const pull = constrain(my - s.y, -90, 90);
  for (let i = 0; i <= SEG; i++) {
    const p = i / SEG;
    s.u[i] = pull * (p < t ? p / t : (1 - p) / (1 - t)); s.v[i] = 0;
  }
  held.t = t; held.pull = pull;
}

function drawString(s) {
  const fg = theme().fg; const a = x0(), b = x1(), segW = (b - a) / SEG;
  const uAt = (x) => { const f = constrain((x - a) / segW, 0, SEG), k = floor(f), fr = f - k;
    return s.u[k] * (1 - fr) + (s.u[min(SEG, k + 1)] || 0) * fr; };
  // The string itself.
  noFill(); stroke(fg); strokeWeight(1 + s.glow * 1.5); drawingContext.globalAlpha = 0.45 + s.glow * 0.4;
  beginShape(); for (let i = 0; i <= SEG; i++) vertex(a + i * segW, s.y + s.u[i]); endShape();
  drawingContext.globalAlpha = 1;
  // The bio line, once, centred, riding just above the string.
  noStroke(); fill(fg);
  if (s.name) { textFont("Newsreader"); textSize(40 + s.glow * 4); } else { textFont("IBM Plex Mono"); textSize(17 + s.glow * 2); }
  const lift = s.name ? 22 : 14;
  let tw = 0; for (const c of s.text) tw += textWidth(c);
  let x = (a + b) / 2 - tw / 2;
  for (const c of s.text) {
    const w = textWidth(c), cx = x + w / 2, slope = (uAt(cx + 2) - uAt(cx - 2)) / 4;
    push(); translate(cx, s.y + uAt(cx) - lift); rotate(atan(slope)); text(c, 0, 0); pop();
    x += w;
  }
}

function pluck(s, t, strength, dir) {
  const amp = constrain(strength, 8, 60) * dir;
  for (let i = 1; i < SEG; i++) {
    const p = i / SEG; s.v[i] += amp * 0.25 * (p < t ? p / t : (1 - p) / (1 - t)) * 0.4;
  }
  s.glow = 1;
  // Plucking near the middle is darker, near the ends brighter.
  Audio.pluck(s.freq, constrain(strength / 40, 0.25, 1), round(map(abs(t - 0.5), 0, 0.5, 0.3, 1) * 10) / 10);
  if (random() < 0.15) nextTheme();
}

function mouseDragged() {
  if (!prev || held) return;
  for (const s of strings) {
    if ((prev.y - s.y) * (mouseY - s.y) < 0 && mouseX > x0() && mouseX < x1()) {
      const t = (mouseX - x0()) / (x1() - x0());
      pluck(s, t, dist(prev.x, prev.y, mouseX, mouseY), Math.sign(mouseY - prev.y));
    }
  }
  prev = { x: mouseX, y: mouseY };
}

function mousePressed() {
  prev = { x: mouseX, y: mouseY };
  for (const s of strings) {
    if (mouseY > s.y - (s.name ? 44 : 26) && mouseY < s.y + 10 && mouseX > x0() && mouseX < x1()) { held = { s }; return; }
  }
}

function mouseReleased() {
  if (held) {
    const s = held.s, pull = abs(held.pull || 0);
    // Let go: string springs back from where it was held.
    s.glow = 1;
    if (pull > 4) { Audio.pluck(s.freq, constrain(pull / 70, 0.25, 1), round(map(abs(held.t - 0.5), 0, 0.5, 0.3, 1) * 10) / 10); nextTheme(); }
    held = null;
  }
}
