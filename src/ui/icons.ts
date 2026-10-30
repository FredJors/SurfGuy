/**
 * SVG-Symbole im Spielstil: kräftige Farben, dunkle Kontur (48×48).
 * Die kleinen Steuer-Symbole (Ton, Pause, Zurück, Schließen) sind weiß mit Kontur.
 */

const INK = '#0f1330';
const svg = (body: string, vb = 48) => `<svg viewBox="0 0 ${vb} ${vb}" aria-hidden="true">${body}</svg>`;
/** Strich zweimal zeichnen: dunkle Kontur, darüber weiß */
const line = (d: string, w = 5) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 5}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
/** Schneeflocke: sechs Arme mit je zwei Ästchen */
const flakePath = (() => {
  const f = (n: number) => n.toFixed(1);
  let d = '';
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 - Math.PI / 2;
    d += `M24 24L${f(24 + Math.cos(a) * 19)} ${f(24 + Math.sin(a) * 19)}`;
    const bx = 24 + Math.cos(a) * 12;
    const by = 24 + Math.sin(a) * 12;
    for (const side of [-1, 1]) {
      const b = a + side * 0.8;
      d += `M${f(bx)} ${f(by)}l${f(Math.cos(b) * 6.5)} ${f(Math.sin(b) * 6.5)}`;
    }
  }
  return d;
})();
const speaker = `<path d="M7 18.5h7.5L24 10v28l-9.5-8.5H7z" fill="#fff" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/>`;

export const ICONS = {
  soundOn: svg(`${speaker}${line('M30.5 18a8 8 0 0 1 0 12', 3.6)}${line('M35.5 12.5a15 15 0 0 1 0 23', 3.6)}`),
  soundOff: svg(`${speaker}${line('M31 18.5l10 10M41 18.5l-10 10', 3.6)}`),
  pause: svg(`<rect x="11" y="9" width="9" height="30" rx="3" fill="#fff" stroke="${INK}" stroke-width="3.2"/><rect x="28" y="9" width="9" height="30" rx="3" fill="#fff" stroke="${INK}" stroke-width="3.2"/>`),
  /** Zahnrad (Einstellungen) */
  settings: svg(
    `<path d="M21 5h6l1.2 5.2 3.6 1.5 4.6-2.8 4.2 4.2-2.8 4.6 1.5 3.6L43 21v6l-5.2 1.2-1.5 3.6 2.8 4.6-4.2 4.2-4.6-2.8-3.6 1.5L27 43h-6l-1.2-5.2-3.6-1.5-4.6 2.8-4.2-4.2 2.8-4.6-1.5-3.6L5 27v-6l5.2-1.2 1.5-3.6-2.8-4.6 4.2-4.2 4.6 2.8 3.6-1.5z" fill="#fff" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/><circle cx="24" cy="24" r="6.5" fill="#8fb3ff" stroke="${INK}" stroke-width="3.2"/>`,
  ),
  back: svg(line('M28 11 15 24l13 13', 6)),
  close: svg(line('M14 14l20 20M34 14 14 34', 6)),
  shop: svg(
    `<path d="M9 17h30l-2.6 23.5a4 4 0 0 1-4 3.5H15.6a4 4 0 0 1-4-3.5Z" fill="#ffd23f" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M12.6 21.5h22.8" stroke="#fff6b8" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M17 19v-5.5a7 7 0 0 1 14 0V19" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>` +
      `<circle cx="24" cy="32" r="6" fill="#ffe6f5" stroke="${INK}" stroke-width="2.8"/><circle cx="22" cy="30" r="1.8" fill="#fff"/>`,
  ),
  skills: svg(
    `<path d="M28.5 3 9.5 27.5H21L17 45l21.5-27H27.2Z" fill="#7dff8a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M26 9.5 16.5 22.5" stroke="#e6ffe9" stroke-width="2.8" stroke-linecap="round"/>`,
  ),
  bestiary: svg(
    `<path d="M10 8a3 3 0 0 1 3-3h25v33H13a3 3 0 0 0-3 3Z" fill="#ff5fa2" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M10 41a3 3 0 0 1 3-3h25v6H13a3 3 0 0 1-3-3Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<ellipse cx="24.5" cy="20.5" rx="9" ry="6.8" fill="#fff" stroke="${INK}" stroke-width="2.8"/>` +
      `<circle cx="24.5" cy="20.5" r="3.6" fill="${INK}"/><circle cx="23.2" cy="19.2" r="1.2" fill="#fff"/>`,
  ),
  goals: svg(
    `<path d="M14 9H8a5.5 5.5 0 0 0 7 7.5M34 9h6a5.5 5.5 0 0 1-7 7.5" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>` +
      `<path d="M14 6h20v10a10 10 0 0 1-20 0Z" fill="#ffd23f" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M21 25.5h6l1.2 7.5h-8.4Z" fill="#f5a300" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<rect x="13" y="33" width="22" height="8.5" rx="2.5" fill="#a54bd8" stroke="${INK}" stroke-width="3"/>` +
      `<path d="M19 10.5v5" stroke="#fff6b8" stroke-width="3" stroke-linecap="round"/>`,
  ),
  volcano: svg(
    `<path d="M3 43 16.5 18h15L45 43Z" fill="#8a5243" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M16.5 18c2.5 2.6 4.5 2.6 7.5 0s5-2.6 7.5 0l-3 5.5c-1.4 2.6-1 5.5.5 8-3 .3-5-1.8-5-4.5-.4 3.4-2.6 5.6-6 5.8 1.8-3 1.6-6-.2-8.8Z" fill="#ff7a1a" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<circle cx="17" cy="9" r="3.2" fill="#ffb347" stroke="${INK}" stroke-width="2.4"/><circle cx="29" cy="6" r="2.4" fill="#ff5a1a" stroke="${INK}" stroke-width="2.2"/><circle cx="34" cy="12" r="2" fill="#ffd23f" stroke="${INK}" stroke-width="2"/>`,
  ),
  heart: svg(
    `<path d="M24 41C10 32 5 24.5 5 17.5 5 11.5 9.6 7 15 7c3.8 0 7 2 9 5.2C26 9 29.2 7 33 7c5.4 0 10 4.5 10 10.5C43 24.5 38 32 24 41Z" fill="currentColor" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>` +
      `<path d="M11 16.5c0-2.6 1.8-4.4 4.2-4.6" fill="none" stroke="#fff" stroke-opacity="0.85" stroke-width="3.4" stroke-linecap="round"/>`,
  ),
  monster: svg(
    `<path d="M9 27a15 15 0 0 1 30 0v9c0 2.5-2.5 2.5-3.5 0s-3.5-2.5-4.5 0-3.5 2.5-4.5 0-3.5-2.5-4.5 0-3.5 2.5-4.5 0-3.5-2.5-4.5 0-3.5 2.5-4 0Z" fill="#b065ff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<circle cx="18.5" cy="24" r="4.4" fill="#fff" stroke="${INK}" stroke-width="2.4"/><circle cx="29.5" cy="24" r="4.4" fill="#fff" stroke="${INK}" stroke-width="2.4"/>` +
      `<circle cx="19.3" cy="24.6" r="2" fill="${INK}"/><circle cx="30.3" cy="24.6" r="2" fill="${INK}"/>`,
  ),
  trick: svg(
    `<path d="M24 3l4.6 11.4L40.8 12l-6.6 10.5L44 30.6l-12.3 1L29.8 44 24 33.4 18.2 44l-1.9-12.4L4 30.6l9.8-8.1L7.2 12l12.2 2.4Z" fill="#ff5fa2" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<circle cx="24" cy="24" r="6" fill="#ffd23f" stroke="${INK}" stroke-width="2.6"/>`,
  ),
  combo: svg(
    `<path d="M24 3c2.5 8 13 12.5 13 25a13 13 0 0 1-26 0c0-6.5 3.2-9.8 5.5-13 .2 4.4 2.2 6.6 4.5 6.8C19 15 22 8.5 24 3Z" fill="#ff8a3d" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M24 22c1.5 4.5 7 6 7 12a7 7 0 0 1-14 0c0-3.5 2-5.5 3.5-7 .3 2 1.3 3 2.5 3-.8-3.2 0-5.6 1-8Z" fill="#ffd23f" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`,
  ),
  xp: svg(
    `<path d="M18 4h12v11l10 15c3.5 7-1 15-16 15S4.5 37 8 30l10-15Z" fill="#7dee8a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M11 32c5-2.5 21-2.5 26 0 1.2 6-4 10-13 10s-14.2-4-13-10Z" fill="#2ebd4f"/>` +
      `<rect x="16" y="1.5" width="16" height="6" rx="2" fill="#c98a4b" stroke="${INK}" stroke-width="2.6"/>` +
      `<path d="M15 21l-3.5 5" stroke="#e6ffe9" stroke-width="3" stroke-linecap="round"/>`,
  ),
  chest: svg(
    `<rect x="5" y="20" width="38" height="22" rx="3" fill="#b8692e" stroke="${INK}" stroke-width="3"/>` +
      `<path d="M5 22v-4a12 12 0 0 1 12-12h14a12 12 0 0 1 12 12v4Z" fill="#d9853c" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M5 22h38" stroke="${INK}" stroke-width="3"/><rect x="5" y="20" width="38" height="5" fill="#ffd23f" stroke="${INK}" stroke-width="2.6"/>` +
      `<rect x="20" y="18" width="8" height="11" rx="2" fill="#ffd23f" stroke="${INK}" stroke-width="2.6"/>`,
  ),
  wave: svg(
    `<path d="M3 34c5 0 6-5 11-5s6 5 11 5 6-5 11-5c4 0 5.5 3 9 4.5V44H3Z" fill="#2f9bff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M6 30C6 16 16 6 29 6c6 0 10 3 10 7.5 0 3.5-3 6-6.5 6-3 0-5-2-5-4.5-5 1.5-9 7-9 14Z" fill="#7fd6ff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
  ),
  palm: svg(
    `<path d="M25 45c1.5-9 .5-18-3.5-26" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M25 45c1.5-9 .5-18-3.5-26" fill="none" stroke="#c98a4b" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M21.5 18C15 9 6.5 9.5 3 15c6.5-2.5 12.5-1.5 18.5 3Z" fill="#45d65a" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<path d="M21.5 18c3.5-9 12.5-12.5 19.5-8.5-6.5 0-12.5 3-19.5 8.5Z" fill="#7dee8a" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<path d="M21.5 18C12.5 17 6 23 6 29.5c4-5.5 9-9 15.5-11.5Z" fill="#2fb64a" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<path d="M21.5 18c9-2 17 3 19.5 10.5-5.5-4.5-11.5-7.5-19.5-10.5Z" fill="#45d65a" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<circle cx="20.5" cy="21" r="3" fill="#8a4a1e" stroke="${INK}" stroke-width="2"/><circle cx="25" cy="21.5" r="2.6" fill="#8a4a1e" stroke="${INK}" stroke-width="2"/>`,
  ),
  snowflake: svg(
    `<path d="${flakePath}" fill="none" stroke="${INK}" stroke-width="8.5" stroke-linecap="round"/><path d="${flakePath}" fill="none" stroke="#bff0ff" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="24" cy="24" r="5" fill="#ffffff" stroke="${INK}" stroke-width="2.6"/>`,
  ),
  lock: svg(
    `<path d="M15 21v-6a9 9 0 0 1 18 0v6" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M15 21v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#b7c2d8" stroke-width="4" stroke-linecap="round"/>` +
      `<rect x="9" y="20" width="30" height="24" rx="5" fill="#ffd23f" stroke="${INK}" stroke-width="3"/><circle cx="24" cy="31" r="3.5" fill="${INK}"/><path d="M24 33v5" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  ),
  star: svg(
    `<path d="M24 4l5.9 12.6 13.6 1.6-10 9.4 2.7 13.6L24 34.4l-12.2 6.8 2.7-13.6-10-9.4 13.6-1.6Z" fill="currentColor" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/>` +
      `<path d="M18 19.5l4.4-.6" stroke="#fff" stroke-opacity="0.8" stroke-width="3" stroke-linecap="round"/>`,
  ),
} as const;

export type IconName = keyof typeof ICONS;
