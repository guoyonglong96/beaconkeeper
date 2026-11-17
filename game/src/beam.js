// The lighthouse beam: where it points, how fast it turns, and the flare.
// The beam is the whole game: it turns slowly, so the player has to plan
// which ship to light next instead of snapping across the sea.
import {
  LAMP, BEAM_RANGE, BEAM_HALF_ANGLE, BEAM_SWEEP_RATE,
  FLARE_DURATION, FLARE_COOLDOWN,
} from "./config.js";
import { clampBeamAngle } from "./state.js";

export function beamRange(game) {
  const idx = Math.max(0, Math.min(BEAM_RANGE.length - 1, game.wave - 1));
  return BEAM_RANGE[idx];
}

// Turn the beam toward its target angle, at the fixed sweep rate.
export function stepBeam(game, dt) {
  const diff = game.beamTarget - game.beamAngle;
  const maxStep = BEAM_SWEEP_RATE * dt;
  if (Math.abs(diff) <= maxStep) {
    game.beamAngle = game.beamTarget;
  } else {
    game.beamAngle += diff > 0 ? maxStep : -maxStep;
  }
  game.beamAngle = clampBeamAngle(game.beamAngle);
  if (game.flareTimer > 0) game.flareTimer -= dt;
  if (game.flareCooldown > 0) game.flareCooldown -= dt;
}

// Aim the beam at a point on the sea (mouse, or an autopilot's ship).
export function aimAt(game, x, y) {
  const a = Math.atan2(y - LAMP.y, x - LAMP.x);
  game.beamTarget = clampBeamAngle(a);
  game.beamSweeping = true;
}

// Rotate the beam by keys (left/right), relative to its current target.
export function nudgeBeam(game, dir, dt) {
  game.beamTarget = clampBeamAngle(game.beamTarget + dir * BEAM_SWEEP_RATE * dt);
  game.beamSweeping = true;
}

// Is the point (x, y) inside the beam cone right now?
export function inBeam(game, x, y) {
  const dx = x - LAMP.x;
  const dy = y - LAMP.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > beamRange(game)) return false;
  const a = Math.atan2(dy, dx);
  let diff = a - game.beamAngle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= BEAM_HALF_ANGLE;
}

// A ship is lit when the flare is up, or when the beam is on it.
export function isLit(game, ship) {
  if (game.flareTimer > 0) return true;
  return inBeam(game, ship.x, ship.y);
}

export function fireFlare(game) {
  if (game.flares <= 0) return false;
  if (game.flareCooldown > 0) return false;
  if (game.flareTimer > 0) return false;
  game.flares -= 1;
  game.flareTimer = FLARE_DURATION;
  game.flareCooldown = FLARE_COOLDOWN;
  return true;
}

export function flareActive(game) {
  return game.flareTimer > 0;
}
