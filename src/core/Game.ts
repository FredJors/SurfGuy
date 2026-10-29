/**
 * Spiel-Orchestrator: verbindet Welt, Surfer, Kamera, Eingabe, Systeme und UI.
 * Ablauf: Laden → Homescreen → Kamerafahrt → Spielen ↔ Pause → Game Over → Nochmal/Menü.
 */
import * as THREE from 'three';
import { AssetLoader } from '../assets/AssetLoader';
import { AudioSystem } from '../audio/AudioSystem';
import { CameraRig, type CameraTarget } from '../camera/CameraRig';
import { CONFIG } from '../config/gameConfig';
import { createRegistries, validateContent, type ContentRegistries } from '../data';
import { Effects } from '../fx/Effects';
import { PostFX } from '../fx/PostFX';
import { addOutline } from '../fx/toon';
import { DrawSurface } from '../input/DrawSurface';
import { InputManager } from '../input/InputManager';
import { KeyboardSource } from '../input/KeyboardSource';
import { TouchSource } from '../input/TouchSource';
import { MONSTER_BEHAVIORS } from '../monsters/behaviors';
import { MonsterSystem } from '../monsters/MonsterSystem';
import { ABILITY_EFFECTS, type AbilityContext } from '../player/abilityEffects';
import { AbilitySystem } from '../player/AbilitySystem';
import { applyChestReward, bossAvailable, nextMonsterTier, buyItem, createPlayerStats, equipDesign, equipItem, equippedAbilities, rollChest, skillState, toggleAbility, unlockSkill, type PlayerStats } from '../player/Progression';
import { showCaseOpening, type CaseItemView } from '../ui/CaseOpening';
import type { ChestRewardDef } from '../data/types';
import { SkillTreeScreen } from '../ui/SkillTree';
import { JointRig } from '../player/rig/CharacterRig';
import { Surfer } from '../player/Surfer';
import { TrickSystem } from '../tricks/TrickSystem';
import { BestiaryScreen } from '../ui/Bestiary';
import { showGameOver, showPause } from '../ui/Screens';
import { ThumbnailRenderer } from '../fx/Thumbnails';
import { buildMonsterPreview } from '../monsters/previews';
import { ShopScreen } from '../ui/Shop';
import { UI } from '../ui/UI';
import { PearlSystem } from '../world/PearlSystem';
import { PickupSystem } from '../world/PickupSystem';
import type { PickupDef } from '../data/types';
import type { Geyser } from '../world/Geysers';
import { Crab } from '../monsters/Crab';
import { Cutscene, type CutsceneStep } from '../story/Cutscene';
import { KEONI_INTRO, KEONI_LATER } from '../data/story';
import { World } from '../world/World';
import { EventBus } from './EventBus';
import type { GameEvents, RunSummary } from './events';
import { wrapAngle } from './math';
import { Rng } from './Rng';
import { createRunState, type RunState } from './RunState';
import { ScoreSystem } from './ScoreSystem';
import { SaveStore, getBrowserStorage, type SaveData } from './SaveGame';
import { TimeController } from './TimeController';

export type GamePhase = 'loading' | 'home' | 'transition' | 'playing' | 'paused' | 'gameover';

export interface GameOptions {
  seed: number | null;
  debug: boolean;
  /** Board-id zum Ausprobieren (z. B. ?board=speedster) */
  boardOverride?: string;
  /** ?boss: Wächter der Insel sofort verfügbar, Start näher an der Insel (zum Testen) */
  forceBoss?: boolean;
  /** ?insel: Riff offen, Start vor dem Strand beim Surfshop (zum Testen) */
  forceIsland?: boolean;
  /** ?kapitel2: direkt ins Feuermeer (Kapitel 2) */
  forceChapter2?: boolean;
}

export class Game {
  readonly bus = new EventBus<GameEvents>();
  readonly content: ContentRegistries;
  readonly assets = new AssetLoader();
  readonly input = new InputManager();
  readonly time = new TimeController();
  readonly saveStore = new SaveStore(getBrowserStorage());
  readonly isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  readonly renderer: THREE.WebGLRenderer;
  readonly ui: UI;

  save: SaveData;
  stats!: PlayerStats;
  phase: GamePhase = 'loading';
  run: RunState | null = null;

  world!: World;
  surfer!: Surfer;
  cameraRig!: CameraRig;
  effects!: Effects;
  pearls!: PearlSystem;
  pickups!: PickupSystem;
  score!: ScoreSystem;
  tricks!: TrickSystem;
  monsters!: MonsterSystem;
  audio!: AudioSystem;
  readonly abilities = new AbilitySystem();
  private thumbnails!: ThumbnailRenderer;
  private postfx!: PostFX;
  private lowFpsStage = 0;
  private touch: TouchSource | null = null;
  private drawSurface!: DrawSurface;
  private closePause: (() => void) | null = null;
  private lastFrame = performance.now();
  private pixelRatio = 1;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private lowFpsTime = 0;
  private gameOverTimer = -1;
  private lastZone = '';
  private boundaryWarned = false;
  /** Aktuell am Surfer gezeigte Optik (Skin/Board/Design) */
  private appearance = { skin: '', board: '', design: '' };
  private readonly chestRng = new Rng(Rng.randomSeed());
  /** Laufende Zwischensequenz (Gespräch mit Keoni) */
  private cutscene: Cutscene | null = null;
  /** Erst wieder ansprechen, wenn man sich zwischendurch von Keoni entfernt hat */
  private keoniCooldown = false;
  private wasWalking = false;
  /** Nachbeben beim Vulkanausbruch (Sekunden) */
  private quakeLeft = 0;

  constructor(
    container: HTMLElement,
    readonly options: GameOptions,
  ) {
    this.content = createRegistries();
    const errors = validateContent(this.content, Object.keys(MONSTER_BEHAVIORS), Object.keys(ABILITY_EFFECTS));
    if (errors.length) console.error('[Inhalte] Fehler in den Daten:\n' + errors.join('\n'));

    this.save = this.saveStore.load();
    if (options.forceIsland || options.forceChapter2) this.save.progress.bossDefeated = true;
    if (options.forceChapter2) {
      this.save.progress.chapter = Math.max(2, this.save.progress.chapter);
      this.save.progress.metKeoni = true;
    }
    if (options.boardOverride && this.content.boards.has(options.boardOverride)) {
      this.save.equipped.board = options.boardOverride;
    }

    this.renderer = new THREE.WebGLRenderer({ antialias: CONFIG.render.antialias, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.pixelRatio = this.maxPixelRatio();
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (CONFIG.render.shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    container.appendChild(this.renderer.domElement);

    this.ui = new UI();
    this.thumbnails = new ThumbnailRenderer(this.renderer);
  }

  private maxPixelRatio(): number {
    const cap = this.isTouch ? CONFIG.render.maxPixelRatioMobile : CONFIG.render.maxPixelRatioDesktop;
    return Math.min(window.devicePixelRatio || 1, cap);
  }

  async init(): Promise<void> {
    await this.assets.preload((done, total) => this.ui.setLoading(total ? done / total : 1));
    this.ui.setLoading(1);

    this.stats = createPlayerStats(this.content, this.save);
    this.world = new World(this.bus, this.assets);
    this.world.setChapter(this.save.progress.chapter, 0);
    this.cameraRig = new CameraRig(window.innerWidth / window.innerHeight);
    const R = CONFIG.render;
    this.world.sun.castShadow = R.shadows;
    const sm = this.isTouch ? R.shadowMapMobile : R.shadowMapDesktop;
    this.world.sun.shadow.mapSize.set(sm, sm);
    this.postfx = new PostFX(this.renderer, this.world.scene, this.cameraRig.camera);
    this.postfx.setSize(window.innerWidth, window.innerHeight, this.pixelRatio);
    this.effects = new Effects(this.world.scene, this.cameraRig.camera, this.ui, this.bus, this.world);
    this.effects.particles.setViewportHeight(window.innerHeight * this.pixelRatio, CONFIG.render.fov);

    // Surfer mit Rig (Platzhalter oder glTF) und Brett aus dem Register
    this.surfer = this.createSurfer();
    this.world.scene.add(this.surfer.root);

    this.audio = new AudioSystem(this.bus, () => this.surfer);
    this.audio.sfx.setEnabled(this.save.settings.sound);
    this.audio.unlockOnFirstInput();

    this.pearls = new PearlSystem(this.bus, this.assets, this.world.waves, new Rng(3));
    this.world.scene.add(this.pearls.group);
    this.pickups = new PickupSystem(this.bus, this.assets, this.content, this.world.waves.field);
    this.pickups.onPickup = (def, pos) => this.applyPickup(def, pos);
    this.world.scene.add(this.pickups.group);
    this.score = new ScoreSystem(this.bus, this.content, () => this.stats);
    this.monsters = new MonsterSystem(this.bus, this.content, this.assets, this.world, this.effects);
    // Monster kommen mit der nächsten Stufe nach der höchsten bereits besiegten
    this.monsters.progress = {
      nextTier: (def) => nextMonsterTier(def, this.save),
      unfinished: (def) => (this.save.bestiary[def.id]?.highestTierDefeated ?? 0) < def.tiers.length,
      chapter: () => this.save.progress.chapter,
    };
    this.world.scene.add(this.monsters.group);

    // Eingabe
    this.input.addSource(new KeyboardSource(this.input));
    this.touch = new TouchSource(this.input, this.renderer.domElement);
    this.input.addSource(this.touch);
    this.drawSurface = new DrawSurface(this.input, this.ui.drawing.surface);
    this.touch.blockers.push(() => (this.ui.drawing.isOpen ? this.ui.drawing.el.getBoundingClientRect() : null));

    this.tricks = new TrickSystem(this.bus, this.content, this.input, this.drawSurface, this.ui, this.time, this.surfer, this.monsters, this.effects, () => this.save, () => this.stats, this.options.debug);

    this.wireEvents();
    this.wireUi();

    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.phase === 'playing') this.pause();
    });

    this.goHome();
    // Ein paar Sekunden vorsimulieren, damit das Meer schon „lebt“
    for (let i = 0; i < 30; i++) this.world.update(0.1, this.surfer.x, this.surfer.z, this.cameraRig.camera);
    this.ui.hideLoading();
    this.lastFrame = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private createSurfer(): Surfer {
    const e = this.save.equipped;
    const { rig, board } = this.buildVisuals(e.skin, e.board, e.boardDesign);
    this.appearance = { skin: e.skin, board: e.board, design: e.boardDesign };
    return new Surfer(this.bus, this.input, this.stats, this.world, rig, board, this.content.poses);
  }

  /** Baut Figur (Skin) und Brett (+ Design) aus Register + Asset-Manifest. */
  private buildVisuals(skinId: string, boardId: string, designId: string): { rig: JointRig; board: THREE.Object3D } {
    const skin = this.content.skins.tryGet(skinId) ?? this.content.skins.all()[0]!;
    const boardDef = this.content.boards.tryGet(boardId) ?? this.content.boards.all()[0]!;
    const design = designId ? this.content.boardDesigns.tryGet(designId) : undefined;
    const figure = this.assets.create(skin.model, { colors: skin.colors, accessories: skin.accessories });
    const rig = new JointRig(figure, this.assets.hasModel(skin.model) ? this.assets.entry(skin.model).boneMap : undefined);
    const board = this.assets.create(boardDef.model, { colors: design?.colors ?? boardDef.colors });
    addOutline(figure, CONFIG.render.characterOutline);
    addOutline(board, CONFIG.render.characterOutline);
    return { rig, board };
  }

  /** Zeigt Skin/Board/Design am Surfer (baut nur neu, wenn sich etwas ändert). */
  private applyAppearance(skinId: string, boardId: string, designId: string): void {
    const a = this.appearance;
    if (a.skin === skinId && a.board === boardId && a.design === designId) return;
    const { rig, board } = this.buildVisuals(skinId, boardId, designId);
    this.surfer.setVisuals(rig, board);
    this.appearance = { skin: skinId, board: boardId, design: designId };
  }

  private applyEquipped(): void {
    const e = this.save.equipped;
    this.applyAppearance(e.skin, e.board, e.boardDesign);
  }

  /** Menü anzeigen (inkl. Hinweis, wenn im Skillbaum etwas freigeschaltet werden kann). */
  private showMenu(): void {
    this.ui.menu.show(this.save);
    const available = this.content.skills.all().filter((n) => skillState(this.content, this.save, n.id) === 'available').length;
    this.ui.menu.setSkillAlert(available);
  }

  openBestiary(): void {
    if (this.phase !== 'home') return;
    this.ui.menu.hide();
    new BestiaryScreen(this.ui.root, this.content, this.save, {
      thumbnail: (def, silhouette) => this.thumbnails.get(`monster:${def.id}`, () => buildMonsterPreview(def, this.assets), { silhouette, size: 256 }),
      close: () => this.showMenu(),
    });
  }

  openSkillTree(): void {
    if (this.phase !== 'home') return;
    this.ui.menu.hide();
    new SkillTreeScreen(this.ui.root, this.content, this.save, {
      unlock: (id) => {
        const ok = unlockSkill(this.content, this.save, id);
        if (ok) {
          this.saveStore.save(this.save);
          this.ui.feedback.toast(`${this.content.skills.get(id).name} freigeschaltet!`, 'info', 0);
        }
        return ok;
      },
      toggleAbility: (id) => {
        const ok = toggleAbility(this.content, this.save, id);
        if (ok) this.saveStore.save(this.save);
        return ok;
      },
      close: () => this.showMenu(),
    });
  }

  /** Shop: Surfer posiert, Kamera kreist, Auswahl wird live gezeigt. */
  openShop(): void {
    if (this.phase !== 'home') return;
    this.ui.menu.hide();
    this.surfer.fsm.start('Posing');
    this.cameraRig.setShowcase(true, this.cameraTarget());
    new ShopScreen(this.ui.root, this.content, this.save, {
      preview: (skinId, boardId, designId) => this.applyAppearance(skinId, boardId, designId),
      buy: (kind, id) => {
        const ok = buyItem(kind, id, this.save, this.content);
        if (ok) {
          this.saveStore.save(this.save);
          const name = (kind === 'board' ? this.content.boards.get(id) : this.content.skins.get(id)).name;
          this.ui.feedback.toast(`${name} gekauft!`, 'info', 0);
          this.effects.sparkle(new THREE.Vector3(this.surfer.x, this.surfer.y + 1.2, this.surfer.z), '#ffd23f');
        }
        return ok;
      },
      equip: (kind, id) => {
        const ok = equipItem(kind, id, this.save, this.content);
        if (ok) this.saveStore.save(this.save);
        return ok;
      },
      equipDesign: (id) => {
        const ok = equipDesign(this.save, id);
        if (ok) this.saveStore.save(this.save);
        return ok;
      },
      close: () => {
        this.applyEquipped();
        this.surfer.fsm.start('Lying');
        this.cameraRig.setShowcase(false, this.cameraTarget());
        this.showMenu();
      },
    });
  }

  // -------------------------------------------------------------------------
  // Ablauf
  // -------------------------------------------------------------------------

  private startPosition(): { x: number; z: number; heading: number } {
    const [ix, iz] = CONFIG.world.islandPosition;
    if (this.options.forceIsland) {
      // Vor dem Strand beim Surfshop, Blick zum Laden
      const k = this.world.island.hut.keoniPos;
      const ox = k.x - ix;
      const oz = k.z - iz;
      const l = Math.hypot(ox, oz) || 1;
      const x = ix + (ox / l) * CONFIG.world.islandRadius * 1.22;
      const z = iz + (oz / l) * CONFIG.world.islandRadius * 1.22;
      return { x, z, heading: Math.atan2(k.x - x, k.z - z) };
    }
    const b = (CONFIG.world.startBearing * Math.PI) / 180;
    // Spieler steht „südlich“ der Insel und schaut zu ihr (mit ?boss näher dran)
    const dist = this.options.forceBoss && this.bossReady() ? CONFIG.boss.triggerDistance + 40 : CONFIG.world.startDistance;
    const x = ix - Math.sin(b) * dist;
    const z = iz + Math.cos(b) * dist;
    return { x, z, heading: Math.atan2(ix - x, iz - z) };
  }

  /** Kann der Wächter der Insel erscheinen? */
  private bossReady(): boolean {
    if (this.save.progress.bossDefeated) return false;
    return !!this.options.forceBoss || bossAvailable(this.content, this.save);
  }

  goHome(): void {
    this.phase = 'home';
    this.stopCutscene();
    this.monsters.paused = false;
    this.world.reefOpen = this.save.progress.bossDefeated;
    if (this.world.chapter !== this.save.progress.chapter) this.world.setChapter(this.save.progress.chapter, 0);
    this.run = null;
    this.score.run = null;
    this.gameOverTimer = -1;
    this.input.gameplayEnabled = false;
    this.abilities.clear();
    this.ui.hud.setAbilities([], false);
    this.effects.updateShield(0, this.surfer, 0);
    this.time.reset();
    this.tricks.reset();
    this.monsters.clear();
    this.pearls.stop();
    this.world.ramps.reset(this.pickups);
    this.world.dolphins.stop();
    this.pickups.stop();
    this.world.waves.stop();
    this.world.waves.clear();
    this.effects.particles.clear();
    const p = this.startPosition();
    this.applyEquipped();
    this.surfer.reset(p.x, p.z, p.heading);
    this.surfer.rig.setVisible(true);
    this.cameraRig.setHome(this.cameraTarget());
    this.ui.hud.hide();
    this.showMenu();
  }

  /** „Start“ im Menü: Kamerafahrt hinter den Surfer, dann geht es los. */
  startFromMenu(): void {
    if (this.phase !== 'home') return;
    this.phase = 'transition';
    this.ui.menu.hide();
    this.tryFullscreen();
    this.cameraRig.startTransition(() => this.beginRun());
  }

  /** „Nochmal“: sofort neuer Run in der Spielansicht. */
  restart(): void {
    const p = this.startPosition();
    this.monsters.clear();
    this.world.ramps.reset(this.pickups);
    this.world.dolphins.clear();
    this.pickups.clear();
    this.world.waves.clear();
    this.effects.particles.clear();
    this.surfer.reset(p.x, p.z, p.heading);
    this.cameraRig.snapFollow(this.cameraTarget());
    this.beginRun();
  }

  private beginRun(): void {
    const seed = this.options.seed ?? Rng.randomSeed();
    const rng = new Rng(seed);
    this.stats = createPlayerStats(this.content, this.save);
    this.surfer.stats = this.stats;
    this.run = createRunState(seed, Math.round(this.stats.get('maxHearts')));
    this.score.run = this.run;
    this.time.reset();
    this.world.waves.start(rng.fork(1));
    this.pearls.start(rng.fork(2));
    this.monsters.start(rng.fork(3));
    this.pickups.start(rng.fork(4));
    this.world.dolphins.start(rng.fork(5));
    this.tricks.reset();
    this.surfer.startPlaying();
    this.abilities.setup(equippedAbilities(this.content, this.save));
    this.ui.hud.setAbilities(
      this.abilities.slots.map((s, i) => ({ icon: s.def.icon, name: s.def.name, key: ['Q', 'E'][i] ?? '' })),
      !this.isTouch,
    );
    this.input.gameplayEnabled = true;
    this.world.reefOpen = this.save.progress.bossDefeated;
    this.phase = 'playing';
    this.lastZone = '';
    this.ui.hud.show();
    this.bus.emit('runStarted', { seed });
    this.ui.feedback.toast(this.isTouch ? 'Joystick nach vorne: paddeln!' : 'W: paddeln!', 'info', 0);
  }

  pause(): void {
    if (this.phase !== 'playing' || this.cutscene) return;
    this.phase = 'paused';
    this.touch?.reset();
    this.drawSurface.cancel();
    this.closePause = showPause(
      this.ui.root,
      () => this.resume(),
      () => {
        this.closePause = null;
        const summary = this.endRun(false);
        if (summary?.chests) this.openChests(summary.chests, () => this.goHome());
        else this.goHome();
      },
    );
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    this.closePause?.();
    this.closePause = null;
    this.phase = 'playing';
    this.lastFrame = performance.now();
  }

  /** Beendet den Run, speichert Fortschritt. Gibt die Zusammenfassung zurück. */
  private endRun(showScreen: boolean): RunSummary | null {
    const run = this.run;
    if (!run) return null;
    this.input.gameplayEnabled = false;
    this.tricks.reset();
    this.abilities.clear();
    const xp = this.score.finalXp();
    const previousHighscore = this.save.highscore;
    const summary: RunSummary = {
      score: run.score,
      pearls: run.pearls,
      xp,
      monstersDefeated: run.monstersDefeated,
      tricksLanded: run.tricksLanded,
      bestCombo: run.bestCombo,
      wavesRidden: run.wavesRidden,
      duration: run.elapsed,
      newHighscore: run.score > previousHighscore,
      previousHighscore,
      chests: run.chests,
    };
    // Dauerhaft speichern
    this.save.pearls += run.pearls;
    this.save.xp += xp;
    this.save.stats.totalXp += xp;
    this.save.highscore = Math.max(this.save.highscore, run.score);
    this.save.stats.runs++;
    this.save.stats.totalPearls += run.pearls;
    this.save.stats.totalMonstersDefeated += run.monstersDefeated;
    this.save.stats.bestCombo = Math.max(this.save.stats.bestCombo, run.bestCombo);
    this.saveStore.save(this.save);
    this.bus.emit('runEnded', { summary });
    this.run = null;
    this.score.run = null;
    if (showScreen) {
      this.phase = 'gameover';
      this.ui.hud.hide();
      const over = () =>
        showGameOver(
          this.ui.root,
          summary,
          () => this.restart(),
          () => this.goHome(),
        );
      // Erst die eingesammelten Truhen öffnen, dann die Auswertung
      if (summary.chests > 0) this.openChests(summary.chests, over);
      else over();
    }
    return summary;
  }

  /** Wächter besiegt: Riff öffnet sich, der Weg zur Insel ist frei (wird sofort gespeichert). */
  private onBossDefeated(): void {
    this.save.progress.bossDefeated = true;
    this.saveStore.save(this.save);
    this.world.reefOpen = true;
    this.cameraRig.kick(10, 1);
    this.effects.confetti(tmpVec.set(this.surfer.x, this.surfer.y + 2, this.surfer.z), 3);
    this.ui.feedback.stamp('WÄCHTER BESIEGT!', '#ffd23f', 'Der Weg zur Insel ist frei!');
    setTimeout(() => this.ui.feedback.toast('Das Riff ist offen – fahr zur Insel!', 'info', 0), 1600);
  }

  /** Wächter auftauchen lassen: auf einer Sandbank vor dem Riff, auf der Seite des Spielers. */
  private spawnBoss(run: RunState): void {
    const def = this.content.monsters.all().find((m) => m.boss);
    if (!def) return;
    const [ix, iz] = CONFIG.world.islandPosition;
    const s = this.surfer;
    const a = Math.atan2(s.z - iz, s.x - ix);
    const r = CONFIG.boss.sandbankDistance;
    this.monsters.spawn(def, 1, ix + Math.cos(a) * r, iz + Math.sin(a) * r);
    run.bossSpawned = true;
  }

  /** Truhen nacheinander mit der Glücksspiel-Walze öffnen; Inhalt landet sofort im Spielstand. */
  private openChests(count: number, done: () => void): void {
    const view = (r: ChestRewardDef): CaseItemView => ({
      name: r.design ? this.content.boardDesigns.get(r.design).name : r.name,
      rarity: r.rarity,
      kind: r.design ? 'design' : r.xp ? 'xp' : 'pearls',
      amount: r.pearls ?? r.xp,
      colors: r.design ? this.content.boardDesigns.get(r.design).colors : undefined,
    });
    showCaseOpening(this.ui.root, {
      count,
      open: () => {
        const reward = rollChest(this.content, this.chestRng);
        const res = applyChestReward(this.save, reward);
        this.saveStore.save(this.save);
        const text = res.design
          ? `${reward.name} – neu! (im Shop ausrüsten)`
          : res.duplicate
            ? `${reward.name} – doppelt → +${res.pearls} Perlen`
            : res.xp
              ? `${reward.name} · +${res.xp} XP`
              : `${reward.name} · +${res.pearls} Perlen`;
        return { win: view(reward), result: text };
      },
      filler: () => view(rollChest(this.content, this.chestRng)),
      sfx: this.audio.sfx,
      done,
    });
  }

  // -------------------------------------------------------------------------
  // Events & UI
  // -------------------------------------------------------------------------

  private wireEvents(): void {
    const b = this.bus;
    b.on('playerHit', () => {
      if (!this.run) return;
      if (this.run.hearts <= 0) this.gameOverTimer = 1.4;
    });
    b.on('monsterDefeated', (e) => this.recordBestiary(e.monsterId, e.tier, true));
    b.on('monsterSpawned', (e) => this.recordBestiary(e.monsterId, e.tier, false));
    b.on('waveSetIncoming', (e) =>
      this.ui.feedback.toast(e.big ? 'Große Welle kommt!' : e.waveCount >= 4 ? 'Großes Set kommt!' : 'Set kommt!', 'info', 4000),
    );
    b.on('waveCaught', () => this.ui.feedback.toast('Welle erwischt!', 'info', 1000));
    b.on('abilityUsed', (e) => this.ui.feedback.toast(this.content.abilities.get(e.abilityId).name + '!', 'info', 0));
    b.on('shieldBroken', () => this.ui.feedback.toast('Blasenschild hat dich geschützt!', 'info', 0));
    b.on('monsterWarning', (e) => {
      const name = this.content.monsters.tryGet(e.monsterId)?.name ?? 'Monster';
      this.ui.feedback.toast(`${name}! Achtung!`, 'warn', 1000);
    });
    b.on('monsterDefeated', (e) => {
      // Belohnungs-Perlen spritzen heraus und fliegen zum Spieler
      this.pickups.burst(e.position.x, this.world.heightAt(e.position.x, e.position.z) + 2, e.position.z, e.rewards.pearls);
      this.cameraRig.kick(6, 0.35);
    });
    b.on('pearlCollected', (e) => {
      const p = this.effects.toScreen(tmpVec.set(e.position.x, e.position.y, e.position.z));
      if (p.visible) this.ui.feedback.pearlFly(p.x, p.y, this.ui.hud.pearlChip, e.value > 1);
    });
    b.on('pearlChain', (e) => {
      const p = this.effects.toScreen(tmpVec.set(e.position.x, e.position.y, e.position.z));
      if (p.visible) this.ui.feedback.pearlPop(e.total, p.x, p.y, e.total >= 25);
      if (e.bonus) this.ui.feedback.stamp(`PERLENKETTE ×${e.count}`, '#ff8ad8', `+${e.bonus}`);
    });
    b.on('launched', (e) => {
      this.cameraRig.kick(5 + e.power * 4, 0.15 * e.power);
      const label = { ramp: 'WRACK-SPRUNG!', geyser: 'GEYSIR!', punch: 'DURCHSTOSS!', bounce: 'KOPFTREFFER!' }[e.source as string];
      if (label) this.ui.feedback.stamp(label, e.source === 'punch' ? '#3fe0ff' : '#ffd23f');
    });
    b.on('wreckBonk', () => this.cameraRig.kick(0, 0.4));
    b.on('bossEvent', (e) => {
      if (e.kind === 'awaken') {
        this.cameraRig.kick(8, 0.8);
        this.ui.feedback.stamp('DER WÄCHTER ERWACHT!', '#ff4f3d', 'Besiege ihn mit Tricks!');
      } else if (e.kind === 'enrage') {
        this.cameraRig.kick(6, 0.6);
        this.ui.feedback.stamp('DIE KRABBE WIRD WÜTEND!', '#ff4f3d', 'Spring über die Wellen!');
      } else if (e.kind === 'stomp') {
        this.cameraRig.kick(3, 0.7);
      } else if (e.kind === 'impact') {
        const s = this.surfer;
        if (Math.hypot(e.position.x - s.x, e.position.z - s.z) < 25) this.cameraRig.kick(0, 0.3);
      } else if (e.kind === 'defeated') {
        this.onBossDefeated();
      }
    });
    b.on('dolphinsSpotted', () => this.ui.feedback.toast('Delfine! Häng dich dran!', 'info', 0));
    b.on('dolphinRide', (e) => {
      if (e.active) this.ui.feedback.stamp('DELFIN-RITT!', '#3fe0ff');
    });
    b.on('landed', (e) => {
      if (e.airtime >= CONFIG.score.bigAirTime) {
        this.cameraRig.kick(3, 0.45);
        this.score.add(Math.round(CONFIG.score.bigAirPerSecond * e.airtime), 'Big Air!', false);
        this.ui.feedback.stamp('BIG AIR!', '#3fe0ff', `${e.airtime.toFixed(1)} s`);
      }
    });
    b.on('trickLanded', (e) => {
      if (e.quality === 'perfect') this.cameraRig.kick(5, 0.25);
    });
    b.on('scoreAdded', (e) => {
      if (e.points < 20 && !e.reason) return;
      const x = window.innerWidth / 2 + (Math.random() - 0.5) * 120;
      const y = window.innerHeight * 0.56 + Math.random() * 24;
      this.ui.feedback.scorePop(`+${e.points}${e.multiplier > 1 ? ` ×${e.multiplier}` : ''}`, x, y, e.multiplier > 1 ? '#ffd23f' : '#ffffff');
    });
  }

  private recordBestiary(monsterId: string, tier: number, defeated: boolean): void {
    const entry = (this.save.bestiary[monsterId] ??= { seen: 0, defeated: 0, highestTierDefeated: 0, defeatedByTier: {} });
    if (defeated) {
      entry.defeated++;
      entry.highestTierDefeated = Math.max(entry.highestTierDefeated, tier);
      entry.defeatedByTier[tier] = (entry.defeatedByTier[tier] ?? 0) + 1;
      // Sofort speichern: die nächste Stufe gilt ab jetzt, auch wenn der Run abbricht
      this.saveStore.save(this.save);
    } else {
      entry.seen++;
    }
  }

  private wireUi(): void {
    this.ui.menu.onStart = () => this.startFromMenu();
    this.ui.menu.onOpen = (target) => {
      if (target === 'shop') {
        this.openShop();
        return;
      }
      if (target === 'skills') this.openSkillTree();
      else this.openBestiary();
    };
    this.ui.menu.onToggleSound = () => {
      const on = !this.save.settings.sound;
      this.save.settings.sound = on;
      this.saveStore.save(this.save);
      this.audio.sfx.setEnabled(on);
      this.ui.menu.setSound(on);
    };
    // Klick-Geräusch für alle Knöpfe
    this.ui.root.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) this.audio.sfx.click();
    });
    this.ui.hud.pauseButton.addEventListener('click', () => this.pause());
    this.ui.hud.onAbility = (slot) => this.input.triggerAbility(slot);
  }

  private tryFullscreen(): void {
    if (!this.isTouch) return;
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
    req?.()
      .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
      .catch(() => {});
  }

  private onResize(): void {
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    this.renderer.setSize(w, hgt);
    this.postfx.setSize(w, hgt, this.pixelRatio);
    this.cameraRig.setAspect(w / hgt);
    this.effects.particles.setViewportHeight(hgt * this.pixelRatio, CONFIG.render.fov);
    this.ui.drawing.resize();
  }

  // -------------------------------------------------------------------------
  // Hauptschleife
  // -------------------------------------------------------------------------

  private cameraTarget(): CameraTarget {
    const [ix, iz] = CONFIG.world.islandPosition;
    return {
      x: this.surfer.x,
      z: this.surfer.z,
      waterY: this.surfer.isAirborne ? this.world.heightAt(this.surfer.x, this.surfer.z) : this.surfer.y,
      heading: this.surfer.heading,
      islandX: ix,
      islandZ: iz,
      airHeight: this.surfer.isAirborne ? this.surfer.y - this.world.heightAt(this.surfer.x, this.surfer.z) : 0,
      speedK: this.surfer.speed / (this.stats?.get('maxSpeed') ?? 22),
    };
  }

  private frame(): void {
    const now = performance.now();
    const realDt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.measureFps(realDt);

    this.input.update();
    if (this.input.consumePause()) {
      if (this.phase === 'playing') this.pause();
      else if (this.phase === 'paused') this.resume();
    }

    if (this.phase === 'paused') {
      this.postfx.render(this.world.scene, this.cameraRig.camera, realDt);
      return;
    }

    const dt = this.time.update(realDt);
    this.update(dt, realDt);
    this.postfx.render(this.world.scene, this.cameraRig.camera, realDt);
  }

  private update(dt: number, realDt: number): void {
    const s = this.surfer;
    s.update(dt);
    this.world.update(dt, s.x, s.z, this.cameraRig.camera, s.vx, s.vz);
    this.cameraRig.update(realDt, this.cameraTarget());
    this.tricks.update(dt, realDt);
    this.effects.update(dt, realDt, s, this.world);

    const run = this.run;
    if (run && this.phase === 'playing') {
      run.elapsed += dt;
      this.score.update(dt);
      this.updateAbilities(dt, run);
      this.monsters.update(dt, s, run, this.stats, this.cameraRig.camera);
      this.pearls.update(dt, this.world.waves.field.time, s.x, s.y + 0.9, s.z, this.stats.get('pearlMagnet'));
      this.pickups.update(dt, this.world.waves.field.time, { x: s.x, y: s.y + 0.9, z: s.z, magnet: this.stats.get('pearlMagnet') }, s.heading);
      this.world.ramps.update(dt, s.x, s.z, this.pickups);
      const geyser = this.world.geysers.update(dt, s, this.effects);
      if (geyser && s.fsm.is('Standing', 'Paddling', 'Landing')) this.launchFromGeyser(geyser);
      this.world.dolphins.update(dt, s, this.stats.get('maxSpeed'), this.pickups, this.effects);
      this.updatePowerups(dt, run);
      this.updateStory(realDt);
      if (!run.bossSpawned && this.bossReady() && this.world.island.distanceTo(s.x, s.z) < CONFIG.boss.triggerDistance) this.spawnBoss(run);
      this.updateZone(run);
      this.updateBoundaryWarning();
      if (run.invulnerable > 0) {
        run.invulnerable -= dt;
        s.rig.setVisible(run.invulnerable <= 0 || Math.floor(run.invulnerable * 10) % 2 === 0);
      } else {
        s.rig.setVisible(true);
      }
      if (this.gameOverTimer > 0) {
        this.gameOverTimer -= realDt;
        if (this.gameOverTimer <= 0) {
          this.gameOverTimer = -1;
          this.endRun(true);
        }
      }
      this.updateHud(run);
    } else {
      this.pearls.update(dt, this.world.waves.field.time, Infinity, 0, Infinity, 0);
      this.pickups.update(dt, this.world.waves.field.time, null);
      this.world.ramps.update(dt, s.x, s.z, null);
      this.world.geysers.update(dt, s);
    }
  }

  // -------------------------------------------------------------------------
  // Insel & Geschichte
  // -------------------------------------------------------------------------

  /** An Land: Monster ruhen, Keoni ansprechen, Zwischensequenz abspielen. */
  private updateStory(realDt: number): void {
    const s = this.surfer;
    const hut = this.world.island.hut;
    hut.guiding = this.world.reefOpen && !this.save.progress.metKeoni && !this.cutscene;
    this.ui.dialog.update(realDt);
    if (this.quakeLeft > 0) {
      this.quakeLeft -= realDt;
      if (Math.random() < realDt * 4) this.cameraRig.kick(0, 0.5 + Math.random() * 0.5);
    }
    if (this.cutscene) {
      this.cutscene.update(realDt);
      return;
    }
    const walking = s.fsm.is('Walking');
    this.monsters.paused = walking;
    if (walking && !this.wasWalking) {
      // An Land gegangen: Monster ziehen sich zurück
      this.monsters.dismissAll();
      this.ui.feedback.toast(this.save.progress.metKeoni ? 'An Land! Zurück ins Wasser zum Weitersurfen.' : 'An Land! Lauf zum Surfshop!', 'info', 0);
    }
    this.wasWalking = walking;
    const d = Math.hypot(hut.keoniPos.x - s.x, hut.keoniPos.z - s.z);
    if (d > CONFIG.island.talkDistance * 2) this.keoniCooldown = false;
    if (walking && !this.keoniCooldown && d < CONFIG.island.talkDistance) {
      const intro = !this.save.progress.metKeoni;
      this.startCutscene(intro ? KEONI_INTRO : KEONI_LATER, intro);
    }
  }

  private startCutscene(steps: readonly CutsceneStep[], intro: boolean): void {
    const s = this.surfer;
    const k = this.world.island.hut.keoniPos;
    this.input.gameplayEnabled = false;
    this.touch?.reset();
    this.drawSurface.cancel();
    this.ui.hud.hide();
    this.monsters.paused = true;
    s.speed = 0;
    s.heading = Math.atan2(k.x - s.x, k.z - s.z);
    this.cutscene = new Cutscene(
      steps,
      { dialog: this.ui.dialog, shot: (name, time) => this.cutsceneShot(name, time), event: (name) => this.cutsceneEvent(name) },
      'Keoni',
      () => this.endCutscene(intro),
    );
  }

  private endCutscene(intro: boolean): void {
    this.cutscene = null;
    this.keoniCooldown = true;
    this.cameraRig.clearCinematic(1.4);
    if (this.phase !== 'playing') return;
    this.input.gameplayEnabled = true;
    this.ui.hud.show();
    if (intro) {
      this.ui.chapterTitle('Kapitel 2', 'Feuermeer');
      setTimeout(() => this.ui.feedback.toast('Neue Tricks: Feuerrad, Korkenzieher, Sturzflug!', 'info', 0), 4300);
    }
  }

  /** Zwischensequenz abbrechen (z. B. zurück ins Menü). */
  private stopCutscene(): void {
    if (!this.cutscene) return;
    this.cutscene = null;
    this.ui.dialog.hide();
    this.cameraRig.clearCinematic(0.01);
    this.quakeLeft = 0;
  }

  /** Kameraeinstellungen der Zwischensequenz: 'keoni', 'volcano', 'sea'. */
  private cutsceneShot(name: string, time: number): void {
    const [ix, iz] = CONFIG.world.islandPosition;
    const k = this.world.island.hut.keoniPos;
    // Richtung vom Inselzentrum hinaus aufs Meer und quer dazu
    const l = Math.hypot(k.x - ix, k.z - iz) || 1;
    const nx = (k.x - ix) / l;
    const nz = (k.z - iz) / l;
    const sx = -nz;
    const sz = nx;
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    if (name === 'volcano') {
      pos.set(k.x + nx * 18 - sx * 7, k.y + 10, k.z + nz * 18 - sz * 7);
      look.set(ix, CONFIG.world.volcanoHeight * 0.72, iz);
    } else if (name === 'sea') {
      pos.set(k.x + nx * 45, k.y + 16, k.z + nz * 45);
      look.set(k.x + nx * 220, 0, k.z + nz * 220);
    } else {
      pos.set(k.x + nx * 6.5 + sx * 2.8, k.y + 1.9, k.z + nz * 6.5 + sz * 2.8);
      look.set(k.x + nx * 1.2, k.y + 1.25, k.z + nz * 1.2);
    }
    this.cameraRig.setCinematic(pos, look, time);
  }

  /** Ereignisse der Zwischensequenz; Rückgabe = Wartezeit in Sekunden. */
  private cutsceneEvent(name: string): number {
    switch (name) {
      case 'pathGlow':
        this.world.island.showPath(true);
        this.audio.sfx.reveal('rare');
        return 1.2;
      case 'rumble':
        this.cameraRig.kick(0, 1);
        this.audio.sfx.stomp();
        this.quakeLeft = 1.6;
        return 1.8;
      case 'eruption':
        // Vulkan bricht aus: Feuermeer mit Trümmern statt Wracks, rötlicher Himmel
        this.world.ramps.reset(this.pickups);
        this.world.setChapter(2, 5);
        this.cameraRig.kick(12, 1.6);
        this.audio.sfx.roar();
        this.audio.sfx.rockImpact(0);
        this.quakeLeft = 5;
        return 5.5;
      case 'chapter2':
        this.save.progress.chapter = Math.max(2, this.save.progress.chapter);
        this.save.progress.metKeoni = true;
        this.saveStore.save(this.save);
        this.world.island.showPath(false);
        return 0;
    }
    return 0;
  }

  /** Geysir: hoch und weit nach außen schleudern, Perlenbogen entlang der Flugbahn. */
  private launchFromGeyser(g: Geyser): void {
    const G = CONFIG.geysers;
    const s = this.surfer;
    s.x = g.x;
    s.z = g.z;
    s.overdrive = Math.max(s.overdrive, G.overdrive);
    s.speed = this.stats.get('maxSpeed') + G.overdrive * 0.6;
    s.launch({ vy: G.launchVy, vx: g.outX * G.launchOut, vz: g.outZ * G.launchOut, heading: Math.atan2(g.outX, g.outZ), source: 'geyser', power: 1.8 });
    const pts = this.world.geysers.arcPoints(g, G.arcPearls);
    this.pickups.spawnArc(pts, '', Math.floor(pts.length / 2));
  }

  /** Kiste oder Power-up eingesammelt. */
  private applyPickup(def: PickupDef, pos: THREE.Vector3): void {
    const run = this.run;
    if (!run) return;
    if (def.pearls) this.pickups.burst(pos.x, pos.y + 0.6, pos.z, def.pearls);
    if (def.points) this.score.add(def.points, '', false);
    if (def.boost) this.surfer.boost(def.boost);
    if (def.chest) run.chests++;
    if (def.modifiers?.length && def.duration) {
      const id = `powerup:${def.id}`;
      this.stats.removeSource(id);
      this.stats.addSource({ id, modifiers: def.modifiers });
      run.powerups[def.id] = def.duration;
      this.bus.emit('powerupChanged', { pickupId: def.id, active: true, duration: def.duration });
    }
    this.effects.pickupBurst(pos, def.color);
    this.cameraRig.kick(5, 0.3);
    this.ui.feedback.stamp(`${def.name.toUpperCase()}!`, def.color, def.chest ? 'Öffnen nach dem Run' : def.points ? `+${def.points}` : '');
  }

  private updatePowerups(dt: number, run: RunState): void {
    for (const id of Object.keys(run.powerups)) {
      run.powerups[id]! -= dt;
      if (run.powerups[id]! <= 0) {
        delete run.powerups[id];
        this.stats.removeSource(`powerup:${id}`);
        this.bus.emit('powerupChanged', { pickupId: id, active: false, duration: 0 });
      }
    }
  }

  private abilityContext(run: RunState): AbilityContext {
    return { surfer: this.surfer, world: this.world, run, stats: this.stats, bus: this.bus, effects: this.effects };
  }

  private updateAbilities(dt: number, run: RunState): void {
    this.abilities.update(dt);
    const ctx = this.abilityContext(run);
    for (let i = 0; i < this.abilities.slots.length; i++) {
      if (this.input.consumeAbility(i) && !this.abilities.trigger(i, ctx)) {
        if (this.abilities.cooldownFraction(i) <= 0) this.ui.feedback.toast('Gerade nicht möglich', 'warn', 800);
      }
    }
    if (run.shield > 0) run.shield = Math.max(0, run.shield - dt);
    this.effects.updateShield(run.shield, this.surfer, run.elapsed);
  }

  private updateZone(run: RunState): void {
    const d = this.world.island.distanceTo(this.surfer.x, this.surfer.z);
    const zone = this.content.zones.all().find((z) => d <= z.maxDistance) ?? this.content.zones.all().at(-1)!;
    run.zoneId = zone.id;
    if (zone.id !== this.lastZone) {
      if (this.lastZone) this.ui.feedback.toast(zone.name, 'info', 0);
      this.lastZone = zone.id;
      this.bus.emit('zoneChanged', { zoneId: zone.id, name: zone.name });
    }
  }

  private updateBoundaryWarning(): void {
    const active = this.surfer.boundaryStrength > 0.05;
    if (active !== this.boundaryWarned) {
      this.boundaryWarned = active;
      this.bus.emit('boundaryPush', { active });
      if (active) this.ui.feedback.toast(this.world.reefOpen ? 'Strand voraus! Hier geht es bald weiter …' : 'Sturm am Riff! Hier geht es nicht weiter.', 'warn', 4000);
    }
  }

  private updateHud(run: RunState): void {
    const s = this.surfer;
    const [ix, iz] = CONFIG.world.islandPosition;
    // Nach dem Boss zeigt der Kompass zum Surfshop (bis man Keoni getroffen hat)
    const toShop = this.world.reefOpen && !this.save.progress.metKeoni;
    const k = this.world.island.hut.keoniPos;
    const tx = toShop ? k.x : ix;
    const tz = toShop ? k.z : iz;
    const bearing = Math.atan2(tx - s.x, tz - s.z);
    const camYaw = Math.atan2(
      this.cameraRig.camera.getWorldDirection(tmpDir).x,
      this.cameraRig.camera.getWorldDirection(tmpDir).z,
    );
    const zone = this.content.zones.tryGet(run.zoneId);
    const hint = s.waveHint;
    this.ui.hud.update({
      hearts: run.hearts,
      maxHearts: run.maxHearts,
      score: run.score,
      combo: run.combo,
      multiplier: this.score.multiplier,
      pearls: run.pearls,
      speed: s.speed,
      speedMax: this.stats.get('maxSpeed'),
      standSpeed: CONFIG.player.standSpeed,
      standing: !s.fsm.is('Paddling', 'Lying', 'Wipeout'),
      walking: s.fsm.is('Walking'),
      targetName: toShop ? 'Surfshop' : 'Insel',
      islandAngle: -wrapAngle(bearing - camYaw),
      islandDistance: toShop ? Math.hypot(tx - s.x, tz - s.z) : this.world.island.distanceTo(s.x, s.z),
      zoneName: zone?.name ?? '',
      wave: {
        visible: hint.waveId !== null && !s.isAirborne && !s.punchHint.visible,
        distance: hint.distance,
        windowMin: hint.windowMin,
        windowMax: hint.windowMax,
        lookahead: CONFIG.hud.waveLookahead,
        inWindow: hint.inWindow,
        aligned: hint.aligned,
        riding: s.rideWaveId !== null,
      },
      invulnerable: run.invulnerable > 0,
      pearlChain: run.pearlChain,
      chests: run.chests,
      powerups: Object.entries(run.powerups).map(([id, t]) => {
        const def = this.content.pickups.get(id);
        return { id, icon: def.icon, color: def.color, remaining: t / (def.duration ?? 1) };
      }),
      speedLines: Math.max(0, Math.min(1, (s.speed - this.stats.get('maxSpeed') * 0.85) / 6)),
      punch: this.punchOrRingHint(),
      boss: this.bossHud(),
      geyser: this.geyserHint(camYaw),
      abilities: this.abilities.slots.map((slot, i) => ({
        cooldown: this.abilities.cooldownFraction(i),
        active: slot.def.effect === 'shield' && run.shield > 0,
        usable: this.abilities.canUse(i, this.abilityContext(run)),
      })),
    });
  }

  /** Boss-Leiste oben (oder null). */
  private bossHud(): { name: string; hp: number; enraged: boolean } | null {
    const b = this.monsters.boss;
    if (!b || b.phase === 'warning') return null;
    return { name: b.def.name, hp: Math.max(0, b.hp / b.maxHp), enraged: b instanceof Crab && b.enraged };
  }

  /** „Spring!“-Hinweis: Welle von vorn (Durchstoß) oder Ringwelle der Krabbe. */
  private punchOrRingHint(): { visible: boolean; inWindow: boolean; distance: number; ring: boolean } {
    const b = this.monsters.boss;
    const s = this.surfer;
    if (b instanceof Crab && !s.isAirborne) {
      const d = b.ringDistanceTo(s.x, s.z);
      if (d < CONFIG.boss.ringWarn) return { visible: true, inWindow: d < CONFIG.boss.ringJump, distance: d, ring: true };
    }
    return { ...s.punchHint, ring: false };
  }

  /** Nahe der Insel: Richtung und Entfernung zum nächsten Geysir. */
  private geyserHint(camYaw: number): { visible: boolean; angle: number; distance: number } {
    const s = this.surfer;
    if (s.isAirborne || s.fsm.is('Walking') || this.world.island.distanceTo(s.x, s.z) > CONFIG.geysers.hintDistance) return { visible: false, angle: 0, distance: 0 };
    const n = this.world.geysers.nearest(s.x, s.z);
    if (!n) return { visible: false, angle: 0, distance: 0 };
    const bearing = Math.atan2(n.geyser.x - s.x, n.geyser.z - s.z);
    return { visible: n.distance > 12, angle: -wrapAngle(bearing - camYaw), distance: n.distance };
  }

  /** Passt die Auflösung an, wenn die Bildrate dauerhaft einbricht. */
  private measureFps(realDt: number): void {
    this.fpsAccum += realDt;
    this.fpsFrames++;
    if (this.fpsAccum < 1) return;
    const fps = this.fpsFrames / this.fpsAccum;
    this.fpsAccum = 0;
    this.fpsFrames = 0;
    if (this.options.debug) this.ui.showFps(fps, `dpr ${this.pixelRatio.toFixed(2)}`);
    const R = CONFIG.render;
    if (!R.adaptiveResolution || this.save.settings.quality !== 'auto') return;
    if (fps < R.targetFps - 8) {
      this.lowFpsTime += 1;
      if (this.lowFpsTime >= 2 && this.pixelRatio > R.minPixelRatio) {
        this.pixelRatio = Math.max(R.minPixelRatio, this.pixelRatio - 0.15);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.postfx.setSize(window.innerWidth, window.innerHeight, this.pixelRatio);
        this.effects.particles.setViewportHeight(window.innerHeight * this.pixelRatio, CONFIG.render.fov);
        this.lowFpsTime = 0;
      } else if (this.lowFpsTime >= 3 && this.pixelRatio <= R.minPixelRatio) {
        // Immer noch zu langsam: erst Nachbearbeitung, dann Schatten abschalten
        this.lowFpsTime = 0;
        this.lowFpsStage++;
        if (this.lowFpsStage === 1) this.postfx.enabled = false;
        if (this.lowFpsStage === 2) this.world.sun.castShadow = false;
      }
    } else {
      this.lowFpsTime = 0;
    }
  }
}

const tmpDir = new THREE.Vector3();
const tmpVec = new THREE.Vector3();
