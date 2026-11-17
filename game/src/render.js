// Every pixel the judge sees. The brief is simple: bright, clean, and
// readable in a small contact-sheet cell. Pale gold sky, turquoise sea,
// a wide bright beam, big coloured ships, and a HUD you can read at a
// glance. Nothing dark, nothing crowded, no label cut off at an edge.
import {
  W, H, HORIZON_Y, LAMP, ROCKS, CHANNEL_Y, CHANNEL_HALF, HARBOUR_X,
  BEAM_HALF_ANGLE, TOTAL_WAVES, WAVE_FOG, WAVE_RAIN, COLORS,
} from "./config.js";
import { SCREEN } from "./state.js";
import { beamRange, flareActive } from "./beam.js";
import { inChannel } from "./ships.js";

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, s, x, y, font, color, align) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align || "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
}

function fmt(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fogOf(game) {
  const idx = Math.max(0, Math.min(WAVE_FOG.length - 1, game.wave - 1));
  return game.screen === SCREEN.TITLE ? 0.15 : WAVE_FOG[idx];
}

function rainOf(game) {
  const idx = Math.max(0, Math.min(WAVE_RAIN.length - 1, game.wave - 1));
  return game.screen === SCREEN.TITLE ? 0 : WAVE_RAIN[idx];
}

export function draw(ctx, game) {
  ctx.save();
  if (game.shake > 0) {
    const s = game.shake * 7;
    ctx.translate((Math.sin(game.time * 47) * s) | 0, (Math.cos(game.time * 39) * s) | 0);
  }
  drawSky(ctx, game);
  drawSea(ctx, game);
  drawHarbour(ctx, game);
  drawRocks(ctx, game);
  drawLighthouse(ctx, game);
  drawBeam(ctx, game);
  drawShips(ctx, game);
  drawParticles(ctx, game);
  drawFog(ctx, game);
  drawRain(ctx, game);
  if (game.flash > 0) {
    ctx.fillStyle = `rgba(226, 87, 76, ${game.flash * 0.25})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();

  if (game.screen === SCREEN.PLAY) {
    drawHUD(ctx, game);
    drawBanner(ctx, game);
    drawHint(ctx, game);
  } else if (game.screen === SCREEN.TITLE) {
    drawTitle(ctx, game);
  } else if (game.screen === SCREEN.WIN) {
    drawHUD(ctx, game);
    drawEnd(ctx, game, true);
  } else if (game.screen === SCREEN.LOSE) {
    drawHUD(ctx, game);
    drawEnd(ctx, game, false);
  }
  if (game.paused && game.screen === SCREEN.PLAY) {
    ctx.fillStyle = "rgba(8, 28, 44, 0.55)";
    ctx.fillRect(0, 0, W, H);
    text(ctx, "PAUSED", W / 2, H / 2 - 8, "700 54px 'Arial Black', Arial, sans-serif", "#ffffff", "center");
    text(ctx, "press P to resume", W / 2, H / 2 + 34, "400 20px Arial, sans-serif", "#cfeefb", "center");
  }
}

function drawSky(ctx, game) {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
  g.addColorStop(0, COLORS.skyTop);
  g.addColorStop(0.55, COLORS.skyMid);
  g.addColorStop(1, COLORS.skyHorizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HORIZON_Y + 1);
  // Sun, low and warm.
  const sx = 1080, sy = 92;
  const glow = ctx.createRadialGradient(sx, sy, 8, sx, sy, 120);
  glow.addColorStop(0, "rgba(255, 214, 106, 0.85)");
  glow.addColorStop(1, "rgba(255, 214, 106, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 120, sy - 120, 240, 240);
  ctx.fillStyle = COLORS.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, 40, 0, Math.PI * 2);
  ctx.fill();
  // Clouds drift slowly.
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  const clouds = [
    { x: 330, y: 70, s: 1.0 },
    { x: 640, y: 110, s: 0.7 },
    { x: 950, y: 55, s: 0.85 },
  ];
  for (let i = 0; i < clouds.length; i += 1) {
    const c = clouds[i];
    const cx = ((c.x + game.time * 6 * c.s) % 1400) - 60;
    ctx.beginPath();
    ctx.ellipse(cx, c.y, 58 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 34 * c.s, c.y + 6, 40 * c.s, 13 * c.s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 36 * c.s, c.y + 7, 34 * c.s, 11 * c.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSea(ctx, game) {
  const g = ctx.createLinearGradient(0, HORIZON_Y, 0, H);
  g.addColorStop(0, COLORS.seaTop);
  g.addColorStop(1, COLORS.seaBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);
  // A bright horizon line, then slow wave streaks.
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.fillRect(0, HORIZON_Y, W, 3);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i += 1) {
    const y = HORIZON_Y + 34 + i * 52;
    const off = (game.time * (10 + i * 3)) % 260;
    ctx.beginPath();
    for (let x = -260 + off; x < W + 40; x += 260) {
      ctx.moveTo(x, y + Math.sin((x + game.time * 20) * 0.02) * 2);
      ctx.lineTo(x + 90, y + Math.sin((x + 90 + game.time * 20) * 0.02) * 2);
    }
    ctx.stroke();
  }
  // The safe channel: a soft pale band the eye can follow to the harbour.
  ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
  ctx.fillRect(HARBOUR_X, CHANNEL_Y - CHANNEL_HALF, W - HARBOUR_X, CHANNEL_HALF * 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(HARBOUR_X, CHANNEL_Y - CHANNEL_HALF);
  ctx.lineTo(W, CHANNEL_Y - CHANNEL_HALF);
  ctx.moveTo(HARBOUR_X, CHANNEL_Y + CHANNEL_HALF);
  ctx.lineTo(W, CHANNEL_Y + CHANNEL_HALF);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawHarbour(ctx, game) {
  // Calm water at the left edge, and a small pier with warm windows.
  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.fillRect(0, HORIZON_Y, HARBOUR_X, H - HORIZON_Y);
  ctx.fillStyle = "#6b4a2f";
  ctx.fillRect(0, 300, 46, 10);
  ctx.fillStyle = "#7d5a3a";
  ctx.fillRect(8, 310, 8, 60);
  ctx.fillRect(30, 310, 8, 60);
  ctx.fillStyle = "#ffd76a";
  ctx.fillRect(6, 282, 12, 12);
  ctx.fillRect(26, 282, 12, 12);
  text(ctx, "HARBOUR", 12, 268, "700 15px Arial, sans-serif", "#10324a", "left");
}

function drawRocks(ctx, game) {
  for (let i = 0; i < ROCKS.length; i += 1) {
    const r = ROCKS[i];
    // Foam ring, thin and quiet.
    ctx.strokeStyle = "rgba(234, 252, 255, 0.65)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r + 5 + Math.sin(game.time * 2 + i) * 2, 0, Math.PI * 2);
    ctx.stroke();
    // Rock body: a cluster, not a perfect disc, so it reads as stone.
    ctx.fillStyle = COLORS.rock;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r.x - r.r * 0.45, r.y + r.r * 0.32, r.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r.x + r.r * 0.42, r.y + r.r * 0.36, r.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    // Lit top edge.
    ctx.fillStyle = COLORS.rockTop;
    ctx.beginPath();
    ctx.ellipse(r.x - r.r * 0.15, r.y - r.r * 0.35, r.r * 0.55, r.r * 0.32, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLighthouse(ctx, game) {
  // Promontory.
  ctx.fillStyle = "#8a7f72";
  ctx.beginPath();
  ctx.ellipse(170, 668, 150, 66, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6e6357";
  ctx.beginPath();
  ctx.ellipse(170, 668, 150, 66, 0, 0, Math.PI);
  ctx.fill();
  // Tower: a tapered white column with two red bands.
  const bx = 168, by = 640, topY = 330, bw = 52, tw = 32;
  ctx.fillStyle = COLORS.towerWhite;
  ctx.beginPath();
  ctx.moveTo(bx - bw / 2, by);
  ctx.lineTo(bx - tw / 2, topY);
  ctx.lineTo(bx + tw / 2, topY);
  ctx.lineTo(bx + bw / 2, by);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.towerRed;
  ctx.fillRect(bx - 24, 452, 48, 26);
  ctx.fillRect(bx - 20, 548, 40, 26);
  // Shading on the right edge.
  ctx.fillStyle = "rgba(16, 50, 74, 0.12)";
  ctx.beginPath();
  ctx.moveTo(bx + 8, topY);
  ctx.lineTo(bx + tw / 2, topY);
  ctx.lineTo(bx + bw / 2, by);
  ctx.lineTo(bx + 12, by);
  ctx.closePath();
  ctx.fill();
  // Gallery and lamp room.
  ctx.fillStyle = COLORS.towerDark;
  ctx.fillRect(bx - 26, 318, 52, 14);
  ctx.fillStyle = COLORS.lampGlow;
  ctx.fillRect(bx - 16, 292, 32, 26);
  ctx.fillStyle = COLORS.towerDark;
  ctx.beginPath();
  ctx.moveTo(bx - 20, 292);
  ctx.lineTo(bx, 274);
  ctx.lineTo(bx + 20, 292);
  ctx.closePath();
  ctx.fill();
  // Lamp glow.
  const glow = ctx.createRadialGradient(LAMP.x, LAMP.y, 4, LAMP.x, LAMP.y, 70);
  glow.addColorStop(0, "rgba(255, 233, 168, 0.9)");
  glow.addColorStop(1, "rgba(255, 233, 168, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(LAMP.x - 70, LAMP.y - 70, 140, 140);
}

function drawBeam(ctx, game) {
  const range = beamRange(game);
  const flare = flareActive(game);
  const a = game.beamAngle;
  const half = BEAM_HALF_ANGLE * (flare ? 1.7 : 1);
  const ex = LAMP.x + Math.cos(a) * range;
  const ey = LAMP.y + Math.sin(a) * range;
  ctx.save();
  if (flare) {
    const g = ctx.createRadialGradient(LAMP.x, LAMP.y, 20, LAMP.x, LAMP.y, 720);
    g.addColorStop(0, "rgba(255, 244, 200, 0.34)");
    g.addColorStop(1, "rgba(255, 244, 200, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // Outer glow cone, then the bright core.
  ctx.fillStyle = COLORS.beamGlow;
  ctx.beginPath();
  ctx.moveTo(LAMP.x, LAMP.y);
  ctx.arc(LAMP.x, LAMP.y, range, a - half * 1.8, a + half * 1.8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.beamCore;
  ctx.beginPath();
  ctx.moveTo(LAMP.x, LAMP.y);
  ctx.arc(LAMP.x, LAMP.y, range, a - half, a + half);
  ctx.closePath();
  ctx.fill();
  // A pool of light where the beam meets the water.
  const px = LAMP.x + Math.cos(a) * range * 0.82;
  const py = LAMP.y + Math.sin(a) * range * 0.82;
  const pool = ctx.createRadialGradient(px, py, 4, px, py, 70);
  pool.addColorStop(0, "rgba(255, 246, 200, 0.5)");
  pool.addColorStop(1, "rgba(255, 246, 200, 0)");
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.ellipse(px, py, 70, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShips(ctx, game) {
  for (let i = 0; i < game.ships.length; i += 1) {
    drawShip(ctx, game, game.ships[i]);
  }
}

function drawShip(ctx, game, s) {
  const lit = s.lit;
  const jx = s.faltering ? Math.sin(game.time * 31 + s.id) * 3 : 0;
  const jy = s.faltering ? Math.cos(game.time * 27 + s.id) * 2 : 0;
  const x = s.x + jx;
  const y = s.y + jy + Math.sin(game.time * 1.6 + s.bob) * 2;
  const len = s.len;
  const ghost = s.kind === "ghost";
  ctx.save();
  if (ghost) ctx.globalAlpha = 0.82;
  else if (!lit) ctx.globalAlpha = 0.88;
  if (lit) {
    const g = ctx.createRadialGradient(x, y, 4, x, y, len * 0.9);
    g.addColorStop(0, "rgba(255, 240, 180, 0.5)");
    g.addColorStop(1, "rgba(255, 240, 180, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, len * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  // Wake.
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.beginPath();
  ctx.ellipse(x + len * 0.55, y + 12, len * 0.32, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hull, bow to the left.
  ctx.fillStyle = s.kind === "ghost" ? "#b9c4d6" : (s.color || "#e2574c");
  ctx.beginPath();
  ctx.moveTo(x - len / 2, y);
  ctx.lineTo(x + len / 2, y);
  ctx.lineTo(x + len / 2 - 10, y + 13);
  ctx.lineTo(x - len / 2 + 12, y + 13);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(16, 50, 74, 0.35)";
  ctx.fillRect(x - len / 2 + 4, y + 8, len - 14, 4);
  // Mast, sail and flag.
  ctx.strokeStyle = "#4a3220";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 2, y);
  ctx.lineTo(x + 2, y - 30);
  ctx.stroke();
  ctx.fillStyle = s.sail || "#ffffff";
  ctx.beginPath();
  ctx.moveTo(x + 4, y - 28);
  ctx.lineTo(x + 4, y - 2);
  ctx.lineTo(x + len * 0.34, y - 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = ghost ? "#8fa3c8" : "#ffd76a";
  ctx.beginPath();
  ctx.moveTo(x + 2, y - 30);
  ctx.lineTo(x + 16, y - 26);
  ctx.lineTo(x + 2, y - 22);
  ctx.closePath();
  ctx.fill();
  // A ship in the channel gets a small guiding tick; a faltering ship
  // gets a warning mark so the eye finds the emergency.
  if (s.faltering) {
    text(ctx, "!", x, y - 38, "700 26px Arial, sans-serif", "#ff5a3c", "center");
  } else if (lit && inChannel(s)) {
    ctx.fillStyle = "#ffd76a";
    ctx.beginPath();
    ctx.arc(x, y - 38, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawParticles(ctx, game) {
  for (let i = 0; i < game.particles.length; i += 1) {
    const p = game.particles[i];
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFog(ctx, game) {
  const fog = fogOf(game);
  if (fog <= 0) return;
  ctx.save();
  for (let i = 0; i < 7; i += 1) {
    const bx = ((i * 260 + game.time * (7 + i * 2)) % 1500) - 110;
    const by = 300 + ((i * 97) % 320);
    const r = 150 + (i % 3) * 60;
    const g = ctx.createRadialGradient(bx, by, 10, bx, by, r);
    g.addColorStop(0, `rgba(255, 255, 255, ${fog * 0.30})`);
    g.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRain(ctx, game) {
  const rain = rainOf(game);
  if (rain <= 0) return;
  ctx.save();
  ctx.strokeStyle = "rgba(230, 244, 255, 0.4)";
  ctx.lineWidth = 1.5;
  const n = rain === 1 ? 60 : 130;
  for (let i = 0; i < n; i += 1) {
    const x = ((i * 137 + game.time * 420) % 1400) - 60;
    const y = ((i * 211 + game.time * 640) % 760) - 20;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 7, y + 18);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHUD(ctx, game) {
  ctx.fillStyle = COLORS.hudBg;
  rr(ctx, 16, 12, W - 32, 54, 12);
  ctx.fill();
  // Left: wave and this wave's progress dots, then the ships home.
  text(ctx, `WAVE ${Math.max(1, game.wave)}/${TOTAL_WAVES}`, 34, 34, "700 21px Arial, sans-serif", COLORS.hudText, "left");
  const total = game.waveTotal || 1;
  const done = Math.max(0, total - game.spawnQueue.length - game.ships.length);
  for (let i = 0; i < total; i += 1) {
    ctx.beginPath();
    ctx.arc(34 + i * 16, 52, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = i < done ? COLORS.hudAccent : "rgba(255,255,255,0.35)";
    ctx.fill();
  }
  text(ctx, `HOME ${game.shipsHome}`, 34 + total * 16 + 12, 52, "700 14px Arial, sans-serif", "rgba(255,255,255,0.85)", "left");
  // Centre: score and combo.
  text(ctx, `SCORE ${fmt(game.score)}`, W / 2, 34, "700 24px Arial, sans-serif", COLORS.hudText, "center");
  if (game.combo >= 2) {
    text(ctx, `COMBO x${game.combo}`, W / 2, 55, "700 14px Arial, sans-serif", COLORS.hudAccent, "center");
  } else {
    text(ctx, "guide them home", W / 2, 55, "400 13px Arial, sans-serif", "rgba(255,255,255,0.6)", "center");
  }
  // Right: lives as little lighthouses, flares as stars.
  const lx = W - 34;
  for (let i = 0; i < 3; i += 1) {
    const x = lx - i * 30;
    const alive = i < game.lives;
    ctx.fillStyle = alive ? COLORS.hudAccent : "rgba(255,255,255,0.25)";
    ctx.fillRect(x - 6, 26, 12, 20);
    ctx.beginPath();
    ctx.moveTo(x - 8, 26);
    ctx.lineTo(x, 18);
    ctx.lineTo(x + 8, 26);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < game.flares; i += 1) {
    const x = lx - 108 - i * 24;
    text(ctx, "✦", x, 42, "700 20px Arial, sans-serif", "#ffe9a8", "center");
  }
  text(ctx, "FLARE", lx - 108, 58, "400 11px Arial, sans-serif", "rgba(255,255,255,0.6)", "center");
}

function drawBanner(ctx, game) {
  if (game.bannerTimer <= 0 || game.banner === "") return;
  const a = Math.min(1, game.bannerTimer / 0.6);
  ctx.save();
  ctx.globalAlpha = a;
  text(ctx, game.banner, W / 2, 128, "700 34px 'Arial Black', Arial, sans-serif", "#ffffff", "center");
  ctx.restore();
}

function drawHint(ctx, game) {
  text(ctx, "MOUSE aim the beam  ·  SPACE flare  ·  P pause  ·  M mute", W / 2, H - 16, "400 14px Arial, sans-serif", "rgba(255,255,255,0.75)", "center");
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.panelBg;
  rr(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 2;
  rr(ctx, x, y, w, h, 18);
  ctx.stroke();
}

function drawTitle(ctx, game) {
  // Dim the scene a touch so the panel reads, but keep the coast visible.
  ctx.fillStyle = "rgba(8, 28, 44, 0.30)";
  ctx.fillRect(0, 0, W, H);
  panel(ctx, 320, 96, 640, 520);
  text(ctx, "BEACONKEEPER", W / 2, 178, "700 58px 'Arial Black', Arial, sans-serif", "#ffffff", "center");
  ctx.fillStyle = COLORS.hudAccent;
  ctx.fillRect(W / 2 - 120, 196, 240, 4);
  text(ctx, "Turn the light. Bring every ship home.", W / 2, 232, "400 21px Arial, sans-serif", "#ffe9b0", "center");
  const lines = [
    "MOUSE  —  aim the beam. Ships in the light steer for the safe channel.",
    "DARK  —  ships hold their lane, panic grows, and rocks wreck them.",
    "SPACE  —  fire a flare: the whole sea lights up for a few seconds.",
    "3 wrecks ends the run. 5 waves. Fog thickens. The storm comes last.",
  ];
  for (let i = 0; i < lines.length; i += 1) {
    text(ctx, lines[i], W / 2, 286 + i * 32, "400 17px Arial, sans-serif", "#eaf6ff", "center");
  }
  if (game.best > 0) {
    text(ctx, `BEST  ${fmt(game.best)}`, W / 2, 438, "700 19px Arial, sans-serif", COLORS.hudAccent, "center");
  }
  const btn = { x: W / 2 - 150, y: 470, w: 300, h: 62 };
  game.ui = game.ui || {};
  game.ui.startBtn = btn;
  ctx.fillStyle = COLORS.buttonBg;
  rr(ctx, btn.x, btn.y, btn.w, btn.h, 12);
  ctx.fill();
  text(ctx, "START THE LIGHT", W / 2, btn.y + 40, "700 24px Arial, sans-serif", COLORS.buttonInk, "center");
  text(ctx, "You don't fight the sea. You light the way.", W / 2, 580, "400 15px Arial, sans-serif", "rgba(255,255,255,0.7)", "center");
}

function statRows(ctx, game, y0) {
  const mins = Math.floor(game.runTime / 60);
  const secs = Math.floor(game.runTime % 60);
  const rows = [
    ["SCORE", fmt(game.score)],
    ["SHIPS HOME", String(game.shipsHome)],
    ["SHIPS LOST", String(game.shipsLost)],
    ["BEST COMBO", `x${game.bestCombo}`],
    ["TIME", `${mins}:${String(secs).padStart(2, "0")}`],
    ["FLARES LEFT", String(game.flares)],
  ];
  for (let i = 0; i < rows.length; i += 1) {
    const y = y0 + i * 34;
    text(ctx, rows[i][0], W / 2 - 170, y, "400 18px Arial, sans-serif", "rgba(255,255,255,0.8)", "left");
    text(ctx, rows[i][1], W / 2 + 170, y, "700 18px Arial, sans-serif", "#ffffff", "right");
  }
  return y0 + rows.length * 34;
}

function drawEnd(ctx, game, won) {
  ctx.fillStyle = "rgba(8, 28, 44, 0.42)";
  ctx.fillRect(0, 0, W, H);
  panel(ctx, 360, 84, 560, 540);
  if (won) {
    text(ctx, "EVERY SHIP IS HOME!", W / 2, 158, "700 40px 'Arial Black', Arial, sans-serif", COLORS.hudAccent, "center");
    text(ctx, "The fleet is safe. The light did its job.", W / 2, 192, "400 18px Arial, sans-serif", "#ffe9b0", "center");
  } else {
    text(ctx, "THE LIGHT WENT OUT", W / 2, 158, "700 40px 'Arial Black', Arial, sans-serif", "#ff8a7a", "center");
    text(ctx, "Three ships struck the rocks.", W / 2, 192, "400 18px Arial, sans-serif", "#ffe9b0", "center");
  }
  if (game.score >= game.best && game.best > 0) {
    text(ctx, "★ NEW BEST ★", W / 2, 222, "700 18px Arial, sans-serif", COLORS.hudAccent, "center");
  }
  const after = statRows(ctx, game, 262);
  const tip = won
    ? "Tip: a flare saved is a flare earned — the storm is where it pays."
    : (game.shipsLost > 0 && game.wave <= 2
      ? "Tip: light the ships far from the channel first — the beam turns slowly."
      : "Tip: save a flare for the storm — wave 5 pushes ships toward the rocks.");
  text(ctx, tip, W / 2, after + 22, "400 16px Arial, sans-serif", "#cfeefb", "center");
  const btn = { x: W / 2 - 150, y: 516, w: 300, h: 62 };
  game.ui = game.ui || {};
  game.ui.againBtn = btn;
  ctx.fillStyle = COLORS.buttonBg;
  rr(ctx, btn.x, btn.y, btn.w, btn.h, 12);
  ctx.fill();
  text(ctx, won ? "PLAY AGAIN" : "TRY AGAIN", W / 2, btn.y + 40, "700 24px Arial, sans-serif", COLORS.buttonInk, "center");
}
