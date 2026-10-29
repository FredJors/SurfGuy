/**
 * Verbindet Spielereignisse mit Soundeffekten. Wie alles andere hängt der Ton nur am Event-Bus.
 */
import type { GameEventBus, XZ } from '../core/events';
import { Sfx } from './Sfx';

export class AudioSystem {
  readonly sfx = new Sfx();
  private readonly offs: (() => void)[] = [];

  constructor(
    bus: GameEventBus,
    /** Position des Zuhörers (Surfer) – für entfernungsabhängige Geräusche */
    private readonly listener: () => XZ,
  ) {
    const s = this.sfx;
    const on = bus.on.bind(bus);
    this.offs.push(
      on('pearlChain', (e) => {
        s.pearl(e.count);
        if (e.bonus > 0) s.chainBonus();
      }),
      on('jump', () => s.jump()),
      on('launched', (e) => s.launch(e.power)),
      on('landed', (e) => s.land(e.airtime)),
      on('waveCaught', () => s.waveCaught()),
      on('drawingStarted', () => s.drawStart()),
      on('trickLanded', (e) => s.trick(e.quality)),
      on('trickFailed', (e) => {
        if (e.reason !== 'noStroke') s.trickFailed();
      }),
      on('comboChanged', (e) => {
        if (e.combo > 1) s.comboUp(e.multiplier);
      }),
      on('monsterHit', (e) => s.monsterHit(e.weakness)),
      on('monsterDefeated', () => s.monsterDefeated()),
      on('monsterWarning', () => s.warning()),
      on('playerHit', () => s.playerHit()),
      on('shieldBroken', () => s.bonk()),
      on('abilityUsed', () => s.ability()),
      on('wreckBonk', () => s.bonk()),
      on('pickupCollected', (e) => (e.pickupId === 'chest' ? s.chest() : s.powerup())),
      on('dolphinsSpotted', () => s.dolphin()),
      on('dolphinRide', (e) => {
        if (e.active) s.dolphin();
      }),
      on('bossEvent', (e) => {
        const p = this.listener();
        const d = Math.hypot(e.position.x - p.x, e.position.z - p.z);
        if (e.kind === 'awaken' || e.kind === 'enrage') s.roar();
        else if (e.kind === 'throw') s.rockThrow();
        else if (e.kind === 'impact') s.rockImpact(d);
        else if (e.kind === 'stomp') s.stomp();
        else if (e.kind === 'defeated') s.bossDefeated();
      }),
      on('geyserErupted', (e) => {
        const p = this.listener();
        s.geyser(Math.hypot(e.position.x - p.x, e.position.z - p.z));
      }),
    );
  }

  /** Nach jeder Nutzeraktion aufrufen – der Browser gibt Ton erst danach frei. */
  unlockOnFirstInput(): void {
    const unlock = () => this.sfx.unlock();
    for (const ev of ['pointerdown', 'touchend', 'keydown'] as const) window.addEventListener(ev, unlock, { passive: true });
  }

  dispose(): void {
    this.offs.forEach((o) => o());
  }
}
