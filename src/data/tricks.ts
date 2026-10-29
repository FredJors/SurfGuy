/**
 * Tricks. Ein neuer Trick = ein neuer Eintrag (siehe README, Abschnitt „Neue Inhalte“).
 * Werte wie Schaden und Punkte sind Basiswerte; Qualität, Kombo und Modifikatoren
 * werden im Spiel darauf angewendet.
 */
import type { TrickDef } from './types';

export const TRICKS: TrickDef[] = [
  {
    id: 'salto',
    name: 'Salto',
    description: 'Rückwärtssalto über das Monster – trifft den Kopf von oben.',
    symbols: ['circle'],
    duration: 0.95,
    hitTime: 0.55,
    damage: 35,
    hitArea: { shape: 'cone', range: 16, halfAngleDeg: 45 },
    targeting: 'nearest',
    targetTags: ['head'],
    travel: { distance: 6, homingTag: 'head', maxDistance: 16, overshoot: 5 },
    points: 300,
    unlock: { type: 'default' },
    color: '#ffd23f',
    animation: {
      spin: { pitch: -1, ease: 'inOutQuad' },
      poses: [
        { t: 0, pose: 'crouch' },
        { t: 0.15, pose: 'tuck' },
        { t: 0.72, pose: 'tuck' },
        { t: 0.88, pose: 'crouch' },
        { t: 1, pose: 'stand' },
      ],
    },
  },
  {
    id: 'board_spin',
    name: 'Board-Wirbel',
    description: 'Doppelte Drehung – trifft alle Tentakel rundherum.',
    symbols: ['spiral'],
    duration: 0.9,
    hitTime: 0.5,
    damage: 25,
    hitArea: { shape: 'circle', radius: 9 },
    targeting: 'all',
    points: 250,
    unlock: { type: 'default' },
    color: '#3ee0ff',
    animation: {
      spin: { yaw: 2, ease: 'inOutQuad' },
      poses: [
        { t: 0, pose: 'crouch' },
        { t: 0.15, pose: 'spin' },
        { t: 0.8, pose: 'spin' },
        { t: 0.92, pose: 'crouch' },
        { t: 1, pose: 'stand' },
      ],
    },
  },
  {
    id: 'board_slam',
    name: 'Board-Schlag',
    description: 'Brett über den Kopf und mit voller Wucht nach vorne – starker Einzeltreffer.',
    symbols: ['zigzag'],
    duration: 0.85,
    hitTime: 0.55,
    damage: 50,
    hitArea: { shape: 'cone', range: 12, halfAngleDeg: 35 },
    targeting: 'nearest',
    travel: { distance: 3 },
    points: 280,
    unlock: { type: 'default' },
    color: '#ff5d8f',
    animation: {
      poses: [
        { t: 0, pose: 'crouch' },
        { t: 0.25, pose: 'boardRaise' },
        { t: 0.42, pose: 'boardRaise' },
        { t: 0.58, pose: 'boardSmash' },
        { t: 0.8, pose: 'crouch' },
        { t: 1, pose: 'stand' },
      ],
      board: [
        { t: 0, offset: [0, 0, 0], rotation: [0, 0, 0] },
        { t: 0.15, offset: [0, 1.0, -0.2], rotation: [-40, 0, 0] },
        { t: 0.42, offset: [0, 2.1, -0.4], rotation: [-100, 0, 0] },
        { t: 0.58, offset: [0, 1.0, 1.7], rotation: [70, 0, 0] },
        { t: 0.8, offset: [0, 0.2, 0.3], rotation: [10, 0, 0] },
        { t: 1, offset: [0, 0, 0], rotation: [0, 0, 0] },
      ],
    },
  },
];
