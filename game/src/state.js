// Game state: one object, created fresh for every run.
import {
  LIVES, FLARE_START, TOTAL_WAVES, WAVE_SHIPS, WAVE_KINDS,
  BEAM_MIN_ANGLE, BEAM_MAX_ANGLE, CHANNEL_Y, WAVE_NAMES,
} from "./config.js";
import { mulberry32 } from "./rng.js";

export const SCREEN = {
  TITLE: "title",
  PLAY: "play",
  WIN: "win",
  LOSE: "lose",
};

export function createGame() {
  return {
    rng: mulberry32(7),
    screen: SCREEN.TITLE,
    time: 0,
    // Run state.
    wave: 0,
    lives: LIVES,
    score: 0,
    combo: 0,
    bestCombo: 0,
    shipsHome: 0,
    shipsLost: 0,
    flares: FLARE_START,
    flareTimer: 0,
    flareCooldown: 0,
    // Wave state.
    calm: 0,
    spawnQueue: [],
    waveTotal: 0,
    spawnTimer: 0,
    banner: "",
    bannerTimer: 0,
    // Ships and feedback.
    ships: [],
    particles: [],
    shake: 0,
    flash: 0,
    message: "",
    messageTimer: 0,
    // The beam.
    beamAngle: 0.45,
    beamTarget: 0.45,
    beamSweeping: false,
    mouse: { x: 700, y: 380, active: false },
    // End-of-run stats.
    runTime: 0,
    best: 0,
    muted: false,
    paused: false,
    // Set by shots.js when a staged screenshot is being taken.
    staged: false,
  };
}

export function startRun(game) {
  game.screen = SCREEN.PLAY;
  game.time = 0;
  game.runTime = 0;
  game.wave = 0;
  game.lives = LIVES;
  game.score = 0;
  game.combo = 0;
  game.bestCombo = 0;
  game.shipsHome = 0;
  game.shipsLost = 0;
  game.flares = FLARE_START;
  game.flareTimer = 0;
  game.flareCooldown = 0;
  game.ships = [];
  game.particles = [];
  game.shake = 0;
  game.flash = 0;
  game.message = "";
  game.messageTimer = 0;
  game.beamAngle = 0.45;
  game.beamTarget = 0.45;
  game.paused = false;
  startWave(game);
  game.banner = `WAVE 1 — ${WAVE_NAMES[0]}`;
  game.bannerTimer = 2.6;
}

export function startWave(game) {
  game.wave += 1;
  const idx = game.wave - 1;
  const kinds = WAVE_KINDS[idx] || WAVE_KINDS[WAVE_KINDS.length - 1];
  const count = WAVE_SHIPS[idx] || WAVE_SHIPS[WAVE_SHIPS.length - 1];
  game.spawnQueue = [];
  for (let i = 0; i < count; i += 1) {
    game.spawnQueue.push(kinds[i % kinds.length]);
  }
  game.waveTotal = count;
  game.spawnTimer = 1.2;
  game.calm = 0;
  game.banner = "";
  game.bannerTimer = 0;
}

export function waveCleared(game) {
  return game.spawnQueue.length === 0 && game.ships.length === 0;
}

// The y a lit ship steers toward: the middle of the safe channel.
export function channelTarget() {
  return CHANNEL_Y;
}

export function clampBeamAngle(a) {
  if (a < BEAM_MIN_ANGLE) return BEAM_MIN_ANGLE;
  if (a > BEAM_MAX_ANGLE) return BEAM_MAX_ANGLE;
  return a;
}

export function loadBest(game) {
  try {
    const raw = localStorage.getItem("beaconkeeper-best");
    game.best = raw === null ? 0 : Number(raw) || 0;
  } catch {
    game.best = 0;
  }
}

export function saveBest(game) {
  if (game.score <= game.best) return;
  game.best = game.score;
  try {
    localStorage.setItem("beaconkeeper-best", String(game.best));
  } catch {
    // Storage is a nicety, not a requirement.
  }
}
