// Sound, synthesized with WebAudio: no audio files, nothing to download.
// The context is created on the first gesture (the browser's rule), and
// every sound is a no-op until then, so staged screenshots stay silent.
let actx = null;
let master = null;
let ambientOn = false;

export function ensureAudio(game) {
  if (actx !== null) {
    if (actx.state === "suspended") actx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC === undefined) return;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = game.muted ? 0 : 0.5;
    master.connect(actx.destination);
    startAmbient();
  } catch {
    actx = null;
  }
}

export function setMuted(game) {
  if (master !== null) master.gain.value = game.muted ? 0 : 0.5;
}

function tone(freq, dur, type, vol, slideTo) {
  if (actx === null || master === null) return;
  const t = actx.currentTime;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo !== undefined) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noiseBurst(dur, vol, filterFreq) {
  if (actx === null || master === null) return;
  const t = actx.currentTime;
  const len = Math.floor(actx.sampleRate * dur);
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = actx.createBufferSource();
  src.buffer = buf;
  const f = actx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = filterFreq;
  const g = actx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t);
}

function startAmbient() {
  if (ambientOn || actx === null || master === null) return;
  ambientOn = true;
  const len = actx.sampleRate * 2;
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3;
  }
  const src = actx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = actx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 420;
  const g = actx.createGain();
  g.gain.value = 0.05;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start();
}

export function playBell(game) {
  if (game.muted) return;
  tone(880, 0.5, "sine", 0.22);
  tone(1318, 0.4, "sine", 0.12);
}

export function playCrash(game) {
  if (game.muted) return;
  noiseBurst(0.35, 0.5, 900);
  tone(82, 0.4, "sine", 0.4, 40);
}

export function playHorn(game) {
  if (game.muted) return;
  tone(110, 0.9, "sawtooth", 0.10);
  tone(165, 0.9, "sine", 0.12);
}

export function playFlare(game) {
  if (game.muted) return;
  noiseBurst(0.6, 0.25, 3200);
  tone(520, 0.5, "sine", 0.10, 1040);
}

export function playClick(game) {
  if (game.muted) return;
  tone(660, 0.07, "square", 0.08);
}
