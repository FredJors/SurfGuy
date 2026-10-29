/**
 * Spiel-Orchestrator: verbindet Welt, Surfer, Kamera, Eingabe, Systeme und UI.
 * Ablauf: Laden → Homescreen → Kamerafahrt → Spielen ↔ Pause → Game Over → Nochmal/Menü.
 */
import * as THREE from 'three';
import { AssetLoader } from '../assets/AssetLoader';
import { CameraRig, type CameraTarget } from '../camera/CameraRig';
import { CONFIG } from '../config/gameConfig';
import { createRegistries, validateContent, type ContentRegistries } from '../data';
import { Effects } from '../fx/Effects';
import { addOutline } from '../fx/toon';
import { DrawSurface } from '../input/DrawSurface';
import { InputManager } from '../input/InputManager';
import { KeyboardSource } from '../input/KeyboardSource';
import { TouchSource } from '../input/TouchSource';
import { MONSTER_BEHAVIORS } from '../monsters/behaviors';
import { MonsterSystem } from '../monsters/MonsterSystem';
import { ABILITY_EFFECTS, type AbilityContext } from '../player/abilityEffects';
import { AbilitySystem } from '../player/AbilitySystem';
import { buyItem, createPlayerStats, equipItem, equippedAbilities, skillState, toggleAbility, unlockSkill, type PlayerStats } from '../player/Progression';
import { SkillTreeScreen } from '../ui/SkillTree';
import { JointRig } from '../player/rig/CharacterRig';
import { Surfer } from '../player/Surfer';
import { TrickSystem } from '../tricks/TrickSystem';
import { showComingSoon, showGameOver, showPause } from '../ui/Screens';
import { ShopScreen } from '../ui/Shop';
import { UI } from '../ui/UI';
import { PearlSystem } from '../world/PearlSystem';
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
  score!: ScoreSystem;
  tricks!: TrickSystem;
  monsters!: MonsterSystem;
  readonly abilities = new AbilitySystem();
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
  /** Aktuell am Surfer gezeigte Optik (Skin/Board) */
  private appearance = { skin: '', board: '' };

  constructor(
    container: HTMLElement,
    readonly options: GameOptions,
  ) {
    this.content = createRegistries();
    const errors = validateContent(this.content, Object.keys(MONSTER_BEHAVIORS), Object.keys(ABILITY_EFFECTS));
    if (errors.length) console.error('[Inhalte] Fehler in den Daten:\n' + errors.join('\n'));

    this.save = this.saveStore.load();
    if (options.boardOverride && this.content.boards.has(options.boardOverride)) {
      this.save.equipped.board = options.boardOverride;
    }

    this.renderer = new THREE.WebGLRenderer({ antialias: CONFIG.render.antialias, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.pixelRatio = this.maxPixelRatio();
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.ui = new UI(this.isTouch);
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
    this.cameraRig = new CameraRig(window.innerWidth / window.innerHeight);
    this.effects = new Effects(this.world.scene, this.cameraRig.camera, this.ui, this.bus, this.world);
    this.effects.particles.setViewportHeight(window.innerHeight * this.pixelRatio, CONFIG.render.fov);

    // Surfer mit Rig (Platzhalter oder glTF) und Brett aus dem Register
    this.surfer = this.createSurfer();
    this.world.scene.add(this.surfer.root);

    this.pearls = new PearlSystem(this.bus, this.assets, this.world.waves, new Rng(3));
    this.world.scene.add(this.pearls.group);
    this.score = new ScoreSystem(this.bus, this.content, () => this.stats);
    this.monsters = new MonsterSystem(this.bus, this.content, this.assets, this.world, this.effects);
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
    const { rig, board } = this.buildVisuals(this.save.equipped.skin, this.save.equipped.board);
    this.appearance = { skin: this.save.equipped.skin, board: this.save.equipped.board };
    return new Surfer(this.bus, this.input, this.stats, this.world, rig, board, this.content.poses);
  }

  /** Baut Figur (Skin) und Brett aus Register + Asset-Manifest. */
  private buildVisuals(skinId: string, boardId: string): { rig: JointRig; board: THREE.Object3D } {
    const skin = this.content.skins.tryGet(skinId) ?? this.content.skins.all()[0]!;
    const boardDef = this.content.boards.tryGet(boardId) ?? this.content.boards.all()[0]!;
    const figure = this.assets.create(skin.model, { colors: skin.colors, accessories: skin.accessories });
    const rig = new JointRig(figure, this.assets.hasModel(skin.model) ? this.assets.entry(skin.model).boneMap : undefined);
    const board = this.assets.create(boardDef.model, { colors: boardDef.colors });
    addOutline(figure);
    addOutline(board, 0.025);
    return { rig, board };
  }

  /** Zeigt Skin/Board am Surfer (baut nur neu, wenn sich etwas ändert). */
  private applyAppearance(skinId: string, boardId: string): void {
    if (this.appearance.skin === skinId && this.appearance.board === boardId) return;
    const { rig, board } = this.buildVisuals(skinId, boardId);
    this.surfer.setVisuals(rig, board);
    this.appearance = { skin: skinId, board: boardId };
  }

  /** Menü anzeigen (inkl. Hinweis, wenn im Skillbaum etwas freigeschaltet werden kann). */
  private showMenu(): void {
    this.ui.menu.show(this.save);
    const available = this.content.skills.all().filter((n) => skillState(this.content, this.save, n.id) === 'available').length;
    this.ui.menu.setSkillAlert(available);
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
      preview: (skinId, boardId) => this.applyAppearance(skinId, boardId),
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
      close: () => {
        this.applyAppearance(this.save.equipped.skin, this.save.equipped.board);
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
    const b = (CONFIG.world.startBearing * Math.PI) / 180;
    // Spieler steht „südlich“ der Insel und schaut zu ihr
    const x = ix - Math.sin(b) * CONFIG.world.startDistance;
    const z = iz + Math.cos(b) * CONFIG.world.startDistance;
    return { x, z, heading: Math.atan2(ix - x, iz - z) };
  }

  goHome(): void {
    this.phase = 'home';
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
    this.world.waves.stop();
    this.world.waves.clear();
    this.effects.particles.clear();
    const p = this.startPosition();
    this.applyAppearance(this.save.equipped.skin, this.save.equipped.board);
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
    this.tricks.reset();
    this.surfer.startPlaying();
    this.abilities.setup(equippedAbilities(this.content, this.save));
    this.ui.hud.setAbilities(
      this.abilities.slots.map((s, i) => ({ icon: s.def.icon, name: s.def.name, key: ['Q', 'E'][i] ?? '' })),
      !this.isTouch,
    );
    this.input.gameplayEnabled = true;
    this.phase = 'playing';
    this.lastZone = '';
    this.ui.hud.show();
    this.bus.emit('runStarted', { seed });
    this.ui.feedback.toast(this.isTouch ? 'Joystick nach vorne: paddeln!' : 'W: paddeln!', 'info', 0);
  }

  pause(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.touch?.reset();
    this.drawSurface.cancel();
    this.closePause = showPause(
      this.ui.root,
      () => this.resume(),
      () => {
        this.closePause = null;
        this.endRun(false);
        this.goHome();
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
      showGameOver(
        this.ui.root,
        summary,
        () => this.restart(),
        () => this.goHome(),
      );
    }
    return summary;
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
      if (target === 'skills') {
        this.openSkillTree();
        return;
      }
      this.ui.menu.hide();
      showComingSoon(this.ui.root, target, this.content, this.save, () => this.ui.menu.show(this.save));
    };
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
      this.renderer.render(this.world.scene, this.cameraRig.camera);
      return;
    }

    const dt = this.time.update(realDt);
    this.update(dt, realDt);
    this.renderer.render(this.world.scene, this.cameraRig.camera);
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
      if (active) this.ui.feedback.toast('Sturm am Riff! Hier geht es nicht weiter.', 'warn', 4000);
    }
  }

  private updateHud(run: RunState): void {
    const s = this.surfer;
    const [ix, iz] = CONFIG.world.islandPosition;
    const bearing = Math.atan2(ix - s.x, iz - s.z);
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
      islandAngle: -wrapAngle(bearing - camYaw),
      islandDistance: this.world.island.distanceTo(s.x, s.z),
      zoneName: zone?.name ?? '',
      wave: {
        visible: hint.waveId !== null && !s.isAirborne,
        distance: hint.distance,
        windowMin: hint.windowMin,
        windowMax: hint.windowMax,
        lookahead: CONFIG.hud.waveLookahead,
        inWindow: hint.inWindow,
        aligned: hint.aligned,
        riding: s.rideWaveId !== null,
      },
      invulnerable: run.invulnerable > 0,
      abilities: this.abilities.slots.map((slot, i) => ({
        cooldown: this.abilities.cooldownFraction(i),
        active: slot.def.effect === 'shield' && run.shield > 0,
        usable: this.abilities.canUse(i, this.abilityContext(run)),
      })),
    });
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
        this.effects.particles.setViewportHeight(window.innerHeight * this.pixelRatio, CONFIG.render.fov);
        this.lowFpsTime = 0;
      }
    } else {
      this.lowFpsTime = 0;
    }
  }
}

const tmpDir = new THREE.Vector3();
