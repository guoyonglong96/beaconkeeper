// The simulation step: waves, spawning, the beam, the ships, and the
// win/lose edges. Everything the game does in a frame passes through here.
import {
  SCREEN, startWave, waveCleared, saveBest,
} from "./state.js";
import {
  TOTAL_WAVES, WAVE_SPAWN_GAP, WAVE_BONUS, WIN_BONUS, WIN_LIFE_BONUS,
  FLARE_MAX, CALM_SECONDS, WAVE_NAMES,
} from "./config.js";
import { spawnShip, stepShip, scoreHome, scoreWreck } from "./ships.js";
import { stepBeam } from "./beam.js";

const DT_MAX = 0.05;

export function stepGame(game, dt) {
  if (dt > DT_MAX) dt = DT_MAX;
  game.time += dt;

  // Feedback timers decay on every screen.
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 2.2);
  if (game.flash > 0) game.flash = Math.max(0, game.flash - dt * 1.6);
  if (game.bannerTimer > 0) game.bannerTimer -= dt;
  if (game.messageTimer > 0) game.messageTimer -= dt;
  stepParticles(game, dt);

  if (game.screen === SCREEN.TITLE) {
    // Attract mode: the beam sweeps on its own over a quiet sea.
    game.beamTarget = 0.45 + Math.sin(game.time * 0.25) * 0.55;
    stepBeam(game, dt);
    for (let i = 0; i < game.ships.length; i += 1) {
      const s = game.ships[i];
      s.x -= s.speed * 0.5 * dt;
      if (s.x < -120) {
        s.x = 1360;
        s.y = 300 + game.rng() * 240;
        s.lane = s.y;
      }
    }
    return;
  }

  if (game.screen === SCREEN.WIN || game.screen === SCREEN.LOSE) {
    stepBeam(game, dt);
    return;
  }

  // PLAY.
  game.runTime += dt;
  stepBeam(game, dt);

  if (game.calm > 0) {
    game.calm -= dt;
    if (game.calm <= 0) {
      game.calm = 0;
      beginWave(game);
    }
    return;
  }

  // Spawning.
  if (game.spawnQueue.length > 0) {
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      spawnShip(game, game.spawnQueue.shift());
      const idx = Math.max(0, Math.min(WAVE_SPAWN_GAP.length - 1, game.wave - 1));
      game.spawnTimer = WAVE_SPAWN_GAP[idx];
    }
  }

  // Ships.
  for (let i = game.ships.length - 1; i >= 0; i -= 1) {
    const ship = game.ships[i];
    const outcome = stepShip(game, ship, dt);
    if (outcome === "home") {
      scoreHome(game, ship);
      burst(game, ship.x, ship.y, "#ffd76a", 14);
      game.ships.splice(i, 1);
    } else if (outcome === "wreck") {
      scoreWreck(game, ship);
      burst(game, ship.x, ship.y, "#e2574c", 22);
      burst(game, ship.x, ship.y, "#ffffff", 10);
      game.shake = 1;
      game.flash = 0.7;
      game.ships.splice(i, 1);
      if (game.lives <= 0) {
        endRun(game, false);
        return;
      }
    }
  }

  // Wave done: every ship resolved.
  if (waveCleared(game)) {
    if (game.wave >= TOTAL_WAVES) {
      endRun(game, true);
      return;
    }
    game.score += WAVE_BONUS * game.wave;
    if (game.flares < FLARE_MAX) game.flares += 1;
    game.banner = `WAVE ${game.wave} CLEAR  ·  +${WAVE_BONUS * game.wave}`;
    game.bannerTimer = 2.2;
    game.calm = CALM_SECONDS;
    startWave(game);
  }
}

function beginWave(game) {
  game.banner = `WAVE ${game.wave} — ${WAVE_NAMES[game.wave - 1] || ""}`;
  game.bannerTimer = 2.6;
}

function endRun(game, won) {
  if (won) {
    game.score += WIN_BONUS + WIN_LIFE_BONUS * game.lives;
    game.screen = SCREEN.WIN;
  } else {
    game.screen = SCREEN.LOSE;
  }
  saveBest(game);
}

// Particles: small sparks and foam that fade out.
export function burst(game, x, y, color, n) {
  for (let i = 0; i < n; i += 1) {
    const a = game.rng() * Math.PI * 2;
    const sp = 40 + game.rng() * 130;
    game.particles.push({
      x: x, y: y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
      life: 0.5 + game.rng() * 0.5, max: 1,
      color: color, size: 2 + game.rng() * 3,
    });
  }
  if (game.particles.length > 220) {
    game.particles.splice(0, game.particles.length - 220);
  }
}

function stepParticles(game, dt) {
  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    const p = game.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 160 * dt;
    if (p.life <= 0) game.particles.splice(i, 1);
  }
}
