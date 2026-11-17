// Ships: what they are, how the light steers them, and how they are lost.
// A ship in the beam steers for the safe channel and calms down. A ship
// in the dark keeps its lane and its panic grows; at full panic it
// falters, weaves, and speeds up. A ship that touches a rock is lost.
import {
  W, ROCKS, CHANNEL_Y, CHANNEL_HALF, SPAWN_MIN_Y, SPAWN_MAX_Y,
  SHIP_KINDS, COMBO_BONUS, COMBO_CAP, WAVE_WIND,
} from "./config.js";
import { range } from "./rng.js";
import { isLit } from "./beam.js";
import { channelTarget } from "./state.js";

let nextId = 1;

export function spawnShip(game, kind) {
  const def = SHIP_KINDS[kind] || SHIP_KINDS.skiff;
  // Half the ships start in the safe channel, so the keeper's job is the
  // other half: the ones the rocks are waiting for.
  const lane = game.rng() < 0.5
    ? range(game.rng, CHANNEL_Y - CHANNEL_HALF, CHANNEL_Y + CHANNEL_HALF)
    : range(game.rng, SPAWN_MIN_Y, SPAWN_MAX_Y);
  const ship = {
    id: nextId,
    kind: kind,
    x: W + 20 + game.rng() * 60,
    y: lane,
    lane: lane,
    speed: def.speed * (0.92 + game.rng() * 0.16),
    steer: def.steer,
    panicRate: def.panic,
    value: def.value,
    len: def.len,
    panic: 0,
    lit: false,
    faltering: false,
    weave: game.rng() * Math.PI * 2,
    bob: game.rng() * Math.PI * 2,
    resolved: false,
  };
  nextId += 1;
  game.ships.push(ship);
  return ship;
}

// Is this ship already sailing the safe channel?
export function inChannel(ship) {
  return Math.abs(ship.y - CHANNEL_Y) <= CHANNEL_HALF;
}

// How close is this ship to wrecking? 0 = safe, 1 = about to hit a rock.
export function dangerOf(game, ship) {
  let worst = 0;
  for (let i = 0; i < ROCKS.length; i += 1) {
    const r = ROCKS[i];
    const dx = ship.x - r.x;
    const dy = ship.y - r.y;
    const d = Math.sqrt(dx * dx + dy * dy) - r.r;
    const danger = 1 - Math.max(0, Math.min(1, d / 220));
    if (danger > worst) worst = danger;
  }
  return worst;
}

// One simulation step for one ship. Returns "home", "wreck", or null.
export function stepShip(game, ship, dt) {
  const def = SHIP_KINDS[ship.kind];
  ship.lit = isLit(game, ship);
  if (ship.lit) {
    ship.panic = Math.max(0, ship.panic - 0.55 * dt);
    // Steer for the middle of the channel.
    const target = channelTarget();
    const dy = target - ship.y;
    const step = ship.steer * dt;
    if (Math.abs(dy) <= step) ship.y = target;
    else ship.y += dy > 0 ? step : -step;
  } else {
    // Panic grows as the rocks get closer: a ship far out at sea is
    // calm, a ship near the rocks is afraid.
    ship.panic = Math.min(1, ship.panic + ship.panicRate * (0.15 + dangerOf(game, ship) * 1.2) * dt);
    // A dark ship holds its course: it keeps the y the light gave it.
    // It never drifts back to its lane — the light's steering is
    // permanent, or the game would be unwinnable.
  }
  // The storm pushes every ship sideways (waves 4-5): the last wave
  // has to be worked, not watched.
  const windAmp = WAVE_WIND[Math.max(0, Math.min(WAVE_WIND.length - 1, game.wave - 1))];
  if (windAmp > 0) {
    ship.y += Math.sin(game.time * 0.5) * windAmp * dt;
  }
  ship.faltering = ship.panic >= 1;
  let speed = ship.speed * (ship.lit ? 1.35 : 1);
  if (ship.faltering) {
    speed *= 1.25;
    ship.weave += dt * 3.2;
    ship.y += Math.sin(ship.weave) * 18 * dt;
  }
  ship.x -= speed * dt;
  ship.bob += dt;

  // Rocks.
  for (let i = 0; i < ROCKS.length; i += 1) {
    const r = ROCKS[i];
    const dx = ship.x - r.x;
    const dy = ship.y - r.y;
    if (dx * dx + dy * dy < (r.r + 13) * (r.r + 13)) {
      ship.resolved = true;
      return "wreck";
    }
  }
  // Home: crossed the harbour mouth.
  if (ship.x <= 115) {
    ship.resolved = true;
    return "home";
  }
  return null;
}

// Score a ship that made it home. The combo pays for a clean run.
export function scoreHome(game, ship) {
  game.shipsHome += 1;
  game.combo += 1;
  if (game.combo > game.bestCombo) game.bestCombo = game.combo;
  const comboPay = Math.min(game.combo - 1, COMBO_CAP) * COMBO_BONUS;
  game.score += ship.value + comboPay;
}

// A ship is lost: the combo breaks and a life goes with it.
export function scoreWreck(game, ship) {
  game.shipsLost += 1;
  game.combo = 0;
  game.lives -= 1;
}
