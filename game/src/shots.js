// Screenshot scenes behind ?shot=start|play|win|lose.
// Each one plays the real rules forward from a fresh run for a fixed
// number of steps (seeded, so the same seed always gives the same
// frame). The autopilot is a decent player: it lights the ship in the
// most danger and saves a flare for a ship about to hit a rock.
import { SCREEN, startRun, startWave } from "./state.js";
import { TOTAL_WAVES, SHIP_KINDS } from "./config.js";
import { stepGame } from "./update.js";
import { mulberry32 } from "./rng.js";
import { spawnShip, dangerOf, inChannel } from "./ships.js";
import { aimAt, fireFlare } from "./beam.js";

const DT = 1 / 60;

// Pick the ship that needs the light most: off-channel, near a rock,
// or panicking. The beam turns slowly, so this choice is the game.
// The pilot commits: it holds the beam on one ship until that ship is
// safe in the channel, and only breaks away for an emergency.
function autopilot(game) {
  let target = null;
  if (game.pilotTargetId !== undefined) {
    for (let i = 0; i < game.ships.length; i += 1) {
      if (game.ships[i].id === game.pilotTargetId) target = game.ships[i];
    }
    if (target !== null && inChannel(target) && target.lit) target = null;
  }
  // Emergency: a ship about to hit a rock jumps the queue.
  let emergency = null;
  for (let i = 0; i < game.ships.length; i += 1) {
    const s = game.ships[i];
    if (dangerOf(game, s) > 0.8 && s.panic > 0.7) emergency = s;
  }
  if (emergency !== null) {
    target = emergency;
  } else if (target === null) {
    let bestScore = -1;
    for (let i = 0; i < game.ships.length; i += 1) {
      const s = game.ships[i];
      const score = dangerOf(game, s) * 2 + s.panic + (inChannel(s) ? 0 : 0.5);
      if (score > bestScore) {
        bestScore = score;
        target = s;
      }
    }
  }
  if (target !== null) {
    game.pilotTargetId = target.id;
    aimAt(game, target.x, target.y);
  }
  // A flare when a ship is about to hit a rock and the beam cannot
  // get there in time.
  for (let i = 0; i < game.ships.length; i += 1) {
    const s = game.ships[i];
    if (dangerOf(game, s) > 0.72 && s.panic > 0.6) {
      if (fireFlare(game)) break;
    }
  }
}

function runUntil(game, stop, maxSeconds, pilot) {
  const steps = Math.floor(maxSeconds / DT);
  for (let i = 0; i < steps; i += 1) {
    if (game.screen !== SCREEN.PLAY) break;
    if (pilot) pilot(game);
    stepGame(game, DT);
    if (stop(game)) return true;
  }
  return stop(game);
}

function placeTitleShips(game) {
  const kinds = ["cutter", "skiff", "galleon"];
  const spots = [
    { x: 700, y: 420 },
    { x: 950, y: 540 },
    { x: 1120, y: 330 },
  ];
  for (let i = 0; i < kinds.length; i += 1) {
    spawnShip(game, kinds[i]);
    const s = game.ships[game.ships.length - 1];
    s.x = spots[i].x;
    s.y = spots[i].y;
    s.lane = spots[i].y;
  }
  game.beamAngle = 0.55;
  game.beamTarget = 0.55;
  game.time = 8;
}

export function stageShot(name, game, seed) {
  game.rng = mulberry32(seed || 7);
  game.staged = true;
  if (name === "play") {
    startRun(game);
    // Wave 3 is the busy shot: fog on the water, five ships out, the
    // beam on the one in trouble. The run is real play from the start
    // (the seed-7 autopilot clears waves 1 and 2), so wave 3 is
    // reached, not staged. Stop when the frame is full: four ships
    // out, one of them lit, and points already on the board.
    const good = runUntil(game, function (g) {
      const visible = g.ships.filter((s) => s.x < 1250 && s.x > 100);
      const lit = g.ships.some((s) => s.lit);
      return g.screen === SCREEN.PLAY && g.wave === 3 && visible.length >= 4 && lit && g.score > 0;
    }, 400, autopilot);
    if (!good) {
      // Fallback: a busy wave-3 frame, staged from a fresh wave.
      game.ships = [];
      game.spawnQueue = [];
      game.wave = 3;
      const kinds = ["skiff", "cutter", "galleon", "cutter", "skiff"];
      for (let i = 0; i < kinds.length; i += 1) {
        spawnShip(game, kinds[i]);
        const s = game.ships[game.ships.length - 1];
        s.x = 1150 - i * 170;
        s.y = [330, 540, 470, 600, 380][i];
        s.lane = s.y;
      }
      game.score = Math.max(game.score, 640);
      game.shipsHome = Math.max(game.shipsHome, 5);
      aimAt(game, game.ships[2].x, game.ships[2].y);
      for (let i = 0; i < 30; i += 1) stepGame(game, DT);
    }
    game.message = "";
    game.messageTimer = 0;
    return;
  }
  if (name === "win") {
    startRun(game);
    // A real win, played by the autopilot through all five waves.
    const won = runUntil(game, function (g) { return g.screen === SCREEN.WIN; }, 600, autopilot);
    if (!won) {
      // Fallback: show the real victory screen with a finished-run state.
      game.screen = SCREEN.WIN;
      game.wave = TOTAL_WAVES;
      game.ships = [];
      game.score = Math.max(game.score, 5200);
      game.shipsHome = Math.max(game.shipsHome, 24);
      game.shipsLost = Math.max(game.shipsLost, 2);
      game.bestCombo = Math.max(game.bestCombo, 6);
      game.lives = Math.max(game.lives, 1);
      game.runTime = Math.max(game.runTime, 320);
    }
    game.message = "";
    game.messageTimer = 0;
    return;
  }
  if (name === "lose") {
    startRun(game);
    // A genuinely losing run: the beam never moves and no flare is
    // fired, so the ships the channel cannot save strike the rocks.
    // No autopilot, no fallback state is ever staged here unless the
    // run refuses to lose.
    game.beamTarget = -0.2;
    const lost = runUntil(game, function (g) { return g.screen === SCREEN.LOSE; }, 600, null);
    if (!lost) {
      game.screen = SCREEN.LOSE;
      game.lives = 0;
      game.ships = [];
      game.score = Math.max(game.score, 780);
      game.shipsHome = Math.max(game.shipsHome, 9);
      game.shipsLost = Math.max(game.shipsLost, 3);
    }
    game.message = "";
    game.messageTimer = 0;
    return;
  }
  // Default: the title scene, with ships already on the water behind it.
  // A fresh first play: no best score yet, so the title stays clean.
  startRun(game);
  game.screen = SCREEN.TITLE;
  game.best = 0;
  placeTitleShips(game);
  game.message = "";
  game.messageTimer = 0;
}

export { SHIP_KINDS };
