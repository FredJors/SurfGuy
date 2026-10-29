import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './EventBus';
import { Registry } from './Registry';
import { StateMachine } from './StateMachine';
import { StatSheet, applyModifiers } from './Modifiers';
import { Rng } from './Rng';
import { MemoryStorage, SaveStore, createDefaultSave } from './SaveGame';
import { wrapAngle } from './math';

describe('EventBus', () => {
  it('liefert Events an Listener und erlaubt Abmelden', () => {
    const bus = new EventBus<{ ping: { n: number } }>();
    const fn = vi.fn();
    const off = bus.on('ping', fn);
    bus.emit('ping', { n: 1 });
    off();
    bus.emit('ping', { n: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ n: 1 });
  });

  it('once feuert nur einmal', () => {
    const bus = new EventBus<{ ping: number }>();
    const fn = vi.fn();
    bus.once('ping', fn);
    bus.emit('ping', 1);
    bus.emit('ping', 2);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('Registry', () => {
  it('registriert, findet und verhindert doppelte ids', () => {
    const reg = new Registry<{ id: string; v: number }>('test');
    reg.register({ id: 'a', v: 1 });
    expect(reg.get('a').v).toBe(1);
    expect(reg.tryGet('b')).toBeUndefined();
    expect(() => reg.register({ id: 'a', v: 2 })).toThrow();
    expect(() => reg.get('b')).toThrow();
  });
});

describe('StateMachine', () => {
  type Id = 'a' | 'b' | 'c';
  it('wechselt Zustände, respektiert erlaubte Übergänge und meldet Wechsel', () => {
    const log: string[] = [];
    const sm = new StateMachine<object, Id>({}, (from, to) => log.push(`${from}->${to}`));
    sm.add({ id: 'a', next: ['b'], update: (_c, _dt, t) => (t > 1 ? 'b' : undefined) });
    sm.add({ id: 'b', next: ['a'] });
    sm.add({ id: 'c' });
    sm.start('a');
    expect(sm.transition('c')).toBe(false);
    sm.update(0.5);
    expect(sm.current).toBe('a');
    sm.update(0.6);
    expect(sm.current).toBe('b');
    expect(log).toEqual(['null->a', 'a->b']);
  });
});

describe('Modifier', () => {
  it('rechnet (basis + add) × (1 + Σpct) × Πmul', () => {
    const v = applyModifiers(10, 'speed', [
      { stat: 'speed', op: 'add', value: 2 },
      { stat: 'speed', op: 'addPct', value: 0.1 },
      { stat: 'speed', op: 'addPct', value: 0.15 },
      { stat: 'speed', op: 'mul', value: 2 },
      { stat: 'other', op: 'add', value: 100 },
    ]);
    expect(v).toBeCloseTo(12 * 1.25 * 2);
  });

  it('StatSheet berechnet Endwerte aus Quellen und cached sie', () => {
    const sheet = new StatSheet({ speed: 10, turn: 2 });
    sheet.addSource({ id: 'board', modifiers: [{ stat: 'speed', op: 'mul', value: 1.2 }] });
    expect(sheet.get('speed')).toBeCloseTo(12);
    sheet.addSource({ id: 'skill', modifiers: [{ stat: 'speed', op: 'max', value: 11 }] });
    expect(sheet.get('speed')).toBeCloseTo(11);
    sheet.removeSource('skill');
    expect(sheet.get('speed')).toBeCloseTo(12);
    expect(sheet.get('turn')).toBe(2);
  });
});

describe('Rng', () => {
  it('ist mit gleichem Seed deterministisch', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 10; i++) expect(a.next()).toBe(b.next());
  });

  it('weighted ignoriert Gewicht 0', () => {
    const rng = new Rng(1);
    for (let i = 0; i < 100; i++) {
      expect(rng.weighted(['x', 'y'], (s) => (s === 'x' ? 0 : 1))).toBe('y');
    }
  });
});

describe('SaveStore', () => {
  it('lädt Standardwerte, speichert und lädt wieder', () => {
    const store = new SaveStore(new MemoryStorage());
    const data = store.load();
    expect(data).toEqual(createDefaultSave());
    data.pearls = 42;
    store.save(data);
    expect(store.load().pearls).toBe(42);
  });

  it('migriert alte Versionen und füllt fehlende Felder', () => {
    const storage = new MemoryStorage();
    storage.setItem('k', JSON.stringify({ version: 0, perlen: 7 }));
    const store = new SaveStore(storage, {
      key: 'k',
      version: 1,
      migrations: { 0: (d) => ({ ...d, pearls: d.perlen }) },
    });
    const data = store.load();
    expect(data.version).toBe(1);
    expect(data.pearls).toBe(7);
    expect(data.unlocked.boards).toContain('classic');
  });

  it('übersteht beschädigte Daten', () => {
    const storage = new MemoryStorage();
    storage.setItem('surfguy.save', '{kaputt');
    const store = new SaveStore(storage);
    expect(store.load().pearls).toBe(0);
    expect(storage.getItem('surfguy.save.corrupt')).toBe('{kaputt');
  });
});

describe('math', () => {
  it('wrapAngle normalisiert', () => {
    expect(wrapAngle(Math.PI * 2.5)).toBeCloseTo(Math.PI / 2);
    expect(wrapAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI / 2);
  });
});
