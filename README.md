# SurfGuy – 3D-Surfspiel im Browser

Third-Person-Surfspiel im Comic-Look für Handy und Desktop: Wellen erwischen, im Sprung ein
Symbol zeichnen, Tricks machen und Meeresmonster besiegen. Gebaut mit **Vite + TypeScript +
Three.js**. Der Build ist **eine einzige, eigenständige HTML-Datei**.

Stand: **Meilenstein 2** – zusätzlich zu Meilenstein 1 (Homescreen, Surfen, Wellen um die
Insel, Zeichen-Tricks, Kraken, Punkte, Perlen, Herzen, Spielstand) gibt es jetzt einen
**Shop** für Boards und Outfits, einen **Skillbaum** mit aktiven **Fähigkeiten**, ein
**Bestiarium** und zwei neue Monster (**Riffhai**, **Riesenqualle**).

Dazu das **Dopamin-Update**: Schiffswracks als Rampen, Vulkan-Geysire, Delfin-Schulen und der
Wellen-Durchstoß bringen dich schnell wieder aufs offene Meer; überall gibt es Perlen,
Schatzkisten und Power-ups einzusammeln, mit Soundeffekten, Perlenketten, Kamera-Kicks und
Konfetti.

Dazu **Trick-Kombos** in großen Sprüngen, **Truhen-Glücksspiel** nach dem Run (Perlen,
XP-Flaschen, Board-Designs) und der **Endgegner**: eine riesige wütende Krabbe vor dem Riff.
Wer sie mit einem Kopfsprung-Trick nach dem anderen besiegt, kann durch das Riff bis an die
Insel fahren.

Dann **Kapitel 2 – Feuermeer**. Am Strand steigst du ab und läufst zum **Surfshop**, wo
**Keoni** mit seiner Ukulele wartet und dir den Pfad in den Vulkan zeigt – bis der Vulkan
**ausbricht**. Danach glüht der Himmel rot, statt Schiffswracks liegen **Vulkan-Trümmer** als
Rampen im Wasser, und es tauchen neue Kreaturen auf: **Seeschlange**, **Buckelwal** und
**Riesenmuschel**. Keoni bringt dir drei neue Tricks bei: **Feuerrad**, **Korkenzieher** und
**Sturzflug**.

Neu: das **Kapitel-2-Finale** im **Kratersee** gegen den **Lava-Titan** (drei Phasen,
Belohnung: Obsidian-Gleiter), **Tagesaufgaben und Erfolge**, ein **Spieltest-Bot** für
automatische Testläufe und die **Offline-App** fürs iPad.

**Grafik**: weicher Comic-Shader mit Randlicht und Glanz, echte Sonnen-Schatten, Bloom für
Leuchtendes (Sonne, Perlen, Lava), Farbabstimmung und Kantenglättung; fein modellierter Surfer
(Gesicht, Haare, Kleidung), detaillierte Vulkaninsel mit Dschungel, Holzschiff-Wracks und
Schatzkisten – alles per Code erzeugt, ohne externe Modelle.

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
Spiel bekommt das SurfGuy-Icon und startet von dort im Vollbild ohne Safari-Leiste – und läuft
danach **auch offline** (Service Worker `public/sw.js`: die Seite kommt immer zuerst aus dem
Netz, also neueste Version, und nur ohne Netz aus dem Zwischenspeicher; Manifest
`public/manifest.webmanifest`). Das Icon liegt als Vektorgrafik in `public/icon.svg`;
`apple-touch-icon.png` (180 × 180) sowie `icon-192.png`/`icon-512.png` sind daraus gerendert.
Diese Dateien liegen neben `dist/index.html` – das Spiel selbst bleibt eine einzige Datei.

## 4. Tests

```bash
npm test         # Vitest: Kern, Erkennung, Spielmechanik, Kampf, Erweiterbarkeit
npm run typecheck
```

### Spieltest-Bot

Der Bot spielt das **echte Spiel** im Browser im Zeitraffer (ohne Bild, 5 Minuten Spielzeit in
wenigen Sekunden): er steuert, springt, zeichnet Symbole, weicht angekündigten Einschlägen und
Rammbahnen aus und nutzt im Krater die Geysire. Danach gibt es einen Bericht: Todesursachen,
Treffer je Monster, Tricks, besiegte Monster je Stufe, Hänger („steckt fest“), ungültige
Positionen und Fehler.

```bash
npm run build
node tools/bot.cjs "seed=7" sea 4 300 bericht.json            # Kapitel 1, 4 Runs à 300 s
node tools/bot.cjs "seed=7&kapitel2" sea 4 300 bericht.json   # Feuermeer
node tools/bot.cjs "seed=7&krater" crater 4 420 bericht.json  # Lava-Titan
python3 tools/bot-summary.py bericht.json
```

Braucht Playwright (`npm i -D playwright`, dann `npx playwright install chromium`). Im Browser
geht es auch direkt: Spiel mit `?bot` öffnen und in der Konsole
`await surfguyBot.runMany({ runs: 3, seconds: 240, mode: 'sea' })`.

---

## 5. Steuerung

| Aktion            | Desktop                    | Handy (Querformat)                                   |
| ----------------- | -------------------------- | ---------------------------------------------------- |
| Drehen            | **A / D** (oder ← / →)     | Joystick seitlich (erscheint, wo der linke Daumen aufsetzt) |
| Paddeln / Gas     | **W** (oder ↑)             | Joystick nach vorne                                  |
| Bremsen           | **S** (oder ↓)             | Joystick zurück                                      |
| Springen / Durchstoß | **Leertaste**           | Rechte Bildschirmhälfte **nach oben wischen**        |
| Symbol zeichnen   | **Maus** im Zeichenfenster | **Finger** im Zeichenfenster                         |
| Fähigkeit 1 / 2   | **Q** / **E** (oder 1 / 2) | Runde Knöpfe rechts (Ring = Abklingzeit)             |
| Pause             | **Esc** / **P**            | Pause-Knopf oben rechts                              |

**Homescreen**: Start · Shop · Skillbaum · Bestiarium; Lautsprecher oben rechts = Ton an/aus,
oben links Perlen und Highscore.

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
   - ab Kapitel 2: **Dreieck → Feuerrad** (Rad in Flammen, trifft alles rundherum),
     **Quadrat → Korkenzieher** (Schraubensalto mit Zielsuche auf einen Kopf),
     **V → Sturzflug** (Brett voraus auf das nächste Ziel, Einschlag mit Druckwelle)
   Genauigkeit → Qualität „Okay“ / „Gut“ / „Perfekt!“ → Schaden und Punkte.
   Neben dem Zeichenfeld stehen alle Tricks als **Raster** (6 Tricks = 3 über 3; mit mehr
   Tricks wächst es in Reihen und Spalten, Grenzen in `CONFIG.hud.trickRowsUpTo`). Ist ein
   Monster in der Nähe, steht oben „Gegen …“ und – sobald du es einmal besiegt hast – an den
   Karten seine Schwächen (**×1,5** grün leuchtend, **×0,5** rot). Der Zeitbalken wird gelb,
   dann rot und pulsiert kurz vor Schluss.
   **Luft-Kombo**: Bleibt nach einem Trick noch genug Flugzeit (Wrack, Geysir, große Welle),
   geht das Zeichenfenster erneut auf – jeder weitere Trick im selben Sprung zählt +50 %.
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
5. **Zonen und Stufen**: Je näher an der Insel, desto mehr Monster (Haie eher draußen,
   Quallen eher innen). Jede Monsterart kommt immer mit der **nächsten Stufe** nach der
   höchsten bereits besiegten (gespeichert im Bestiarium) – noch nicht fertige Arten tauchen
   öfter auf. So geht es stetig Richtung Boss. An der Riffgrenze drängt der Sturm zurück.
6. **3 Herzen** pro Run. Perlen, Erfahrung, Highscore und Bestiarium werden gespeichert.

### Endgegner: Wächter der Insel

Sind alle Monster auf jeder Stufe besiegt (alle Siegel im Bestiarium gebrochen), erwacht
beim nächsten Run eine **riesige wütende Krabbe** auf einer Sandbank vor dem Riff, sobald du
der Insel nahe kommst. Oben erscheint ihre Lebensleiste.

- **Phase 1**: Sie wirft Felsbrocken. Ein roter Ring auf dem Wasser zeigt den Einschlag →
  wegfahren oder hoch genug springen.
- **Phase 2** (ab halber Kraft, Markierung in der Leiste): Sie wird wütend, wirft schneller
  und **stampft auf den Sand** – eine Ringwelle läuft übers Meer. Das HUD ruft
  „Ringwelle! / ↑ SPRING!“ → drüberspringen.
- Schaden machen nur **Tricks** (Salto auf den Kopf und Board-Schlag gegen die Scheren
  wirken besonders). Große Sprünge mit Luft-Kombos helfen.
- **Kopfsprung**: Jeder Trick in ihrer Nähe springt dir auf ihren Kopf – Treffer – und du
  prallst weit ab, landest im Wasser und surfst von dort neu an. Gegen ihren Körper zu fahren
  stößt dich zurück.
- **Sieg**: Das Riff öffnet sich dauerhaft – du kannst durch die Steine bis an den Strand
  der Insel fahren.

Zum Ausprobieren ohne komplettes Bestiarium: `?boss` (Start näher an der Insel).

### Kapitel 2: Keoni, der Vulkan und das Feuermeer

- **An Land**: Fahr nach dem Sieg auf den Strand – du steigst automatisch ab und läufst mit
  dem Brett unter dem Arm (gleiche Steuerung; steile Hänge sind zu steil). Ein Lichtstrahl
  und der Kompass („Surfshop“) zeigen den Weg. Monster ziehen sich zurück, solange du an Land
  bist. Zurück ins Wasser → paddeln.
- **Keoni**: Im Surfshop erzählt er (Tippen/Leertaste = weiter) vom alten Pfad in den Vulkan
  – der Pfad leuchtet auf, der Berg grollt … und bricht aus: Lava-Brocken, schwarzer Rauch,
  der Himmel färbt sich rot. **Kapitel 2 – Feuermeer** beginnt (wird gespeichert).
- **Feuermeer**: Statt Schiffswracks liegen 40 **Basalt-Trümmer** mit glühenden Lava-Adern als
  Rampen im Wasser. Die Monster aus Kapitel 1 sind verschwunden, dafür kommen:
  - **Seeschlange**: Blasenspur, dann schlängelt sie sich um dich, Körperbögen tauchen auf.
    Sie richtet sich auf (roter Streifen = Bahn) und schnellt vor → seitlich raus oder
    drüberspringen. Danach liegt ihr Kopf erschöpft auf dem Wasser (mehr Schaden).
    Schwächen: Korkenzieher gegen den Kopf, Board-Wirbel trifft alle Windungen.
  - **Buckelwal**: schwimmt schräg vor dir her und bläst Fontänen. Taucht er ab, wächst unter
    dir ein dunkler Schatten mit rotem Ring → raus da! Er kracht aus dem Wasser und treibt
    danach benommen auf der Seite (mehr Schaden). Abgetaucht ist er nicht zu treffen.
    Schwäche: Sturzflug auf den Rücken.
  - **Riesenmuschel**: hüpft mit klatschenden Schalen heran, klappt auf und spuckt glühende
    Lava-Perlen (rote Ringe = Einschlag). Geschlossen prallen Tricks fast ab („Klonk!“) –
    zuschlagen, wenn sie offen ist. Schwächen: Feuerrad, Board-Schlag.
- **Keoni** hat später noch Tipps, wenn du wieder vorbeischaust.

Zum Ausprobieren: `?insel` (Riff offen, Start vor dem Strand beim Surfshop) und `?kapitel2`
(direkt ins Feuermeer).

### Kapitel-2-Finale: der Lava-Titan im Kratersee

Sind alle Kreaturen des Feuermeers auf jeder Stufe besiegt („FEUERMEER BEZWUNGEN!“), wartet
Keoni wieder im Surfshop (Lichtstrahl, Kompass). Er zeigt dir den Pfad in den Krater – und
du landest im **Kratersee**: ein Lava-See zwischen hohen Kraterwänden mit Lavafällen. In der
Mitte steigt **Peles Wächter**, der **Lava-Titan**, aus der Glut.

- **Aus dem Stand kommst du nicht an ihn heran.** Lass dich von den **Lava-Geysiren**
  (glühen kurz vor dem Ausbruch) Richtung Titan schleudern oder spring von den
  **Basalt-Rampen** – dann trägt dich jeder Trick bis auf seinen **Kopf** (Treffer bei der
  Ankunft, danach prallst du weit ab).
- **Phase 1**: Feuerbälle (rote Ringe = Einschlag) und Faustschlag in den See – unter dir
  wächst ein Ring, dann bricht Lava hervor → raus aus dem Ring.
- **Phase 2** (ab 60 %): doppelte Feuerbälle und **Glutwellen** übers Wasser → drüberspringen
  (HUD: „Glutwelle! / ↑ SPRING!“).
- **Phase 3** (ab 30 %): ein **Feuerstrahl** fegt einmal im Kreis über den See → springen,
  wenn das HUD „Feuerstrahl!“ zeigt.
- **Sieg**: Pele spricht, die Lava kühlt ab, der Himmel klart auf – „Kapitel 2 – Geschafft!“
  und als Belohnung der **Obsidian-Gleiter** (im Shop ausrüsten).
- Danach (und für jeden neuen Versuch) gibt es im Menü den Knopf **„Krater“**.

Zum Ausprobieren: `?krater` (Kratersee freigeschaltet, Knopf „Krater“ im Menü).

### Wieder raus aufs offene Meer

Die Wellen tragen dich Richtung Insel. Zurück nach draußen geht es schnell und mit Spaß:

- **Wellen-Durchstoß**: Fährst du nach außen, kündigt das HUD eine Welle von vorn an. Steht
  dort **„↑ SPRING – DURCHSTOSS!“**, springen → du schießt durch den Kamm und bekommst einen
  Tempo-Schub. Mehrere Durchstöße hintereinander zählen immer mehr.
- **Vulkan-Geysire**: 12 Geysire knapp außerhalb des Riffs. Glut und Blubbern = gleich bricht
  er aus. Wer beim Ausbruch drüber ist, fliegt hoch und weit nach außen – mit Zeit für einen
  Trick und einem Perlenbogen entlang der Flugbahn. Nahe der Insel zeigt das HUD den Weg zum
  nächsten Geysir.
- **Delfin-Schulen**: „Delfine! Häng dich dran!“ – sie schwimmen springend nach außen. Fahr
  nah neben ihnen in dieselbe Richtung: Sie ziehen dich mit (schneller als dein Höchsttempo),
  spucken Perlen und geben Punkte.
- **Schiffswracks** (Kapitel 2: Vulkan-Trümmer): 32 halb versunkene Schiffe liegen schräg im Wasser. Übers Heck aufs Deck,
  die Rampe hoch, am Bug abheben → riesiger Sprung, Zeit für einen Trick, Perlenbogen in der
  Luft. Seitlich gegen den Rumpf bremst hart.

### Einsammeln

- **Perlen** liegen überall: auf den Wellenkämmen, als Linien, Bögen, Ringe und Zickzack-Ketten
  vor dir, als Bögen über Rampen und Geysiren. **Goldperlen** zählen 5. Perlen in der Nähe
  fliegen von selbst zu dir und sichtbar in den Zähler.
- **Perlenkette**: Perlen kurz hintereinander verlängern die Kette (Ton wird immer höher); bei
  10, 20, 35, 50, 75, 100 gibt es Bonuspunkte.
- **Schatzkisten**: ein paar Perlen sofort, die Truhe selbst wird gesichert (Zähler oben
  links) und **nach dem Wipeout geöffnet** (Knopf „Truhen öffnen“ in der Auswertung): Die
  Truhe wackelt, eine Walze wie beim Case-Opening rauscht vorbei, tickt, wird langsamer und
  bleibt auf dem Gewinn stehen – dann springt der Deckel auf, es blitzt, Lichtstrahlen und
  Konfetti in der Farbe der Seltenheit (episch/legendär: der Bildschirm bebt). Drin:
  **Perlenhaufen**, **XP-Flaschen** oder **Board-Designs** – in vier Seltenheiten (gewöhnlich,
  selten, episch, legendär). Doppelte Designs werden zu Perlen. **Überspringen** (oder auf die
  Walze tippen) stoppt die Walze sofort; **Alle öffnen** bzw. das **X** oben rechts öffnet alle
  restlichen Truhen auf einmal. Am Ende zeigt „Deine Beute“ alle Gewinne.
- Besiegte Monster spritzen ihre Perlen heraus.
- **Perlen-Zahlen**: Jede Perle lässt eine kleine Zahl aufsteigen (+1, +2, +3 …), die mit der
  Perlenkette mitzählt.
- **Power-ups** (schimmernde Blasen): *Perlenmagnet* (viel größerer Einsammelradius),
  *Doppelte Punkte*, *Turbo* (Tempo über dem Höchsttempo). Laufende Power-ups stehen links
  oben mit Restzeit.
- **Big Air**: Ab 2 Sekunden in der Luft gibt es Bonuspunkte.

### Nach dem Run: die Auswertung

„WIPEOUT!“ (bzw. „SIEG!“ nach dem Titan) knallt herein, die Punkte zählen hoch und schalten
bis zu **drei Sterne** frei (Grenzen in `CONFIG.results.stars`), ein neuer Highscore gibt ein
Band mit Konfetti. Danach ploppen die Karten (Perlen, Monster, Tricks, beste Kombo, Erfahrung,
Truhen bzw. Wellen) auf und die Balken der **Tagesaufgaben** füllen sich um den Fortschritt
aus diesem Run (frisch geschaffte bekommen einen Haken). Tippen (oder Leertaste) zeigt sofort
alles. Mit Truhen im Gepäck kommt zuerst „Truhen öffnen“, danach „Nochmal“ und „Menü“.

### Zwischen den Runs (Homescreen)

- **Shop** – Boards und Outfits kaufen (Perlen) und ausrüsten; im Tab **Designs** die
  Board-Designs aus Truhen auf jedes Board legen. Die Kamera dreht sich zum
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
  besiegte Stufe bricht ein **Siegel** – sind alle gebrochen, erwacht der Wächter der Insel.
  In Kapitel 2 zeigt die Leiste den Fortschritt gegen die Kreaturen des Feuermeers.
- **Aufgaben** – jeden Tag **drei Tagesaufgaben** (leicht, mittel, schwer), z. B. „Besiege 3
  Kraken“, „Zeichne 6× Perfekt!“, „Erreiche 6.000 Punkte in einem Run“. Der Fortschritt zählt
  im Run mit („AUFGABE ERFÜLLT!“); im Menü unter „Aufgaben“ holst du Perlen und Erfahrung ab.
  Alle drei geschafft → **Bonus-Truhe**. Dazu **14 Erfolge** mit Bronze, Silber und Gold
  (Perlentaucher, Monsterjäger, Luftakrobat, Kombo-König, Peles Gunst …). Ein Zähler am Knopf
  zeigt, was abholbar ist.

---

## 7. Projektstruktur

```
src/
  config/gameConfig.ts   ← ALLE Spielwerte (Tempo, Wellen, Zeitlupe, Schaden, Punkte …)
  data/                  ← Inhalte als Daten: tricks, symbols, poses, boards, skins,
                           abilities, skills, monsters, zones, pickups (+ types.ts, index.ts)
  core/                  ← EventBus, Registry, StateMachine, Modifiers, Rng, SaveGame,
                           TimeController, ScoreSystem, RunState, Game (Orchestrator)
  world/                 ← WaveField (Wellenformel), WaveSystem (Sets), Ocean (Shader),
                           Sky, Island (inkl. Riffgrenze), PearlSystem (Perlen auf Wellen),
                           PickupSystem (Formationen, Kisten, Power-ups, Bögen, Fontänen),
                           Wrecks (Rampen: Wracks/Trümmer), Geysers, Dolphins, Crater (Kratersee), Hut (Surfshop +
                           Keoni), islandTerrain (Geländehöhe), World (Kapitel, Farbstimmung)
  player/                ← Surfer (Physik), SurferStates (Zustände), SurferAnimator,
                           Progression (Werte, Shop, Skillbaum, Fähigkeiten, Bestiarium),
                           AbilitySystem + abilityEffects, rig/ (Rig-Schnittstelle, Posen)
  tricks/                ← TrickSystem, recognizer/ ($1 Unistroke + Formen-Generatoren)
  monsters/              ← Monster (Basis), Kraken, Shark, Jelly, Crab (Boss), Serpent, Whale,
                           Clam, Titan (Boss), MonsterSystem (Spawner/Kampf),
                           behaviors (Verhaltens-Register), previews (Bestiarium-Modelle)
  input/                 ← InputManager (Aktionen), Tastatur, Touch, Zeichenfläche
  camera/                ← CameraRig (Homescreen, Kamerafahrt, Verfolgung, Zwischensequenzen)
  story/                 ← Cutscene (Dialogzeilen, Kameraeinstellungen, Ereignisse aus data/story.ts)
  dev/                   ← Spieltest-Bot (nur mit ?bot geladen)
  audio/                 ← Sfx (Töne im Browser erzeugt), AudioSystem (Events → Töne)
  ui/                    ← Menü, HUD, Zeichenfenster (Trick-Raster), Shop, SkillTree, Bestiary,
                           Goals, Screens (Pause, Auswertung), CaseOpening (Truhen), icons
                           (SVG-Symbole), widgets (Zurück-Knopf, Konfetti, Hochzählen,
                           überspringbare Zeitleiste), styles/ (Design: base.css mit Farben,
                           Schrift und Bausteinen, dazu je Bereich eine Datei)
  fx/                    ← Toon-Material, Konturen, Partikel, Effekte (Konfetti, Ringwellen),
                           Warnmarker (telegraph), Vorschaubilder (Thumbnails),
                           InstancedModel (viele Perlen in wenigen Draw-Calls), Mesh-Zusammenfassung
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
  Drawing → TrickPerforming → Landing → Wipeout`, dazu `Walking` an Land. Jeder Zustand ist
  ein eigenes Objekt.
- **Event-Bus** (`core/events.ts`): z. B. `waveCaught`, `jump`, `trickRecognized`,
  `trickLanded`, `monsterHit`, `monsterDefeated`, `playerHit`, `pearlCollected`, `runEnded`.
  Punkte, HUD, Effekte und Bestiarium hängen sich nur an Events.
- **Spielstand** (`core/SaveGame.ts`): localStorage, versioniert, mit Migrationen und Schutz
  gegen kaputte Daten. Enthält Perlen, Erfahrung, Freischaltungen, Ausrüstung (Board, Outfit,
  Fähigkeiten, Board-Design), Bestiarium, Highscore, Statistiken und den Boss-Fortschritt.
  Version 2 ergänzte Fähigkeiten und Gesamterfahrung, Version 3 Board-Designs, geöffnete
  Truhen und `progress.bossDefeated`, Version 4 die Story (`progress.chapter`,
  `progress.metKeoni`), Version 5 Kratersee und Titan (`progress.volcanoOpen`,
  `progress.titanDefeated`), Version 6 Tagesaufgaben, Erfolge und neue Statistiken – alte
  Spielstände werden automatisch übernommen.
- **Aufgaben und Erfolge** (`data/missions.ts`, `data/achievements.ts`, `player/Goals.ts`):
  Daten-Einträge; ein `GoalTracker` hört auf Spiel-Ereignisse. Neue Aufgabe = Eintrag mit
  Zähler (`counter`), Modus (`sum`/`best`) und drei Zielen; Belohnungen in `CONFIG.goals`.
- **Kapitel und Story** (`World.setChapter`, `story/Cutscene.ts`, `data/story.ts`): Ein
  Kapitel schaltet Farbstimmung (`CONFIG.themes`, weicher Übergang), Rampen (Wracks ↔
  Trümmer) und Vulkan um; Monster tragen `chapter` und kommen nur im passenden Kapitel.
  Zwischensequenzen sind Daten (`say` / `shot` / `wait` / `event`); was eine
  Kameraeinstellung oder ein Ereignis bedeutet, entscheidet `Game`. Insel-Werte in
  `CONFIG.island`.
- **Endgegner** (`monsters/Crab.ts`): `MonsterDef.boss` – erscheint nicht zufällig und zählt
  nicht zu den Siegeln; Auslöser und Sieg in `Game` (`CONFIG.boss`), Riff-Öffnung über
  `World.reefOpen`.
- **Freischaltbedingungen** (`UnlockCondition`): `default`, `pearls` (Preis), `xp`
  (Gesamterfahrung), `skill`, `bestiary` (Monster + Stufe), `highscore`, `chapter` – gelten
  für Boards, Outfits und Tricks gleich.
- **Fähigkeiten** (`player/abilityEffects.ts`, `player/AbilitySystem.ts`): Eine Fähigkeit
  verweist per `effect` auf ein Effekt-Register; Plätze und Abklingzeiten verwaltet das
  AbilitySystem. Passive Fähigkeiten sind reine Modifikatoren.
- **Monster-Verhalten** (`monsters/behaviors.ts`): `MonsterDef.behavior` wählt die Klasse,
  `behaviorParams` stellt sie ein. Gemeinsame Basis (`Monster.ts`): Teile mit Trefferpunkten,
  Schwächen, Stufen, Schonfrist nach Treffern, Kamera-Freiraum.
- **Abheben** (`Surfer.launch`): Rampe, Geysir und Durchstoß nutzen dasselbe Abheben
  (Event `launched` mit Quelle). Tempo über dem Höchsttempo läuft über `overdrive`, das sich am
  Boden abbaut.
- **Welt-Objekte** (`world/Wrecks.ts`, `Geysers.ts`, `Dolphins.ts`): feste Verteilung per Seed
  bzw. Spawner in Spielernähe; alle Werte in `CONFIG.wrecks`, `CONFIG.geysers`,
  `CONFIG.dolphins`, `CONFIG.punch`, `CONFIG.pickups`.
- **Grafik** (`fx/toon.ts`, `fx/PostFX.ts`, `CONFIG.render`): Toon-Material mit weichen
  Stufen, Randlicht und Glanz für alle Objekte; Sonnen-Schatten um den Spieler; Bloom nur für
  überhelle Farben (Schwelle > 1, z. B. Lava, Perlen, Sonne), Farbabstimmung, Vignette, MSAA.
  Bei dauerhaft niedriger Bildrate senkt das Spiel erst die Auflösung, dann schaltet es
  Nachbearbeitung und Schatten ab. Die Insel ist eine Höhenfunktion (`world/islandTerrain.ts`),
  Rauschen in `core/noise.ts`.
- **Sound** (`audio/`): Töne werden mit Web Audio erzeugt (Oszillatoren + gefiltertes Rauschen)
  und hängen nur an Events. Lautstärke in `CONFIG.audio`, an/aus im Spielstand.
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
| `?boss`        | Endgegner sofort verfügbar, Start näher an der Insel            |
| `?insel`       | Riff offen, Start vor dem Strand beim Surfshop (Keoni)          |
| `?kapitel2`    | Direkt ins Feuermeer (Kapitel 2, neue Monster und Tricks)       |
| `?krater`      | Kratersee freigeschaltet (Knopf „Krater“ im Menü, Lava-Titan)    |
| `?bot`         | Spieltest-Bot laden (`surfguyBot` in der Konsole, siehe Tests)   |

Mehrere kombinieren: `http://localhost:5173/?seed=42&debug&board=speedster`

---

## 8. Neue Inhalte hinzufügen

Neue Tricks, Boards, Skins, Fähigkeiten, Skill-Knoten und Monster sind **reine Dateneinträge**.
Bestehender Code muss nicht umgebaut werden. Die Beispiele unten werden in
`src/data/extensibility.test.ts` automatisch geprüft.

### Beispiel 1: Neuer Trick „Haifischflosse“ (Stern zeichnen)

**a) Symbol** in `src/data/symbols.ts` ergänzen (Punkte im Bereich 0–100, y nach unten):

```ts
import { polyline } from '../tricks/recognizer/shapes';

// Fünfzackiger Stern in einem Zug (Spitzen im Abstand von 144°)
const starCorners = (dir: 1 | -1) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = ((-90 + dir * k * 144) * Math.PI) / 180;
    return [50 + Math.cos(a) * 50, 50 + Math.sin(a) * 50] as [number, number];
  });

{
  id: 'star',
  name: 'Stern',
  // Mehrere Vorlagen (z. B. beide Zeichenrichtungen) machen die Erkennung robuster
  templates: [polyline(starCorners(1)), polyline(starCorners(-1))],
  preview: polyline(starCorners(1)),
},
```

Fertige Formen-Generatoren (Kreis, Spirale, Zickzack, Dreieck, Quadrat, V) stehen in
`src/tricks/recognizer/shapes.ts`.

**b) Trick** in `src/data/tricks.ts` ergänzen:

```ts
{
  id: 'shark_fin',
  name: 'Haifischflosse',
  description: 'Schneller Vorwärtsstoß mit Schraube.',
  symbols: ['star'],                     // ← das neue Symbol
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

### Beispiel 5: Neues Power-up

Ein Eintrag in `src/data/pickups.ts` – es taucht automatisch im Meer auf (gewichtet nach
`spawnWeight`), wirkt über das Modifikator-System und erscheint mit Restzeit im HUD:

```ts
{
  id: 'super_jump',
  name: 'Supersprung',
  model: 'powerup',                          // schimmernde Blase, Kernfarbe aus colors.core
  colors: { core: '#7dee8a' },
  icon: '⇑',
  color: '#7dee8a',
  modifiers: [{ stat: 'jumpPower', op: 'mul', value: 1.5 }],
  duration: 12,                              // Sekunden
  spawnWeight: 1,
  radius: 2.6,
},
```

Statt `modifiers` geht auch `boost` (Tempo-Schub) oder `pearls`/`points` (wie die Schatzkiste).

### Weitere Inhalte

- **Outfits (Skins)**: `src/data/skins.ts` – Farben plus optionales Zubehör (`cap`,
  `sunglasses`, `bandana`, `headband`, `flower`). Erscheinen automatisch im Shop.
- **Zonen**: `src/data/zones.ts` (Entfernung, Spawn-Pausen, max. Monster, Stufen-Gewichtung).
- **Board-Designs**: `src/data/boardDesigns.ts` (Farben + Seltenheit) und ein Eintrag in
  `src/data/chestRewards.ts` (`design: 'id'`, `weight`) – erscheint im Shop-Tab und in Truhen.
- **Truhen-Inhalte**: `src/data/chestRewards.ts` – je Eintrag genau eins von `pearls`, `xp`
  oder `design`; `weight` = Wahrscheinlichkeit.
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

### Dopamin-Update

- [x] Homescreen ohne Text: nur Symbol-Knöpfe, Perlen/Highscore, Ton an/aus
- [x] Soundeffekte (im Browser erzeugt) für Perlen, Sprünge, Wellen, Tricks, Monster, Kisten
- [x] 32 Schiffswracks als Rampen mit Perlenbögen, Rumpf-Kollision
- [x] Raus aufs Meer: Wellen-Durchstoß, 12 Vulkan-Geysire, Delfin-Schulen
- [x] Einsammeln: Perlen-Formationen, Goldperlen, Schatzkisten, Power-ups, Perlenkette,
      Perlen fliegen zum Zähler, Big Air
- [x] Effekte: Kamera-Kick/-Wackeln, Sichtfeld bei Tempo, Tempo-Streifen, Konfetti, Ringwellen,
      Stempel-Texte
- [x] Perlen werden instanziert gezeichnet (weniger Draw-Calls auf dem Handy)

### Kombos, Truhen, Endgegner

- [x] Homescreen wieder mit beschrifteten Knöpfen (ohne Text drumherum)
- [x] Luft-Kombos: mehrere Tricks pro großem Sprung, +50 % je weiterem Trick
- [x] Zeichenzeit ca. 20 % kürzer
- [x] Perlen-Zahlen (+1, +2, +3 …) beim Einsammeln
- [x] Truhen-Glücksspiel nach dem Run: Perlenhaufen, XP-Flaschen, 8 Board-Designs in
      4 Seltenheiten; Shop-Tab „Designs“; Spielstand v3
- [x] Endgegner Riesenkrabbe: Steinwurf, Wut-Phase mit Stampf-Ringwelle, Boss-Leiste,
      nur durch Tricks besiegbar, erscheint nach komplettem Bestiarium
- [x] Nach dem Sieg: Riff offen, Fahrt bis an den Strand

### Fortschritt und Grafik

- [x] Monster kommen mit der nächsten Stufe nach der höchsten besiegten (gespeichert)
- [x] Render-Upgrade: Comic-Shader mit Randlicht/Glanz, Schatten, Bloom, Farbabstimmung, MSAA,
      automatische Qualitätsstufen
- [x] Surfer und Brett neu modelliert (Gesicht, Haare, Kleidung, Hände, Füße; Grip-Pad, Finnen)
- [x] Vulkaninsel als detailliertes Gelände mit Dschungel, Palmen, Lava, Brandung
- [x] Holzschiff-Wracks mit geschwungenem Rumpf, Planken, Kanonen; Schatzkiste mit Beschlägen

### Kapitel 2: Insel, Story und Feuermeer

- [x] Leuchten von Wolken, Münzen und Perlen deutlich gedämpft
- [x] Krabbenkampf: Trick in der Nähe = Kopfsprung, Treffer, weit abprallen, neu anfahren;
      Körper stößt zurück statt festzuhalten
- [x] Nach dem Sieg an den Strand fahren, absteigen, laufen (Brett unter dem Arm)
- [x] Surfshop mit Keoni (Hawaiihemd, Strohhut, Blumenkette, Ukulele), Dialog mit
      Kamerafahrten, leuchtender Pfad in den Vulkan
- [x] Vulkanausbruch: Lava-Brocken, schwarzer Rauch, rötlicher Himmel, Farbübergang
- [x] Feuermeer: Basalt-Trümmer mit Lava-Adern als Rampen statt Wracks
- [x] Neue Monster: Seeschlange, Buckelwal, Riesenmuschel (je 3 Stufen, Bestiarium)
- [x] Drei neue Tricks: Feuerrad (Dreieck), Korkenzieher (Quadrat), Sturzflug (V)
- [x] Spielstand v4 (Kapitel, Keoni getroffen)

### Nachtschicht: Finale, Aufgaben, Spieltest

- [x] Kratersee als eigene Arena (Lava-See, Kraterwände, Lavafälle, Lava-Geysire, Basalt-Rampen)
- [x] Lava-Titan mit drei Phasen (Feuerbälle, Lava-Ausbruch, Glutwellen, Feuerstrahl), nur aus
      großen Sprüngen am Kopf zu treffen; Sieg mit Pele-Szene, Obsidian-Gleiter, Menü-Knopf „Krater“
- [x] Tagesaufgaben (3 pro Tag) mit Bonus-Truhe, 14 Erfolge mit Stufen; Spielstand v6
- [x] Spieltest-Bot; gefunden und behoben: Absturz nach Sprung vom Rampendeck, Kopfsprung-Treffer
      zu früh ausgewertet (Titan unverwundbar aus der Ferne)
- [x] Balancing nach Bot-Läufen: Riffhai zielt im letzten Drittel nicht mehr nach, Rammer mit
      längerer Schonfrist, Titan mit 1.400 LP
- [x] Offline-App (Manifest, Service Worker), weniger Schatten-Draw-Calls bei Monstern

### Oberflächen-Update (einheitliches Design)

- [x] Ein Design für alles im Stil mobiler Arcade-Spiele: Schrift Lilita One (eingebettet),
      weiße Schrift mit Kontur, Knöpfe mit Glanz und Kante, dunkelblaue Fenster mit Streifen,
      dunkle Ressourcen-Chips; alle Farben/Bausteine in `src/ui/styles/base.css`
- [x] Homescreen: Schriftzug mit Kapitel, Symbol-Kacheln (Shop, Skills, Monster, Aufgaben) mit
      Hinweis-Zählern, großer „SURFEN!“-Knopf mit Glanzstreifen, Krater-Knopf mit Vulkan
- [x] HUD: SVG-Herzen, große Punkte, Kombo-Schild, Kompass-Plakette, Tempo- und Boss-Leiste
      mit Glanz, Fähigkeiten-Knöpfe leuchten gelb, wenn bereit
- [x] Trick-Raster (3 über 3, skaliert), Schwächen-Schilder am nahen Monster, Zeitbalken mit
      Farbwechsel; Trick-Pop mit Qualitäts-Schild, Strahlen bei „Perfekt!“
- [x] Epische Auswertung mit Animationsfolge (überspringbar) und Truhen-Öffnen mit Effekten,
      Überspringen, „Alle öffnen“/X und Beute-Übersicht

Ausblick: Kapitel 3 „Eismeer“ (Vulkan erlischt, Eisberge als Rampen, Eisbär/Seeleopard,
Pinguine statt Delfine), Musik, Einstellungen, Tutorial.
