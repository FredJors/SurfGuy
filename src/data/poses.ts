/**
 * Körperhaltungen für die prozedurale Animation (Gelenkwinkel in Grad, Euler XYZ).
 *
 * Koordinaten der Figur: +Y oben, Figur schaut nach +Z, +X ist ihre linke Seite.
 * Das Brett zeigt mit der Spitze nach +Z. Im Stehen ist der Körper um -90° gedreht
 * (Surf-Stand quer zum Brett, linker Fuß vorne).
 */
import type { PoseDef } from './types';

export const POSES: PoseDef[] = [
  {
    // Bauchlage auf dem Brett (Homescreen, Paddeln). Arme werden beim Paddeln prozedural überschrieben.
    id: 'lie',
    bodyRotation: [90, 0, 0],
    bodyOffset: [0, 0.2, -0.95],
    joints: {
      spine: [-12, 0, 0],
      head: [-40, 0, 0],
      armL: [-150, 0, 20],
      armR: [-150, 0, -20],
      forearmL: [-10, 0, 0],
      forearmR: [-10, 0, 0],
      legL: [0, 0, 6],
      legR: [0, 0, -6],
      shinL: [12, 0, 0],
      shinR: [18, 0, 0],
    },
  },
  {
    // Lockerer Surf-Stand, Knie gebeugt, Arme zum Balancieren.
    id: 'stand',
    bodyRotation: [0, -90, 0],
    bodyOffset: [0, -0.16, 0],
    joints: {
      hips: [0, 0, 0],
      spine: [14, 0, 0],
      head: [-6, 70, 0],
      armL: [-10, 0, 62],
      forearmL: [-20, 0, 18],
      armR: [10, 0, -58],
      forearmR: [-15, 0, -14],
      legL: [-28, 0, 24],
      shinL: [50, 0, 0],
      legR: [-28, 0, -24],
      shinR: [50, 0, 0],
    },
  },
  {
    // Tief in den Knien (Absprung, Landung).
    id: 'crouch',
    bodyRotation: [0, -90, 0],
    bodyOffset: [0, -0.38, 0],
    joints: {
      spine: [32, 0, 0],
      head: [-20, 65, 0],
      armL: [-35, 0, 40],
      forearmL: [-40, 0, 10],
      armR: [-25, 0, -40],
      forearmR: [-40, 0, -10],
      legL: [-62, 0, 26],
      shinL: [100, 0, 0],
      legR: [-62, 0, -26],
      shinR: [100, 0, 0],
    },
  },
  {
    // Gehockt, Hände an den Schienbeinen (Salto).
    id: 'tuck',
    bodyRotation: [0, -90, 0],
    bodyOffset: [0, -0.42, 0],
    joints: {
      spine: [42, 0, 0],
      head: [10, 40, 0],
      armL: [-60, 0, 18],
      forearmL: [-60, 0, 0],
      armR: [-60, 0, -18],
      forearmR: [-60, 0, 0],
      legL: [-100, 0, 12],
      shinL: [125, 0, 0],
      legR: [-100, 0, -12],
      shinR: [125, 0, 0],
    },
  },
  {
    // Weit ausgebreitete Arme (Board-Wirbel).
    id: 'spin',
    bodyRotation: [0, -90, 0],
    bodyOffset: [0, -0.26, 0],
    joints: {
      spine: [18, 0, 0],
      head: [-5, 40, 0],
      armL: [0, 0, 95],
      forearmL: [0, 0, 5],
      armR: [0, 0, -95],
      forearmR: [0, 0, -5],
      legL: [-45, 0, 22],
      shinL: [75, 0, 0],
      legR: [-45, 0, -22],
      shinR: [75, 0, 0],
    },
  },
  {
    // Brett über dem Kopf (Ausholen beim Board-Schlag). Körper schaut nach vorne.
    id: 'boardRaise',
    bodyRotation: [0, 0, 0],
    bodyOffset: [0, -0.1, -0.2],
    joints: {
      spine: [-18, 0, 0],
      head: [-15, 0, 0],
      armL: [-170, 0, 18],
      forearmL: [-25, 0, 0],
      armR: [-170, 0, -18],
      forearmR: [-25, 0, 0],
      legL: [-15, 0, 10],
      shinL: [25, 0, 0],
      legR: [10, 0, -10],
      shinR: [20, 0, 0],
    },
  },
  {
    // Zuschlagen nach vorne.
    id: 'boardSmash',
    bodyRotation: [0, 0, 0],
    bodyOffset: [0, -0.3, 0.1],
    joints: {
      spine: [45, 0, 0],
      head: [-30, 0, 0],
      armL: [-80, 0, 12],
      forearmL: [-10, 0, 0],
      armR: [-80, 0, -12],
      forearmR: [-10, 0, 0],
      legL: [-55, 0, 10],
      shinL: [70, 0, 0],
      legR: [-10, 0, -10],
      shinR: [60, 0, 0],
    },
  },
  {
    // Luftpose mit offenen Armen.
    id: 'air',
    bodyRotation: [0, -90, 0],
    bodyOffset: [0, -0.2, 0],
    joints: {
      spine: [10, 0, 0],
      head: [-10, 60, 0],
      armL: [-40, 0, 110],
      forearmL: [0, 0, 25],
      armR: [-20, 0, -105],
      forearmR: [0, 0, -25],
      legL: [-40, 0, 20],
      shinL: [70, 0, 0],
      legR: [-40, 0, -20],
      shinR: [70, 0, 0],
    },
  },
  {
    // Sturz (Wipeout).
    id: 'fall',
    bodyRotation: [-60, -90, 25],
    bodyOffset: [0, 0.05, -0.2],
    joints: {
      spine: [-20, 0, 15],
      head: [-25, 30, 0],
      armL: [-160, 0, 60],
      forearmL: [-30, 0, 0],
      armR: [-140, 0, -70],
      forearmR: [-30, 0, 0],
      legL: [-70, 0, 30],
      shinL: [40, 0, 0],
      legR: [10, 0, -30],
      shinR: [70, 0, 0],
    },
  },
  {
    // Zu Fuß an Land: aufrecht, Brett unter dem rechten Arm.
    id: 'walk',
    bodyRotation: [0, 0, 0],
    bodyOffset: [0, -0.05, 0],
    joints: {
      spine: [4, 0, 0],
      head: [-4, 0, 0],
      armL: [6, 0, 10],
      forearmL: [-15, 0, 0],
      armR: [-8, 0, -18],
      forearmR: [-70, 0, 0],
    },
  },
];
