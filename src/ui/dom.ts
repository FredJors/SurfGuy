/** Mini-Helfer zum Erzeugen von DOM-Elementen. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { class?: string; text?: string; html?: string; attrs?: Record<string, string> } = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  if (props.html !== undefined) el.innerHTML = props.html;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) el.setAttribute(k, v);
  for (const c of children) el.append(c);
  return el;
}

/** Setzt Text nur, wenn er sich geändert hat (vermeidet unnötiges Layout). */
export function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('de-DE');
}

/** SVG-Pfad aus Symbol-Punkten (für Vorschau-Icons); mit `outline` bekommt der Strich eine Kontur. */
export function strokeToSvg(points: readonly { x: number; y: number }[], color = '#1d2140', outline?: string): string {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const size = Math.max(maxX - minX, maxY - minY) || 1;
  const pad = size * 0.12;
  const d = points
    .map((p, i) => `${i ? 'L' : 'M'}${(p.x - minX + (size - (maxX - minX)) / 2 + pad).toFixed(1)} ${(p.y - minY + (size - (maxY - minY)) / 2 + pad).toFixed(1)}`)
    .join(' ');
  const vb = size + pad * 2;
  const sw = vb * 0.09;
  const path = (c: string, w: number) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg viewBox="0 0 ${vb.toFixed(1)} ${vb.toFixed(1)}">${outline ? path(outline, sw * 2) : ''}${path(color, sw)}</svg>`;
}
