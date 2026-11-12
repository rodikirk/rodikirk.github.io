// 5. keys: every key is a sound and a shape. Each hit also types the next letter of the bio,
// so mashing the keyboard writes "rodi kirk · producer, dj..." across the screen.
// Rows: top = bells/chords, middle = bass plucks, bottom = drums. Enter = loop pedal. Space = next colour.
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
let anims = [], bigGlyph = null;
let bio; // bioHeader(): the bio as real HTML, inked one letter per hit
let loop = { state: "off", start: 0, len: 0, events: [], lastPhase: 0 }; // off | rec | play
const SHAPES = ["ring", "burst", "wipe", "spin", "strike", "dots", "petal"];

function setup() {
  createCanvas(windowWidth, windowHeight);
  chrome("keys", { hint: "type, or tap the screen · sound on" });
  bio = bioHeader();
  textFont("IBM Plex Mono");
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); }

// --- sound + shape for a key ---
function keyInfo(k) {
  for (let r = 0; r < ROWS.length; r++) { const c = ROWS[r].indexOf(k); if (c >= 0) return { r, c }; }
  return null;
}

function playKey(k, vel = 0.8, live = true) {
  const info = keyInfo(k); if (!info) return false;
  const { r, c } = info;
  if (r === 0) { // bells: pentatonic run, with every third key a two-note chord
    Audio.bell(scaleFreq(c + 5), vel, 1.6, 0.45);
    if (c % 3 === 2) Audio.bell(scaleFreq(c + 7), vel * 0.6, 1.6, 0.45);
  } else if (r === 1) { // bass plucks
    Audio.pluck(scaleFreq(c - 5, 146.83), vel, c / 9, 0.2);
  } else { // drums
    [() => Audio.kick(vel), () => Audio.clap(vel), () => Audio.hat(vel * 0.7),
     () => Audio.hat(vel * 0.7, true), () => tom(110, vel), () => tom(165, vel), () => tom(220, vel)][c]();
  }
  spawn(k, r, c, live);
  return true;
}

function tom(f, vel) {
  if (!Audio.ctx) return; const ctx = Audio.ctx, t = ctx.currentTime, out = Audio.dest(0.25);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
  g.gain.setValueAtTime(vel * 0.8, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(g).connect(out); o.start(t); o.stop(t + 0.55);
}

function spawn(k, r, c, live) {
  const seed = k.charCodeAt(0);
  const shape = SHAPES[(r * 3 + c) % SHAPES.length];
  // Position follows the key's place on the keyboard, loosely.
  const x = map(c + r * 0.5, 0, 10, width * 0.15, width * 0.85) + random(-40, 40);
  const y = map(r, 0, 2, height * 0.28, height * 0.72) + random(-40, 40);
  const col = THEMES[(themeIndex + 1 + (seed % (THEMES.length - 1))) % THEMES.length].bg;
  anims.push({ shape, x, y, t0: millis(), life: r === 2 ? 500 : 900, col, seed, a: random(TWO_PI) });
  // Type the next character of the bio.
  if (live) bigGlyph = { ch: typeNext() || k, t0: millis(), col }; // loop playback doesn't type
}

function typeNext() { return bio.next(); }

// --- input ---
function keyPressed() {
  Audio.unlock();
  if (key === " ") { nextTheme(); return false; }
  if (keyCode === ENTER) { pedal(); return false; }
  if (keyCode === BACKSPACE) { loop = { state: "off", start: 0, len: 0, events: [], lastPhase: 0 }; return false; }
  const k = key.toLowerCase();
  if (held.has(k)) return false; // ignore key repeat
  held.add(k);
  if (playKey(k)) record(k);
}
const held = new Set();
function keyReleased() { held.delete(key.toLowerCase()); }

// Touch: the screen is the keyboard, three rows.
function touchStarted(e) {
  if (e && e.target && e.target.closest && e.target.closest("a, header, .set")) return true; // links stay tappable
  if (!touches.length) return;
  if (touches.some((t) => t.y > height - 40)) return true; // leave the set bar tappable
  if (touches[0].y < 80 && touches[0].x > width - 220) { pedal(); return false; } // tap the loop label
  for (const t of touches) {
    const r = constrain(floor(t.y / (height / 3)), 0, 2);
    const row = ROWS[r]; const c = constrain(floor(t.x / (width / row.length)), 0, row.length - 1);
    if (playKey(row[c])) record(row[c]);
  }
  return false;
}

// --- loop pedal: Enter to record, Enter to close the loop, Enter to overdub on/off, Backspace clears ---
function pedal() {
  const now = millis();
  if (loop.state === "off") { loop = { state: "rec", start: now, len: 0, events: [], lastPhase: 0 }; }
  else if (loop.state === "rec" && !loop.len) { loop.len = max(400, now - loop.start); loop.state = "play"; loop.lastPhase = (now - loop.start) % loop.len; }
  else if (loop.state === "play") loop.state = "dub";
  else if (loop.state === "dub") loop.state = "play";
}
function record(k) {
  if (loop.state === "rec") loop.events.push({ k, at: millis() - loop.start });
  else if (loop.state === "dub") loop.events.push({ k, at: (millis() - loop.start) % loop.len });
}
function runLoop() {
  if (!loop.len || (loop.state !== "play" && loop.state !== "dub")) return;
  const ph = (millis() - loop.start) % loop.len, prev = loop.lastPhase;
  for (const e of loop.events) {
    const hit = prev <= ph ? e.at > prev && e.at <= ph : e.at > prev || e.at <= ph;
    if (hit) playKey(e.k, 0.65, false);
  }
  loop.lastPhase = ph;
}

// --- drawing ---
function draw() {
  runLoop();
  background(theme().bg);
  const now = millis();

  // Big glyph of the latest bio letter, behind everything.
  if (bigGlyph) {
    const p = (now - bigGlyph.t0) / 700;
    if (p < 1) {
      push(); textFont("Newsreader"); textAlign(CENTER, CENTER); textSize(min(width, height) * 0.7 * (1 + p * 0.08));
      fill(theme().fg); drawingContext.globalAlpha = 0.12 * (1 - p); text(bigGlyph.ch, width / 2, height / 2 - height * 0.04); pop();
      drawingContext.globalAlpha = 1;
    }
  }

  anims = anims.filter((a) => now - a.t0 < a.life);
  for (const a of anims) drawAnim(a, (now - a.t0) / a.life);

  // Loop indicator.
  textAlign(RIGHT, BASELINE); textSize(12);
  const label = { off: touches.length || "ontouchstart" in window ? "tap here: loop" : "enter: loop", rec: "● rec  (enter to close)", play: "▶ loop  (enter: overdub, ⌫ clear)", dub: "● overdub" }[loop.state];
  text(label, width - 24, 44);
  if (loop.len) {
    const ph = ((now - loop.start) % loop.len) / loop.len;
    stroke(theme().fg); strokeWeight(2); line(width - 184, 54, width - 184 + 160 * ph, 54);
    noStroke(); for (const e of loop.events) circle(width - 184 + 160 * (e.at / loop.len), 60, 3);
  }
}

function ease(p) { return 1 - pow(1 - p, 3); }

function drawAnim(a, p) {
  const e = ease(p), fade = 1 - p, S = min(width, height);
  push(); translate(a.x, a.y);
  const c = color(a.col);
  switch (a.shape) {
    case "ring":
      noFill(); stroke(c); strokeWeight(14 * fade + 1); circle(0, 0, S * 0.5 * e); break;
    case "burst":
      noStroke(); fill(c);
      for (let i = 0; i < 12; i++) { const ang = a.a + (i / 12) * TWO_PI, r = S * 0.28 * e; circle(cos(ang) * r, sin(ang) * r, 18 * fade); }
      break;
    case "wipe": {
      pop(); push(); noStroke(); fill(c);
      const h = height * 0.22, y = a.y - h / 2;
      const x0 = p < 0.5 ? 0 : width * (p - 0.5) * 2, x1 = width * min(1, p * 2);
      rect(x0, y, x1 - x0, h); break;
    }
    case "spin":
      rotate(a.a + e * PI); noStroke(); fill(c); rectMode(CENTER);
      square(0, 0, S * 0.22 * (1 - e * 0.6)); break;
    case "strike":
      rotate(a.a); stroke(c); strokeWeight(8 * fade + 1); line(-S * 0.6 * e, 0, S * 0.6 * e, 0); break;
    case "dots":
      noStroke(); fill(c); randomSeed(a.seed);
      for (let i = 0; i < 24; i++) circle(random(-1, 1) * S * 0.3 * e, random(-1, 1) * S * 0.3 * e, 10 * fade + 2);
      randomSeed(millis()); break;
    case "petal":
      noStroke(); fill(c); rotate(a.a);
      for (let i = 0; i < 6; i++) { rotate(TWO_PI / 6); ellipse(S * 0.1 * e, 0, S * 0.18 * e, S * 0.05 * fade); }
      break;
  }
  pop();
}
