/** Spielzeit mit Zeitlupe (weiche Übergänge) und kurzem Treffer-Stopp. */
export class TimeController {
  /** Aktueller Faktor Spielzeit / Echtzeit */
  scale = 1;
  /** Vergangene Spielzeit (s) */
  gameTime = 0;
  private target = 1;
  private rampSpeed = Infinity;
  private freeze = 0;

  /** Setzt den Zielfaktor; `rampTime` = Dauer des Übergangs in echten Sekunden. */
  setScale(target: number, rampTime = 0): void {
    this.target = target;
    const diff = Math.abs(target - this.scale);
    this.rampSpeed = rampTime > 0 ? diff / rampTime : Infinity;
    if (!Number.isFinite(this.rampSpeed)) this.scale = target;
  }

  get targetScale(): number {
    return this.target;
  }

  /** Friert die Spielzeit kurz ein (echte Sekunden). */
  hitStop(seconds: number): void {
    this.freeze = Math.max(this.freeze, seconds);
  }

  /** Gibt den Spielzeit-Schritt zu `realDt` zurück. */
  update(realDt: number): number {
    if (this.scale !== this.target) {
      const step = this.rampSpeed * realDt;
      if (Math.abs(this.target - this.scale) <= step) this.scale = this.target;
      else this.scale += Math.sign(this.target - this.scale) * step;
    }
    if (this.freeze > 0) {
      this.freeze -= realDt;
      return 0;
    }
    const dt = realDt * this.scale;
    this.gameTime += dt;
    return dt;
  }

  reset(): void {
    this.scale = 1;
    this.target = 1;
    this.freeze = 0;
    this.gameTime = 0;
  }
}
