import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config/gameConfig';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { createDefaultSave } from '../core/SaveGame';
import { createRegistries, validateContent } from '../data';
import { TIPS } from '../data/tips';
import { TUTORIAL_STEPS } from '../data/tutorial';
import { MONSTER_BEHAVIORS } from '../monsters/behaviors';
import { Tutorial, type DrawGuide, type TutorialHost, type TutorialSurferView } from './Tutorial';

/** Host ohne Spiel: zählt mit, was das Tutorial auslöst. */
function setup(touch = false) {
  const bus = new EventBus<GameEvents>();
  const view: TutorialSurferView = { speed: 0, standing: false, airborne: false, waveNear: false, riding: false };
  const log = { steps: [] as string[], texts: [] as string[], praise: [] as string[], trails: 0, waves: 0, krakens: 0, guide: null as DrawGuide | null, jumpBonus: false, finished: null as boolean | null };
  let kraken = false;
  const host: TutorialHost = {
    isTouch: touch,
    surfer: () => view,
    showStep: (step, _i, _n, text) => {
      log.steps.push(step.id);
      log.texts.push(text);
    },
    setText: (t) => log.texts.push(t),
    praise: (t) => log.praise.push(t),
    pearlTrail: () => log.trails++,
    callWave: () => log.waves++,
    setJumpBonus: (on) => (log.jumpBonus = on),
    guideDrawing: (g) => (log.guide = g),
    spawnKraken: () => {
      log.krakens++;
      kraken = true;
    },
    krakenAlive: () => kraken,
    finish: (skipped) => (log.finished = skipped),
  };
  const t = new Tutorial(bus, host);
  const tick = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 30); i++) t.update(1 / 30);
  };
  /** Lob abwarten → nächster Schritt */
  const settle = () => tick(CONFIG.tutorial.stepPause + 0.1);
  return { bus, view, log, t, tick, settle, killKraken: () => (kraken = false) };
}

describe('Tutorial', () => {
  it('führt Schritt für Schritt vom Paddeln bis zum besiegten Kraken', () => {
    const { bus, view, log, t, tick, settle } = setup();
    t.start();
    expect(t.step?.id).toBe('paddle');

    // Paddeln: Tempo
    view.speed = CONFIG.tutorial.paddleSpeed + 0.5;
    tick(0.1);
    settle();
    expect(t.step?.id).toBe('steer');
    expect(log.trails).toBe(1);

    // Lenken: Perlen der Spur einsammeln
    for (let i = 0; i < CONFIG.tutorial.pearls; i++) bus.emit('pearlCollected', { value: 1, position: { x: 0, y: 0, z: 0 } });
    tick(0.1);
    settle();
    expect(t.step?.id).toBe('wave');

    // Welle: wird gerufen, dann erwischt
    tick(CONFIG.tutorial.wave.delay + 0.1);
    expect(log.waves).toBe(1);
    bus.emit('waveCaught', { waveId: 1, height: 2, boost: 2 });
    settle();
    expect(t.step?.id).toBe('jump');
    expect(log.jumpBonus).toBe(true);
    // Schon im Sprung-Schritt ist das nächste Zeichenfenster geführt: Kreis mit Vorlage
    expect(log.guide).toMatchObject({ symbol: 'circle', trace: true });

    // Sprung → Zeichenfenster → Salto
    view.standing = true;
    bus.emit('drawingStarted', { duration: 2 });
    expect(t.step?.id).toBe('draw');
    bus.emit('trickLanded', { trickId: 'salto', quality: 'good', hits: 0, chain: 1 });
    settle();
    expect(t.step?.id).toBe('spiral');
    expect(log.guide).toMatchObject({ symbol: 'spiral', trace: false });

    // Spirale (ein Salto zählt hier nicht)
    bus.emit('trickLanded', { trickId: 'salto', quality: 'good', hits: 0, chain: 1 });
    tick(0.1);
    expect(t.step?.id).toBe('spiral');
    bus.emit('trickLanded', { trickId: 'board_spin', quality: 'perfect', hits: 0, chain: 1 });
    settle();
    expect(t.step?.id).toBe('dodge');
    expect(log.krakens).toBe(1);
    expect(log.guide).toBeNull();

    // Ausweichen: ein Tentakelschlag, der danebengeht
    bus.emit('monsterAttack', { monsterId: 'kraken', kind: 'tentacle', position: { x: 0, z: 0 }, hit: false });
    expect(log.praise.at(-1)).toBe('Ausgewichen!');
    settle();
    expect(t.step?.id).toBe('fight');

    // Kampf: Kraken besiegt → fertig
    bus.emit('monsterDefeated', { instanceId: 1, monsterId: 'kraken', tier: 1, rewards: { pearls: 1, xp: 1, points: 1 }, position: { x: 0, z: 0 } });
    settle();
    expect(log.finished).toBe(false);
    expect(t.active).toBe(false);
    expect(log.jumpBonus).toBe(false);
    expect(log.steps).toEqual(TUTORIAL_STEPS.map((s) => s.id));
  });

  it('ruft neue Wellen, legt neue Perlen und lässt einen geflohenen Kraken wieder auftauchen', () => {
    const { bus, view, log, t, tick, settle, killKraken } = setup();
    t.start();
    view.speed = 10;
    tick(0.1);
    settle();
    // Perlen verpasst → neue Spur
    tick(CONFIG.tutorial.trailRetry + 0.5);
    expect(log.trails).toBe(2);
    for (let i = 0; i < CONFIG.tutorial.pearls; i++) bus.emit('pearlCollected', { value: 1, position: { x: 0, y: 0, z: 0 } });
    tick(0.1);
    settle();
    // Welle verpasst (keine Welle in Sicht) → neue Welle
    tick(CONFIG.tutorial.wave.delay + 0.1);
    tick(CONFIG.tutorial.waveRetry + 0.2);
    expect(log.waves).toBe(2);
    // Solange eine Welle kommt, wird keine neue gerufen
    view.waveNear = true;
    tick(CONFIG.tutorial.waveRetry * 2);
    expect(log.waves).toBe(2);
    bus.emit('waveCaught', { waveId: 1, height: 2, boost: 2 });
    settle();
    bus.emit('drawingStarted', { duration: 2 });
    bus.emit('trickLanded', { trickId: 'salto', quality: 'good', hits: 0, chain: 1 });
    settle();
    bus.emit('trickLanded', { trickId: 'board_spin', quality: 'good', hits: 0, chain: 1 });
    settle();
    expect(t.step?.id).toBe('dodge');
    // Getroffen zählt auch (mit anderem Lob)
    bus.emit('monsterAttack', { monsterId: 'kraken', kind: 'tentacle', position: { x: 0, z: 0 }, hit: true });
    expect(log.praise.at(-1)).toMatch(/Autsch/);
    settle();
    killKraken();
    tick(0.1);
    expect(log.krakens).toBe(2);
  });

  it('kurzer Sprung ohne Zeichenfenster: Hinweis „Mehr Tempo“ bleibt stehen', () => {
    const { bus, view, log, t, tick, settle } = setup();
    t.start();
    view.speed = 10;
    tick(0.1);
    settle();
    for (let i = 0; i < CONFIG.tutorial.pearls; i++) bus.emit('pearlCollected', { value: 1, position: { x: 0, y: 0, z: 0 } });
    tick(0.1);
    settle();
    bus.emit('waveCaught', { waveId: 1, height: 2, boost: 2 });
    settle();
    view.standing = true;
    bus.emit('landed', { airtime: 0.3, position: { x: 0, z: 0 }, speed: 6 });
    tick(1);
    expect(log.texts.at(-1)).toMatch(/Mehr Tempo/);
    expect(t.step?.id).toBe('jump');
  });

  it('Überspringen beendet sofort; Texte für Handy und PC', () => {
    const pc = setup(false);
    pc.t.start();
    expect(pc.log.texts[0]).toMatch(/W/);
    pc.t.skip();
    expect(pc.log.finished).toBe(true);
    expect(pc.t.active).toBe(false);

    const phone = setup(true);
    phone.t.start();
    expect(phone.log.texts[0]).toMatch(/Daumen/);
  });

  it('Daten passen: Symbole und Tricks der geführten Schritte, Geschenk, Tipps', () => {
    const content = createRegistries();
    expect(validateContent(content, Object.keys(MONSTER_BEHAVIORS))).toEqual([]);
    for (const s of TUTORIAL_STEPS) {
      if (!s.draw) continue;
      expect(content.symbols.has(s.draw.symbol)).toBe(true);
      expect(content.tricks.all().some((t) => t.symbols.includes(s.draw!.symbol) && t.unlock.type === 'default')).toBe(true);
    }
    const gift = content.chestRewards.get(CONFIG.tutorial.giftReward);
    expect(gift.design && content.boardDesigns.has(gift.design)).toBe(true);
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length);
    for (const t of TIPS) if (t.where === 'menu') expect(t.tile).toBeDefined();
    expect(createDefaultSave().tutorial.done).toBe(false);
  });
});
