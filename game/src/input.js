// Input: mouse aims the beam, keys turn it, SPACE fires a flare.
// Buttons are hit-tested against the rectangles render.js stores on
// game.ui, so a click on START or PLAY AGAIN always lands.
import { SCREEN, startRun } from "./state.js";
import { aimAt, nudgeBeam, fireFlare } from "./beam.js";
import { ensureAudio, playClick, playFlare } from "./audio.js";

function toGame(canvas, ev) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - r.left) / r.width) * 1280,
    y: ((ev.clientY - r.top) / r.height) * 720,
  };
}

function inside(p, b) {
  return b !== undefined && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

export function attachInput(canvas, game) {
  canvas.addEventListener("mousemove", (ev) => {
    const p = toGame(canvas, ev);
    game.mouse.x = p.x;
    game.mouse.y = p.y;
    game.mouse.active = true;
    if (game.screen === SCREEN.PLAY && !game.paused) aimAt(game, p.x, p.y);
  });

  canvas.addEventListener("mousedown", (ev) => {
    ensureAudio(game);
    const p = toGame(canvas, ev);
    if (game.screen === SCREEN.TITLE) {
      if (inside(p, game.ui && game.ui.startBtn)) {
        playClick(game);
        startRun(game);
      }
      return;
    }
    if (game.screen === SCREEN.WIN || game.screen === SCREEN.LOSE) {
      if (inside(p, game.ui && game.ui.againBtn)) {
        playClick(game);
        startRun(game);
      }
      return;
    }
    if (game.screen === SCREEN.PLAY && !game.paused) {
      if (ev.button === 2) {
        if (fireFlare(game)) playFlare(game);
      } else {
        aimAt(game, p.x, p.y);
      }
    }
  });

  canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());

  window.addEventListener("keydown", (ev) => {
    ensureAudio(game);
    const k = ev.key;
    if (k === " " || k === "Enter") {
      ev.preventDefault();
      if (game.screen === SCREEN.TITLE) {
        playClick(game);
        startRun(game);
        return;
      }
      if (game.screen === SCREEN.WIN || game.screen === SCREEN.LOSE) {
        playClick(game);
        startRun(game);
        return;
      }
      if (game.screen === SCREEN.PLAY && !game.paused && k === " ") {
        if (fireFlare(game)) playFlare(game);
      }
      return;
    }
    if (k === "p" || k === "P") {
      if (game.screen === SCREEN.PLAY) game.paused = !game.paused;
      return;
    }
    if (k === "m" || k === "M") {
      game.muted = !game.muted;
      return;
    }
    if (k === "r" || k === "R") {
      if (game.screen === SCREEN.WIN || game.screen === SCREEN.LOSE) {
        playClick(game);
        startRun(game);
      }
      return;
    }
    if (game.screen === SCREEN.PLAY && !game.paused) {
      if (k === "ArrowLeft" || k === "a" || k === "A") nudgeBeam(game, -1, 1 / 60);
      if (k === "ArrowRight" || k === "d" || k === "D") nudgeBeam(game, 1, 1 / 60);
    }
  });
}
