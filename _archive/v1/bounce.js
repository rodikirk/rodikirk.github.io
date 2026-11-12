// 1. bounce: fling a ring of text; the walls are instruments.
let ring, widths = [], total = 0, R;
const TS = 17;

function setup() {
  createCanvas(windowWidth, windowHeight);
  chrome("bounce");
  textFont("IBM Plex Mono"); textSize(TS); textAlign(CENTER, CENTER);
  for (const c of BIO) { const w = textWidth(c); widths.push(w); total += w; }
  R = total / TWO_PI;
  ring = { x: width / 2, y: height / 2, vx: 0, vy: 0, a: 0, va: 0.002,
           squash: 0, sv: 0, normal: 0, drag: null, hist: [] };
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }

function draw() {
  background(theme().bg);
  const r = ring;
  if (!r.drag) {
    r.x += r.vx; r.y += r.vy; r.vx *= 0.993; r.vy *= 0.993;
    r.a += r.va; r.va = lerp(r.va, 0.002, 0.01);
    walls();
  } else {
    r.hist.push({ x: mouseX, y: mouseY, t: millis() });
    if (r.hist.length > 6) r.hist.shift();
    r.x = mouseX - r.drag.dx; r.y = mouseY - r.drag.dy;
  }
  // squash spring
  r.sv += -0.25 * r.squash; r.sv *= 0.78; r.squash += r.sv;

  push();
  translate(r.x, r.y);
  rotate(r.normal); scale(1 - r.squash, 1 + r.squash * 0.6); rotate(-r.normal);
  fill(theme().fg); noStroke();
  let acc = 0;
  for (let i = 0; i < BIO.length; i++) {
    const ang = r.a + ((acc + widths[i] / 2) / total) * TWO_PI;
    acc += widths[i];
    push(); rotate(ang); translate(0, -R); text(BIO[i], 0, 0); pop();
  }
  pop();
}

function walls() {
  const r = ring, m = R + TS * 0.6;
  const hit = (side, speed) => {
    if (speed < 0.6) return;
    const vel = constrain(speed / 22, 0.08, 1);
    if (side === "floor") Audio.kick(vel);
    else if (side === "ceiling") Audio.clap(vel * 0.8);
    else {
      // Side walls: pitch from height, two octaves of pentatonic.
      const step = floor(map(r.y, height, 0, 0, 11, true)) + (side === "right" ? 2 : 0);
      Audio.bell(scaleFreq(step + 5), vel);
      if (speed > 14) Audio.hat(vel * 0.6, true);
    }
    r.normal = side === "left" || side === "right" ? 0 : HALF_PI;
    r.squash = constrain(speed / 60, 0.03, 0.28);
    nextTheme();
  };
  if (r.x < m) { r.x = m; hit("left", abs(r.vx)); r.vx = abs(r.vx) * 0.86; r.va += r.vy * 0.0015; }
  if (r.x > width - m) { r.x = width - m; hit("right", abs(r.vx)); r.vx = -abs(r.vx) * 0.86; r.va -= r.vy * 0.0015; }
  if (r.y < m) { r.y = m; hit("ceiling", abs(r.vy)); r.vy = abs(r.vy) * 0.86; r.va -= r.vx * 0.0015; }
  if (r.y > height - m) { r.y = height - m; hit("floor", abs(r.vy)); r.vy = -abs(r.vy) * 0.86; r.va += r.vx * 0.0015; }
}

function mousePressed() {
  const r = ring;
  if (dist(mouseX, mouseY, r.x, r.y) < R + 30) {
    r.drag = { dx: mouseX - r.x, dy: mouseY - r.y }; r.hist = [];
    Audio.hat(0.15);
  }
}

function mouseReleased() {
  const r = ring; if (!r.drag) return;
  r.drag = null;
  const h = r.hist;
  if (h.length > 1) {
    const a = h[0], b = h[h.length - 1], dt = max(1, b.t - a.t) / 16.7;
    r.vx = constrain((b.x - a.x) / dt, -45, 45);
    r.vy = constrain((b.y - a.y) / dt, -45, 45);
    r.va = (r.vx + r.vy) * 0.0006;
  }
}
