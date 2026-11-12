// 4. orbits: four rings of text turning at 2:3:4:5 over one bar. Dots that pass 12 o'clock sound.
let rings = [], bpm = 96, phase = 0, lastT = 0, dragY = null, flash = 0;
const RATIOS = [2, 3, 4, 5];
const VOICES = [
  (v) => Audio.kick(v),
  (v) => Audio.clap(v * 0.7),
  (v) => Audio.bell(scaleFreq(7 + floor(random(4))), v * 0.7, 1.4),
  (v) => Audio.hat(v * 0.7),
];

function setup() {
  createCanvas(windowWidth, windowHeight);
  chrome("orbits");
  textFont("IBM Plex Mono"); textAlign(CENTER, CENTER);
  rings = LINES.map((label, i) => {
    const n = RATIOS[i];
    // Start each ring with dots on its own pulse: a basic 2:3:4:5 polyrhythm.
    return { label, n, r: 0, dots: Array.from({ length: n }, (_, k) => k / n), lit: new Array(n).fill(0) };
  });
  // Thin a couple out so the start isn't a wall of sound.
  rings[2].dots = [0, 0.5]; rings[3].dots = [0.1, 0.3, 0.5, 0.7, 0.9];
  lastT = millis();
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); }

function radii() {
  const m = min(width, height) * 0.42;
  rings.forEach((g, i) => (g.r = m * (0.34 + i * 0.22)));
}

function draw() {
  radii();
  background(theme().bg);
  const now = millis(), dt = (now - lastT) / 1000; lastT = now;
  const barSec = (60 / bpm) * 4;
  const prevPhase = phase;
  phase = (phase + dt / barSec) % 1;
  const cx = width / 2, cy = height / 2;

  rings.forEach((g, i) => {
    // Ring rotates once per bar; its dots are spaced in its own subdivision.
    // A dot at position d sounds when the playhead (phase) crosses d.
    g.dots.forEach((d, k) => {
      if (crossed(prevPhase, phase, d)) { VOICES[i](0.8); g.lit[k] = 1; if (i === 0) { nextTheme(); flash = 1; } }
      g.lit[k] *= 0.9;
    });
    const rot = -phase * TWO_PI; // ring turns so the dot meets 12 o'clock at its time
    push(); translate(cx, cy); rotate(rot);
    // text around the ring
    const t = (g.label + " · ").repeat(40);
    textSize(12 + i);
    fill(theme().fg); noStroke();
    let acc = 0; const circ = TWO_PI * g.r;
    for (let j = 0; j < t.length; j++) {
      const w = textWidth(t[j]); if (acc + w > circ) break;
      const ang = ((acc + w / 2) / circ) * TWO_PI; acc += w;
      drawingContext.globalAlpha = 0.28;
      push(); rotate(ang); translate(0, -g.r); text(t[j], 0, 0); pop();
    }
    drawingContext.globalAlpha = 1;
    // subdivision ticks
    stroke(theme().fg); strokeWeight(1);
    for (let s = 0; s < g.n; s++) { push(); rotate((s / g.n) * TWO_PI); drawingContext.globalAlpha = 0.4; line(0, -g.r - 12, 0, -g.r - 18); pop(); }
    drawingContext.globalAlpha = 1;
    // dots
    noStroke();
    g.dots.forEach((d, k) => {
      push(); rotate(d * TWO_PI); translate(0, -g.r - 15);
      fill(theme().fg); circle(0, 0, 9 + g.lit[k] * 10); pop();
    });
    pop();
  });

  // playhead
  stroke(theme().fg); strokeWeight(1.5); drawingContext.globalAlpha = 0.8;
  line(cx, cy - rings[3].r - 34, cx, cy - rings[0].r + 10);
  drawingContext.globalAlpha = 1; noStroke(); fill(theme().fg);
  textSize(11); text(round(bpm) + " bpm", cx, cy);
  flash *= 0.9;
}

function crossed(a, b, d) {
  return a <= b ? d > a && d <= b : d > a || d <= b; // handles wrap at bar end
}

function mousePressed() {
  dragY = { y: mouseY, bpm, moved: false };
}
function mouseDragged() {
  if (!dragY) return;
  if (abs(mouseY - dragY.y) > 6) dragY.moved = true;
  bpm = constrain(dragY.bpm + (dragY.y - mouseY) * 0.4, 50, 180);
}
function mouseReleased() {
  if (!dragY || dragY.moved) { dragY = null; return; }
  dragY = null;
  const cx = width / 2, cy = height / 2, d = dist(mouseX, mouseY, cx, cy);
  const i = rings.findIndex((g) => abs(d - (g.r + 8)) < 22);
  if (i < 0) return;
  const g = rings[i];
  // Angle on screen -> position on the ring, snapped to that ring's grid (x2 for some syncopation).
  let a = atan2(mouseY - cy, mouseX - cx) + HALF_PI; // 0 at top
  let pos = ((a / TWO_PI + phase) % 1 + 1) % 1;
  const grid = g.n * 2; pos = round(pos * grid) / grid % 1;
  const k = g.dots.findIndex((x) => abs(x - pos) < 1e-6 || abs(x - pos) > 1 - 1e-6);
  if (k >= 0) { g.dots.splice(k, 1); g.lit.splice(k, 1); }
  else { g.dots.push(pos); g.lit.push(1); VOICES[i](0.5); }
}
