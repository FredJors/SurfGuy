/**
 * Zentrale Konfiguration: ALLE Spielwerte stehen hier.
 * Einheiten: Meter (m), Sekunden (s), Grad (°) – sofern nicht anders angegeben.
 *
 * Inhalte (Tricks, Boards, Monster, Zonen …) liegen in src/data/.
 */
export const CONFIG = {
  /** Fester Startwert für den Zufall. null = jeder Run anders. Per URL überschreibbar: ?seed=123 */
  seed: null as number | null,

  render: {
    /** Obergrenze für devicePixelRatio (Schärfe vs. Leistung) */
    maxPixelRatioDesktop: 2,
    maxPixelRatioMobile: 1.5,
    minPixelRatio: 0.6,
    /** Auflösung automatisch senken, wenn die Bildrate einbricht */
    adaptiveResolution: true,
    targetFps: 55,
    antialias: true,
    fov: 62,
    near: 0.1,
    far: 6000,
    /** Konturen (Outline) um Figuren und Objekte */
    outlineThickness: 0.035,
    outlineColor: '#1d2140',
  },

  colors: {
    skyTop: '#2f9bff',
    skyHorizon: '#c6f1ff',
    sun: '#fff6d5',
    fog: '#bfeaff',
    waterDeep: '#0b6fd0',
    waterShallow: '#1ec8e8',
    waterFoam: '#ffffff',
    waterShadow: '#0a4fa8',
    sand: '#ffe08a',
    rock: '#8a5a44',
    rockDark: '#5b3a2e',
    grass: '#55d14a',
    palmTrunk: '#c98a4b',
    palmLeaf: '#2fbf4f',
    lava: '#ff6a1a',
    reef: '#ff8f6b',
    storm: '#5a6b8c',
  },

  light: {
    /** Richtung zur Sonne (wird normalisiert) */
    sunDirection: [0.45, 0.8, -0.35] as [number, number, number],
    sunIntensity: 2.2,
    hemiSky: '#ffffff',
    hemiGround: '#5aa0d8',
    hemiIntensity: 1.1,
  },

  fog: {
    near: 160,
    far: 1500,
  },

  camera: {
    /** Abstand hinter dem Surfer */
    distance: 8.5,
    /** Höhe über der Wasserlinie des Surfers */
    height: 3.6,
    /** Blickpunkt-Höhe über dem Surfer */
    lookHeight: 1.3,
    /** Blickpunkt vor dem Surfer */
    lookAhead: 5,
    /** Wie schnell die Kamera der Blickrichtung folgt (1/s) – weich, ohne Wackeln */
    yawFollowRate: 3.2,
    /** Wie schnell die Kamera Höhenänderungen (Wellen) folgt (1/s) */
    heightFollowRate: 1.6,
    /** Homescreen: Kamera seitlich/schräg */
    home: { side: 3.6, back: 5.2, up: 1.5, lookUp: 0.9, lookAheadToIsland: 4, orbitSpeed: 0.04, screenShift: 1.9 },
    /** Dauer der Kamerafahrt vom Menü ins Spiel (s) */
    transitionDuration: 2.2,
    /** Shop-Vorschau: Kamera kreist nah um den stehenden Surfer; screenX = Position im Bild (0 = links) */
    showcase: { distance: 5.2, height: 1.5, lookUp: 1.0, orbitSpeed: 0.22, screenX: 0.2 },
    /** Weicher Wechsel zwischen Homescreen und Shop-Vorschau (s) */
    blendTime: 0.8,
    /** Zusätzliches Sichtfeld bei Höchsttempo (°) – Gefühl von Geschwindigkeit */
    speedFov: 9,
    /** Bei großen Sprüngen folgt die Kamera nach oben (Anteil der Höhe über diesem Wert) */
    airFollowFrom: 2.5,
    airFollowFactor: 0.75,
    airFollowRate: 3.5,
    /** Kamera-Stöße (Sichtfeld-Kick, Wackeln) klingen so schnell ab (1/s) */
    kickDecay: 4,
  },

  ocean: {
    /** Radius des Wassernetzes, das dem Spieler folgt */
    radius: 2200,
    /** Ringe/Segmente des polaren Netzes (Detail nimmt nach außen ab) */
    rings: 150,
    segments: 200,
    /** Innerster Ringabstand */
    innerRingSpacing: 0.7,
    /** Ruhige Grunddünung: [Amplitude, Wellenlänge, Richtung°, Tempo] */
    swell: [
      [0.22, 34, 20, 4.5],
      [0.14, 19, -35, 3.4],
      [0.08, 11, 75, 2.6],
      [0.05, 7, 140, 2.0],
    ] as [number, number, number, number][],
    /** Schaum ab dieser relativen Höhe auf Wellenkämmen (0..1) */
    foamThreshold: 0.62,
  },

  waves: {
    /** Pause bis zur nächsten Welle (s) – zufällig zwischen min und max */
    interval: [2, 6] as [number, number],
    /** Erste Welle nach Spielstart (s) */
    firstWaveDelay: 4,
    /** Wahrscheinlichkeit für ein Set statt einer einzelnen Welle */
    setChance: 0.25,
    /** Wellen pro Set mit Gewichtung */
    wavesPerSet: { 2: 0.3, 3: 0.5, 4: 0.2 } as Record<number, number>,
    /** Abstand der Wellen eines Sets (m) */
    setSpacing: [22, 38] as [number, number],
    /** Anteil der Wellen, die irgendwo um die Insel entstehen (nicht beim Spieler) */
    ambientChance: 0.3,
    /** Höhe einer Welle (m) */
    height: [0.9, 2.0] as [number, number],
    /** Die letzte Welle eines Sets ist um diesen Faktor höher */
    lastWaveFactor: 1.4,
    /** Seltene große Einzelwelle */
    bigWaveChance: 0.12,
    bigWaveHeight: [2.4, 3.2] as [number, number],
    /** Tempo Richtung Insel (m/s) */
    speed: [11, 16] as [number, number],
    /** Breite der steilen Vorderseite / flachen Rückseite (m) */
    frontWidth: [5.5, 8] as [number, number],
    backWidth: [12, 18] as [number, number],
    /** Halbe Länge des Kamms (m): kurze Peaks bis lange Bögen um die Insel */
    halfLength: [60, 230] as [number, number],
    /** Seitliche Wanderung der Welle (m/s) */
    lateralDrift: 2.5,
    /** Höhenmuster entlang des Kamms: Stärke (0..1), Abstand der Spitzen (m), Wandertempo (m/s) */
    patternAmount: 0.4,
    patternWavelength: [45, 160] as [number, number],
    patternSpeed: 6,
    /** Eine Welle erreicht den Spieler nach dieser Zeit (s) – daraus ergibt sich der Startabstand */
    arrivalTime: [7, 14] as [number, number],
    /** Grenzen für den Startabstand (m) */
    minSpawnDistance: 50,
    maxSpawnDistance: 320,
    /** Wellen laufen bis zum Riff, höchstens so weit (m) */
    travelMax: 650,
    /** Nach so vielen Metern ist eine Welle voll ausgebildet */
    growDistance: 60,
    /** Anteil der Gesamtstrecke zum Auslaufen */
    fadePortion: 0.15,
    /** Max. gleichzeitig aktive Wellen (Shader-Limit) */
    maxActive: 16,
  },

  catchWave: {
    /** Zeitfenster: Spieler vor dem Kamm zwischen min und max Metern */
    windowMin: -0.5,
    windowMax: 7.5,
    /** Max. Winkel zwischen Blickrichtung und Wellenrichtung (°) */
    maxAngle: 75,
    /** Minimale Wellenhöhe am Spieler (m) */
    minHeight: 0.7,
    /** Mindesttempo nach dem Erwischen (m/s) */
    minRideSpeed: 12,
    /** Die Welle schiebt mit (Anteil des Wellentempos) */
    carry: 1,
    /** Eigene Vorwärtsbewegung zählt beim Reiten nur anteilig (sonst fährt man aus der Welle) */
    forwardFactor: 0.25,
    /** Ritt endet, wenn man so weit vor/hinter dem Kamm ist (m) */
    rideMin: -5,
    rideMax: 16,
    /** Hangabtrieb: die Welle zieht zusätzlich nach vorne (m/s) */
    faceSlide: 1.2,
    /** Beschleunigung beim Reiten (m/s²) bis rideSpeedCap */
    rideAccel: 1.5,
    rideSpeedCap: 18,
  },

  /** Grundwerte des Spielers. Boards, Skills und Fähigkeiten verändern sie über Modifikatoren. */
  playerBase: {
    maxSpeed: 22,
    paddleSpeed: 6,
    paddleAccel: 2.4,
    cruiseSpeed: 8,
    pumpAccel: 1.4,
    turnRate: 2.0,
    brakeDecel: 7,
    speedDecay: 0.7,
    jumpPower: 1,
    drawTime: 1,
    stability: 1,
    waveBoost: 3.2,
    catchWindow: 1,
    trickDamage: 1,
    trickPoints: 1,
    pearlMagnet: 2.3,
    maxHearts: 3,
    invulnTime: 3,
    xpGain: 1,
    pearlGain: 1,
    scoreGain: 1,
  },

  player: {
    /** Ab diesem Tempo steht der Surfer auf (m/s) … */
    standSpeed: 5,
    /** … und unter diesem legt er sich wieder hin (Hysterese) */
    lieSpeed: 3.8,
    /** Dauer der Aufsteh-Animation (s) */
    standUpTime: 0.45,
    /** Drehrate sinkt bei hohem Tempo um diesen Anteil */
    turnSpeedFalloff: 0.35,
    /** Wasserwiderstand im Liegen ohne Paddeln (m/s²) */
    waterDrag: 1.2,
    /** Seitliches Neigen in Kurven (°) */
    maxLean: 28,
    /** Sprung: v = basis + tempoFaktor × Tempo (+ Wellenbonus × Wellenhöhe beim Reiten) */
    jumpBase: 4.2,
    jumpSpeedFactor: 0.27,
    jumpWaveBonus: 0.9,
    gravity: 18,
    /** Mindest-Airtime, damit sich das Zeichenfenster öffnet (Spielsekunden) */
    minAirtimeForTrick: 0.45,
    /** Drehrate in der Luft (Anteil) */
    airTurnFactor: 0.35,
    /** Dauer des Landens (s) */
    landingTime: 0.28,
    /** Dauer eines Stürzes (s) */
    wipeoutTime: 1.4,
    /** Tempo nach dem Sturz (Anteil) */
    wipeoutSpeedFactor: 0.15,
    /** Anschub beim Weiterpaddeln nach einem Sturz (m/s) – man soll nicht festhängen */
    recoverSpeed: 3.5,
    /** Tempo über dem Höchsttempo (Turbo, Geysir, Delfine …) baut sich so schnell ab (m/s²) */
    overdriveDecay: 2.2,
  },

  trick: {
    /** Zeitlupenfaktor im Zeichenfenster (größer = weniger echte Zeit zum Zeichnen) */
    slowMotion: 0.19,
    /** Anteil der Airtime, der zum Zeichnen genutzt wird (Rest = Trick) */
    drawPortion: 0.55,
    /** Grenzen für die Zeichenzeit (echte Sekunden) */
    minDrawTime: 1.0,
    maxDrawTime: 4,
    /** Trick-Kombo: bleibt nach einem Trick noch so viel Flugzeit (Spielsekunden), geht ein weiterer */
    comboMinAir: 0.5,
    /** Bonus je weiterem Trick im selben Sprung (+50 % pro Trick) */
    comboChainBonus: 0.5,
    /** Kurze Verzögerung nach dem Absprung, bevor sich das Fenster öffnet (Spielsekunden) */
    openDelay: 0.06,
    /** Übergang Zeitlupe ↔ normal (echte Sekunden) */
    timeRamp: 0.18,
    /** Genauigkeit (0..1) → Qualität. Darunter: nicht erkannt. */
    quality: { okay: 0.75, good: 0.84, perfect: 0.91 },
    /** Faktor auf Schaden und Punkte je Qualität */
    qualityMultiplier: { okay: 0.75, good: 1, perfect: 1.5 },
    qualityLabel: { okay: 'Okay', good: 'Gut', perfect: 'Perfekt!' },
  },

  score: {
    waveCatchPerMeter: 100,
    ridePerSecondPerMeter: 20,
    jump: 25,
    airtimePerSecond: 40,
    /** Kombo: +Schritt pro Trick in Folge, bis max */
    comboStep: 0.5,
    comboMax: 5,
    /** Kombo verfällt, wenn so lange kein Trick gelandet wird (s) */
    comboTimeout: 9,
    /** Punkte pro Schadenspunkt an Monstern */
    pointsPerDamage: 3,
    pearl: 10,
    /** „Big Air“: ab dieser Airtime (s) gibt es Bonuspunkte pro Sekunde */
    bigAirTime: 2,
    bigAirPerSecond: 150,
    /** Punkte fürs Abheben je nach Quelle (+ pro Sekunde Airtime) */
    launch: { ramp: 300, geyser: 250, punch: 200, drop: 0 } as Record<string, number>,
    launchPerAirSecond: 80,
    /** Erfahrung pro 100 Punkte */
    xpPer100Points: 1,
  },

  pearls: {
    /** Perlen pro Welle */
    perWave: [4, 8] as [number, number],
    /** Höhe über der Wasseroberfläche (m) */
    hover: 0.9,
    /** Position relativ zum Kamm (m, + = vor dem Kamm, also auf der Wellenfront) */
    crestOffset: 2.2,
    value: 1,
    /** Perlenkette: nächste Perle innerhalb dieser Zeit (s) verlängert die Kette */
    chainWindow: 1.8,
    /** Bei diesen Kettenlängen gibt es Bonuspunkte (Länge × chainBonusPerPearl) */
    chainMilestones: [10, 20, 35, 50, 75, 100] as number[],
    chainBonusPerPearl: 25,
  },
  pickups: {
    /** Perlen-Formationen (Linie, Bogen, Ring, Zickzack) auf dem Wasser vor dem Spieler */
    formationInterval: [3, 5.5] as [number, number],
    formationDistance: [45, 75] as [number, number],
    /** Streuung um die Blickrichtung (°) */
    formationAngle: 28,
    formationSize: [6, 11] as [number, number],
    /** Chance auf eine Goldperle in der Formation und ihr Wert */
    goldChance: 0.3,
    goldValue: 5,
    /** Schatzkisten und Power-ups (data/pickups.ts) */
    specialInterval: [12, 20] as [number, number],
    specialDistance: [55, 85] as [number, number],
    /** Höhe über dem Wasser (m) */
    hover: 0.9,
    /** Perlen in diesem Vielfachen des Einsammelradius fliegen von selbst zum Spieler */
    attractFactor: 1.7,
    homingSpeed: 14,
    homingAccel: 70,
    /** Herausspritzende Perlen (Kiste, Monster): Tempo und Flugzeit bevor sie zum Spieler fliegen */
    burstSpeed: 9,
    burstTime: [0.35, 0.75] as [number, number],
    /** Höchstens so viele sichtbare Perlen pro Ausschüttung (Rest zählt mehrfach) */
    burstMaxPearls: 30,
    /** Weiter weg bzw. älter → verschwindet (m / s) */
    despawnDistance: 170,
    maxAge: 70,
    /** Nicht näher an der Insel als (m) */
    minIslandDistance: 300,
  },

  combat: {
    /** Kurzer Treffer-Stopp (echte Sekunden) */
    hitStop: 0.06,
    /** Erstes Monster frühestens nach so vielen Sekunden */
    firstMonsterDelay: 18,
    /** So hoch über dem Wasser verfehlen Tentakel-Schläge den Spieler (m) */
    dodgeHeight: 1.6,
    /** Unverwundbarkeit, nachdem der Blasenschild einen Treffer abgefangen hat (s) */
    shieldInvuln: 1.5,
    /** Monster tauchen in diesem Abstand vor dem Spieler auf (m) */
    spawnDistance: [26, 36] as [number, number],
    /** Max. Winkel zur Fahrtrichtung beim Auftauchen (°) */
    spawnAngle: 55,
  },

  world: {
    /** Position der Insel (Mittelpunkt, x/z) */
    islandPosition: [0, 0] as [number, number],
    /** Startposition des Spielers (Entfernung zur Insel) */
    startDistance: 820,
    /** Richtung vom Spieler zur Insel beim Start (°, 0 = -Z) */
    startBearing: 0,
    /** Inselradius (Strand) */
    islandRadius: 120,
    volcanoHeight: 150,
    /** Sturm-/Riffgrenze: näher kommt man in Meilenstein 1 nicht */
    boundaryRadius: 270,
    /** Breite des Bereichs, in dem zurückgedrängt wird */
    boundaryWidth: 40,
    /** Rückstoß (m/s²) */
    boundaryPush: 26,
    /** Ab dieser Entfernung wird die Insel optisch „mitgeführt“, damit sie immer sichtbar bleibt */
    islandMaxVisualDistance: 1700,
  },

  /** Wellen-Durchstoß: im Stehen gegen eine anrollende Welle springen → Schub nach außen */
  punch: {
    /** Kamm vor dem Spieler zwischen min und max Metern */
    windowMin: -1.5,
    windowMax: 6.5,
    /** Ab hier wird die Welle von vorn angekündigt (m) */
    announce: 22,
    /** Mindesthöhe der Welle an dieser Stelle (m) */
    minHeight: 0.6,
    /** Blickrichtung muss gegen die Wellenrichtung zeigen (cos des Winkels, ≤) */
    maxDot: -0.35,
    /** Absprung: Zusatz pro Meter Wellenhöhe (m/s) */
    heightBonus: 2.2,
    /** Tempo-Schub (m/s, darf über das Höchsttempo gehen) */
    boost: 7,
    /** Durchstoß-Kette: nächster Durchstoß innerhalb dieser Zeit (s) erhöht den Bonus */
    chainWindow: 10,
  },

  geysers: {
    /** Anzahl und Lage (Entfernung zur Insel, m) */
    count: 12,
    ringMin: 325,
    ringMax: 400,
    /** Radius, in dem man erfasst wird (m) */
    radius: 5.5,
    /** Ablauf: Ruhe → Blubbern (Warnung) → Ausbruch (s) */
    idle: [2.2, 4] as [number, number],
    warn: 1.2,
    erupt: 2.6,
    /** Wurf: senkrecht und waagrecht nach außen (m/s) */
    launchVy: 23,
    launchOut: 36,
    /** Tempo-Reserve nach der Landung (m/s über Höchsttempo) */
    overdrive: 9,
    columnHeight: 24,
    arcPearls: 12,
    visibleDistance: 800,
    /** Ab dieser Entfernung zur Insel zeigt das HUD den Weg zum nächsten Geysir (m) */
    hintDistance: 480,
  },

  dolphins: {
    /** Pause zwischen Delfin-Schulen (s) */
    interval: [10, 18] as [number, number],
    /** Nur in diesem Abstand zur Insel (m) */
    minDistance: 300,
    maxDistance: 950,
    count: [3, 5] as [number, number],
    /** Schwimmtempo nach außen (m/s) */
    speed: 16,
    /** Start: so weit innen (Richtung Insel) und seitlich vom Spieler (m) */
    spawnBack: [30, 45] as [number, number],
    spawnSide: [10, 20] as [number, number],
    /** Mitschwimmen: Abstand zu einem Delfin (m), Tempo-Bonus, seitlicher Zug */
    rideRadius: 7.5,
    rideBonus: 5,
    pull: 5,
    /** Im Windschatten: alle x Sekunden eine Perle und Punkte */
    pearlInterval: 0.5,
    pointsPerSecond: 60,
    /** Nach dieser Strecke tauchen sie ab (m) */
    travel: 360,
    visibleDistance: 300,
  },

  wrecks: {
    /** Anzahl Schiffswracks und Bereich (Entfernung zur Insel, m) */
    count: 32,
    ringMin: 330,
    ringMax: 1000,
    minSpacing: 110,
    /** Mindestabstand zum Startpunkt (m) */
    startClearance: 70,
    /** Rampe: Länge (waagrecht), Breite, Höhe am Bug, Höhe am Heck (unter Wasser) */
    length: [20, 27] as [number, number],
    width: [6.5, 8] as [number, number],
    topHeight: [4.5, 6.5] as [number, number],
    baseHeight: -0.8,
    /** Anteil der Wracks, deren Bug ungefähr nach außen zeigt (hilft beim Rauskommen) */
    outwardShare: 0.6,
    /** Abheben am Bug: vy = launchBase + Tempo × launchSpeedFactor (m/s) */
    launchBase: 7,
    launchSpeedFactor: 0.45,
    /** So hoch darf eine Stufe sein, um aufs Deck zu fahren (m) */
    stepUp: 0.7,
    /** Bremsen bergauf (Anteil der Hangneigung, m/s²) */
    slopeDrag: 4,
    /** Seitlich gegen den Rumpf: Tempo-Faktor */
    bonkSpeedFactor: 0.35,
    /** Perlenbogen über der Rampe: Vorhersage für dieses Tempo, Anzahl Perlen */
    arcSpeed: 16,
    arcPearls: 9,
    /** Neue Perlen nach dem Einsammeln (s) */
    arcCooldown: 25,
    /** Sichtweite der Wracks (m) */
    visibleDistance: 520,
  },

  chests: {
    /** Doppeltes Board-Design → so viele Perlen (je Seltenheit) */
    duplicatePearls: { common: 30, rare: 60, epic: 150, legendary: 400 } as Record<string, number>,
    /** Walze: Anzahl Karten, Position des Gewinns, Laufzeit (s) */
    reelLength: 46,
    winIndex: 38,
    spinTime: 5.2,
  },

  audio: {
    /** Gesamtlautstärke der Effekte (0–1) */
    volume: 0.7,
    /** Meeresrauschen im Hintergrund */
    ambience: 0.05,
  },

  hud: {
    /** Wellen-Anzeige: so weit im Voraus wird eine Welle angezeigt (m) */
    waveLookahead: 60,
  },

  /** Debug-Hilfen (per URL ?debug aktivierbar) */
  debug: {
    logStrokes: false,
    showFps: false,
  },
};

export type GameConfig = typeof CONFIG;
export type PlayerBaseStats = typeof CONFIG.playerBase;
