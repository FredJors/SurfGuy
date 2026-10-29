/** Lesbare Bezeichnungen für Spielerwerte und Modifikatoren (UI). */
import type { Modifier, PlayerStatId } from '../data/types';

export const STAT_LABELS: Record<PlayerStatId, string> = {
  maxSpeed: 'Höchsttempo',
  paddleSpeed: 'Paddeltempo',
  paddleAccel: 'Paddelkraft',
  cruiseSpeed: 'Reisetempo',
  pumpAccel: 'Pumpen',
  turnRate: 'Wendigkeit',
  brakeDecel: 'Bremsen',
  speedDecay: 'Tempoverlust',
  jumpPower: 'Sprungkraft',
  drawTime: 'Zeichenzeit',
  stability: 'Stabilität',
  waveBoost: 'Wellen-Boost',
  catchWindow: 'Wellenfenster',
  trickDamage: 'Trickschaden',
  trickPoints: 'Trickpunkte',
  pearlMagnet: 'Perlenmagnet',
  maxHearts: 'Herzen',
  invulnTime: 'Schutzzeit',
  xpGain: 'Erfahrung',
  pearlGain: 'Perlen',
  scoreGain: 'Punkte',
};

/** z. B. „+15 % Trickschaden“ oder „+1 Herzen“. */
export function describeModifier(m: Modifier): string {
  const label = STAT_LABELS[m.stat];
  switch (m.op) {
    case 'add':
      return `${m.value >= 0 ? '+' : ''}${m.value} ${label}`;
    case 'addPct':
      return `${m.value >= 0 ? '+' : ''}${Math.round(m.value * 100)} % ${label}`;
    case 'mul':
      return `${m.value >= 1 ? '+' : ''}${Math.round((m.value - 1) * 100)} % ${label}`;
    case 'min':
      return `${label} mindestens ${m.value}`;
    case 'max':
      return `${label} höchstens ${m.value}`;
  }
}
