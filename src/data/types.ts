/**
 * Typisierte Datendefinitionen. Neue Tricks, Boards, Skins, Fähigkeiten, Skill-Knoten
 * und Monster entstehen durch neue Einträge in den Dateien dieses Ordners.
 */
import type { Modifier as BaseModifier } from '../core/Modifiers';
import type { EaseId } from '../core/math';

/** Alle Spielerwerte, die über Modifikatoren verändert werden können. */
export type PlayerStatId =
  /** Höchsttempo insgesamt (m/s) */
  | 'maxSpeed'
  /** Höchsttempo beim Paddeln im Liegen (m/s) */
  | 'paddleSpeed'
  /** Beschleunigung beim Paddeln (m/s²) */
  | 'paddleAccel'
  /** Tempo, das man im Stehen ohne Welle durch „Pumpen“ halten kann (m/s) */
  | 'cruiseSpeed'
  /** Beschleunigung beim Pumpen im Stehen (m/s²) */
  | 'pumpAccel'
  /** Drehgeschwindigkeit (rad/s) */
  | 'turnRate'
  /** Bremsverzögerung (m/s²) */
  | 'brakeDecel'
  /** Tempoverlust ohne Welle (m/s²) */
  | 'speedDecay'
  /** Faktor auf die Absprunggeschwindigkeit */
  | 'jumpPower'
  /** Faktor auf die Zeit im Zeichenfenster */
  | 'drawTime'
  /** Stabilität: Toleranz bei der Landung (1 = normal) */
  | 'stability'
  /** Tempo-Boost pro Meter Wellenhöhe beim Erwischen (m/s pro m) */
  | 'waveBoost'
  /** Faktor auf die Größe des Zeitfensters zum Wellen-Erwischen */
  | 'catchWindow'
  /** Faktor auf den Trickschaden */
  | 'trickDamage'
  /** Faktor auf Trickpunkte */
  | 'trickPoints'
  /** Einsammelradius für Perlen (m) */
  | 'pearlMagnet'
  /** Herzen pro Run */
  | 'maxHearts'
  /** Unverwundbarkeit nach Treffer (s) */
  | 'invulnTime'
  /** Faktor auf gewonnene Erfahrung */
  | 'xpGain'
  /** Faktor auf gewonnene Perlen */
  | 'pearlGain'
  /** Faktor auf alle Punkte (z. B. Power-up „Doppelte Punkte“) */
  | 'scoreGain';

export type Modifier = BaseModifier<PlayerStatId>;

export type Vec3Tuple = readonly [number, number, number];

/** Wann ist etwas freigeschaltet? */
export type UnlockCondition =
  | { readonly type: 'default' }
  | { readonly type: 'pearls'; readonly amount: number }
  | { readonly type: 'xp'; readonly amount: number }
  | { readonly type: 'skill'; readonly skillId: string }
  | { readonly type: 'bestiary'; readonly monsterId: string; readonly tier: number }
  | { readonly type: 'highscore'; readonly score: number };

// ---------------------------------------------------------------------------
// Symbole & Tricks
// ---------------------------------------------------------------------------

export interface Point2 {
  readonly x: number;
  readonly y: number;
}

/** Ein Symbol, das der Spieler zeichnen kann (eine oder mehrere Vorlagen). */
export interface SymbolDef {
  readonly id: string;
  readonly name: string;
  /** Vorlagen-Striche (Bildschirmkoordinaten, y nach unten). Mehr Varianten = robustere Erkennung. */
  readonly templates: readonly (readonly Point2[])[];
  /** Strich für die Vorschau im Zeichenfenster. */
  readonly preview: readonly Point2[];
}

/** Körperhaltungen (Gelenkwinkel) – siehe data/poses.ts. */
export type JointId =
  | 'hips'
  | 'spine'
  | 'head'
  | 'armL'
  | 'forearmL'
  | 'armR'
  | 'forearmR'
  | 'legL'
  | 'shinL'
  | 'legR'
  | 'shinR';

export interface PoseDef {
  readonly id: string;
  /** Gelenkrotationen in Grad (Euler XYZ). Fehlende Gelenke = 0. */
  readonly joints: Partial<Record<JointId, Vec3Tuple>>;
  /** Verschiebung des ganzen Körpers relativ zum Brett (m). */
  readonly bodyOffset?: Vec3Tuple;
  /** Drehung des ganzen Körpers relativ zum Brett (Grad). */
  readonly bodyRotation?: Vec3Tuple;
}

export interface TrickPoseKey {
  /** Zeitpunkt 0..1 innerhalb des Tricks */
  readonly t: number;
  readonly pose: string;
}

export interface TrickBoardKey {
  readonly t: number;
  /** Brett-Position relativ zur Normallage (m) */
  readonly offset: Vec3Tuple;
  /** Brett-Drehung relativ zur Normallage (Grad) */
  readonly rotation: Vec3Tuple;
}

/** Prozedurale Trick-Animation – rein datengetrieben. */
export interface TrickAnimation {
  /** Ganze Umdrehungen von Surfer + Brett: pitch = Salto, yaw = Wirbel, roll = Schraube */
  readonly spin?: { readonly pitch?: number; readonly yaw?: number; readonly roll?: number; readonly ease?: EaseId };
  /** Körperhaltungen im Zeitverlauf */
  readonly poses: readonly TrickPoseKey[];
  /** Optionale Brett-Bewegung (z. B. Brett in die Hände nehmen und zuschlagen) */
  readonly board?: readonly TrickBoardKey[];
}

/** Trefferbereich eines Tricks, relativ zum Surfer. */
export type HitArea =
  /** Kreis um den Surfer */
  | { readonly shape: 'circle'; readonly radius: number }
  /** Kegel nach vorne */
  | { readonly shape: 'cone'; readonly range: number; readonly halfAngleDeg: number };

export interface TrickDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Symbol-ids (data/symbols.ts), die diesen Trick auslösen */
  readonly symbols: readonly string[];
  readonly animation: TrickAnimation;
  /** Dauer des Tricks in Spielsekunden (der Sprung wird passend verlängert) */
  readonly duration: number;
  /** Zeitpunkt 0..1, an dem der Treffer ausgewertet wird */
  readonly hitTime: number;
  readonly damage: number;
  readonly hitArea: HitArea;
  /** 'all' = alle Ziele im Bereich, 'nearest' = nur das nächste */
  readonly targeting: 'all' | 'nearest';
  /** Bevorzugte Ziel-Teile (z. B. 'head'). Fehlt → alle Teile. */
  readonly targetTags?: readonly string[];
  /** Vorwärtsbewegung während des Tricks; mit homingTag Zielsuche (z. B. über den Kopf springen) */
  readonly travel?: {
    readonly distance: number;
    readonly homingTag?: string;
    readonly maxDistance?: number;
    readonly overshoot?: number;
    /** Mindest-Scheitelhöhe über dem Wasser, wenn ein Ziel angesteuert wird (m) – z. B. über den Kopf springen */
    readonly apex?: number;
  };
  readonly points: number;
  readonly unlock: UnlockCondition;
  /** Farbe für Leuchteffekte und Einblendungen */
  readonly color: string;
}

export type TrickQuality = 'okay' | 'good' | 'perfect';

// ---------------------------------------------------------------------------
// Boards & Skins
// ---------------------------------------------------------------------------

export interface BoardDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Asset-id im Manifest (assets/manifest.ts) */
  readonly model: string;
  /** Farben für den Platzhalter / Materialvariante */
  readonly colors: { readonly base: string; readonly stripe: string; readonly rail: string };
  /** Basiswerte als Faktor (1 = Standard) */
  readonly stats: {
    readonly speed: number;
    readonly agility: number;
    readonly airtime: number;
    readonly stability: number;
  };
  /** Zusätzliche Modifikatoren (optional) */
  readonly modifiers?: readonly Modifier[];
  /** Preis in Perlen (0 = gratis) */
  readonly price: number;
  readonly unlock: UnlockCondition;
}

export interface SkinDef {
  readonly id: string;
  readonly name: string;
  /** Asset-id im Manifest */
  readonly model: string;
  /** Materialvariante */
  readonly colors: {
    readonly skin: string;
    readonly hair: string;
    readonly shirt: string;
    readonly shorts: string;
  };
  /** Zubehör für den Platzhalter: 'cap', 'sunglasses', 'bandana', 'headband', 'flower' */
  readonly accessories?: readonly string[];
  readonly price: number;
  readonly unlock: UnlockCondition;
}

// ---------------------------------------------------------------------------
// Fähigkeiten & Skillbaum
// ---------------------------------------------------------------------------

export interface AbilityDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** passive = wirkt dauerhaft über Modifikatoren; active = wird per Knopf ausgelöst */
  readonly kind: 'passive' | 'active';
  readonly modifiers?: readonly Modifier[];
  /** Kurzes Symbol für Knopf und Skillbaum (1–2 Zeichen) */
  readonly icon: string;
  /** Nur für aktive Fähigkeiten: Abklingzeit (s) */
  readonly cooldown?: number;
  /** id eines Effekts (player/abilityEffects.ts), der bei Aktivierung ausgeführt wird */
  readonly effect?: string;
  /** Wirkdauer (s), falls der Effekt eine hat */
  readonly duration?: number;
  /** Effekt-Parameter (z. B. Tempo-Schub in m/s) */
  readonly params?: Readonly<Record<string, number>>;
}

export interface SkillNodeDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** ids der Knoten, die vorher freigeschaltet sein müssen (Baumstruktur) */
  readonly requires: readonly string[];
  readonly cost: { readonly pearls?: number; readonly xp?: number };
  readonly modifiers?: readonly Modifier[];
  readonly grantsAbility?: string;
  readonly grantsTrick?: string;
  /** Kurzes Symbol im Skillbaum (1–2 Zeichen); fehlt es, wird das der Fähigkeit bzw. der Anfangsbuchstabe genutzt */
  readonly icon?: string;
  /** Position im Skillbaum-UI (Spalte, Zeile) */
  readonly position: { readonly col: number; readonly row: number };
}

// ---------------------------------------------------------------------------
// Monster & Zonen
// ---------------------------------------------------------------------------

export interface MonsterPartDef {
  readonly id: string;
  /** Tag für Schwächen und Trick-Ziele, z. B. 'head' oder 'tentacle' */
  readonly tag: string;
  readonly hp: number;
  /** Anzahl (z. B. Tentakel); kann durch die Stufe erhöht werden */
  readonly count: number;
  /** Trefferradius (m) */
  readonly radius: number;
}

export interface WeaknessDef {
  readonly trick: string;
  /** Nur gegen Teile mit diesem Tag; fehlt → gegen alle Teile */
  readonly tag?: string;
  readonly multiplier: number;
}

export interface MonsterTierDef {
  readonly tier: number;
  readonly name: string;
  readonly hpMul: number;
  readonly speedMul: number;
  /** < 1 = schnellere Angriffe */
  readonly windupMul: number;
  readonly rewardMul: number;
  /** Zusätzliche Anzahl je Teil-id (z. B. mehr Tentakel) */
  readonly extraParts?: Readonly<Record<string, number>>;
}

export interface MonsterDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Asset-id des Modells */
  readonly model: string;
  /** id der Verhaltens-Implementierung (monsters/behaviors.ts) */
  readonly behavior: string;
  /** Endgegner: taucht nicht zufällig auf, zählt nicht zu den Siegeln im Bestiarium */
  readonly boss?: boolean;
  /** Lebenspunkte des Hauptkörpers */
  readonly hp: number;
  readonly parts: readonly MonsterPartDef[];
  /** Körperradius für Kollision mit dem Spieler (m) */
  readonly bodyRadius: number;
  /** Anteil des Schadens an Teilen, der auch den Hauptkörper trifft */
  readonly partDamageToBody: number;
  /** Vorwarnzeit vor dem Auftauchen (s) */
  readonly warningTime: number;
  /** Verfolgungstempo (m/s) */
  readonly chaseSpeed: number;
  /** Bevorzugter Abstand zum Spieler (m) */
  readonly preferredDistance: number;
  /** Freie Zahlenwerte für das Verhalten (z. B. Ramm-Tempo des Hais), siehe jeweilige Klasse */
  readonly behaviorParams?: Readonly<Record<string, number>>;
  /** Hinterhalt: ist das Monster so lange hinter dem Spieler, taucht es ab und vor ihm wieder auf */
  readonly ambush?: { readonly behindTime: number; readonly maxCount: number; readonly aheadDistance: number };
  readonly attack: {
    /** Ausholzeit = sichtbare Vorwarnung (s) */
    readonly windup: number;
    /** Pause zwischen Angriffen eines Tentakels (s) */
    readonly cooldown: readonly [number, number];
    /** Reichweite ab Körpermitte (m) */
    readonly reach: number;
    /** Trefferradius des Schlags (m) */
    readonly radius: number;
    /** Wie stark der Spieler „vorgehalten“ wird (0 = gar nicht, 1 = voll) */
    readonly lead: number;
    /** Gleichzeitige Angriffe */
    readonly maxConcurrent: number;
    /** Nach einem Treffer am Spieler: so lange keine Angriffe, Monster weicht zurück (s) */
    readonly graceAfterHit: number;
  };
  readonly weaknesses: readonly WeaknessDef[];
  readonly tiers: readonly MonsterTierDef[];
  readonly rewards: { readonly pearls: number; readonly xp: number; readonly points: number };
  /** Punkte, wenn man dem Monster entkommt (weniger als Besiegen) */
  readonly escapePoints: number;
  /** Ab dieser Entfernung zieht es sich zurück (= entkommen) */
  readonly escapeDistance: number;
  /** Gewichtung je Zone (zone-id → Gewicht); 0/fehlend = taucht dort nicht auf */
  readonly zoneWeights: Readonly<Record<string, number>>;
  /** Farben für Platzhalter-Modell */
  readonly colors: { readonly body: string; readonly accent: string; readonly eye: string };
}

export interface ZoneDef {
  readonly id: string;
  readonly name: string;
  /** Zone gilt bis zu dieser Entfernung zur Insel (m); Zonen werden aufsteigend geprüft */
  readonly maxDistance: number;
  /** Zufällige Pause zwischen Monstern (s) */
  readonly spawnInterval: readonly [number, number];
  readonly maxMonsters: number;
  /** Gewichtung der Monster-Stufen (Stufe → Gewicht) */
  readonly tierWeights: Readonly<Record<number, number>>;
}

// ---------------------------------------------------------------------------
// Einsammel-Objekte im Meer (Schatzkisten, Power-ups)
// ---------------------------------------------------------------------------

export interface PickupDef {
  readonly id: string;
  readonly name: string;
  /** Asset-id im Manifest */
  readonly model: string;
  /** Farben für das Platzhalter-Modell */
  readonly colors?: Readonly<Record<string, string>>;
  /** Symbol im HUD, solange ein Power-up wirkt (1–2 Zeichen) */
  readonly icon: string;
  /** Effektfarbe (Funken, Ring, HUD) */
  readonly color: string;
  /** Perlen, die beim Einsammeln herausspritzen (und eingesammelt werden) */
  readonly pearls?: number;
  readonly points?: number;
  /** Zeitlich begrenzte Werte-Änderung (Power-up), wirkt `duration` Sekunden */
  readonly modifiers?: readonly Modifier[];
  readonly duration?: number;
  /** Sofortiger Tempo-Schub (m/s, darf kurz über das Höchsttempo gehen) */
  readonly boost?: number;
  /** Truhe: wird nach dem Run mit dem Glücksspiel geöffnet (data/chestRewards.ts) */
  readonly chest?: boolean;
  /** Wie oft es im Meer auftaucht (relativ zu den anderen) */
  readonly spawnWeight: number;
  /** Einsammelradius (m) */
  readonly radius: number;
}

// ---------------------------------------------------------------------------
// Truhen: Seltenheit, Board-Designs, Belohnungen
// ---------------------------------------------------------------------------

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Board-Design: Farbvariante, die auf jedes Board gelegt werden kann (nur Optik). */
export interface BoardDesignDef {
  readonly id: string;
  readonly name: string;
  readonly rarity: Rarity;
  readonly colors: { readonly base: string; readonly stripe: string; readonly rail: string };
}

/** Möglicher Inhalt einer Truhe. Genau eins von pearls / xp / design. */
export interface ChestRewardDef {
  readonly id: string;
  readonly name: string;
  readonly rarity: Rarity;
  /** Relative Wahrscheinlichkeit */
  readonly weight: number;
  readonly pearls?: number;
  readonly xp?: number;
  /** id aus data/boardDesigns.ts */
  readonly design?: string;
}
