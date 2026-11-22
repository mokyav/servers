import { attackDelayTicks, damageMultiplier, attackChargeProgress } from "../../shared/combat.js";
import * as THREE from "three";
import { B, BLOCK_COUNT, BLOCKS, INVENTORY_ITEMS, MINECRAFT_ITEM_TO_RUNTIME_ID, blockItemId, blockPlacementId, blockStateVariantId, resolveBlockStateChanges } from "../../shared/blocks";
import { craftFromGrid, craftGridForRecipe, craftRecipeFitsGrid, createCraftRecipes, getBlockDrops, miningTimeSeconds } from "../../shared/gameplay.js";
import { shouldUseTouchControls, clampJoystickDisplacement, joystickKeyCodes, wrapHotbarIndex, normalizeMobileControlPreferences, loadMobileControlPreferences, saveMobileControlPreferences } from "./mobile-controls.js";
import { defaultPerformanceSettings, normalizePerformanceSettings, applyPerformanceLevel, AdaptiveRenderDistanceTuner } from "./performance.js";
import type { PerformanceSettings } from "./performance.js";
import { addEffect, createVitals, EFFECT_DEFS, type EffectId, type PlayerVitals, canSprint } from "../../shared/vitals";
import { FOOD_DEFS } from "../../shared/food";
import { DAY_LENGTH_SEC, REACH, SEA_LEVEL, WORLD_HEIGHT } from "../../shared/constants";
import { DEFAULT_SKIN, type BanEntry, type GameMode, type PlayerInfo, type ServerMsg, type Skin } from "../../shared/protocol";
import { NAME_RULE, validateName } from "../../shared/validate";
import type { FurnaceState, FurnaceStation } from "../../shared/smelting.js";
import { ATLAS_READY_EVENT, createAtlasCanvas } from "./atlas";
import { clearBlockIconCache, blockIcon } from "./icons";
import { MinecraftInventoryUI, inventoryPanelVisibility, type InventorySlotRef, type InventorySlotType } from "./inventory-ui";
import { applyArmorReduction, armorSlotForItemId, weaponStatsForItemId, weaponReachForItemId } from "../../shared/item-mechanics.js";
import { normalizeItemEnchantments, availableEnchantmentsForItemId, setItemEnchantment, getItemEnchantment, ENCHANTMENT_LABELS, ENCHANTMENT_MAX_LEVEL, elytraWearChance } from "../../shared/enchantments.js";
import { normalizeStackComponents, migrateLegacyEnchantments, makeStackRecord, setStackEnchantment, stackDataForSlot, withStackEnchantments, slotKey, combineAnvilStacks, grindstoneStack } from "../../shared/stack-components.js";
import { countEnchantingBookshelves } from "../../shared/enchantment-runtime.js";
import { maxDurabilityForItemKey, damageStackRecord, shouldApplyDurabilityDamage } from "../../shared/item-durability.js";
import { fishingBiteDelay, isFishingOpenWater, rollFishingLootEntry } from "../../shared/fishing.js";
import { addExperience } from "../../shared/experience.js";
import { stepElytraPhysics } from "../../shared/elytra-physics.js";
import { potionSpecForItemId } from "../../shared/potions.js";
import { maxStackSizeForItemKey, maxInventoryCountForItemKey, inventoryStorageCapacity, stackComponentsEqual as inventoryStackComponentsEqual, mergeStackAmounts, splitStackInHalf } from "../../shared/inventory-stacks.js";
import { consumePlayerCraftGrid, playerCraftGridToRecipeGrid } from "../../shared/inventory-crafting.js";
import { ChunkView } from "./chunkview";
import { DropEntities } from "./drops";
import { MobModels } from "./mobs";
import { ProjectileEntities } from "./projectiles";
import { Net, checkRoom, createRoom } from "./net";
import { EYE_H, PLAYER_H, PLAYER_W, collides, inLiquid, moveBody, raycast, type Body, type RayHit } from "./physics";
import { PlayerModel, RemotePlayers } from "./remote";
import {
  K_SETTINGS, clientId, deleteSolo, getRaw, loadHostToken, loadProfile, loadRoomPlayer, loadSolo, saveHostToken, saveProfile, saveRoomPlayer, saveSolo,
  type PlayerSave, type Profile,
} from "./save";
import { Sky, skyAt } from "./sky";
import { $, Chat, Hotbar, drawSkinPreview, renderHearts, renderHunger, renderEffects, toast, type InvItem } from "./ui";
import { getExperienceProgress, experienceThreshold } from "../../shared/experience.js";
import { World } from "./world";
import { DIMENSION_IDS, findSafeSpawn, isDimensionId, mapDimensionCoordinates } from "../../shared/dimensions.js";
import { findPortalAt } from "../../shared/dimension-portals.js";
import { PORTAL_BLOCK_IDS, PORTAL_DELAY_CREATIVE_MS, PORTAL_DELAY_SURVIVAL_MS, buildPortalEdits, findNearestPortal, findPortalBuildSite, portalCollapseEdits, tryLightPortal } from "../../shared/portal.js";
import { MINECRAFT_BLOCK_TO_RUNTIME_ID, MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID } from "../../shared/minecraft-block-runtime.js";
import { blockToken, canBlockStay, canPlaceBlockAt, isFallingBlock, isReplaceableBlock, neighborCells, pairedBlockPosition, requiresBlockSupport } from "../../shared/block-behavior.js";
import { heightAt, LEGACY_WORLDGEN_VERSION, normalizeWorldgenVersion, WORLDGEN_VERSION } from "./worldgen";
import { readMinecraftSkin } from "./skin-upload";
import { DEFAULT_SKIN_IMAGE } from "./default-skin";

import { nextRepeaterDelayBlockId } from "../../shared/redstone-world.js";
import { createSoloRedstoneRuntime } from "../../shared/solo-redstone.js";

THREE.ColorManagement.enabled = false;

type State = "title" | "loading" | "paused" | "playing" | "inventory" | "furnace" | "chat";
type FurnaceView = { x: number; y: number; z: number; station: FurnaceStation; state: FurnaceState; active: boolean };
const DEFAULT_HOTBAR: number[] = [B.GRASS, B.DIRT, B.STONE, B.PLANKS, B.LOG, B.GLASS, B.BRICK, B.LAMP, B.SAND];
const CRAFT_RECIPES = createCraftRecipes(B);
const MODE_NAME: Record<GameMode, string> = { creative: "クリエイティブ", survival: "サバイバル", adventure: "アドベンチャー", spectator: "スペクテイター" };
const MODE_DESC: Record<GameMode, string> = {
  creative: "飛行OK・ブロック無限・すぐ壊せる",
  survival: "体力・空腹あり。ブロックを集めて使う",
  adventure: "体力・空腹あり。通常ブロックの設置・破壊不可",
  spectator: "飛行・観察専用。ブロック操作不可",
};
const MAX_HP = 20;
const MAX_HUNGER = 20;
/** 満腹度がこれ以上あるときだけ体力が自然回復する */
const REGEN_MIN_HUNGER = 14;
/** 壊したときに手に入るブロック(無ければ同じブロック) */
const DROPS: Record<number, number> = { [B.GRASS]: B.DIRT, [B.STONE]: B.COBBLE };

class StatusParticles {
  readonly group = new THREE.Group();
  private geometry = new THREE.BoxGeometry(0.055, 0.055, 0.055);
  private particles: { mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>; velocity: THREE.Vector3; age: number; life: number }[] = [];
  private accumulator = 0;
  update(dt: number, body: Body, effects: PlayerVitals["activeEffects"]) {
    const live = effects.filter(e => e.durationTicks > 0 && Object.prototype.hasOwnProperty.call(EFFECT_DEFS, e.effectId));
    if (live.length) {
      this.accumulator += dt;
      while (this.accumulator >= 0.28) {
        this.accumulator -= 0.28;
        const effect = live[Math.floor(Math.random() * live.length)];
        const def = EFFECT_DEFS[effect.effectId];
        const material = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.9, depthWrite: false });
        const mesh = new THREE.Mesh(this.geometry, material);
        mesh.position.set(body.x + (Math.random() - 0.5) * 0.8, body.y + 0.2 + Math.random() * 1.45, body.z + (Math.random() - 0.5) * 0.8);
        this.group.add(mesh);
        this.particles.push({ mesh, velocity: new THREE.Vector3((Math.random() - 0.5) * 0.18, 0.16 + Math.random() * 0.24, (Math.random() - 0.5) * 0.18), age: 0, life: 0.75 + Math.random() * 0.8 });
      }
    } else this.accumulator = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i]; particle.age += dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt); particle.velocity.y += 0.05 * dt;
      particle.mesh.material.opacity = Math.max(0, 0.9 * (1 - particle.age / particle.life));
      if (particle.age >= particle.life) { this.group.remove(particle.mesh); particle.mesh.material.dispose(); this.particles.splice(i, 1); }
    }
  }
}

class Game {
  // three
  canvas = $<HTMLCanvasElement>("gl");
  renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: "high-performance" });
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 1, 0.05, 400);
  world = new World(1);
  soloRedstone = createSoloRedstoneRuntime({
    blockAt: (x, y, z) => this.world.get(x, y, z),
    setBlock: (x, y, z, blockId) => this.world.setBlock(x, y, z, blockId),
    ids: { source: B.REDSTONE_BLOCK, wire: B.REDSTONE_DUST, lampOff: B.REDSTONE_LAMP_OFF, lampOn: B.REDSTONE_LAMP_ON, leverOn: B.REDSTONE_LEVER_ON, repeaters: Array.from({ length: 16 }, (_, i) => B.REDSTONE_REPEATER + i) },
    maxNodes: 4096, maxSteps: 65536,
  });
  view = new ChunkView(this.world);
  sky = new Sky();
  remotes = new RemotePlayers();
  ownModel: PlayerModel | null = null;
  ownSkinKey = "";
  highlight: THREE.LineSegments;
  breakOverlay: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial[]>;
  breakTextures: THREE.Texture[] = [];
  atlas = createAtlasCanvas();
  drops = new DropEntities(this.atlas);
  mobModels = new MobModels();
  projectileEntities = new ProjectileEntities();
  effectParticles = new StatusParticles();
  private updatingSoloBlockBehaviors = false;
  private soloDropSeq = 0;

  // state
  state: State = "title";
  mode: "solo" | "room" = "solo";
  roomCode = "";
  private furnaceView: FurnaceView | null = null;
  myId = "";
  net = new Net();
  attackChargeFill: HTMLElement | null = null;
  lastAttackAt = Number.NEGATIVE_INFINITY;
  lastAttackItemId: number | null = null;
  profile: Profile = loadProfile();
  mobilePreferences = loadMobileControlPreferences();
  settings: PerformanceSettings = defaultPerformanceSettings();
  performanceTuner = new AdaptiveRenderDistanceTuner();

  body: Body = { x: 0.5, y: 60, z: 0.5, vx: 0, vy: 0, vz: 0, onGround: false };
  yaw = 0;
  pitch = 0;
  fly = false;
  thirdPerson = false;
  keys = new Set<string>();
  private physicalKeys = new Set<string>();
  private mobileKeys = new Set<string>();
  private mobileJoystickKeys = new Set<string>();
  private mobileButtonKeys = new Set<string>();
  mobileControls: HTMLDivElement | null = null;
  private mobileInputReset: (() => void) | null = null;
  private touchLookPointer: number | null = null;
  private touchLookX = 0;
  private touchLookY = 0;
  lastSpace = 0;
  hotbar: number[] = [...DEFAULT_HOTBAR];
  /** Java-style per-slot stacks; counts[] remains the authoritative legacy/server total. */
  mainInventory: number[] = new Array(27).fill(0);
  hotbarAmounts: number[] = new Array(9).fill(0);
  mainInventoryAmounts: number[] = new Array(27).fill(0);
  armorSlots: number[] = [0, 0, 0, 0];
  itemEnchantments: Record<string, Record<string, number>> = {};
  stackData: Record<string, any> = Object.create(null);
  elytraDamage = 0;
  useStartedAt = 0;
  fallFlying = false;
  lastElytraWearAt = 0;
  lastSentFallFlying = false;
  enchantUi: HTMLDivElement | null = null;
  armorAmounts: number[] = [0, 0, 0, 0];
  offhand = 0;
  offhandAmount = 0;
  craftGrid: number[] = new Array(4).fill(0);
  craftGridAmounts: number[] = new Array(4).fill(0);
  workbenchGrid: number[] = new Array(9).fill(0);
  workbenchGridAmounts: number[] = new Array(9).fill(0);
  workbenchOpen = false;
  workbenchPos: [number, number, number] | null = null;
  pendingCraftGrid: number[] | null = null;
  pendingCraftWorkbench = false;
  cursorItem = 0;
  cursorCount = 0;
  private lastInventoryClickAt = 0;
  private lastInventoryClickKey = "";
  sel = 0;
  // ゲームモード / ホスト
  gameMode: GameMode = "creative";
  selMode: GameMode = "creative"; // タイトル画面で選択中(ルーム作成用)
  isHost = false;
  kickMsg = "";
  bans: BanEntry[] = [];
  // サバイバル
  counts: number[] = new Array(BLOCKS.length).fill(0);
  health = MAX_HP;
  hunger = MAX_HUNGER;
  vitals: PlayerVitals = createVitals("creative");
  /** 空腹の消耗量の端数(1.0 たまるごとに満腹度が1減る) */
  exhaustion = 0;
  starveT = 0;
  regenT = 0;
  peakY = 0;
  wasGround = true;
  digKey = "";
  digT = 0;
  digReady = false;
  digToolId = -1;
  lastDeny = 0;
  lockReqAt = 0;
  lockRetries = 0;
  time = 0.05;
  clockOffset = 0;
  t0 = 0;
  target: RayHit | null = null;
  mouseL = false;
  mouseR = false;
  private fishingRightHeld = false;
  private localFishing: { id:string; x:number; y:number; z:number; state:"waiting"|"bite"; biteAt:number; rodItemId:number; slotKey:string; openWater:boolean } | null = null;
  lastBreak = 0;
  lastPlace = 0;
  pending = new Map<string, number>();
  lastSend = 0;
  lastSent = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  lastSentSneak = false;
  sneaking = false;
  eyeH = EYE_H;
  lastAutosave = 0;
  fps = 0;
  fpsAcc = 0;
  fpsN = 0;
  lastT = performance.now();
  loadStart = 0;
  loadingFor: "world" | "net" = "world";
  ready = false;

  hotbarUI: Hotbar;
  inventoryUI: MinecraftInventoryUI;
  chat = new Chat();
  spawn: [number, number, number] = [0.5, 40, 0.5];

  constructor() {
    this.chat.setNameProvider(() => [this.profile.name, ...this.remotes.names().map(p => p.name)]);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.add(this.view.group, this.sky.group, this.remotes.group, this.drops.group, this.mobModels.group, this.projectileEntities.group);
    this.scene.add(this.effectParticles.group);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0x000000 }),
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    // Java 26.3 の実テクスチャ（destroy_stage_0..9）を採掘進行に合わせて重ねる。
    const textureLoader = new THREE.TextureLoader();
    this.breakTextures = Array.from({ length: 10 }, (_, i) => {
      const texture = textureLoader.load(`/assets/minecraft/textures/block/destroy_stage_${i}.png`);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      return texture;
    });
    const crackMaterials = Array.from({ length: 6 }, () => new THREE.MeshBasicMaterial({
      map: this.breakTextures[0], transparent: true, alphaTest: 0.08, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide,
    }));
    this.breakOverlay = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), crackMaterials);
    this.breakOverlay.visible = false;
    this.breakOverlay.renderOrder = 5;
    this.scene.add(this.breakOverlay);

    try {
      const s = JSON.parse(getRaw(K_SETTINGS) || "null");
      if (s) this.settings = normalizePerformanceSettings(s);
    } catch { /* ignore */ }
    this.view.renderDistance = this.settings.rd;

    this.hotbarUI = new Hotbar(
      this.atlas,
      () => ({ hotbar: this.hotbar, sel: this.sel, count: (id) => this.countOf(id), stackData: this.stackData }),
      (i) => { this.sel = i; this.hotbarUI.refresh(); },
      (id) => {
        if (this.survival && this.counts[id] <= 0) return;
        this.setSlotValue({ type: "hotbar", index: this.sel }, id); this.hotbarUI.refresh(); toast(BLOCKS[id].name);
      },
    );
    this.inventoryUI = new MinecraftInventoryUI(this.atlas, (slot, event) => this.handleInventorySlotClick(slot, event));
    this.hotbarUI.refresh();
    this.atlas.addEventListener(ATLAS_READY_EVENT, () => { clearBlockIconCache(); this.hotbarUI.refresh(); }, { once: true });

    this.bindUI();
    this.bindInput();
    this.initAttackHud();
    addEventListener("resize", () => this.resize());
    this.resize();
    addEventListener("beforeunload", () => this.autosave(true));
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  /** サバイバルはルーム作成時にモードを選んだ場合のみ(ソロは常にクリエイティブ) */
  get survival() { return this.mode === "room" && (this.gameMode === "survival" || this.gameMode === "adventure"); }
  /** ブロックの所持数。null = 無限(クリエイティブ) */
  countOf(id: number): number | null { return this.survival ? this.counts[id] ?? 0 : null; }

  // ------------------------------------------------------------ UI wiring
  bindUI() {
    const nameEl = $<HTMLInputElement>("name");
    const preview = $("skinpreview") as HTMLCanvasElement;
    const skinFile = $("skinfile") as HTMLInputElement;
    const skinModel = $("skinmodel") as HTMLSelectElement;
    const skinStatus = $("skinstatus");
    const applySkin = (s: Skin) => {
      const next: Skin = {
        ...DEFAULT_SKIN,
        ...s,
        image: s.image ?? DEFAULT_SKIN_IMAGE,
        model: s.model === "slim" ? "slim" : "classic",
      };
      this.profile.skin = next;
      skinModel.value = next.model ?? "classic";
      skinStatus.textContent = s.image
        ? `Minecraftスキン適用中（64×64 / ${skinModel.value === "slim" ? "スリム" : "クラシック"}）`
        : "初期Minecraftスキンを使用中。PNGをアップロードして変更できます";
      drawSkinPreview(preview, next);
    };
    const NAME_BAD = /[^A-Za-z0-9_]/g;
    nameEl.value = this.profile.name.replace(NAME_BAD, "").slice(0, 16);
    // 使えない文字(空白・記号・日本語など)は入力した時点で取り除く。IME変換中は触らない。
    const filterName = () => { const f = nameEl.value.replace(NAME_BAD, ""); if (f !== nameEl.value) nameEl.value = f; };
    nameEl.addEventListener("input", (e) => { if (!(e as InputEvent).isComposing) filterName(); });
    nameEl.addEventListener("compositionend", filterName);
    applySkin(this.profile.skin);
    saveProfile(this.profile);
    skinModel.addEventListener("change", () => {
      this.profile.skin.model = skinModel.value === "slim" ? "slim" : "classic";
      skinStatus.textContent = `Minecraftスキン適用中（64×64 / ${skinModel.value === "slim" ? "スリム" : "クラシック"}）`;
      drawSkinPreview(preview, this.profile.skin);
      saveProfile(this.profile);
    });
    $("skinclear").addEventListener("click", () => {
      applySkin({ ...DEFAULT_SKIN, image: DEFAULT_SKIN_IMAGE, model: "classic" });
      skinFile.value = "";
      saveProfile(this.profile);
    });
    skinFile.addEventListener("change", async () => {
      const file = skinFile.files?.[0];
      if (!file) return;
      try {
        const image = await readMinecraftSkin(file);
        this.profile.skin = { ...this.profile.skin, image };
        skinStatus.textContent = `Minecraftスキン適用中（64×64 / ${skinModel.value === "slim" ? "スリム" : "クラシック"}）`;
        drawSkinPreview(preview, this.profile.skin);
        saveProfile(this.profile);
      } catch (e) {
        skinFile.value = "";
        skinStatus.textContent = (e as Error).message || "スキンを読み込めませんでした";
      }
    });

    const solo = loadSolo();
    if (solo) {
      $("btn-solo").textContent = "ソロ: 続きから";
      $("btn-solo-new").hidden = false;
    }
    /** 名前を検証する。空・使えない文字ならエラーを出して false(ゲームには入れない) */
    const prep = (): boolean => {
      const name = validateName(nameEl.value);
      if (!name) {
        $("titleerr").textContent = nameEl.value === "" ? "名前を入力してください(半角英数字と _ のみ)" : NAME_RULE;
        nameEl.focus();
        return false;
      }
      this.profile.name = name;
      saveProfile(this.profile);
      $("titleerr").textContent = "";
      return true;
    };
    $("btn-solo").addEventListener("click", () => { if (prep()) this.startSolo(false); });
    $("btn-solo-new").addEventListener("click", () => {
      if (!prep()) return;
      if (confirm("保存済みのソロワールドを破棄して新しく始めますか？")) { deleteSolo(); this.startSolo(true); }
    });
    const modeBtns = Array.from(document.querySelectorAll<HTMLButtonElement>("#modesel .seg button"));
    for (const btn of modeBtns) {
      btn.addEventListener("click", () => {
        this.selMode = (btn.dataset.mode as GameMode) || "creative";
        for (const b of modeBtns) b.classList.toggle("on", b === btn);
        $("modedesc").textContent = MODE_DESC[this.selMode];
      });
    }
    $("btn-create").addEventListener("click", async () => {
      if (!prep()) return;
      try {
        this.showLoading("ルームを作成中…");
        const { code, hostToken } = await createRoom(this.selMode);
        saveHostToken(code, hostToken); // 作成者だけがホスト権限を持つ
        await this.startRoom(code);
      } catch (e) { this.backToTitle((e as Error).message); }
    });
    const join = async () => {
      if (!prep()) return;
      const code = $<HTMLInputElement>("joincode").value.trim().toUpperCase();
      if (code.length !== 6) { $("titleerr").textContent = "6文字のルームコードを入力してください"; return; }
      try { this.showLoading("ルームを確認中…"); await checkRoom(code); await this.startRoom(code); }
      catch (e) { this.backToTitle((e as Error).message); }
    };
    $("btn-join").addEventListener("click", join);
    $("joincode").addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Enter") join(); });
    const hash = location.hash.replace("#", "").trim().toUpperCase();
    if (/^[A-Z0-9]{6}$/.test(hash)) $<HTMLInputElement>("joincode").value = hash;

    // ポーズメニュー
    $("btn-resume").addEventListener("click", () => this.requestLock());
    $("btn-save").addEventListener("click", () => this.manualSave());
    $("btn-load").addEventListener("click", () => this.manualLoad());
    $("btn-quit").addEventListener("click", () => this.quit());
    $("btn-admin").addEventListener("click", () => this.openAdmin());
    $("btn-admin-close").addEventListener("click", () => this.closeAdmin());
    $("btn-copycode").addEventListener("click", () => this.copyLink());
    $("copylink").addEventListener("click", () => this.copyLink());
    const rd = $<HTMLInputElement>("rd"), sens = $<HTMLInputElement>("sens");
    const quality = $<HTMLSelectElement>("quality-level"), autoOptimize = $<HTMLInputElement>("auto-optimize");
    const entityDistance = $<HTMLInputElement>("entity-distance");
    const mobileLookSensitivity = $<HTMLInputElement>("mobile-look-sensitivity");
    const mobileHandedness = $<HTMLSelectElement>("mobile-handedness");
    rd.value = String(this.settings.rd); sens.value = String(this.settings.sens);
    quality.value = String(this.settings.profile); autoOptimize.checked = this.settings.autoOptimize;
    entityDistance.value = String(this.settings.entityRenderDistance);
    mobileLookSensitivity.value = String(this.mobilePreferences.lookSensitivity);
    mobileHandedness.value = this.mobilePreferences.handedness;
    $("mobile-look-sensitivity-value").textContent = `${this.mobilePreferences.lookSensitivity.toFixed(1)}×`;
    const syncSettings = (manualDistance = false) => {
      this.settings = normalizePerformanceSettings({
        ...this.settings,
        rd: Number(rd.value), sens: Number(sens.value), entityRenderDistance: Number(entityDistance.value),
        profile: manualDistance ? "custom" : this.settings.profile,
        autoOptimize: manualDistance ? false : this.settings.autoOptimize,
      });
      if (manualDistance) this.performanceTuner.reset();
      rd.value = String(this.settings.rd); sens.value = String(this.settings.sens);
      entityDistance.value = String(this.settings.entityRenderDistance);
      quality.value = String(this.settings.profile); autoOptimize.checked = this.settings.autoOptimize;
      $("rdval").textContent = String(this.settings.rd); $("sensval").textContent = String(this.settings.sens);
      $("entity-distance-val").textContent = String(this.settings.entityRenderDistance);
      this.view.renderDistance = this.settings.rd;
      const visualBudgetNote = `現設定: Mob描画距離 ${this.settings.entityRenderDistance}ブロック、チャンク生成 ${this.settings.chunkGenBudget}・メッシュ化 ${this.settings.chunkMeshBudget}件/フレーム。`;
      $("quality-note").textContent = this.settings.autoOptimize
        ? `${visualBudgetNote} FPS自動調整は描画距離のみ。Mob表示はクライアント側だけで、サーバーAIやスポーンには影響しません。`
        : `${visualBudgetNote} Mob描画距離は表示だけを調整し、Mob AIなどサーバーシミュレーションには影響しません。`;
      try { localStorage.setItem(K_SETTINGS, JSON.stringify(this.settings)); } catch { /* 保存できない環境 */ }
    };
    const syncMobilePreferences = () => {
      this.mobilePreferences = normalizeMobileControlPreferences({
        lookSensitivity: Number(mobileLookSensitivity.value),
        handedness: mobileHandedness.value,
      });
      mobileLookSensitivity.value = String(this.mobilePreferences.lookSensitivity);
      mobileHandedness.value = this.mobilePreferences.handedness;
      $("mobile-look-sensitivity-value").textContent = `${this.mobilePreferences.lookSensitivity.toFixed(1)}×`;
      this.mobileControls?.classList.toggle("is-left-handed", this.mobilePreferences.handedness === "left");
      saveMobileControlPreferences(this.mobilePreferences);
    };
    mobileLookSensitivity.addEventListener("input", syncMobilePreferences);
    mobileHandedness.addEventListener("change", syncMobilePreferences);
    rd.addEventListener("input", () => syncSettings(true));
    entityDistance.addEventListener("input", () => syncSettings(true));
    sens.addEventListener("input", () => syncSettings(false));
    quality.addEventListener("change", () => {
      if (quality.value === "custom") {
        this.settings = { ...this.settings, profile: "custom" };
        syncSettings(false);
        return;
      }
      this.settings = applyPerformanceLevel(this.settings, Number(quality.value));
      rd.value = String(this.settings.rd);
      this.performanceTuner.reset();
      syncSettings(false);
    });
    autoOptimize.addEventListener("change", () => {
      this.settings = { ...this.settings, autoOptimize: autoOptimize.checked };
      this.performanceTuner.reset();
      syncSettings(false);
    });
    syncSettings(false);

    // チャット入力
    const ci = $<HTMLInputElement>("chatinput");
    ci.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        if (e.isComposing || e.keyCode === 229) return; // 日本語入力の変換確定の Enter では送信しない
        const text = ci.value.trim();
        if (text) {
          if (this.mode === "room") this.net.send({ t: "chat", text });
          else if (text.startsWith("/")) this.runSoloCommand(text);
          else this.chat.add(text, this.profile.name);
        }
        this.closeChat(true);
      } else if (e.key === "Escape") { e.preventDefault(); this.closeChat(true); }
    });
  }

  copyLink() {
    const url = `${location.origin}/#${this.roomCode}`;
    navigator.clipboard?.writeText(url).then(() => toast("招待リンクをコピーしました"), () => toast(`コード: ${this.roomCode}`));
  }

  // ------------------------------------------------------------ input
  initAttackHud() {
    const hud = document.createElement("div");
    hud.id = "attack-charge";
    hud.innerHTML = '<span>攻撃チャージ</span><div class="attack-meter"><i></i></div>';
    document.body.appendChild(hud);
    this.attackChargeFill = hud.querySelector("i");
  }

  updateAttackCharge(now: number) {
    const held = this.hotbar[this.sel] ?? 0;
    const weapon = weaponStatsForItemId(held, BLOCKS);
    const chargeTicks = attackDelayTicks(weapon.kind);
    if (this.lastAttackItemId === null) {
      this.lastAttackItemId = held;
      this.lastAttackAt = now - chargeTicks * 50;
    } else if (this.lastAttackItemId !== held) {
      this.lastAttackItemId = held;
      this.lastAttackAt = now;
    }
    const charge = attackChargeProgress((now - this.lastAttackAt) / 50, chargeTicks);
    if (this.attackChargeFill) this.attackChargeFill.style.width = `${Math.round(charge * 100)}%`;
    return charge;
  }

  attackMob(mobId: string, now: number) {
    const heldItemId = this.hotbar[this.sel] ?? 0;
    this.updateAttackCharge(now);
    this.net.send({ t: "attack", mobId, heldItemId, slotKey: `hotbar:${this.sel}` });
    this.lastAttackAt = now;
    this.lastAttackItemId = heldItemId;
    this.updateAttackCharge(now);
  }

  bindInput() {
    const touchCapable = shouldUseTouchControls({
      coarsePointer: typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches,
      maxTouchPoints: typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0,
    });
    if (touchCapable) this.installMobileControls();
    document.addEventListener("pointerlockchange", () => {
      const locked = document.pointerLockElement === this.canvas;
      if (locked) {
        this.lockRetries = 0;
        if (this.state === "paused") { this.state = "playing"; $("pause").hidden = true; $("admin").hidden = true; }
      } else if (this.state === "playing") this.openPause("一時停止");
    });
    document.addEventListener("pointerlockerror", () => this.onLockError());
    this.canvas.addEventListener("click", () => { if (!this.mobileControls && this.state === "playing" && document.pointerLockElement !== this.canvas) this.requestLock(); });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    if (touchCapable) {
      this.canvas.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" || this.state !== "playing" || this.touchLookPointer !== null) return;
        this.touchLookPointer = e.pointerId;
        this.touchLookX = e.clientX; this.touchLookY = e.clientY;
        try { this.canvas.setPointerCapture(e.pointerId); } catch { /* capture may be unavailable in embedded browsers */ }
        e.preventDefault();
      });
      this.canvas.addEventListener("pointermove", (e) => {
        if (e.pointerId !== this.touchLookPointer || this.state !== "playing") return;
        const dx = e.clientX - this.touchLookX, dy = e.clientY - this.touchLookY;
        this.touchLookX = e.clientX; this.touchLookY = e.clientY;
        const k = this.settings.sens * 0.003 * this.mobilePreferences.lookSensitivity;
        this.yaw -= dx * k;
        this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - dy * k));
        e.preventDefault();
      });
      const finishLook = (e: PointerEvent) => { if (e.pointerId === this.touchLookPointer) this.touchLookPointer = null; };
      this.canvas.addEventListener("pointerup", finishLook);
      this.canvas.addEventListener("pointercancel", finishLook);
      this.canvas.addEventListener("lostpointercapture", finishLook);
    }

    addEventListener("mousemove", (e) => {
      if (this.state !== "playing" || document.pointerLockElement !== this.canvas) return;
      const k = this.settings.sens * 0.0005;
      this.yaw -= e.movementX * k;
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - e.movementY * k));
    });
    this.canvas.addEventListener("mousedown", (e) => {
      if (this.enchantUi || this.state !== "playing" || document.pointerLockElement !== this.canvas) return;
      e.preventDefault();
      if (e.button === 0) {
        const held = this.hotbar[this.sel] ?? 0;
        const target = this.mode === "room" && this.net.connected ? this.mobModels.target(this.camera, weaponReachForItemId(held, BLOCKS)) : null;
        if (target) this.attackMob(target, performance.now());
        else this.beginPrimaryAction();
      }
      else if (e.button === 2) this.beginSecondaryAction();
      else if (e.button === 1) this.doPick();
    });
    addEventListener("mouseup", (e) => { if (e.button === 0) this.endPrimaryAction(); if (e.button === 2) { this.endSecondaryAction(); this.fishingRightHeld = false; } });
    addEventListener("wheel", (e) => {
      if (this.state !== "playing") return;
      this.sel = wrapHotbarIndex(this.sel, e.deltaY > 0 ? 1 : -1);
      this.hotbarUI.refresh();
      this.showHeld();
    }, { passive: true });
    const clearTransientInput = () => {
      this.resetMobileInputState();
      this.keys.clear(); this.physicalKeys.clear(); this.mobileKeys.clear();
      this.mobileJoystickKeys.clear(); this.mobileButtonKeys.clear();
      this.touchLookPointer = null; this.mouseL = this.mouseR = false; this.fishingRightHeld = false;
    };
    addEventListener("blur", clearTransientInput);
    addEventListener("pagehide", clearTransientInput);
    document.addEventListener("visibilitychange", () => { if (document.hidden) clearTransientInput(); });

    addEventListener("keydown", (e) => {
      if (this.enchantUi) { if (e.code === "Escape") { e.preventDefault(); this.closeEnchantingTable(); } return; }
      if (this.state === "title" || this.state === "loading") return;
      if (this.state === "chat") return;
      if (e.code === "Tab") { e.preventDefault(); if (this.mode === "room") this.showPlayers(true); return; }
      if (this.state === "furnace") {
        if (e.code === "KeyE" || e.code === "Escape") { e.preventDefault(); this.closeFurnace(); }
        return;
      }
      if (this.state === "inventory") {
        if (e.code === "KeyE" || e.code === "Escape") { e.preventDefault(); this.closeInventory(); }
        return;
      }
      if (this.state === "paused") {
        if (e.code === "Escape" && !e.repeat) {
          e.preventDefault();
          if (!$("admin").hidden) this.closeAdmin();
          else { this.lockReqAt = 0; this.tryLock(); } // Esc はユーザー操作扱いにならない場合がある → 失敗したらクリックを案内
        }
        return;
      }
      if (this.state !== "playing") return;
      // 通常は Esc でポインタロックが解除され pointerlockchange からメニューが開く。
      // ロックを持っていない状態で Esc が届いた場合のフォールバック。
      if (e.code === "Escape") { e.preventDefault(); this.openPause("一時停止"); return; }
      if (e.repeat) { this.physicalKeys.add(e.code); this.keys.add(e.code); return; }
      this.physicalKeys.add(e.code); this.keys.add(e.code);
      if (/^Digit[1-9]$/.test(e.code)) { this.sel = +e.code.slice(5) - 1; this.hotbarUI.refresh(); this.showHeld(); }
      else if (e.code === "KeyE") { e.preventDefault(); this.openInventory(); }
      else if (e.code === "KeyT" || e.code === "Enter" || e.code === "NumpadEnter") { e.preventDefault(); this.openChat(); }
      else if (e.code === "KeyV") { this.thirdPerson = !this.thirdPerson; toast(this.thirdPerson ? "三人称視点" : "一人称視点"); }
      else if (e.code === "Space") {
        const elytraId = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:elytra"] ?? 0;
        if (!this.body.onGround && this.body.vy < -0.05 && this.armorSlots[1] === elytraId && this.elytraDamage < 432 && !this.fallFlying) {
          this.fallFlying = true;
          this.body.vy = Math.max(this.body.vy, -2.5);
          toast("エリトラ滑空開始");
        } else {
          const now = performance.now();
          if (now - this.lastSpace < 300) {
            if (this.survival) toast("サバイバルでは飛べません");
            else { this.fly = !this.fly; this.fallFlying = false; this.body.vy = 0; toast(this.fly ? "飛行モード ON" : "飛行モード OFF"); }
          }
          this.lastSpace = now;
        }
      }
    });
    addEventListener("keyup", (e) => {
      this.physicalKeys.delete(e.code);
      if (!this.mobileKeys.has(e.code)) this.keys.delete(e.code);
      if (e.code === "Tab") this.showPlayers(false);
    });
  }

  beginPrimaryAction() {
    if (this.state !== "playing") return;
    const held = this.hotbar[this.sel] ?? 0;
    const target = this.mode === "room" && this.net.connected ? this.mobModels.target(this.camera, weaponReachForItemId(held, BLOCKS)) : null;
    if (target) this.attackMob(target, performance.now());
    else {
      this.mouseL = true;
      if (!this.survival) { this.doBreak(); this.lastBreak = performance.now(); }
    }
  }
  endPrimaryAction() { this.mouseL = false; }
  beginSecondaryAction() {
    if (this.state !== "playing") return;
    this.mouseR = true; this.doPlace(); this.lastPlace = performance.now();
  }
  endSecondaryAction() { this.mouseR = false; }

  private syncMobileKeys() {
    const next = new Set([...this.mobileJoystickKeys, ...this.mobileButtonKeys]);
    for (const code of this.mobileKeys) if (!next.has(code) && !this.physicalKeys.has(code)) this.keys.delete(code);
    for (const code of next) this.keys.add(code);
    this.mobileKeys = next;
  }
  private setMobileButtonKey(code: string, pressed: boolean) {
    if (pressed) this.mobileButtonKeys.add(code); else this.mobileButtonKeys.delete(code);
    this.syncMobileKeys();
  }

  private resetMobileInputState() {
    this.mobileInputReset?.();
    this.mobileJoystickKeys.clear();
    this.mobileButtonKeys.clear();
    this.touchLookPointer = null;
    this.mouseL = this.mouseR = false;
    this.syncMobileKeys();
  }

  installMobileControls() {
    if (this.mobileControls) return;
    const root = document.createElement("div");
    root.id = "mobile-controls";
    root.classList.toggle("is-left-handed", this.mobilePreferences.handedness === "left");
    root.setAttribute("aria-label", "モバイル操作パネル");
    root.hidden = true;

    const joystick = document.createElement("div");
    joystick.id = "mobile-joystick";
    joystick.setAttribute("role", "group");
    joystick.setAttribute("aria-label", "移動スティック。上下左右に動かして移動");
    joystick.setAttribute("tabindex", "-1");
    const stick = document.createElement("span");
    stick.id = "mobile-stick-thumb";
    stick.setAttribute("aria-hidden", "true");
    joystick.appendChild(stick);

    const actions = document.createElement("div");
    actions.id = "mobile-actions";
    actions.setAttribute("aria-label", "ゲーム操作");
    const makeButton = (label: string, aria: string, extraClass = "") => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `mobile-action ${extraClass}`.trim();
      b.textContent = label;
      b.setAttribute("aria-label", aria);
      b.title = aria;
      actions.appendChild(b);
      return b;
    };

    const releaseCapture = (element: Element, pointerId: number) => {
      try {
        const target = element as Element & { hasPointerCapture?: (id: number) => boolean; releasePointerCapture?: (id: number) => void };
        if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture?.(pointerId);
      } catch { /* capture may already have been released by the browser */ }
    };
    const activeHoldReleases = new Set<() => void>();
    const bindHold = (button: HTMLButtonElement, start: () => void, stop: () => void) => {
      let activePointer: number | null = null;
      let releaseCurrent: (() => void) | null = null;
      const release = (pointerId: number) => {
        if (activePointer !== pointerId) return;
        activePointer = null;
        if (releaseCurrent) activeHoldReleases.delete(releaseCurrent);
        releaseCurrent = null;
        releaseCapture(button, pointerId);
        stop();
      };
      const down = (e: PointerEvent) => {
        if (this.state !== "playing" || activePointer !== null) return;
        e.preventDefault(); e.stopPropagation();
        activePointer = e.pointerId;
        try { button.setPointerCapture(e.pointerId); } catch { /* capture is optional on embedded browsers */ }
        const pointerId = e.pointerId;
        const releaseOnce = () => release(pointerId);
        releaseCurrent = releaseOnce;
        activeHoldReleases.add(releaseOnce);
        start();
      };
      const up = (e: PointerEvent) => { if (activePointer === e.pointerId) release(e.pointerId); };
      button.addEventListener("pointerdown", down);
      button.addEventListener("pointerup", up);
      button.addEventListener("pointercancel", up);
      button.addEventListener("lostpointercapture", up);
      button.addEventListener("contextmenu", (e) => e.preventDefault());
    };
    const bindTap = (button: HTMLButtonElement, run: () => void) => button.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      if (this.state === "playing") run();
    });

    let joystickPointer: number | null = null;
    const resetJoystick = () => {
      const pointerId = joystickPointer;
      joystickPointer = null;
      if (pointerId !== null) releaseCapture(joystick, pointerId);
      this.mobileJoystickKeys.clear();
      this.syncMobileKeys();
      stick.style.transform = "translate(0px, 0px)";
    };
    const moveJoystick = (e: PointerEvent) => {
      if (joystickPointer !== e.pointerId || this.state !== "playing") return;
      const rect = joystick.getBoundingClientRect();
      const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.34);
      const rawX = e.clientX - (rect.left + rect.width / 2);
      const rawY = e.clientY - (rect.top + rect.height / 2);
      const { x: dx, y: dy } = clampJoystickDisplacement(rawX, rawY, radius);
      stick.style.transform = `translate(${dx}px, ${dy}px)`;
      this.mobileJoystickKeys = new Set(joystickKeyCodes(dx, dy, radius));
      this.syncMobileKeys();
      e.preventDefault();
    };
    joystick.addEventListener("pointerdown", (e) => {
      if (this.state !== "playing" || e.pointerType === "mouse" || joystickPointer !== null) return;
      e.preventDefault(); e.stopPropagation();
      joystickPointer = e.pointerId;
      try { joystick.setPointerCapture(e.pointerId); } catch { /* pointer capture is optional */ }
      moveJoystick(e);
    });
    joystick.addEventListener("pointermove", moveJoystick);
    joystick.addEventListener("pointerup", (e) => { if (e.pointerId === joystickPointer) resetJoystick(); });
    joystick.addEventListener("pointercancel", (e) => { if (e.pointerId === joystickPointer) resetJoystick(); });
    joystick.addEventListener("lostpointercapture", (e) => { if (e.pointerId === joystickPointer) resetJoystick(); });

    this.mobileInputReset = () => {
      for (const release of [...activeHoldReleases]) release();
      activeHoldReleases.clear();
      resetJoystick();
      const lookPointer = this.touchLookPointer;
      this.touchLookPointer = null;
      if (lookPointer !== null) releaseCapture(this.canvas, lookPointer);
      this.endPrimaryAction();
      this.endSecondaryAction();
      this.mobileJoystickKeys.clear();
      this.mobileButtonKeys.clear();
      this.syncMobileKeys();
    };

    const jump = makeButton("ジャンプ", "ジャンプ。クリエイティブでは素早く2回押すと飛行切替", "jump");
    bindHold(jump, () => {
      const now = performance.now();
      if (now - this.lastSpace < 300) {
        if (this.survival) toast("サバイバルでは飛べません");
        else { this.fly = !this.fly; this.body.vy = 0; toast(this.fly ? "飛行モード ON" : "飛行モード OFF"); }
      }
      this.lastSpace = now;
      this.setMobileButtonKey("Space", true);
    }, () => this.setMobileButtonKey("Space", false));
    // The current movement core maps Shift to sprint, not crouch; label the action accurately.
    const sprint = makeButton("ダッシュ", "押している間ダッシュ。サバイバルでは空腹度により制限", "sprint");
    bindHold(sprint, () => this.setMobileButtonKey("ShiftLeft", true), () => this.setMobileButtonKey("ShiftLeft", false));
    const primary = makeButton("掘る / 攻撃", "ブロックを採掘、またはMobを攻撃", "primary");
    bindHold(primary, () => this.beginPrimaryAction(), () => this.endPrimaryAction());
    const secondary = makeButton("使う / 設置", "選択中のブロックを設置・使用", "secondary");
    bindHold(secondary, () => this.beginSecondaryAction(), () => this.endSecondaryAction());
    const inventory = makeButton("持ち物", "インベントリを開く", "utility");
    bindTap(inventory, () => this.openInventory());
    const pause = makeButton("一時停止", "一時停止メニューを開く", "utility");
    bindTap(pause, () => this.openPause("一時停止"));

    root.append(joystick, actions);
    document.body.appendChild(root);
    this.mobileControls = root;
  }

  /** クリック等のユーザー操作から呼ぶ。失敗しても数回は自動で再試行する。 */
  requestLock() {
    if (this.mobileControls) {
      this.state = "playing";
      $("pause").hidden = true; $("admin").hidden = true;
      this.syncMobileKeys();
      return;
    }
    this.lockReqAt = performance.now();
    this.lockRetries = 0;
    this.tryLock();
  }

  tryLock() {
    try {
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => { /* 失敗は pointerlockerror で処理 */ });
    } catch { /* ignore */ }
  }

  onLockError() {
    if (this.state === "playing") { this.openPause("一時停止"); return; }
    if (this.state !== "paused") return;
    // Chrome は Esc で解除した直後(約1秒)のロック要求を拒否する。クリック直後なら少し待って自動再試行する。
    if (this.lockRetries < 3 && performance.now() - this.lockReqAt < 4000) {
      this.lockRetries++;
      setTimeout(() => { if (this.state === "paused") this.tryLock(); }, 1100);
    } else {
      $("pausemsg").textContent = "マウスをロックできませんでした。もう一度「ゲームに戻る」をクリックしてください";
    }
  }

  showHeld() { const id = this.hotbar[this.sel]; if (id) toast(BLOCKS[id].name); }

  showPlayers(show: boolean) {
    const el = $("playerlist");
    el.hidden = !show;
    if (!show) return;
    el.innerHTML = "<h3>プレイヤー</h3>";
    const add = (n: string) => { const d = document.createElement("div"); d.textContent = n; el.appendChild(d); };
    add(this.profile.name + "（あなた）");
    for (const p of this.remotes.names()) add(p.name);
  }

  openPause(title: string) {
    if (this.state === "title" || this.state === "loading") return;
    this.resetMobileInputState();
    this.state = "paused";
    this.mouseL = this.mouseR = false;
    this.keys.clear();
    $("pausetitle").textContent = title;
    $("btn-load").hidden = false;
    $("btn-copycode").hidden = this.mode !== "room";
    $("btn-quit").textContent = this.mode === "room" ? "サーバーを抜ける" : "タイトルへ戻る";
    $("btn-admin").hidden = !(this.mode === "room" && this.isHost);
    $("admin").hidden = true;
    $("pausemsg").textContent = this.pauseText();
    $("pause").hidden = false;
  }
  pauseText() {
    return this.mode === "room"
      ? `ルーム ${this.roomCode}・${MODE_NAME[this.gameMode]}${this.isHost ? "・あなたはホスト" : ""}（ワールドはサーバーに自動保存）`
      : "ソロワールド（ブラウザに保存）";
  }

  // ---- サーバー管理(ホスト専用。権限はサーバー側でも検証される) ----
  openAdmin() {
    if (!this.isHost || this.mode !== "room") return;
    $("admin").hidden = false;
    this.net.send({ t: "bans" });
    this.renderAdmin();
  }
  closeAdmin() { $("admin").hidden = true; }

  renderAdmin() {
    const row = (name: string, tag: string, btns: [string, string, () => void][]) => {
      const r = document.createElement("div");
      r.className = "arow";
      const n = document.createElement("span");
      n.className = "nm"; n.textContent = name;
      r.appendChild(n);
      if (tag) { const t = document.createElement("span"); t.className = "tag"; t.textContent = tag; r.appendChild(t); }
      for (const [label, cls, fn] of btns) {
        const b = document.createElement("button");
        b.textContent = label; if (cls) b.className = cls;
        b.addEventListener("click", fn);
        r.appendChild(b);
      }
      return r;
    };
    const empty = (text: string) => { const d = document.createElement("div"); d.className = "empty"; d.textContent = text; return d; };

    const pl = $("adminplayers");
    pl.textContent = "";
    pl.appendChild(row(this.profile.name, "あなた（ホスト）", []));
    const others = this.remotes.names();
    if (!others.length) pl.appendChild(empty("他のプレイヤーはいません"));
    for (const p of others) {
      if (p.host) { pl.appendChild(row(p.name, "ホスト", [])); continue; }
      pl.appendChild(row(p.name, "", [
        ["キック", "", () => { this.net.send({ t: "kick", id: p.id }); toast(`${p.name} をキックしました`); }],
        ["BAN", "ban", () => { if (confirm(`${p.name} をBANしますか？\n(同じ端末・回線からは再入室できなくなります)`)) { this.net.send({ t: "ban", id: p.id }); toast(`${p.name} をBANしました`); } }],
      ]));
    }
    const bl = $("adminbans");
    bl.textContent = "";
    if (!this.bans.length) bl.appendChild(empty("BANされているプレイヤーはいません"));
    for (const b of this.bans) bl.appendChild(row(b.name, "", [["解除", "", () => this.net.send({ t: "unban", bid: b.bid })]]));
  }

  private validInventoryId(id: number): boolean { return Number.isInteger(id) && id > 0 && id < BLOCKS.length && !!BLOCKS[id]; }

  private maxStackSize(id: number): number { return maxStackSizeForItemKey(BLOCKS[id]?.key ?? ""); }

  private maxInventoryCount(id: number): number { return maxInventoryCountForItemKey(BLOCKS[id]?.key ?? ""); }

  private storageCapacity(id: number, incoming: any = null): number {
    return inventoryStorageCapacity(this.stackData, id, BLOCKS, this.counts[id] ?? 0, incoming);
  }

  private craftOutputMaxCount(id: number): number {
    return Math.max(0, (this.counts[id] ?? 0) + this.storageCapacity(id, null));
  }

  private slotValue(slot: InventorySlotRef): number {
    if (slot.type === "hotbar") return this.hotbar[slot.index] ?? 0;
    if (slot.type === "main") return this.mainInventory[slot.index] ?? 0;
    if (slot.type === "armor") return this.armorSlots[slot.index] ?? 0;
    if (slot.type === "craft") return this.craftGrid[slot.index] ?? 0;
    if (slot.type === "craft-table") return this.workbenchGrid[slot.index] ?? 0;
    return this.offhand;
  }

  private slotAmount(slot: InventorySlotRef): number {
    if (slot.type === "hotbar") return this.hotbarAmounts[slot.index] ?? 0;
    if (slot.type === "main") return this.mainInventoryAmounts[slot.index] ?? 0;
    if (slot.type === "armor") return this.armorAmounts[slot.index] ?? 0;
    if (slot.type === "craft") return this.craftGridAmounts[slot.index] ?? 0;
    if (slot.type === "craft-table") return this.workbenchGridAmounts[slot.index] ?? 0;
    return this.offhandAmount;
  }

  private setSlotStack(slot: InventorySlotRef, id: number, amount: number) {
    const value = this.validInventoryId(id) && amount > 0 ? id : 0;
    const count = value ? Math.min(slot.type === "armor" || slot.type === "offhand" ? 1 : this.maxStackSize(value), Math.max(0, Math.floor(amount))) : 0;
    const key = slotKey(slot.type, slot.index);
    const oldId = this.slotValue(slot);
    if (key && (value === 0 || oldId !== value)) delete this.stackData[key];
    if (key && value > 0 && oldId === value && this.stackData[key]) this.stackData[key] = { ...this.stackData[key], count };
    if (slot.type === "hotbar") { this.hotbar[slot.index] = value; this.hotbarAmounts[slot.index] = count; }
    else if (slot.type === "main") { this.mainInventory[slot.index] = value; this.mainInventoryAmounts[slot.index] = count; }
    else if (slot.type === "armor") { this.armorSlots[slot.index] = value; this.armorAmounts[slot.index] = count; }
    else if (slot.type === "craft") { this.craftGrid[slot.index] = value; this.craftGridAmounts[slot.index] = count; }
    else if (slot.type === "craft-table") { this.workbenchGrid[slot.index] = value; this.workbenchGridAmounts[slot.index] = count; }
    else { this.offhand = value; this.offhandAmount = count; }
  }

  private setSlotValue(slot: InventorySlotRef, id: number) {
    this.setSlotStack(slot, id, id > 0 ? (slot.type === "armor" || slot.type === "offhand" ? 1 : this.survival ? 1 : this.maxStackSize(id)) : 0);
  }

  private inventorySlotValid(slot: InventorySlotRef, id: number): boolean {
    if (!this.validInventoryId(id)) return true;
    if (slot.type === "armor") return armorSlotForItemId(id, BLOCKS) === slot.index;
    if (slot.type === "offhand") return true;
    return true;
  }

  private firstEmptyInventorySlot(types: ("main" | "hotbar")[] = ["main", "hotbar"]): InventorySlotRef | null {
    for (const type of types) {
      const values = type === "main" ? this.mainInventory : this.hotbar;
      const index = values.indexOf(0);
      if (index >= 0) return { type, index };
    }
    return null;
  }

  private inventorySlots(types: InventorySlotType[] = ["hotbar", "main"]): InventorySlotRef[] {
    const slots: InventorySlotRef[] = [];
    for (const type of types) {
      const length = type === "hotbar" ? 9 : type === "main" ? 27 : type === "armor" || type === "craft" ? 4 : type === "craft-table" ? 9 : 1;
      for (let index = 0; index < length; index++) slots.push({ type, index });
    }
    return slots;
  }

  /** Reconcile saved per-slot stacks with the legacy aggregate counts, including old saves. */
  private syncInventorySlots() {
    this.hotbarAmounts = Array.isArray(this.hotbarAmounts) && this.hotbarAmounts.length === 9 ? this.hotbarAmounts : new Array(9).fill(0);
    this.mainInventoryAmounts = Array.isArray(this.mainInventoryAmounts) && this.mainInventoryAmounts.length === 27 ? this.mainInventoryAmounts : new Array(27).fill(0);
    this.armorAmounts = Array.isArray(this.armorAmounts) && this.armorAmounts.length === 4 ? this.armorAmounts : [0, 0, 0, 0];
    this.craftGrid = Array.isArray(this.craftGrid) && this.craftGrid.length === 4 ? this.craftGrid : [0, 0, 0, 0];
    this.craftGridAmounts = Array.isArray(this.craftGridAmounts) && this.craftGridAmounts.length === 4 ? this.craftGridAmounts : [0, 0, 0, 0];
    this.workbenchGrid = Array.isArray(this.workbenchGrid) && this.workbenchGrid.length === 9 ? this.workbenchGrid : Array(9).fill(0);
    this.workbenchGridAmounts = Array.isArray(this.workbenchGridAmounts) && this.workbenchGridAmounts.length === 9 ? this.workbenchGridAmounts : Array(9).fill(0);

    const refs = this.inventorySlots(["craft", "craft-table", "hotbar", "main", "armor", "offhand"]);
    if (!this.survival) {
      for (const slot of refs) {
        const id = this.slotValue(slot);
        if (!this.validInventoryId(id) || (slot.type === "armor" && armorSlotForItemId(id, BLOCKS) !== slot.index)
          || (slot.type === "offhand" && !this.inventorySlotValid(slot, id))) { this.setSlotStack(slot, 0, 0); continue; }
        this.setSlotStack(slot, id, slot.type === "armor" || slot.type === "offhand" ? 1 : Math.min(this.maxStackSize(id), this.slotAmount(slot) || this.maxStackSize(id)));
      }
      return;
    }

    const remaining = [...this.counts];
    // An item stack on the mouse cursor is still part of the aggregate save count.
    if (this.validInventoryId(this.cursorItem) && this.cursorCount > 0) {
      remaining[this.cursorItem] = Math.max(0, (remaining[this.cursorItem] ?? 0) - Math.floor(this.cursorCount));
    }
    for (const slot of refs) {
      const id = this.slotValue(slot);
      if (!this.validInventoryId(id) || (slot.type === "armor" && armorSlotForItemId(id, BLOCKS) !== slot.index)
        || (slot.type === "offhand" && !this.inventorySlotValid(slot, id)) || (remaining[id] ?? 0) <= 0) {
        this.setSlotStack(slot, 0, 0); continue;
      }
      const limit = slot.type === "armor" || slot.type === "offhand" ? 1 : this.maxStackSize(id);
      const requested = this.slotAmount(slot) > 0 ? this.slotAmount(slot) : Math.min(limit, remaining[id]);
      const amount = Math.min(limit, requested, remaining[id]);
      this.setSlotStack(slot, id, amount);
      remaining[id] -= amount;
    }

    for (const id of INVENTORY_ITEMS) {
      let amount = Math.max(0, Math.floor(remaining[id] ?? 0));
      if (!this.validInventoryId(id) || amount <= 0) continue;
      const limit = this.maxStackSize(id);
      for (const slot of this.inventorySlots(["hotbar", "main"])) {
        if (amount <= 0) break;
        if (this.slotValue(slot) !== id) continue;
        const current = this.slotAmount(slot);
        const key = slotKey(slot.type, slot.index);
        const metadata = key ? this.stackData[key] ?? null : null;
        if (!this.stackComponentsEqual(metadata, null)) continue;
        const add = Math.min(amount, limit - current);
        if (add > 0) { this.setSlotStack(slot, id, current + add); amount -= add; }
      }
      while (amount > 0) {
        const empty = this.firstEmptyInventorySlot(["main", "hotbar"]);
        if (!empty) break;
        const add = Math.min(amount, limit);
        this.setSlotStack(empty, id, add); amount -= add;
      }
    }
  }

  private renderInventorySlots() {
    this.inventoryUI.render({ hotbar: this.hotbar, hotbarCounts: this.hotbarAmounts,
      main: this.mainInventory, mainCounts: this.mainInventoryAmounts,
      armor: this.armorSlots, armorCounts: this.armorAmounts,
      offhand: this.offhand, offhandCount: this.offhandAmount,
      craft: this.craftGrid, craftCounts: this.craftGridAmounts,
      craftTable: this.workbenchGrid, craftTableCounts: this.workbenchGridAmounts,
      counts: this.counts, selected: this.sel, cursor: this.cursorItem, cursorCount: this.cursorCount, stackData: this.stackData });
    const preview = $("inventory-player-preview") as HTMLCanvasElement;
    if (preview) drawSkinPreview(preview, this.profile.skin);
    this.hotbarUI.refresh();
  }

  private sendEquipment() {
    if (this.mode === "room" && this.net.connected) this.net.send({ t: "equipment", armorSlots: [...this.armorSlots] });
  }

  private currentSlotItems() {
    const out: Record<string, { itemId: number; count: number }> = Object.create(null);
    for (let i = 0; i < 9; i++) if (this.hotbar[i] > 0 && this.hotbarAmounts[i] > 0) out[`hotbar:${i}`] = { itemId: this.hotbar[i], count: this.hotbarAmounts[i] };
    for (let i = 0; i < 27; i++) if (this.mainInventory[i] > 0 && this.mainInventoryAmounts[i] > 0) out[`main:${i}`] = { itemId: this.mainInventory[i], count: this.mainInventoryAmounts[i] };
    for (let i = 0; i < 4; i++) if (this.armorSlots[i] > 0 && this.armorAmounts[i] > 0) out[`armor:${i}`] = { itemId: this.armorSlots[i], count: this.armorAmounts[i] };
    if (this.offhand > 0 && this.offhandAmount > 0) out["offhand:0"] = { itemId: this.offhand, count: this.offhandAmount };
    for (let i = 0; i < 4; i++) if (this.craftGrid[i] > 0 && this.craftGridAmounts[i] > 0) out[`craft:${i}`] = { itemId: this.craftGrid[i], count: this.craftGridAmounts[i] };
    for (let i = 0; i < 9; i++) if (this.workbenchGrid[i] > 0 && this.workbenchGridAmounts[i] > 0) out[`craft-table:${i}`] = { itemId: this.workbenchGrid[i], count: this.workbenchGridAmounts[i] };
    if (this.cursorItem > 0 && this.cursorCount > 0) out["cursor:0"] = { itemId: this.cursorItem, count: this.cursorCount };
    return out;
  }

  private normalizeCurrentStackData(raw: unknown) {
    const slots = this.currentSlotItems();
    this.stackData = normalizeStackComponents(raw, slots, BLOCKS);
    if (!Object.keys(this.stackData).length && Object.keys(this.itemEnchantments).length) this.stackData = migrateLegacyEnchantments(this.itemEnchantments, slots, BLOCKS);
  }

  private sendStackData() {
    if (this.mode !== "room" || !this.net.connected) return;
    const slots = this.currentSlotItems();
    const out: Record<string, unknown> = Object.create(null);
    for (const [key, slot] of Object.entries(slots)) {
      const old = this.stackData[key];
      out[key] = { ...(old && old.itemId === slot.itemId ? old : {}), itemId: slot.itemId, count: slot.count };
    }
    // Keep the local component table complete even in solo mode; it is also used to
    // prevent named/enhanced/damaged stacks from being merged into plain items.
    this.stackData = normalizeStackComponents(out, slots, BLOCKS);
    if (this.mode !== "room" || !this.net.connected) return;
    this.net.send({ t: "stack-data", stackData: this.stackData });
  }

  private getStackEnchantments(key: string, itemId: number) {
    return stackDataForSlot(this.stackData, key, itemId, 1)?.enchantments ?? this.itemEnchantments[String(itemId)] ?? {};
  }

  private moveStackToTypes(id: number, amount: number, types: ("main" | "hotbar")[], incomingMeta: any = null): number {
    let left = Math.max(0, Math.floor(amount));
    const limit = this.maxStackSize(id);
    if (!this.validInventoryId(id) || left <= 0) return left;
    // Fill compatible partial stacks first. Item components must match; item ID alone is not enough.
    for (const slot of this.inventorySlots(types)) {
      if (this.slotValue(slot) !== id) continue;
      const key = slotKey(slot.type, slot.index);
      const currentMeta = key ? this.stackData[key] ?? null : null;
      if (!this.stackComponentsEqual(currentMeta, incomingMeta)) continue;
      const current = this.slotAmount(slot);
      const merged = mergeStackAmounts(current, left, limit);
      if (merged.moved > 0) {
        this.setSlotStack(slot, id, merged.total);
        if (key && (currentMeta || incomingMeta)) this.stackData[key] = { ...(currentMeta ?? incomingMeta), itemId: id, count: merged.total };
        left = merged.remaining;
      }
      if (!left) return 0;
    }
    // Then put the remainder into empty slots without splitting component data.
    for (const slot of this.inventorySlots(types)) {
      if (this.slotValue(slot) !== 0) continue;
      const add = Math.min(left, limit);
      this.setSlotStack(slot, id, add);
      const key = slotKey(slot.type, slot.index);
      if (key && incomingMeta) this.stackData[key] = { ...incomingMeta, itemId: id, count: add };
      left -= add;
      if (!left) return 0;
    }
    return left;
  }

  private stackComponentsEqual(a: any, b: any): boolean {
    return inventoryStackComponentsEqual(a, b);
  }

  private setCursorStackData(record: any, count: number) {
    if (!record || count <= 0) delete this.stackData["cursor:0"];
    else this.stackData["cursor:0"] = { ...record, itemId: this.cursorItem, count };
  }

  private collectMatchingStacksIntoCursor() {
    if (!this.validInventoryId(this.cursorItem) || this.cursorCount <= 0) return;
    const cursorMeta = this.stackData["cursor:0"] ?? null;
    let room = Math.max(0, this.maxStackSize(this.cursorItem) - this.cursorCount);
    for (const slot of this.inventorySlots(["hotbar", "main", "armor", "offhand", "craft", "craft-table"])) {
      if (room <= 0) break;
      if (this.slotValue(slot) !== this.cursorItem) continue;
      const key = slotKey(slot.type, slot.index);
      const metadata = key ? this.stackData[key] ?? null : null;
      if (!this.stackComponentsEqual(metadata, cursorMeta)) continue;
      const amount = Math.min(room, this.slotAmount(slot));
      if (amount <= 0) continue;
      const left = this.slotAmount(slot) - amount;
      this.setSlotStack(slot, left > 0 ? this.cursorItem : 0, left);
      this.cursorCount += amount;
      room -= amount;
    }
    this.setCursorStackData(cursorMeta, this.cursorCount);
  }

  private handleInventorySlotClick(slot: InventorySlotRef, event: PointerEvent) {
    if (this.state !== "inventory") return;
    if (slot.index < 0 || (slot.type === "hotbar" && slot.index >= 9) || (slot.type === "main" && slot.index >= 27)
      || (slot.type === "armor" && slot.index >= 4) || (slot.type === "craft" && slot.index >= 4)
      || (slot.type === "craft-table" && slot.index >= 9) || (slot.type === "offhand" && slot.index !== 0)) return;
    if (event.shiftKey) { this.quickMoveInventorySlot(slot); return; }

    const key = slotKey(slot.type, slot.index);
    if (!key) return;
    const cursorKey = "cursor:0";
    const currentId = this.slotValue(slot), currentAmount = this.slotAmount(slot);
    const currentMeta = this.stackData[key] ? { ...this.stackData[key] } : null;
    const cursorMeta = this.stackData[cursorKey] ? { ...this.stackData[cursorKey] } : null;
    if (event.button !== 0 && event.button !== 2) return;
    const now = performance.now();
    const doubleClick = event.button === 0 && this.lastInventoryClickKey === key && now - this.lastInventoryClickAt <= 350;
    this.lastInventoryClickKey = key;
    this.lastInventoryClickAt = now;
    if (doubleClick && this.cursorItem > 0) {
      this.collectMatchingStacksIntoCursor();
      this.renderInventorySlots(); this.renderCrafting(); this.sendEquipment(); this.sendStackData(); this.autosave(true);
      return;
    }
    const rightClick = event.button === 2;
    if (!rightClick) {
      if (this.cursorItem === 0) {
        if (!currentId || currentAmount <= 0) return;
        this.cursorItem = currentId; this.cursorCount = currentAmount;
        this.setSlotStack(slot, 0, 0);
        this.setCursorStackData(currentMeta, currentAmount);
      } else {
        if (!this.inventorySlotValid(slot, this.cursorItem)) { toast("このスロットには装備できません"); return; }
        if (!currentId) {
          const limit = slot.type === "armor" || slot.type === "offhand" ? 1 : this.maxStackSize(this.cursorItem);
          if ((slot.type === "armor" || slot.type === "offhand") && this.cursorCount > 1) return;
          const placed = Math.min(limit, this.cursorCount);
          this.setSlotStack(slot, this.cursorItem, placed);
          if (cursorMeta) this.stackData[key] = { ...cursorMeta, count: placed };
          this.cursorCount -= placed;
          if (this.cursorCount <= 0) { this.cursorItem = 0; this.setCursorStackData(null, 0); }
          else this.setCursorStackData(cursorMeta, this.cursorCount);
        } else if (currentId === this.cursorItem) {
          const sameComponents = this.stackComponentsEqual(currentMeta, cursorMeta);
          if (!sameComponents) { toast("エンチャントや耐久値が異なるアイテムはまとめられません"); return; }
          const limit = slot.type === "armor" || slot.type === "offhand" ? 1 : this.maxStackSize(currentId);
          const moved = Math.min(this.cursorCount, Math.max(0, limit - currentAmount));
          if (moved > 0) {
            this.setSlotStack(slot, currentId, currentAmount + moved);
            if (currentMeta) this.stackData[key] = { ...currentMeta, count: currentAmount + moved };
            this.cursorCount -= moved;
            if (!this.cursorCount) { this.cursorItem = 0; this.setCursorStackData(null, 0); }
            else this.setCursorStackData(cursorMeta, this.cursorCount);
          }
        } else {
          if ((slot.type === "armor" || slot.type === "offhand") && this.cursorCount > 1) return;
          this.setSlotStack(slot, this.cursorItem, this.cursorCount);
          if (cursorMeta) this.stackData[key] = { ...cursorMeta, count: this.cursorCount };
          this.cursorItem = currentId; this.cursorCount = currentAmount;
          this.setCursorStackData(currentMeta, currentAmount);
        }
      }
    } else if (this.cursorItem === 0) {
      if (!currentId || currentAmount <= 0) return;
      const split = splitStackInHalf(currentAmount);
      this.cursorItem = currentId; this.cursorCount = split.taken;
      this.setSlotStack(slot, split.remaining > 0 ? currentId : 0, split.remaining);
      if (split.remaining > 0 && currentMeta) this.stackData[key] = { ...currentMeta, count: split.remaining };
      this.setCursorStackData(currentMeta, split.taken);
    } else if (!currentId) {
      if (!this.inventorySlotValid(slot, this.cursorItem)) { toast("このスロットには装備できません"); return; }
      if ((slot.type === "armor" || slot.type === "offhand") && this.cursorCount > 1) return;
      this.setSlotStack(slot, this.cursorItem, 1);
      if (cursorMeta) this.stackData[key] = { ...cursorMeta, count: 1 };
      this.cursorCount--;
      if (this.cursorCount <= 0) { this.cursorItem = 0; this.setCursorStackData(null, 0); }
      else this.setCursorStackData(cursorMeta, this.cursorCount);
    } else if (currentId === this.cursorItem) {
      if (!this.stackComponentsEqual(currentMeta, cursorMeta)) { toast("エンチャントや耐久値が異なるアイテムはまとめられません"); return; }
      const limit = slot.type === "armor" || slot.type === "offhand" ? 1 : this.maxStackSize(currentId);
      if (currentAmount < limit) {
        this.setSlotStack(slot, currentId, currentAmount + 1);
        if (currentMeta) this.stackData[key] = { ...currentMeta, count: currentAmount + 1 };
        this.cursorCount--;
        if (this.cursorCount <= 0) { this.cursorItem = 0; this.setCursorStackData(null, 0); }
        else this.setCursorStackData(cursorMeta, this.cursorCount);
      }
    }
    this.renderInventorySlots(); this.renderCrafting(); this.sendEquipment(); this.sendStackData(); this.autosave(true);
  }

  private quickMoveInventorySlot(slot: InventorySlotRef) {
    const id = this.slotValue(slot), amount = this.slotAmount(slot), sourceKey = slotKey(slot.type, slot.index);
    if (!id || amount <= 0 || !sourceKey) return;
    const metadata = this.stackData[sourceKey] ? { ...this.stackData[sourceKey] } : null;

    // Main-inventory equipment follows Java-style quick equip before ordinary transfer.
    if (slot.type === "main" && amount === 1) {
      const armor = armorSlotForItemId(id, BLOCKS);
      if (armor >= 0 && this.armorSlots[armor] === 0) {
        this.setSlotStack({ type: "armor", index: armor }, id, 1);
        if (metadata) this.stackData[`armor:${armor}`] = { ...metadata, itemId: id, count: 1 };
        this.setSlotStack(slot, 0, 0);
        this.renderInventorySlots(); this.sendEquipment(); this.sendStackData(); this.autosave(true);
        return;
      }
      if (BLOCKS[id]?.key?.endsWith("_shield") && this.offhand === 0) {
        this.setSlotStack({ type: "offhand", index: 0 }, id, 1);
        if (metadata) this.stackData["offhand:0"] = { ...metadata, itemId: id, count: 1 };
        this.setSlotStack(slot, 0, 0);
        this.renderInventorySlots(); this.sendEquipment(); this.sendStackData(); this.autosave(true);
        return;
      }
    }

    const destinations: ("main" | "hotbar")[] =
      slot.type === "armor" || slot.type === "offhand" ? ["main", "hotbar"]
      : slot.type === "main" ? ["hotbar"]
      : slot.type === "hotbar" ? ["main"]
      : ["main"];
    const left = this.moveStackToTypes(id, amount, destinations, metadata);
    if (left === amount) { toast(destinations.includes("hotbar") ? "ホットバーに空きがありません" : "インベントリに空きがありません"); return; }
    this.setSlotStack(slot, left > 0 ? id : 0, left);
    if (left > 0 && metadata) this.stackData[sourceKey] = { ...metadata, itemId: id, count: left };
    this.renderInventorySlots(); this.renderCrafting(); this.sendEquipment(); this.sendStackData(); this.autosave(true);
  }

  private creativeCategory(id: number): string {
    const key = BLOCKS[id]?.key ?? "";
    // Keep tools separate from combat gear: the tabs mirror the usual Java creative groups.
    if (/(?:pickaxe|axe|shovel|hoe|fishing_rod|flint_and_steel|shears|brush|spyglass|compass|clock|bucket)$/.test(key)) return "tools";
    if (/(sword|bow|crossbow|trident|shield|armor|helmet|chestplate|leggings|boots|arrow|tipped_arrow)/.test(key)) return "combat";
    if (/(potion|food|apple|bread|carrot|potato|beetroot|stew|meat|fish|cookie|cake|honey_bottle)/.test(key)) return "food";
    if (/(redstone|repeater|comparator|lever|button|pressure_plate|observer|piston|dispenser|hopper|tripwire)/.test(key)) return "redstone";
    if (/(sapling|flower|leaves|log|wood|grass|dirt|sand|stone|ore|mushroom|coral|ice|snow)/.test(key)) return "nature";
    if (/(^minecraft:|stairs|slab|brick|planks|glass|wool|concrete|terracotta|door|fence|wall|trapdoor)/.test(key)) return "building";
    return "all";
  }

  private renderCreativeCatalog(category = "all") {
    if (!this.survival) {
      const search = $("creative-search") as HTMLInputElement;
      const query = search?.value.trim().toLowerCase() ?? "";
      const items = INVENTORY_ITEMS.filter(id => category === "all" || this.creativeCategory(id) === category)
        .filter(id => !query || `${BLOCKS[id]?.name ?? ""} ${BLOCKS[id]?.key ?? ""}`.toLowerCase().includes(query))
        .map(id => ({ id, count: null }));
      this.hotbarUI.setInventory(items);
    }
  }

  private receiveFurnace(message: Extract<ServerMsg, { t: "furnace" }>) {
    const sameStation = this.furnaceView && this.furnaceView.x === message.x && this.furnaceView.y === message.y && this.furnaceView.z === message.z;
    if (!sameStation && !message.open) return;
    if (!sameStation && message.open) {
      this.stopDig(); this.keys.clear(); this.mouseL = this.mouseR = false;
      document.exitPointerLock();
      this.furnaceView = { x: message.x, y: message.y, z: message.z, station: message.station, state: message.state, active: message.active };
      this.state = "furnace";
    } else if (sameStation) {
      this.furnaceView = { x: message.x, y: message.y, z: message.z, station: message.station, state: message.state, active: message.active };
    }
    this.renderFurnacePanel();
  }

  private bindFurnacePanel() {
    const overlay = $("furnace-overlay");
    if (overlay.dataset.bound === "1") return;
    overlay.dataset.bound = "1";
    $("furnace-close").addEventListener("click", () => this.closeFurnace());
    overlay.addEventListener("click", (event) => { if (event.target === overlay) this.closeFurnace(); });
    for (const slot of ["input", "fuel"] as const) {
      $(`furnace-insert-${slot}`).addEventListener("click", () => {
        const view = this.furnaceView; if (!view || this.mode !== "room") return;
        const itemId = Number(($<HTMLSelectElement>("furnace-item")).value);
        const count = Math.floor(Number(($<HTMLInputElement>("furnace-count")).value));
        if (!Number.isSafeInteger(itemId) || itemId <= 0 || !Number.isSafeInteger(count) || count <= 0) { toast("投入する所持アイテムを選択してください"); return; }
        this.net.send({ t: "furnace", action: "insert", x: view.x, y: view.y, z: view.z, slot, itemId, count: Math.min(64, count) });
      });
    }
    for (const slot of ["input", "fuel", "output"] as const) {
      $(`furnace-take-${slot}`).addEventListener("click", () => {
        const view = this.furnaceView; if (!view || this.mode !== "room") return;
        this.net.send({ t: "furnace", action: "take", x: view.x, y: view.y, z: view.z, slot, count: 64 });
      });
    }
  }

  private furnaceItemLabel(itemId: number, count: number) {
    if (!itemId || !count) return "空";
    const key = BLOCKS[itemId]?.key ?? `item_${itemId}`;
    return `${key.replace(/^minecraft:/, "").replaceAll("_", " ")} × ${count}`;
  }

  private renderFurnacePanel() {
    const view = this.furnaceView; if (!view) return;
    this.bindFurnacePanel();
    const overlay = $("furnace-overlay");
    overlay.hidden = false;
    const stationName: Record<FurnaceStation, string> = { furnace: "かまど", blast_furnace: "溶鉱炉", smoker: "燻製器" };
    $("furnace-title").textContent = stationName[view.station];
    $("furnace-status").textContent = view.active ? "燃焼中 — サーバーで精錬を処理しています" : "待機中 — 素材と燃料を入れてください";
    $("furnace-input-value").textContent = this.furnaceItemLabel(view.state.inputItemId, view.state.inputCount);
    $("furnace-fuel-value").textContent = this.furnaceItemLabel(view.state.fuelItemId, view.state.fuelCount);
    $("furnace-output-value").textContent = this.furnaceItemLabel(view.state.outputItemId, view.state.outputCount);
    const duration = view.station === "furnace" ? 200 : 100;
    const progress = Math.max(0, Math.min(100, (view.state.cookTicks / duration) * 100));
    ($("furnace-progress") as HTMLElement).style.width = `${progress}%`;
    $("furnace-progress-label").textContent = `精錬進行度 ${Math.floor(progress)}% · 残り燃焼 ${view.state.burnTicks} tick`;
    const select = $<HTMLSelectElement>("furnace-item");
    const previous = select.value;
    select.replaceChildren();
    const held = this.counts.map((count, id) => ({ id, count, key: BLOCKS[id]?.key })).filter((item) => item.id > 0 && item.count > 0 && !!item.key);
    if (!held.length) {
      const option = document.createElement("option"); option.value = ""; option.textContent = "所持アイテムなし"; select.appendChild(option); select.disabled = true;
    } else {
      select.disabled = false;
      for (const item of held) { const option = document.createElement("option"); option.value = String(item.id); option.textContent = `${item.key!.replace(/^minecraft:/, "").replaceAll("_", " ")} × ${item.count}`; select.appendChild(option); }
      if (held.some((item) => String(item.id) === previous)) select.value = previous;
    }
    const countInput = $<HTMLInputElement>("furnace-count");
    countInput.max = "64";
    if (!countInput.value || Number(countInput.value) < 1) countInput.value = "1";
  }

  closeFurnace() {
    const view = this.furnaceView;
    if (!view) return;
    if (this.mode === "room") this.net.send({ t: "furnace", action: "close", x: view.x, y: view.y, z: view.z });
    $("furnace-overlay").hidden = true;
    this.furnaceView = null;
    if (this.state === "furnace") this.state = "playing";
    this.requestLock();
  }

  openInventory() {
    this.resetMobileInputState();
    this.state = "inventory";
    this.keys.clear(); this.mouseL = this.mouseR = false;
    document.exitPointerLock();
    this.syncInventorySlots();
    $("workbench-panel").hidden = !this.workbenchOpen;
    $("crafting-grid-2x2").hidden = this.workbenchOpen;
    $("crafting-preview-result").hidden = this.workbenchOpen;
    const panels = inventoryPanelVisibility(this.gameMode, this.workbenchOpen);
    $("creative-inventory").hidden = !panels.creativeInventory;
    $("survival-inventory").hidden = !panels.survivalInventory;
    const tabs = $("creative-tabs");
    if (tabs && tabs.dataset.bound !== "1") {
      tabs.dataset.bound = "1";
      tabs.addEventListener("click", e => {
        const button = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-category]");
        if (!button) return;
        tabs.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === button));
        this.renderCreativeCatalog(button.dataset.category ?? "all");
      });
      const search = $("creative-search") as HTMLInputElement;
      search?.addEventListener("input", () => this.renderCreativeCatalog(tabs.querySelector<HTMLButtonElement>("button.on")?.dataset.category ?? "all"));
    }
    if (panels.creativeInventory) this.renderCreativeCatalog("all");
    this.renderCrafting();
    $("invhint").textContent = "左クリック：持つ／置く　右クリック：半分・1個　Shift+クリック：移動　完成品をクリック：クラフト";
    this.renderInventorySlots();
    renderEffects("inventory-effects", this.vitals.activeEffects); this.renderFoodInventory();
    $("inventory").hidden = false;
  }
  private inventoryCraftGrid(): number[] {
    // Convert the visible 2×2 player grid to the shared 3×3 recipe matcher.
    return playerCraftGridToRecipeGrid(this.craftGrid) ?? Array(9).fill(0);
  }

  private matchingInventoryCraftRecipe() {
    if (this.gameMode === "spectator" || !this.inventoryCraftGrid().some(id => id > 0)) return null;
    const creative = this.gameMode === "creative";
    const grid = this.inventoryCraftGrid();
    for (const recipe of CRAFT_RECIPES) {
      if (craftFromGrid(this.counts, recipe.id, grid, CRAFT_RECIPES, { creative, maxStack: 64, maxCount: this.craftOutputMaxCount(recipe.output.itemId) }).ok) return recipe;
    }
    return null;
  }

  private consumeOneCraftGridBatch() {
    const next = consumePlayerCraftGrid(this.craftGrid, this.craftGridAmounts);
    if (!next) return;
    this.craftGrid = next.items;
    this.craftGridAmounts = next.amounts;
  }

  private craftFromInventoryGrid() {
    const recipe = this.matchingInventoryCraftRecipe();
    if (!recipe) { toast("2×2枠で作れるレシピがありません"); return; }
    const grid = this.inventoryCraftGrid();
    if (this.mode === "room") {
      this.pendingCraftGrid = grid;
      this.net.send({ t: "craft", recipeId: recipe.id, grid });
      return;
    }
    const result = craftFromGrid(this.counts, recipe.id, grid, CRAFT_RECIPES, { creative: this.gameMode === "creative", maxStack: 64, maxCount: this.craftOutputMaxCount(recipe.output.itemId) });
    if (!result.ok) { toast("材料が不足しているか、所持数の上限です"); return; }
    this.counts.splice(0, this.counts.length, ...result.counts);
    if (this.gameMode !== "creative") this.consumeOneCraftGridBatch();
    this.syncInventorySlots(); this.hotbarUI.refresh(); this.sendStackData(); this.autosave(true);
    this.renderInventorySlots(); this.renderCrafting();
  }

  private matchingWorkbenchCraftRecipe() {
    if (!this.workbenchOpen || this.gameMode === "spectator" || !this.workbenchGrid.some(id => id > 0)) return null;
    const creative = this.gameMode === "creative";
    for (const recipe of CRAFT_RECIPES) {
      if (craftFromGrid(this.counts, recipe.id, this.workbenchGrid, CRAFT_RECIPES, { creative, maxStack: 64, maxCount: this.craftOutputMaxCount(recipe.output.itemId) }).ok) return recipe;
    }
    return null;
  }

  private consumeWorkbenchGridBatch() {
    if (this.gameMode === "creative") return;
    for (let i = 0; i < 9; i++) {
      if (!this.workbenchGrid[i]) continue;
      this.workbenchGridAmounts[i] = Math.max(0, (this.workbenchGridAmounts[i] || 1) - 1);
      if (!this.workbenchGridAmounts[i]) this.workbenchGrid[i] = 0;
    }
  }

  private craftFromWorkbenchGrid() {
    const recipe = this.matchingWorkbenchCraftRecipe();
    if (!recipe) { toast("作業台の3×3枠に一致するレシピがありません"); return; }
    const grid = [...this.workbenchGrid];
    if (this.mode === "room") {
      if (!this.workbenchPos) { toast("作業台の位置を確認できません"); return; }
      this.net.send({ t: "craft", recipeId: recipe.id, grid, workbench: this.workbenchPos });
      this.pendingCraftGrid = grid;
      this.pendingCraftWorkbench = true;
      return;
    }
    const result = craftFromGrid(this.counts, recipe.id, grid, CRAFT_RECIPES, { creative: this.gameMode === "creative", maxStack: 64, maxCount: this.craftOutputMaxCount(recipe.output.itemId) });
    if (!result.ok) { toast("材料が不足しているか、所持数の上限です"); return; }
    this.counts.splice(0, this.counts.length, ...result.counts);
    this.consumeWorkbenchGridBatch();
    this.syncInventorySlots(); this.hotbarUI.refresh(); this.sendStackData(); this.autosave(true);
    this.renderInventorySlots(); this.renderCrafting();
  }

  private renderWorkbenchCrafting() {
    const resultSlot = $("crafting-table-result") as HTMLButtonElement;
    if (!resultSlot) return;
    if (resultSlot.dataset.bound !== "1") {
      resultSlot.dataset.bound = "1";
      resultSlot.addEventListener("click", () => this.craftFromWorkbenchGrid());
    }
    const recipe = this.matchingWorkbenchCraftRecipe();
    resultSlot.textContent = "";
    resultSlot.disabled = !recipe || this.gameMode === "spectator";
    resultSlot.title = recipe ? `${recipe.name} ×${recipe.output.count}` : "作業台の完成品";
    if (recipe) {
      const icon = document.createElement("img"); icon.src = blockIcon(this.atlas, recipe.output.itemId, 32); icon.alt = recipe.name; resultSlot.appendChild(icon);
      if (recipe.output.count > 1) { const count = document.createElement("span"); count.className = "craft-result-count"; count.textContent = String(recipe.output.count); resultSlot.appendChild(count); }
    }
  }

  private openWorkbench(x: number, y: number, z: number) {
    this.workbenchOpen = true; this.workbenchPos = [x, y, z];
    this.workbenchGrid = Array.isArray(this.workbenchGrid) && this.workbenchGrid.length === 9 ? this.workbenchGrid : Array(9).fill(0);
    this.workbenchGridAmounts = Array.isArray(this.workbenchGridAmounts) && this.workbenchGridAmounts.length === 9 ? this.workbenchGridAmounts : Array(9).fill(0);
    this.openInventory();
    this.renderWorkbenchCrafting();
  }

  renderCrafting() {
    this.renderWorkbenchCrafting();
    const resultSlot = $("crafting-preview-result") as HTMLButtonElement;
    if (resultSlot) {
      if (resultSlot.dataset.bound !== "1") {
        resultSlot.dataset.bound = "1";
        resultSlot.addEventListener("click", () => this.craftFromInventoryGrid());
      }
      resultSlot.textContent = "";
      const recipe = this.matchingInventoryCraftRecipe();
      resultSlot.disabled = !recipe || this.gameMode === "spectator";
      resultSlot.title = recipe ? `${recipe.name} ×${recipe.output.count}` : "2×2クラフトの完成品";
      if (recipe) {
        const icon = document.createElement("img");
        icon.src = blockIcon(this.atlas, recipe.output.itemId, 32);
        icon.alt = recipe.name;
        resultSlot.appendChild(icon);
        if (recipe.output.count > 1) {
          const count = document.createElement("span");
          count.className = "craft-result-count";
          count.textContent = String(recipe.output.count);
          resultSlot.appendChild(count);
        }
      }
    }
    const host = $("craft-recipes");
    host.textContent = "";
    const search = $("craft-search") as HTMLInputElement;
    if (search.dataset.bound !== "1") { search.dataset.bound = "1"; search.addEventListener("input", () => this.renderCrafting()); }
    const query = search.value.trim().toLowerCase();
    const available = this.workbenchOpen ? CRAFT_RECIPES : CRAFT_RECIPES.filter(recipe => craftRecipeFitsGrid(recipe, 2, 2));
    const visibleRecipes = query ? available.filter((recipe) => `${recipe.name} ${recipe.id}`.toLowerCase().includes(query)) : available;
    const creative = this.vitals.gameMode === "creative";
    if (!visibleRecipes.length) { const empty=document.createElement("span"); empty.className="craft-empty"; empty.textContent="該当するレシピがありません"; host.appendChild(empty); return; }
    for (const recipe of visibleRecipes) {
      const button = document.createElement("button");
      button.className = "craft-recipe";
      button.textContent = `${recipe.name} ×${recipe.output.count}`;
      const grid = craftGridForRecipe(recipe, { counts: this.counts, ...(this.workbenchOpen ? {} : { rowOffset: 0, colOffset: 0, gridWidth: 2 }) });
      const required = new Map(); for (const id of grid) if (id > 0) required.set(id, (required.get(id) || 0) + 1);
      const enough = [...required].every(([id, count]) => (this.counts[id] ?? 0) >= count);
      button.title = [...required].map(([id, count]) => `${BLOCKS[id]?.name ?? id} ×${count}`).join(" + ");
      button.title += recipe.shapeless ? "\n配置自由" : `\n形状: ${(recipe.pattern?.join(" / ") ?? "")}`;
      button.disabled = !creative && !enough;
      button.addEventListener("click", () => {
        if (this.workbenchOpen) {
          this.workbenchGrid = [...grid];
          this.workbenchGridAmounts = grid.map(id => id > 0 ? 1 : 0);
          this.syncInventorySlots();
          this.renderInventorySlots();
          this.renderWorkbenchCrafting();
          return;
        }
        if (this.mode === "room") {
          this.net.send({ t: "craft", recipeId: recipe.id, grid });
          return;
        }
        const result = craftFromGrid(this.counts, recipe.id, grid, CRAFT_RECIPES, { creative, maxStack: 64, maxCount: this.craftOutputMaxCount(recipe.output.itemId) });
        if (!result.ok) { toast("材料が不足しているか、所持数の上限です"); return; }
        this.counts.splice(0, this.counts.length, ...result.counts);
        this.autosave(true);
        this.hotbarUI.refresh();
        this.openInventory();
      });
      host.appendChild(button);
    }
  }
  closeInventory() {
    for (let i = 0; i < 9; i++) {
      const id = this.workbenchGrid[i] ?? 0, amount = this.workbenchGridAmounts[i] ?? 0;
      if (!id || amount <= 0) continue;
      const sourceKey = `craft-table:${i}`, metadata = this.stackData[sourceKey] ?? null;
      const left = this.moveStackToTypes(id, amount, ["main", "hotbar"], metadata);
      this.setSlotStack({ type: "craft-table", index: i }, left > 0 ? id : 0, left);
      if (left > 0 && metadata) this.stackData[sourceKey] = { ...metadata, itemId: id, count: left };
      if (left > 0) { toast("作業台にアイテムが残っています。インベントリに空きを作ってください"); this.renderInventorySlots(); return; }
    }
    for (let i = 0; i < 4; i++) {
      const id = this.craftGrid[i] ?? 0, amount = this.craftGridAmounts[i] ?? 0;
      if (!id || amount <= 0) continue;
      const sourceKey = `craft:${i}`, metadata = this.stackData[sourceKey] ?? null;
      const left = this.moveStackToTypes(id, amount, ["main", "hotbar"], metadata);
      this.setSlotStack({ type: "craft", index: i }, left > 0 ? id : 0, left);
      if (left > 0 && metadata) this.stackData[sourceKey] = { ...metadata, itemId: id, count: left };
      if (left > 0) { toast("クラフト枠にアイテムが残っています。空きを作ってください"); this.renderInventorySlots(); return; }
    }
    if (this.cursorItem > 0 && this.cursorCount > 0) {
      const cursorMeta = this.stackData["cursor:0"] ?? null;
      const cursorId = this.cursorItem;
      const left = this.moveStackToTypes(cursorId, this.cursorCount, ["main", "hotbar"], cursorMeta);
      this.cursorCount = left; if (left <= 0) this.cursorItem = 0;
      this.setCursorStackData(cursorMeta, left);
      if (left > 0) { toast("インベントリに空きがないため残りをカーソルに保持しています"); this.renderInventorySlots(); return; }
    }
    $("inventory").hidden = true;
    this.workbenchOpen = false; this.workbenchPos = null;
    this.state = "playing";
    this.sendEquipment(); this.sendStackData(); this.autosave(true);
    this.requestLock();
  }
  private portalCheckAt = 0;
  private portalCooldownUntil = 0;
  private portalPendingTarget: string | null = null;
  private portalEnteredAt = 0;
  private portalNeedsExit = false;
  private portalServerActive = false;

  private checkPortal(now: number) {
    if (this.state !== "playing") {
      if (this.mode === "room" && this.portalServerActive) { this.net.send({ t: "portal", inside: false }); this.portalServerActive = false; }
      return;
    }
    if (now < this.portalCheckAt) return;
    this.portalCheckAt = now + 200;
    const ids = { netherPortal: MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:nether_portal"], endPortal: MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:end_portal"] };
    const target = findPortalAt(this.world, this.body, this.world.dimensionId, ids);
    const inside = !!target && target !== this.world.dimensionId;
    if (this.mode === "room") {
      if (inside) { this.portalServerActive = true; this.net.send({ t: "portal", inside: true }); }
      else if (this.portalServerActive) { this.portalServerActive = false; this.net.send({ t: "portal", inside: false }); }
      return;
    }
    if (!inside) { this.portalPendingTarget = null; this.portalEnteredAt = 0; this.portalNeedsExit = false; return; }
    if (this.portalNeedsExit || now < this.portalCooldownUntil) return;
    if (this.portalPendingTarget !== target) { this.portalPendingTarget = target; this.portalEnteredAt = now; return; }
    const delay = this.survival ? PORTAL_DELAY_SURVIVAL_MS : PORTAL_DELAY_CREATIVE_MS;
    if (now - this.portalEnteredAt < delay) return;
    this.portalPendingTarget = null; this.portalNeedsExit = true; this.portalCooldownUntil = now + 3500;
    this.switchSoloDimension(target, true);
  }

  runSoloCommand(text: string) {
    const [command, argument, ...extra] = text.trim().split(/\s+/);
    if (command !== "/dimension" || !argument || extra.length) {
      this.chat.add("使用法: /dimension overworld|nether|end");
      return;
    }
    const aliases: Record<string, string> = {
      overworld: DIMENSION_IDS.OVERWORLD, nether: DIMENSION_IDS.NETHER, the_nether: DIMENSION_IDS.NETHER,
      end: DIMENSION_IDS.END, the_end: DIMENSION_IDS.END,
    };
    const target = aliases[argument.toLowerCase()] ?? argument.toLowerCase();
    if (!isDimensionId(target)) {
      this.chat.add("移動先は overworld / nether / end のいずれかです");
      return;
    }
    this.switchSoloDimension(target);
  }

  safeDimensionSpawn(x: number, z: number) {
    return findSafeSpawn(this.world, { x, z }, {
      height: WORLD_HEIGHT, searchRadius: 8,
      isSolid: (id: number) => !!BLOCKS[id]?.solid,
      isHazard: (id: number) => id === B.WATER || id === B.LAVA || id === B.MAGMA_BLOCK,
    });
  }

  private resolveSoloPortalArrival(previous: string, target: string, mapped: { x: number; y: number; z: number }) {
    const netherLink = (previous === DIMENSION_IDS.OVERWORLD && target === DIMENSION_IDS.NETHER) || (previous === DIMENSION_IDS.NETHER && target === DIMENSION_IDS.OVERWORLD);
    if (!netherLink) return null;
    const get = (x: number, y: number, z: number) => { this.world.ensureChunk(Math.floor(x / 16), Math.floor(z / 16)); return this.world.get(x, y, z); };
    const nearest = findNearestPortal(get, Math.floor(mapped.x), Math.floor(mapped.z), target === DIMENSION_IDS.NETHER ? 8 : 32, 1, WORLD_HEIGHT - 2);
    if (nearest) return { x: nearest[0] + 0.5, y: nearest[1], z: nearest[2] + 0.5 };
    const site = findPortalBuildSite(get, Math.floor(mapped.x), Math.floor(mapped.z), { radius: 4, yMin: 2, yMax: WORLD_HEIGHT - 6 });
    if (!site) return null;
    const { edits, spawn } = buildPortalEdits(site.x, site.y, site.z), final = new Map<string, [number, number, number, number]>();
    for (const edit of edits) final.set(`${edit[0]},${edit[1]},${edit[2]}`, edit);
    for (const [x, y, z, block] of final.values()) if (block !== B.AIR) this.setLocal(x, y, z, block);
    return { x: spawn[0] + 0.5, y: spawn[1], z: spawn[2] + 0.5 };
  }

  switchSoloDimension(target: string, viaPortal = false): boolean {
    if (this.mode !== "solo" || !isDimensionId(target)) return false;
    const previous = this.world.dimensionId;
    if (previous === target) { this.chat.add("すでにそのディメンションにいます"); return false; }
    const mapped = mapDimensionCoordinates(previous, target, this.body);
    if (!this.world.switchDimension(target)) return false;
    const portalArrival = viaPortal ? this.resolveSoloPortalArrival(previous, target, mapped) : null;
    const safe = portalArrival ?? this.safeDimensionSpawn(mapped.x, mapped.z);
    if (!safe) {
      this.world.switchDimension(previous);
      this.view.clear();
      this.chat.add("安全な到着地点を見つけられませんでした");
      return false;
    }
    this.view.clear();
    this.body = { x: safe.x, y: safe.y, z: safe.z, vx: 0, vy: 0, vz: 0, onGround: false };
    this.spawn = [safe.x, safe.y, safe.z];
    this.target = null; this.digKey = ""; this.digT = 0; this.digReady = false;
    this.keys.clear(); this.mouseL = this.mouseR = false;
    const labels: Record<string, string> = {
      [DIMENSION_IDS.OVERWORLD]: "オーバーワールド", [DIMENSION_IDS.NETHER]: "ネザー", [DIMENSION_IDS.END]: "ジ・エンド",
    };
    this.chat.add(`${labels[target]}へ移動しました`);
    this.autosave(true);
    return true;
  }

  openChat() {
    this.state = "chat";
    this.keys.clear(); this.mouseL = this.mouseR = false;
    document.exitPointerLock();
    const ci = $<HTMLInputElement>("chatinput");
    ci.hidden = false; ci.value = "";
    this.chat.setOpen(true);
    setTimeout(() => ci.focus(), 0);
  }
  closeChat(relock: boolean) {
    const ci = $<HTMLInputElement>("chatinput");
    ci.hidden = true; ci.blur();
    this.chat.setOpen(false);
    if (relock) { this.state = "playing"; this.requestLock(); }
    else this.openPause("一時停止");
  }

  // ------------------------------------------------------------ flow
  showLoading(text: string) {
    this.state = "loading";
    $("title").hidden = true;
    $("pause").hidden = true;
    $("loading").hidden = false;
    $("loadtext").textContent = text;
    $("loadbar").style.width = "5%";
  }

  backToTitle(err = "") {
    this.net.close();
    this.ready = false;
    this.state = "title";
    this.remotes.clear();
    this.view.clear();
    this.world.reset(1);
    $("hud").hidden = true;
    $("pause").hidden = true;
    $("admin").hidden = true;
    $("breakbar").hidden = true;
    $("loading").hidden = true;
    $("inventory").hidden = true;
    this.isHost = false;
    this.digKey = ""; this.digT = 0;
    $("title").hidden = false;
    $("titleerr").textContent = err;
    this.chat.setOpen(false);
    this.drops.clear();
    const solo = loadSolo();
    $("btn-solo").textContent = solo ? "ソロ: 続きから" : "ソロで遊ぶ";
    $("btn-solo-new").hidden = !solo;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  quit() {
    this.autosave(true);
    this.backToTitle();
  }

  startSolo(fresh: boolean) {
    this.mode = "solo";
    this.gameMode = "creative"; // ソロは常にクリエイティブ
    this.isHost = false;
    this.fly = false;
    this.roomCode = "";
    this.chat.setScope("solo");
    this.drops.clear();
    const save = fresh ? null : loadSolo();
    const seed = save?.seed ?? (Math.random() * 2 ** 31) >>> 0;
    const version = save ? normalizeWorldgenVersion(save.worldgenVersion ?? LEGACY_WORLDGEN_VERSION) : WORLDGEN_VERSION;
    this.world.reset(seed, version, save?.dimensionId ?? DIMENSION_IDS.OVERWORLD);
    this.view.clear();
    this.remotes.clear();
    if (save) {
      if (save.dimensionEdits) this.world.importDimensionEdits(save.dimensionEdits, save.edits);
      else this.world.importEdits(save.edits);
      this.time = save.time;
      this.applyPlayerSave(save.player, false, save.spawn);
    } else {
      this.time = 0.05;
      this.setSpawn();
    }
    this.beginLoading("ワールドを生成中…");
  }

  async startRoom(code: string) {
    this.mode = "room";
    this.roomCode = code;
    this.chat.setScope(code);
    this.drops.clear();
    this.kickMsg = "";
    this.bans = [];
    this.isHost = false;
    this.showLoading("ルームに接続中…");
    this.pending.clear();
    const saved = loadRoomPlayer(code);
    let gotInit = false;
    let roomEntryPosition: [number, number, number] | null = null;
    let roomEntryRotation: [number, number] | null = null;
    let doneSettled = false;
    let progressTimer: number | null = null;
    let failDone: (error: Error) => void = () => {};
    let touchProgress: () => void = () => {};

    const done = new Promise<{
      position: [number, number, number] | null;
      rotation: [number, number] | null;
    }>((resolve, reject) => {
      const clearProgressTimer = () => {
        if (progressTimer !== null) {
          clearTimeout(progressTimer);
          progressTimer = null;
        }
      };
      failDone = (error) => {
        if (doneSettled) return;
        doneSettled = true;
        clearProgressTimer();
        reject(error);
      };
      touchProgress = () => {
        if (doneSettled) return;
        clearProgressTimer();
        // This is an inactivity timeout, not a total transfer deadline. Every init
        // or edit-progress packet extends it, so large existing worlds can finish.
        progressTimer = window.setTimeout(() => {
          failDone(new Error("ルームデータの受信が60秒間進んでいません"));
        }, 60000);
      };

      this.net.onMessage = (m) => {
        if (doneSettled) {
          this.onServerMsg(m);
          return;
        }
        if (m.t === "init") {
          gotInit = true;
          touchProgress();
          this.myId = m.id;
          this.gameMode = m.mode;
          this.isHost = m.host;
          this.fly = m.mode === "creative" || m.mode === "spectator";
          if (m.vitals) this.applyVitals(m.vitals);
          // The server owns the player's saved dimension and transform. Do not inherit the
          // previous local World.dimensionId when joining a different room or re-entering.
          const initDimensionId = typeof m.dimensionId === "string" ? m.dimensionId : DIMENSION_IDS.OVERWORLD;
          roomEntryPosition = m.p && m.p.every((value) => Number.isFinite(value)) ? [...m.p] : null;
          roomEntryRotation = m.r && m.r.every((value) => Number.isFinite(value)) ? [...m.r] : null;
          this.world.reset(m.seed, normalizeWorldgenVersion(m.worldgenVersion ?? LEGACY_WORLDGEN_VERSION), initDimensionId);
          this.view.clear();
          this.remotes.clear();
          this.t0 = m.t0;
          this.clockOffset = m.now - Date.now();
          for (const p of m.players) this.remotes.add(p);
          for (const d of m.drops ?? []) {
            if (d.xp !== undefined) this.drops.addExperience(d.eid, d.x, d.y, d.z, d.xp);
            else this.drops.add(d.eid, d.x, d.y, d.z, d.itemId ?? d.b ?? 0, d.count ?? 1);
          }
          this.counts = Array.from({ length: BLOCKS.length }, (_, i) =>
            Math.min(maxInventoryCountForItemKey(BLOCKS[i]?.key ?? ""), Math.max(0, Math.floor(m.counts[i] ?? 0))));
          if (Array.isArray(m.armorSlots)) {
            this.armorSlots = m.armorSlots.slice(0, 4).map((id, index) =>
              this.validInventoryId(id) && armorSlotForItemId(id, BLOCKS) === index ? id : 0);
          }
          this.itemEnchantments = normalizeItemEnchantments(m.itemEnchantments, BLOCKS);
          this.stackData = normalizeStackComponents(m.stackData, {}, BLOCKS);
          this.elytraDamage = Math.max(0, Math.min(432, Math.floor(Number(m.elytraDamage) || 0)));
          this.fallFlying = false;
          this.syncInventorySlots();
          this.mobModels.clear();
          for (const mob of m.mobs) this.mobModels.add(mob);
          this.projectileEntities.clear();
          for (const projectile of m.projectiles ?? []) this.projectileEntities.add(projectile);
        } else if (m.t === "edits" && gotInit) {
          touchProgress();
          this.world.importEdits(m.list);
          if (m.done) {
            doneSettled = true;
            if (progressTimer !== null) clearTimeout(progressTimer);
            progressTimer = null;
            resolve({ position: roomEntryPosition, rotation: roomEntryRotation });
          }
        } else if (m.t === "error") {
          this.kickMsg = m.message;
          failDone(new Error(m.message));
        } else if (m.t === "kicked") {
          this.kickMsg = m.reason;
          failDone(new Error(m.reason));
        } else {
          this.onServerMsg(m);
        }
      };
    });

    this.net.onClose = (reason) => {
      if (!doneSettled) failDone(new Error(this.kickMsg || reason));
      else if (this.state !== "title") this.backToTitle(this.kickMsg || reason);
    };

    try {
      await this.net.connect(code, {
        t: "hello", name: this.profile.name, skin: this.profile.skin,
        p: saved?.pos, r: saved ? [saved.yaw, saved.pitch] : undefined,
        cid: clientId(), hostToken: loadHostToken(code) || undefined,
        counts: saved?.counts, armorSlots: saved?.armorSlots, stackData: saved?.stackData,
      });
      // Start the transfer inactivity timer only after the socket is actually open.
      touchProgress();
      const roomEntry = await done;
      const serverCounts = [...this.counts];
      const serverArmorSlots = [...this.armorSlots];
      if (saved) this.applyPlayerSave(saved, true); else {
        this.setSpawn();
        this.counts = serverCounts;
        this.armorSlots = serverArmorSlots;
        this.syncInventorySlots();
        this.sendEquipment();
      }
      // Server stack records carry the canonical slot layout and per-item components.
      // Restore them after local save loading so a fresh device or stale local save cannot
      // erase named, enchanted, damaged, cursor, or crafting-grid stacks.
      this.restoreSlotContentsFromStackData();
      this.syncInventorySlots();
      // The server snapshot is authoritative for the dimension and transform.
      if (roomEntry.position) {
        const [x, y, z] = roomEntry.position;
        this.body = { x, y, z, vx: 0, vy: 0, vz: 0, onGround: false };
        if (roomEntry.rotation) { this.yaw = roomEntry.rotation[0]; this.pitch = roomEntry.rotation[1]; }
      }
      this.sendStackData();
      this.time = this.roomTime();
      history.replaceState(null, "", `#${code}`);
      this.beginLoading("ワールドを生成中…");
    } catch (error) {
      if (progressTimer !== null) clearTimeout(progressTimer);
      progressTimer = null;
      this.net.close();
      const message = error instanceof Error ? error.message : String(error);
      if (this.state !== "title") this.backToTitle(this.kickMsg || message);
      throw error;
    }
  }

  roomTime(): number {
    const t = ((Date.now() + this.clockOffset - this.t0) / 1000 / DAY_LENGTH_SEC + 0.05) % 1;
    return t < 0 ? t + 1 : t;
  }

  setSpawn() {
    const h = Math.max(heightAt(this.world.seed, 0, 0, this.world.worldgenVersion), SEA_LEVEL);
    this.body = { x: 0.5, y: h + 2, z: 0.5, vx: 0, vy: 0, vz: 0, onGround: false };
    this.yaw = 0; this.pitch = 0;
    this.hotbar = this.survival ? new Array(9).fill(0) : [...DEFAULT_HOTBAR]; this.sel = 0;
    this.counts = new Array(BLOCKS.length).fill(0);
    this.mainInventory = new Array(27).fill(0); this.hotbarAmounts = new Array(9).fill(0); this.mainInventoryAmounts = new Array(27).fill(0);
    this.armorSlots = [0, 0, 0, 0]; this.armorAmounts = [0, 0, 0, 0]; this.itemEnchantments = {}; this.stackData = Object.create(null); this.elytraDamage = 0; this.fallFlying = false; this.offhand = 0; this.offhandAmount = 0;
    this.craftGrid = new Array(4).fill(0); this.craftGridAmounts = new Array(4).fill(0); this.workbenchGrid = Array(9).fill(0); this.workbenchGridAmounts = Array(9).fill(0); this.workbenchOpen = false; this.workbenchPos = null; this.pendingCraftGrid = null; this.pendingCraftWorkbench = false; this.cursorItem = 0; this.cursorCount = 0;
    this.health = MAX_HP;
    this.hunger = MAX_HUNGER; this.exhaustion = 0; this.starveT = 0;
    this.spawn = [0.5, h + 2, 0.5];
  }

  applyPlayerSave(p: PlayerSave, preserveCounts = false, savedSpawn?: [number, number, number]) {
    this.body = { x: p.pos[0], y: p.pos[1], z: p.pos[2], vx: 0, vy: 0, vz: 0, onGround: false };
    this.yaw = p.yaw; this.pitch = p.pitch;
    this.hotbar = p.hotbar.length === 9 ? p.hotbar.map((v) => (v >= 1 && v < BLOCKS.length ? v : 0)) : this.survival ? new Array(9).fill(0) : [...DEFAULT_HOTBAR];
    this.sel = Math.min(8, Math.max(0, p.sel | 0));
    if (!preserveCounts) {
      this.counts = new Array(BLOCKS.length).fill(0);
      if (Array.isArray(p.counts)) for (let i = 1; i < BLOCKS.length; i++) { const v = p.counts[i]; if (typeof v === "number" && v > 0) this.counts[i] = Math.min(maxInventoryCountForItemKey(BLOCKS[i]?.key ?? ""), Math.floor(v)); }
    }
    this.mainInventory = Array.isArray(p.mainInventory) && p.mainInventory.length === 27
      ? p.mainInventory.map(id => this.validInventoryId(id) ? id : 0) : new Array(27).fill(0);
    this.hotbarAmounts = Array.isArray(p.hotbarAmounts) && p.hotbarAmounts.length === 9
      ? p.hotbarAmounts.map(n => Math.max(0, Math.min(64, Math.floor(Number(n) || 0)))) : new Array(9).fill(0);
    this.mainInventoryAmounts = Array.isArray(p.mainInventoryAmounts) && p.mainInventoryAmounts.length === 27
      ? p.mainInventoryAmounts.map(n => Math.max(0, Math.min(64, Math.floor(Number(n) || 0)))) : new Array(27).fill(0);
    this.armorSlots = Array.isArray(p.armorSlots) && p.armorSlots.length === 4
      ? p.armorSlots.map((id, index) => this.validInventoryId(id) && armorSlotForItemId(id, BLOCKS) === index ? id : 0) : [0, 0, 0, 0];
    this.armorAmounts = Array.isArray(p.armorAmounts) && p.armorAmounts.length === 4
      ? p.armorAmounts.map(n => Math.max(0, Math.min(1, Math.floor(Number(n) || 0)))) : [0, 0, 0, 0];
    if (!preserveCounts) {
      this.itemEnchantments = normalizeItemEnchantments(p.itemEnchantments, BLOCKS);
      this.stackData = normalizeStackComponents(p.stackData, {}, BLOCKS);
      this.elytraDamage = Math.max(0, Math.min(432, Math.floor(Number(p.elytraDamage) || 0)));
    }
    this.fallFlying = false;
    this.offhand = this.validInventoryId(p.offhand ?? 0) ? p.offhand ?? 0 : 0;
    this.offhandAmount = p.offhandAmount === 1 && this.offhand ? 1 : 0;
    this.craftGrid = Array.isArray(p.craftGrid) && p.craftGrid.length === 4 ? p.craftGrid.map(id => this.validInventoryId(id) ? id : 0) : new Array(4).fill(0);
    this.craftGridAmounts = Array.isArray(p.craftGridAmounts) && p.craftGridAmounts.length === 4 ? p.craftGridAmounts.map(n => Math.max(0, Math.min(64, Math.floor(Number(n) || 0)))) : new Array(4).fill(0);
    this.workbenchGrid = Array.isArray(p.workbenchGrid) && p.workbenchGrid.length === 9 ? p.workbenchGrid.map(id => this.validInventoryId(id) ? id : 0) : Array(9).fill(0);
    this.workbenchGridAmounts = Array.isArray(p.workbenchGridAmounts) && p.workbenchGridAmounts.length === 9 ? p.workbenchGridAmounts.map(n => Math.max(0, Math.min(64, Math.floor(Number(n) || 0)))) : Array(9).fill(0);
    this.workbenchOpen = false; this.workbenchPos = null;
    this.pendingCraftGrid = null; this.pendingCraftWorkbench = false;
    this.cursorItem = this.validInventoryId(p.cursorItem ?? 0) ? (p.cursorItem ?? 0) : 0;
    this.cursorCount = this.cursorItem > 0 ? Math.min(this.maxStackSize(this.cursorItem), Math.max(0, Math.floor(Number(p.cursorCount) || 0))) : 0;
    if (this.cursorCount <= 0) this.cursorItem = 0;
    this.health = typeof p.health === "number" ? Math.min(MAX_HP, Math.max(1, Math.round(p.health))) : MAX_HP;
    this.hunger = typeof p.hunger === "number" ? Math.min(MAX_HUNGER, Math.max(0, Math.round(p.hunger))) : MAX_HUNGER;
    this.exhaustion = 0; this.starveT = 0;
    this.pruneHotbar(); this.syncInventorySlots();
    if (!Object.keys(this.stackData).length) this.normalizeCurrentStackData(p.stackData);
    const validSpawn = Array.isArray(savedSpawn) && savedSpawn.length === 3 && savedSpawn.every(Number.isFinite)
      && Math.abs(savedSpawn[0]) < 524288 && Math.abs(savedSpawn[2]) < 524288 && savedSpawn[1] >= 1 && savedSpawn[1] < WORLD_HEIGHT;
    const safeSpawn = validSpawn ? null : this.safeDimensionSpawn(this.body.x, this.body.z);
    this.spawn = validSpawn ? [savedSpawn[0], savedSpawn[1], savedSpawn[2]]
      : safeSpawn ? [safeSpawn.x, safeSpawn.y, safeSpawn.z] : [this.body.x, this.body.y, this.body.z];
  }

  beginLoading(text: string) {
    if (this.mode !== "room") this.soloRedstone.clear();
    this.showLoading(text);
    this.ready = false;
    this.loadStart = performance.now();
    this.hotbarUI.refresh();
    $("hud").hidden = false;
    $("roombadge").hidden = this.mode !== "room";
    $("roomcode").textContent = this.roomCode;
    this.updateSurvivalHud();
    this.loadingFor = "world";
  }

  finishLoading() {
    // めり込み回避
    for (let i = 0; i < 80 && collides(this.world, this.body.x, this.body.y, this.body.z); i++) this.body.y += 1;
    this.ready = true;
    $("loading").hidden = true;
    this.peakY = this.body.y; this.wasGround = true; this.regenT = 0;
    // 重要: state が "loading" のままだと openPause() が即 return し、メニューも出ず
    // ポインタロックも要求できなくなる(= マウスロックできないバグの原因)
    this.state = "paused";
    this.openPause("準備完了");
    if (this.mode === "room") this.chat.add(`ルーム ${this.roomCode} に参加しました`);
  }

  // ------------------------------------------------------------ server
  onServerMsg(m: ServerMsg) {
    switch (m.t) {
      case "dimension": {
        this.pending.clear();
        this.world.reset(m.seed, normalizeWorldgenVersion(m.worldgenVersion ?? LEGACY_WORLDGEN_VERSION), m.dimensionId);
        this.view.clear();
        this.remotes.clear(); for (const player of m.players) this.remotes.add(player);
        this.drops.clear(); for (const drop of m.drops ?? []) { if (drop.xp !== undefined) this.drops.addExperience(drop.eid, drop.x, drop.y, drop.z, drop.xp); else this.drops.add(drop.eid, drop.x, drop.y, drop.z, drop.itemId ?? drop.b ?? 0, drop.count ?? 1); }
        this.mobModels.clear(); for (const mob of m.mobs ?? []) this.mobModels.add(mob);
        this.projectileEntities.clear(); for (const projectile of m.projectiles ?? []) this.projectileEntities.add(projectile);
        this.localFishing=null; this.fishingRightHeld=false; $("bossbar").hidden=true;
        // The Worker selected this safe arrival against the target dimension's
        // persisted edits. Re-running spawn search before receiving those edits can
        // choose a different (or obstructed) location on the client.
        const pos = { x: m.p[0], y: m.p[1], z: m.p[2] };
        this.body = { x: pos.x, y: pos.y, z: pos.z, vx: 0, vy: 0, vz: 0, onGround: false };
        this.fallFlying = false;
        this.spawn = [pos.x, pos.y, pos.z];
        this.yaw = m.r[0]; this.pitch = m.r[1];
        this.target = null; this.digKey = ""; this.digT = 0; this.digReady = false;
        this.keys.clear(); this.mouseL = this.mouseR = false;
        this.net.send({ t: "pos", p: [pos.x, pos.y, pos.z], r: [this.yaw, this.pitch] });
        this.chat.add(`ディメンションを切り替えました: ${m.dimensionId}`);
        break;
      }
      case "join":
        this.remotes.add(m.player);
        this.chat.add(`${m.player.name} が入室しました`);
        toast(`${m.player.name} が入室しました`);
        if (!$("admin").hidden) this.renderAdmin();
        break;
      case "leave":
        this.remotes.remove(m.id);
        this.chat.add(`${m.name} が退室しました`);
        if (!$("admin").hidden) this.renderAdmin();
        break;
      case "kicked": this.kickMsg = m.reason; break;
      case "bans": this.bans = m.list; if (!$("admin").hidden) this.renderAdmin(); break;
      case "teleport": {
        this.body = { x: m.p[0], y: m.p[1], z: m.p[2], vx: 0, vy: 0, vz: 0, onGround: false };
        this.yaw = m.r[0]; this.pitch = m.r[1];
        this.target = null; this.digKey = ""; this.digT = 0; this.digReady = false;
        this.keys.clear(); this.mouseL = this.mouseR = false;
        this.autosave(true);
        break;
      }
      case "pos": this.remotes.move(m.id, m.p, m.r, !!m.fallFlying); this.remotes.setSneak(m.id, !!m.sneak); break;
      case "player-equipment": this.remotes.setArmorSlots(m.id, m.armorSlots); break;
      case "item-enchantments": this.itemEnchantments = normalizeItemEnchantments(m.itemEnchantments, BLOCKS); this.autosave(true); break;
      case "stack-data": this.stackData = normalizeStackComponents(m.stackData, {}, BLOCKS); this.autosave(true); break;
      case "elytra-state": this.elytraDamage = Math.max(0, Math.min(432, m.damage)); if (m.broken) { this.fallFlying=false; toast("エリトラが壊れました"); } break;
      case "rocket-boost": this.body.vx += m.vx; this.body.vy += m.vy; this.body.vz += m.vz; break;
      case "impulse": this.body.vx += m.vx; this.body.vy += m.vy; this.body.vz += m.vz; break;
      case "fishing":
        this.projectileEntities.addBobber(m.id,m.x,m.y,m.z,m.state);
        if(m.ownerId===this.myId && m.state==="bite") toast("魚が食いついた！右クリックで釣り上げてください");
        else if(m.ownerId===this.myId) toast("釣り糸を垂らしました");
        break;
      case "fishing-gone": this.projectileEntities.removeBobber(m.id); break;
      case "bossbar": {
        const bar=$<HTMLElement>("bossbar"), fill=$<HTMLElement>("bossbar-fill"), name=$<HTMLElement>("bossbar-name");
        bar.hidden=!m.visible; name.textContent=m.name;
        const progress=Math.max(0,Math.min(1,m.progress));
        fill.style.width=`${progress*100}%`;
        const track=$<HTMLElement>("bossbar-track");track.setAttribute("aria-valuenow",String(Math.round(progress*100)));
        break;
      }
      case "drop": if (m.xp !== undefined) this.drops.addExperience(m.eid, m.x, m.y, m.z, m.xp); else this.drops.add(m.eid, m.x, m.y, m.z, m.itemId ?? m.b ?? 0, m.count ?? 1); break;
      case "dig-ready": if (this.digKey === `${m.x},${m.y},${m.z}` && this.mouseL) this.digReady = true; break;
      case "furnace": {
        this.receiveFurnace(m);
        break;
      }
      case "inventory": {
        const incomingCounts = Array.from({ length: BLOCKS.length }, (_, i) => Math.min(maxInventoryCountForItemKey(BLOCKS[i]?.key ?? ""), Math.max(0, Math.floor(m.counts[i] ?? 0))));
        if (this.pendingCraftGrid) {
          const succeeded = incomingCounts.some((count, i) => count !== (this.counts[i] ?? 0));
          if (succeeded && this.gameMode !== "creative") {
            if (this.pendingCraftWorkbench) this.consumeWorkbenchGridBatch();
            else this.consumeOneCraftGridBatch();
          }
          this.pendingCraftGrid = null; this.pendingCraftWorkbench = false;
        }
        this.counts = incomingCounts;
        if (m.clearHotbar) { this.hotbar = new Array(9).fill(0); this.autosave(true); }
        else this.pruneHotbar();
        this.syncInventorySlots(); this.hotbarUI.refresh(); this.sendStackData();
        if (this.state === "inventory") { this.renderCrafting(); this.renderInventorySlots(); }
        if (this.state === "furnace") this.renderFurnacePanel();
        break;
      }
      case "mob": this.mobModels.add(m.mob); break;
      case "mobbatch": for (const mob of m.mobs) this.mobModels.add(mob); break;
      case "mobgone": this.mobModels.remove(m.id); break;
      case "projectile": this.projectileEntities.add(m.projectile); break;
      case "projectilegone": this.projectileEntities.remove(m.eid); break;
      case "gone": {
        const b = this.drops.blockOf(m.eid);
        this.drops.remove(m.eid);
        // 自分が回収したときだけインベントリに入る
        if (m.by && m.by === this.myId && b !== null && this.survival) this.giveItem(blockItemId(b));
        break;
      }
      case "mode": this.applyGameMode(m.mode); break;
      case "stats": if (m.id === this.myId) this.applyVitals(m.vitals, m.event); break;
      case "set":
        this.pending.delete(`${m.x},${m.y},${m.z}`);
        this.world.setBlock(m.x, m.y, m.z, m.b);
        break;
      case "chat": if (m.name === "") this.chat.add(m.text); else this.chat.add(m.text, m.name); break;
      case "reject": {
        const k = `${m.x},${m.y},${m.z}`;
        const prev = this.pending.get(k);
        if (prev !== undefined) {
          if (this.survival) {
            // 楽観的に反映していた「設置」を巻き戻すので、使った分を返す(破壊はドロップ待ちなので何も戻さない)
            const cur = this.world.get(m.x, m.y, m.z);
            if (cur > 0 && prev === 0) this.giveItem(cur);
          }
          this.world.setBlock(m.x, m.y, m.z, prev); this.pending.delete(k);
        }
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------------------ block edit
  /** 反映できたら true */
  setLocal(x: number, y: number, z: number, b: number, drop?: number): boolean {
    const prev = this.world.get(x, y, z);
    if (prev === -1 || prev === b) return false;
    if (this.mode === "room") {
      if (!this.net.connected) { toast("サーバーに接続されていません"); return false; }
      const k = `${x},${y},${z}`;
      if (!this.pending.has(k)) this.pending.set(k, prev);
      this.net.send(drop ? { t: "set", x, y, z, b, d: drop } : { t: "set", x, y, z, b });
    }
    this.world.setBlock(x, y, z, b);
    if (this.mode !== "room") { this.updateSoloBlockBehaviors(x, y, z); this.soloRedstone.onBlockChanged(x, y, z); }
    return true;
  }

  private addSoloBlockDrop(x: number, y: number, z: number, blockId: number, toolItemId = 0) {
    const enchantments = this.itemEnchantments[String(toolItemId)] ?? {};
    const loot = getBlockDrops(blockId, B, blockItemId, { blocks: BLOCKS, stateMeta: MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID, toolItemId, enchantments });
    for (const drop of loot) {
      const eid = `solo-${++this.soloDropSeq}-${Math.random().toString(36).slice(2, 8)}`;
      this.drops.add(eid, x, y, z, drop.itemId, drop.count);
    }
  }

  /** Solo-mode equivalent of the server's block-state, support and gravity update pass. */
  private updateSoloBlockBehaviors(x: number, y: number, z: number) {
    if (this.updatingSoloBlockBehaviors) return;
    this.updatingSoloBlockBehaviors = true;
    try {
      const get = (bx: number, by: number, bz: number) => this.world.get(bx, by, bz);
      const affected = new Map<string, { x: number; y: number; z: number }>();
      for (const cell of neighborCells(x, y, z)) affected.set(`${cell.x},${cell.y},${cell.z}`, cell);
      for (let pass = 0; pass < 2; pass++) {
        let changed = false;
        for (const cell of [...affected.values()]) for (const update of resolveBlockStateChanges(get, cell.x, cell.y, cell.z)) {
          if (get(update.x, update.y, update.z) === update.id) continue;
          this.world.setBlock(update.x, update.y, update.z, update.id);
          affected.set(`${update.x},${update.y},${update.z}`, { x: update.x, y: update.y, z: update.z });
          changed = true;
        }
        for (const cell of [...affected.values()]) {
          const id = get(cell.x, cell.y, cell.z);
          if (id <= 0 || !requiresBlockSupport(id, BLOCKS) || canBlockStay(get, id, cell.x, cell.y, cell.z, BLOCKS)) continue;
          const pair = pairedBlockPosition(id, cell.x, cell.y, cell.z, BLOCKS);
          if (pair) {
            const other = get(pair.x, pair.y, pair.z);
            const samePair = other > 0 && blockToken(other, BLOCKS) === blockToken(id, BLOCKS) && (BLOCKS[id]?.shape === "door" ? BLOCKS[other]?.shape === "door" : BLOCKS[other]?.state?.part !== BLOCKS[id]?.state?.part);
            this.world.setBlock(cell.x, cell.y, cell.z, B.AIR);
            if (samePair) { this.world.setBlock(pair.x, pair.y, pair.z, B.AIR); affected.set(`${pair.x},${pair.y},${pair.z}`, pair); }
            if (this.gameMode === "survival") this.addSoloBlockDrop(cell.x, cell.y, cell.z, id);
            changed = true;
          } else {
            this.world.setBlock(cell.x, cell.y, cell.z, B.AIR);
            if (this.gameMode === "survival") this.addSoloBlockDrop(cell.x, cell.y, cell.z, id);
            changed = true;
          }
        }
        if (!changed) break;
      }
      for (let fromY = Math.max(1, y); fromY < WORLD_HEIGHT; fromY++) {
        const id = get(x, fromY, z);
        if (!isFallingBlock(id, BLOCKS)) continue;
        let landingY = fromY;
        while (landingY > 1 && isReplaceableBlock(get(x, landingY - 1, z), BLOCKS)) landingY--;
        if (landingY === fromY) continue;
        this.world.setBlock(x, fromY, z, B.AIR);
        this.world.setBlock(x, landingY, z, id);
      }
    } finally { this.updatingSoloBlockBehaviors = false; }
  }

  deny(msg = "これは壊せません") {
    const now = performance.now();
    if (now - this.lastDeny > 900) { toast(msg); this.lastDeny = now; }
  }

  doBreak() {
    if (this.gameMode === "adventure" || this.gameMode === "spectator") return;
    const t = this.target;
    if (!t) return;
    const id = this.world.get(t.x, t.y, t.z);
    if (id === B.BEDROCK || t.y < 1) { this.deny(); return; }
    const toolId = this.hotbar[this.sel] ?? 0;
    if (this.setLocal(t.x, t.y, t.z, B.AIR)) {
      if (this.mode === "solo" && (id === PORTAL_BLOCK_IDS.obsidian || id === PORTAL_BLOCK_IDS.netherPortal)) {
        for (const [x, y, z, block] of portalCollapseEdits((bx, by, bz) => this.world.get(bx, by, bz), t.x, t.y, t.z)) this.setLocal(x, y, z, block);
      }
      if (this.gameMode === "survival") {
        this.addExhaustion(0.1);
        if (this.mode === "solo") this.addSoloBlockDrop(t.x, t.y, t.z, id, toolId);
      }
    }
  }

  /** サバイバル: アイテムを所持品へ加え、Java式の64個スタックに分配する。 */
  giveItem(id: number, n = 1): number {
    if (!this.validInventoryId(id) || !Number.isFinite(n) || n <= 0) return 0;
    const requested = Math.floor(n);
    const current = this.counts[id] ?? 0;
    const capacity = this.storageCapacity(id, null);
    const accepted = Math.min(requested, this.maxInventoryCount(id) - current, capacity);
    if (accepted <= 0) { toast("インベントリに空きがありません"); return 0; }
    this.counts[id] = current + accepted;
    const left = this.moveStackToTypes(id, accepted, ["hotbar", "main"]);
    if (left > 0) this.counts[id] -= left;
    this.sendStackData();
    this.hotbarUI.refresh(); if (this.state === "inventory") this.renderInventorySlots();
    this.autosave(true);
    toast(`${BLOCKS[id].name} +${accepted}`, 700);
    return accepted;
  }

  /** 1個消費し、使用したスロットのスタックだけを1減らす。 */
  useItem(id: number) {
    if (!this.validInventoryId(id) || (this.counts[id] ?? 0) <= 0) return;
    this.counts[id] = Math.max(0, (this.counts[id] || 0) - 1);
    const preferred: InventorySlotRef[] = [
      { type: "hotbar", index: this.sel },
      ...this.inventorySlots(["hotbar", "main", "armor", "offhand"]).filter(slot => !(slot.type === "hotbar" && slot.index === this.sel)),
    ];
    const slot = preferred.find(ref => this.slotValue(ref) === id && this.slotAmount(ref) > 0);
    if (slot) {
      const amount = this.slotAmount(slot) - 1;
      this.setSlotStack(slot, amount > 0 ? id : 0, amount);
    }
    this.syncInventorySlots(); this.sendEquipment(); this.sendStackData();
    this.hotbarUI.refresh(); if (this.state === "inventory") this.renderInventorySlots();
    this.autosave(true);
  }

  /** 所持数とスロットを再照合し、無効なスタックを除去する。 */
  pruneHotbar() { this.syncInventorySlots(); }

  addExhaustion(n: number) {
    if (!this.survival) return;
    this.exhaustion += n;
    while (this.exhaustion >= 1) {
      this.exhaustion -= 1;
      if (this.hunger > 0) { this.hunger--; renderHunger(this.hunger); }
    }
  }

  updateSurvivalHud() {
    $("hearts").hidden = !this.survival;
    $("hunger").hidden = !this.survival;
    $("experience-hud").hidden = !this.survival;
    renderHearts(this.health);
    renderHunger(this.hunger);
  }

  effectAmp(id: EffectId): number { return this.vitals.activeEffects.find(e => e.effectId === id)?.amplifier ?? -1; }
  applyVitals(v: PlayerVitals, event?: "death" | "respawn") {
    const wasDead=this.vitals.dead; this.vitals=v; this.health=v.health; this.hunger=v.foodLevel;
    this.gameMode=v.gameMode; renderHearts(v.health,v.maxHealth,v.activeEffects.map(e=>e.effectId),v.absorptionAmount);
    renderHunger(v.foodLevel,v.activeEffects.some(e=>e.effectId==="hunger"));
    const xp = getExperienceProgress(v.experience ?? 0);
    $("experience-level").textContent = String(xp.level);
    $("experience-fill").style.width = `${xp.progress * 100}%`;
    $("experience-bar").setAttribute("aria-valuenow", String(Math.round(xp.progress * 100)));
    renderEffects("effects-hud",v.activeEffects);
    if (!$("inventory").hidden) { renderEffects("inventory-effects",v.activeEffects); this.renderFoodInventory(); }
    const vision=$("visionfx"); vision.className=["blindness","darkness","nausea"].filter(id=>this.effectAmp(id as EffectId)>=0).join(" ");
    this.canvas.classList.toggle("nightvision", this.effectAmp("night_vision") >= 0 || this.effectAmp("conduit_power") >= 0);
    if(event==="death"||(!wasDead&&v.dead)){this.body.vx=this.body.vy=this.body.vz=0;toast("死亡しました",2500);}
    if(event==="respawn"||(wasDead&&!v.dead)){this.body.x=this.spawn[0];this.body.y=this.spawn[1]+2;this.body.z=this.spawn[2];this.body.vx=this.body.vy=this.body.vz=0;toast("リスポーンしました",1800);}
  }

  renderFoodInventory() {
    const el=$("food-items"); if(!el)return; el.textContent="";
    const entries=Object.values(FOOD_DEFS).filter(f=>(this.vitals.foodCounts[f.id]??0)>0);
    if(!entries.length){const d=document.createElement("span");d.textContent="食料なし";el.appendChild(d);return;}
    for(const food of entries){const b=document.createElement("button");b.className="food-button";b.textContent=this.vitals.eatingFoodId===food.id?`${food.name} 食事中…`:`${food.name} ×${this.vitals.foodCounts[food.id]}`;b.title=`満腹度 +${food.foodLevel} / 隠し満腹度 +${food.saturation}`;b.disabled=!this.survival||!!this.vitals.eatingFoodId||(this.vitals.foodLevel>=20&&!food.canEatWhenFull);b.addEventListener("click",()=>this.net.send({t:"eat",foodId:food.id}));el.appendChild(b);}
  }

  /** /gamemode でルームのモードが変わったとき */
  applyGameMode(mode: GameMode) {
    if (this.gameMode === mode) return;
    this.gameMode = mode;
    this.vitals.gameMode = mode;
    this.fly = mode === "creative" || mode === "spectator";
    this.stopDig();
    if (this.survival) {
      this.pruneHotbar();
    } else {
      this.drops.clear();
      // クリエイティブに戻ったら空いたホットバー枠を初期ブロックで埋める
      this.hotbar = this.hotbar.map((h, i) => (h > 0 ? h : this.hotbar.includes(DEFAULT_HOTBAR[i]) ? 0 : DEFAULT_HOTBAR[i]));
    }
    this.peakY = this.body.y; this.wasGround = this.body.onGround;
    this.updateSurvivalHud();
    this.hotbarUI.refresh();
    toast(`ゲームモード: ${MODE_NAME[mode]}`, 2200);
    if (this.state === "paused") $("pausemsg").textContent = this.pauseText();
    if (this.state === "inventory") this.openInventory();
  }

  /** サバイバル: 左ボタン長押しでブロックを掘る */
  updateDig(dt: number) {
    const t = this.target;
    const id = t ? this.world.get(t.x, t.y, t.z) : 0;
    if (!t || id <= 0) { this.stopDig(); return; }
    if (id === B.BEDROCK || t.y < 1) { this.deny(); this.stopDig(); return; }
    const key = `${t.x},${t.y},${t.z}`;
    const toolId = this.hotbar[this.sel] ?? 0;
    if (key !== this.digKey || toolId !== this.digToolId) {
      if (this.digKey !== "" && this.mode === "room") this.net.send({ t: "dig-cancel" });
      this.digKey = key; this.digToolId = toolId; this.digT = 0;
      this.digReady = this.mode !== "room" || this.gameMode === "creative";
      if (this.mode === "room" && (this.gameMode === "survival" || this.gameMode === "adventure")) this.net.send({ t: "dig-start", x: t.x, y: t.y, z: t.z, toolItemId: toolId, slotKey: `hotbar:${this.sel}` });
    }
    if (!this.digReady) return;
    this.digT += dt;
    const need = miningTimeSeconds(id, B, this.vitals.activeEffects, toolId, BLOCKS, this.itemEnchantments, this.armorSlots, inLiquid(this.world, this.body.x, this.body.y + 0.3, this.body.z));
    const progress = Math.min(1, this.digT / need);
    const bar = $("breakbar");
    bar.hidden = false;
    (bar.firstElementChild as HTMLElement).style.width = `${progress * 100}%`;
    this.breakOverlay.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
    const stage = Math.max(0, Math.min(9, Math.floor(progress * 10)));
    for (const material of this.breakOverlay.material) material.map = this.breakTextures[stage];
    this.breakOverlay.visible = true;
    if (this.digT >= need) { this.doBreak(); this.stopDig(); }
  }
  stopDig() {
    this.breakOverlay.visible = false;
    if (this.digKey === "" && this.digT === 0) return;
    if (this.mode === "room" && this.digKey !== "") this.net.send({ t: "dig-cancel" });
    this.digKey = ""; this.digT = 0; this.digReady = false; this.digToolId = -1;
    $("breakbar").hidden = true;
  }

  hurt(n: number) {
    if ((!this.survival && this.gameMode !== "adventure") || n <= 0 || !this.ready) return;
    if(this.mode==="room"){this.net.send({t:"hurt",cause:"fall",amount:Math.min(20,n)});return;}
    const mitigated = applyArmorReduction(n, [], BLOCKS, this.itemEnchantments, "fall", this.armorSlots);
    this.health = Math.max(0, this.health - mitigated);
    renderHearts(this.health);
    if (this.health <= 0) this.die(); else toast(`ダメージ -${n / 2}♥`);
  }
  die() {
    const b = this.body;
    this.health = MAX_HP; renderHearts(this.health);
    this.hunger = MAX_HUNGER; this.exhaustion = 0; this.starveT = 0; renderHunger(this.hunger);
    b.x = this.spawn[0]; b.y = this.spawn[1] + 3; b.z = this.spawn[2]; b.vx = b.vy = b.vz = 0;
    this.peakY = b.y; this.wasGround = false;
    toast("倒れました… リスポーンします");
    this.chat.add("あなたは倒れました");
  }

  private useSelectedPotion(): boolean {
    const itemId = this.hotbar[this.sel] ?? 0;
    const potion = potionSpecForItemId(itemId, BLOCKS);
    if (!potion) return false;
    if (this.survival && (this.counts[itemId] ?? 0) <= 0) { this.deny("ポーションを持っていません"); return true; }
    if (this.mode === "room") this.net.send({ t: "use-item", itemId });
    else {
      if (potion.effectId) {
        addEffect(this.vitals, potion.effectId, potion.durationTicks, potion.amplifier);
        this.applyVitals(this.vitals);
      }
      if (this.survival) {
        this.useItem(itemId);
        const bottleId = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:glass_bottle"];
        if (bottleId) this.giveItem(bottleId);
      }
    }
    toast(potion.effectId ? `${potion.name}を使用しました` : "水入り瓶を使用しました");
    return true;
  }

  private useSelectedRocket(): boolean {
    const itemId=this.hotbar[this.sel]??0;
    if(BLOCKS[itemId]?.key!=="minecraft:firework_rocket") return false;
    if(!this.fallFlying) { toast("エリトラで滑空している間に使用できます"); return true; }
    if(this.survival && (this.counts[itemId]??0)<=0) { this.deny("ロケット花火を持っていません"); return true; }
    if(this.mode==="room" && this.net.connected) this.net.send({t:"use-item",itemId});
    else {
      if(this.survival) this.useItem(itemId);
      const cp=Math.cos(this.pitch);
      this.body.vx += -Math.sin(this.yaw)*cp*12;
      this.body.vy += -Math.sin(this.pitch)*12+1.5;
      this.body.vz += -Math.cos(this.yaw)*cp*12;
      this.autosave(true);
    }
    toast("ロケット花火で加速");
    return true;
  }

  private openEnchantingTable(x:number,y:number,z:number) {
    if(this.enchantUi) return;
    const itemId=this.hotbar[this.sel]??0;
    if(!itemId) { toast("エンチャントするアイテムを手に持ってください"); return; }
    const available=availableEnchantmentsForItemId(itemId,BLOCKS);
    const activeSlotKey=`hotbar:${this.sel}`;
    const bookshelfId=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:bookshelf"]??0;
    const bookshelfPower=countEnchantingBookshelves((bx: number, by: number, bz: number) => this.world.get(bx,by,bz),x,y,z,bookshelfId);
    if(!available.length) { toast("このアイテムに付与できるエンチャントはありません"); return; }
    const overlay=document.createElement("div");
    overlay.setAttribute("role","dialog"); overlay.setAttribute("aria-modal","true"); overlay.setAttribute("aria-label","エンチャントテーブル");
    Object.assign(overlay.style,{position:"fixed",inset:"0",zIndex:"10000",display:"grid",placeItems:"center",background:"rgba(0,0,0,.72)",padding:"18px",color:"#f5f5f5",fontFamily:"system-ui,sans-serif"});
    const panel=document.createElement("section");
    Object.assign(panel.style,{width:"min(620px,96vw)",maxHeight:"82vh",overflow:"auto",background:"#20242b",border:"1px solid #697386",borderRadius:"12px",padding:"18px",boxShadow:"0 18px 60px rgba(0,0,0,.55)"});
    const heading=document.createElement("h2"); heading.textContent="エンチャントテーブル"; Object.assign(heading.style,{margin:"0 0 6px",fontSize:"22px"}); panel.append(heading);
    const item=document.createElement("p"); item.textContent=`対象: ${BLOCKS[itemId]?.name??"アイテム"}`; Object.assign(item.style,{margin:"0 0 8px",color:"#cbd5e1"}); panel.append(item);
    const note=document.createElement("p"); note.textContent=`本棚パワー: ${bookshelfPower}/15。エンチャントは選択中のアイテムスタック単位で保存されます。レベル分の経験値レベルとラピスラズリが必要です。`; Object.assign(note.style,{margin:"0 0 14px",fontSize:"12px",color:"#aab4c4",lineHeight:"1.5"}); panel.append(note);
    const list=document.createElement("div"); Object.assign(list.style,{display:"grid",gap:"8px"});
    for(const enchantId of available) {
      const row=document.createElement("div"); Object.assign(row.style,{display:"grid",gridTemplateColumns:"1fr 90px 88px",gap:"8px",alignItems:"center",background:"#2c333e",padding:"8px",borderRadius:"8px"});
      const name=document.createElement("div"); const current=Number(this.getStackEnchantments(activeSlotKey,itemId)[enchantId]??0); name.textContent=`${ENCHANTMENT_LABELS[enchantId]??enchantId}${current?`  (現在 ${current})`:""}`; name.style.fontSize="13px";
      const select=document.createElement("select"); Object.assign(select.style,{padding:"7px",borderRadius:"6px",background:"#151a22",color:"white",border:"1px solid #667085"});
      for(let lv=1;lv<=ENCHANTMENT_MAX_LEVEL[enchantId];lv++){const o=document.createElement("option");o.value=String(lv);o.textContent=`Lv ${lv}`;select.append(o);}
      const apply=document.createElement("button"); apply.type="button";apply.textContent="付与";Object.assign(apply.style,{padding:"8px 10px",borderRadius:"6px",border:"0",background:"#4d73c7",color:"white",cursor:"pointer",fontWeight:"600"});
      apply.addEventListener("click",()=>this.applyEnchantmentAtTable(x,y,z,itemId,enchantId,Number(select.value),activeSlotKey));
      row.append(name,select,apply);list.append(row);
    }
    panel.append(list);
    const close=document.createElement("button");close.type="button";close.textContent="閉じる";Object.assign(close.style,{marginTop:"14px",padding:"9px 16px",borderRadius:"7px",border:"1px solid #778195",background:"#141820",color:"white",cursor:"pointer"});close.addEventListener("click",()=>this.closeEnchantingTable());panel.append(close);
    overlay.addEventListener("mousedown",e=>e.stopPropagation());overlay.addEventListener("click",e=>{if(e.target===overlay)this.closeEnchantingTable();});
    overlay.append(panel);document.body.append(overlay);this.enchantUi=overlay;
  }

  private closeEnchantingTable() { this.enchantUi?.remove(); this.enchantUi=null; }

  private inventoryStackChoices() {
    const slots: { key: string; label: string; record: any }[] = [];
    const refs = this.inventorySlots(["hotbar", "main", "armor", "offhand"]);
    for (const slot of refs) {
      const id = this.slotValue(slot), count = this.slotAmount(slot), key = slotKey(slot.type, slot.index);
      if (!id || count !== 1 || !key) continue;
      const stored = this.stackData[key];
      const record = stored?.itemId === id ? { ...stored, count: 1 } : makeStackRecord(id, 1);
      slots.push({ key, label: `${slot.type} ${slot.index + 1}: ${BLOCKS[id]?.name ?? BLOCKS[id]?.key ?? id}`, record });
    }
    return slots;
  }

  private openWorkstationPanel(kind: "anvil" | "grindstone", x: number, y: number, z: number) {
    if (this.enchantUi) return;
    const options = this.inventoryStackChoices();
    if (!options.length) { toast("対象アイテムを1個ずつに分けてインベントリに置いてください"); return; }
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", kind === "anvil" ? "金床" : "砥石");
    Object.assign(overlay.style, { position:"fixed", inset:"0", zIndex:"10000", display:"grid", placeItems:"center", background:"rgba(0,0,0,.72)", padding:"18px", color:"#f5f5f5", fontFamily:"system-ui,sans-serif" });
    const panel = document.createElement("section");
    Object.assign(panel.style, { width:"min(560px,96vw)", maxHeight:"82vh", overflow:"auto", background:"#20242b", border:"1px solid #697386", borderRadius:"12px", padding:"18px", boxShadow:"0 18px 60px rgba(0,0,0,.55)" });
    const heading = document.createElement("h2"); heading.textContent = kind === "anvil" ? "金床" : "砥石";
    Object.assign(heading.style, { margin:"0 0 12px", fontSize:"22px" }); panel.append(heading);
    const makeSelect = (labelText: string, optional = false) => {
      const wrap = document.createElement("label"); Object.assign(wrap.style,{display:"grid",gap:"6px",marginBottom:"10px",fontSize:"13px",color:"#cbd5e1"});
      const label = document.createElement("span"); label.textContent = labelText;
      const select = document.createElement("select"); Object.assign(select.style,{padding:"9px",borderRadius:"6px",background:"#151a22",color:"white",border:"1px solid #667085",width:"100%"});
      if (optional) { const o=document.createElement("option"); o.value=""; o.textContent="なし"; select.append(o); }
      for (const entry of options) { const o=document.createElement("option"); o.value=entry.key; o.textContent=entry.label; select.append(o); }
      wrap.append(label,select); panel.append(wrap); return select;
    };
    const first = makeSelect("対象アイテム");
    const second = makeSelect(kind === "anvil" ? "合成アイテム／エンチャント本" : "修理用アイテム（任意）", true);
    if (options.length > 1) second.value = options[1].key;
    let rename: HTMLInputElement | null = null;
    if (kind === "anvil") {
      const wrap=document.createElement("label"); Object.assign(wrap.style,{display:"grid",gap:"6px",marginBottom:"12px",fontSize:"13px",color:"#cbd5e1"});
      const label=document.createElement("span"); label.textContent="新しい名前（任意・最大50文字）";
      rename=document.createElement("input"); rename.type="text"; rename.maxLength=50; rename.placeholder="アイテム名";
      Object.assign(rename.style,{padding:"9px",borderRadius:"6px",background:"#151a22",color:"white",border:"1px solid #667085",width:"100%"});
      wrap.append(label,rename); panel.append(wrap);
    }
    const note=document.createElement("p"); note.textContent=kind === "anvil" ? "合成と名前変更は経験値レベルを消費します。エンチャント・耐久値・修理コストはアイテムスタック単位で保存されます。" : "通常エンチャントを解除し、呪いは残します。2つの同種アイテムを入れると耐久値を修復します。";
    Object.assign(note.style,{fontSize:"12px",color:"#9ca3af",lineHeight:"1.5"}); panel.append(note);
    const actions=document.createElement("div"); Object.assign(actions.style,{display:"flex",gap:"8px",flexWrap:"wrap",marginTop:"14px"});
    const button=(label:string,fn:()=>void,primary=false)=>{const b=document.createElement("button");b.type="button";b.textContent=label;Object.assign(b.style,{padding:"9px 14px",borderRadius:"7px",border:"1px solid #778195",background:primary?"#4d73c7":"#141820",color:"white",cursor:"pointer",fontWeight:"600"});b.addEventListener("click",fn);actions.append(b);};
    const perform=(operation:"combine"|"rename"|"grindstone")=>{
      const firstKey=first.value, secondKey=second.value;
      if(!firstKey || (operation!=="rename" && secondKey===firstKey)) { toast("異なるアイテムスロットを選択してください"); return; }
      const firstRecord=options.find(o=>o.key===firstKey)?.record;
      const secondRecord=options.find(o=>o.key===secondKey)?.record;
      if(!firstRecord) return;
      if(this.mode==="room" && this.net.connected) {
        if(operation==="grindstone") this.net.send({t:"grindstone",x,y,z,firstSlot:firstKey,...(secondKey?{secondSlot:secondKey}:{})});
        else this.net.send({t:"anvil",x,y,z,operation,firstSlot:firstKey,...(operation==="combine"&&secondKey?{secondSlot:secondKey}:{}),...(operation==="rename"?{rename:rename?.value??""}:{})});
        this.closeEnchantingTable(); return;
      }
      let result:any, cost=0;
      if(operation==="rename") {
        const name=(rename?.value??"").replace(/[\u0000-\u001f]/g,"").trim().slice(0,50);
        if(!name || name===firstRecord.customName) { toast("新しい名前を入力してください"); return; }
        cost=Math.max(1,Number(firstRecord.repairCost??0)+1);
        result={...firstRecord,customName:name,repairCost:Math.min(127,Number(firstRecord.repairCost??0)*2+1)};
      } else if(operation==="combine") {
        if(!secondRecord) return;
        const joined=combineAnvilStacks(firstRecord,secondRecord,{blocks:BLOCKS,maxDamage:maxDurabilityForItemKey(BLOCKS[firstRecord.itemId]?.key),rename:rename?.value??""});
        if(!joined.ok) { toast(joined.reason==="too_expensive"?"コストが高すぎます":"この組み合わせは使えません"); return; }
        result=joined.result; cost=joined.cost;
      } else {
        const cleaned=grindstoneStack(firstRecord,secondRecord??null,maxDurabilityForItemKey(BLOCKS[firstRecord.itemId]?.key)); if(!cleaned.ok) return; result=cleaned.result;
        this.vitals.experience=(this.vitals.experience??0)+(cleaned.experience ?? 0);
      }
      if(this.gameMode!=="creative" && operation!=="grindstone") {
        const progress=getExperienceProgress(this.vitals.experience??0);
        if(progress.level<cost) { toast(`経験値レベル${cost}が必要です`); return; }
        this.vitals.experience=experienceThreshold(Math.max(0,progress.level-cost))+progress.pointsInLevel;
      }
      this.stackData={...this.stackData,[firstKey]:result};
      if(operation!=="rename" && secondKey) {
        delete this.stackData[secondKey];
        const secondId=secondRecord?.itemId??0;
        if(secondId>0) this.counts[secondId]=Math.max(0,(this.counts[secondId]??0)-1);
        this.syncInventorySlots();
      }
      this.sendStackData(); this.autosave(true); this.applyVitals(this.vitals); this.closeEnchantingTable();
      toast(operation==="grindstone"?"砥石で処理しました":"金床で処理しました");
    };
    if(kind==="anvil") { button("修理・合成",()=>perform("combine"),true); button("名前変更",()=>perform("rename")); }
    else button("砥石で処理",()=>perform("grindstone"),true);
    button("閉じる",()=>this.closeEnchantingTable()); panel.append(actions);
    overlay.addEventListener("mousedown",e=>e.stopPropagation()); overlay.addEventListener("click",e=>{if(e.target===overlay)this.closeEnchantingTable();});
    overlay.append(panel); document.body.append(overlay); this.enchantUi=overlay;
  }

  private applyEnchantmentAtTable(x:number,y:number,z:number,itemId:number,enchantmentId:string,level:number,activeSlotKey=`hotbar:${this.sel}`) {
    if(this.hotbar[this.sel]!==itemId) { this.closeEnchantingTable(); toast("手持ちアイテムが変わりました"); return; }
    if(this.mode==="room" && this.net.connected) {
      this.net.send({t:"enchant",x,y,z,itemId,enchantmentId,level,costLevel:Math.min(3,Math.max(1,level)),slotKey:activeSlotKey});
      this.closeEnchantingTable();
      return;
    }
    const updated=setStackEnchantment(this.stackData,activeSlotKey,itemId,this.hotbarAmounts[this.sel]||1,enchantmentId,level,BLOCKS);
    if(!updated) { toast("そのエンチャントの組み合わせは無効です"); return; }
    if(this.gameMode!=="creative") {
      const costLevel=Math.min(3,Math.max(1,level));
      const lapisId=MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:lapis_lazuli"]??0;
      const progress=getExperienceProgress(this.vitals.experience??0);
      if((this.counts[itemId]??0)<=0) { toast("対象アイテムを持っていません"); return; }
      if(!lapisId || (this.counts[lapisId]??0)<costLevel) { toast("ラピスラズリが足りません"); return; }
      if(progress.level<costLevel) { toast(`経験値レベル${costLevel}が必要です`); return; }
      this.vitals.experience=experienceThreshold(Math.max(0,progress.level-costLevel))+progress.pointsInLevel;
      this.counts[lapisId]=Math.max(0,this.counts[lapisId]-costLevel);
      this.syncInventorySlots(); this.applyVitals(this.vitals);
    }
    this.stackData=updated;this.sendStackData();this.autosave(true);this.closeEnchantingTable();
    toast(`${ENCHANTMENT_LABELS[enchantmentId]??enchantmentId} ${level} を付与しました`);
  }

  private castOrReelLocalFishing(rodItemId: number) {
    if (this.localFishing) {
      const active=this.localFishing;
      if(active.state==="waiting") {
        this.projectileEntities.removeBobber(active.id);this.localFishing=null;toast("釣り糸を回収しました");return;
      }
      const ench=withStackEnchantments(this.itemEnchantments,this.stackData,active.slotKey,rodItemId);
      const loot=rollFishingLootEntry(getItemEnchantment(ench,rodItemId,"luck_of_the_sea"),Math.random,{openWater:active.openWater,biome:""});
      const lootId=MINECRAFT_ITEM_TO_RUNTIME_ID[`minecraft:${loot.itemKey}`]??MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:cod"]??0;
      if(lootId>0)this.giveItem(lootId,loot.count??1);
      this.vitals.experience=addExperience(this.vitals.experience??0,1+Math.floor(Math.random()*6));this.applyVitals(this.vitals);
      const record=stackDataForSlot(this.stackData,active.slotKey,rodItemId,this.hotbarAmounts[this.sel]||1)??makeStackRecord(rodItemId,1);
      const unbreaking=getItemEnchantment(ench,rodItemId,"unbreaking");
      if(shouldApplyDurabilityDamage(unbreaking)) {
        const damage=damageStackRecord(record,1,maxDurabilityForItemKey("minecraft:fishing_rod"));
        if(damage.broken) { this.stackData={...this.stackData};delete this.stackData[active.slotKey];this.useItem(rodItemId);toast("釣り竿が壊れました"); }
        else this.stackData={...this.stackData,[active.slotKey]:damage.record!};
        this.sendStackData();
      }
      this.projectileEntities.removeBobber(active.id);this.localFishing=null;this.autosave(true);toast(`${BLOCKS[lootId]?.name??loot.itemKey} を釣り上げました`);return;
    }
    const yaw=this.yaw,pitch=this.pitch,cp=Math.cos(pitch),dx=-Math.sin(yaw)*cp,dy=-Math.sin(pitch),dz=-Math.cos(yaw)*cp;
    const waterIds=new Set([B.WATER,MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:water"]??0].filter(id=>id>0));
    let found:{x:number;y:number;z:number}|null=null;
    for(let distance=1;distance<=14;distance+=.2){const x=Math.floor(this.body.x+dx*distance),y=Math.floor(this.body.y+1.45+dy*distance),z=Math.floor(this.body.z+dz*distance);if(waterIds.has(this.world.get(x,y,z))){found={x,y,z};break;}}
    if(!found){toast("水面に向けて釣り竿を使ってください");return;}
    const slot=`hotbar:${this.sel}`,ench=withStackEnchantments(this.itemEnchantments,this.stackData,slot,rodItemId),lure=getItemEnchantment(ench,rodItemId,"lure");
    const openWater=isFishingOpenWater((x:number,y:number,z:number)=>this.world.get(x,y,z),found.x,found.y,found.z,[...waterIds]);
    const session={id:`local-bobber-${Math.random().toString(36).slice(2,12)}`,x:found.x+.5,y:found.y+.88,z:found.z+.5,state:"waiting" as const,biteAt:Date.now()+fishingBiteDelay(lure),rodItemId,slotKey:slot,openWater};
    this.localFishing=session;this.projectileEntities.addBobber(session.id,session.x,session.y,session.z,"waiting");toast("釣り糸を垂らしました。浮きが沈むのを待ってください");
  }

  private updateLocalFishing(now: number) {
    const active=this.localFishing;if(!active)return;
    if(Math.hypot(this.body.x-active.x,this.body.z-active.z)>32){this.projectileEntities.removeBobber(active.id);this.localFishing=null;return;}
    if(active.state==="waiting" && now>=active.biteAt){active.state="bite";this.projectileEntities.addBobber(active.id,active.x,active.y,active.z,"bite");toast("魚が食いついた！右クリック！");}
  }

  /** Open/close doors, trapdoors and fence gates using their real block-state variants. */
  private toggleLocalBlock(x: number, y: number, z: number, id: number): boolean {
    const def = BLOCKS[id]; if (!def) return false;
    if (def.shape === "trapdoor" || def.shape === "door" && def.key.includes("_fence_gate")) {
      if (this.mode === "room") this.net.send({ t: "use", x, y, z });
      else { const next = blockStateVariantId(id, { open: def.state?.open !== true }); if (next !== id) this.setLocal(x, y, z, next); }
      return true;
    }
    if (def.shape !== "door") return false;
    const lowerY = def.state?.half === "upper" ? y - 1 : y;
    const lower = this.world.get(x, lowerY, z), upper = this.world.get(x, lowerY + 1, z);
    if (BLOCKS[lower]?.shape !== "door" || BLOCKS[upper]?.shape !== "door") return true;
    if (this.mode === "room") { this.net.send({ t: "use", x, y, z }); return true; }
    const open = BLOCKS[lower]?.state?.open !== true;
    const lowerNext = blockStateVariantId(lower, { open }), upperNext = blockStateVariantId(upper, { open });
    if (lowerNext !== lower) this.setLocal(x, lowerY, z, lowerNext);
    if (upperNext !== upper) this.setLocal(x, lowerY + 1, z, upperNext);
    return true;
  }

  private placeDoor(itemId: number, x: number, y: number, z: number) {
    if (y < 1 || y + 1 >= WORLD_HEIGHT) return;
    if (this.gameMode === "survival" && (this.counts[itemId] ?? 0) <= 0) { this.deny("そのドアを持っていません"); return; }
    const lowerCurrent = this.world.get(x, y, z), upperCurrent = this.world.get(x, y + 1, z);
    if (!isReplaceableBlock(lowerCurrent, BLOCKS) || !isReplaceableBlock(upperCurrent, BLOCKS) || !BLOCKS[this.world.get(x, y - 1, z)]?.solid) return;
    const body = this.body, hw = PLAYER_W / 2;
    const overlaps = (cy: number) => body.x + hw > x && body.x - hw < x + 1 && body.y + PLAYER_H > cy && body.y < cy + 1 && body.z + hw > z && body.z - hw < z + 1;
    if (overlaps(y) || overlaps(y + 1)) return;
    const lower = blockPlacementId(itemId, this.yaw, "bottom");
    if (!lower || BLOCKS[lower]?.shape !== "door" || BLOCKS[lower]?.key.includes("_fence_gate")) return;
    const upper = blockStateVariantId(lower, { half: "upper" });
    if (!upper) return;
    if (this.mode === "room") {
      if (!this.net.connected) return;
      for (const [bx, by, bz, old] of [[x,y,z,lowerCurrent],[x,y+1,z,upperCurrent]] as const) { const key = `${bx},${by},${bz}`; if (!this.pending.has(key)) this.pending.set(key, old); }
      this.world.setBlock(x, y, z, lower); this.world.setBlock(x, y + 1, z, upper);
      this.net.send({ t: "place-door", x, y, z, blockId: lower });
    } else { this.world.setBlock(x, y, z, lower); this.world.setBlock(x, y + 1, z, upper); this.updateSoloBlockBehaviors(x, y, z); }
    if (this.gameMode === "survival" && this.mode === "solo") this.useItem(itemId);
  }

  private placeBed(itemId: number, footId: number, x: number, y: number, z: number) {
    if (y < 1 || y >= WORLD_HEIGHT || this.gameMode === "survival" && (this.counts[itemId] ?? 0) <= 0) return;
    const facing = String(BLOCKS[footId]?.state?.facing ?? "north");
    const [dx, dz] = ({ north: [0,-1], east: [1,0], south: [0,1], west: [-1,0] } as Record<string,[number,number]>)[facing] ?? [0,-1];
    const hx = x + dx, hz = z + dz, head = blockStateVariantId(footId, { part: "head" });
    const replaceable = (id: number) => isReplaceableBlock(id, BLOCKS);
    if (!head || head === footId && BLOCKS[head]?.state?.part !== "head" || !replaceable(this.world.get(x,y,z)) || !replaceable(this.world.get(hx,y,hz)) || !BLOCKS[this.world.get(x,y-1,z)]?.solid || !BLOCKS[this.world.get(hx,y-1,hz)]?.solid) return;
    const body = this.body, hw = PLAYER_W / 2;
    const overlaps = (bx:number,bz:number) => body.x+hw>bx && body.x-hw<bx+1 && body.y+PLAYER_H>y && body.y<y+1 && body.z+hw>bz && body.z-hw<bz+1;
    if (overlaps(x,z) || overlaps(hx,hz)) return;
    if (this.mode === "room") {
      if (!this.net.connected) return;
      const a = `${x},${y},${z}`, b = `${hx},${y},${hz}`;
      if (!this.pending.has(a)) this.pending.set(a, this.world.get(x,y,z)); if (!this.pending.has(b)) this.pending.set(b, this.world.get(hx,y,hz));
      this.world.setBlock(x,y,z,footId); this.world.setBlock(hx,y,hz,head);
      this.net.send({ t: "place-bed", x, y, z, blockId: footId }); return;
    }
    this.world.setBlock(x,y,z,footId); this.world.setBlock(hx,y,hz,head);
    this.updateSoloBlockBehaviors(x,y,z); this.updateSoloBlockBehaviors(hx,y,hz);
    if (this.gameMode === "survival") this.useItem(itemId);
  }

  doPlace() {
    if (this.useSelectedRocket()) return;
    if (this.useSelectedPotion()) return;
    const selectedItemId=this.hotbar[this.sel]??0;
    const selectedKey=BLOCKS[selectedItemId]?.key??"";
    if(selectedKey==="minecraft:fishing_rod") {
      if(this.fishingRightHeld)return;
      this.fishingRightHeld=true;
      if(this.mode==="room"&&this.net.connected)this.net.send({t:"fish",itemId:selectedItemId,slotKey:`hotbar:${this.sel}`});
      else this.castOrReelLocalFishing(selectedItemId);
      return;
    }
    if (this.gameMode === "adventure" || this.gameMode === "spectator") return;
    const t = this.target;
    if (!t) return;
    const existing = this.world.get(t.x, t.y, t.z);
    const existingKey = BLOCKS[existing]?.key ?? "";
    if (existingKey === "minecraft:crafting_table") { this.openWorkbench(t.x, t.y, t.z); return; }
    if (selectedKey === "minecraft:flint_and_steel") {
      if (existing !== PORTAL_BLOCK_IDS.obsidian) { this.deny("火打ち石と打ち金は黒曜石の枠に使用します"); return; }
      const edits = tryLightPortal((x, y, z) => this.world.get(x, y, z), { x: t.x, y: t.y, z: t.z, nx: t.nx, ny: t.ny, nz: t.nz });
      if (!edits) { this.deny("黒曜石の枠が正しくないか、内部に空間がありません"); return; }
      if (this.mode === "room") {
        if (this.net.connected) this.net.send({ t: "use", x: t.x, y: t.y, z: t.z, itemId: selectedItemId, nx: t.nx, ny: t.ny, nz: t.nz, slotKey: `hotbar:${this.sel}` });
      } else {
        for (const [x, y, z, block] of edits) this.setLocal(x, y, z, block);
        if (this.gameMode === "survival") {
          const key = `hotbar:${this.sel}`;
          const record = stackDataForSlot(this.stackData, key, selectedItemId, this.hotbarAmounts[this.sel] || 1) ?? makeStackRecord(selectedItemId, 1);
          const ench = withStackEnchantments(this.itemEnchantments, this.stackData, key, selectedItemId);
          if (shouldApplyDurabilityDamage(getItemEnchantment(ench, selectedItemId, "unbreaking"))) {
            const damage = damageStackRecord(record, 1, maxDurabilityForItemKey("minecraft:flint_and_steel"));
            if (damage.broken) { const next = { ...this.stackData }; delete next[key]; this.stackData = next; this.useItem(selectedItemId); toast("火打ち石と打ち金が壊れました"); }
            else this.stackData = { ...this.stackData, [key]: damage.record! };
            this.sendStackData(); this.autosave(true);
          }
        }
      }
      return;
    }
    if (["minecraft:furnace", "minecraft:blast_furnace", "minecraft:smoker"].includes(existingKey)) {
      if (this.mode === "room" && this.net.connected) this.net.send({ t: "use", x: t.x, y: t.y, z: t.z });
      else toast("かまどはマルチルームで操作できます");
      return;
    }
    if (BLOCKS[existing]?.key === "minecraft:enchanting_table") { this.openEnchantingTable(t.x,t.y,t.z); return; }
    if (this.toggleLocalBlock(t.x, t.y, t.z, existing)) return;
    if (["minecraft:anvil","minecraft:chipped_anvil","minecraft:damaged_anvil"].includes(BLOCKS[existing]?.key ?? "")) { this.openWorkstationPanel("anvil",t.x,t.y,t.z); return; }
    if (BLOCKS[existing]?.key === "minecraft:grindstone") { this.openWorkstationPanel("grindstone",t.x,t.y,t.z); return; }
    if(selectedKey==="minecraft:end_crystal") {
      if(this.mode==="room"&&this.net.connected)this.net.send({t:"end-crystal-place",x:t.x,y:t.y,z:t.z,itemId:selectedItemId});
      else toast("エンドクリスタルの復活儀式はルームのエンドで利用できます");
      return;
    }
    if (existing === B.REDSTONE_LEVER_OFF || existing === B.REDSTONE_LEVER_ON) {
      if (this.mode === "room") this.net.send({ t: "use", x: t.x, y: t.y, z: t.z });
      else this.setLocal(t.x, t.y, t.z, existing === B.REDSTONE_LEVER_OFF ? B.REDSTONE_LEVER_ON : B.REDSTONE_LEVER_OFF);
      return;
    }
    if (existing >= B.REDSTONE_REPEATER && existing < B.REDSTONE_REPEATER + 16) {
      const repeaterIds = Array.from({ length: 16 }, (_, i) => B.REDSTONE_REPEATER + i);
      const next = nextRepeaterDelayBlockId(existing, repeaterIds);
      if (next !== undefined) {
        if (this.mode === "room") this.net.send({ t: "use", x: t.x, y: t.y, z: t.z });
        else this.setLocal(t.x, t.y, t.z, next);
        toast(`リピーター遅延: ${Math.floor((next - B.REDSTONE_REPEATER) / 4) + 1} tick`);
      }
      return;
    }
    const itemId = this.hotbar[this.sel];
    if (!itemId) return;
    if (this.survival && this.counts[itemId] <= 0) { this.deny("そのブロックを持っていません"); return; }
    if (!BLOCKS[itemId]?.placeable || BLOCKS[itemId]?.itemOnly) { this.deny("このアイテムはまだ設置・使用できません"); return; }
    const itemDef = BLOCKS[itemId];
    if (!itemDef?.placeable || itemDef.itemOnly) { this.deny("このアイテムはまだ設置・使用できません"); return; }
    const placementHalf = t.ny === -1 ? "top" : "bottom";
    let id = blockPlacementId(itemId, this.yaw, placementHalf);
    if (itemDef.key === "minecraft:vine") {
      const supportFace = t.nx === 1 ? "west" : t.nx === -1 ? "east" : t.nz === 1 ? "north" : t.nz === -1 ? "south" : t.ny === -1 ? "up" : "";
      if (!supportFace) { this.deny("ツタはブロックの側面または下面に設置してください"); return; }
      id = blockStateVariantId(itemId, { [supportFace]: true });
    }
    if (!id || id > BLOCK_COUNT) { this.deny("このアイテムは設置できません"); return; }
    const replaceHit = isReplaceableBlock(existing, BLOCKS);
    const x = replaceHit ? t.x : t.x + t.nx, y = replaceHit ? t.y : t.y + t.ny, z = replaceHit ? t.z : t.z + t.nz;
    if (itemDef.shape === "door" && !itemDef.key.includes("_fence_gate")) { this.placeDoor(itemId, x, y, z); return; }
    if (itemDef.key.startsWith("minecraft:") && itemDef.key.endsWith("_bed")) { this.placeBed(itemId, id, x, y, z); return; }
    if (y < 1 || y >= WORLD_HEIGHT) return;
    if (!canPlaceBlockAt((bx, by, bz) => this.world.get(bx, by, bz), id, x, y, z, BLOCKS)) { this.deny("設置場所または支えブロックが適切ではありません"); return; }
    if (BLOCKS[id].solid) {
      const b = this.body, hw = PLAYER_W / 2;
      if (b.x + hw > x && b.x - hw < x + 1 && b.y + PLAYER_H > y && b.y < y + 1 && b.z + hw > z && b.z - hw < z + 1) return;
    }
    if (this.setLocal(x, y, z, id) && this.gameMode === "survival" && this.mode === "solo") this.useItem(itemId);
  }

  doPick() {
    const t = this.target;
    if (!t) return;
    const id = this.world.get(t.x, t.y, t.z);
    if (id <= 0 || id === B.BEDROCK) return;
    const itemId = blockItemId(id);
    if (this.survival) {
      const have = this.hotbar.indexOf(itemId);
      if (have >= 0) { this.sel = have; this.hotbarUI.refresh(); this.showHeld(); }
      else if ((this.counts[itemId] ?? 0) > 0) { this.setSlotValue({ type: "hotbar", index: this.sel }, itemId); this.syncInventorySlots(); this.hotbarUI.refresh(); this.showHeld(); }
      else toast("そのブロックを持っていません");
      return;
    }
    this.setSlotValue({ type: "hotbar", index: this.sel }, itemId);
    this.hotbarUI.refresh();
    this.showHeld();
  }

  // ------------------------------------------------------------ save
  playerSave(): PlayerSave {
    const base: PlayerSave = { pos: [this.body.x, this.body.y, this.body.z], yaw: this.yaw, pitch: this.pitch, hotbar: [...this.hotbar], sel: this.sel };
    base.counts = [...this.counts]; base.health = this.health; base.hunger = this.hunger;
    base.mainInventory = [...this.mainInventory]; base.hotbarAmounts = [...this.hotbarAmounts]; base.mainInventoryAmounts = [...this.mainInventoryAmounts];
    base.armorSlots = [...this.armorSlots]; base.armorAmounts = [...this.armorAmounts]; base.offhand = this.offhand; base.offhandAmount = this.offhandAmount;
    base.craftGrid = [...this.craftGrid]; base.craftGridAmounts = [...this.craftGridAmounts];
    base.cursorItem = this.cursorItem; base.cursorCount = this.cursorCount;
    base.itemEnchantments = this.itemEnchantments; base.stackData = this.stackData; base.elytraDamage = this.elytraDamage;
    return base;
  }

  autosave(force = false) {
    if (!this.ready) return;
    if (this.mode === "solo") {
      saveSolo({ v: 1, seed: this.world.seed, worldgenVersion: this.world.worldgenVersion, dimensionId: this.world.dimensionId, edits: this.world.exportEdits(), dimensionEdits: this.world.exportDimensionEdits(), time: this.time, player: this.playerSave(), spawn: [...this.spawn] as [number, number, number], redstone: this.soloRedstone.snapshot(), savedAt: Date.now() });
    } else if (this.roomCode) {
      saveRoomPlayer(this.roomCode, this.playerSave());
    }
    this.lastAutosave = performance.now();
    void force;
  }

  manualSave() {
    this.autosave(true);
    $("pausemsg").textContent = this.mode === "solo" ? "セーブしました" : "プレイヤー位置を保存しました（ワールドはサーバーに自動保存されています）";
  }

  manualLoad() {
    if (this.mode === "solo") {
      const s = loadSolo();
      if (!s) { $("pausemsg").textContent = "セーブデータがありません"; return; }
      this.world.reset(s.seed, normalizeWorldgenVersion(s.worldgenVersion ?? LEGACY_WORLDGEN_VERSION), s.dimensionId ?? DIMENSION_IDS.OVERWORLD);
      this.view.clear();
      if (s.dimensionEdits) this.world.importDimensionEdits(s.dimensionEdits, s.edits);
      else this.world.importEdits(s.edits);
      this.time = s.time;
      this.applyPlayerSave(s.player);
      // Older saves have no circuit snapshot; malformed optional circuit state must not block world loading.
      this.soloRedstone.clear();
      if (s.redstone) {
        try { this.soloRedstone.restore(s.redstone); }
        catch { this.soloRedstone.clear(); }
      }
      this.ready = false;
      this.state = "loading";
      $("pause").hidden = true;
      this.beginLoading("ロード中…");
    } else {
      const p = loadRoomPlayer(this.roomCode);
      if (!p) { $("pausemsg").textContent = "保存済みの位置がありません"; return; }
      this.applyPlayerSave(p);
      $("pausemsg").textContent = "保存した位置に戻りました";
    }
  }

  // ------------------------------------------------------------ frame
  frame(now: number) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    if (this.state === "title") {
      this.renderer.setClearColor(new THREE.Color(0.06, 0.08, 0.13));
      this.renderer.clear();
      return;
    }

    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc >= 0.5) {
      this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0;
      if (this.settings.autoOptimize && this.ready && this.state !== "paused") {
        const nextDistance = this.performanceTuner.sample(this.settings.rd, this.fps);
        if (nextDistance !== null && nextDistance !== this.settings.rd) {
          this.settings = { ...this.settings, rd: nextDistance, profile: "custom" };
          this.view.renderDistance = nextDistance;
          $<HTMLInputElement>("rd").value = String(nextDistance);
          $("rdval").textContent = String(nextDistance);
          $<HTMLSelectElement>("quality-level").value = "custom";
          try { localStorage.setItem(K_SETTINGS, JSON.stringify(this.settings)); } catch { /* 保存不可 */ }
        }
      }
    }

    if (this.mobileControls) this.mobileControls.hidden = this.state !== "playing";
    const loading = this.state === "loading";
    this.view.update(this.body.x, this.body.z, this.settings.chunkGenBudget, this.settings.chunkMeshBudget);

    if (loading && !this.ready) {
      const r = this.view.readyRatio(this.body.x, this.body.z, 2);
      $("loadbar").style.width = `${Math.round(5 + r * 95)}%`;
      if (r >= 0.99 || performance.now() - this.loadStart > 10000) this.finishLoading();
    }

    if (this.ready) {
      if (this.mode !== "room" && this.state !== "paused") this.soloRedstone.advance(dt);
      if (this.mode === "solo") this.updateLocalFishing(Date.now());
      this.updatePlayer(dt, now);
      this.updateTarget(now);
      // ドロップの更新と回収。ルームではサーバー、ソロではローカル所持品へ反映する。
      const picks = this.drops.update(dt, this.world, this.body.x, this.body.y, this.body.z, this.survival || (this.mode === "solo" && this.gameMode === "survival"));
      for (const eid of picks) {
        if (this.mode === "room" && this.net.connected) {
          this.net.send({ t: "pickup", eid });
          continue;
        }
        if (this.mode === "solo") {
          const itemId = this.drops.blockOf(eid), count = this.drops.countOf(eid);
          if (itemId !== null && count > 0) {
            const accepted = this.giveItem(itemId, count);
            if (accepted >= count) this.drops.remove(eid);
            else if (accepted > 0) this.drops.setCount(eid, count - accepted);
          }
        }
      }
      if (now - this.lastAutosave > 15000) this.autosave();
      if (this.mode === "room") this.sendPos(now);
    }

    // 時間と空
    this.time = this.mode === "room" && this.ready ? this.roomTime() : (this.time + dt / DAY_LENGTH_SEC) % 1;
    const sky = skyAt(this.time);
    const eye = this.camera.position;
    const under = this.ready && inLiquid(this.world, eye.x, eye.y, eye.z);
    $("underwater").hidden = !under;
    let fog: [number, number, number] = sky.skyColor;
    const far = Math.max(40, this.settings.rd * 16 - 6);
    let near = far * 0.55, farD = far;
    if (under) { fog = [0.12 * sky.light[0], 0.28 * sky.light[1], 0.55 * sky.light[2]]; near = 1; farD = 30; }
    this.renderer.setClearColor(new THREE.Color(fog[0], fog[1], fog[2]));
    this.view.uniforms.uFog.value.set(fog[0], fog[1], fog[2]);
    this.view.uniforms.uLight.value.set(sky.light[0], sky.light[1], sky.light[2]);
    this.view.setFog(near, farD);
    this.sky.group.visible = !under;
    this.sky.update(this.time, this.camera, sky);

    this.remotes.update(dt, 0.3 + 0.7 * sky.daylight);
    this.mobModels.update(now / 1000);
    this.mobModels.setRenderDistance?.(this.body.x, this.body.y, this.body.z, this.settings.entityRenderDistance);
    this.projectileEntities.update();
    this.drops.setLight(0.3 + 0.7 * sky.daylight);
    this.updateOwnModel(dt, sky.daylight);
    this.updateInfo();
    this.effectParticles.update(dt, this.body, this.vitals.activeEffects);
    this.checkPortal(now);
    this.renderer.render(this.scene, this.camera);
  }

  updatePlayer(dt: number, now: number) {
    const b = this.body;
    const active = this.state === "playing";
    const k = this.keys;
    if (!this.world.hasChunkAt(b.x, b.z)) return;

    const ix = active ? (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0) : 0;
    const iz = active ? (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0) : 0;
    this.sneaking = active && k.has("KeyC") && !this.fly && this.gameMode !== "spectator";
    let sprint = active && (k.has("ShiftLeft") || k.has("ShiftRight"));
    if (this.survival && !canSprint(this.vitals)) sprint = false;
    if (this.sneaking) sprint = false;
    this.eyeH += ((this.sneaking ? 1.27 : EYE_H) - this.eyeH) * Math.min(1, dt * 14);
    const jump = active && k.has("Space");
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let wx = -sin * iz + cos * ix, wz = -cos * iz - sin * ix;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }

    const feetWater = inLiquid(this.world, b.x, b.y + 0.3, b.z);
    const headWater = inLiquid(this.world, b.x, b.y + 1.4, b.z);
    let speed = 4.4;
    if (this.fly) speed = sprint ? 20 : 11;
    else if (feetWater) {
      const depthStrider = getItemEnchantment(this.itemEnchantments, this.armorSlots[3] ?? 0, "depth_strider");
      speed = 2.6 * (1 + 0.33 * depthStrider);
    }
    else if (sprint) speed = 6.4;
    const speedAmp=this.effectAmp("speed"), slowAmp=this.effectAmp("slowness");
    if(speedAmp>=0)speed*=1+0.2*(speedAmp+1);
    if(slowAmp>=0)speed*=Math.max(0.05,1-0.15*(slowAmp+1));
    if(feetWater&&this.effectAmp("dolphins_grace")>=0)speed*=1.5;
    if (this.sneaking) {
      const swiftSneak = getItemEnchantment(this.itemEnchantments, this.armorSlots[2] ?? 0, "swift_sneak");
      speed *= 0.3 + 0.15 * swiftSneak;
    }
    if (b.onGround && !feetWater) {
      const boots = this.armorSlots[3] ?? 0;
      const soulSpeed = getItemEnchantment(this.itemEnchantments, boots, "soul_speed");
      if (soulSpeed > 0) {
        const below = this.world.get(Math.floor(b.x), Math.floor(b.y - 0.06), Math.floor(b.z));
        const belowKey = BLOCKS[below]?.key ?? "";
        if (belowKey.endsWith("soul_sand") || belowKey.endsWith("soul_soil")) speed *= 1 + 0.3 * soulSpeed;
      }
    }

    const elytraId=MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:elytra"]??0;
    const wearingElytra=this.armorSlots[1]===elytraId && this.elytraDamage<432;
    if(this.fallFlying && (!wearingElytra || b.onGround || feetWater)) this.fallFlying=false;
    const resp = this.fly ? 10 : b.onGround ? 14 : 4;
    const a = Math.min(1, dt * resp);
    if(this.fallFlying) {
      const side=(active?(k.has("KeyD")?1:0)-(k.has("KeyA")?1:0):0);
      const glide=stepElytraPhysics([b.x,b.y,b.z],[b.vx,b.vy,b.vz],this.yaw,this.pitch,side,dt);
      [b.vx,b.vy,b.vz]=glide.velocity;
      if(this.mode!=="room" && !this.lastElytraWearAt) this.lastElytraWearAt=now;
      else if(this.mode!=="room" && now-this.lastElytraWearAt>=1000) {
        this.lastElytraWearAt=now;
        if(Math.random()<elytraWearChance(this.itemEnchantments,elytraId)) this.elytraDamage=Math.min(432,this.elytraDamage+1);
        if(this.elytraDamage>=432){this.fallFlying=false;toast("エリトラが壊れました");}
        this.autosave(true);
      }
    } else {
      b.vx += (wx * speed - b.vx) * a;
      b.vz += (wz * speed - b.vz) * a;
      if (this.fly) {
        const up = (jump ? 1 : 0) - (active && sprint ? 1 : 0);
        b.vy += (up * (sprint ? 14 : 9) - b.vy) * Math.min(1, dt * 10);
      } else if (feetWater) {
        b.vy -= 6 * dt;
        if (jump) b.vy = Math.min(b.vy + 28 * dt, 3.6);
        b.vy *= 1 - Math.min(1, dt * 2.5);
        if (headWater === false && jump && b.vy > 0) b.vy = Math.max(b.vy, 4.5);
      } else {
        const levitation = this.effectAmp("levitation");
        const slowFall = this.effectAmp("slow_falling");
        if (levitation >= 0) b.vy += ((0.9 + 0.25 * levitation) - b.vy) * Math.min(1, dt * 4);
        else if (slowFall >= 0) b.vy = Math.max(-2, b.vy - 2 * dt);
        else b.vy = Math.max(-50, b.vy - 28 * dt);
        if (jump && b.onGround) { b.vy = 8.6 + Math.max(0,this.effectAmp("jump_boost")+1)*1.2; if(this.mode==="room"&&this.survival)this.net.send({t:"jump"}); }
      }
    }
    if(this.gameMode==="spectator"){b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.onGround=false;}else moveBody(this.world, b, dt, this.sneaking);
    if(b.onGround && this.fallFlying) this.fallFlying=false;
    if (b.y < -30) {
      if (this.survival) this.die();
      else { b.x = this.spawn[0]; b.y = this.spawn[1] + 5; b.z = this.spawn[2]; b.vx = b.vy = b.vz = 0; toast("リスポーンしました"); }
    }

    if (this.survival && this.mode !== "room") { /* server owns multiplayer hunger and regeneration */ }

    if (active) {
      if (this.survival) { if (this.mouseL) this.updateDig(dt); else this.stopDig(); }
      else if (this.mouseL && now - this.lastBreak > 190) { this.doBreak(); this.lastBreak = now; }
      if (this.mouseR && now - this.lastPlace > 220) { this.doPlace(); this.lastPlace = now; }
    } else if (this.survival) this.stopDig();

    // カメラ
    const cx = b.x, cy = b.y + this.eyeH, cz = b.z;
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    if (this.thirdPerson) {
      const dx = Math.sin(this.yaw) * Math.cos(this.pitch), dy = -Math.sin(this.pitch), dz = Math.cos(this.yaw) * Math.cos(this.pitch);
      // 視線の後ろ方向に最大4ブロック、壁があれば手前で止める
      const h = raycast(this.world, cx, cy, cz, dx, dy, dz, 4);
      const dist = h ? Math.max(0.5, Math.hypot(h.x + 0.5 - cx, h.y + 0.5 - cy, h.z + 0.5 - cz) - 0.9) : 4;
      this.camera.position.set(cx + dx * dist, cy + dy * dist, cz + dz * dist);
    } else this.camera.position.set(cx, cy, cz);
  }

  updateTarget(now: number) {
    void now;
    if (this.state !== "playing") { this.highlight.visible = false; this.breakOverlay.visible = false; this.target = null; return; }
    const o = new THREE.Vector3(this.body.x, this.body.y + this.eyeH, this.body.z);
    const d = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    this.target = raycast(this.world, o.x, o.y, o.z, d.x, d.y, d.z, REACH);
    if (this.target) { this.highlight.visible = true; this.highlight.position.set(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5); }
    else this.highlight.visible = false;
  }

  updateOwnModel(dt: number, daylight: number) {
    const skinKey = JSON.stringify(this.profile.skin);
    if (!this.ownModel || this.ownSkinKey !== skinKey) {
      if (this.ownModel) { this.scene.remove(this.ownModel.root); this.ownModel.dispose(); }
      this.ownModel = new PlayerModel(this.profile.skin, null);
      this.ownSkinKey = skinKey;
      this.scene.add(this.ownModel.root);
    }
    const m = this.ownModel;
    m.root.visible = this.thirdPerson && this.ready;
    if (!m.root.visible) return;
    m.root.position.set(this.body.x, this.body.y, this.body.z);
    m.root.rotation.y = this.yaw + Math.PI;
    m.setSneak(this.sneaking);
    m.animate(dt, Math.hypot(this.body.vx, this.body.vz));
    m.setLight(0.3 + 0.7 * daylight);
  }

  sendPos(now: number) {
    if (!this.net.connected || now - this.lastSend < 80) return;
    const b = this.body, l = this.lastSent;
    const moved = Math.abs(b.x - l.x) + Math.abs(b.y - l.y) + Math.abs(b.z - l.z) > 0.01 || Math.abs(this.yaw - l.yaw) > 0.01 || Math.abs(this.pitch - l.pitch) > 0.01 || this.sneaking !== this.lastSentSneak || this.fallFlying !== this.lastSentFallFlying;
    if (!moved && now - this.lastSend < 1000) return;
    this.lastSend = now;
    this.lastSent = { x: b.x, y: b.y, z: b.z, yaw: this.yaw, pitch: this.pitch };
    this.lastSentSneak = this.sneaking; this.lastSentFallFlying = this.fallFlying;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    this.net.send({ t: "pos", p: [r2(b.x), r2(b.y), r2(b.z)], r: [r2(this.yaw), r2(this.pitch)], sprint: !this.sneaking && (this.keys.has("ShiftLeft")||this.keys.has("ShiftRight")), sneak: this.sneaking || undefined, swimming: inLiquid(this.world,b.x,b.y+0.3,b.z), fallFlying: this.fallFlying || undefined, flightStrafe: this.fallFlying ? ((this.keys.has("KeyD")?1:0)-(this.keys.has("KeyA")?1:0)) : 0 });
  }

  updateInfo() {
    if (!this.ready) return;
    const b = this.body, hrs = (this.time * 24 + 6) % 24;
    const hh = String(Math.floor(hrs)).padStart(2, "0"), mm = String(Math.floor((hrs % 1) * 60)).padStart(2, "0");
    const st = this.view.stats;
    $("info").textContent =
      `${this.fps} FPS   ${hh}:${mm}${this.fly ? "   飛行" : this.fallFlying ? "   エリトラ滑空" : ""}   ${MODE_NAME[this.gameMode]}\n` +
      `XYZ ${b.x.toFixed(1)} ${b.y.toFixed(1)} ${b.z.toFixed(1)}\n` +
      `チャンク ${st.chunks} / 描画 ${st.meshed}   △ ${Math.round(st.triangles / 1000)}k` +
      (this.mode === "room" ? `\nプレイヤー ${this.remotes.count() + 1}人` : "");
  }
}

function clampN(v: unknown, lo: number, hi: number, def: number) {
  return typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : def;
}

new Game();
export type { PlayerInfo };
