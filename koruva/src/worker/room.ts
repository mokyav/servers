import { applyDamageWithInvulnerability, attackDelayTicks, isCriticalHit, meleeDamage, mobBaseHealth } from "../../shared/combat.js";
import { applyArmorReduction, normalizeArmorSlots, weaponStatsForItemId, weaponReachForItemId } from "../../shared/item-mechanics.js";
import { normalizeStackComponents, validateStackComponents, setStackEnchantment, stackDataForSlot, withStackEnchantments, combineAnvilStacks, grindstoneStack } from "../../shared/stack-components.js";
import { inventoryStorageCapacity, maxInventoryCountForItemKey, maxStackSizeForItemKey } from "../../shared/inventory-stacks.js";
import { countEnchantingBookshelves, thornsRetaliation, windBurstImpulse, frostWalkerRadius, sweepingDamage, breachArmorMultiplier, bowShotProfile, crossbowShotProfile, tridentShotProfile } from "../../shared/enchantment-runtime.js";
import { tickDragonCrystalHealing, dragonBlastDamage } from "../../shared/end-fight.js";
import { fishingBiteDelay, isFishingOpenWater, rollFishingLootEntry } from "../../shared/fishing.js";
import { ENCHANTMENT_MAX_LEVEL, normalizeItemEnchantments, enchantmentDamageBonus, getItemEnchantment, setItemEnchantment, elytraWearChance } from "../../shared/enchantments.js";
import { potionSpecForItemId } from "../../shared/potions.js";
import { advanceFurnaceState, createFurnaceState, furnaceHasContents, insertFurnaceItems, normalizeFurnaceState, removeFurnaceItems, type FurnaceSlot, type FurnaceState, type FurnaceStation } from "../../shared/smelting.js";
import { stepElytraPhysics } from "../../shared/elytra-physics.js";
import { maxDurabilityForItemKey, shouldApplyDurabilityDamage, damageStackRecord, repairStackRecord } from "../../shared/item-durability.js";
import { DurableObject } from "cloudflare:workers";
import {
  CHUNK_SIZE, CHUNK_VOLUME, DAY_LENGTH_SEC, MAX_CHUNK_RECORDS, MAX_PLAYERS, NO_EDIT, SERVER_REACH, WORLD_HEIGHT,
} from "../../shared/constants";
import { chunkCoord, localIndex } from "../../shared/coords";
import {
  DEFAULT_SKIN, type BanEntry, type ClientMsg, type GameMode, type PlayerInfo, type Rot, type ServerMsg, type Skin, type Vec3,
} from "../../shared/protocol";
import {
  NAME_RULE, isValidSet, nameKey, sanitizeChat, sanitizeMode, sanitizeRot, sanitizeSkin, sanitizeToken, sanitizeVec3, validateName,
} from "../../shared/validate";
import { BLOCK_COUNT, B, BLOCKS, INVENTORY_ITEMS, PLACEABLE, blockItemId, blockOccupiesSubcell, blockStateVariantId, resolveBlockStateChanges, MINECRAFT_BLOCK_TO_ID, MINECRAFT_ITEM_TO_RUNTIME_ID } from "../../shared/blocks";
import { craftFromGrid, craftGridForRecipe, craftRecipeFitsGrid, createCraftRecipes, getBlockDrop, getBlockDropCount, getBlockDrops, miningTimeSeconds, resolveInitialInventory } from "../../shared/gameplay.js";
import { addEffect, addExhaustion, applyDamage, applyFood, canAdventureEdit, clearEffect, createVitals, EFFECT_DEFS, normalizeVitals, tickVitals, type DamageCause, type Difficulty, type PlayerVitals } from "../../shared/vitals";
import { FOOD_DEFS } from "../../shared/food";
import { MOB_TYPES, type MobInfo, type MobType, type ProjectileInfo } from "../../shared/entities";
import { createMob, hasClearLine, MOB_PROFILES, stepMobAI } from "../../shared/mob-ai.js";
import { applyMobFoodLoot, rollMobFoodLoot, rollMobMaterialLoot } from "../../shared/mob-loot.js";
import { addExperience, rollMobExperience, getExperienceProgress, experienceThreshold, experienceDropOnDeath, takeExperienceFromDrop } from "../../shared/experience.js";
import { NATURAL_MOB_DIMENSIONS, NATURAL_MOB_MAX_PER_DIMENSION, chooseNaturalMobType, daylightAtTime, findNaturalSpawnSpot, findNaturalSpawnGroup, naturalMobSpawnGroupSize, isNaturalMobSpawnDue, shouldDespawnNaturalMob } from "../../shared/natural-spawning.js";
import { mobDimensionId, mobsForDimension, normalizeSavedMobs, withMobDimension } from "../../shared/mob-dimensions.js";
import { dropsForDimension, normalizeSavedDrops } from "../../shared/drop-store.js";
import { blockToken, canBlockStay, canPlaceBlockAt, isFallingBlock, isReplaceableBlock, neighborCells, pairedBlockPosition, requiresBlockSupport } from "../../shared/block-behavior.js";
import { PersistentChunkEdits, normalizeChunkRecord } from "../../shared/chunk-edits.js";
import { evaluateRedstoneWorld, nextRepeaterDelayBlockId } from "../../shared/redstone-world.js";
import { createRepeaterDelayController } from "../../shared/repeater-delay.js";
import { biomeAt, dimensionBiomeAt, generateChunk, generateDimensionChunk, LEGACY_WORLDGEN_VERSION, WORLDGEN_VERSION } from "../client/worldgen";
import { DIMENSION_IDS, normalizeDimensionId, mapDimensionCoordinates, resolveDimensionAlias, findSafeSpawn } from "../../shared/dimensions.js";
import { MINECRAFT_BLOCK_TO_RUNTIME_ID, MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID } from "../../shared/minecraft-block-runtime.js";
import { findPortalAt } from "../../shared/dimension-portals.js";
import { PORTAL_BLOCK_IDS, PORTAL_DELAY_CREATIVE_MS, PORTAL_DELAY_SURVIVAL_MS, buildPortalEdits, findNearestPortal, findPortalBuildSite, portalCollapseEdits, tryLightPortal } from "../../shared/portal.js";
import { dimensionChunkStoragePrefix, parseDimensionChunkStorageKey } from "../../shared/dimension-chunk-store.js";
import { normalizePlayerLocation } from "../../shared/player-location.js";
import { clearInventoryState } from "../../shared/inventory-clear.js";
import { createPlayerSaveSnapshot, loadPlayerSave, writePlayerSave, updatePlayerSave } from "../../shared/player-save.js";
import { buildDeathDropStacks } from "../../shared/death-drops.js";
import { resolveCommandTargets } from "../../shared/command-targets.js";
import { parseTeleportPosition } from "../../shared/teleport.js";
import type { Env } from "./env";

/** クライアント→サーバーのメッセージ長上限(UTF-16文字数)。 */
const MAX_MESSAGE_CHARS = 4096;
const MAX_STACK_DATA_CHARS = 32_768;
const MAX_HELLO_CHARS = 262_144;

interface Meta {
  code: string;
  seed: number;
  /** absent in existing rooms: legacy generator v1 */
  worldgenVersion?: number;
  createdAt: number;
  /** 旧ルームには無い → クリエイティブ扱い */
  mode?: GameMode;
  /** ホスト認証用の秘密。旧ルームには無い → ホスト不在 */
  hostToken?: string;
  difficulty?: Difficulty;
}

interface BanRec {
  bid: string;
  name: string;
  cid: string;
  ip: string;
}

const MAX_BANS = 200;

interface Bucket {
  tokens: number;
  last: number;
}

interface PlayerState {
  id: string;
  name: string;
  skin: Skin;
  p: Vec3;
  r: Rot;
  joined: boolean;
  dimensionId: string;
  host: boolean;
  cid: string;
  ip: string;
  setB: Bucket;
  chatB: Bucket;
  vitals: PlayerVitals;
  lastPosAt: number;
  lastJumpAt: number;
  lastDamageAt: number;
  lastAttackAt?: number;
  lastAttackItemId?: number;
  digTarget?: string;
  digStartedAt?: number;
  verticalVelocity?: number;
  sprint: boolean;
  swimming: boolean;
  sneak?: boolean;
  counts: number[];
  armorSlots: number[];
  itemEnchantments: Record<string, Record<string, number>>;
  stackData: Record<string, any>;
  useStartedAt?: number;
  useStartedWeaponId?: number;
  useStartedSlotKey?: string;
  lastShootAt?: number;
  elytraDamage: number;
  fallFlying: boolean;
  elytraVelocity?: Vec3;
  fallDistance?: number;
  lastElytraWearAt?: number;
  lastRocketAt?: number;
  digToolItemId?: number;
  digToolSlotKey?: string;
  deathDropsHandled?: boolean;
}

/** Durable Object の WebSocket attachment は16KiB上限。countsは正の所持数だけ保存する。 */
interface PlayerAttachment extends Omit<PlayerState, "counts"> {
  counts: number[];
  countsEncoding: "sparse-v1";
}

const EDIT_BATCH = 3000;
const MAX_DROPS = 300;
const MAX_MOBS = 100;
const MAX_STACK = 64;
const DROP_TTL_MS = 5 * 60 * 1000;
const PICKUP_XZ = 4; // 回収の許容水平距離(落下中・ラグを考慮して緩め)
const PICKUP_DY_UP = 64; // ドロップは落ちるだけなので、元の高さより上は大きく許容

interface SavedFurnace { dimensionId: string; x: number; y: number; z: number; station: FurnaceStation; state: FurnaceState; }

interface Drop {
  eid: string;
  dimensionId: string;
  x: number;
  y: number;
  z: number;
  b?: number;
  itemId?: number;
  xp?: number;
  count?: number;
  at: number;
}

interface FishingSession {
  id: string;
  ownerKey: string;
  ownerId: string;
  dimensionId: string;
  x: number; y: number; z: number;
  state: "waiting" | "bite";
  castAt: number;
  biteAt: number;
  rodItemId: number;
  slotKey: string;
  openWater: boolean;
  biome: string;
}

function normalizeInventory(raw: unknown): number[] {
  const counts = new Array(BLOCKS.length).fill(0);
  if (!Array.isArray(raw)) return counts;
  for (const id of INVENTORY_ITEMS) { const v = raw[id]; if (typeof v === "number" && Number.isFinite(v) && v > 0) counts[id] = Math.min(maxInventoryCountForItemKey(BLOCKS[id]?.key ?? ""), Math.floor(v)); }
  return counts;
}

function itemStackLimit(itemId: number): number {
  return maxStackSizeForItemKey(BLOCKS[itemId]?.key ?? "");
}

function inventoryCapacityFor(st: Pick<PlayerState, "counts" | "stackData">, itemId: number, incomingComponents: any = null): number {
  if (!Number.isSafeInteger(itemId) || itemId <= 0 || itemId >= BLOCKS.length || !BLOCKS[itemId]) return 0;
  const current = Math.max(0, Math.floor(st.counts[itemId] ?? 0));
  const aggregateFree = Math.max(0, maxInventoryCountForItemKey(BLOCKS[itemId].key ?? "") - current);
  const slotFree = inventoryStorageCapacity(st.stackData, itemId, BLOCKS, current, incomingComponents);
  return Math.max(0, Math.min(aggregateFree, slotFree));
}

function addInventoryItems(st: Pick<PlayerState, "counts" | "stackData">, itemId: number, amount: number, incomingComponents: any = null): number {
  if (!Number.isSafeInteger(amount) || amount <= 0) return 0;
  const accepted = Math.min(amount, inventoryCapacityFor(st, itemId, incomingComponents));
  if (accepted > 0) st.counts[itemId] = Math.max(0, Math.floor(st.counts[itemId] ?? 0)) + accepted;
  return accepted;
}

/**
 * 1ルーム = 1 Durable Object。
 * - WebSocket Hibernation API を使用(誰も操作していない間は課金対象外)
 * - ワールドは「シードから決定的に生成される地形 + 編集差分」。差分だけをチャンク単位で
 *   Durable Object Storage(SQLite バックエンド)に永続保存する。
 */
export class Room extends DurableObject<Env> {
  private portalCooldowns = new WeakMap<WebSocket, number>();
  private portalDwell = new WeakMap<WebSocket, { target: string; since: number }>();
  private portalNeedsExit = new WeakSet<WebSocket>();

  private meta: Meta | null = null;
  /** key "cx,cz" -> Uint16Array(16384)。65535 = 未編集、それ以外 = ブロックID(0=空気) */
  private chunks = new Map<string, Uint8Array | Uint16Array>();
  private dimensionChunks = new Map<string, Map<string, Uint8Array | Uint16Array>>();
  private dimensionChunkWriters = new Map<string, PersistentChunkEdits>();
  private chunkEditWriter: PersistentChunkEdits;
  private mem = new Map<WebSocket, PlayerState>();
  private bans: BanRec[] = [];
  private left = new WeakSet<WebSocket>();
  /** ドロップ中のアイテム。Durable Object Storage に永続化する。 */
  private drops = new Map<string, Drop>();
  private furnaces = new Map<string, SavedFurnace>();
  private mobs = new Map<string, MobInfo>();
  private endBossDefeated = false;
  private endDragonRespawnAt: number | null = null;
  private endDragonRespawnStage = -1;
  private projectiles = new Map<string, ProjectileInfo>();
  private fishingSessions = new Map<string, FishingSession>();
  private frostedBlocks = new Map<string, { dimensionId: string; x: number; y: number; z: number; original: number; ice: number; expiresAt: number }>();
  private frostWalkerAt = new WeakMap<WebSocket, number>();
  private lastProjectilePersistAt = Date.now();
  private lastTickAt = Date.now();
  private repeaterDelays = new Map<string, ReturnType<typeof createRepeaterDelayController>>();
  private mobTickAccumulator = 0;
  private lastNaturalMobSpawnAt = Date.now();
  private lastMobPersistAt = Date.now();
  private mobChunkCache = new Map<string,Uint16Array>();
  private difficulty: Difficulty = "normal";

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.chunkEditWriter = new PersistentChunkEdits(
      this.chunks,
      (key, value) => ctx.storage.put(key, value),
      { prefix: "c:", volume: CHUNK_VOLUME, maxRecords: MAX_CHUNK_RECORDS, noEdit: NO_EDIT },
    );
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    ctx.blockConcurrencyWhile(async () => {
      this.meta = (await ctx.storage.get<Meta>("meta")) ?? null;
      this.difficulty = this.meta?.difficulty ?? "normal";
      const savedFurnaces = await ctx.storage.get<unknown>("furnaces");
      if (Array.isArray(savedFurnaces)) {
        for (const raw of savedFurnaces) {
          if (!raw || typeof raw !== "object") continue;
          const item = raw as Partial<SavedFurnace>;
          if (typeof item.dimensionId !== "string" || !Number.isSafeInteger(item.x) || !Number.isSafeInteger(item.y) || !Number.isSafeInteger(item.z) || (item.y as number) < 0 || (item.y as number) >= WORLD_HEIGHT || !["furnace", "blast_furnace", "smoker"].includes(String(item.station))) continue;
          this.furnaces.set(this.furnaceKey(item.dimensionId, item.x as number, item.y as number, item.z as number), { dimensionId: normalizeDimensionId(item.dimensionId), x: item.x as number, y: item.y as number, z: item.z as number, station: item.station as FurnaceStation, state: normalizeFurnaceState(item.state) });
        }
      }
      const redstoneSnapshots = await ctx.storage.get<Record<string, unknown>>("redstone-states");
      const legacyRedstoneSnapshot = await ctx.storage.get<unknown>("redstone-state");
      for (const dimensionId of Object.values(DIMENSION_IDS)) {
        const saved = redstoneSnapshots && typeof redstoneSnapshots === "object" && !Array.isArray(redstoneSnapshots)
          ? redstoneSnapshots[dimensionId]
          : undefined;
        const snapshot = saved ?? (dimensionId === DIMENSION_IDS.OVERWORLD ? legacyRedstoneSnapshot : undefined);
        if (!snapshot) continue;
        const controller = this.repeaterDelayForDimension(dimensionId);
        try { controller.restore(snapshot); }
        catch (error) { console.warn(`discarding invalid saved redstone state for ${dimensionId}`, error); controller.clear(); }
      }
      this.bans = (await ctx.storage.get<BanRec[]>("bans")) ?? [];
      const savedFrosted = await ctx.storage.get<unknown>("frosted-blocks");
      if (Array.isArray(savedFrosted)) for (const raw of savedFrosted.slice(-512)) {
        if (!raw || typeof raw !== "object") continue;
        const v = raw as any;
        if (!Object.values(DIMENSION_IDS).includes(v.dimensionId) || ![v.x,v.y,v.z,v.original,v.ice,v.expiresAt].every(Number.isFinite)) continue;
        if (!Number.isSafeInteger(v.x) || !Number.isSafeInteger(v.y) || !Number.isSafeInteger(v.z) || v.expiresAt <= Date.now()) continue;
        this.frostedBlocks.set(`${v.dimensionId}|${v.x},${v.y},${v.z}`, v);
      }
      this.endBossDefeated = (await ctx.storage.get<boolean>("end-boss-defeated")) === true;
      const savedRespawnAt = await ctx.storage.get<number>("end-dragon-respawn-at");
      this.endDragonRespawnAt = Number.isFinite(savedRespawnAt) && Number(savedRespawnAt) > Date.now() - 60_000 ? Number(savedRespawnAt) : null;
      const savedFishing = await ctx.storage.get<unknown>("fishing-sessions");
      if (Array.isArray(savedFishing)) for (const raw of savedFishing.slice(-MAX_PLAYERS)) {
        if (!raw || typeof raw !== "object") continue;
        const f = raw as Partial<FishingSession>;
        if (typeof f.id !== "string" || typeof f.ownerKey !== "string" || typeof f.ownerId !== "string") continue;
        if (!Object.values(DIMENSION_IDS).some((dimensionId) => dimensionId === f.dimensionId) || ![f.x,f.y,f.z,f.castAt,f.biteAt,f.rodItemId].every(Number.isFinite)) continue;
        if (f.state !== "waiting" && f.state !== "bite") continue;
        if (Date.now() - Number(f.castAt) > 10 * 60_000) continue;
        if (typeof f.slotKey !== "string" || !/^(?:hotbar:[0-8]|main:(?:[0-9]|1[0-9]|2[0-6]))$/.test(f.slotKey)) continue;
        f.openWater = f.openWater === true; f.biome = typeof f.biome === "string" ? f.biome.slice(0,80) : "";
        this.fishingSessions.set(f.ownerKey, f as FishingSession);
      }
      const savedMobs = normalizeSavedMobs<MobInfo>(await ctx.storage.get<unknown>("mobs"), {
        maxMobs: MAX_MOBS, isValidType: (type) => typeof type === "string" && (MOB_TYPES.some((candidate) => candidate === type) || type === "end_crystal"),
      });
      for (const m of savedMobs) this.mobs.set(m.id, m);
      const savedProjectiles = await ctx.storage.get<unknown>("projectiles");
      if (Array.isArray(savedProjectiles)) for (const raw of savedProjectiles.slice(-256)) {
        if (!raw || typeof raw !== "object") continue;
        const p = raw as Partial<ProjectileInfo>;
        if (!["arrow","trident","dragon_fireball","firework_rocket"].includes(String(p.type)) || typeof p.eid !== "string" || typeof p.dimensionId !== "string" || typeof p.ownerId !== "string") continue;
        if (![p.x,p.y,p.z,p.vx,p.vy,p.vz,p.damage,p.createdAt].every(Number.isFinite)) continue;
        if (Date.now() - Number(p.createdAt) > 8000) continue;
        this.projectiles.set(p.eid, p as ProjectileInfo);
      }
      const savedDrops = normalizeSavedDrops(await ctx.storage.get<Drop[]>("drops"), {
        now: Date.now(), ttlMs: DROP_TTL_MS, maxDrops: MAX_DROPS,
        isValidItem: (itemId) => Number.isSafeInteger(itemId) && itemId > 0 && itemId < BLOCKS.length && !!BLOCKS[itemId],
        isValidInventoryItem: (itemId) => Number.isSafeInteger(itemId) && itemId > 0 && itemId < BLOCKS.length && !!BLOCKS[itemId],
        getMaxStackSize: itemStackLimit,
      });
      for (const d of savedDrops) this.drops.set(d.eid, d);
      // 期限切れ・不正データもここで永続領域から掃除する。
      await ctx.storage.put("drops", savedDrops);
      if (this.meta) {
        const all = await ctx.storage.list<Uint8Array | Uint16Array>({ prefix: "c:" });
        for (const [storageKey, value] of all) {
          const parsed = parseDimensionChunkStorageKey(storageKey);
          if (!parsed) continue;
          const normalized = normalizeChunkRecord(value, CHUNK_VOLUME, NO_EDIT);
          if (!normalized) { console.warn(`discarding invalid chunk record ${storageKey}`); continue; }
          this.chunksForDimension(parsed.dimensionId).set(parsed.chunkKey, normalized);
          if (value instanceof Uint8Array) await ctx.storage.put(storageKey, normalized);
        }
      }
    });
  }

  // ---- RPC ----
  async create(code: string, seed: number, mode: GameMode = "creative", hostToken = ""): Promise<boolean> {
    if (this.meta) return false;
    this.meta = { code, seed, worldgenVersion: WORLDGEN_VERSION, createdAt: Date.now(), mode: sanitizeMode(mode), hostToken: sanitizeToken(hostToken) || undefined };
    await this.ctx.storage.put("meta", this.meta);
    return true;
  }

  async info(): Promise<{ exists: boolean; players: number; max: number; mode: GameMode }> {
    return {
      exists: !!this.meta,
      mode: this.meta?.mode ?? "creative",
      players: this.ctx.getWebSockets().length,
      max: MAX_PLAYERS,
    };
  }

  // ---- WebSocket ----
  async fetch(request: Request): Promise<Response> {
    if (!this.meta) return new Response("room not found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    if (this.ctx.getWebSockets().length >= MAX_PLAYERS) {
      return new Response("room full", { status: 409 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const now = Date.now();
    const st: PlayerState = {
      id: crypto.randomUUID().slice(0, 8),
      name: "",
      skin: DEFAULT_SKIN,
      p: [0, 40, 0],
      r: [0, 0],
      joined: false, dimensionId: DIMENSION_IDS.OVERWORLD,
      host: false,
      cid: "",
      ip: request.headers.get("CF-Connecting-IP") ?? "",
      setB: { tokens: 30, last: now },
      chatB: { tokens: 5, last: now },
      vitals: createVitals(this.meta?.mode ?? "creative"), counts: new Array(BLOCKS.length).fill(0), armorSlots: [0, 0, 0, 0], itemEnchantments: {}, stackData: {}, elytraDamage: 0, fallFlying: false, lastPosAt: now, lastJumpAt: 0, lastDamageAt: 0, sprint: false, swimming: false,
    };
    this.serializePlayer(server, st);
    this.mem.set(server, st);
    return new Response(null, { status: 101, webSocket: client });
  }

  private encodePlayerAttachment(st: PlayerState): PlayerAttachment {
    const sparseCounts: number[] = [];
    for (let id = 1; id < st.counts.length; id++) {
      const count = st.counts[id];
      if (Number.isSafeInteger(count) && count > 0) sparseCounts.push(id, count);
    }
    const { counts: _counts, ...rest } = st;
    return { ...rest, counts: sparseCounts, countsEncoding: "sparse-v1" };
  }

  private decodePlayerAttachment(raw: unknown): PlayerState | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const attachment = raw as Record<string, unknown>;
    // 旧形式(countsが通常配列)も読み込めるようにして、接続中の既存Socketを壊さない。
    if (attachment.countsEncoding !== "sparse-v1") return raw as PlayerState;

    const counts = new Array(BLOCKS.length).fill(0);
    if (Array.isArray(attachment.counts)) {
      for (let i = 0; i + 1 < attachment.counts.length; i += 2) {
        const id = attachment.counts[i], count = attachment.counts[i + 1];
        if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || id >= BLOCKS.length) continue;
        if (typeof count !== "number" || !Number.isSafeInteger(count) || count <= 0 || count > MAX_STACK) continue;
        counts[id] = count;
      }
    }
    const { countsEncoding: _encoding, ...rest } = attachment;
    return { ...rest, counts } as unknown as PlayerState;
  }

  private player(ws: WebSocket): PlayerState {
    let p = this.mem.get(ws);
    if (!p) {
      const a = this.decodePlayerAttachment(ws.deserializeAttachment());
      p = a ?? {
        id: crypto.randomUUID().slice(0, 8), name: "Player", skin: DEFAULT_SKIN, p: [0, 40, 0], r: [0, 0],
        joined: false, dimensionId: DIMENSION_IDS.OVERWORLD, host: false, cid: "", ip: "",
        setB: { tokens: 30, last: Date.now() }, chatB: { tokens: 5, last: Date.now() },
        vitals: createVitals(this.meta?.mode ?? "creative"), counts: new Array(BLOCKS.length).fill(0), armorSlots: [0, 0, 0, 0], itemEnchantments: {}, stackData: {}, elytraDamage: 0, fallFlying: false, lastPosAt: Date.now(), lastJumpAt: 0, lastDamageAt: 0, sprint: false, swimming: false,
      };
      if (!p.vitals) p.vitals = createVitals(this.meta?.mode ?? "creative");
      p.counts = normalizeInventory(p.counts);
      p.armorSlots = normalizeArmorSlots(p.armorSlots, BLOCKS, p.counts, p.vitals.gameMode === "creative");
      p.itemEnchantments = normalizeItemEnchantments(p.itemEnchantments, BLOCKS);
      p.stackData = validateStackComponents(p.stackData, BLOCKS, p.counts);
      p.elytraDamage = Number.isFinite(p.elytraDamage) ? Math.max(0, Math.min(432, Math.floor(p.elytraDamage))) : 0;
      p.fallFlying = !!p.fallFlying && p.elytraDamage < 432;
      if (!Number.isFinite(p.lastPosAt)) p.lastPosAt = Date.now();
      p.lastJumpAt ??= 0; p.lastDamageAt ??= 0; p.sprint ??= false; p.swimming ??= false;
      this.mem.set(ws, p);
    }
    p.dimensionId = normalizeDimensionId(p.dimensionId);
    return p;
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    // サイズ上限は種別ごとに分ける。hello は全ブロック分の所持数配列(BLOCKS.length 件)や
    // スキンPNG(最大32,000文字)を含むため 4096 では必ず超え、黙って捨てられて接続が
    // タイムアウトしていた。まず緩い上限で弾き、パース後に種別ごとの上限を適用する。
    if (!this.meta || this.left.has(ws)) return; // 未作成ルーム / キック・切断済み
    if (typeof raw !== "string") return this.refuse(ws, "テキスト形式のメッセージのみ対応しています");
    if (raw.length > MAX_HELLO_CHARS) return this.refuse(ws, "メッセージが大きすぎます");
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return this.refuse(ws, "メッセージ形式が正しくありません");
    }
    if (!msg || typeof msg !== "object" || Array.isArray(msg)) return this.refuse(ws, "メッセージ形式が正しくありません");
    const sizeLimit = msg.t === "hello" ? MAX_HELLO_CHARS : msg.t === "stack-data" ? MAX_STACK_DATA_CHARS : MAX_MESSAGE_CHARS;
    if (raw.length > sizeLimit) return this.refuse(ws, "メッセージが大きすぎます");
    const me = this.player(ws);

    if (msg.t === "hello") {
      if (me.joined) return;
      me.cid = sanitizeToken(msg.cid);
      const token = sanitizeToken(msg.hostToken);
      me.host = !!token && !!this.meta.hostToken && token === this.meta.hostToken;
      const savedPlayer = me.cid ? await loadPlayerSave(this.ctx.storage, me.cid) : null;
      const saveSnapshot = savedPlayer?.snapshot;
      const savedLocation = saveSnapshot?.location;
      const restoredLocation = normalizePlayerLocation(savedLocation);
      if (restoredLocation) {
        me.dimensionId = restoredLocation.dimensionId;
        me.p = sanitizeVec3(restoredLocation.p, me.p);
        me.r = sanitizeRot(restoredLocation.r, me.r);
      }
      const storedVitals = saveSnapshot?.vitals as PlayerVitals | null | undefined;
      me.vitals = normalizeVitals(storedVitals ?? me.vitals, this.meta.mode ?? "creative");
      const storedCounts = savedPlayer?.hasInventory ? saveSnapshot?.inventory as number[] : undefined;
      me.counts = normalizeInventory(resolveInitialInventory(storedCounts, msg.counts, me.host));
      me.armorSlots = normalizeArmorSlots(saveSnapshot?.armorSlots ?? msg.armorSlots, BLOCKS, me.counts, (this.meta.mode ?? "creative") === "creative");
      const storedEnchants = me.cid ? await this.ctx.storage.get<unknown>("enchantments:" + me.cid) : undefined;
      const storedStackData = me.cid ? await this.ctx.storage.get<unknown>("stack-data:" + me.cid) : undefined;
      me.stackData = validateStackComponents(storedStackData ?? msg.stackData, BLOCKS, me.counts);
      if (storedStackData === undefined && me.cid) await this.ctx.storage.put("stack-data:" + me.cid, me.stackData);
      me.itemEnchantments = normalizeItemEnchantments(storedEnchants ?? me.itemEnchantments, BLOCKS);
      const storedElytraDamage = me.cid ? await this.ctx.storage.get<unknown>("elytra:" + me.cid) : undefined;
      me.elytraDamage = Number.isFinite(storedElytraDamage) ? Math.max(0, Math.min(432, Math.floor(Number(storedElytraDamage)))) : me.elytraDamage;
      me.fallFlying = false;
      if (savedPlayer && savedPlayer.source !== "snapshot") {
        await this.persistVersionedPlayerSave(me);
      } else if (storedCounts === undefined) {
        await this.persistInventory(ws, me);
      }
      // BAN 判定(ホスト本人は常に入室可能。自分を締め出さないため)
      if (!me.host && this.isBanned(me)) {
        this.send(ws, { t: "kicked", reason: "このルームからBANされています" });
        this.leave(ws);
        try { ws.close(4003, "banned"); } catch { /* already closed */ }
        return;
      }
      // 名前: 英数字と _ のみ・空は不可・他の入室者と重複不可(大文字小文字を区別しない)
      const name = validateName(msg.name);
      if (!name) return this.refuse(ws, NAME_RULE);
      const key = nameKey(name);
      for (const s of this.ctx.getWebSockets()) {
        if (s === ws || this.left.has(s)) continue;
        const o = this.player(s);
        if (o.joined && nameKey(o.name) === key) return this.refuse(ws, "その名前は既に使われています");
      }
      me.name = name;
      me.skin = sanitizeSkin(msg.skin);
      me.sneak = false;
      if (!restoredLocation) {
        me.p = sanitizeVec3(msg.p, [0, 40, 0]);
        me.r = sanitizeRot(msg.r, [0, 0]);
      }
      me.joined = true;
      this.serializePlayer(ws, me);
      if (me.cid) await this.persistVersionedPlayerSave(me);
      await this.persistPlayerLocation(me);

      const edits = this.allEdits(me.dimensionId);
      const others: PlayerInfo[] = [];
      for (const s of this.ctx.getWebSockets()) {
        if (s === ws) continue;
        const o = this.player(s);
        if (o.joined && o.dimensionId === me.dimensionId) others.push(this.info2(o));
      }
      this.send(ws, {
        t: "init", id: me.id, code: this.meta.code, seed: this.meta.seed,
        dimensionId: me.dimensionId, p: [...me.p], r: [...me.r],
        worldgenVersion: this.meta.worldgenVersion ?? LEGACY_WORLDGEN_VERSION,
        now: Date.now(), t0: this.meta.createdAt, players: others, editCount: edits.length / 4,
        mode: this.meta.mode ?? "creative", host: me.host, vitals: me.vitals, counts: [...me.counts], armorSlots: [...me.armorSlots], itemEnchantments: me.itemEnchantments, stackData: me.stackData, elytraDamage: me.elytraDamage, mobs: mobsForDimension(this.mobs.values(), me.dimensionId),
        projectiles: this.projectilesForDimension(me.dimensionId),
        drops: (await this.liveDrops(me.dimensionId)).map(({ eid, x, y, z, b, itemId, xp, count }) => ({ eid, x, y, z, ...(b !== undefined ? { b } : {}), ...(itemId !== undefined ? { itemId } : {}), ...(xp !== undefined ? { xp } : {}), ...(count !== undefined ? { count } : {}) })),
      });
      const step = EDIT_BATCH * 4;
      if (edits.length === 0) {
        this.send(ws, { t: "edits", list: [], done: true });
      } else {
        for (let i = 0; i < edits.length; i += step) {
          this.send(ws, { t: "edits", list: edits.slice(i, i + step), done: i + step >= edits.length });
        }
      }
      this.broadcastDimension({ t: "join", player: this.info2(me) }, me.dimensionId, ws);
      if (me.dimensionId === DIMENSION_IDS.END) await this.ensureEnderDragon();
      await this.syncEndBossBar(ws, me.dimensionId);
      const fishing = this.fishingSessions.get(me.cid || me.id);
      if (fishing && fishing.dimensionId === me.dimensionId) {
        fishing.ownerId = me.id;
        this.send(ws, { t: "fishing", id: fishing.id, ownerId: me.id, dimensionId: fishing.dimensionId, x: fishing.x, y: fishing.y, z: fishing.z, state: fishing.state });
      }
      await this.persistVitals(me);
      await this.armGameClock();
      return;
    }

    if (!me.joined) return;

    switch (msg.t) {
      case "pos": {
        const now = Date.now(); const next = sanitizeVec3(msg.p, me.p);
        const dt = Math.max(0.05, Math.min(1, (now - me.lastPosAt) / 1000));
        const distance = Math.hypot(next[0]-me.p[0], next[1]-me.p[1], next[2]-me.p[2]);
        const previousPosition: Vec3 = [...me.p];
        // A rejected position must not grant fall/critical-hit or movement state.
        const movementStateBeforeValidation = {
          verticalVelocity: me.verticalVelocity,
          fallDistance: me.fallDistance,
          sneak: me.sneak,
          sprint: me.sprint,
          swimming: me.swimming,
          fallFlying: me.fallFlying,
          elytraVelocity: me.elytraVelocity,
        };
        me.sneak = !!msg.sneak;
        me.sprint = !!msg.sprint && !me.sneak;
        me.swimming = !!msg.swimming;
        // Exhaustion is computed from server-observed position deltas; client never sends hunger values.
        const requestedElytra = !!msg.fallFlying && me.armorSlots[1] === (MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:elytra"] ?? -1) && me.elytraDamage < 432;
        const maxSpeed = requestedElytra ? 44 : 24;
        const elytraId = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:elytra"] ?? 0;
        const hasElytra = me.armorSlots[1] === elytraId && me.elytraDamage < 432;
        const wasFallFlying = me.fallFlying;
        const submittedDeltaY = next[1] - me.p[1];
        me.verticalVelocity = submittedDeltaY / dt;
        if (submittedDeltaY < 0) me.fallDistance = Math.min(120, (me.fallDistance ?? 0) - submittedDeltaY);
        else if (submittedDeltaY > 0.12) me.fallDistance = 0;
        me.fallFlying = !!msg.fallFlying && hasElytra && !me.swimming && me.vitals.gameMode !== "spectator";
        if (me.fallFlying) {
          if (!wasFallFlying || !Array.isArray(me.elytraVelocity)) me.elytraVelocity = [
            Math.max(-12, Math.min(12, (next[0]-previousPosition[0])/dt)),
            Math.max(-12, Math.min(2, me.verticalVelocity ?? 0)),
            Math.max(-12, Math.min(12, (next[2]-previousPosition[2])/dt)),
          ];
          const simulated = stepElytraPhysics(me.p, me.elytraVelocity, msg.r?.[0] ?? me.r[0], msg.r?.[1] ?? me.r[1], Number(msg.flightStrafe) || 0, dt);
          let candidate = simulated.position as Vec3;
          const blocked = (x:number,y:number,z:number) => {
            const id=this.blockAt(Math.floor(x),Math.floor(y),Math.floor(z),me.dimensionId);
            return id>0 && !!BLOCKS[id]?.solid;
          };
          const collision = blocked(candidate[0]-0.28,candidate[1]+0.15,candidate[2]-0.28) || blocked(candidate[0]+0.28,candidate[1]+0.15,candidate[2]+0.28)
            || blocked(candidate[0],candidate[1]+1.55,candidate[2]);
          if (collision) {
            candidate = [me.p[0] + simulated.velocity[0]*dt*0.15, me.p[1], me.p[2] + simulated.velocity[2]*dt*0.15];
            simulated.velocity[1]=Math.min(0,simulated.velocity[1]);
          }
          const correction = Math.hypot(candidate[0]-next[0],candidate[1]-next[1],candidate[2]-next[2]);
          me.elytraVelocity = simulated.velocity as Vec3;
          me.p = candidate;
          if(correction>1.5) this.send(ws,{t:"teleport",p:me.p,r:me.r});
        } else {
          me.elytraVelocity = [0,0,0];
          if (distance > dt * maxSpeed + 1 && me.vitals.gameMode !== "creative" && me.vitals.gameMode !== "spectator") {
            Object.assign(me, movementStateBeforeValidation);
            this.send(ws,{t:"teleport",p:me.p,r:me.r}); return;
          }
          if (distance <= dt * maxSpeed + 1 && me.vitals.gameMode !== "creative" && me.vitals.gameMode !== "spectator") {
            if (me.swimming) addExhaustion(me.vitals, .01 * distance);
            else if (me.sprint && distance > dt * 3.2) addExhaustion(me.vitals, .1 * distance);
          }
          me.p = next;
        }
        if (me.fallFlying && me.lastElytraWearAt === undefined) me.lastElytraWearAt = now;
        if (me.fallFlying && now - (me.lastElytraWearAt ?? now) >= 1000) {
          me.lastElytraWearAt = now;
          const elytraEnchantments = withStackEnchantments(me.itemEnchantments, me.stackData, "armor:1", elytraId);
          if (Math.random() < elytraWearChance(elytraEnchantments, elytraId)) me.elytraDamage = Math.min(432, me.elytraDamage + 1);
          if (me.cid) await this.ctx.storage.put("elytra:" + me.cid, me.elytraDamage);
          this.send(ws, { t: "elytra-state", damage: me.elytraDamage, broken: me.elytraDamage >= 432 });
          if (me.elytraDamage >= 432) me.fallFlying = false;
        }
        me.lastPosAt = now;
        me.r = sanitizeRot(msg.r, me.r); this.serializePlayer(ws,me);
        await this.updateFrostWalker(ws, me, now);
        this.broadcastDimension({ t: "pos", id: me.id, p: me.p, r: me.r, sneak: me.sneak || undefined, fallFlying: me.fallFlying || undefined }, me.dimensionId, ws);
        if (me.dimensionId === DIMENSION_IDS.END && this.endBossDefeated) {
          const bx=Math.floor(me.p[0]), by=Math.floor(me.p[1]-0.15), bz=Math.floor(me.p[2]);
          const gatewayId=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:end_gateway"] ?? -1;
          if (Math.abs(bx-12)<=1 && Math.abs(bz)<=1 && this.blockAt(bx,by,bz,me.dimensionId)===gatewayId) {
            const outerChunks=new Map<string,Uint8Array|Uint16Array>();
            const outer = findSafeSpawn({ensureChunk:()=>undefined,get:(x:number,y:number,z:number)=>{
              const cx=chunkCoord(x),cz=chunkCoord(z),key=`${cx},${cz}`;
              let generated=outerChunks.get(key);
              if(!generated){generated=generateDimensionChunk(this.meta?.seed??1,cx,cz,DIMENSION_IDS.END);outerChunks.set(key,generated);}
              const edit=this.chunksForDimension(DIMENSION_IDS.END).get(key);
              const idx=localIndex(x,y,z); return edit&&edit[idx]!==NO_EDIT?edit[idx]:generated[idx]??B.AIR;
            }},{x:128,y:48,z:0},{height:WORLD_HEIGHT,searchRadius:32,isSolid:(id:number)=>!!BLOCKS[id]?.solid,isHazard:(id:number)=>BLOCKS[id]?.render==="liquid"});
            if(outer){me.p=[outer.x,outer.y,outer.z];this.serializePlayer(ws,me);this.send(ws,{t:"teleport",p:me.p,r:me.r});this.sys(ws,"エンドゲートウェイを通過しました");}
          } else if (Math.abs(me.p[0])<=1.55 && Math.abs(me.p[2])<=1.55 && me.p[1]>=31 && me.p[1]<=36) {
            await this.changeDimension(ws,me,"/dimension overworld",true);
            return;
          }
        }
        return;
      }
      case "attack": {
        // Client submits intent only. Target, reach, inventory, charge, critical state and damage are server-derived.
        if (!me.joined || me.vitals.dead || me.vitals.gameMode === "spectator") return;
        const mobId = typeof msg.mobId === "string" ? msg.mobId.slice(0, 64) : "";
        const heldItemId = Number.isInteger(msg.heldItemId) ? msg.heldItemId : -1;
        if (heldItemId < 0 || heldItemId >= me.counts.length) return;
        if ((me.vitals.gameMode === "survival" || me.vitals.gameMode === "adventure") && heldItemId > 0 && (me.counts[heldItemId] ?? 0) <= 0) return;
        const target = this.mobs.get(mobId);
        if (!target || mobDimensionId(target) !== me.dimensionId || !Number.isFinite(target.x) || !Number.isFinite(target.y) || !Number.isFinite(target.z)) return;
        if (target.type === "end_crystal" && target.respawnInvulnerable) return;
        const targetBodyY = target.type === "ender_dragon" ? target.y + 3.5 : target.y + 0.8;
        const dx = target.x - me.p[0], dy = targetBodyY - (me.p[1] + 1.62), dz = target.z - me.p[2];
        const reach = weaponReachForItemId(heldItemId, BLOCKS);
        if (dx * dx + dy * dy + dz * dz > reach * reach) return;
        const attackerEye: [number, number, number] = [me.p[0], me.p[1] + 1.62, me.p[2]];
        const mobBody: [number, number, number] = [target.x, targetBodyY, target.z];
        const solidAt = (x: number, y: number, z: number) => BLOCKS[this.blockAt(x, y, z, me.dimensionId)]?.solid !== false;
        if (!hasClearLine(attackerEye, mobBody, solidAt)) return;
        const now = Date.now();
        const itemChanged = me.lastAttackItemId !== undefined && me.lastAttackItemId !== heldItemId;
        const weapon = weaponStatsForItemId(heldItemId, BLOCKS);
        const attackSlotKey = typeof msg.slotKey === "string" ? msg.slotKey : "";
        const meleeEnchants = withStackEnchantments(me.itemEnchantments, me.stackData, attackSlotKey, heldItemId);
        const elapsedTicks = itemChanged ? 0 : (me.lastAttackAt === undefined ? attackDelayTicks(weapon.kind) : Math.max(0, (now - me.lastAttackAt) / 50));
        const chargeTicks = attackDelayTicks(weapon.kind);
        const falling = (me.verticalVelocity ?? 0) < -0.08;
        const blinded = me.vitals.activeEffects.some(effect => String(effect.effectId) === "blindness");
        const critical = isCriticalHit({ falling, onGround: !falling, climbing: false, inWater: me.swimming, blinded, riding: false });
        const strength = me.vitals.activeEffects.find(effect => effect.effectId === "strength")?.amplifier ?? -1;
        const weakness = me.vitals.activeEffects.find(effect => effect.effectId === "weakness")?.amplifier ?? -1;
        const baseDamage = Math.max(0, weapon.damage + enchantmentDamageBonus(meleeEnchants, heldItemId, target.type, Math.max(0, -(me.verticalVelocity ?? 0) * 0.25)) + (strength >= 0 ? 3 * (strength + 1) : 0) - (weakness >= 0 ? 4 * (weakness + 1) : 0));
        const chargedDamage = meleeDamage(baseDamage, elapsedTicks, chargeTicks, critical);
        const breach = getItemEnchantment(meleeEnchants, heldItemId, "breach");
        const effectiveArmor = Math.max(0, Number((target as any).armorPoints ?? 0) * breachArmorMultiplier(breach));
        const damage = chargedDamage * (1 - Math.min(0.8, effectiveArmor / 25));
        me.lastAttackAt = now; me.lastAttackItemId = heldItemId; this.serializePlayer(ws, me);
        const maxHealth = target.maxHealth ?? mobBaseHealth(target.type);
        const currentHealth = target.health ?? maxHealth;
        const hurt = applyDamageWithInvulnerability(damage, now, target.lastHurtAt ?? -Infinity, target.lastDamage ?? 0, 500);
        if (hurt.applied <= 0) return;
        if (attackSlotKey) await this.damageInventoryStack(ws,me,attackSlotKey,heldItemId,1);
        const windBurst = getItemEnchantment(meleeEnchants, heldItemId, "wind_burst");
        const windImpulse = weapon.kind === "mace" ? windBurstImpulse(windBurst, me.fallDistance ?? 0) : null;
        if (windImpulse) {
          this.send(ws,{t:"impulse",vx:0,vy:windImpulse.y,vz:0});
          me.fallDistance = 0;
        }
        if (weapon.kind === "sword") {
          const sweeping = getItemEnchantment(meleeEnchants, heldItemId, "sweeping_edge");
          const splash = sweepingDamage(sweeping, hurt.applied);
          if (splash > 0) for (const [otherId, other] of this.mobs) {
            if (otherId === mobId || mobDimensionId(other) !== me.dimensionId || Math.hypot(other.x-target.x, other.z-target.z) > 3) continue;
            const otherHp = other.health ?? mobBaseHealth(other.type);
            const updatedHp = Math.max(0, otherHp-splash);
            if (updatedHp <= 0) { this.mobs.delete(otherId); this.broadcastDimension({t:"mobgone",id:otherId},me.dimensionId); }
            else { const updated={...other,health:updatedHp}; this.mobs.set(otherId,updated); this.broadcastDimension({t:"mob",mob:updated},me.dimensionId); }
          }
        }
        const lunge = getItemEnchantment(meleeEnchants, heldItemId, "lunge");
        if (lunge > 0 && weapon.kind === "spear") {
          const yaw = me.r[0];
          const magnitude = 0.458 * lunge;
          this.send(ws, { t: "impulse", vx: -Math.sin(yaw) * magnitude, vy: 0.05, vz: -Math.cos(yaw) * magnitude });
        }
        const health = Math.max(0, currentHealth - hurt.applied);
        if (health <= 0) {
          this.mobs.delete(mobId);
          await this.ctx.storage.put("mobs", [...this.mobs.values()]);
          if (target.type === "ender_dragon") await this.completeEnderDragonFight(target, ws, me);
          if (target.type === "end_crystal") {
            if (target.respawnCrystal && this.endDragonRespawnAt !== null) await this.cancelEndDragonRespawnRitual(target.id);
            await this.explodeEndCrystal(target);
          }
          this.broadcastDimension({ t: "mobgone", id: mobId }, mobDimensionId(target));
          // Award supported food loot only after death persistence to avoid duplicate rewards on retry.
          if (me.vitals.gameMode === "survival" || me.vitals.gameMode === "adventure") {
            const loot = rollMobFoodLoot(target.type, Math.random, getItemEnchantment(meleeEnchants, heldItemId, "looting"));
            const foodReward = applyMobFoodLoot(me.vitals.foodCounts, loot);
            const previousFoodCounts = me.vitals.foodCounts;
            const previousExperience = me.vitals.experience;
            const experienceReward = rollMobExperience(target.type);
            let grantedExperience = experienceReward;
            grantedExperience = await this.repairMendingFromExperience(ws,me,grantedExperience);
            const elytraId = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:elytra"] ?? -1;
            if (elytraId > 0 && me.armorSlots[1] === elytraId && me.elytraDamage > 0
                && getItemEnchantment(withStackEnchantments(me.itemEnchantments,me.stackData,"armor:1",elytraId), elytraId, "mending") > 0) {
              const repair = Math.min(me.elytraDamage, Math.floor(experienceReward / 2));
              if (repair > 0) {
                me.elytraDamage -= repair;
                grantedExperience = Math.max(0, experienceReward - repair * 2);
                if (me.cid) await this.ctx.storage.put("elytra:" + me.cid, me.elytraDamage);
                this.send(ws, { t: "elytra-state", damage: me.elytraDamage, broken: false });
              }
            }
            const nextExperience = addExperience(previousExperience ?? 0, grantedExperience);
            if (foodReward.changed || nextExperience !== (previousExperience ?? 0)) {
              if (foodReward.changed) me.vitals.foodCounts = foodReward.foodCounts;
              me.vitals.experience = nextExperience;
              try {
                await this.persistVitals(me);
                this.sendStats(me);
              } catch (error) {
                me.vitals.foodCounts = previousFoodCounts;
                me.vitals.experience = previousExperience;
                throw error;
              }
            }
          }
          if (me.vitals.gameMode === "survival" || me.vitals.gameMode === "adventure") await this.spawnMobMaterialDrops(target, me.dimensionId);
        } else {
          const fleeState = MOB_PROFILES[target.type]?.kind === "passive"
            ? { fleeYaw: Math.atan2(target.x - me.p[0], target.z - me.p[2]), fleeUntil: now + 4000 }
            : {};
          const knockback = getItemEnchantment(meleeEnchants, heldItemId, "knockback");
          const distance = Math.hypot(dx, dz) || 1;
          const push = knockback * 0.38;
          const pushedX = target.x + (dx / distance) * push;
          const pushedZ = target.z + (dz / distance) * push;
          const canPush = !BLOCKS[this.blockAt(Math.floor(pushedX), Math.floor(target.y + 0.2), Math.floor(pushedZ), me.dimensionId)]?.solid;
          const fireAspect = getItemEnchantment(meleeEnchants, heldItemId, "fire_aspect");
          const fireImmune = ["blaze", "ghast", "magma_cube", "strider", "wither", "ender_dragon", "zombified_piglin"].includes(target.type);
          const updated = { ...target, maxHealth, health, lastHurtAt: hurt.lastHurtAtMs, lastDamage: hurt.lastDamage,
            ...(canPush && knockback > 0 ? { x: pushedX, z: pushedZ } : {}),
            ...(fireAspect > 0 && !fireImmune ? { burningUntil: Math.max(target.burningUntil ?? 0, now + fireAspect * 4000) } : {}),
            ...fleeState };
          this.mobs.set(mobId, updated);
          await this.ctx.storage.put("mobs", [...this.mobs.values()]);
          this.broadcastDimension({ t: "mob", mob: updated }, mobDimensionId(updated));
        }
        return;
      }
      case "stack-data": {
        const incoming = validateStackComponents(msg.stackData, BLOCKS, me.counts);
        if ((this.meta?.mode ?? "creative") !== "creative") {
          for (let slot = 0; slot < me.armorSlots.length; slot++) {
            const key = `armor:${slot}`, itemId = me.armorSlots[slot] ?? 0, current = me.stackData[key];
            if (itemId <= 0 || !current || current.itemId !== itemId) continue;
            const currentEnchants = withStackEnchantments(me.itemEnchantments, me.stackData, key, itemId);
            if (getItemEnchantment(currentEnchants, itemId, "binding_curse") > 0) incoming[key] = current;
          }
        }
        me.stackData = incoming;
        await this.persistStackData(ws, me);
        return;
      }
      case "equipment": {
        const gm = this.meta!.mode ?? "creative";
        const requested = normalizeArmorSlots(msg.armorSlots, BLOCKS, me.counts, gm === "creative");
        for (let slot = 0; slot < me.armorSlots.length; slot++) {
          const current = me.armorSlots[slot] ?? 0;
          if (current <= 0 || requested[slot] === current) continue;
          const enchants = withStackEnchantments(me.itemEnchantments, me.stackData, `armor:${slot}`, current);
          if (gm !== "creative" && getItemEnchantment(enchants, current, "binding_curse") > 0) requested[slot] = current;
        }
        me.armorSlots = requested;
        this.serializePlayer(ws, me);
        this.broadcastDimension({ t: "player-equipment", id: me.id, armorSlots: [...me.armorSlots] }, me.dimensionId, ws);
        return;
      }
      case "use-start": {
        const weaponId=Number.isSafeInteger(msg.weaponId)?msg.weaponId:0;
        const key=String(msg.slotKey??"");
        const item=BLOCKS[weaponId]?.key??"";
        if(!/^(?:hotbar:[0-8]|main:(?:[0-9]|1[0-9]|2[0-6]))$/.test(key) || !/(?:minecraft:bow|minecraft:crossbow|minecraft:trident)$/.test(item)) return;
        if((me.vitals.gameMode==="survival"||me.vitals.gameMode==="adventure") && (me.counts[weaponId]??0)<=0) return;
        me.useStartedAt=Date.now(); me.useStartedWeaponId=weaponId; me.useStartedSlotKey=key; this.serializePlayer(ws,me); return;
      }
      case "shoot": {
        if(me.vitals.dead || me.vitals.gameMode==="spectator") return;
        const weaponId=Number.isSafeInteger(msg.weaponId)?msg.weaponId:0;
        const slotKey=String(msg.slotKey??"");
        const key=BLOCKS[weaponId]?.key??"";
        const now=Date.now();
        if(!/^(?:hotbar:[0-8]|main:(?:[0-9]|1[0-9]|2[0-6]))$/.test(slotKey) || weaponId!==me.useStartedWeaponId || slotKey!==me.useStartedSlotKey || !me.useStartedAt || now-(me.lastShootAt??0)<180) return;
        const chargeMs=Math.max(0,Math.min(5000,now-me.useStartedAt));
        me.useStartedAt=undefined; me.useStartedWeaponId=undefined; me.useStartedSlotKey=undefined; me.lastShootAt=now;
        if((me.vitals.gameMode==="survival"||me.vitals.gameMode==="adventure") && (me.counts[weaponId]??0)<=0) return;
        const ench=withStackEnchantments(me.itemEnchantments,me.stackData,slotKey,weaponId);
        const get=(name:string)=>getItemEnchantment(ench,weaponId,name);
        const creative=me.vitals.gameMode==="creative";
        const arrowId=MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:arrow"]??0;
        const isBow=key==="minecraft:bow", isCrossbow=key==="minecraft:crossbow", isTrident=key==="minecraft:trident";
        if(!isBow&&!isCrossbow&&!isTrident) return;
        const spawned:ProjectileInfo[]=[];
        const baseYaw=me.r[0], pitch=me.r[1];
        const launch=(type:ProjectileInfo["type"],speed:number,damage:number,extra:Partial<ProjectileInfo>={},yawOffset=0)=>{
          const yaw=baseYaw+yawOffset, cp=Math.cos(pitch), dirX=-Math.sin(yaw)*cp, dirY=-Math.sin(pitch), dirZ=-Math.cos(yaw)*cp;
          const eid=`shot-${now.toString(36)}-${crypto.randomUUID().slice(0,8)}`;
          spawned.push({eid,type,dimensionId:me.dimensionId,ownerId:me.id,ownerKind:"player",x:me.p[0],y:me.p[1]+1.45,z:me.p[2],vx:dirX*speed,vy:dirY*speed,vz:dirZ*speed,damage,createdAt:now,...extra});
        };
        if(isBow) {
          if(chargeMs<100) return;
          const infinity=get("infinity")>0;
          if(!arrowId || (me.counts[arrowId]??0)<=0) { this.sys(ws,"矢を持っていません"); return; }
          if(!creative&&!infinity) { me.counts[arrowId]=Math.max(0,me.counts[arrowId]-1); await this.persistInventory(ws,me); this.sendInventory(ws,me); }
          const profile=bowShotProfile(chargeMs,get("power"),get("punch"),get("flame"));
          launch("arrow",10+profile.velocity*7,profile.damage,{knockback:profile.knockback,fireTicks:profile.fireTicks,pierceLevel:0});
        } else if(isCrossbow) {
          const profile=crossbowShotProfile({quickCharge:get("quick_charge"),multishot:get("multishot"),piercing:get("piercing")});
          if(chargeMs<profile.loadMs) { this.sys(ws,"クロスボウの装填が完了していません"); return; }
          if(!arrowId || (me.counts[arrowId]??0)<=0) { this.sys(ws,"矢を持っていません"); return; }
          if(!creative) { me.counts[arrowId]=Math.max(0,me.counts[arrowId]-1); await this.persistInventory(ws,me); this.sendInventory(ws,me); }
          const spread=profile.count===3?[-0.16,0,0.16]:[0];
          for(const offset of spread) launch("arrow",34,6,{pierceLevel:profile.piercing,knockback:0,fireTicks:0},offset);
        } else {
          const p=tridentShotProfile({loyalty:get("loyalty"),channeling:get("channeling"),riptide:get("riptide"),impaling:get("impaling")});
          if(chargeMs<500) { this.sys(ws,"トライデントを投げるには少し長押ししてください"); return; }
          const wet=me.swimming || this.blockAt(Math.floor(me.p[0]),Math.floor(me.p[1]),Math.floor(me.p[2]),me.dimensionId)===MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:water"];
          if(p.riptide>0 && wet) {
            const cp=Math.cos(pitch), mag=9+3*p.riptide;
            this.send(ws,{t:"impulse",vx:-Math.sin(baseYaw)*cp*mag,vy:-Math.sin(pitch)*mag+1.8,vz:-Math.cos(baseYaw)*cp*mag});
            return;
          }
          if(!creative) { me.counts[weaponId]=Math.max(0,me.counts[weaponId]-1); await this.persistInventory(ws,me); this.sendInventory(ws,me); }
          launch("trident",p.velocity*8,p.damage,{itemId:weaponId,loyalty:p.loyalty,channeling:p.channeling});
        }
        for(const projectile of spawned) { if(this.projectiles.size>=256) break; this.projectiles.set(projectile.eid,projectile); this.broadcastDimension({t:"projectile",projectile},me.dimensionId); }
        if(spawned.length) { await this.damageInventoryStack(ws,me,slotKey,weaponId,1); await this.ctx.storage.put("projectiles",[...this.projectiles.values()]); this.serializePlayer(ws,me); }
        return;
      }
      case "fish": {
        if (!this.take(me.setB, 20, 8) || me.vitals.dead || me.vitals.gameMode === "spectator") return;
        const rodId = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:fishing_rod"] ?? 0;
        const itemId = Number.isSafeInteger(msg.itemId) ? msg.itemId : 0;
        const slotKey = String(msg.slotKey ?? "");
        if (!rodId || itemId !== rodId || !/^(?:hotbar:[0-8]|main:(?:[0-9]|1[0-9]|2[0-6]))$/.test(slotKey)) return;
        const gm = me.vitals.gameMode;
        if (gm !== "creative" && (me.counts[rodId] ?? 0) <= 0) { this.sendInventory(ws, me); return; }
        const ownerKey = me.cid || me.id;
        const active = this.fishingSessions.get(ownerKey);
        if (active) {
          if (active.ownerId !== me.id || active.dimensionId !== me.dimensionId) { this.fishingSessions.delete(ownerKey); await this.persistFishingSessions(); return; }
          if (active.state !== "bite") {
            this.fishingSessions.delete(ownerKey);
            this.broadcastDimension({ t: "fishing-gone", id: active.id, ownerId: me.id }, active.dimensionId);
            await this.persistFishingSessions();
            this.sys(ws, "釣り糸を回収しました");
            return;
          }
          const enchants = withStackEnchantments(me.itemEnchantments, me.stackData, active.slotKey, active.rodItemId);
          const loot = rollFishingLootEntry(getItemEnchantment(enchants, active.rodItemId, "luck_of_the_sea"), Math.random, { openWater: active.openWater, biome: active.biome });
          const lootId = MINECRAFT_ITEM_TO_RUNTIME_ID[`minecraft:${loot.itemKey}`] ?? MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:cod"] ?? 0;
          const lootCount = Math.max(1, Math.floor(loot.count ?? 1));
          if (lootId <= 0 || inventoryCapacityFor(me, lootId) < lootCount) { this.sys(ws, "インベントリに空きがありません"); return; }
          addInventoryItems(me, lootId, lootCount);
          const experience = addExperience(me.vitals.experience ?? 0, 1 + Math.floor(Math.random() * 6));
          me.vitals.experience = experience;
          this.fishingSessions.delete(ownerKey);
          await this.persistFishingSessions();
          this.broadcastDimension({ t: "fishing-gone", id: active.id, ownerId: me.id }, active.dimensionId);
          await this.persistInventory(ws, me); this.sendInventory(ws, me);
          await this.persistVitals(me); this.sendStats(me);
          await this.damageInventoryStack(ws, me, active.slotKey, active.rodItemId, 1);
          this.sys(ws, `${BLOCKS[lootId]?.name ?? loot.itemKey} を ${lootCount} 個釣り上げました`);
          return;
        }
        const yaw = me.r[0], pitch = me.r[1], cp = Math.cos(pitch);
        const dx = -Math.sin(yaw) * cp, dy = -Math.sin(pitch), dz = -Math.cos(yaw) * cp;
        const waterIds = new Set([B.WATER, MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:water"] ?? 0].filter(id => id > 0));
        let water: {x:number;y:number;z:number} | null = null;
        for (let distance = 1.0; distance <= 14; distance += 0.2) {
          const x = Math.floor(me.p[0] + dx * distance), y = Math.floor(me.p[1] + 1.45 + dy * distance), z = Math.floor(me.p[2] + dz * distance);
          if (waterIds.has(this.blockAt(x, y, z, me.dimensionId))) { water = {x,y,z}; break; }
        }
        if (!water) { this.sys(ws, "水面に向けて釣り竿を使ってください"); return; }
        const enchants = withStackEnchantments(me.itemEnchantments, me.stackData, slotKey, rodId);
        const lure = getItemEnchantment(enchants, rodId, "lure");
        const now = Date.now();
        const openWater = isFishingOpenWater((x:number,y:number,z:number)=>this.blockAt(x,y,z,me.dimensionId), water.x,water.y,water.z,[...waterIds]);
        const biome = me.dimensionId === DIMENSION_IDS.OVERWORLD ? biomeAt(this.meta?.seed ?? 1,water.x,water.z,this.meta?.worldgenVersion===WORLDGEN_VERSION?WORLDGEN_VERSION:LEGACY_WORLDGEN_VERSION) : dimensionBiomeAt(this.meta?.seed ?? 1,water.x,water.z,me.dimensionId);
        const session: FishingSession = {
          id: `bobber-${crypto.randomUUID().slice(0,12)}`, ownerKey, ownerId: me.id, dimensionId: me.dimensionId,
          x: water.x + 0.5, y: water.y + 0.88, z: water.z + 0.5, state: "waiting", castAt: now,
          biteAt: now + fishingBiteDelay(lure), rodItemId: rodId, slotKey, openWater, biome,
        };
        this.fishingSessions.set(ownerKey, session);
        await this.persistFishingSessions();
        this.broadcastDimension({ t: "fishing", id: session.id, ownerId: me.id, dimensionId: me.dimensionId, x: session.x, y: session.y, z: session.z, state: session.state }, me.dimensionId);
        this.sys(ws, "釣り糸を垂らしました。浮きが沈んだら右クリックしてください");
        return;
      }
      case "end-crystal-place": {
        const gm = me.vitals.gameMode;
        const crystalId = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:end_crystal"] ?? 0;
        const obsidianId = MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:obsidian"] ?? 0;
        if (me.dimensionId !== DIMENSION_IDS.END || !this.endBossDefeated || gm === "spectator" || !crystalId || msg.itemId !== crystalId || ![msg.x,msg.y,msg.z].every(Number.isSafeInteger)) return;
        if (gm !== "creative" && (me.counts[crystalId] ?? 0) <= 0) { this.sendInventory(ws, me); return; }
        const ritual = [[-3,0],[3,0],[0,-3],[0,3]] as const;
        if (msg.y !== 31 || !ritual.some(([x,z]) => msg.x === x && msg.z === z) || this.blockAt(msg.x,msg.y,msg.z,me.dimensionId) !== obsidianId) return;
        const distance = Math.hypot(msg.x + .5 - me.p[0], msg.y + .5 - (me.p[1] + 1.6), msg.z + .5 - me.p[2]);
        if (distance > 6 || [...this.mobs.values()].some(m => m.type === "end_crystal" && m.respawnCrystal && Math.floor(m.x) === msg.x && Math.floor(m.z) === msg.z)) return;
        if (gm !== "creative") { me.counts[crystalId] = Math.max(0, me.counts[crystalId] - 1); await this.persistInventory(ws,me); this.sendInventory(ws,me); }
        const entity = withMobDimension({ ...createMob("end_crystal", `respawn-crystal-${crypto.randomUUID().slice(0,10)}`, msg.x + .5, 32, msg.z + .5, 0), spawnReason: "summoned" as const, respawnCrystal: true }, DIMENSION_IDS.END);
        this.mobs.set(entity.id, entity); this.broadcastDimension({ t: "mob", mob: entity }, DIMENSION_IDS.END);
        const placed = ritual.every(([x,z]) => [...this.mobs.values()].some(m => m.type === "end_crystal" && m.respawnCrystal && Math.floor(m.x) === x && Math.floor(m.z) === z));
        if (placed && this.endDragonRespawnAt === null) {
          await this.startEndDragonRespawnRitual();
        } else await this.persistMobs();
        return;
      }
      case "use-item": {
        const itemId = Number.isInteger(msg.itemId) ? msg.itemId : 0;
        const gm = this.meta!.mode ?? "creative";
        const itemKey = BLOCKS[itemId]?.key ?? "";
        if (itemKey === "minecraft:firework_rocket") {
          const elytraId = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:elytra"] ?? -1;
          const now = Date.now();
          if (!me.fallFlying || me.armorSlots[1] !== elytraId || me.elytraDamage >= 432 || now - (me.lastRocketAt ?? 0) < 500) return;
          if (gm !== "creative" && (me.counts[itemId] ?? 0) <= 0) return;
          me.lastRocketAt = now;
          if (gm !== "creative") { me.counts[itemId] = Math.max(0, me.counts[itemId] - 1); await this.persistInventory(ws, me); this.sendInventory(ws, me); }
          const yaw=me.r[0], pitch=me.r[1], cp=Math.cos(pitch);
          this.send(ws, { t: "rocket-boost", vx: -Math.sin(yaw)*cp*12, vy: -Math.sin(pitch)*12 + 1.5, vz: -Math.cos(yaw)*cp*12 });
          this.serializePlayer(ws,me);
          return;
        }
        const potion = potionSpecForItemId(itemId, BLOCKS);
        if (!potion) return;
        if (gm !== "creative" && (me.counts[itemId] ?? 0) <= 0) return;
        const bottleId = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:glass_bottle"];
        if (potion.effectId) addEffect(me.vitals, potion.effectId, potion.durationTicks, potion.amplifier);
        if (gm !== "creative") {
          me.counts[itemId] = Math.max(0, me.counts[itemId] - 1);
          if (bottleId && bottleId < me.counts.length && addInventoryItems(me, bottleId, 1) === 0) {
            // Drinking is still allowed when the inventory is full; the returned empty bottle drops nearby.
            await this.spawnDrop(me.p[0], me.p[1], me.p[2], bottleId, me.dimensionId, 1);
          }
          await this.persistInventory(ws, me); this.sendInventory(ws, me);
        }
        await this.persistVitals(me); this.sendStats(me);
        this.serializePlayer(ws, me);
        return;
      }
      case "enchant": {
        const gm=this.meta!.mode ?? "creative";
        if(gm==="spectator" || !Number.isSafeInteger(msg.x) || !Number.isSafeInteger(msg.y) || !Number.isSafeInteger(msg.z) || msg.y<1 || msg.y>=WORLD_HEIGHT) return;
        const tableId=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:enchanting_table"] ?? 0;
        if(!tableId || this.blockAt(msg.x,msg.y,msg.z,me.dimensionId)!==tableId) return;
        const dx=msg.x+0.5-me.p[0],dy=msg.y+0.5-(me.p[1]+1.6),dz=msg.z+0.5-me.p[2];
        if(dx*dx+dy*dy+dz*dz>4.5*4.5) return;
        const itemId = typeof msg.itemId === "number" && Number.isSafeInteger(msg.itemId) ? msg.itemId : 0;
        const enchantmentId=typeof msg.enchantmentId==="string"?msg.enchantmentId.toLowerCase().replace(/^minecraft:/,""):"";
        const level=Number.isInteger(msg.level)?msg.level:0;
        const rawCostLevel = msg.costLevel;
        const costLevel = typeof rawCostLevel === "number" && Number.isSafeInteger(rawCostLevel) ? Math.max(1, Math.min(3, rawCostLevel)) : Math.max(1, Math.min(3, level));
        const bookshelfId=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:bookshelf"]??0;
        const power=countEnchantingBookshelves((bx:number,by:number,bz:number)=>this.blockAt(bx,by,bz,me.dimensionId),msg.x,msg.y,msg.z,bookshelfId);
        if(costLevel===2 && power<7 || costLevel===3 && power<15) { this.sys(ws,`本棚パワーが不足しています (${power}/15)`); return; }
        const key=typeof msg.slotKey==="string"?msg.slotKey:"";
        const stack=stackDataForSlot(me.stackData,key,itemId,1);
        if(itemId<=0 || itemId>=BLOCKS.length || level<1 || level>(ENCHANTMENT_MAX_LEVEL[enchantmentId]??0) || (key && !stack && gm!=="creative")) return;
        const updated = key
          ? { kind: "stack" as const, value: setStackEnchantment(me.stackData,key,itemId,stack?.count??1,enchantmentId,level,BLOCKS) }
          : { kind: "enchantments" as const, value: setItemEnchantment(me.itemEnchantments,itemId,enchantmentId,level,BLOCKS) };
        if(!updated.value) { this.sys(ws,"そのエンチャントはこのアイテムに付与できません"); return; }
        if(gm!=="creative") {
          if((me.counts[itemId]??0)<=0) { this.sendInventory(ws,me); return; }
          const lapisId=MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:lapis_lazuli"]??0;
          if(!lapisId || (me.counts[lapisId]??0)<costLevel) { this.sys(ws,"ラピスラズリが足りません"); return; }
          const progress=getExperienceProgress(me.vitals.experience??0);
          if(progress.level<costLevel) { this.sys(ws,`経験値レベル${costLevel}が必要です`); return; }
          me.vitals.experience=experienceThreshold(Math.max(0,progress.level-costLevel))+progress.pointsInLevel;
          me.counts[lapisId]=Math.max(0,me.counts[lapisId]-costLevel);
          await this.persistInventory(ws,me); this.sendInventory(ws,me);
          await this.persistVitals(me); this.sendStats(me);
        }
        if(updated.kind === "stack") { me.stackData=updated.value; await this.persistStackData(ws,me); }
        else { me.itemEnchantments=updated.value; await this.persistEnchantments(ws,me); }
        this.sys(ws,`${BLOCKS[itemId]?.name??"アイテム"} に ${enchantmentId} ${level} を付与しました`);
        return;
      }
      case "anvil": {
        if (!Number.isSafeInteger(msg.x) || !Number.isSafeInteger(msg.y) || !Number.isSafeInteger(msg.z) || msg.y<1 || msg.y>=WORLD_HEIGHT) return;
        const bid=this.blockAt(msg.x,msg.y,msg.z,me.dimensionId);
        const allowed=["minecraft:anvil","minecraft:chipped_anvil","minecraft:damaged_anvil"].some(k=>MINECRAFT_BLOCK_TO_RUNTIME_ID[k]===bid);
        if(!allowed) return;
        const dx=msg.x+0.5-me.p[0],dy=msg.y+0.5-(me.p[1]+1.6),dz=msg.z+0.5-me.p[2];
        if(dx*dx+dy*dy+dz*dz>4.5*4.5) return;
        const firstKey=String(msg.firstSlot??"");
        const first=me.stackData[firstKey];
        if(!first || first.count!==1) { this.sys(ws,"金床には1個のアイテムスタックを指定してください"); return; }
        let result:any=null, cost=0, secondKey=String(msg.secondSlot??"");
        if(msg.operation==="rename") {
          const rename=String(msg.rename??"").replace(/[\u0000-\u001f]/g,"").trim().slice(0,50);
          if(!rename || rename===first.customName) return;
          cost=Math.max(1,Number(first.repairCost??0)+1);
          result={...first,customName:rename,repairCost:Math.min(127,Math.max(0,Number(first.repairCost??0)*2+1))};
        } else if(msg.operation==="combine") {
          const second=me.stackData[secondKey];
          if(!second || second.count!==1 || secondKey===firstKey) return;
          const maximum=first.itemId===second.itemId ? maxDurabilityForItemKey(BLOCKS[first.itemId]?.key) : maxDurabilityForItemKey(BLOCKS[first.itemId]?.key);
          const combined=combineAnvilStacks(first,second,{blocks:BLOCKS,maxDamage:maximum});
          if(!combined.ok) { this.sys(ws,combined.reason==="too_expensive"?"コストが高すぎます":"組み合わせられないアイテムです"); return; }
          result=combined.result; cost=combined.cost;
        } else return;
        if((this.meta?.mode ?? "creative")!=="creative") {
          const xp=getExperienceProgress(me.vitals.experience??0);
          if(xp.level<cost) { this.sys(ws,`経験値レベル${cost}が必要です`); return; }
          me.vitals.experience=experienceThreshold(Math.max(0,xp.level-cost))+xp.pointsInLevel;
          await this.persistVitals(me); this.sendStats(me);
        }
        me.stackData={...me.stackData,[firstKey]:result};
        if(secondKey && msg.operation==="combine") {
          const second=me.stackData[secondKey]; delete me.stackData[secondKey];
          me.counts[second.itemId]=Math.max(0,(me.counts[second.itemId]??0)-1);
          await this.persistInventory(ws,me); this.sendInventory(ws,me);
        }
        await this.persistStackData(ws,me); return;
      }
      case "grindstone": {
        if (!Number.isSafeInteger(msg.x) || !Number.isSafeInteger(msg.y) || !Number.isSafeInteger(msg.z) || msg.y<1 || msg.y>=WORLD_HEIGHT) return;
        const grindstoneId=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:grindstone"]??0;
        if(!grindstoneId || this.blockAt(msg.x,msg.y,msg.z,me.dimensionId)!==grindstoneId) return;
        const dx=msg.x+0.5-me.p[0],dy=msg.y+0.5-(me.p[1]+1.6),dz=msg.z+0.5-me.p[2];
        if(dx*dx+dy*dy+dz*dz>4.5*4.5) return;
        const firstKey=String(msg.firstSlot??""), secondKey=String(msg.secondSlot??"");
        const first=me.stackData[firstKey], second=secondKey?me.stackData[secondKey]:null;
        if(!first || first.count!==1 || (secondKey && (!second || second.count!==1))) return;
        const cleaned=grindstoneStack(first,second,maxDurabilityForItemKey(BLOCKS[first.itemId]?.key));
        if(!cleaned.ok) return;
        me.stackData={...me.stackData,[firstKey]:cleaned.result};
        if(secondKey) { delete me.stackData[secondKey]; me.counts[second.itemId]=Math.max(0,(me.counts[second.itemId]??0)-1); }
        me.vitals.experience=addExperience(me.vitals.experience??0,cleaned.experience);
        await this.persistInventory(ws,me); this.sendInventory(ws,me); await this.persistVitals(me); this.sendStats(me);
        await this.persistStackData(ws,me); return;
      }
      case "place-door": {
        if (!this.take(me.setB, 30, 20)) return;
        const { x, y, z, blockId } = msg;
        if (![x, y, z, blockId].every(Number.isSafeInteger) || y < 1 || y + 1 >= WORLD_HEIGHT || !BLOCKS[blockId] || BLOCKS[blockId].shape !== "door" || BLOCKS[blockId].key.includes("_fence_gate")) return;
        const itemId = blockItemId(blockId), gm = this.meta!.mode ?? "creative";
        if (gm === "spectator" || !itemId || ((gm === "survival" || gm === "adventure") && (me.counts[itemId] ?? 0) <= 0)) { this.send(ws, { t: "reject", x, y, z }); this.sendInventory(ws, me); return; }
        const dx = x + 0.5 - me.p[0], dy = y + 1 - (me.p[1] + 1.6), dz = z + 0.5 - me.p[2];
        const overlaps = (cy: number) => me.p[0] + 0.3 > x && me.p[0] - 0.3 < x + 1 && me.p[1] + 1.8 > cy && me.p[1] < cy + 1 && me.p[2] + 0.3 > z && me.p[2] - 0.3 < z + 1;
        if (dx * dx + dy * dy + dz * dz > SERVER_REACH * SERVER_REACH || !isReplaceableBlock(this.blockAt(x, y, z, me.dimensionId), BLOCKS) || !isReplaceableBlock(this.blockAt(x, y + 1, z, me.dimensionId), BLOCKS) || !BLOCKS[this.blockAt(x, y - 1, z, me.dimensionId)]?.solid || overlaps(y) || overlaps(y + 1)) { this.send(ws, { t: "reject", x, y, z }); return; }
        const lower = blockStateVariantId(blockId, { half: "lower" }), upper = blockStateVariantId(blockId, { half: "upper" });
        if (!await this.applyEdit(x, y, z, lower, me.dimensionId)) { this.send(ws, { t: "reject", x, y, z }); return; }
        if (!await this.applyEdit(x, y + 1, z, upper, me.dimensionId)) { await this.applyEdit(x, y, z, 0, me.dimensionId); this.broadcastDimension({ t: "set", x, y, z, b: 0, id: me.id }, me.dimensionId); this.send(ws, { t: "reject", x, y, z }); return; }
        if (gm === "survival" || gm === "adventure") { me.counts[itemId] = Math.max(0, me.counts[itemId] - 1); await this.persistInventory(ws, me); this.sendInventory(ws, me); }
        this.broadcastDimension({ t: "set", x, y, z, b: lower, id: me.id }, me.dimensionId);
        this.broadcastDimension({ t: "set", x, y: y + 1, z, b: upper, id: me.id }, me.dimensionId);
        await this.updateBlockStatesAt(x, y, z, me.dimensionId);
        return;
      }
      case "place-bed": {
        if (!this.take(me.setB, 30, 20)) return;
        const { x, y, z, blockId } = msg; const def = BLOCKS[blockId];
        if (![x, y, z, blockId].every(Number.isSafeInteger) || y < 1 || y >= WORLD_HEIGHT || !def?.key.endsWith("_bed") || def.state?.part !== "foot") { this.send(ws, { t: "reject", x, y, z }); return; }
        const itemId = blockItemId(blockId), gm = this.meta!.mode ?? "creative";
        if (gm === "spectator" || !itemId || ((gm === "survival" || gm === "adventure") && (me.counts[itemId] ?? 0) <= 0)) { this.send(ws, { t: "reject", x, y, z }); this.sendInventory(ws, me); return; }
        const facing = String(def.state?.facing ?? "north"); const [dx, dz] = ({ north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] } as Record<string, [number, number]>)[facing] ?? [0, -1];
        const hx = x + dx, hz = z + dz, head = blockStateVariantId(blockId, { part: "head" });
        const px = x + 0.5 - me.p[0], py = y + 1 - (me.p[1] + 1.6), pz = z + 0.5 - me.p[2];
        const replaceable = (bx: number, by: number, bz: number) => isReplaceableBlock(this.blockAt(bx, by, bz, me.dimensionId), BLOCKS);
        const overlap = (bx: number, bz: number) => me.p[0] + 0.3 > bx && me.p[0] - 0.3 < bx + 1 && me.p[1] + 1.8 > y && me.p[1] < y + 1 && me.p[2] + 0.3 > bz && me.p[2] - 0.3 < bz + 1;
        if (px * px + py * py + pz * pz > SERVER_REACH * SERVER_REACH || !head || head === blockId || !replaceable(x, y, z) || !replaceable(hx, y, hz) || !BLOCKS[this.blockAt(x, y - 1, z, me.dimensionId)]?.solid || !BLOCKS[this.blockAt(hx, y - 1, hz, me.dimensionId)]?.solid || overlap(x, z) || overlap(hx, hz)) { this.send(ws, { t: "reject", x, y, z }); return; }
        if (!await this.applyEdit(x, y, z, blockId, me.dimensionId)) { this.send(ws, { t: "reject", x, y, z }); return; }
        if (!await this.applyEdit(hx, y, hz, head, me.dimensionId)) { await this.applyEdit(x, y, z, 0, me.dimensionId); this.broadcastDimension({ t: "set", x, y, z, b: 0 }, me.dimensionId); this.send(ws, { t: "reject", x, y, z }); return; }
        if (gm === "survival" || gm === "adventure") { me.counts[itemId] = Math.max(0, me.counts[itemId] - 1); await this.persistInventory(ws, me); this.sendInventory(ws, me); }
        this.broadcastDimension({ t: "set", x, y, z, b: blockId, id: me.id }, me.dimensionId); this.broadcastDimension({ t: "set", x: hx, y, z: hz, b: head, id: me.id }, me.dimensionId);
        await this.updateBlockStatesAt(x, y, z, me.dimensionId); await this.updateBlockStatesAt(hx, y, hz, me.dimensionId); return;
      }
      case "dig-start": {
        if (!this.take(me.setB, 30, 20)) return;
        const { x, y, z } = msg;
        if (!isValidSet(x, y, z, 0) || y < 1) return;
        const blockId = this.blockAt(x, y, z, me.dimensionId);
        const gm = this.meta!.mode ?? "creative";
        if (blockId <= 0 || blockId === B.BEDROCK || (gm !== "survival" && !(gm === "adventure" && canAdventureEdit(0, blockId)))) return;
        const dx = x + 0.5 - me.p[0], dy = y + 0.5 - (me.p[1] + 1.6), dz = z + 0.5 - me.p[2];
        if (dx * dx + dy * dy + dz * dz > SERVER_REACH * SERVER_REACH) return;
        const rawToolItemId = msg.toolItemId;
        const toolItemId = typeof rawToolItemId === "number" && Number.isSafeInteger(rawToolItemId) && rawToolItemId >= 0 && rawToolItemId < BLOCKS.length ? rawToolItemId : 0;
        if ((gm === "survival" || gm === "adventure") && toolItemId > 0 && (me.counts[toolItemId] ?? 0) <= 0) return;
        me.digTarget = `${x},${y},${z}`;
        me.digToolItemId = toolItemId;
        me.digToolSlotKey = typeof msg.slotKey === "string" ? msg.slotKey : "";
        me.digStartedAt = Date.now();
        this.send(ws, { t: "dig-ready", x, y, z });
        return;
      }
      case "dig-cancel": {
        me.digTarget = undefined;
        me.digToolItemId = undefined;
        me.digToolSlotKey = undefined;
        me.digStartedAt = undefined;
        return;
      }
      case "craft": {
        if (!this.take(me.setB, 30, 20)) return;
        if (typeof msg.recipeId !== "string" || msg.recipeId.length > 64) return;
        const gm = this.meta!.mode ?? "creative";
        if (gm === "spectator") { this.sendInventory(ws, me); return; }
        const recipes = createCraftRecipes(B);
        const recipe = recipes.find((item) => item.id === msg.recipeId);
        const grid = Array.isArray(msg.grid) ? msg.grid : craftGridForRecipe(recipe, msg.workbench ? {} : { rowOffset: 0, colOffset: 0, gridWidth: 2 });
        if (msg.workbench) {
          const [wx, wy, wz] = msg.workbench;
          const tableId = this.blockAt(wx, wy, wz, me.dimensionId);
          if (![wx, wy, wz].every(Number.isSafeInteger) || tableId <= 0 || BLOCKS[tableId]?.key !== "minecraft:crafting_table") { this.sendInventory(ws, me); return; }
          const dx = wx + 0.5 - me.p[0], dy = wy + 0.5 - (me.p[1] + 1.6), dz = wz + 0.5 - me.p[2];
          if (dx * dx + dy * dy + dz * dz > SERVER_REACH * SERVER_REACH) { this.sendInventory(ws, me); return; }
        } else if (!craftRecipeFitsGrid(recipe, 2, 2) || !Array.isArray(grid) || grid.length !== 9
          || grid.some((itemId, index) => ![0, 1, 3, 4].includes(index) && itemId !== 0)) { this.sendInventory(ws, me); return; }
        const result = craftFromGrid(me.counts, msg.recipeId, grid, recipes, { creative: gm === "creative", maxStack: 64 });
        if (!result.ok) { this.sendInventory(ws, me); return; }
        me.counts = result.counts;
        await this.persistInventory(ws, me);
        this.sendInventory(ws, me);
        return;
      }
      case "furnace": {
        await this.handleFurnaceMessage(ws, me, msg);
        return;
      }
      case "use": {
        if (!this.take(me.setB, 30, 20)) return;
        const { x, y, z } = msg;
        if (![x, y, z].every(Number.isSafeInteger) || y < 1 || y >= WORLD_HEIGHT) return;
        if ((this.meta!.mode ?? "creative") === "spectator") return;
        const dx = x + 0.5 - me.p[0], dy = y + 0.5 - (me.p[1] + 1.6), dz = z + 0.5 - me.p[2];
        if (dx * dx + dy * dy + dz * dz > SERVER_REACH * SERVER_REACH) return;
        const current = this.blockAt(x, y, z, me.dimensionId);
        const currentDef = BLOCKS[current];
        const flintId = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:flint_and_steel"];
        if (current === PORTAL_BLOCK_IDS.obsidian && msg.itemId === flintId) {
          const face = [msg.nx, msg.ny, msg.nz];
          if (!face.every(Number.isSafeInteger)) return;
          const nx = msg.nx!, ny = msg.ny!, nz = msg.nz!;
          if (Math.abs(nx) + Math.abs(ny) + Math.abs(nz) !== 1) return;
          const gm = this.meta!.mode ?? "creative";
          const slotKey = typeof msg.slotKey === "string" ? msg.slotKey : "";
          if (gm === "spectator" || (gm !== "creative" && ((me.counts[flintId] ?? 0) <= 0 || !/^hotbar:[0-8]$/.test(slotKey)))) { this.sendInventory(ws, me); return; }
          const edits = tryLightPortal((a, by, c) => this.blockAt(a, by, c, me.dimensionId), { x, y, z, nx, ny, nz });
          if (!edits) { this.sys(ws, "黒曜石の枠が正しくないか、内部に空間がありません"); return; }
          if (!edits.length || edits.some(([a, by, c, block]) => !isValidSet(a, by, c, block) || by < 1 || by >= WORLD_HEIGHT || this.blockAt(a, by, c, me.dimensionId) !== B.AIR)) return;
          const applied: [number, number, number, number][] = [];
          for (const [a, by, c, block] of edits) {
            if (this.blockAt(a, by, c, me.dimensionId) !== B.AIR || !await this.applyEdit(a, by, c, block, me.dimensionId)) {
              for (const [rx, ry, rz] of applied.reverse()) {
                await this.applyEdit(rx, ry, rz, B.AIR, me.dimensionId);
                this.broadcastDimension({ t: "set", x: rx, y: ry, z: rz, b: B.AIR, id: me.id }, me.dimensionId);
              }
              return;
            }
            applied.push([a, by, c, block]);
            this.broadcastDimension({ t: "set", x: a, y: by, z: c, b: block, id: me.id }, me.dimensionId);
          }
          if (gm !== "creative") await this.damageInventoryStack(ws, me, slotKey, flintId, 1);
          return;
        }
        const furnaceStation = this.furnaceStationForBlock(current);
        if (furnaceStation) { await this.openFurnace(ws, me, x, y, z, furnaceStation); return; }
        if (currentDef?.shape === "trapdoor" || currentDef?.shape === "door") {
          if (currentDef.shape === "trapdoor" || currentDef.key.includes("_fence_gate")) {
            const next = blockStateVariantId(current, { open: currentDef.state?.open !== true });
            if (next !== current && await this.applyEdit(x, y, z, next, me.dimensionId)) this.broadcastDimension({ t: "set", x, y, z, b: next, id: me.id }, me.dimensionId);
            return;
          }
          const lowerY = currentDef.state?.half === "upper" ? y - 1 : y;
          const lower = this.blockAt(x, lowerY, z, me.dimensionId), upper = this.blockAt(x, lowerY + 1, z, me.dimensionId);
          if (BLOCKS[lower]?.shape !== "door" || BLOCKS[upper]?.shape !== "door") return;
          const open = BLOCKS[lower]?.state?.open !== true;
          const lowerNext = blockStateVariantId(lower, { open }), upperNext = blockStateVariantId(upper, { open });
          if (!await this.applyEdit(x, lowerY, z, lowerNext, me.dimensionId)) return;
          if (!await this.applyEdit(x, lowerY + 1, z, upperNext, me.dimensionId)) {
            await this.applyEdit(x, lowerY, z, lower, me.dimensionId);
            this.broadcastDimension({ t: "set", x, y: lowerY, z, b: lower, id: me.id }, me.dimensionId);
            return;
          }
          this.broadcastDimension({ t: "set", x, y: lowerY, z, b: lowerNext, id: me.id }, me.dimensionId);
          this.broadcastDimension({ t: "set", x, y: lowerY + 1, z, b: upperNext, id: me.id }, me.dimensionId);
          await this.updateBlockStatesAt(x, lowerY, z, me.dimensionId);
          return;
        }
        const repeaterIds = Array.from({ length: 16 }, (_, i) => B.REDSTONE_REPEATER + i);
        const next = current === B.REDSTONE_LEVER_OFF ? B.REDSTONE_LEVER_ON : current === B.REDSTONE_LEVER_ON ? B.REDSTONE_LEVER_OFF : nextRepeaterDelayBlockId(current, repeaterIds) ?? 0;
        if (!next || !await this.applyEdit(x, y, z, next, me.dimensionId)) return;
        if (current >= B.REDSTONE_REPEATER && current < B.REDSTONE_REPEATER + 16) {
          const delay = this.repeaterDelayForDimension(me.dimensionId);
          if (delay.cancel(`${x},${y},${z}`)) await this.persistRepeaterState();
        }
        this.broadcastDimension({ t: "set", x, y, z, b: next, id: me.id }, me.dimensionId);
        await this.updateRedstoneAt(x, y, z, me.dimensionId);
        return;
      }
      case "set": {
        if (!this.take(me.setB, 30, 20)) return;
        const { x, y, z, b } = msg;
        if (!isValidSet(x, y, z, b)) return;
        if (b > 0 && (!BLOCKS[b] || blockItemId(b) <= 0 || b === B.BEDROCK || b === B.WATER || b === B.LAVA || (BLOCKS[b].shape === "door" && !BLOCKS[b].key.includes("_fence_gate")) || BLOCKS[b].key.endsWith("_bed"))) { this.send(ws, { t: "reject", x, y, z }); return; }
        const brokenBlockId = b === 0 ? this.blockAt(x, y, z, me.dimensionId) : 0;
        const brokenStation = b === 0 ? this.furnaceStationForBlock(brokenBlockId) : null;
        if (brokenStation) {
          const saved = this.furnaces.get(this.furnaceKey(me.dimensionId, x, y, z));
          if (saved && (furnaceHasContents(saved.state) || saved.state.burnTicks > 0 || saved.state.cookTicks > 0)) { this.send(ws, { t: "reject", x, y, z }); return; }
        }
        const gm = this.meta!.mode ?? "creative";
        if (b === 0 && (brokenBlockId <= 0 || brokenBlockId === B.BEDROCK || y < 1)) { this.send(ws, { t: "reject", x, y, z }); return; }
        const placedItem = b > 0 ? blockItemId(b) : 0;
        let brokenToolItemId = 0, brokenToolSlotKey = "";
        let loot: { itemId: number; count: number }[] = [];
        if (b === 0 && (gm === "survival" || gm === "adventure")) {
          const target = `${x},${y},${z}`;
          brokenToolItemId = me.digToolItemId ?? 0; brokenToolSlotKey = me.digToolSlotKey ?? "";
          const toolEnchantments = withStackEnchantments(me.itemEnchantments, me.stackData, brokenToolSlotKey, brokenToolItemId);
          const armorEnchantments = { ...toolEnchantments };
          for (let slot = 0; slot < me.armorSlots.length; slot++) Object.assign(armorEnchantments, withStackEnchantments(me.itemEnchantments, me.stackData, `armor:${slot}`, me.armorSlots[slot]));
          const requiredMs = miningTimeSeconds(brokenBlockId, B, me.vitals.activeEffects, brokenToolItemId, BLOCKS, armorEnchantments, me.armorSlots, me.swimming) * 1000;
          if (me.digTarget !== target || me.digStartedAt === undefined || !Number.isFinite(requiredMs) || Date.now() - me.digStartedAt < requiredMs) { this.send(ws, { t: "reject", x, y, z }); return; }
          me.digTarget = undefined; me.digToolItemId = undefined; me.digToolSlotKey = undefined; me.digStartedAt = undefined;
          if (gm === "survival") {
            const record = toolEnchantments[String(brokenToolItemId)] ?? {};
            loot = getBlockDrops(brokenBlockId, B, blockItemId, { blocks: BLOCKS, stateMeta: MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID, toolItemId: brokenToolItemId, enchantments: record });
          }
        }
        if (gm === "spectator" || (gm === "adventure" && !canAdventureEdit(b, b === 0 ? brokenBlockId : 0))) { this.send(ws, { t: "reject", x, y, z }); return; }
        if ((gm === "survival" || gm === "adventure") && placedItem > 0 && (me.counts[placedItem] ?? 0) <= 0) { this.send(ws, { t: "reject", x, y, z }); this.sendInventory(ws, me); return; }
        if (b > 0 && !canPlaceBlockAt((bx, by, bz) => this.blockAt(bx, by, bz, me.dimensionId), b, x, y, z, BLOCKS)) { this.send(ws, { t: "reject", x, y, z }); return; }
        if (b > 0 && BLOCKS[b]?.solid && me.p[0] + 0.3 > x && me.p[0] - 0.3 < x + 1 && me.p[1] + 1.8 > y && me.p[1] < y + 1 && me.p[2] + 0.3 > z && me.p[2] - 0.3 < z + 1) { this.send(ws, { t: "reject", x, y, z }); return; }
        const dx = x + 0.5 - me.p[0], dy = y + 0.5 - (me.p[1] + 1.6), dz = z + 0.5 - me.p[2];
        if (dx * dx + dy * dy + dz * dz > SERVER_REACH * SERVER_REACH) { this.send(ws, { t: "reject", x, y, z }); return; }
        const ok = await this.applyEdit(x, y, z, b, me.dimensionId);
        if (!ok) { this.send(ws, { t: "reject", x, y, z }); return; }
        if (b === 0 && brokenStation && this.furnaces.delete(this.furnaceKey(me.dimensionId, x, y, z))) await this.persistFurnaces();
        if (b === 0) {
          const pair = pairedBlockPosition(brokenBlockId, x, y, z, BLOCKS);
          if (pair) {
            const pairId = this.blockAt(pair.x, pair.y, pair.z, me.dimensionId);
            const samePair = pairId > 0 && blockToken(pairId, BLOCKS) === blockToken(brokenBlockId, BLOCKS) && (BLOCKS[brokenBlockId]?.shape === "door" ? BLOCKS[pairId]?.shape === "door" : BLOCKS[pairId]?.state?.part !== BLOCKS[brokenBlockId]?.state?.part);
            if (samePair && await this.applyEdit(pair.x, pair.y, pair.z, 0, me.dimensionId)) this.broadcastDimension({ t: "set", x: pair.x, y: pair.y, z: pair.z, b: 0, id: me.id }, me.dimensionId);
          }
        }
        if (b === 0 && (gm === "survival" || gm === "adventure") && brokenToolItemId > 0 && brokenToolSlotKey) await this.damageInventoryStack(ws, me, brokenToolSlotKey, brokenToolItemId, 1);
        if (b === 0 && brokenBlockId >= B.REDSTONE_REPEATER && brokenBlockId < B.REDSTONE_REPEATER + 16) { const delay = this.repeaterDelayForDimension(me.dimensionId); if (delay.remove(`${x},${y},${z}`)) await this.persistRepeaterState(); }
        if ((gm === "survival" || gm === "adventure") && placedItem > 0) { me.counts[placedItem] = Math.max(0, me.counts[placedItem] - 1); await this.persistInventory(ws, me); this.sendInventory(ws, me); }
        this.broadcastDimension({ t: "set", x, y, z, b, id: me.id }, me.dimensionId);
        if (b === 0 && (brokenBlockId === PORTAL_BLOCK_IDS.obsidian || brokenBlockId === PORTAL_BLOCK_IDS.netherPortal)) {
          const collapsed = portalCollapseEdits((a, by, c) => this.blockAt(a, by, c, me.dimensionId), x, y, z);
          for (const [a, by, c, block] of collapsed) {
            if (!await this.applyEdit(a, by, c, block, me.dimensionId)) continue;
            this.broadcastDimension({ t: "set", x: a, y: by, z: c, b: block, id: me.id }, me.dimensionId);
          }
        }
        await this.updateBlockStatesAt(x, y, z, me.dimensionId);
        await this.updateRedstoneAt(x, y, z, me.dimensionId);
        if (b === 0 && (gm === "survival" || gm === "adventure")) { addExhaustion(me.vitals, .005); await this.persistVitals(me); this.sendStats(me); }
        if (b === 0 && gm === "survival") for (const drop of loot) await this.spawnDrop(x, y, z, drop.itemId, me.dimensionId, drop.count);
        return;
      }
      case "jump": {
        const now = Date.now();
        if (now - me.lastJumpAt >= 200) {
          me.lastJumpAt = now;
          if (me.vitals.gameMode === "survival" || me.vitals.gameMode === "adventure") addExhaustion(me.vitals, me.sprint ? .2 : .05);
          await this.persistVitals(me); this.sendStats(me);
        }
        return;
      }
      case "hurt": {
        const now = Date.now();
        if (now - me.lastDamageAt < 250) return;
        me.lastDamageAt = now;
        const allowed: DamageCause[] = ["fall","mob","player","fire","lava","suffocation","drowning","generic"];
        if (!allowed.includes(msg.cause) || !Number.isFinite(msg.amount)) return;
        const damage = Math.min(20, Math.max(0, msg.amount));
        if (damage <= 0) return;
        const mitigated = ["drowning", "starvation"].includes(msg.cause) ? damage
          : msg.cause === "fall" ? applyArmorReduction(damage, [], BLOCKS, me.itemEnchantments, "fall", me.armorSlots)
            : applyArmorReduction(damage, me.armorSlots, BLOCKS, me.itemEnchantments, msg.cause);
        const wasDead = me.vitals.dead;
        applyDamage(me.vitals, mitigated, msg.cause); addExhaustion(me.vitals, .1);
        if (!wasDead && me.vitals.dead) {
          await this.applyVanishingCurseOnDeath(ws, me);
          await this.handleDeathDrops(ws, me);
          this.broadcast({ t: "chat", id: "", name: "", text: `${me.name} は死亡した` });
        }
        await this.persistVitals(me); this.sendStats(me, !wasDead && me.vitals.dead ? "death" : undefined); return;
      }
      case "eat": {const foodId=typeof msg.foodId==="string"?msg.foodId:"";const food=FOOD_DEFS[foodId];
        if(!food||me.vitals.eatingFoodId||(me.vitals.foodCounts[foodId]??0)<=0||(!food.canEatWhenFull&&me.vitals.foodLevel>=20)){this.send(ws,{t:"error",message:"その食料は食べられません"});return;}
        me.vitals.eatingFoodId=foodId;me.vitals.eatingTicksRemaining=food.eatTicks;await this.persistVitals(me);this.sendStats(me);return;
      }
      case "pickup": {
        if (!this.take(me.setB, 30, 20)) return;
        const eid = typeof msg.eid === "string" ? msg.eid : "";
        const dr = this.drops.get(eid);
        if (!dr) { this.send(ws, { t: "gone", eid, by: "" }); return; }
        if (dr.dimensionId !== me.dimensionId) return;
        const dx = dr.x + 0.5 - me.p[0], dz = dr.z + 0.5 - me.p[2];
        const up = dr.y - me.p[1];
        if (dx * dx + dz * dz > PICKUP_XZ * PICKUP_XZ || up > PICKUP_DY_UP || up < -4) return;
        const survival = me.vitals.gameMode === "survival" || me.vitals.gameMode === "adventure";
        const isXpDrop = Number.isSafeInteger(dr.xp) && (dr.xp ?? 0) > 0;
        const xpTransfer = isXpDrop ? takeExperienceFromDrop(me.vitals.experience, dr.xp ?? 0) : null;
        if (isXpDrop && (!survival || !xpTransfer || xpTransfer.taken <= 0)) return;
        const rawItem = Number.isSafeInteger(dr.itemId) ? dr.itemId : dr.b;
        const item = survival && !isXpDrop && Number.isSafeInteger(rawItem) && (rawItem ?? 0) > 0 && (rawItem ?? 0) < BLOCKS.length && BLOCKS[rawItem ?? 0] ? rawItem! : 0;
        const stackLimit = item > 0 ? itemStackLimit(item) : MAX_STACK;
        const amount = Number.isSafeInteger(dr.count) ? Math.max(1, Math.min(stackLimit, dr.count!)) : 1;
        const capacity = item > 0 ? inventoryCapacityFor(me, item) : 0;
        if (item > 0 && capacity === 0) return;
        const taken = item > 0 ? Math.min(amount, capacity) : 0;
        const remaining = item > 0 ? amount - taken : 0;
        const nextCounts = item > 0
          ? normalizeInventory(me.counts.map((count, index) => index === item ? count + taken : count))
          : null;
        const nextVitals = xpTransfer && xpTransfer.taken > 0
          ? { ...me.vitals, experience: xpTransfer.experience }
          : null;
        const nextDrop = isXpDrop
          ? (xpTransfer!.remaining > 0 ? { ...dr, xp: xpTransfer!.remaining } : null)
          : (remaining > 0 ? { ...dr, count: remaining } : null);
        const priorDrops = [...this.drops.entries()];
        if (nextDrop) this.drops.set(eid, nextDrop); else this.drops.delete(eid);
        try {
          const saved = (nextCounts || nextVitals) && me.cid ? await loadPlayerSave(this.ctx.storage, me.cid) : null;
          const nextSave = saved ? createPlayerSaveSnapshot({
            ...saved.snapshot,
            ...(nextCounts ? { inventory: nextCounts } : {}),
            ...(nextVitals ? { vitals: nextVitals } : {}),
            armorSlots: me.armorSlots,
          }, Date.now()) : null;
          await this.ctx.storage.transaction(async (txn) => {
            await txn.put("drops", [...this.drops.values()]);
            if (nextCounts && me.cid) await txn.put("i:" + me.cid, nextCounts);
            if (nextVitals && me.cid) await txn.put("p:" + me.cid, nextVitals);
            if (nextSave && me.cid) await txn.put("player-save:" + me.cid, nextSave);
          });
        } catch (error) {
          this.drops = new Map(priorDrops);
          throw error;
        }
        if (nextCounts) me.counts = nextCounts;
        if (nextVitals) me.vitals.experience = nextVitals.experience;
        if (nextDrop) {
          this.broadcastDimension({ t: "drop", eid, x: dr.x, y: dr.y, z: dr.z, ...(isXpDrop ? { xp: xpTransfer!.remaining } : { itemId: item, count: remaining }) }, dr.dimensionId);
        } else {
          this.broadcastDimension({ t: "gone", eid, by: me.id }, dr.dimensionId);
        }
        if (nextCounts || nextVitals) this.serializePlayer(ws, me);
        if (nextCounts) this.sendInventory(ws, me);
        if (nextVitals) this.sendStats(me);
        return;
      }
      case "portal": {
        await this.portalTravel(ws, me, msg.inside !== false);
        return;
      }
      case "chat": {
        if (!this.take(me.chatB, 5, 1)) return;
        const text = sanitizeChat(msg.text);
        if (!text) return;
        if (/^\/dimension(?:\s|$)/i.test(text)) { await this.changeDimension(ws, me, text); return; }
        if (text.startsWith("/")) { await this.command(ws, me, text); return; }
        this.broadcast({ t: "chat", id: me.id, name: me.name, text });
        return;
      }
      // ---- ホスト専用コマンド。権限はサーバー側で必ず検証する ----
      case "kick":
      case "ban": {
        if (!me.host) return;
        const target = this.findById(typeof msg.id === "string" ? msg.id : "");
        if (!target || target.ws === ws || target.st.host) return; // 自分・ホストは対象外
        if (msg.t === "ban") {
          this.bans.push({ bid: crypto.randomUUID().slice(0, 8), name: target.st.name, cid: target.st.cid, ip: target.st.ip });
          if (this.bans.length > MAX_BANS) this.bans.shift();
          await this.ctx.storage.put("bans", this.bans);
        }
        await this.evict(target.ws, msg.t === "ban" ? "ホストによってBANされました" : "ホストによってキックされました");
        this.broadcast({ t: "chat", id: "", name: "", text: `${target.st.name} が${msg.t === "ban" ? "BAN" : "キック"}されました` });
        return;
      }
      case "unban": {
        if (!me.host) return;
        const n = this.bans.length;
        this.bans = this.bans.filter((b) => b.bid !== msg.bid);
        if (this.bans.length !== n) await this.ctx.storage.put("bans", this.bans);
        this.send(ws, { t: "bans", list: this.banList() });
        return;
      }
      case "bans": {
        if (!me.host) return;
        this.send(ws, { t: "bans", list: this.banList() });
        return;
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    if (!this.left.has(ws)) {
      const me = this.player(ws);
      if (me.joined) await this.persistPlayerLocation(me);
    }
    this.leave(ws);
    try { ws.close(1000, "bye"); } catch { /* already closed */ }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    if (!this.left.has(ws)) {
      const me = this.player(ws);
      if (me.joined) await this.persistPlayerLocation(me);
    }
    this.leave(ws);
  }

  private furnaceKey(dimensionId: string, x: number, y: number, z: number) { return `${normalizeDimensionId(dimensionId)}|${x},${y},${z}`; }

  private furnaceStationForBlock(blockId: number): FurnaceStation | null {
    if (blockId === MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:furnace"]) return "furnace";
    if (blockId === MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:blast_furnace"]) return "blast_furnace";
    if (blockId === MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:smoker"]) return "smoker";
    return null;
  }

  private async persistFurnaces() { await this.ctx.storage.put("furnaces", [...this.furnaces.values()]); }

  private getFurnace(dimensionId: string, x: number, y: number, z: number, station: FurnaceStation): SavedFurnace {
    const key = this.furnaceKey(dimensionId, x, y, z);
    let saved = this.furnaces.get(key);
    if (!saved) { saved = { dimensionId: normalizeDimensionId(dimensionId), x, y, z, station, state: createFurnaceState() }; this.furnaces.set(key, saved); }
    else if (saved.station !== station) saved.station = station;
    return saved;
  }

  private sendFurnace(ws: WebSocket, saved: SavedFurnace, open = false) {
    this.send(ws, { t: "furnace", x: saved.x, y: saved.y, z: saved.z, station: saved.station, state: { ...saved.state }, active: saved.state.burnTicks > 0, open });
  }

  private async openFurnace(ws: WebSocket, me: PlayerState, x: number, y: number, z: number, station: FurnaceStation) {
    const saved = this.getFurnace(me.dimensionId, x, y, z, station);
    await this.persistFurnaces();
    this.sendFurnace(ws, saved, true);
    await this.armGameClock();
  }

  private async handleFurnaceMessage(ws: WebSocket, me: PlayerState, msg: Extract<ClientMsg, { t: "furnace" }>) {
    if (!this.take(me.setB, 30, 20)) return;
    const { x, y, z } = msg;
    if (![x, y, z].every(Number.isSafeInteger) || y < 0 || y >= WORLD_HEIGHT || (this.meta?.mode ?? "creative") === "spectator") return;
    const dx = x + 0.5 - me.p[0], dy = y + 0.5 - (me.p[1] + 1.6), dz = z + 0.5 - me.p[2];
    if (dx * dx + dy * dy + dz * dz > SERVER_REACH * SERVER_REACH) return;
    const station = this.furnaceStationForBlock(this.blockAt(x, y, z, me.dimensionId));
    if (!station) return;
    if (msg.action === "close") return;
    const saved = this.getFurnace(me.dimensionId, x, y, z, station);
    if (msg.action === "open") { await this.persistFurnaces(); this.sendFurnace(ws, saved, true); await this.armGameClock(); return; }
    const slot = msg.slot;
    if (msg.action === "insert") {
      if ((slot !== "input" && slot !== "fuel") || !Number.isSafeInteger(msg.itemId) || (msg.itemId as number) <= 0) { this.sendFurnace(ws, saved); return; }
      const itemId = msg.itemId as number;
      const owned = me.counts[itemId] ?? 0;
      const requested = Number.isSafeInteger(msg.count) ? Math.max(1, Math.min(MAX_STACK, msg.count as number)) : 1;
      const moved = insertFurnaceItems(saved.state, slot, itemId, Math.min(requested, owned));
      if (!moved.ok || moved.moved <= 0) { this.sendFurnace(ws, saved); return; }
      me.counts[itemId] = owned - moved.moved;
      saved.state = moved.state;
      await this.persistInventory(ws, me);
      this.sendInventory(ws, me);
    } else if (msg.action === "take") {
      if (slot !== "input" && slot !== "fuel" && slot !== "output") { this.sendFurnace(ws, saved); return; }
      const currentId = slot === "input" ? saved.state.inputItemId : slot === "fuel" ? saved.state.fuelItemId : saved.state.outputItemId;
      const available = currentId > 0 ? inventoryCapacityFor(me, currentId) : 0;
      const requested = Number.isSafeInteger(msg.count) ? Math.max(1, Math.min(MAX_STACK, msg.count as number)) : MAX_STACK;
      const taken = removeFurnaceItems(saved.state, slot, Math.min(requested, available));
      if (!taken.ok || taken.moved <= 0 || taken.itemId <= 0) { this.sendFurnace(ws, saved); return; }
      me.counts[taken.itemId] = (me.counts[taken.itemId] ?? 0) + taken.moved;
      saved.state = taken.state;
      await this.persistInventory(ws, me);
      this.sendInventory(ws, me);
    } else { this.sendFurnace(ws, saved); return; }
    await this.persistFurnaces();
    this.broadcastDimension({ t: "furnace", x, y, z, station, state: { ...saved.state }, active: saved.state.burnTicks > 0 }, me.dimensionId);
  }

  private async tickFurnaces(ticks: number, online: { ws: WebSocket; st: PlayerState }[]) {
    if (ticks <= 0 || online.length === 0 || this.furnaces.size === 0) return;
    let changed = false;
    for (const saved of this.furnaces.values()) {
      const nearby = online.some(({ st }) => {
        if (st.dimensionId !== saved.dimensionId || !st.joined) return false;
        const dx = saved.x + 0.5 - st.p[0], dy = saved.y + 0.5 - (st.p[1] + 1.6), dz = saved.z + 0.5 - st.p[2];
        return dx * dx + dy * dy + dz * dz <= 16 * 16;
      });
      if (!nearby) continue;
      const result = advanceFurnaceState(saved.state, ticks, saved.station);
      if (!result.changed) continue;
      saved.state = result.state;
      changed = true;
      this.broadcastDimension({ t: "furnace", x: saved.x, y: saved.y, z: saved.z, station: saved.station, state: { ...saved.state }, active: saved.state.burnTicks > 0 }, saved.dimensionId);
    }
    if (changed) await this.persistFurnaces();
  }

  // One-shot Durable Object alarm drives server-owned status timers. Alarms may be delayed;
  // elapsed time is converted back to game ticks and capped to avoid runaway catch-up.
  private async armGameClock() {
    const storage = this.ctx.storage as any;
    if (!storage || typeof storage.setAlarm !== "function") return;
    try { await storage.setAlarm(Date.now() + 50); } catch { /* unsupported in test stubs */ }
  }

  async alarm() {
    const now = Date.now();
    const ticks = Math.max(1, Math.min(1200, Math.floor(Math.max(50, now - this.lastTickAt) / 50)));
    this.lastTickAt = now;
    for (let i = 0; i < ticks && this.hasPendingRepeaterTicks(); i++) {
      for (const [dimensionId, delay] of this.repeaterDelays) {
        if (delay.size === 0) continue;
        const due = delay.advance(delay.tick + 1);
        if (!due.length) continue;
        await this.persistRepeaterState();
        for (const event of due) {
          const coords = event.id.split(",").map(Number);
          if (coords.length === 3 && coords.every(Number.isSafeInteger)) await this.updateRedstoneAt(coords[0], coords[1], coords[2], dimensionId);
        }
      }
    }
    await this.tickFrostedBlocks(now);
    const online=this.ctx.getWebSockets().map(ws=>({ws,st:this.player(ws)})).filter(x=>x.st.joined&&!this.left.has(x.ws));
    await this.tickFurnaces(ticks, online);
    await this.tickFishing(now, online);
    for(const {ws,st} of online){const prior=st.vitals.foodTickTimer;let event:"death"|"respawn"|undefined;let ate=false;
      for(let i=0;i<ticks;i++){const result=tickVitals(st.vitals,this.difficulty);if(result.event)event=result.event;if(st.vitals.eatingFoodId){st.vitals.eatingTicksRemaining=Math.max(0,st.vitals.eatingTicksRemaining-1);if(st.vitals.eatingTicksRemaining===0){const id=st.vitals.eatingFoodId;st.vitals.eatingFoodId=undefined;ate=applyFood(st.vitals,id)||ate;}}}
      const sync=!!event||ate||Math.floor(st.vitals.foodTickTimer/20)>Math.floor(prior/20);if(event==="death"){await this.applyVanishingCurseOnDeath(ws,st);await this.handleDeathDrops(ws,st);}else if(event==="respawn"){st.deathDropsHandled=false;}if(ticks>0){this.serializePlayer(ws,st);if(sync){await this.persistVitals(st);this.sendStats(st,event);}}
    }
    if (online.length) {
      this.mobTickAccumulator = Math.min(4, this.mobTickAccumulator + ticks);
      if (this.mobTickAccumulator >= 4) { this.mobTickAccumulator = 0; await this.tickMobs(0.2, now, online); }
    }
    if (online.length || this.hasPendingRepeaterTicks() || this.frostedBlocks.size) await this.armGameClock();
  }

  private async tickMobs(dt: number, now: number, online: { ws: WebSocket; st: PlayerState }[]) {
    await this.tickEndDragonRespawnRitual(now);
    const updates = new Map<string, MobInfo[]>();
    let spawned = false;
    const attacks: { targetId: string; damage: number; dimensionId: string; kind: "melee" | "ranged" | "explosion"; sourceMobId: string }[] = [];
    let removed = false;
    for (const [id, storedMob] of this.mobs) {
      const dimensionId = mobDimensionId(storedMob);
      const dimensionOnline = online.filter(({ st }) => st.dimensionId === dimensionId);
      if (!dimensionOnline.length) continue;
      let mobForTick = storedMob;
      if (storedMob.type === "ender_dragon") {
        const hasNearbyCrystal = [...this.mobs.values()].some((candidate) => candidate.type === "end_crystal"
          && mobDimensionId(candidate) === dimensionId
          && Math.hypot(candidate.x - storedMob.x, candidate.z - storedMob.z) <= 64);
        const healing = tickDragonCrystalHealing({ health: storedMob.health ?? 200, maxHealth: storedMob.maxHealth ?? 200,
          nextHealAt: storedMob.nextHealAt ?? 0, now, hasCrystal: hasNearbyCrystal });
        if (healing.nextHealAt !== (storedMob.nextHealAt ?? 0) || healing.health !== (storedMob.health ?? 200)) {
          mobForTick = { ...storedMob, ...healing };
          this.mobs.set(id, mobForTick);
        }
      }
      if (shouldDespawnNaturalMob(mobForTick, dimensionOnline.map(({ st }) => ({ p: st.p as [number, number, number], dimensionId: st.dimensionId, dead: st.vitals.dead })))) {
        this.mobs.delete(id);
        this.broadcastDimension({ t: "mobgone", id }, dimensionId);
        removed = true;
        continue;
      }
      const actors = dimensionOnline.map(({ st }) => ({ id: st.id, p: st.p as [number, number, number], dead: st.vitals.dead, gameMode: st.vitals.gameMode }));
      const active = actors.filter((p) => !p.dead && p.gameMode !== "creative" && p.gameMode !== "spectator");
      if (!active.some((p) => (p.p[0] - mobForTick.x) ** 2 + (p.p[2] - mobForTick.z) ** 2 <= 96 ** 2)) continue;
      const solidAt = (x: number, y: number, z: number) => {
        if (y < 0) return true;
        if (y >= WORLD_HEIGHT) return false;
        const cx = chunkCoord(x), cz = chunkCoord(z), chunkKey = `${cx},${cz}`, index = localIndex(x,y,z);
        const edited = this.chunksForDimension(dimensionId).get(chunkKey);
        let block: number;
        if (edited && edited[index] !== NO_EDIT) block = edited[index];
        else {
          const cacheKey = `${dimensionId}|${chunkKey}`;
          let chunk = this.mobChunkCache.get(cacheKey);
          if (!chunk) {
            if (this.mobChunkCache.size >= 24) this.mobChunkCache.delete(this.mobChunkCache.keys().next().value!);
            const seed = this.meta?.seed ?? 1;
            const version = this.meta?.worldgenVersion === WORLDGEN_VERSION ? WORLDGEN_VERSION : LEGACY_WORLDGEN_VERSION;
            chunk = dimensionId === DIMENSION_IDS.OVERWORLD ? generateChunk(seed, cx, cz, version) : generateDimensionChunk(seed, cx, cz, dimensionId);
            this.mobChunkCache.set(cacheKey, chunk);
          }
          block = chunk[index] ?? 0;
        }
        return !!BLOCKS[block]?.solid;
      };
      const mob = withMobDimension(mobForTick, dimensionId);
      const result = stepMobAI(mob, actors, dt, now, solidAt);
      if (result.remove) {
        this.mobs.delete(id);
        this.broadcastDimension({ t: "mobgone", id }, dimensionId);
        removed = true;
        continue;
      }
      let nextMob = withMobDimension(result.mob, dimensionId);
      if ((nextMob.burningUntil ?? 0) > now && now - (nextMob.lastFireDamageAt ?? 0) >= 1000) {
        const maxHealth = nextMob.maxHealth ?? mobBaseHealth(nextMob.type);
        const health = Math.max(0, (nextMob.health ?? maxHealth) - 1);
        if (health <= 0) {
          this.mobs.delete(id);
          this.broadcastDimension({ t: "mobgone", id }, dimensionId);
          removed = true;
          continue;
        }
        nextMob = withMobDimension({ ...nextMob, health, maxHealth, lastFireDamageAt: now }, dimensionId);
      }
      this.mobs.set(id, nextMob);
      if (result.changed || nextMob.health !== storedMob.health || nextMob.lastFireDamageAt !== storedMob.lastFireDamageAt) {
        const group = updates.get(dimensionId) ?? [];
        group.push(nextMob);
        updates.set(dimensionId, group);
      }
      for (const attack of result.attacks) attacks.push({ targetId: attack.targetId, damage: attack.damage, dimensionId, kind: attack.kind, sourceMobId: id });
      for (const shot of result.projectiles ?? []) {
        if (this.projectiles.size >= 256) break;
        const eid = `arrow-${now.toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
        const projectile: ProjectileInfo = {
          eid, type: shot.type === "dragon_fireball" ? "dragon_fireball" : "arrow", dimensionId, ownerId: id, ownerKind: "mob",
          x: shot.x, y: shot.y, z: shot.z, vx: shot.vx, vy: shot.vy, vz: shot.vz,
          damage: Math.min(20, Math.max(1, Number(shot.damage) || 4)), createdAt: now,
        };
        this.projectiles.set(eid, projectile);
        this.broadcastDimension({ t: "projectile", projectile }, dimensionId);
      }
    }
    for (const [dimensionId, mobs] of updates) this.broadcastDimension({ t: "mobbatch", mobs }, dimensionId);
    for (const attack of attacks) {
      const target = online.find((x) => x.st.id === attack.targetId && x.st.dimensionId === attack.dimensionId);
      if (!target || target.st.vitals.dead || now - target.st.lastDamageAt < 500) continue;
      target.st.lastDamageAt = now;
      const incoming = Math.min(20, Math.max(0, attack.damage));
      const cause: DamageCause = attack.kind === "explosion" ? "explosion" : attack.kind === "ranged" ? "projectile" : "mob";
      const armorEnchantments = { ...target.st.itemEnchantments };
      for (let slot = 0; slot < target.st.armorSlots.length; slot++) Object.assign(armorEnchantments, withStackEnchantments(target.st.itemEnchantments,target.st.stackData,`armor:${slot}`,target.st.armorSlots[slot]));
      const wasDead = target.st.vitals.dead;
      applyDamage(target.st.vitals, applyArmorReduction(incoming, target.st.armorSlots, BLOCKS, armorEnchantments, cause), cause);
      const thorns = Math.max(0, ...target.st.armorSlots.map((itemId) => getItemEnchantment(armorEnchantments,itemId,"thorns")));
      const reflected = thornsRetaliation(thorns);
      if (reflected > 0) {
        const attacker = this.mobs.get(attack.sourceMobId);
        if (attacker) {
          const hp = Math.max(0,(attacker.health ?? mobBaseHealth(attacker.type))-reflected);
          if (hp <= 0) { this.mobs.delete(attacker.id); this.broadcastDimension({t:"mobgone",id:attacker.id},attack.dimensionId); }
          else { const changed={...attacker,health:hp}; this.mobs.set(attacker.id,changed); this.broadcastDimension({t:"mob",mob:changed},attack.dimensionId); }
          await this.ctx.storage.put("mobs",[...this.mobs.values()]);
        }
      }
      addExhaustion(target.st.vitals, .1);
      if (!wasDead && target.st.vitals.dead) { await this.applyVanishingCurseOnDeath(target.ws, target.st); await this.handleDeathDrops(target.ws, target.st); this.broadcastDimension({ t: "chat", id: "", name: "", text: `${target.st.name} はMobに倒された` }, attack.dimensionId); }
      await this.persistVitals(target.st);
      this.sendStats(target.st, target.st.vitals.dead ? "death" : undefined);
    }
    await this.tickProjectiles(dt, now, online);
    spawned = await this.trySpawnNaturalMob(now, online);
    if (removed || spawned || now - this.lastMobPersistAt >= 1000) { this.lastMobPersistAt = now; await this.persistMobs(); }
    this.syncEndBossBar(undefined, DIMENSION_IDS.END);
  }

  private async persistFishingSessions() {
    await this.ctx.storage.put("fishing-sessions", [...this.fishingSessions.values()].slice(-MAX_PLAYERS));
  }

  private async tickFishing(now: number, online: { ws: WebSocket; st: PlayerState }[]) {
    let changed = false;
    const owners = new Map(online.map(({st}) => [st.cid || st.id, st]));
    for (const [ownerKey, session] of [...this.fishingSessions]) {
      const owner = owners.get(ownerKey);
      if (!owner) {
        if (now - session.castAt > 10 * 60_000) {
          this.fishingSessions.delete(ownerKey);
          this.broadcastDimension({ t: "fishing-gone", id: session.id, ownerId: session.ownerId }, session.dimensionId);
          changed = true;
        }
        continue;
      }
      if (owner.dimensionId !== session.dimensionId || owner.vitals.dead || Math.hypot(owner.p[0] - session.x, owner.p[2] - session.z) > 32) {
        this.fishingSessions.delete(ownerKey);
        this.broadcastDimension({ t: "fishing-gone", id: session.id, ownerId: owner.id }, session.dimensionId);
        this.sysForPlayer(owner.id, "釣り糸が外れました");
        changed = true;
        continue;
      }
      if (session.ownerId !== owner.id) session.ownerId = owner.id;
      if (session.state === "waiting" && now >= session.biteAt) {
        session.state = "bite";
        this.broadcastDimension({ t: "fishing", id: session.id, ownerId: owner.id, dimensionId: session.dimensionId, x: session.x, y: session.y, z: session.z, state: "bite" }, session.dimensionId);
        this.sysForPlayer(owner.id, "魚が食いついた！今すぐ右クリック！");
        changed = true;
      }
    }
    if (changed || now % 5000 < 60) await this.persistFishingSessions();
  }

  private sysForPlayer(playerId: string, text: string) {
    const ws = this.ctx.getWebSockets().find(socket => { const st=this.player(socket); return st.joined && st.id===playerId; });
    if (ws) this.sys(ws, text);
  }

  private syncEndBossBar(ws?: WebSocket, dimensionId: string = DIMENSION_IDS.END) {
    const dragon = [...this.mobs.values()].find(m => m.type === "ender_dragon" && mobDimensionId(m) === dimensionId);
    const max = Math.max(1, Number(dragon?.maxHealth) || 200);
    const rawHealth = Number(dragon?.health);
    const current = Math.max(0, Math.min(max, Number.isFinite(rawHealth) ? rawHealth : max));
    const message: ServerMsg = { t: "bossbar", id: dragon?.id ?? "", name: "エンダードラゴン", progress: dragon ? current / max : 0, visible: !!dragon, color: "purple" };
    if (ws) this.send(ws, message); else this.broadcastDimension(message, dimensionId);
  }

  private async applyVanishingCurseOnDeath(ws: WebSocket, st: PlayerState) {
    const lost: string[] = [];
    let changed = false;
    const legacyConsumed = new Set<number>();
    for (const [key, record] of Object.entries(st.stackData ?? {})) {
      const itemId = Number(record?.itemId), count = Math.max(1, Math.floor(Number(record?.count) || 1));
      if (!itemId || itemId <= 0) continue;
      const enchants = withStackEnchantments(st.itemEnchantments, st.stackData, key, itemId);
      if (getItemEnchantment(enchants, itemId, "vanishing_curse") <= 0) continue;
      st.counts[itemId] = Math.max(0, (st.counts[itemId] ?? 0) - count);
      delete st.stackData[key];
      const armorMatch = /^armor:([0-3])$/.exec(key);
      if (armorMatch) st.armorSlots[Number(armorMatch[1])] = 0;
      lost.push(BLOCKS[itemId]?.name ?? BLOCKS[itemId]?.key ?? String(itemId));
      changed = true;
    }
    // Older saves stored enchantments by item type instead of by stack. Preserve
    // that legacy behavior by consuming the remaining count and clearing the
    // type-wide enchantment so newly acquired items do not inherit the curse.
    for (const [rawId, enchants] of Object.entries(st.itemEnchantments ?? {})) {
      const itemId = Number(rawId);
      if (!Number.isSafeInteger(itemId) || itemId <= 0 || getItemEnchantment({ [rawId]: enchants }, itemId, "vanishing_curse") <= 0) continue;
      if (legacyConsumed.has(itemId)) continue;
      const remaining = Math.max(0, Math.floor(Number(st.counts[itemId]) || 0));
      if (remaining > 0) {
        st.counts[itemId] = 0;
        for (const [slot, record] of Object.entries(st.stackData ?? {})) if (record?.itemId === itemId) delete st.stackData[slot];
        for (let slot = 0; slot < st.armorSlots.length; slot++) if (st.armorSlots[slot] === itemId) st.armorSlots[slot] = 0;
        if (!lost.some((name) => name === (BLOCKS[itemId]?.name ?? BLOCKS[itemId]?.key))) lost.push(BLOCKS[itemId]?.name ?? BLOCKS[itemId]?.key ?? String(itemId));
        changed = true;
      }
      delete st.itemEnchantments[rawId];
      legacyConsumed.add(itemId);
      changed = true;
    }
    if (!changed) return;
    await this.persistInventory(ws, st); this.sendInventory(ws, st);
    await this.persistStackData(ws, st);
    this.send(ws, { t: "player-equipment", id: st.id, armorSlots: [...st.armorSlots] });
    this.broadcastDimension({ t: "player-equipment", id: st.id, armorSlots: [...st.armorSlots] }, st.dimensionId, ws);
    this.sys(ws, `消滅の呪いにより ${lost.length} 種類のアイテムを失いました`);
  }

  private projectilesForDimension(dimensionId: string): ProjectileInfo[] {
    return [...this.projectiles.values()].filter((p) => p.dimensionId === dimensionId);
  }

  private async damageInventoryStack(ws: WebSocket, me: PlayerState, key: string, itemId: number, amount = 1) {
    const maxDamage=maxDurabilityForItemKey(BLOCKS[itemId]?.key);
    if(!maxDamage || !/^(?:hotbar:[0-8]|main:(?:[0-9]|1[0-9]|2[0-6])|armor:[0-3]|offhand:0)$/.test(key)) return;
    const record=me.stackData[key] && me.stackData[key].itemId===itemId ? me.stackData[key] : {itemId,count:1};
    const ench=withStackEnchantments(me.itemEnchantments,me.stackData,key,itemId);
    const unbreaking=getItemEnchantment(ench,itemId,"unbreaking");
    if(!shouldApplyDurabilityDamage(unbreaking)) return;
    const changed=damageStackRecord(record,amount,maxDamage);
    if(changed.broken) {
      delete me.stackData[key];
      me.counts[itemId]=Math.max(0,(me.counts[itemId]??0)-1);
      if(key.startsWith("armor:")) {
        const index=Number(key.slice(6)); if(Number.isInteger(index)&&index>=0&&index<4) me.armorSlots[index]=0;
        this.broadcastDimension({t:"player-equipment",id:me.id,armorSlots:[...me.armorSlots]},me.dimensionId,ws);
      }
      await this.persistInventory(ws,me); this.sendInventory(ws,me);
    } else if(changed.record) {
      me.stackData={...me.stackData,[key]:{...changed.record,count:record.count??1}};
    }
    await this.persistStackData(ws,me);
  }

  private async repairMendingFromExperience(ws: WebSocket, me: PlayerState, xp: number) {
    if(xp<=0) return xp;
    const candidates=Object.entries(me.stackData).filter(([key,record])=>{
      const max=maxDurabilityForItemKey(BLOCKS[record.itemId]?.key);
      const enchant=withStackEnchantments(me.itemEnchantments,me.stackData,key,record.itemId);
      return max>0 && Number(record.damage??0)>0 && getItemEnchantment(enchant,record.itemId,"mending")>0;
    });
    if(!candidates.length) return xp;
    const selected=candidates[Math.floor(Math.random()*candidates.length)];
    const [key,record]=selected;
    const repaired=repairStackRecord(record,xp);
    if(repaired.repaired>0) {
      me.stackData={...me.stackData,[key]:repaired.record!};
      await this.persistStackData(ws,me);
      return xp-repaired.xpUsed;
    }
    return xp;
  }

  private async updateFrostWalker(ws: WebSocket, me: PlayerState, now: number) {
    if (me.vitals.dead || me.fallFlying || me.swimming || (me.vitals.gameMode !== "survival" && me.vitals.gameMode !== "adventure")) return;
    if (now - (this.frostWalkerAt.get(ws) ?? 0) < 250) return;
    this.frostWalkerAt.set(ws, now);
    const bootsId = me.armorSlots[3] ?? 0;
    const enchants = withStackEnchantments(me.itemEnchantments,me.stackData,"armor:3",bootsId);
    const level = getItemEnchantment(enchants,bootsId,"frost_walker");
    const iceId = MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:frosted_ice"] ?? 0;
    const waterIds = new Set([B.WATER,MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:water"] ?? 0].filter((id)=>id>0));
    if (!level || !iceId || !me.p.every(Number.isFinite)) return;
    const radius=frostWalkerRadius(level), y=Math.floor(me.p[1]-0.08), cx=Math.floor(me.p[0]), cz=Math.floor(me.p[2]);
    let changed=false;
    for(let dx=-radius;dx<=radius;dx++) for(let dz=-radius;dz<=radius;dz++) {
      if(dx*dx+dz*dz>radius*radius+1) continue;
      const x=cx+dx,z=cz+dz,original=this.blockAt(x,y,z,me.dimensionId);
      if(!waterIds.has(original)) continue;
      const key=`${me.dimensionId}|${x},${y},${z}`;
      if(this.frostedBlocks.has(key)) continue;
      if(await this.applyEdit(x,y,z,iceId,me.dimensionId)) {
        this.frostedBlocks.set(key,{dimensionId:me.dimensionId,x,y,z,original,ice:iceId,expiresAt:now+5000});
        this.broadcastDimension({t:"set",x,y,z,b:iceId,id:me.id},me.dimensionId); changed=true;
      }
    }
    if(changed) await this.ctx.storage.put("frosted-blocks",[...this.frostedBlocks.values()]);
  }

  private async tickFrostedBlocks(now: number) {
    let changed=false;
    for(const [key,entry] of [...this.frostedBlocks]) {
      if(entry.expiresAt>now) continue;
      this.frostedBlocks.delete(key);
      if(this.blockAt(entry.x,entry.y,entry.z,entry.dimensionId)===entry.ice) {
        if(await this.applyEdit(entry.x,entry.y,entry.z,entry.original,entry.dimensionId)) {
          this.broadcastDimension({t:"set",x:entry.x,y:entry.y,z:entry.z,b:entry.original,id:""},entry.dimensionId);
        }
      }
      changed=true;
    }
    if(changed) await this.ctx.storage.put("frosted-blocks",[...this.frostedBlocks.values()]);
  }

  /** Projectile movement, collision, damage and loyalty returns are server-authoritative. */
  private async spawnMobMaterialDrops(mob: MobInfo, dimensionId: string) {
    const rewards = rollMobMaterialLoot(mob.type);
    for (const [key, count] of Object.entries(rewards)) {
      const itemId = MINECRAFT_ITEM_TO_RUNTIME_ID[`minecraft:${key}`];
      if (!Number.isSafeInteger(itemId) || itemId <= 0 || itemId >= BLOCKS.length || !BLOCKS[itemId]) continue;
      await this.spawnDrop(mob.x, mob.y, mob.z, itemId, dimensionId, count);
    }
  }

  private async tickProjectiles(dt: number, now: number, online: { ws: WebSocket; st: PlayerState }[]) {
    const gone: string[] = [];
    let mobsChanged = false;
    for (const [eid, projectile] of this.projectiles) {
      const ownerPlayer=projectile.ownerKind==="player"?online.find(({st})=>st.id===projectile.ownerId&&st.dimensionId===projectile.dimensionId&&!st.vitals.dead):undefined;
      if(projectile.returning && projectile.type==="trident" && ownerPlayer) {
        const target=ownerPlayer.st.p;
        const dx=target[0]-projectile.x,dy=target[1]+1.2-projectile.y,dz=target[2]-projectile.z;
        const dist=Math.hypot(dx,dy,dz)||1;
        if(dist<1.25) {
          const itemId=projectile.itemId??(MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:trident"]??0);
          if (itemId > 0) {
            const returned = addInventoryItems(ownerPlayer.st, itemId, 1);
            if (returned > 0) { await this.persistInventory(ownerPlayer.ws, ownerPlayer.st); this.sendInventory(ownerPlayer.ws, ownerPlayer.st); }
            else await this.spawnDrop(projectile.x, projectile.y, projectile.z, itemId, projectile.dimensionId, 1);
          }
          gone.push(eid); continue;
        }
        const speed=34;
        projectile.vx=dx/dist*speed; projectile.vy=dy/dist*speed; projectile.vz=dz/dist*speed;
        projectile.x+=projectile.vx*Math.min(dt,0.25); projectile.y+=projectile.vy*Math.min(dt,0.25); projectile.z+=projectile.vz*Math.min(dt,0.25);
        this.broadcastDimension({t:"projectile",projectile},projectile.dimensionId);
        continue;
      }
      if (now - projectile.createdAt > 10000) {
        if(projectile.type==="trident" && !projectile.loyalty && (projectile.itemId??0)>0) await this.spawnDrop(projectile.x,projectile.y,projectile.z,projectile.itemId!,projectile.dimensionId);
        gone.push(eid); continue;
      }
      const dimensionPlayers = online.filter(({ st }) => st.dimensionId === projectile.dimensionId && !st.vitals.dead);
      const steps = Math.max(1, Math.ceil(dt / 0.025));
      const stepDt = dt / steps;
      let remove = false;
      for (let i = 0; i < steps && !remove; i++) {
        if(!projectile.returning) projectile.vy -= (projectile.type==="dragon_fireball"?2:24) * stepDt;
        projectile.x += projectile.vx * stepDt; projectile.y += projectile.vy * stepDt; projectile.z += projectile.vz * stepDt;
        const blockId = this.mobBlockAt(Math.floor(projectile.x), Math.floor(projectile.y), Math.floor(projectile.z), projectile.dimensionId);
        if (blockId > 0 && BLOCKS[blockId]?.solid) {
          const qx = Math.min(3, Math.max(0, Math.floor((projectile.x - Math.floor(projectile.x)) * 4)));
          const qy = Math.min(3, Math.max(0, Math.floor((projectile.y - Math.floor(projectile.y)) * 4)));
          const qz = Math.min(3, Math.max(0, Math.floor((projectile.z - Math.floor(projectile.z)) * 4)));
          if (BLOCKS[blockId].shape === "cube" || blockOccupiesSubcell(blockId, qx, qy, qz)) {
            if(projectile.type==="dragon_fireball") await this.applyDragonFireballBurst(projectile,online,now);
            if(projectile.type==="trident" && (projectile.loyalty??0)>0 && ownerPlayer) projectile.returning=true;
            else remove=true;
            break;
          }
        }
        for (const target of dimensionPlayers) {
          if(projectile.ownerKind==="player" && target.st.id===projectile.ownerId) continue;
          if((projectile.hitTargets??[]).includes(target.st.id)) continue;
          const p = target.st.p;
          if (Math.abs(projectile.x - p[0]) <= 0.38 && Math.abs(projectile.z - p[2]) <= 0.38 && projectile.y >= p[1] + 0.15 && projectile.y <= p[1] + 1.8) {
            if (now - target.st.lastDamageAt >= 500) {
              target.st.lastDamageAt = now;
              const incoming=projectile.damage;
              const wasDead = target.st.vitals.dead;
              applyDamage(target.st.vitals, applyArmorReduction(incoming, target.st.armorSlots, BLOCKS, target.st.itemEnchantments, "projectile"), "projectile");
              if(projectile.fireTicks) applyDamage(target.st.vitals,1,"fire");
              addExhaustion(target.st.vitals, .1);
              if (!wasDead && target.st.vitals.dead) { await this.applyVanishingCurseOnDeath(target.ws, target.st); await this.handleDeathDrops(target.ws, target.st); this.broadcastDimension({ t: "chat", id: "", name: "", text: `${target.st.name} は飛び道具に倒された` }, projectile.dimensionId); }
              await this.persistVitals(target.st);
              this.sendStats(target.st, !wasDead && target.st.vitals.dead ? "death" : undefined);
              if(projectile.type==="dragon_fireball") await this.applyDragonFireballBurst(projectile,online,now,target.st.id);
              const thorns=Math.max(0,...target.st.armorSlots.map((id,slot)=>getItemEnchantment(withStackEnchantments(target.st.itemEnchantments,target.st.stackData,`armor:${slot}`,id),id,"thorns")));
              const reflected=thornsRetaliation(thorns);
              if(reflected>0 && projectile.ownerKind==="mob") {
                const attacker=this.mobs.get(projectile.ownerId);
                if(attacker) {
                  const health=Math.max(0,(attacker.health??mobBaseHealth(attacker.type))-reflected);
                  if(health<=0) { this.mobs.delete(attacker.id); this.broadcastDimension({t:"mobgone",id:attacker.id},projectile.dimensionId); }
                  else { const changed={...attacker,health}; this.mobs.set(attacker.id,changed); this.broadcastDimension({t:"mob",mob:changed},projectile.dimensionId); }
                  mobsChanged=true;
                }
              }
            }
            projectile.hitTargets=[...(projectile.hitTargets??[]),target.st.id].slice(-8);
            if((projectile.pierceLevel??0)>0) projectile.pierceLevel=(projectile.pierceLevel??0)-1;
            else if(projectile.type==="trident" && (projectile.loyalty??0)>0 && ownerPlayer) projectile.returning=true;
            else remove=true;
            break;
          }
        }
        if(remove||projectile.returning) continue;
        for (const [mobId, mob] of this.mobs) {
          if (mobId === projectile.ownerId || mobDimensionId(mob) !== projectile.dimensionId || (projectile.hitTargets??[]).includes(mobId)) continue;
          const profile = MOB_PROFILES[mob.type];
          const height = mob.type === "ender_dragon" ? 8 : mob.type === "end_crystal" ? 2.2 : (profile?.height ?? 1.8);
          const hitRadius=mob.type==="ender_dragon"?1.35:0.42;
          if (Math.abs(projectile.x - mob.x) > hitRadius || Math.abs(projectile.z - mob.z) > hitRadius || projectile.y < mob.y + 0.1 || projectile.y > mob.y + height) continue;
          const maxHealth = mob.maxHealth ?? mobBaseHealth(mob.type);
          const hurt = applyDamageWithInvulnerability(projectile.damage, now, mob.lastHurtAt ?? -Infinity, mob.lastDamage ?? 0, 500);
          if (hurt.applied > 0) {
            const health = Math.max(0, (mob.health ?? maxHealth) - hurt.applied);
            if (health <= 0) {
              this.mobs.delete(mobId); this.broadcastDimension({ t: "mobgone", id: mobId }, projectile.dimensionId);
              if(mob.type==="ender_dragon" && ownerPlayer) await this.completeEnderDragonFight(mob,ownerPlayer.ws,ownerPlayer.st);
              if(mob.type==="end_crystal") await this.explodeEndCrystal(mob);
              if(ownerPlayer && (ownerPlayer.st.vitals.gameMode === "survival" || ownerPlayer.st.vitals.gameMode === "adventure")) {
                await this.spawnMobMaterialDrops(mob, projectile.dimensionId);
                const xp = rollMobExperience(mob.type);
                let remaining = await this.repairMendingFromExperience(ownerPlayer.ws, ownerPlayer.st, xp);
                const beforeXp = ownerPlayer.st.vitals.experience ?? 0;
                const awarded = addExperience(beforeXp, remaining);
                if (awarded !== beforeXp) { ownerPlayer.st.vitals.experience = awarded; await this.persistVitals(ownerPlayer.st); this.sendStats(ownerPlayer.st); }
              }
            } else {
              const knock=projectile.knockback??0, dx=mob.x-projectile.x,dz=mob.z-projectile.z,len=Math.hypot(dx,dz)||1;
              const updated = { ...mob, maxHealth, health, lastHurtAt: hurt.lastHurtAtMs, lastDamage: hurt.lastDamage,
                ...(knock?{x:mob.x+dx/len*knock*0.35,z:mob.z+dz/len*knock*0.35}:{}),
                ...(projectile.fireTicks?{burningUntil:Math.max(mob.burningUntil??0,now+projectile.fireTicks*50)}:{}) };
              this.mobs.set(mobId, updated); this.broadcastDimension({ t: "mob", mob: updated }, projectile.dimensionId);
            }
            mobsChanged = true;
          }
          projectile.hitTargets=[...(projectile.hitTargets??[]),mobId].slice(-8);
          if((projectile.pierceLevel??0)>0) projectile.pierceLevel=(projectile.pierceLevel??0)-1;
          else if(projectile.type==="trident" && (projectile.loyalty??0)>0 && ownerPlayer) projectile.returning=true;
          else remove=true;
          break;
        }
      }
      if (remove) {
        if(projectile.type==="trident" && !(projectile.loyalty??0) && (projectile.itemId??0)>0) await this.spawnDrop(projectile.x,projectile.y,projectile.z,projectile.itemId!,projectile.dimensionId);
        gone.push(eid);
      } else this.broadcastDimension({ t: "projectile", projectile }, projectile.dimensionId);
    }
    for (const eid of gone) {
      const projectile = this.projectiles.get(eid);
      if (!projectile) continue;
      this.projectiles.delete(eid);
      this.broadcastDimension({ t: "projectilegone", eid }, projectile.dimensionId);
    }
    if (mobsChanged) await this.ctx.storage.put("mobs", [...this.mobs.values()]);
    if (gone.length || now - this.lastProjectilePersistAt >= 1000) {
      this.lastProjectilePersistAt = now;
      await this.ctx.storage.put("projectiles", [...this.projectiles.values()]);
    }
  }

  private mobBlockAt(x: number, y: number, z: number, dimensionId: string): number {
    if (y < 0) return B.BEDROCK;
    if (y >= WORLD_HEIGHT) return B.AIR;
    const cx = chunkCoord(x), cz = chunkCoord(z), chunkKey = `${cx},${cz}`, index = localIndex(x, y, z);
    const edited = this.chunksForDimension(dimensionId).get(chunkKey);
    if (edited && edited[index] !== NO_EDIT) return edited[index];
    const cacheKey = `${dimensionId}|${chunkKey}`;
    let chunk = this.mobChunkCache.get(cacheKey);
    if (!chunk) {
      if (this.mobChunkCache.size >= 24) this.mobChunkCache.delete(this.mobChunkCache.keys().next().value!);
      const seed = this.meta?.seed ?? 1;
      const version = this.meta?.worldgenVersion === WORLDGEN_VERSION ? WORLDGEN_VERSION : LEGACY_WORLDGEN_VERSION;
      chunk = dimensionId === DIMENSION_IDS.OVERWORLD ? generateChunk(seed, cx, cz, version) : generateDimensionChunk(seed, cx, cz, dimensionId);
      this.mobChunkCache.set(cacheKey, chunk);
    }
    return chunk[index] ?? B.AIR;
  }

  private async trySpawnNaturalMob(now: number, online: { ws: WebSocket; st: PlayerState }[]): Promise<boolean> {
    if (!this.meta || !isNaturalMobSpawnDue(now, this.lastNaturalMobSpawnAt)) return false;
    this.lastNaturalMobSpawnAt = now;
    const seed = this.meta.seed ?? 1;
    const worldgenVersion = this.meta.worldgenVersion === WORLDGEN_VERSION ? WORLDGEN_VERSION : LEGACY_WORLDGEN_VERSION;
    let spawned = false;
    for (const dimensionId of NATURAL_MOB_DIMENSIONS) {
      if (this.mobs.size >= MAX_MOBS) break;
      const activePlayers = online.filter(({ st }) => st.dimensionId === dimensionId && !st.vitals.dead && st.vitals.gameMode !== "creative" && st.vitals.gameMode !== "spectator");
      if (!activePlayers.length) continue;
      const dimensionMobCount = [...this.mobs.values()].filter(mob => mobDimensionId(mob) === dimensionId).length;
      const spawnCapacity = Math.min(MAX_MOBS - this.mobs.size, NATURAL_MOB_MAX_PER_DIMENSION - dimensionMobCount);
      if (spawnCapacity <= 0) continue;
      const daylight = dimensionId === DIMENSION_IDS.OVERWORLD ? daylightAtTime(now, this.meta.createdAt, DAY_LENGTH_SEC) : false;
      if (daylight === null) continue;
      const spot = findNaturalSpawnSpot({
        players: activePlayers.map(({ st }) => ({ p: st.p, dead: st.vitals.dead, gameMode: st.vitals.gameMode })),
        headroom: 3,
        getSurfaceY: (x, z) => {
          for (let y = 62; y >= 1; y--) {
            const block = this.mobBlockAt(x, y, z, dimensionId);
            if (BLOCKS[block]?.solid) return y;
          }
          return null;
        },
        isClear: (x, y, z) => {
          const block = this.mobBlockAt(x, y, z, dimensionId);
          return !BLOCKS[block]?.solid && block !== B.WATER && block !== B.LAVA && block !== MINECRAFT_BLOCK_TO_ID["minecraft:water"] && block !== MINECRAFT_BLOCK_TO_ID["minecraft:lava"];
        },
      });
      if (!spot) continue;
      const biome = dimensionId === DIMENSION_IDS.OVERWORLD
        ? biomeAt(seed, Math.floor(spot.x), Math.floor(spot.z), worldgenVersion)
        : dimensionBiomeAt(seed, Math.floor(spot.x), Math.floor(spot.z), dimensionId);
      const type = chooseNaturalMobType(daylight, Math.random, dimensionId, biome);
      if (!type) continue;
      if ([...this.mobs.values()].some(mob => mobDimensionId(mob) === dimensionId && (mob.x - spot.x) ** 2 + (mob.z - spot.z) ** 2 < 64)) continue;
      const requestedGroupSize = naturalMobSpawnGroupSize(type);
      if (requestedGroupSize === null) continue;
      const positions = findNaturalSpawnGroup({
        center: spot,
        size: Math.min(spawnCapacity, requestedGroupSize),
        headroom: 3,
        getSurfaceY: (x, z) => {
          for (let y = 62; y >= 1; y--) {
            const block = this.mobBlockAt(x, y, z, dimensionId);
            if (BLOCKS[block]?.solid) return y;
          }
          return null;
        },
        isClear: (x, y, z) => {
          const block = this.mobBlockAt(x, y, z, dimensionId);
          return !BLOCKS[block]?.solid && block !== B.WATER && block !== B.LAVA && block !== MINECRAFT_BLOCK_TO_ID["minecraft:water"] && block !== MINECRAFT_BLOCK_TO_ID["minecraft:lava"];
        },
      });
      for (const position of positions) {
        if (this.mobs.size >= MAX_MOBS) break;
        if ([...this.mobs.values()].some(mob => mobDimensionId(mob) === dimensionId && (mob.x - position.x) ** 2 + (mob.z - position.z) ** 2 < 1.5 ** 2)) continue;
        const mob: MobInfo = withMobDimension({ ...createMob(type as MobType, crypto.randomUUID().slice(0, 12), position.x, position.y, position.z, 0), spawnReason: "natural" as const }, dimensionId);
        this.mobs.set(mob.id, mob);
        this.broadcastDimension({ t: "mob", mob }, dimensionId);
        spawned = true;
      }
    }
    return spawned;
  }

  private async persistStackData(ws: WebSocket, st: PlayerState) {
    st.stackData = validateStackComponents(st.stackData, BLOCKS, st.counts);
    if (st.cid) await this.ctx.storage.put("stack-data:" + st.cid, st.stackData);
    this.serializePlayer(ws, st);
    this.send(ws, { t: "stack-data", stackData: st.stackData });
  }

  private async persistEnchantments(ws: WebSocket, st: PlayerState) {
    st.itemEnchantments = normalizeItemEnchantments(st.itemEnchantments, BLOCKS);
    if (st.cid) await this.ctx.storage.put("enchantments:" + st.cid, st.itemEnchantments);
    this.serializePlayer(ws, st);
    this.send(ws, { t: "item-enchantments", itemEnchantments: st.itemEnchantments });
  }

  private async persistInventory(ws: WebSocket, st: PlayerState) {
    st.counts = normalizeInventory(st.counts);
    if (st.cid) {
      await updatePlayerSave(this.ctx.storage, st.cid, { inventory: st.counts });
      await updatePlayerSave(this.ctx.storage, st.cid, { armorSlots: st.armorSlots });
    }
    this.serializePlayer(ws, st);
  }
  private sendInventory(ws: WebSocket, st: PlayerState, clearHotbar = false) { this.send(ws, { t: "inventory", counts: [...st.counts], ...(clearHotbar ? { clearHotbar: true } : {}) }); }
  private async persistMobs() { await this.ctx.storage.put("mobs", [...this.mobs.values()]); }
  private async persistDrops() { await this.ctx.storage.put("drops", [...this.drops.values()]); }

  private async persistPlayerSnapshot(st: PlayerState) {
    if (!st.cid) return;
    const snapshot = {
      location: normalizePlayerLocation({ version: 1, dimensionId: st.dimensionId, p: st.p, r: st.r }),
      vitals: st.vitals,
      inventory: [...st.counts],
      armorSlots: [...st.armorSlots],
      savedAt: Date.now(),
    };
    await writePlayerSave(this.ctx.storage, st.cid, snapshot);
  }

  private async persistVersionedPlayerSave(st: PlayerState) {
    return this.persistPlayerSnapshot(st);
  }

  private async persistPlayerLocation(st: PlayerState): Promise<void> {
    if (!st.cid) return;
    const location = normalizePlayerLocation({ version: 1, dimensionId: st.dimensionId, p: st.p, r: st.r });
    if (!location) return;
    try { await updatePlayerSave(this.ctx.storage, st.cid, { location }); }
    catch (error) { console.warn("failed to persist player location", error); }
  }

  private async persistVitals(st: PlayerState) {
    st.vitals.gameMode = this.meta?.mode ?? st.vitals.gameMode;
    if (st.cid) await updatePlayerSave(this.ctx.storage, st.cid, { vitals: st.vitals });
    for(const ws of this.ctx.getWebSockets()){const cur=this.mem.get(ws);if(cur?.id===st.id){this.serializePlayer(ws,st);break;}}
  }

  private serializePlayer(ws: WebSocket, st: PlayerState) {
    try { ws.serializeAttachment(this.encodePlayerAttachment(st)); }
    catch (error) { console.warn("[Koruva WS] player attachment serialization failed", error); }
  }

  private sendStats(st: PlayerState, event?: "death" | "respawn") {
    this.broadcast({ t: "stats", id: st.id, vitals: st.vitals, event });
  }

  // ---- helpers ----
  private leave(ws: WebSocket) {
    const alreadyLeft = this.left.has(ws);
    // refuse/BAN は close より先に left を付けるため、その場合も強参照の mem から必ず除去する。
    const me = this.mem.get(ws) ?? (alreadyLeft ? null : ws.deserializeAttachment() as PlayerState | null);
    this.mem.delete(ws);
    if (alreadyLeft) return; // 二重通知を防ぐ(evict と close イベントの両方から呼ばれる)
    this.left.add(ws);
    if (me?.joined) {
      void this.persistVitals(me);
      me.joined = false;
      this.broadcastDimension({ t: "leave", id: me.id, name: me.name }, me.dimensionId, ws);
    }
  }

  /** 入室を拒否してエラーを返し、切断する */
  private refuse(ws: WebSocket, message: string) {
    this.send(ws, { t: "error", message });
    this.leave(ws);
    try { ws.close(4002, "refused"); } catch { /* already closed */ }
  }

  // ---- ドロップ ----
  private async handleDeathDrops(ws: WebSocket, st: PlayerState) {
    if (st.deathDropsHandled || st.vitals.gameMode === "creative" || st.vitals.gameMode === "spectator") return;
    st.deathDropsHandled = true;
    const stacks = buildDeathDropStacks(st.counts, [], BLOCKS.length, MAX_STACK, itemStackLimit);
    const priorDrops = new Map(this.drops);
    const priorCounts = st.counts, priorArmor = st.armorSlots, priorExperience = st.vitals.experience;
    const priorStackData = st.stackData, priorEnchantments = st.itemEnchantments, priorElytraDamage = st.elytraDamage;
    const evicted: Drop[] = [], created: Drop[] = [];
    const dimensionId = normalizeDimensionId(st.dimensionId);
    const baseX = Math.floor(st.p[0]), baseY = Math.floor(st.p[1]), baseZ = Math.floor(st.p[2]);
    const xpAmount = experienceDropOnDeath(priorExperience ?? 0);
    const totalDrops = stacks.length + (xpAmount > 0 ? 1 : 0);
    for (let i = 0; i < totalDrops; i++) {
      while (this.drops.size >= MAX_DROPS) {
        const oldest = this.drops.keys().next().value as string;
        const removed = this.drops.get(oldest);
        this.drops.delete(oldest);
        if (removed) evicted.push(removed);
      }
      const angle = totalDrops > 1 ? (i / totalDrops) * Math.PI * 2 : 0;
      const eid = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
      const itemStack = i < stacks.length ? stacks[i] : null;
      const drop: Drop = {
        eid, dimensionId, x: baseX + (totalDrops > 1 ? Math.round(Math.cos(angle)) : 0), y: baseY,
        z: baseZ + (totalDrops > 1 ? Math.round(Math.sin(angle)) : 0),
        ...(itemStack ? { itemId: itemStack.itemId, count: itemStack.count } : { xp: xpAmount }),
        at: Date.now(),
      };
      this.drops.set(eid, drop);
      created.push(drop);
    }
    st.counts = normalizeInventory(new Array(BLOCKS.length).fill(0));
    st.armorSlots = [0, 0, 0, 0];
    st.vitals.experience = 0;
    // Stack-specific enchantment/durability data cannot yet travel with drop entities; clear slot metadata to prevent it attaching to replacement items.
    st.stackData = {};
    st.itemEnchantments = {};
    st.elytraDamage = 0;
    const location = normalizePlayerLocation({ version: 1, dimensionId, p: st.p, r: st.r });
    const snapshot = createPlayerSaveSnapshot({ location, vitals: st.vitals, inventory: st.counts, armorSlots: st.armorSlots }, Date.now());
    try {
      await this.ctx.storage.transaction(async (txn) => {
        await txn.put("drops", [...this.drops.values()]);
        if (st.cid) {
          await txn.put("player-save:" + st.cid, snapshot);
          await txn.put("loc:" + st.cid, location);
          await txn.put("p:" + st.cid, st.vitals);
          await txn.put("i:" + st.cid, st.counts);
          await txn.put("stack-data:" + st.cid, st.stackData);
          await txn.put("enchantments:" + st.cid, st.itemEnchantments);
          await txn.put("elytra:" + st.cid, 0);
        }
      });
    } catch (error) {
      this.drops = priorDrops;
      st.counts = priorCounts; st.armorSlots = priorArmor; st.vitals.experience = priorExperience;
      st.stackData = priorStackData; st.itemEnchantments = priorEnchantments; st.elytraDamage = priorElytraDamage;
      st.deathDropsHandled = false;
      throw error;
    }
    for (const drop of evicted) this.broadcastDimension({ t: "gone", eid: drop.eid, by: "" }, drop.dimensionId);
    for (const drop of created) {
      if (drop.xp !== undefined) this.broadcastDimension({ t: "drop", eid: drop.eid, x: drop.x, y: drop.y, z: drop.z, xp: drop.xp }, drop.dimensionId);
      else this.broadcastDimension({ t: "drop", eid: drop.eid, x: drop.x, y: drop.y, z: drop.z, itemId: drop.itemId, count: drop.count }, drop.dimensionId);
    }
    this.serializePlayer(ws, st);
    this.sendInventory(ws, st, true);
    this.send(ws, { t: "stack-data", stackData: st.stackData });
    this.send(ws, { t: "item-enchantments", itemEnchantments: st.itemEnchantments });
    this.send(ws, { t: "elytra-state", damage: 0, broken: false });
    this.send(ws, { t: "player-equipment", id: st.id, armorSlots: [...st.armorSlots] });
    this.broadcastDimension({ t: "player-equipment", id: st.id, armorSlots: [...st.armorSlots] }, st.dimensionId, ws);
  }

  private async liveDrops(dimensionId?: string): Promise<Drop[]> {
    const now = Date.now();
    const expired: Drop[] = [];
    for (const [id, d] of this.drops) {
      if (now - d.at > DROP_TTL_MS) { this.drops.delete(id); expired.push(d); }
    }
    if (expired.length) {
      await this.persistDrops();
      for (const drop of expired) this.broadcastDimension({ t: "gone", eid: drop.eid, by: "" }, drop.dimensionId);
    }
    const all = Array.from(this.drops.values());
    return dimensionId === undefined ? all : dropsForDimension(all, dimensionId);
  }

  private async spawnDrop(x: number, y: number, z: number, b: number, dimensionId: string = DIMENSION_IDS.OVERWORLD, count = 1) {
    await this.liveDrops();
    const before = [...this.drops.entries()];
    const evicted: Drop[] = [];
    const created: Drop[] = [];
    const normalizedDimension = normalizeDimensionId(dimensionId);
    let remaining = Number.isSafeInteger(count) ? Math.max(1, count) : 1;
    const stackLimit = itemStackLimit(b);
    while (remaining > 0) {
      while (this.drops.size >= MAX_DROPS) {
        const oldest = this.drops.keys().next().value as string;
        const removed = this.drops.get(oldest);
        this.drops.delete(oldest);
        if (removed) evicted.push(removed);
      }
      const eid = crypto.randomUUID().slice(0, 8);
      const stackCount = Math.min(stackLimit, remaining);
      const drop: Drop = { eid, dimensionId: normalizedDimension, x, y, z, b, count: stackCount, at: Date.now() };
      this.drops.set(eid, drop);
      created.push(drop);
      remaining -= stackCount;
    }
    try {
      await this.persistDrops();
    } catch (error) {
      this.drops = new Map(before);
      throw error;
    }
    for (const drop of evicted) this.broadcastDimension({ t: "gone", eid: drop.eid, by: "" }, drop.dimensionId);
    for (const drop of created) this.broadcastDimension({ t: "drop", eid: drop.eid, x: drop.x, y: drop.y, z: drop.z, b, count: drop.count }, normalizedDimension);
  }

  private async clearDrops() {
    if (!this.drops.size) return;
    const removed = [...this.drops.entries()];
    this.drops.clear();
    try {
      await this.persistDrops();
    } catch (error) {
      this.drops = new Map(removed);
      throw error;
    }
    for (const [id] of removed) this.broadcast({ t: "gone", eid: id, by: "" });
  }

  // ---- コマンド(サーバー管理者=ホスト専用) ----
  private sys(ws: WebSocket, text: string) {
    this.send(ws, { t: "chat", id: "", name: "", text });
  }

  private async portalTravel(ws: WebSocket, me: PlayerState, inside = true) {
    if (!inside) { this.portalDwell.delete(ws); this.portalNeedsExit.delete(ws); return; }
    const now = Date.now();
    if (now < (this.portalCooldowns.get(ws) ?? 0) || this.portalNeedsExit.has(ws)) return;
    const ids = {
      netherPortal: MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:nether_portal"],
      endPortal: MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:end_portal"],
    };
    const target = findPortalAt(
      { get: (x: number, y: number, z: number) => this.blockAt(x, y, z, me.dimensionId) },
      { x: me.p[0], y: me.p[1], z: me.p[2] }, me.dimensionId, ids,
    );
    if (!target || target === me.dimensionId) { this.portalDwell.delete(ws); return; }
    const mode = this.meta?.mode ?? "creative";
    if (mode === "spectator") { this.portalDwell.delete(ws); return; }
    const pending = this.portalDwell.get(ws);
    if (!pending || pending.target !== target) { this.portalDwell.set(ws, { target, since: now }); return; }
    const delay = mode === "creative" ? PORTAL_DELAY_CREATIVE_MS : PORTAL_DELAY_SURVIVAL_MS;
    if (now - pending.since < delay) return;
    this.portalDwell.delete(ws); this.portalNeedsExit.add(ws); this.portalCooldowns.set(ws, now + 3500);
    const alias = target === DIMENSION_IDS.NETHER ? "nether" : target === DIMENSION_IDS.END ? "end" : "overworld";
    await this.changeDimension(ws, me, `/dimension ${alias}`, true);
  }

  /** Cache generated chunks during portal searches; blockAt otherwise regenerates a chunk per read. */
  private cachedBlockReader(dimensionId: string) {
    const id = normalizeDimensionId(dimensionId);
    const generated = new Map<string, ReturnType<typeof generateChunk>>();
    return (x: number, y: number, z: number): number => {
      if (y < 0 || y >= WORLD_HEIGHT) return B.AIR;
      const cx = chunkCoord(x), cz = chunkCoord(z), key = `${cx},${cz}`, index = localIndex(x, y, z);
      const edits = this.chunksForDimension(id).get(key);
      if (edits && edits[index] !== NO_EDIT) return edits[index];
      let chunk = generated.get(key);
      if (!chunk) {
        const seed = this.meta?.seed ?? 1;
        const version = this.meta?.worldgenVersion === WORLDGEN_VERSION ? WORLDGEN_VERSION : LEGACY_WORLDGEN_VERSION;
        chunk = id === DIMENSION_IDS.OVERWORLD ? generateChunk(seed, cx, cz, version) : generateDimensionChunk(seed, cx, cz, id);
        generated.set(key, chunk);
      }
      return chunk[index] ?? B.AIR;
    };
  }

  private async safeDimensionArrival(get: (x: number, y: number, z: number) => number, position: { x: number; y: number; z: number }): Promise<{ x: number; y: number; z: number }> {
    return findSafeSpawn({ ensureChunk: () => undefined, get }, position, {
      height: WORLD_HEIGHT, searchRadius: 8, isSolid: (id: number) => !!BLOCKS[id]?.solid,
      isHazard: (id: number) => id === B.WATER || id === B.LAVA || id === B.MAGMA_BLOCK,
    }) ?? position;
  }

  private async ensureNetherPortalArrival(target: string, mapped: { x: number; y: number; z: number }): Promise<{ x: number; y: number; z: number }> {
    const get = this.cachedBlockReader(target), fallback = () => this.safeDimensionArrival(get, mapped);
    const radius = target === DIMENSION_IDS.NETHER ? 8 : 32;
    const nearest = findNearestPortal(get, Math.floor(mapped.x), Math.floor(mapped.z), radius, 1, WORLD_HEIGHT - 2);
    if (nearest) return { x: nearest[0] + 0.5, y: nearest[1], z: nearest[2] + 0.5 };
    const site = findPortalBuildSite(get, Math.floor(mapped.x), Math.floor(mapped.z), { radius: 4, yMin: 2, yMax: WORLD_HEIGHT - 6 });
    if (!site) return fallback();
    const { edits, spawn } = buildPortalEdits(site.x, site.y, site.z), final = new Map<string, [number, number, number, number]>();
    for (const edit of edits) final.set(`${edit[0]},${edit[1]},${edit[2]}`, edit);
    const plan = [...final.values()].filter(([, , , block]) => block !== B.AIR).map(([x, y, z, block]) => ({ x, y, z, block, before: get(x, y, z) }));
    if (!plan.length || plan.some((e) => !isValidSet(e.x, e.y, e.z, e.block) || e.y < 1 || e.y >= WORLD_HEIGHT || e.before !== B.AIR)) return fallback();
    const applied: typeof plan = [];
    for (const edit of plan) {
      if (get(edit.x, edit.y, edit.z) !== edit.before || !await this.applyEdit(edit.x, edit.y, edit.z, edit.block, target)) {
        for (const previous of [...applied].reverse()) if (await this.applyEdit(previous.x, previous.y, previous.z, previous.before, target)) this.broadcastDimension({ t: "set", x: previous.x, y: previous.y, z: previous.z, b: previous.before }, target);
        return fallback();
      }
      applied.push(edit); this.broadcastDimension({ t: "set", x: edit.x, y: edit.y, z: edit.z, b: edit.block }, target);
    }
    return { x: spawn[0] + 0.5, y: spawn[1], z: spawn[2] + 0.5 };
  }

  private async ensureEnderDragon() {
    if (this.endBossDefeated || [...this.mobs.values()].some(m => m.type === "ender_dragon" && mobDimensionId(m) === DIMENSION_IDS.END)) return;
    const dragon=createMob("ender_dragon",`ender-dragon-${crypto.randomUUID().slice(0,12)}`,0.5,58,0.5,0);
    const boss:MobInfo=withMobDimension({...dragon,spawnReason:"summoned",armorPoints:10,dragonPhase:"circle",dragonOrbit:0,nextThinkAt:Date.now()+2500,nextHealAt:Date.now()+1000,health:200,maxHealth:200},DIMENSION_IDS.END);
    this.mobs.set(boss.id,boss);
    await this.ensureEndSpikes(false);
    await this.persistMobs();
    this.broadcastDimension({t:"mob",mob:boss},DIMENSION_IDS.END);
  }

  private endSpikeLayout(): [number, number, number][] {
    return [[-36,-20,10],[-36,20,13],[-20,-36,16],[-20,36,9],[0,-42,18],[0,42,12],[20,-36,11],[20,36,17],[36,-20,14],[36,20,10]];
  }

  private async ensureEndSpikes(respawning: boolean) {
    const obsidian=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:obsidian"]??0;
    const bedrock=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:bedrock"]??B.BEDROCK;
    const ironBars=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:iron_bars"]??0;
    const layout=this.endSpikeLayout();
    for(let i=0;i<layout.length;i++){
      const [x,z,height]=layout[i];
      for(let y=31;y<31+height;y++){
        if(this.blockAt(x,y,z,DIMENSION_IDS.END)!==obsidian && obsidian>0){
          if(await this.applyEdit(x,y,z,obsidian,DIMENSION_IDS.END))this.broadcastDimension({t:"set",x,y,z,b:obsidian,id:""},DIMENSION_IDS.END);
        }
      }
      const capY=31+height;
      if(this.blockAt(x,capY-1,z,DIMENSION_IDS.END)!==bedrock){
        if(await this.applyEdit(x,capY-1,z,bedrock,DIMENSION_IDS.END))this.broadcastDimension({t:"set",x,y:capY-1,z,b:bedrock,id:""},DIMENSION_IDS.END);
      }
      if(ironBars>0 && (i===2 || i===7)){
        for(let dy=1;dy<=3;dy++)for(const [dx,dz] of [[-1,-1],[-1,1],[1,-1],[1,1]] as const){
          const bx=x+dx,by=capY+dy,bz=z+dz;
          if(this.blockAt(bx,by,bz,DIMENSION_IDS.END)!==ironBars && await this.applyEdit(bx,by,bz,ironBars,DIMENSION_IDS.END))this.broadcastDimension({t:"set",x:bx,y:by,z:bz,b:ironBars,id:""},DIMENSION_IDS.END);
        }
      }
      const crystalX=x+.5,crystalY=capY,crystalZ=z+.5;
      const existing=[...this.mobs.values()].find(m=>m.type==="end_crystal"&&mobDimensionId(m)===DIMENSION_IDS.END&&Math.hypot(m.x-crystalX,m.z-crystalZ)<1.5);
      if(existing){
        const updated={...existing,respawnInvulnerable:respawning,beamTarget:respawning?[0,128,0] as [number,number,number]:undefined};
        this.mobs.set(existing.id,updated);this.broadcastDimension({t:"mob",mob:updated},DIMENSION_IDS.END);
      }else{
        const crystal=createMob("end_crystal",`end-crystal-${i}-${crypto.randomUUID().slice(0,6)}`,crystalX,crystalY,crystalZ,0);
        const entity:MobInfo=withMobDimension({...crystal,spawnReason:"summoned",respawnInvulnerable:respawning,...(respawning?{beamTarget:[0,128,0] as [number,number,number]}:{})},DIMENSION_IDS.END);
        this.mobs.set(entity.id,entity);this.broadcastDimension({t:"mob",mob:entity},DIMENSION_IDS.END);
      }
    }
  }

  private async startEndDragonRespawnRitual() {
    const now=Date.now();this.endDragonRespawnAt=now+30_200;this.endDragonRespawnStage=0;
    await this.ctx.storage.put("end-dragon-respawn-at",this.endDragonRespawnAt);
    // Regenerate the obsidian spikes and temporarily protect their crystals.
    await this.ensureEndSpikes(true);
    const towerTargets=this.endSpikeLayout().map(([x,z,h])=>[x+.5,32+h,z+.5] as [number,number,number]);
    let index=0;
    for(const [id,mob] of this.mobs){
      if(mob.type!=="end_crystal"||!mob.respawnCrystal||mobDimensionId(mob)!==DIMENSION_IDS.END)continue;
      const updated={...mob,beamTarget:towerTargets[index%towerTargets.length]};this.mobs.set(id,updated);index++;
      this.broadcastDimension({t:"mob",mob:updated},DIMENSION_IDS.END);
    }
    const egg=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:dragon_egg"]??0;
    if(egg>0&&this.blockAt(0,33,0,DIMENSION_IDS.END)===egg){await this.applyEdit(0,33,0,B.AIR,DIMENSION_IDS.END);this.broadcastDimension({t:"set",x:0,y:33,z:0,b:B.AIR,id:""},DIMENSION_IDS.END);}
    const portal=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:end_portal"]??0;
    if(portal>0)for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(this.blockAt(dx,32,dz,DIMENSION_IDS.END)===portal){await this.applyEdit(dx,32,dz,B.AIR,DIMENSION_IDS.END);this.broadcastDimension({t:"set",x:dx,y:32,z:dz,b:B.AIR,id:""},DIMENSION_IDS.END);}
    await this.persistMobs();
    this.broadcastDimension({t:"chat",id:"",name:"",text:"エンドクリスタルが共鳴し、復活の儀式が始まった"},DIMENSION_IDS.END);
  }

  private async tickEndDragonRespawnRitual(now: number) {
    const endAt=this.endDragonRespawnAt;if(endAt===null)return;
    const startAt=endAt-30_200,elapsed=Math.max(0,now-startAt);
    const stage=elapsed<12_000?0:elapsed<24_000?1:2;
    if(stage!==this.endDragonRespawnStage){
      this.endDragonRespawnStage=stage;
      for(const [id,mob] of this.mobs){
        if(mob.type!=="end_crystal"||mobDimensionId(mob)!==DIMENSION_IDS.END)continue;
        if(mob.respawnCrystal){const updated={...mob,beamTarget:[0,128,0] as [number,number,number]};this.mobs.set(id,updated);this.broadcastDimension({t:"mob",mob:updated},DIMENSION_IDS.END);}
        else if(mob.respawnInvulnerable){const updated={...mob,beamTarget:[0,128,0] as [number,number,number]};this.mobs.set(id,updated);this.broadcastDimension({t:"mob",mob:updated},DIMENSION_IDS.END);}
      }
      if(stage===1)this.broadcastDimension({t:"chat",id:"",name:"",text:"10本の黒曜石の柱が再生し、光が中央へ集まっている"},DIMENSION_IDS.END);
    }
    if(now<endAt)return;
    for(const [id,mob] of [...this.mobs]){
      if(mob.type!=="end_crystal"||mobDimensionId(mob)!==DIMENSION_IDS.END)continue;
      if(mob.respawnCrystal){this.mobs.delete(id);this.broadcastDimension({t:"mobgone",id},DIMENSION_IDS.END);}
      else if(mob.respawnInvulnerable){const updated={...mob,respawnInvulnerable:false,beamTarget:undefined};this.mobs.set(id,updated);this.broadcastDimension({t:"mob",mob:updated},DIMENSION_IDS.END);}
    }
    this.endDragonRespawnAt=null;this.endDragonRespawnStage=-1;
    await this.ctx.storage.delete("end-dragon-respawn-at");
    this.endBossDefeated=false;await this.ctx.storage.put("end-boss-defeated",false);
    await this.persistMobs();
    this.broadcastDimension({t:"chat",id:"",name:"",text:"エンダードラゴンが復活した！"},DIMENSION_IDS.END);
    await this.ensureEnderDragon();
    await this.syncEndBossBar(undefined,DIMENSION_IDS.END);
  }

  private async cancelEndDragonRespawnRitual(destroyedId: string) {
    this.endDragonRespawnAt=null;this.endDragonRespawnStage=-1;
    await this.ctx.storage.delete("end-dragon-respawn-at");
    for(const [id,mob] of [...this.mobs]){
      if(mob.type!=="end_crystal"||mobDimensionId(mob)!==DIMENSION_IDS.END)continue;
      if(mob.respawnCrystal&&id!==destroyedId){this.mobs.delete(id);this.broadcastDimension({t:"mobgone",id},DIMENSION_IDS.END);}
      else if(mob.respawnInvulnerable){const updated={...mob,respawnInvulnerable:false,beamTarget:undefined};this.mobs.set(id,updated);this.broadcastDimension({t:"mob",mob:updated},DIMENSION_IDS.END);}
    }
    await this.persistMobs();
    this.broadcastDimension({t:"chat",id:"",name:"",text:"エンドクリスタルが破壊され、復活の儀式が中断された"},DIMENSION_IDS.END);
  }

  private async completeEnderDragonFight(dragon:MobInfo, killerWs?:WebSocket, killer?:PlayerState) {
    if (this.endBossDefeated) return;
    this.endBossDefeated=true;
    await this.ctx.storage.put("end-boss-defeated",true);
    this.mobs.delete(dragon.id);
    const y=32;
    const bedrock=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:bedrock"]??B.BEDROCK;
    const portal=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:end_portal"]??0;
    const gateway=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:end_gateway"]??0;
    const obsidian=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:obsidian"]??B.BEDROCK;
    const egg=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:dragon_egg"]??0;
    const set=async(x:number,yy:number,z:number,id:number)=>{
      if(id<=0||yy<0||yy>=WORLD_HEIGHT)return;
      if(await this.applyEdit(x,yy,z,id,DIMENSION_IDS.END))this.broadcastDimension({t:"set",x,y:yy,z,b:id,id:""},DIMENSION_IDS.END);
    };
    // Bedrock-rimmed 3x3 exit portal at the main island's center.
    for(let dx=-2;dx<=2;dx++) for(let dz=-2;dz<=2;dz++) {
      if(Math.abs(dx)===2||Math.abs(dz)===2) await set(dx,y-1,dz,bedrock);
      else await set(dx,y,dz,portal);
    }
    // A gateway pedestal is generated at the edge of the central island.
    for(let dx=-1;dx<=1;dx++) for(let dz=-1;dz<=1;dz++) await set(12+dx,y-1,dz,obsidian);
    if(gateway) await set(12,y,0,gateway);
    if(egg) await set(0,y+1,0,egg);
    // Four fixed obsidian pedestals around the exit fountain are the vanilla-style respawn-crystal ritual points.
    for (const [rx,rz] of [[-3,0],[3,0],[0,-3],[0,3]] as const) await set(rx,y-1,rz,obsidian);
    await this.persistMobs();
    this.syncEndBossBar(undefined, DIMENSION_IDS.END);
    if(killer && killerWs && (killer.vitals.gameMode==="survival"||killer.vitals.gameMode==="adventure")) {
      const previous=killer.vitals.experience??0;
      killer.vitals.experience=addExperience(previous,12000);
      await this.persistVitals(killer);
      this.sendStats(killer);
      this.serializePlayer(killerWs,killer);
    }
    this.broadcastDimension({t:"chat",id:"",name:"",text:"エンダードラゴンが倒された！ エンドの帰還ポータルが開いた"},DIMENSION_IDS.END);
  }

  private async explodeEndCrystal(crystal:MobInfo) {
    const now=Date.now();
    const explosion:ProjectileInfo={eid:`crystal-${crypto.randomUUID().slice(0,8)}`,type:"dragon_fireball",dimensionId:mobDimensionId(crystal),ownerId:crystal.id,x:crystal.x,y:crystal.y+0.8,z:crystal.z,vx:0,vy:0,vz:0,damage:6,createdAt:now};
    const online=this.ctx.getWebSockets().map(ws=>({ws,st:this.player(ws)})).filter(x=>x.st.joined&&!this.left.has(x.ws));
    await this.applyDragonFireballBurst(explosion,online,now);
    this.broadcastDimension({t:"chat",id:"",name:"",text:"エンドクリスタルが爆発した"},mobDimensionId(crystal));
  }

  private async applyDragonFireballBurst(projectile:ProjectileInfo,online:{ws:WebSocket;st:PlayerState}[],now:number,skipId="") {
    for(const entry of online) {
      const st=entry.st;
      if(st.dimensionId!==projectile.dimensionId||st.vitals.dead||st.id===skipId)continue;
      const dx=st.p[0]-projectile.x,dy=st.p[1]+0.9-projectile.y,dz=st.p[2]-projectile.z;
      const distance=Math.hypot(dx,dy,dz);
      if(distance>4 || now-st.lastDamageAt<500)continue;
      st.lastDamageAt=now;
      const raw=Math.max(1,8*(1-distance/5));
      const reduced=applyArmorReduction(raw,st.armorSlots,BLOCKS,st.itemEnchantments,"explosion");
      const wasDead = st.vitals.dead;
      applyDamage(st.vitals,reduced,"explosion");
      const horizontal=Math.hypot(dx,dz)||1;
      this.send(entry.ws,{t:"impulse",vx:dx/horizontal*Math.max(2,5-distance),vy:Math.max(.25,2-distance*.25),vz:dz/horizontal*Math.max(2,5-distance)});
      if(!wasDead&&st.vitals.dead){await this.applyVanishingCurseOnDeath(entry.ws,st);await this.handleDeathDrops(entry.ws,st);this.broadcastDimension({t:"chat",id:"",name:"",text:`${st.name} はドラゴンの炎に倒された`},projectile.dimensionId);}
      await this.persistVitals(st);
      this.sendStats(st,!wasDead&&st.vitals.dead?"death":undefined);
    }
    let changed=false;
    for(const [id,mob] of this.mobs) {
      if(id===projectile.ownerId || mob.type==="end_crystal" || mobDimensionId(mob)!==projectile.dimensionId) continue;
      const distance=Math.hypot(mob.x-projectile.x,mob.y+0.8-projectile.y,mob.z-projectile.z);
      if(distance>4) continue;
      const maximum=mob.maxHealth??mobBaseHealth(mob.type);
      const damage=dragonBlastDamage(distance,mob.armorPoints??0);
      if(damage<=0) continue;
      const health=Math.max(0,(mob.health??maximum)-damage);
      if(health<=0) {
        this.mobs.delete(id); this.broadcastDimension({t:"mobgone",id},projectile.dimensionId);
        if(mob.type==="ender_dragon") await this.completeEnderDragonFight(mob);
      } else {
        const dx=mob.x-projectile.x,dz=mob.z-projectile.z,len=Math.hypot(dx,dz)||1;
        const updated={...mob,health,maxHealth:maximum,x:mob.x+dx/len*.18,z:mob.z+dz/len*.18};
        this.mobs.set(id,updated); this.broadcastDimension({t:"mob",mob:updated},projectile.dimensionId);
      }
      changed=true;
    }
    if(changed) await this.persistMobs();
  }

  private async changeDimension(ws: WebSocket, me: PlayerState, text: string, portalAuthorized = false) {
    if (!portalAuthorized && (!me.host || (this.meta?.mode ?? "creative") !== "creative")) {
      this.sys(ws, "ディメンション移動はクリエイティブのホスト専用です"); return;
    }
    const args = text.trim().split(/\s+/);
    const target = args.length === 2 ? resolveDimensionAlias(args[1]) : null;
    if (!target) { this.sys(ws, "使い方: /dimension overworld|nether|end"); return; }
    if (target === me.dimensionId) { this.sys(ws, "すでにそのディメンションにいます"); return; }
    const previous = me.dimensionId;
    const mapped = mapDimensionCoordinates(previous, target, { x: me.p[0], y: me.p[1], z: me.p[2] });
    const spawnChunkCache = new Map<string, Uint8Array | Uint16Array>();
    const targetEdits = this.chunksForDimension(target);
    const safe = findSafeSpawn({ ensureChunk: () => undefined, get: (x:number,y:number,z:number) => {
      if (y < 0 || y >= WORLD_HEIGHT) return B.AIR;
      const cx=chunkCoord(x),cz=chunkCoord(z),key=`${cx},${cz}`;
      let chunk=spawnChunkCache.get(key);
      if(!chunk){chunk=target===DIMENSION_IDS.OVERWORLD?generateChunk(this.meta?.seed??1,cx,cz,this.meta?.worldgenVersion===WORLDGEN_VERSION?WORLDGEN_VERSION:LEGACY_WORLDGEN_VERSION):generateDimensionChunk(this.meta?.seed??1,cx,cz,target);spawnChunkCache.set(key,chunk);}
      const index=localIndex(x,y,z), edits=targetEdits.get(key);
      return edits && edits[index]!==NO_EDIT ? edits[index] : chunk[index] ?? B.AIR;
    } }, mapped, {
      height: WORLD_HEIGHT, searchRadius: 12,
      isSolid: (blockId:number) => !!BLOCKS[blockId]?.solid,
      isHazard: (blockId:number) => BLOCKS[blockId]?.render === "liquid" || blockId === B.LAVA,
    });
    let destination = safe ?? { x: mapped.x, y: Math.min(WORLD_HEIGHT-3, Math.max(2, mapped.y)), z: mapped.z };
    const netherLink = (previous === DIMENSION_IDS.OVERWORLD && target === DIMENSION_IDS.NETHER) || (previous === DIMENSION_IDS.NETHER && target === DIMENSION_IDS.OVERWORLD);
    if (portalAuthorized && netherLink) destination = await this.ensureNetherPortalArrival(target, mapped);
    me.dimensionId = target; me.p = [destination.x, destination.y, destination.z];
    me.fallFlying = false;
    me.digTarget = undefined; me.digToolItemId = undefined; me.digStartedAt = undefined;
    this.serializePlayer(ws, me);
    await this.persistPlayerLocation(me);
    this.broadcastDimension({ t: "leave", id: me.id, name: me.name }, previous, ws);
    const players: PlayerInfo[] = [];
    for (const other of this.ctx.getWebSockets()) {
      if (other === ws || this.left.has(other)) continue;
      const state = this.player(other);
      if (state.joined && state.dimensionId === target) players.push(this.info2(state));
    }
    this.send(ws, {
      t: "dimension", dimensionId: target, seed: this.meta?.seed ?? 1,
      worldgenVersion: this.meta?.worldgenVersion ?? WORLDGEN_VERSION, p: me.p, r: me.r, players,
      drops: (await this.liveDrops(target)).map(d => ({ eid: d.eid, x: d.x, y: d.y, z: d.z, ...(d.b !== undefined ? { b: d.b } : {}), ...(d.itemId !== undefined ? { itemId: d.itemId } : {}), ...(d.xp !== undefined ? { xp: d.xp } : {}), ...(d.count !== undefined ? { count: d.count } : {}) })),
      mobs: mobsForDimension(this.mobs.values(), target),
      projectiles: this.projectilesForDimension(target),
    });
    const edits = this.allEdits(target);
    if (edits.length === 0) this.send(ws, { t: "edits", list: [], done: true });
    else for (let i = 0; i < edits.length; i += EDIT_BATCH) {
      this.send(ws, { t: "edits", list: edits.slice(i, i + EDIT_BATCH), done: i + EDIT_BATCH >= edits.length });
    }
    this.broadcastDimension({ t: "join", player: this.info2(me) }, target, ws);
    if (target === DIMENSION_IDS.END) await this.ensureEnderDragon();
    await this.syncEndBossBar(ws, target);
    this.sys(ws, `ディメンションを切り替えました: ${target}`);
  }

  private async command(ws: WebSocket, me: PlayerState, text: string) {
    const [raw, ...args] = text.slice(1).trim().split(/\s+/); const cmd=(raw??"").toLowerCase();
    if (!me.host) { this.sys(ws, "このコマンドはサーバー管理者(ホスト)のみ使えます"); return; }
    if (cmd === "gamemode") {
      const a=(args[0]??"").toLowerCase(); const modes: GameMode[]=["survival","creative","adventure","spectator"];
      const mode=modes.find(x=>x===a || (a.length>=1 && x.startsWith(a)));
      if(!mode){this.sys(ws,"使い方: /gamemode survival | creative | adventure | spectator");return;}
      if ((this.meta!.mode ?? "creative") === mode) { this.sys(ws, `既に ${mode} です`); return; }
      this.meta!.mode=mode; await this.ctx.storage.put("meta",this.meta);
      if(mode==="creative"||mode==="spectator") await this.clearDrops();
      for(const s of this.ctx.getWebSockets()){const p=this.player(s);if(!p.joined)continue;p.vitals.gameMode=mode;await this.persistVitals(p);this.sendStats(p);}
      this.broadcast({t:"mode",mode}); this.broadcast({t:"chat",id:"",name:"",text:`${me.name} がゲームモードを${mode}に変更しました`}); return;
    }
    if(cmd === "effect") { await this.effectCommand(ws,me,args); return; }
    if(cmd === "difficulty") { const value=(args[0]??"").toLowerCase();if(value!=="easy"&&value!=="normal"&&value!=="hard"){this.sys(ws,"使い方: /difficulty easy | normal | hard");return;}this.difficulty=value;await this.ctx.storage.put("meta",{...(this.meta??{}),difficulty:value});this.sys(ws,`難易度を ${value} にしました`);return; }
    if (cmd === "give") {
      const [who, rawItem, countRaw] = args; const itemKey = (rawItem ?? "").toLowerCase().replace(/^minecraft:/, ""); const count = Number(countRaw);
      if (!who || !Number.isInteger(count) || count < 1 || count > 64) { this.sys(ws, "使い方: /give <player|@a|@s> <itemId|foodId> <1..64>"); return; }
      const targets = this.commandTargets(who, ws, me); if (!targets.length) { this.sys(ws, "対象プレイヤーが見つかりません"); return; }
      const food = FOOD_DEFS[itemKey];
      if (food) { for (const t of targets) { t.st.vitals.foodCounts[itemKey] = Math.min(999, (t.st.vitals.foodCounts[itemKey] ?? 0) + count); await this.persistVitals(t.st); this.sendStats(t.st); } this.sys(ws, `${food.name} を ${targets.length} 人に付与しました`); return; }
      const normalizedItemKey = itemKey.startsWith("minecraft:") ? itemKey : `minecraft:${itemKey}`;
      const registeredItemId = MINECRAFT_ITEM_TO_RUNTIME_ID[normalizedItemKey];
      const customItemKey = itemKey.startsWith("koruva:") ? itemKey : `koruva:${itemKey}`;
      const itemId = registeredItemId !== undefined && INVENTORY_ITEMS.includes(registeredItemId) ? registeredItemId : INVENTORY_ITEMS.find(id => {
        const key = BLOCKS[id].key;
        return key === normalizedItemKey || key === itemKey || key === customItemKey || (key.endsWith("_north") && key.slice(0, -6) === itemKey);
      });
      if (!itemId) { this.sys(ws, `アイテムが見つかりません: ${rawItem ?? ""}`); return; }
      for (const t of targets) {
        const accepted = addInventoryItems(t.st, itemId, count);
        if (accepted > 0) { await this.persistInventory(t.ws, t.st); this.sendInventory(t.ws, t.st); }
        this.sys(ws, `${t.st.name}: ${BLOCKS[itemId].name} ${accepted}/${count} 個を付与`);
      }
      return;
    }
    if (cmd === "tp") {
      const self: { ws: WebSocket; st: PlayerState }[] = [{ ws, st: me }];
      let targets: { ws: WebSocket; st: PlayerState }[] = self;
      let destination: { ws: WebSocket; st: PlayerState } | undefined;
      let position: [number, number, number] | null = null;
      if (args.length === 1) {
        const destinations = this.commandTargets(args[0], ws, me);
        if (destinations.length !== 1) { this.sys(ws, "移動先プレイヤーを1人だけ指定してください"); return; }
        destination = destinations[0];
      } else if (args.length === 2) {
        targets = this.commandTargets(args[0], ws, me);
        const destinations = this.commandTargets(args[1], ws, me);
        if (!targets.length) { this.sys(ws, "対象プレイヤーが見つかりません"); return; }
        if (destinations.length !== 1) { this.sys(ws, "移動先プレイヤーを1人だけ指定してください"); return; }
        destination = destinations[0];
      } else if (args.length === 3) {
        position = parseTeleportPosition(args, me.p);
      } else if (args.length === 4) {
        targets = this.commandTargets(args[0], ws, me);
        if (!targets.length) { this.sys(ws, "対象プレイヤーが見つかりません"); return; }
        position = parseTeleportPosition(args.slice(1), me.p);
      } else {
        this.sys(ws, "使い方: /tp <player> | /tp <target> <player> | /tp [target] <x> <y> <z>"); return;
      }
      if (!targets.length) { this.sys(ws, "対象プレイヤーが見つかりません"); return; }
      if (!destination && !position) { this.sys(ws, "座標が不正か範囲外です (x/z: ±100000, y: 1..128)"); return; }
      const destinationDimension = destination?.st.dimensionId ?? me.dimensionId;
      if (targets.some(target => target.st.dimensionId !== destinationDimension)) {
        this.sys(ws, "異なるディメンション間のテレポートは未対応です"); return;
      }
      const targetPosition: [number, number, number] = destination
        ? [destination.st.p[0], destination.st.p[1], destination.st.p[2]]
        : [position![0], position![1], position![2]];
      for (const target of targets) {
        target.st.p = [targetPosition[0], targetPosition[1], targetPosition[2]];
        if (destination) target.st.r = [destination.st.r[0], destination.st.r[1]];
        target.st.digTarget = undefined; target.st.digStartedAt = undefined;
        this.serializePlayer(target.ws, target.st);
        await this.persistPlayerLocation(target.st);
        const p: [number, number, number] = [target.st.p[0], target.st.p[1], target.st.p[2]];
        const r: [number, number] = [target.st.r[0], target.st.r[1]];
        this.send(target.ws, { t: "teleport", p, r });
        this.broadcastDimension({ t: "pos", id: target.st.id, p, r }, target.st.dimensionId, target.ws);
      }
      this.sys(ws, `${targets.length} 人をテレポートしました`);
      return;
    }
    if (cmd === "clear" || cmd === "claer") {
      const [who] = args;
      if (args.length > 1) { this.sys(ws, "使い方: /clear [player|@r|@a|@s|@p|:name]"); return; }
      const targets = this.commandTargets(who, ws, me);
      if (!targets.length) { this.sys(ws, "対象プレイヤーが見つかりません"); return; }
      const plans = targets.map(t => ({ t, cleared: clearInventoryState(t.st.counts, t.st.vitals.foodCounts, null, Object.keys(FOOD_DEFS)) }));
      if (plans.some(plan => !plan.cleared)) { this.sys(ws, "インベントリをクリアできませんでした"); return; }
      for (const { t, cleared } of plans) {
        if (!cleared) continue;
        t.st.counts = cleared.counts;
        t.st.vitals.foodCounts = cleared.foodCounts;
        await this.persistInventory(t.ws, t.st);
        this.sendInventory(t.ws, t.st, true);
        await this.persistVitals(t.st);
        this.sendStats(t.st);
      }
      this.sys(ws, `${targets.length} 人のインベントリをすべてクリアしました`);
      return;
    }
    if (cmd === "summon") {
      const kind = (args[0] ?? "").toLowerCase().replace(/^minecraft:/, "") as MobType;
      if (!MOB_TYPES.some((candidate) => candidate === kind) && kind !== "end_crystal") { this.sys(ws, "使い方: /summon <mobId> [x y z] (例: pig, minecraft:allay)"); return; }
      if (this.mobs.size >= MAX_MOBS) { this.sys(ws, `Mob上限(${MAX_MOBS})に達しています`); return; }
      let x = Math.floor(me.p[0] + 2), y = Math.floor(me.p[1]), z = Math.floor(me.p[2]);
      if (args.length >= 4) { x = Number(args[1]); y = Number(args[2]); z = Number(args[3]); }
      if (![x,y,z].every(Number.isFinite) || Math.abs(x) > 100000 || Math.abs(z) > 100000 || y < 1 || y >= WORLD_HEIGHT) { this.sys(ws, "座標が範囲外です"); return; }
      const mob: MobInfo = withMobDimension(createMob(kind, crypto.randomUUID().slice(0,12), x, y, z, 0), me.dimensionId);
      this.mobs.set(mob.id,mob); await this.persistMobs(); this.broadcastDimension({t:"mob",mob}, me.dimensionId); this.sys(ws, `${kind} を召喚しました (${mob.id})`); return;
    }
    if (cmd === "kill") {
      const id = args[0] ?? "";
      const removed = [...this.mobs.values()].filter((mob) => mobDimensionId(mob) === me.dimensionId && (id === "@e" || mob.id === id)).map((mob) => mob.id);
      if (!removed.length) { this.sys(ws, "使い方: /kill <mobId|@e>"); return; }
      for (const mobId of removed) { this.mobs.delete(mobId); this.broadcastDimension({t:"mobgone",id:mobId}, me.dimensionId); }
      await this.persistMobs(); this.sys(ws, `${removed.length}体を削除しました`); return;
    }
    if(cmd === "givefood") {
      const [who,foodId,countRaw]=args; const food=FOOD_DEFS[foodId]; const count=Number(countRaw);
      if(!food||!Number.isInteger(count)||count<1||count>64){this.sys(ws,"使い方: /givefood <player|@a|@s> <foodId> <1..64>");return;}
      const targets=this.commandTargets(who,ws,me); if(!targets.length){this.sys(ws,"対象プレイヤーが見つかりません");return;}
      for(const t of targets){t.st.vitals.foodCounts[foodId]=Math.min(999,(t.st.vitals.foodCounts[foodId]??0)+count);await this.persistVitals(t.st);this.sendStats(t.st);}
      this.sys(ws,`${food.name} を ${targets.length} 人に付与しました`);return;
    }
    this.sys(ws,`不明なコマンドです: /${raw}`);
  }

  private commandTargets(who: string | undefined, ws: WebSocket, _me: PlayerState): {ws:WebSocket;st:PlayerState}[] {
    const all = this.ctx.getWebSockets().map(s => ({ ws: s, st: this.player(s) })).filter(x => x.st.joined && !this.left.has(x.ws));
    return resolveCommandTargets(who, all, ws);
  }

  private async effectCommand(ws: WebSocket, me: PlayerState, args: string[]) {
    const sub=(args[0]??"").toLowerCase(); const who=args[1];
    if(sub==="give") {
      const id=(args[2]??"").toLowerCase(); const seconds=Number(args[3]); const strength=Number(args[4]);
      if(!Object.prototype.hasOwnProperty.call(EFFECT_DEFS, id)||!Number.isFinite(seconds)||seconds<=0||seconds>86400||!Number.isInteger(strength)||strength<0||strength>255){
        this.sys(ws,"使い方: /effect give <player|@a|@s> <effectId> <seconds> <0..255>");return;
      }
      const targets=this.commandTargets(who,ws,me); if(!targets.length){this.sys(ws,"対象プレイヤーが見つかりません");return;}
      for(const t of targets){addEffect(t.st.vitals,id,Math.ceil(seconds*20),strength);await this.persistVitals(t.st);this.sendStats(t.st);}
      this.sys(ws,`${id} を ${targets.length} 人に付与しました (${seconds}秒、レベル${strength+1})`);return;
    }
    if(sub==="clear") {
      const targets=this.commandTargets(who,ws,me); if(!targets.length){this.sys(ws,"対象プレイヤーが見つかりません");return;}
      const id=(args[2]??"").toLowerCase(); if(id && !Object.prototype.hasOwnProperty.call(EFFECT_DEFS, id)){this.sys(ws,"登録されていないeffectIdです");return;}
      for(const t of targets){clearEffect(t.st.vitals,id||undefined);await this.persistVitals(t.st);this.sendStats(t.st);}
      this.sys(ws,id?`${id} を解除しました`:`${targets.length} 人の効果をすべて解除しました`);return;
    }
    this.sys(ws,"使い方: /effect give ... | /effect clear <player|@a|@s> [effectId]");
  }

  /** 対象を理由つきで切断し、退室を通知する */
  private async evict(ws: WebSocket, reason: string): Promise<void> {
    const me = this.player(ws);
    if (me.joined) await this.persistPlayerLocation(me);
    this.send(ws, { t: "kicked", reason });
    this.leave(ws);
    try { ws.close(4001, "kicked"); } catch { /* already closed */ }
  }

  private findById(id: string): { ws: WebSocket; st: PlayerState } | null {
    if (!id) return null;
    for (const s of this.ctx.getWebSockets()) {
      if (this.left.has(s)) continue;
      const st = this.player(s);
      if (st.joined && st.id === id) return { ws: s, st };
    }
    return null;
  }

  private isBanned(p: PlayerState): boolean {
    return this.bans.some((b) => (b.cid && b.cid === p.cid) || (b.ip && b.ip === p.ip));
  }

  private banList(): BanEntry[] {
    return this.bans.map((b) => ({ bid: b.bid, name: b.name }));
  }

  private info2(p: PlayerState): PlayerInfo {
    return { id: p.id, name: p.name, skin: p.skin, p: p.p, r: p.r, host: p.host || undefined, sneak: p.sneak || undefined, fallFlying: p.fallFlying || undefined, armorSlots: [...p.armorSlots] };
  }

  private send(ws: WebSocket, msg: ServerMsg) {
    try { ws.send(JSON.stringify(msg)); } catch { /* closed */ }
  }

  private broadcast(msg: ServerMsg, except?: WebSocket) {
    const data = JSON.stringify(msg);
    for (const s of this.ctx.getWebSockets()) {
      if (s === except || this.left.has(s)) continue;
      const player = this.player(s);
      if (!player.joined) continue;
      if (["set", "drop", "gone", "mob", "mobbatch", "mobgone"].includes(msg.t) && player.dimensionId !== DIMENSION_IDS.OVERWORLD) continue;
      try { s.send(data); } catch { /* closed */ }
    }
  }

  private broadcastDimension(msg: ServerMsg, dimensionId: string, except?: WebSocket) {
    const id = normalizeDimensionId(dimensionId), data = JSON.stringify(msg);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === except || this.left.has(socket)) continue;
      const player = this.player(socket);
      if (!player.joined || player.dimensionId !== id) continue;
      try { socket.send(data); } catch { /* closed */ }
    }
  }

  private take(b: Bucket, capacity: number, perSec: number): boolean {
    const now = Date.now();
    b.tokens = Math.min(capacity, b.tokens + ((now - b.last) / 1000) * perSec);
    b.last = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  private blockAt(x: number, y: number, z: number, dimensionId: string = DIMENSION_IDS.OVERWORLD): number {
    const id = normalizeDimensionId(dimensionId);
    const cx = chunkCoord(x), cz = chunkCoord(z), key = `${cx},${cz}`;
    const index = localIndex(x, y, z);
    const edits = this.chunksForDimension(id).get(key);
    if (edits && edits[index] !== NO_EDIT) return edits[index];
    const seed = this.meta?.seed ?? 1;
    const version = this.meta?.worldgenVersion === WORLDGEN_VERSION ? WORLDGEN_VERSION : LEGACY_WORLDGEN_VERSION;
    const chunk = id === DIMENSION_IDS.OVERWORLD ? generateChunk(seed, cx, cz, version) : generateDimensionChunk(seed, cx, cz, id);
    return chunk[index] ?? 0;
  }

  private repeaterDelayForDimension(dimensionId: string) {
    const id = normalizeDimensionId(dimensionId);
    let controller = this.repeaterDelays.get(id);
    if (!controller) {
      controller = createRepeaterDelayController();
      this.repeaterDelays.set(id, controller);
    }
    return controller;
  }

  private hasPendingRepeaterTicks() {
    return [...this.repeaterDelays.values()].some((controller) => controller.size > 0);
  }

  private async updateBlockStatesAt(x: number, y: number, z: number, dimensionId: string = DIMENSION_IDS.OVERWORLD): Promise<void> {
    const id = normalizeDimensionId(dimensionId);
    const get = (bx: number, by: number, bz: number) => this.blockAt(bx, by, bz, id);
    const affected = new Map<string, { x: number; y: number; z: number }>();
    for (const cell of neighborCells(x, y, z)) affected.set(`${cell.x},${cell.y},${cell.z}`, cell);
    for (const cell of [...affected.values()]) {
      for (const change of resolveBlockStateChanges(get, cell.x, cell.y, cell.z)) {
        if (get(change.x, change.y, change.z) === change.id) continue;
        if (!await this.applyEdit(change.x, change.y, change.z, change.id, id)) continue;
        affected.set(`${change.x},${change.y},${change.z}`, { x: change.x, y: change.y, z: change.z });
        this.broadcastDimension({ t: "set", x: change.x, y: change.y, z: change.z, b: change.id }, id);
      }
    }
    for (const cell of [...affected.values()]) {
      const blockId = get(cell.x, cell.y, cell.z);
      if (blockId <= 0 || !requiresBlockSupport(blockId, BLOCKS) || canBlockStay(get, blockId, cell.x, cell.y, cell.z, BLOCKS)) continue;
      const pair = pairedBlockPosition(blockId, cell.x, cell.y, cell.z, BLOCKS);
      if (pair) {
        const pairId = get(pair.x, pair.y, pair.z);
        const samePair = pairId > 0 && blockToken(pairId, BLOCKS) === blockToken(blockId, BLOCKS) && (BLOCKS[blockId]?.shape === "door" ? BLOCKS[pairId]?.shape === "door" : BLOCKS[pairId]?.state?.part !== BLOCKS[blockId]?.state?.part);
        if (!await this.applyEdit(cell.x, cell.y, cell.z, 0, id)) continue;
        this.broadcastDimension({ t: "set", x: cell.x, y: cell.y, z: cell.z, b: 0 }, id);
        if (samePair && await this.applyEdit(pair.x, pair.y, pair.z, 0, id)) this.broadcastDimension({ t: "set", x: pair.x, y: pair.y, z: pair.z, b: 0 }, id);
        if ((this.meta?.mode ?? "creative") === "survival") for (const drop of getBlockDrops(blockId, B, blockItemId, { blocks: BLOCKS, stateMeta: MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID })) await this.spawnDrop(cell.x, cell.y, cell.z, drop.itemId, id, drop.count);
        continue;
      }
      if (!await this.applyEdit(cell.x, cell.y, cell.z, 0, id)) continue;
      this.broadcastDimension({ t: "set", x: cell.x, y: cell.y, z: cell.z, b: 0 }, id);
      if ((this.meta?.mode ?? "creative") === "survival") for (const drop of getBlockDrops(blockId, B, blockItemId, { blocks: BLOCKS, stateMeta: MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID })) await this.spawnDrop(cell.x, cell.y, cell.z, drop.itemId, id, drop.count);
    }
    for (let fromY = Math.max(1, y); fromY < WORLD_HEIGHT; fromY++) {
      const fallingId = get(x, fromY, z);
      if (!isFallingBlock(fallingId, BLOCKS)) continue;
      let landingY = fromY;
      while (landingY > 1 && isReplaceableBlock(get(x, landingY - 1, z), BLOCKS)) landingY--;
      if (landingY === fromY) continue;
      if (!await this.applyEdit(x, fromY, z, 0, id)) continue;
      if (!await this.applyEdit(x, landingY, z, fallingId, id)) { await this.applyEdit(x, fromY, z, fallingId, id); continue; }
      this.broadcastDimension({ t: "set", x, y: fromY, z, b: 0 }, id);
      this.broadcastDimension({ t: "set", x, y: landingY, z, b: fallingId }, id);
    }
  }

  private async updateRedstoneAt(x: number, y: number, z: number, dimensionId: string = DIMENSION_IDS.OVERWORLD): Promise<void> {
    const id = normalizeDimensionId(dimensionId);
    const delay = this.repeaterDelayForDimension(id);
    const result = evaluateRedstoneWorld({
      x, y, z, blockAt: (bx, by, bz) => this.blockAt(bx, by, bz, id),
      ids: { source: B.REDSTONE_BLOCK, wire: B.REDSTONE_DUST, lampOff: B.REDSTONE_LAMP_OFF, lampOn: B.REDSTONE_LAMP_ON, leverOn: B.REDSTONE_LEVER_ON, repeaters: Array.from({ length: 16 }, (_, i) => B.REDSTONE_REPEATER + i) },
      repeaterOutputAt: (rx, ry, rz) => delay.getOutput(`${rx},${ry},${rz}`),
      maxNodes: 4096, maxSteps: 65536,
    });
    if (!result.bounded) { console.warn(`redstone recalculation skipped (${result.reason}) at ${x},${y},${z} in ${id}; nodes=${result.nodeCount}`); return; }
    let repeaterStateChanged = false;
    for (const input of result.repeaterInputs) {
      const accepted = delay.schedule(`${input.x},${input.y},${input.z}`, input.powered, input.delayTicks, delay.tick);
      if (!accepted) console.warn(`redstone repeater queue full at ${input.x},${input.y},${input.z} in ${id}`);
      repeaterStateChanged = repeaterStateChanged || accepted;
    }
    if (repeaterStateChanged) await this.persistRepeaterState();
    for (const change of result.lampChanges) {
      if (!await this.applyEdit(change.x, change.y, change.z, change.to, id)) continue;
      this.broadcastDimension({ t: "set", x: change.x, y: change.y, z: change.z, b: change.to }, id);
    }
    if (this.hasPendingRepeaterTicks()) await this.armGameClock();
  }

  private async persistRepeaterState() {
    const snapshots: Record<string, unknown> = Object.create(null);
    for (const [dimensionId, controller] of this.repeaterDelays) snapshots[dimensionId] = controller.snapshot();
    const overworld = snapshots[DIMENSION_IDS.OVERWORLD] ?? this.repeaterDelayForDimension(DIMENSION_IDS.OVERWORLD).snapshot();
    snapshots[DIMENSION_IDS.OVERWORLD] = overworld;
    await this.ctx.storage.put("redstone-states", snapshots);
    await this.ctx.storage.put("redstone-state", overworld);
  }

  private async applyEdit(x: number, y: number, z: number, b: number, dimensionId: string = DIMENSION_IDS.OVERWORLD): Promise<boolean> {
    const id = normalizeDimensionId(dimensionId);
    const key = `${chunkCoord(x)},${chunkCoord(z)}`;
    return this.chunkWriterForDimension(id).apply(key, localIndex(x, y, z), b);
  }

  private chunksForDimension(dimensionId: string): Map<string, Uint8Array | Uint16Array> {
    const id = normalizeDimensionId(dimensionId);
    if (id === DIMENSION_IDS.OVERWORLD) return this.chunks;
    let chunks = this.dimensionChunks.get(id);
    if (!chunks) this.dimensionChunks.set(id, (chunks = new Map()));
    return chunks;
  }

  private chunkWriterForDimension(dimensionId: string): PersistentChunkEdits {
    const id = normalizeDimensionId(dimensionId);
    if (id === DIMENSION_IDS.OVERWORLD) return this.chunkEditWriter;
    let writer = this.dimensionChunkWriters.get(id);
    if (!writer) {
      writer = new PersistentChunkEdits(
        this.chunksForDimension(id),
        (key, value) => this.ctx.storage.put(dimensionChunkStoragePrefix(id) + key, value),
        { prefix: "", volume: CHUNK_VOLUME, maxRecords: MAX_CHUNK_RECORDS, noEdit: NO_EDIT },
      );
      this.dimensionChunkWriters.set(id, writer);
    }
    return writer;
  }

  private allEdits(dimensionId: string = DIMENSION_IDS.OVERWORLD): number[] {
    const out: number[] = [];
    for (const [key, arr] of this.chunksForDimension(dimensionId)) {
      const [cx, cz] = key.split(",").map(Number);
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] === NO_EDIT) continue;
        out.push(cx * CHUNK_SIZE + (i & 15), i >> 8, cz * CHUNK_SIZE + ((i >> 4) & 15), arr[i]);
      }
    }
    return out;
  }
}
