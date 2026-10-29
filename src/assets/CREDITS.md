# Credits & Lizenzen der Assets

## Aktueller Stand (Meilenstein 2 + Dopamin-Update)

Alle 3D-Objekte im Spiel sind **Platzhalter aus Grundformen**, die per Code erzeugt werden
(`src/assets/placeholders/`). Sie stammen aus diesem Projekt; es sind keine fremden Assets enthalten.

| Asset-id  | Herkunft                         | Lizenz       |
| --------- | -------------------------------- | ------------ |
| `surfer`  | Platzhalter (`placeholders/surfer.ts`)   | Projekt-eigen |
| `board`   | Platzhalter (`placeholders/board.ts`)    | Projekt-eigen |
| `palm`    | Platzhalter (`placeholders/environment.ts`) | Projekt-eigen |
| `rock`    | Platzhalter (`placeholders/environment.ts`) | Projekt-eigen |
| `volcano` | Platzhalter (`placeholders/environment.ts`) | Projekt-eigen |
| `kraken`  | Platzhalter (`placeholders/kraken.ts`)   | Projekt-eigen |
| `pearl`   | Platzhalter (`placeholders/environment.ts`) | Projekt-eigen |
| `shark`   | Platzhalter (`placeholders/shark.ts`)    | Projekt-eigen |
| `jelly`   | Platzhalter (`placeholders/jelly.ts`)    | Projekt-eigen |
| `chest`, `powerup` | Platzhalter (`placeholders/pickups.ts`) | Projekt-eigen |
| `dolphin` | Platzhalter (`placeholders/dolphin.ts`)  | Projekt-eigen |
| `wreck`   | Platzhalter (`placeholders/wreck.ts`)    | Projekt-eigen |
| `crab`    | Platzhalter (`placeholders/crab.ts`)     | Projekt-eigen |

Schriften: Es werden nur Systemschriften verwendet (keine eingebetteten Fonts).

Sound: Alle Soundeffekte und das Meeresrauschen werden zur Laufzeit im Browser erzeugt
(`src/audio/Sfx.ts`, Web Audio). Es sind keine Audiodateien enthalten.

App-Icon: `public/icon.svg` und `public/apple-touch-icon.png` sind projekt-eigen.

## Echte Modelle einbinden (CC0 empfohlen)

1. GLB-Datei mit dem Dateinamen aus `src/assets/manifest.ts` nach `src/assets/models/` legen
   (z. B. `palm.glb`). Sie wird automatisch gefunden und beim Build in die HTML-Datei eingebettet.
2. Lizenz hier eintragen (Tabelle oben ergänzen: Datei, Autor, Quelle/URL, Lizenz).

Empfohlene kostenlose CC0-Quellen im passenden Comic-Look:

| Wofür              | Quelle | Paket / Suchbegriff | Datei im Projekt |
| ------------------ | ------ | ------------------- | ---------------- |
| Surfer (animierbar) | [quaternius.com](https://quaternius.com) | „Universal Base Characters“ oder „Ultimate Animated Character Pack“ (glTF) | `models/surfer.glb` |
| Palmen, Felsen     | [quaternius.com](https://quaternius.com) | „Ultimate Nature Pack“ / „Stylized Nature MegaKit“ | `models/palm.glb`, `models/rock.glb` |
| Surfbrett          | [poly.pizza](https://poly.pizza) | Suche „surfboard“, Filter Lizenz **CC0** | `models/board.glb` |
| Vulkan/Insel       | [poly.pizza](https://poly.pizza) / [kenney.nl](https://kenney.nl) | Suche „volcano“ (CC0) bzw. „Nature Kit“ | `models/volcano.glb` |
| Krake              | [poly.pizza](https://poly.pizza) | Suche „octopus“ / „kraken“, Lizenz **CC0** | `models/kraken.glb` |
| Perle              | Kenney „Platformer Kit“ o. Ä. | Kugel/Edelstein | `models/pearl.glb` |

Hinweise:
- Modelle sollen nach **+Z** schauen und **Y oben** haben; Abweichungen über `transform`
  (Skalierung, Drehung, Versatz) im Manifest ausgleichen.
- Für den Surfer müssen die Knochennamen in `boneMap` (Manifest) zum Modell passen. Die Animation
  ist prozedural: Posen in `src/data/poses.ts` sind für den Platzhalter abgestimmt und müssen für
  ein echtes Skelett ggf. nachjustiert werden (Achsen der Knochen unterscheiden sich je Modell).
- Der Kraken-Kopf kann ersetzt werden; die Tentakel bleiben prozedural (Kugelketten), weil sie
  zum Zielen und Zuschlagen frei gebogen werden.
