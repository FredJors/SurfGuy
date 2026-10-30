/**
 * Einstellungen: Lautstärke der Effekte, Grafikqualität und „Tutorial wiederholen“.
 * Änderungen wirken sofort; gespeichert wird über die Callbacks (core/Game.ts).
 */
import type { SaveData } from '../core/SaveGame';
import { h } from './dom';
import { backButton } from './widgets';

export interface SettingsCallbacks {
  /** Lautstärke 0–1 (live beim Schieben) */
  volume(v: number): void;
  quality(q: SaveData['settings']['quality']): void;
  /** Tutorial neu starten (schließt das Fenster) */
  replayTutorial(): void;
  close(): void;
}

const QUALITY: { id: SaveData['settings']['quality']; label: string; hint: string }[] = [
  { id: 'auto', label: 'Auto', hint: 'Passt sich deinem Gerät an' },
  { id: 'low', label: 'Schnell', hint: 'Weniger Effekte, flüssiger' },
  { id: 'high', label: 'Schön', hint: 'Volle Grafik' },
];

export class SettingsScreen {
  private readonly overlay: HTMLDivElement;

  constructor(parent: HTMLElement, save: SaveData, cb: SettingsCallbacks) {
    const close = backButton(() => {
      this.overlay.remove();
      cb.close();
    });

    // Lautstärke
    const valueEl = h('span', { class: 'set-value outlined', text: '' });
    const slider = h('input', { class: 'set-slider', attrs: { type: 'range', min: '0', max: '100', step: '5', 'aria-label': 'Lautstärke' } }) as HTMLInputElement;
    const show = () => {
      valueEl.textContent = `${slider.value} %`;
      slider.style.setProperty('--fill', `${slider.value}%`);
    };
    slider.value = String(Math.round(save.settings.volume * 100));
    show();
    slider.addEventListener('input', () => {
      show();
      cb.volume(Number(slider.value) / 100);
    });

    // Grafik
    const hint = h('div', { class: 'set-hint', text: '' });
    const buttons = QUALITY.map((q) => {
      const b = h('button', { class: 'tab', text: q.label });
      b.addEventListener('click', () => {
        cb.quality(q.id);
        select(q.id);
      });
      return { q, b };
    });
    const select = (id: string) => {
      for (const { q, b } of buttons) b.classList.toggle('active', q.id === id);
      hint.textContent = QUALITY.find((q) => q.id === id)?.hint ?? '';
    };
    select(save.settings.quality);

    const replay = h('button', { class: 'btn green small', text: 'Tutorial wiederholen' });
    replay.addEventListener('click', () => {
      this.overlay.remove();
      cb.replayTutorial();
    });

    const row = (label: string, ...content: HTMLElement[]) =>
      h('div', { class: 'set-row' }, [h('div', { class: 'set-label outlined', text: label }), h('div', { class: 'set-control' }, content)]);

    const panel = h('div', { class: 'panel settings-panel' }, [
      h('div', { class: 'side-header' }, [h('h2', { class: 'outlined', text: 'Einstellungen' }), close]),
      row('Lautstärke', slider, valueEl),
      row('Grafik', h('div', { class: 'tabs' }, buttons.map((x) => x.b)), hint),
      row('Hilfe', replay),
    ]);
    this.overlay = h('div', { class: 'overlay' }, [panel]);
    parent.appendChild(this.overlay);
  }
}
