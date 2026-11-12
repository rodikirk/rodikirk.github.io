// 03 bounce: a drum machine you throw. The throw sets the tempo; the flight is solved so every
// wall hit lands on a 16th note; each hit prints the next letter of the bio.
// Floor = kick, ceiling = clap, left wall = bell, right wall = bass (both pitched by height).
let ball, seg = null, mode = "idle", hist = [], grabOff = null, bio;
let bpm = 0, step = 0, grid0 = 0, speed = 0, speed0 = 0, dir = { x: 0, y: 0 }, nextTick = 0;
let stamps = [], cells = new Array(16).fill(null), thrown = false;
const DECAY = 0.965, LOOKAHEAD = 0.12;

const now = () => performance.now() / 1000;
const S = () => min(width, height);
const floorY = () => height - 34; // the set bar is the floor's edge

function setup() {
  const c = createCanvas(windowWidth, windowHeight);
  c.elt.setAttribute("aria-hidden", "true");
  chrome("bounce", { hint: "throw the ball · space throws it for you" });
  bio = bioHeader();
  ball = { x: width / 2, y: height * 0.55, r: max(22, S() * 0.035), squash: 0, sv: 0, normal: 0 };
}
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  ball.x = constrain(ball.x, ball.r, width - ball.r); ball.y = constrain(ball.y, ball.r, floorY() - ball.r);
  if (mode === "fly") startSegment(now(), { x: ball.x, y: ball.y });
}

// --- throwing ---
function throwBall(vx, vy) {
  const sp = Math.hypot(vx, vy);
  if (sp < 0.4 * S()) { mode = "idle"; return; }
  bpm = round(constrain(map(sp / S(), 0.8, 6, 76, 150), 70, 160));
  step = 60 / bpm / 4;
  grid0 = now(); nextTick = grid0;
  speed = speed0 = constrain(sp, 1.5 * S(), 8 * S()); // floor keeps hits a few 16ths apart even on a gentle throw
  dir = { x: vx / sp, y: vy / sp };
  cells.fill(null);
  mode = "fly"; thrown = true;
  startSegment(grid0, { x: ball.x, y: ball.y });
}

// Fly straight to the next wall, arriving exactly on a 16th of the throw's grid.
function startSegment(t0, p0) {
  const r = ball.r, W = width, H = floorY();
  const dx = dir.x > 1e-6 ? (W - r - p0.x) / dir.x : dir.x < -1e-6 ? (p0.x - r) / -dir.x : Infinity;
  const dy = dir.y > 1e-6 ? (H - r - p0.y) / dir.y : dir.y < -1e-6 ? (p0.y - r) / -dir.y : Infinity;
  const d = max(0, min(dx, dy));
  const walls = [];
  if (abs(dx - d) < 2) walls.push(dir.x > 0 ? "right" : "left");
  if (abs(dy - d) < 2) walls.push(dir.y > 0 ? "floor" : "ceiling");
  const kMin = floor((t0 - grid0) / step + 1e-6) + 1;
  const k = max(kMin, round((t0 + d / speed - grid0) / step));
  seg = { t0, T: grid0 + k * step, k, p0, p1: { x: p0.x + dir.x * d, y: p0.y + dir.y * d }, walls, scheduled: false };
}

function hitSounds(walls, y, vel, when) {
  for (const w of walls) {
    if (w === "floor") Audio.kick(vel, when);
    else if (w === "ceiling") Audio.clap(vel * 0.8, when);
    else if (w === "left") Audio.bell(scaleFreq(floor(map(y, floorY(), 0, 4, 13, true))), vel * 0.8, 1.2, 0.35, when);
    else Audio.pluck(scaleFreq(floor(map(y, floorY(), 0, -5, 4, true))), vel, 0.6, 0.2, when);
  }
}

// Schedule sounds a little ahead on the audio clock so hits are sample-tight, not frame-tight.
function schedule(t) {
  if (!Audio.ctx) return;
  const at = (T) => Audio.ctx.currentTime + max(0, T - t);
  const vel = 0.35 + 0.65 * (speed / speed0);
  if (seg && !seg.scheduled && seg.T - t < LOOKAHEAD) { hitSounds(seg.walls, seg.p1.y, vel, at(seg.T)); seg.scheduled = true; }
  while (nextTick - t < LOOKAHEAD) { // quiet 8th-note hats so you can hear the tempo you threw
    const n = round((nextTick - grid0) / step);
    Audio.hat(n % 16 === 0 ? 0.16 : 0.08, false, at(nextTick));
    nextTick += step * 2;
  }
}

function land(s) {
  const b = ball;
  for (const w of s.walls) {
    if (w === "left" || w === "right") dir.x *= -1; else dir.y *= -1;
    if (w === "floor") nextTheme();
  }
  b.normal = s.walls.includes("left") || s.walls.includes("right") ? 0 : HALF_PI;
  b.squash = 0.22 * (0.4 + 0.6 * speed / speed0);
  cells[s.k % 16] = { walls: s.walls, k: s.k };
  // Print the next letter of the bio where it hit (after the bio is complete, it keeps reprinting it).
  let ch = bio.next(); if (!ch) { ch = "rodikirkmusiceducationdesign"[stamps.length % 28]; }
  const inset = S() * 0.09;
  stamps.push({ ch, x: constrain(s.p1.x, inset, width - inset), y: constrain(s.p1.y, inset + 60, floorY() - inset), t0: millis(), col: theme().fg });
  if (stamps.length > 40) stamps.shift();
  speed *= DECAY;
}

// --- input (pointer events, so one tap is one event on phones) ---
function onUI(e) { return e.target.closest && e.target.closest("a, header, .set"); }
window.addEventListener("pointerdown", (e) => {
  if (onUI(e) || !ball) return;
  if (dist(e.clientX, e.clientY, ball.x, ball.y) > ball.r + 40) return;
  mode = "drag"; seg = null; grabOff = { x: ball.x - e.clientX, y: ball.y - e.clientY };
  hist = [{ x: e.clientX, y: e.clientY, t: now() }];
});
window.addEventListener("pointermove", (e) => {
  if (mode !== "drag") return;
  ball.x = constrain(e.clientX + grabOff.x, ball.r, width - ball.r);
  ball.y = constrain(e.clientY + grabOff.y, ball.r, floorY() - ball.r);
  hist.push({ x: e.clientX, y: e.clientY, t: now() }); while (hist.length > 2 && hist[0].t < now() - 0.08) hist.shift();
});
window.addEventListener("pointerup", () => {
  if (mode !== "drag") return;
  const a = hist[0], b = hist[hist.length - 1], dt = max(0.016, b.t - a.t);
  throwBall((b.x - a.x) / dt, (b.y - a.y) / dt);
});
window.addEventListener("keydown", (e) => {
  if (e.key !== " ") return; e.preventDefault(); Audio.unlock();
  const ang = random(TWO_PI); throwBall(cos(ang) * 2.2 * S(), sin(ang) * 2.2 * S());
});

// --- draw ---
function draw() {
  background(theme().bg);
  const t = now(), b = ball;
  if (mode === "fly" && seg) {
    schedule(t);
    while (seg && t >= seg.T) {
      land(seg);
      if (speed < 0.35 * S()) { b.x = seg.p1.x; b.y = seg.p1.y; seg = null; mode = "idle"; break; }
      startSegment(seg.T, seg.p1); schedule(t);
    }
    if (seg) { const p = constrain((t - seg.t0) / (seg.T - seg.t0), 0, 1); b.x = lerp(seg.p0.x, seg.p1.x, p); b.y = lerp(seg.p0.y, seg.p1.y, p); }
  }
  b.sv += -0.25 * b.squash; b.sv *= 0.78; b.squash += b.sv;

  // printed letters
  textFont("Newsreader"); textAlign(CENTER, CENTER); noStroke();
  for (const s of stamps) {
    const age = (millis() - s.t0) / 1000, a = s === stamps[stamps.length - 1] ? max(0.5, 1 - age / 4) : max(0, 0.9 - age / 3);
    if (a <= 0) continue;
    fill(theme().fg); drawingContext.globalAlpha = a; textSize(S() * 0.16 * (1 + max(0, 0.25 - age) * 0.6)); text(s.ch, s.x, s.y);
  }
  drawingContext.globalAlpha = 1;

  // ball, with the next letter inside
  push(); translate(b.x, b.y);
  rotate(b.normal); scale(1 - b.squash, 1 + b.squash * 0.6); rotate(-b.normal);
  const idle = mode === "idle" && !thrown ? 1 + 0.04 * sin(millis() / 300) : 1;
  fill(theme().fg); circle(0, 0, b.r * 2 * idle);
  pop();

  // 16-step strip + tempo, just above the set bar
  const cw = min(18, (width - 120) / 16), gx = width / 2 - cw * 8, gy = floorY() - 22;
  const cur = mode === "fly" ? floor((t - grid0) / step) : -1;
  for (let i = 0; i < 16; i++) {
    const c = cells[i];
    if (c && cur - c.k >= 16) cells[i] = null; // forget hits older than a bar
    stroke(theme().fg); strokeWeight(1); drawingContext.globalAlpha = i % 4 === 0 ? 0.7 : 0.35;
    if (cells[i]) { fill(theme().fg); drawingContext.globalAlpha = 1; } else noFill();
    rect(gx + i * cw + 2, gy, cw - 4, 8, 1);
    if (cur >= 0 && cur % 16 === i) { drawingContext.globalAlpha = 1; line(gx + i * cw + 2, gy + 12, gx + (i + 1) * cw - 2, gy + 12); }
  }
  drawingContext.globalAlpha = 0.7; noStroke(); fill(theme().fg); textFont("IBM Plex Mono"); textSize(11); textAlign(LEFT, CENTER);
  text(mode === "fly" ? `${bpm} bpm` : thrown ? "throw again" : "throw it", gx + 16 * cw + 10, gy + 4);
  drawingContext.globalAlpha = 1;
}
