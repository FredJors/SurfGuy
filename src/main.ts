import './ui/styles.css';
import { CONFIG } from './config/gameConfig';
import { Game } from './core/Game';

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');

const game = new Game(document.getElementById('app')!, {
  seed: seedParam !== null && seedParam !== '' ? Number(seedParam) : CONFIG.seed,
  debug: params.has('debug'),
  boardOverride: params.get('board') ?? undefined,
  forceBoss: params.has('boss'),
  forceIsland: params.has('insel'),
  forceChapter2: params.has('kapitel2'),
});

game.init().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<pre style="position:fixed;inset:0;margin:0;padding:20px;background:#fff;color:#c00;white-space:pre-wrap;z-index:999">Fehler beim Start:\n${String(err?.stack ?? err)}</pre>`,
  );
});

// Für Tests und Debugging in der Konsole erreichbar
(window as unknown as { surfguy: Game }).surfguy = game;
