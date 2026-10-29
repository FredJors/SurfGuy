/** Desktop: A/D drehen, W paddeln, S bremsen, Leertaste springen, Esc/P Pause. */
import type { InputManager, InputSource, InputState } from './InputManager';

const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];

export class KeyboardSource implements InputSource {
  private readonly down = new Set<string>();
  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      if (!e.repeat) this.input.triggerJump();
      e.preventDefault();
    }
    if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) this.input.triggerPause();
    if ([...LEFT, ...RIGHT, ...UP, ...DOWN].includes(e.code)) e.preventDefault();
    this.down.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent) => this.down.delete(e.code);
  private readonly onBlur = () => this.down.clear();

  constructor(private readonly input: InputManager) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  private any(codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  read(): Partial<InputState> {
    // Positiver Lenkwert = nach rechts drehen
    const steer = (this.any(RIGHT) ? 1 : 0) - (this.any(LEFT) ? 1 : 0);
    return { steer, paddle: this.any(UP) ? 1 : 0, brake: this.any(DOWN) ? 1 : 0 };
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
