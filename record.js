// 2. record: the bio is the groove. Spin it to scratch a loop; the motor pulls it back to speed.
let widths = [], total = 0, R, node = null, loopBuf = null;
let angle = 0, omega = 0, motorOn = true, grab = null;
const TS = 15, BPM = 92;
const BASE = () => (33.333 / 60) * Math.PI * 2 / 60; // rad per frame at 33 rpm, 60fps

function setup() {
  createCanvas(windowWidth, windowHeight);
  chrome("record", { hint: null });
  textFont("IBM Plex Mono"); textSize(TS); textAlign(CENTER, CENTER);
  for (const c of BIO) { const w = textWidth(c); widths.push(w); total += w; }
  R = total / TWO_PI;
  omega = BASE();
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); }

// Render a 2-bar loop once (kick, snare, hats, a Dm9 stab) into a buffer.
async function makeLoop(ctx) {
  const sr = ctx.sampleRate, beat = 60 / BPM, len = beat * 8;
  const off = new OfflineAudioContext(1, Math.ceil(sr * len), sr);
  const noise = off.createBuffer(1, sr, sr); const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const kick = (t) => { const o = off.createOscillator(), g = off.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g).connect(off.destination); o.start(t); o.stop(t + 0.45); };
  const nz = (t, f, type, dur, v) => { const s = off.createBufferSource(); s.buffer = noise;
    const fl = off.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
    const g = off.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl).connect(g).connect(off.destination); s.start(t); s.stop(t + dur + 0.01); };
  const stab = (t, notes) => notes.forEach((m) => { const o = off.createOscillator(), g = off.createGain();
    const lp = off.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(2600, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.5);
    o.type = "sawtooth"; o.frequency.value = 440 * Math.pow(2, (m - 69) / 12);
    g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.connect(lp).connect(g).connect(off.destination); o.start(t); o.stop(t + 0.75); });
  [0, 2.5, 4, 6.5, 7.25].forEach((b) => kick(b * beat));
  [1, 3, 5, 7].forEach((b) => nz(b * beat, 1800, "bandpass", 0.18, 0.8));
  for (let i = 0; i < 16; i++) nz(i * beat / 2 + (i % 2 ? 0.03 : 0), 8000, "highpass", i % 4 === 3 ? 0.2 : 0.05, 0.35);
  stab(0.75 * beat, [50, 57, 60, 64, 65]); stab(4.75 * beat, [48, 55, 58, 62, 64]);
  const bass = [[0, 38], [1.5, 38], [3.5, 41], [4, 36], [5.5, 36], [7, 43]];
  bass.forEach(([b, m]) => { const o = off.createOscillator(), g = off.createGain(), t = b * beat;
    o.type = "triangle"; o.frequency.value = 440 * Math.pow(2, (m - 69) / 12);
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.9);
    o.connect(g).connect(off.destination); o.start(t); o.stop(t + beat); });
  return off.startRendering();
}

// Variable-rate (incl. reverse) buffer player, as an AudioWorklet from a blob.
const WORKLET = `
class Deck extends AudioWorkletProcessor {
  constructor() { super(); this.buf = null; this.pos = 0; this.rate = 1; this.target = 1;
    this.port.onmessage = (e) => { if (e.data.buf) this.buf = e.data.buf; if ('rate' in e.data) this.target = e.data.rate; }; }
  process(_, outputs) {
    const out = outputs[0][0]; if (!this.buf) return true; const b = this.buf, n = b.length;
    for (let i = 0; i < out.length; i++) {
      this.rate += (this.target - this.rate) * 0.004;
      let p = this.pos % n; if (p < 0) p += n;
      const i0 = Math.floor(p), f = p - i0;
      out[i] = (b[i0] * (1 - f) + b[(i0 + 1) % n] * f) * Math.min(1, Math.abs(this.rate) * 1.5);
      this.pos += this.rate;
    }
    return true;
  }
}
registerProcessor('deck', Deck);`;

// Same deck on the main thread, with a port-shaped shim so the rest of the code doesn't care.
function scriptDeck(ctx) {
  const sp = ctx.createScriptProcessor(512, 0, 1);
  const st = { buf: null, pos: 0, rate: 1, target: 1 };
  sp.port = { postMessage: (m) => { if (m.buf) st.buf = m.buf; if ("rate" in m) st.target = m.rate; } };
  sp.onaudioprocess = (e) => {
    const out = e.outputBuffer.getChannelData(0), b = st.buf; if (!b) return out.fill(0);
    const n = b.length;
    for (let i = 0; i < out.length; i++) {
      st.rate += (st.target - st.rate) * 0.004;
      let p = st.pos % n; if (p < 0) p += n;
      const i0 = Math.floor(p), f = p - i0;
      out[i] = (b[i0] * (1 - f) + b[(i0 + 1) % n] * f) * Math.min(1, Math.abs(st.rate) * 1.5);
      st.pos += st.rate;
    }
  };
  return sp;
}

async function startDeck() {
  const ctx = Audio.unlock(); if (node || !ctx) return;
  node = "pending";
  loopBuf = await makeLoop(ctx);
  { const d = loopBuf.getChannelData(0); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v)); for (let i = 0; i < d.length; i++) d[i] *= 0.7 / m; }
  try {
    await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" })));
    node = new AudioWorkletNode(ctx, "deck", { outputChannelCount: [1] });
  } catch (e) {
    node = scriptDeck(ctx); // file:// pages can't load blob worklets
  }
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 9000; lp.Q.value = 2;
  node.connect(lp).connect(Audio.dest(0.15));
  node.lp = lp;
  node.port.postMessage({ buf: loopBuf.getChannelData(0) });
}

function draw() {
  background(theme().bg);
  const cx = width / 2, cy = height / 2;
  if (grab) {
    const a = atan2(mouseY - cy, mouseX - cx);
    let d = a - grab.last; if (d > PI) d -= TWO_PI; if (d < -PI) d += TWO_PI;
    grab.last = a; angle += d; omega = lerp(omega, d, 0.6);
  } else {
    const target = motorOn ? BASE() : 0;
    omega = lerp(omega, target, motorOn ? 0.04 : 0.025);
    angle += omega;
  }
  const rate = omega / BASE();
  if (node && node.port) {
    node.port.postMessage({ rate });
    node.lp.frequency.value = 400 + 8600 * constrain(abs(rate), 0, 1);
  }

  push(); translate(cx, cy); rotate(angle);
  noFill(); stroke(theme().fg); strokeWeight(1);
  for (let k = 1; k <= 3; k++) { drawingContext.globalAlpha = 0.12; circle(0, 0, (R - 14 * k) * 2); }
  drawingContext.globalAlpha = 1;
  fill(theme().fg); noStroke();
  let acc = 0;
  for (let i = 0; i < BIO.length; i++) {
    const ang = ((acc + widths[i] / 2) / total) * TWO_PI; acc += widths[i];
    push(); rotate(ang); translate(0, -R); text(BIO[i], 0, 0); pop();
  }
  // label
  const lr = R * 0.38;
  fill(THEMES[(themeIndex + 1) % THEMES.length].bg); circle(0, 0, lr * 2);
  fill(THEMES[(themeIndex + 1) % THEMES.length].fg);
  textSize(11); text("RK · 33", 0, -lr * 0.45); textSize(TS);
  fill(theme().bg); circle(0, 0, 6);
  pop();

  fill(theme().fg); noStroke(); textSize(11);
  text((rate >= 0 ? "" : "−") + nf(abs(rate) * 33.3, 2, 1) + " rpm", cx, cy + R + 36);
  textSize(TS);
}

function mousePressed() {
  startDeck();
  const cx = width / 2, cy = height / 2, d = dist(mouseX, mouseY, cx, cy);
  if (d < R * 0.38) { motorOn = !motorOn; nextTheme(); return; }
  if (d < R + 40) grab = { last: atan2(mouseY - cy, mouseX - cx) };
}
function mouseReleased() { grab = null; }
function keyPressed() { if (key === " ") { startDeck(); motorOn = !motorOn; nextTheme(); } }
