// rings: four ring-shaped strings. Read across the middle they spell R O D I | K I R K
// (outer ring R…K, inner ring I…K). Each ring carries a ball. Flick a ring along its length and
// its ball starts to orbit; every time a ball passes a letter it plays that ring's note.
// Spins lock to a shared bar, so each ring's hits are spread evenly (1 to 8 per bar): a small
// Euclidean / polyrhythm sequencer. The widest ring is the lowest note.
// Same family as strings: thin cream strings that wobble, Newsreader letters, Karplus plucks.

const N = 120;                         // segments per ring
const BPM = 92, BAR = (60 / BPM) * 4;  // shared bar the spins lock to
const LOOKAHEAD = 0.1;
const LEFT = ["r", "o", "d", "i"], RIGHT = ["k", "r", "i", "k"];  // index 0 = outer ring
// [left letter note, right letter note], outer (lowest) to inner. Dm9 colours, right = a fifth up.
const NOTES = [[73.42, 110.0], [110.0, 164.81], [174.61, 261.63], [261.63, 392.0]];

let rings = [], T0 = 0, last = 0, grab = null, strum = null, played = false, engaged = false;
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const now = () => performance.now() / 1000;
const S = () => min(width, height - 90);
const C = () => ({ x: width / 2, y: (height - 40) / 2 });

function setup() {
  const c = createCanvas(windowWidth, windowHeight);
  c.elt.setAttribute("aria-hidden", "true");
  chrome("rings", { hint: null });
  T0 = last = now();
  rings = LEFT.map((l, i) => ({
    i, left: l, right: RIGHT[i], notes: NOTES[i],
    u: new Float32Array(N), v: new Float32Array(N),
    theta: -HALF_PI, omega: 0, k: 0, dir: 1, lastN: null, flash: [0, 0], shimmer: 0,
  }));
  layout();
  setTimeout(() => !engaged && hint(false), 900);
  setTimeout(() => !engaged && hint(false), 9000);
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); layout(); }
function layout() { const s = S(); rings.forEach((g, i) => (g.r = s * (0.42 - i * 0.09))); }

// --- sound + wobble ---
function bump(g, ang, amp) {
  for (let j = 0; j < N; j++) {
    let d = abs(((j / N) * TWO_PI - ang) % TWO_PI); if (d > PI) d = TWO_PI - d;
    g.v[j] += amp * Math.exp(-((d / 0.22) ** 2));
  }
}
function ringPluck(g, ang, vel, when) {
  const side = Math.cos(ang) < 0 ? 0 : 1; // left half plays the left note
  Audio.pluck(g.notes[side], vel, 0.6, 0.35, when);
}
function hint(audible) {
  const g = rings[0];
  if (!calm) { bump(g, -HALF_PI, -2.5); if (!g.k) g.omega = 1.4; }
  g.shimmer = 1;
  if (audible) ringPluck(g, PI, 0.3);
}

// --- motion: free spin with friction, or locked to the bar ---
function step(g, t, dt) {
  const before = g.theta;
  g.theta += g.omega * dt;
  if (g.k > 0) {
    const target = g.dir * PI * g.k * (t - T0) / BAR;      // hits land on t = T0 + m·BAR/k
    let e = target - g.theta; e -= PI * Math.round(e / PI);  // either letter will do
    const w = g.dir * PI * g.k / BAR;
    if (abs(e) < 0.05) { g.theta += e; g.omega = w; }        // close enough: sit exactly on the grid
    else g.omega += (w + 2.5 * e - g.omega) * min(1, dt * 3); // otherwise ease the flywheel toward it
  } else {
    g.omega *= Math.exp(-dt * 1.4);
    if (abs(g.omega) < 0.02) g.omega = 0;
  }
  // visual: flash the letter and ripple the ring where the ball passed
  const a = Math.floor(before / PI), b = Math.floor(g.theta / PI);
  if (a !== b) {
    const n = g.omega > 0 ? b : a, side = ((n % 2) + 2) % 2 === 0 ? 1 : 0;
    g.flash[side] = 1; bump(g, n * PI, 2);
  }
  // audio: schedule the next letter crossing slightly ahead, so locked rhythms are sample-tight
  if (Audio.ctx && abs(g.omega) > 0.05) {
    const nn = g.omega > 0 ? Math.floor(g.theta / PI) + 1 : Math.ceil(g.theta / PI) - 1;
    const wait = (nn * PI - g.theta) / g.omega;
    if (wait >= 0 && wait < LOOKAHEAD && nn !== g.lastN) {
      ringPluck(g, nn * PI, g.k ? 0.6 : 0.35, Audio.ctx.currentTime + wait);
      g.lastN = nn;
    }
  }
  // the ring itself: a closed string
  for (let s = 0; s < 2; s++) {
    for (let j = 0; j < N; j++) g.v[j] += 0.38 * (g.u[(j + N - 1) % N] + g.u[(j + 1) % N] - 2 * g.u[j]);
    // a closed string has no ends to pin it, so give it a gentle pull back to round
    for (let j = 0; j < N; j++) { g.v[j] = (g.v[j] - 0.03 * g.u[j]) * 0.985; g.u[j] += g.v[j] * 0.33; }
  }
  if (grab && grab.g === g) bendAt(g);
  g.flash[0] *= 0.9; g.flash[1] *= 0.9; g.shimmer *= 0.978;
}
const uAt = (g, ang) => { const f = ((((ang % TWO_PI) + TWO_PI) % TWO_PI) / TWO_PI) * N, j = Math.floor(f) % N, fr = f - Math.floor(f); return g.u[j] * (1 - fr) + g.u[(j + 1) % N] * fr; };

// --- draw ---
function draw() {
  const t = now(), dt = min(0.1, t - last); last = t;
  background(theme().bg);
  const c = C(), fg = theme().fg, s = S();
  for (const g of rings) {
    step(g, t, dt);
    const sh = g.shimmer > 0.01 ? g.shimmer * (0.5 + 0.5 * Math.sin(millis() / 60)) : 0;
    noFill(); stroke(fg); strokeWeight(1 + sh * 1.2 + (grab && grab.g === g ? 0.8 : 0));
    drawingContext.globalAlpha = 0.45 + sh * 0.4 + (g.k ? 0.15 : 0);
    beginShape(); for (let j = 0; j <= N; j++) { const a = (j / N) * TWO_PI, r = g.r + g.u[j % N]; vertex(c.x + r * Math.cos(a), c.y + r * Math.sin(a)); } endShape();
    drawingContext.globalAlpha = 1;
    // letters sit on the ring at 9 and 3 o'clock, knocking the line out behind them
    textFont("Newsreader"); textAlign(CENTER, CENTER);
    [[PI, g.left, 0], [0, g.right, 1]].forEach(([a, ch, side]) => {
      const r = g.r + uAt(g, a), x = c.x + r * Math.cos(a), y = c.y + r * Math.sin(a);
      const size = s * 0.07 * (1 + g.flash[side] * 0.22);
      noStroke(); fill(theme().bg); rectMode(CENTER); rect(x, y, size * 0.75, size * 0.9);
      fill(fg); textSize(size); text(ch, x, y - size * 0.08);
    });
    // the ball
    const r = g.r + uAt(g, g.theta);
    noStroke(); fill(fg); circle(c.x + r * Math.cos(g.theta), c.y + r * Math.sin(g.theta), max(10, s * 0.022));
  }
}

// --- input: flick along a ring to spin its ball; swipe across rings to strum; tap a ball to stop it ---
function polar(e) { const c = C(), dx = e.clientX - c.x, dy = e.clientY - c.y; return { rho: Math.hypot(dx, dy), phi: Math.atan2(dy, dx), x: e.clientX, y: e.clientY }; }
function onUI(e) { return e.target.closest && e.target.closest("a, .set"); }

window.addEventListener("pointerdown", (e) => {
  if (onUI(e) || !rings.length) return;
  const p = polar(e), first = !engaged; engaged = true;
  let best = null;
  for (const g of rings) { const d = abs(p.rho - g.r); if (d < 22 && (!best || d < abs(p.rho - best.r))) best = g; }
  if (best) {
    const r = best.r + uAt(best, best.theta), bx = C().x + r * Math.cos(best.theta), by = C().y + r * Math.sin(best.theta);
    grab = { g: best, start: p, moved: false, onBall: dist(p.x, p.y, bx, by) < 22, hist: [{ phi: p.phi, t: now() }], unwrap: p.phi, p };
  } else {
    strum = { prev: p };
    if (first) setTimeout(() => hint(true), 40);
  }
});

window.addEventListener("pointermove", (e) => {
  const p = polar(e);
  if (grab) {
    if (dist(p.x, p.y, grab.start.x, grab.start.y) > 8) grab.moved = true;
    let d = p.phi - grab.hist[grab.hist.length - 1].phi; if (d > PI) d -= TWO_PI; if (d < -PI) d += TWO_PI;
    grab.unwrap += d; grab.hist.push({ phi: p.phi, u: grab.unwrap, t: now() });
    while (grab.hist.length > 2 && grab.hist[0].t < now() - 0.1) grab.hist.shift();
    grab.p = p;
  } else if (strum) {
    for (const g of rings) {
      if ((strum.prev.rho - g.r) * (p.rho - g.r) < 0) { ringPluck(g, p.phi, 0.55); bump(g, p.phi, 4 * Math.sign(p.rho - strum.prev.rho)); played = true; }
    }
    strum.prev = p;
  }
});

// While held, the ring bends toward the finger (like pulling a string).
function bendAt(g) {
  const pull = constrain(grab.p.rho - g.r, -26, 26);
  for (let j = 0; j < N; j++) {
    let d = abs((j / N) * TWO_PI - ((grab.p.phi + TWO_PI) % TWO_PI)); if (d > PI) d = TWO_PI - d;
    const w = Math.exp(-((d / 0.35) ** 2));
    g.u[j] = g.u[j] * (1 - w) + pull * w; g.v[j] *= 1 - w;
  }
}

function release() {
  if (grab) {
    const g = grab.g;
    if (!grab.moved) {
      if (grab.onBall && (g.k || g.omega)) { g.k = 0; g.omega *= 0.3; }   // tap the ball: let it coast to a stop
      else { ringPluck(g, grab.start.phi, 0.55); bump(g, grab.start.phi, 3); }
      played = true;
    } else {
      const h = grab.hist, a = h[0], b = h[h.length - 1], dt = max(0.016, b.t - a.t);
      const w = ((b.u ?? b.phi) - (a.u ?? a.phi)) / dt; // pointer's angular speed, rad/s
      if (abs(w) > 0.8) {
        g.k = constrain(Math.round(abs(w) * BAR / PI * 0.75), 1, 8);
        g.dir = Math.sign(w); g.omega = w * 0.5; g.lastN = null;
      }
      ringPluck(g, grab.p.phi, 0.6); played = true;
    }
    grab = null;
  }
  strum = null;
  if (played) nextTheme();
  played = false;
}
window.addEventListener("pointerup", release);
window.addEventListener("pointercancel", release);
