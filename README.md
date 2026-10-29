# SurfGuy – 3D-Surfspiel im Browser

Third-Person-Surfspiel im Comic-Look für Handy und Desktop: Wellen erwischen, im Sprung ein
Symbol zeichnen, Tricks machen und Meeresmonster besiegen. Gebaut mit **Vite + TypeScript +
Three.js**. Der Build ist **eine einzige, eigenständige HTML-Datei**.

Stand: **Meilenstein 2** – zusätzlich zu Meilenstein 1 (Homescreen, Surfen, Wellen um die
Insel, Zeichen-Tricks, Kraken, Punkte, Perlen, Herzen, Spielstand) gibt es jetzt einen
**Shop** für Boards und Outfits, einen **Skillbaum** mit aktiven **Fähigkeiten**, ein
**Bestiarium** und zwei neue Monster (**Riffhai**, **Riesenqualle**). Die Architektur ist auf
Meilenstein 3 ausgelegt (Boss, Insel-Landung, Wetter).

---

## 1. Voraussetzungen

- **Node.js (LTS, ab Version 20)** – <https://nodejs.org> → „LTS“ herunterladen und installieren.
  - Windows/macOS: Installer ausführen.
  - Linux: z. B. über den Paketmanager oder [nvm](https://github.com/nvm-sh/nvm): `nvm install --lts`
- **git** – <https://git-scm.com/downloads>

Prüfen im Terminal:

```bash
node --version   # v20.x oder neuer
git --version
```

## 2. Starten (Entwicklung)

```bash
npm install      # einmalig: Abhängigkeiten installieren
npm run dev      # startet den Dev-Server
```

Dann die angezeigte Adresse öffnen, z. B. `http://localhost:5173`.

### Auf dem Handy testen (gleiches WLAN)

1. `npm run dev` starten. Vite zeigt zusätzlich eine **Network**-Adresse an, z. B.
   `http://192.168.178.42:5173`.
2. Diese Adresse auf dem Handy im Browser öffnen (Handy und Rechner im **selben WLAN**).
3. Handy **quer** halten (im Hochformat erscheint „Bitte drehen“). Beim Tippen auf „Start“
   wechselt das Spiel auf Android in den Vollbildmodus.

Klappt die Verbindung nicht: Firewall des Rechners für Port 5173 freigeben bzw. bei
Windows das Netzwerk als „Privat“ markieren.

## 3. Bauen

```bash
npm run build    # Typprüfung + Build
npm run preview  # gebaute Version lokal (und im WLAN) ansehen
```

Ergebnis: **`dist/index.html`** – eine einzige Datei mit allem (Code, Styles, Modelle, Texturen).
Sie lässt sich per Doppelklick öffnen, per Mail verschicken oder auf jeden Webspace hochladen.

### Online spielen (GitHub Pages)

Bei jedem Push baut `.github/workflows/deploy-pages.yml` das Spiel und veröffentlicht es unter
**<https://fredjors.github.io/SurfGuy/>** (einmalig: *Settings → Pages → Source: GitHub Actions*).
Den Fortschritt siehst du im Tab **Actions**; manuell starten geht dort mit „Run workflow“.

**Als App auf iPad/iPhone:** Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Das
Spiel bekommt das SurfGuy-Icon und startet von dort im Vollbild ohne Safari-Leiste. Das Icon
liegt als Vektorgrafik in `public/icon.svg`; `public/apple-touch-icon.png` (180 × 180) ist
daraus gerendert. Diese Dateien liegen neben `dist/index.html` – das Spiel selbst bleibt eine
einzige Datei.

## 4. Tests

```bash
npm test         # Vitest: Kern, Erkennung, Spielmechanik, Kampf, Erweiterbarkeit
npm run typecheck
```

---

## 5. Steuerung

| Aktion            | Desktop                    | Handy (Querformat)                                   |
| ----------------- | -------------------------- | ---------------------------------------------------- |
| Drehen            | **A / D** (oder ← / →)     | Joystick seitlich (erscheint, wo der linke Daumen aufsetzt) |
| Paddeln / Gas     | **W** (oder ↑)             | Joystick nach vorne                                  |
| Bremsen           | **S** (oder ↓)             | Joystick zurück                                      |
| Springen          | **Leertaste**              | Rechte Bildschirmhälfte **nach oben wischen**        |
| Symbol zeichnen   | **Maus** im Zeichenfenster | **Finger** im Zeichenfenster                         |
| Fähigkeit 1 / 2   | **Q** / **E** (oder 1 / 2) | Runde Knöpfe rechts (Ring = Abklingzeit)             |
| Pause             | **Esc** / **P**            | Pause-Knopf oben rechts                              |

## 6. So spielt man

1. **Paddeln**: Unter ca. 18 km/h liegt der Surfer und paddelt, darüber steht er auf.
2. **Wellen erwischen**: Wellen rollen zufällig von außen auf die Insel zu – als Kreisbögen
   rund um die Insel, mal einzeln, mal als Set („Set kommt!“), unterschiedlich lang und hoch;
   die Höhe schwankt entlang des Kamms. Die Wellen-Anzeige oben zeigt, wann eine Welle da ist.
   Steht dort **„JETZT PADDELN!“**, W bzw. Joystick nach vorne halten → Tempo-Boost
   (je höher die Welle an dieser Stelle, desto mehr). Zum Reiten **quer zur Welle** fahren –
   das heißt: um die Insel herum. Geradeaus Richtung Insel fährt man aus der Welle heraus.
3. **Springen + Zeichnen**: Springen geht nur im Stehen. Mehr Tempo (und Sprung von einer
   Welle) = mehr Airtime = mehr Zeit zum Zeichnen. Das Spiel läuft dabei in Zeitlupe.
   - **Kreis → Salto** (springt über den Kopf des Monsters und trifft ihn)
   - **Spirale → Board-Wirbel** (trifft alle Tentakel rundherum)
   - **Zickzack/Blitz → Board-Schlag** (starker Einzeltreffer nach vorne)
   Genauigkeit → Qualität „Okay“ / „Gut“ / „Perfekt!“ → Schaden und Punkte.
4. **Monster** – jedes kündigt sich an und zeigt seinen Angriff vorher auf dem Wasser:
   - **Kraken**: Blasen + dunkler Schatten = gleich taucht er auf. Rote Kreise zeigen, wohin
     ein Tentakel schlägt → ausweichen oder hoch genug springen.
     Schwächen: Board-Wirbel gegen Tentakel, Salto gegen den Kopf.
   - **Riffhai**: Eine Flosse kreist. Er umkreist dich, dann zeigt ein roter Streifen seine
     Rammbahn → seitlich raus oder drüberspringen. Nach dem Rammen ist er kurz benommen.
     Schwäche: Board-Schlag (doppelter Schaden).
   - **Riesenqualle**: Rosa Leuchten unter Wasser. Sie schwebt langsam heran, ein gelber Ring
     wächst bis zur Reichweite ihres Stromstoßes → rechtzeitig raus aus dem Ring.
     Schwäche: Salto von oben (doppelter Schaden).
   Nach einem Treffer hast du kurz Ruhe (Unverwundbarkeit + Schonfrist der Monster).
5. **Zonen**: Je näher an der Insel, desto mehr und stärkere Monster (Haie eher draußen,
   Quallen eher innen). An der Riffgrenze drängt der Sturm zurück.
6. **3 Herzen** pro Run. Perlen, Erfahrung, Highscore und Bestiarium werden gespeichert.

### Zwischen den Runs (Homescreen)

- **Shop** – Boards und Outfits kaufen (Perlen) und ausrüsten. Die Kamera dreht sich zum
  Surfer, Board/Outfit sind sofort am Modell zu sehen. Balken zeigen Tempo, Wendigkeit,
  Airtime und Stabilität im Vergleich zum Standard-Board. Manche Teile gibt es nur über
  Erfolge (z. B. „Kraken Stufe 2 besiegen“, „Highscore 25.000“).
- **Skillbaum** – drei Äste (Surfen, Tricks, Überleben). Knoten kosten Erfahrung und teils
  Perlen und setzen ihre Vorgänger voraus. Sie verbessern Werte (z. B. Paddeltempo,
  Wellenfenster, Zeichenzeit, Herzen) oder schalten Fähigkeiten frei. Ein Punkt am Knopf
  zeigt, dass gerade etwas freischaltbar ist.
- **Fähigkeiten** – passiv (Zähes Herz, Perlenmagnet) wirken immer; **aktive** (bis zu 2
  ausgerüstet, unten im Skillbaum wählbar) werden im Run ausgelöst:
  - *Gezeiten-Sprint*: Tempo-Schub, auch direkt aus dem Paddeln aufs Brett
  - *Wellenruf*: eine große Welle rollt kurz darauf von hinten heran
  - *Blasenschild*: fängt den nächsten Treffer ab
- **Bestiarium** – alle Monsterarten mit Bild, Stufen, Schwächen, Zonen und Belohnungen.
  Unbekannte Monster erscheinen als Silhouette, Schwächen erst nach dem ersten Sieg. Jede
  besiegte Stufe bricht ein **Siegel** – sind alle gebrochen, erwacht in Meilenstein 3 der
  Wächter der Insel.

---

## 7. Projektstruktur

```
src/
  config/gameConfig.ts   ← ALLE Spielwerte (Tempo, Wellen, Zeitlupe, Schaden, Punkte …)
  data/                  ← Inhalte als Daten: tricks, symbols, poses, boards, skins,
                           abilities, skills, monsters, zones (+ types.ts, index.ts)
  core/                  ← EventBus, Registry, StateMachine, Modifiers, Rng, SaveGame,
                           TimeController, ScoreSystem, RunState, Game (Orchestrator)
  world/                 ← WaveField (Wellenformel), WaveSystem (Sets), Ocean (Shader),
                           Sky, Island (inkl. Riffgrenze), PearlSystem, World
  player/                ← Surfer (Physik), SurferStates (Zustände), SurferAnimator,
                           Progression (Werte, Shop, Skillbaum, Fähigkeiten, Bestiarium),
                           AbilitySystem + abilityEffects, rig/ (Rig-Schnittstelle, Posen)
  tricks/                ← TrickSystem, recognizer/ ($1 Unistroke + Formen-Generatoren)
  monsters/              ← Monster (Basis), Kraken, Shark, Jelly, MonsterSystem (Spawner/Kampf),
                           behaviors (Verhaltens-Register), previews (Bestiarium-Modelle)
  input/                 ← InputManager (Aktionen), Tastatur, Touch, Zeichenfläche
  camera/                ← CameraRig (Homescreen, Kamerafahrt, Verfolgung)
  ui/                    ← Menü, HUD, Zeichenfenster, Shop, SkillTree, Bestiary, Bildschirme, CSS
  fx/                    ← Toon-Material, Konturen, Partikel, Effekte, Warnmarker (telegraph),
                           Vorschaubilder (Thumbnails), Mesh-Zusammenfassung
  assets/                ← manifest.ts, AssetLoader, placeholders/, models/, CREDITS.md
```

### Architektur in Kürze

- **Register** (`core/Registry.ts`, `data/index.ts`): typisierte Datendefinitionen für Tricks,
  Symbole, Posen, Boards, Skins, Fähigkeiten, Skill-Knoten, Monster und Zonen.
  `validateContent` prüft alle Querverweise (läuft beim Start und in den Tests).
- **Modifikator-System** (`core/Modifiers.ts`, `player/Progression.ts`): Boards, Skills und
  Fähigkeiten verändern Spielerwerte über `add` / `addPct` / `mul` / `min` / `max`.
  Endwert = `(Basis + Σadd) × (1 + Σpct) × Πmul` – nie hart gesetzt.
- **Zustandsautomat** (`player/SurferStates.ts`): `Lying → Paddling → Standing → Airborne →
  Drawing → TrickPerforming → Landing → Wipeout`. Jeder Zustand ist ein eigenes Objekt.
- **Event-Bus** (`core/events.ts`): z. B. `waveCaught`, `jump`, `trickRecognized`,
  `trickLanded`, `monsterHit`, `monsterDefeated`, `playerHit`, `pearlCollected`, `runEnded`.
  Punkte, HUD, Effekte und Bestiarium hängen sich nur an Events.
- **Spielstand** (`core/SaveGame.ts`): localStorage, versioniert, mit Migrationen und Schutz
  gegen kaputte Daten. Enthält Perlen, Erfahrung, Freischaltungen, Ausrüstung (Board, Outfit,
  Fähigkeiten), Bestiarium, Highscore, Statistiken. Version 2 (Meilenstein 2) ergänzt
  ausgerüstete Fähigkeiten und die Gesamterfahrung – alte Spielstände werden automatisch
  übernommen.
- **Freischaltbedingungen** (`UnlockCondition`): `default`, `pearls` (Preis), `xp`
  (Gesamterfahrung), `skill`, `bestiary` (Monster + Stufe), `highscore` – gelten für Boards,
  Outfits und Tricks gleich.
- **Fähigkeiten** (`player/abilityEffects.ts`, `player/AbilitySystem.ts`): Eine Fähigkeit
  verweist per `effect` auf ein Effekt-Register; Plätze und Abklingzeiten verwaltet das
  AbilitySystem. Passive Fähigkeiten sind reine Modifikatoren.
- **Monster-Verhalten** (`monsters/behaviors.ts`): `MonsterDef.behavior` wählt die Klasse,
  `behaviorParams` stellt sie ein. Gemeinsame Basis (`Monster.ts`): Teile mit Trefferpunkten,
  Schwächen, Stufen, Schonfrist nach Treffern, Kamera-Freiraum.
- **Asset-Manifest mit Platzhaltern** (`assets/`): Modelle werden per id geladen; fehlt die
  Datei, baut das Spiel einen Platzhalter aus Grundformen.
- **Charakter-Rig-Schnittstelle** (`player/rig/`): Animation dreht nur benannte Gelenke –
  Platzhalter und glTF-Modell (über `boneMap`) funktionieren gleich.
- **Eingabe-Abstraktion** (`input/`): Spiellogik kennt nur `steer`, `paddle`, `brake`, `jump`,
  `drawStroke`.
- **Wellen**: Kreisbögen um die Insel (`WaveField`), die nach innen rollen; Höhe =
  Grundhöhe × Querprofil × Ränder × wanderndes Höhenmuster. Eine Formel, zweimal
  implementiert – im Shader (Optik) und in `WaveField` (Physik, Perlen). Bei Änderungen beide
  anpassen. Anrollen, Längen, Höhen, Tempo: `CONFIG.waves`.

### URL-Parameter (zum Ausprobieren)

| Parameter      | Wirkung                                                         |
| -------------- | --------------------------------------------------------------- |
| `?seed=123`    | Fester Zufall: gleiche Wellen-Sets und Monster                  |
| `?debug`       | FPS-Anzeige, Erkennungs-Details und gezeichnete Striche in der Konsole |
| `?board=floater` | Board testweise ausrüsten (id aus `data/boards.ts`)           |

Mehrere kombinieren: `http://localhost:5173/?seed=42&debug&board=speedster`

---

## 8. Neue Inhalte hinzufügen

Neue Tricks, Boards, Skins, Fähigkeiten, Skill-Knoten und Monster sind **reine Dateneinträge**.
Bestehender Code muss nicht umgebaut werden. Die Beispiele unten werden in
`src/data/extensibility.test.ts` automatisch geprüft.

### Beispiel 1: Neuer Trick „Haifischflosse“ (Dreieck zeichnen)

**a) Symbol** in `src/data/symbols.ts` ergänzen (Punkte im Bereich 0–100, y nach unten):

```ts
import { polyline } from '../tricks/recognizer/shapes';

{
  id: 'triangle',
  name: 'Dreieck',
  // Mehrere Vorlagen (z. B. beide Zeichenrichtungen) machen die Erkennung robuster
  templates: [
    polyline([[50, 0], [100, 90], [0, 90], [50, 0]]),
    polyline([[50, 0], [0, 90], [100, 90], [50, 0]]),
  ],
  preview: polyline([[50, 0], [100, 90], [0, 90], [50, 0]]),
},
```

**b) Trick** in `src/data/tricks.ts` ergänzen:

```ts
{
  id: 'shark_fin',
  name: 'Haifischflosse',
  description: 'Schneller Vorwärtsstoß mit Schraube.',
  symbols: ['triangle'],                 // ← das neue Symbol
  duration: 0.8,                         // Spielsekunden (Sprung wird passend verlängert)
  hitTime: 0.5,                          // Treffer bei 50 % der Animation
  damage: 30,
  hitArea: { shape: 'cone', range: 10, halfAngleDeg: 30 },
  targeting: 'nearest',
  points: 260,
  unlock: { type: 'default' },
  color: '#7ef0c6',
  animation: {
    spin: { roll: 1 },                   // eine Schraube um die Längsachse
    poses: [
      { t: 0, pose: 'crouch' },
      { t: 0.5, pose: 'air' },
      { t: 1, pose: 'stand' },
    ],
  },
},
```

Fertig: Das Symbol erscheint automatisch im Zeichenfenster, wird erkannt und löst den Trick
aus. Optional eine Schwäche beim Monster eintragen
(`weaknesses: [{ trick: 'shark_fin', tag: 'head', multiplier: 1.5 }]`).

**Eigene Symbole aufzeichnen:** Spiel mit `?debug` starten, springen, das Symbol zeichnen –
die Punkte stehen als JSON in der Browser-Konsole und können direkt als Vorlage dienen.

**Neue Animation:** Neue Körperhaltungen sind ebenfalls Daten (`src/data/poses.ts`,
Gelenkwinkel in Grad). Brett-Bewegungen gehen über `animation.board` (siehe Board-Schlag).

### Beispiel 2: Neues Board „Lava Rider“

In `src/data/boards.ts` ergänzen:

```ts
{
  id: 'lava_rider',
  name: 'Lava Rider',
  description: 'Heiß und schnell.',
  model: 'board',                         // Asset-id (Platzhalter oder models/board.glb)
  colors: { base: '#ff6a1a', stripe: '#1d2140', rail: '#ffd23f' },
  stats: { speed: 1.25, agility: 0.85, airtime: 1.1, stability: 0.9 },  // 1 = Standard
  modifiers: [{ stat: 'waveBoost', op: 'addPct', value: 0.1 }],          // optional
  price: 1500,
  unlock: { type: 'pearls', amount: 1500 },
},
```

Das Board erscheint automatisch im Shop (mit Preis, Wertebalken und Vorschau am Surfer).
Zum schnellen Ausprobieren ohne Kauf: `http://localhost:5173/?board=lava_rider`. Die Werte
wirken über das Modifikator-System (Höchsttempo ×1,25, Drehrate ×0,85, Sprungkraft ×1,1 …).
Statt Perlen geht auch jede andere Bedingung, z. B. `unlock: { type: 'bestiary', monsterId:
'jelly', tier: 2 }` (Preis dann `0`).

### Beispiel 3: Neues Monster „Tigerhai“ (vorhandenes Verhalten)

Ein Monster, dessen Verhalten es schon gibt (`kraken`, `shark`, `jelly`), ist nur ein Eintrag
in `src/data/monsters.ts`. Am einfachsten einen bestehenden kopieren und anpassen:

```ts
{
  ...riffhai,                              // z. B. const riffhai = MONSTERS[1] oder alles ausschreiben
  id: 'tiger_shark',
  name: 'Tigerhai',
  description: 'Gestreift, schneller und nur in der Nähe des Vulkans.',
  hp: 120,
  chaseSpeed: 13,                          // Kreis-Tempo
  behaviorParams: { chargeSpeed: 30, overshoot: 12, recoverTime: 1.2, firstCooldown: 2 },
  zoneWeights: { inner: 1.5 },             // nur in der inneren Zone, gewichtet
  colors: { body: '#d98a3a', accent: '#2b1d14', eye: '#ffe066' },
},
```

Der Spawner zieht ihn automatisch, das Bestiarium zeigt ihn (mit Vorschaubild) und zählt seine
Stufen zu den Siegeln. Ein **neues Verhalten** = Klasse in `src/monsters/` (erbt von
`Monster`, siehe `Shark.ts` als kompaktes Beispiel) + ein Eintrag in `src/monsters/behaviors.ts`
+ ein Platzhalter-Modell in `src/assets/placeholders/` und `manifest.ts`.

### Beispiel 4: Neue Fähigkeit + Skill-Knoten

**a) Fähigkeit** in `src/data/abilities.ts` – mit vorhandenem Effekt (`speedBurst`,
`callWave`, `shield`):

```ts
{
  id: 'turbo_dash',
  name: 'Turbo-Sprint',
  description: 'Noch kräftigerer Schub, kürzere Abklingzeit.',
  kind: 'active',
  icon: '⇶',
  cooldown: 10,                // Sekunden
  effect: 'speedBurst',        // ← Eintrag in player/abilityEffects.ts
  params: { boost: 12 },
},
```

**b) Skill-Knoten**, der sie freischaltet, in `src/data/skills.ts`:

```ts
{
  id: 'dash_2',
  icon: '⇶',
  name: 'Turbo-Sprint',
  description: 'Aktive Fähigkeit: stärkerer Gezeiten-Sprint.',
  requires: ['dash'],                 // hängt im Baum unter „Gezeiten-Sprint“
  cost: { xp: 600, pearls: 200 },
  grantsAbility: 'turbo_dash',
  position: { col: 0.45, row: 3 },    // Spalte 0–2 (Ast), Zeile von oben
},
```

Knoten, die nur Werte verbessern, lassen `grantsAbility` weg und tragen stattdessen
`modifiers` ein, z. B. `[{ stat: 'drawTime', op: 'addPct', value: 0.15 }]` (alle Werte:
`PlayerStatId` in `src/data/types.ts`). Ein **neuer Effekt** (z. B. Teleport) = ein Eintrag in
`ABILITY_EFFECTS` (`src/player/abilityEffects.ts`); unbekannte Effekte meldet `validateContent`.

### Weitere Inhalte

- **Outfits (Skins)**: `src/data/skins.ts` – Farben plus optionales Zubehör (`cap`,
  `sunglasses`, `bandana`, `headband`, `flower`). Erscheinen automatisch im Shop.
- **Zonen**: `src/data/zones.ts` (Entfernung, Spawn-Pausen, max. Monster, Stufen-Gewichtung).
- **Neuer Surfer-Zustand**: Objekt in `src/player/SurferStates.ts` + id in `SurferStateId`
  (`src/core/events.ts`) + in `next` der Zustände, die dorthin wechseln dürfen.
- **Spielstand erweitern**: Feld in `SaveData` ergänzen, `SAVE_VERSION` erhöhen und eine
  Migration in `migrations` eintragen (`src/core/SaveGame.ts`).

## 9. 3D-Modelle austauschen

Alle Modelle sind derzeit Platzhalter aus Grundformen. Echte Modelle (empfohlen: CC0 von
Quaternius, Kenney, Poly Pizza):

1. GLB-Datei mit dem Namen aus `src/assets/manifest.ts` nach `src/assets/models/` legen
   (z. B. `palm.glb`) – sie wird automatisch gefunden und in den Build eingebettet.
2. Falls nötig `transform` (Skalierung/Drehung/Versatz) im Manifest anpassen.
3. Für den Surfer die Knochennamen in `boneMap` prüfen.
4. Lizenz in `src/assets/CREDITS.md` eintragen (dort auch konkrete Paket-Empfehlungen).

---

## 10. Status (Abnahme)

### Meilenstein 1

- [x] `npm run dev` startet das Spiel, im WLAN auf dem Handy spielbar; `npm run build` →
      eine eigenständige `dist/index.html`
- [x] Homescreen (Surfer liegt im Wasser, Insel im Hintergrund) → weiche Kamerafahrt → Spiel
- [x] Paddeln/Stehen nach Tempo (mit Aufsteh-Animation), Wellen mit Timing erwischen
- [x] Sprung → Zeitlupe → Kreis/Spirale/Zickzack werden erkannt und lösen den Trick aus
- [x] Kraken mit Vorwarnung, Angriffen, Verfolgung; ausweichen und besiegen möglich
- [x] Herzen, Punkte (Qualität + Kombo), Perlen, Game Over, Speichern
- [x] Neuer Trick / neues Board als Dateneintrag (Beispiele oben, automatisch getestet)

### Meilenstein 2

- [x] Shop: 7 Boards und 7 Outfits kaufen/ausrüsten, Live-Vorschau am Surfer, Wertevergleich,
      Freischaltung über Perlen, Erfahrung, Bestiarium oder Highscore
- [x] Skillbaum mit 17 Knoten in 3 Ästen (Werte-Verbesserungen und Fähigkeiten)
- [x] 2 passive und 3 aktive Fähigkeiten, 2 Plätze, Abklingzeit-Anzeige, Tasten Q/E und
      Touch-Knöpfe
- [x] Neue Monster Riffhai und Riesenqualle mit eigener Vorwarnung, eigenem Angriff und eigener
      Schwäche; Zonen-Gewichtung je Monster
- [x] Bestiarium mit Vorschaubildern, Stufen, Schwächen, Zonen, Belohnungen und Siegeln
- [x] Spielstand v2 mit Migration (alte Spielstände bleiben erhalten)
- [x] Neues Monster / neue Fähigkeit / neuer Skill als Dateneintrag (Beispiele oben, getestet)

Ausblick Meilenstein 3: Boss (Wächter der Insel, wenn alle Siegel gebrochen sind),
Insel-Landung, Wetter, Sound/Musik, PWA/Offline.
