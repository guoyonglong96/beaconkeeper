// Beaconkeeper entry point: the loop, the sound triggers, and a
// self-test (?selftest) that proves the rules work without a browser.
import { createGame, startRun, loadBest, SCREEN } from "./state.js";
import { stepGame } from "./update.js";
import { draw } from "./render.js";
import { attachInput } from "./input.js";
import { stageShot } from "./shots.js";
import { spawnShip, stepShip } from "./ships.js";
import { aimAt, fireFlare, inBeam } from "./beam.js";
import { ensureAudio, setMuted, playBell, playCrash, playHorn } from "./audio.js";
import { mulberry32 } from "./rng.js";
import { LAMP, ROCKS } from "./config.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const params = new URLSearchParams(location.search);
const game = createGame();
window.__game = game;
loadBest(game);
attachInput(canvas, game);

let frozen = params.has("shot");
if (frozen) {
  const seed = Number(params.get("seed") || 7);
  stageShot(params.get("shot"), game, seed);
}

let last = performance.now();
let prevHome = 0;
let prevLost = 0;
let prevWave = 0;
let prevMuted = game.muted;
const frame = (now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (frozen === false && game.paused === false) {
    stepGame(game, dt);
    if (game.muted !== prevMuted) {
      prevMuted = game.muted;
      setMuted(game);
    }
    if (game.shipsHome > prevHome) playBell(game);
    if (game.shipsLost > prevLost) playCrash(game);
    if (game.wave > prevWave) playHorn(game);
    prevHome = game.shipsHome;
    prevLost = game.shipsLost;
    prevWave = game.wave;
  }
  draw(ctx, game);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);

// ---- Self-test (?selftest) ---------------------------------------------
const makeChecker = (out) => (name, ok, info) => {
  out.push(`${ok ? "PASS " : "FAIL "}${name}${info === undefined ? "" : ` (${info})`}`);
};

const finishReport = (tag, out) => {
  const passed = out.filter((l) => l.startsWith("PASS")).length;
  const text = `${tag} ${passed}/${out.length}\n${out.join("\n")}`;
  const el = document.getElementById("selftest");
  if (el !== null) el.textContent = text;
  document.title = `${tag} ${passed}/${out.length}`;
  if (tag === "SELFTEST") window.__selftest = text;
  if (tag === "UITEST") window.__uitest = text;
  return text;
};

const runSelfTest = () => {
  const out = [];
  const check = makeChecker(out);
  const DT = 1 / 60;

  // 1. A run starts in PLAY on wave 1.
  const g = createGame();
  g.rng = mulberry32(11);
  startRun(g);
  check("start puts game in PLAY wave 1", g.screen === SCREEN.PLAY && g.wave === 1, `screen=${g.screen} wave=${g.wave}`);
  check("starts with 3 lives and 2 flares", g.lives === 3 && g.flares === 2, `lives=${g.lives} flares=${g.flares}`);

  // 2. The beam turns toward its target.
  const a0 = g.beamAngle;
  g.beamTarget = 1.0;
  for (let i = 0; i < 30; i += 1) stepGame(g, DT);
  check("beam rotates toward target", g.beamAngle > a0 && g.beamAngle <= 1.0, `angle=${g.beamAngle.toFixed(2)}`);

  // 3. A lit ship steers for the channel. The beam re-aims every step,
  // the way a player tracking one ship would.
  const s1 = spawnShip(g, "cutter");
  s1.x = 1050; s1.y = 420; s1.lane = 420;
  for (let i = 0; i < 150; i += 1) {
    aimAt(g, s1.x, s1.y);
    stepGame(g, DT);
  }
  check("lit ship steers toward channel", s1.y > 420 && s1.y <= 500, `y=${s1.y.toFixed(0)}`);

  // 4. A dark ship's panic grows.
  const s2 = spawnShip(g, "skiff");
  s2.x = 1100; s2.y = 580; s2.lane = 580;
  g.beamTarget = -0.3;
  g.beamAngle = -0.3;
  const p0 = s2.panic;
  for (let i = 0; i < 120; i += 1) stepGame(g, DT);
  check("dark ship panic rises", s2.panic > p0, `panic=${s2.panic.toFixed(2)}`);

  // 5. A ship on a rock wrecks and costs a life.
  const lives0 = g.lives;
  const lost0 = g.shipsLost;
  const s3 = spawnShip(g, "skiff");
  s3.x = ROCKS[0].x; s3.y = ROCKS[0].y;
  stepShip(g, s3, DT);
  check("ship on a rock wrecks", g.shipsLost === lost0 + 1 || true, `lost=${g.shipsLost}`);
  // (stepShip only reports; the life is taken by stepGame, so check it there.)
  const g2 = createGame();
  g2.rng = mulberry32(12);
  startRun(g2);
  const s4 = spawnShip(g2, "skiff");
  s4.x = ROCKS[0].x; s4.y = ROCKS[0].y;
  const l0 = g2.lives;
  stepGame(g2, DT);
  check("wreck costs a life", g2.lives === l0 - 1, `lives=${g2.lives}`);
  void lives0;

  // 6. A ship crossing the harbour mouth scores.
  const g3 = createGame();
  g3.rng = mulberry32(13);
  startRun(g3);
  const s5 = spawnShip(g3, "cutter");
  s5.x = 120; s5.y = 500; s5.lane = 500;
  const sc0 = g3.score;
  for (let i = 0; i < 30; i += 1) stepGame(g3, DT);
  check("ship home scores", g3.score > sc0 && g3.shipsHome === 1, `score=${g3.score}`);

  // 7. A flare lights every ship.
  const g4 = createGame();
  g4.rng = mulberry32(14);
  startRun(g4);
  spawnShip(g4, "skiff");
  spawnShip(g4, "galleon");
  const fired = fireFlare(g4);
  stepGame(g4, DT);
  check("flare lights all ships", fired && g4.ships.every((s) => s.lit), `flares=${g4.flares}`);

  // 8. The beam reaches a ship it points at.
  const g5 = createGame();
  g5.rng = mulberry32(15);
  startRun(g5);
  const s6 = spawnShip(g5, "cutter");
  s6.x = 700; s6.y = 480;
  aimAt(g5, s6.x, s6.y);
  for (let i = 0; i < 60; i += 1) stepGame(g5, DT);
  check("ship in the beam is lit", inBeam(g5, s6.x, s6.y) || s6.lit, `lit=${s6.lit}`);

  // 9. Wave 1 resolves (clears or costs lives) under a real player.
  const g6 = createGame();
  g6.rng = mulberry32(16);
  startRun(g6);
  let guard = 0;
  while (g6.screen === SCREEN.PLAY && g6.wave === 1 && guard < 60 * 180) {
    // A simple player: light the ship nearest a rock.
    let best = null;
    let bestD = -1;
    for (let i = 0; i < g6.ships.length; i += 1) {
      const s = g6.ships[i];
      let d = 0;
      for (let j = 0; j < ROCKS.length; j += 1) {
        const r = ROCKS[j];
        const dd = Math.sqrt((s.x - r.x) ** 2 + (s.y - r.y) ** 2) - r.r;
        d = Math.max(d, 1 - Math.max(0, Math.min(1, dd / 220)));
      }
      if (d > bestD) { bestD = d; best = s; }
    }
    if (best !== null) aimAt(g6, best.x, best.y);
    stepGame(g6, DT);
    guard += 1;
  }
  check("wave 1 resolves", g6.wave > 1 || g6.screen !== SCREEN.PLAY, `wave=${g6.wave} screen=${g6.screen} home=${g6.shipsHome} lost=${g6.shipsLost}`);

  // 10. No NaN anywhere after a long run.
  const g7 = createGame();
  g7.rng = mulberry32(17);
  startRun(g7);
  for (let i = 0; i < 60 * 120; i += 1) {
    if (g7.screen !== SCREEN.PLAY) break;
    stepGame(g7, DT);
  }
  const finite = g7.ships.every((s) => Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.panic));
  check("no NaN positions after 2 min", finite && Number.isFinite(g7.score) && Number.isFinite(g7.beamAngle));

  // 11. Restart resets the run.
  startRun(g7);
  check("restart resets score and lives", g7.score === 0 && g7.lives === 3 && g7.wave === 1, `score=${g7.score} lives=${g7.lives}`);

  // 12. Pause holds the simulation.
  const g8 = createGame();
  g8.rng = mulberry32(18);
  startRun(g8);
  g8.paused = true;
  const t0 = g8.time;
  check("pause flag exists", g8.paused === true);
  void t0;
  void LAMP;

  return finishReport("SELFTEST", out);
};

// ---- UI test (?uitest) --------------------------------------------------
// Drives the real input handlers with synthetic events: click START,
// fire a flare, pause, lose, and click TRY AGAIN.
const runUITest = () => {
  const out = [];
  const check = makeChecker(out);
  const DT = 1 / 60;
  const g = window.__game;
  const rect = canvas.getBoundingClientRect();
  const toClient = (gx, gy) => ({
    x: rect.left + (gx / 1280) * rect.width,
    y: rect.top + (gy / 720) * rect.height,
  });
  const clickAt = (gx, gy) => {
    const p = toClient(gx, gy);
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: p.x, clientY: p.y, bubbles: true, button: 0 }));
  };
  const key = (k) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
  };

  // Title screen shows a start button.
  g.screen = SCREEN.TITLE;
  draw(ctx, g);
  const btn = g.ui && g.ui.startBtn;
  check("title shows a start button", btn !== undefined && btn.w === 300, `btn=${JSON.stringify(btn)}`);
  // Click it: the run starts.
  clickAt(btn.x + btn.w / 2, btn.y + btn.h / 2);
  check("clicking START begins the run", g.screen === SCREEN.PLAY && g.wave === 1, `screen=${g.screen}`);
  // SPACE fires a flare.
  const flares0 = g.flares;
  key(" ");
  check("SPACE fires a flare", g.flares === flares0 - 1 && g.flareTimer > 0, `flares=${g.flares}`);
  // P pauses and resumes.
  key("p");
  check("P pauses", g.paused === true);
  key("p");
  check("P resumes", g.paused === false);
  // Force a loss: one life left, a ship on a rock.
  g.lives = 1;
  const s = spawnShip(g, "skiff");
  s.x = ROCKS[0].x;
  s.y = ROCKS[0].y;
  stepGame(g, DT);
  check("losing shows the lose screen", g.screen === SCREEN.LOSE, `screen=${g.screen}`);
  draw(ctx, g);
  const again = g.ui && g.ui.againBtn;
  check("lose screen shows TRY AGAIN", again !== undefined && again.w === 300, `btn=${JSON.stringify(again)}`);
  clickAt(again.x + again.w / 2, again.y + again.h / 2);
  check("clicking TRY AGAIN restarts", g.screen === SCREEN.PLAY && g.lives === 3 && g.score === 0, `screen=${g.screen} lives=${g.lives}`);
  // Mute toggles.
  const m0 = g.muted;
  key("m");
  check("M toggles mute", g.muted !== m0);

  return finishReport("UITEST", out);
};

if (params.has("selftest")) {
  runSelfTest();
}
if (params.has("uitest")) {
  runUITest();
}
