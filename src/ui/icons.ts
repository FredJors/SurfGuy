/** Kleine SVG-Symbole für Knöpfe ohne Text (24×24, Farbe = currentColor). */

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  play: svg('<path d="M8 4.5l11.5 7.5L8 19.5z" fill="currentColor"/>'),
  shop: svg('<path d="M5 8.5h14l-1.2 11.5H6.2z" fill="currentColor" fill-opacity="0.25"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>'),
  skills: svg(
    '<path d="M12 6.5v4M12 10.5L6.5 16M12 10.5l5.5 5.5"/><circle cx="12" cy="5" r="2.6" fill="currentColor"/><circle cx="6" cy="17.5" r="2.6" fill="currentColor"/><circle cx="18" cy="17.5" r="2.6" fill="currentColor"/>',
  ),
  bestiary: svg(
    '<path d="M3.5 5.5c3-1.2 6-1 8.5 1v13c-2.5-2-5.5-2.2-8.5-1z" fill="currentColor" fill-opacity="0.25"/><path d="M20.5 5.5c-3-1.2-6-1-8.5 1v13c2.5-2 5.5-2.2 8.5-1z" fill="currentColor" fill-opacity="0.25"/>',
  ),
  soundOn: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  soundOff: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/>'),
} as const;

export type IconId = keyof typeof ICONS;
