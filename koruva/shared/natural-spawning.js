import { MINECRAFT_BIOME_DATA } from "./minecraft-worldgen-catalog.js";
import { MOB_PROFILES } from "./mob-ai.js";
import { DIMENSION_IDS, normalizeDimensionId } from "./dimensions.js";

export const NATURAL_MOB_SPAWN_INTERVAL_MS = 15_000;
export const NATURAL_MOB_MAX_PER_DIMENSION = 18;
export const NATURAL_MOB_DESPAWN_DISTANCE = 128;
export const NATURAL_MOB_DIMENSIONS = Object.freeze([
  DIMENSION_IDS.OVERWORLD,
  DIMENSION_IDS.NETHER,
  DIMENSION_IDS.END,
]);

const DAY_MOBS = Object.freeze(["cow", "pig", "sheep", "chicken", "rabbit"]);
const NIGHT_MOBS = Object.freeze(["zombie", "skeleton", "spider", "creeper"]);
const OVERWORLD_DAY_BY_BIOME = Object.freeze({
  desert: Object.freeze(["camel", "rabbit"]),
  snowy: Object.freeze(["goat", "polar_bear", "rabbit"]),
  taiga: Object.freeze(["fox", "wolf", "rabbit"]),
  forest: Object.freeze(["fox", "wolf", "cow", "pig"]),
});
const OVERWORLD_NIGHT_BY_BIOME = Object.freeze({
  desert: Object.freeze(["husk", "skeleton", "spider", "creeper"]),
  snowy: Object.freeze(["stray", "skeleton", "spider"]),
});
const NETHER_MOBS_BY_BIOME = Object.freeze({
  nether_wastes: Object.freeze(["zombified_piglin", "piglin", "magma_cube"]),
  crimson_forest: Object.freeze(["hoglin", "piglin", "zombified_piglin"]),
  warped_forest: Object.freeze(["enderman", "zombified_piglin", "magma_cube"]),
  soul_sand_valley: Object.freeze(["skeleton", "wither_skeleton", "zombified_piglin"]),
  basalt_deltas: Object.freeze(["magma_cube", "wither_skeleton", "zombified_piglin"]),
});
const END_MOBS = Object.freeze(["enderman"]);

export function isNaturalMobSpawnDue(nowMs, lastSpawnMs, intervalMs = NATURAL_MOB_SPAWN_INTERVAL_MS) {
  return Number.isFinite(nowMs) && Number.isFinite(lastSpawnMs) && Number.isFinite(intervalMs)
    && intervalMs > 0 && nowMs - lastSpawnMs >= intervalMs;
}

/** Uses the same 0=sunrise, 0.5=sunset clock as the client sky cycle. */
export function daylightAtTime(nowMs, createdAtMs, dayLengthSeconds) {
  if (![nowMs, createdAtMs, dayLengthSeconds].every(Number.isFinite) || dayLengthSeconds <= 0) return null;
  const lengthMs = dayLengthSeconds * 1000;
  const phase = (((nowMs - createdAtMs) % lengthMs) + lengthMs) % lengthMs / lengthMs;
  return phase < 0.5;
}

const LEGACY_BIOME_ALIASES = new Set(["desert", "snowy", "taiga", "forest", "plains"]);
const stripNamespace = (value) => String(value ?? "").replace(/^minecraft:/, "");

/**
 * Returns the data-backed vanilla spawn entries for one biome/category.
 * The 26.3 tables are used for new biome IDs. The five legacy prototype names
 * keep their existing pools so older worlds do not silently change behavior.
 */
export function naturalMobSpawnEntries({ dimensionId = DIMENSION_IDS.OVERWORLD, biome = "plains", daylight = true, category = null } = {}) {
  const dimension = normalizeDimensionId(dimensionId);
  const biomeKey = stripNamespace(biome);
  if (typeof daylight !== "boolean" && category == null) return Object.freeze([]);
  const exactKey = dimension === DIMENSION_IDS.NETHER ? biomeKey
    : dimension === DIMENSION_IDS.END ? (biomeKey === "the_end_islands" ? "the_end" : biomeKey)
      : biomeKey;
  const data = MINECRAFT_BIOME_DATA[exactKey];

  // Explicit categories expose the full 26.3 table (ambient, water, axolotls, etc.).
  if (typeof category === "string" && category.length > 0) {
    const entries = data?.spawns?.[category] ?? [];
    return Object.freeze(entries.filter((entry) => MOB_PROFILES[entry.type]).map((entry) => Object.freeze({ ...entry })));
  }

  // Maintain the original project's small, deterministic default pools for existing IDs.
  if (dimension === DIMENSION_IDS.NETHER) {
    const pool = NETHER_MOBS_BY_BIOME[biomeKey] ?? NETHER_MOBS_BY_BIOME.nether_wastes;
    return Object.freeze(pool.map((type) => Object.freeze({ type, weight: 1, count: 1 })));
  }
  if (dimension === DIMENSION_IDS.END) {
    return Object.freeze(END_MOBS.map((type) => Object.freeze({ type, weight: 1, count: 1 })));
  }
  if (LEGACY_BIOME_ALIASES.has(biomeKey)) {
    const pool = daylight
      ? (OVERWORLD_DAY_BY_BIOME[biomeKey] ?? DAY_MOBS)
      : (OVERWORLD_NIGHT_BY_BIOME[biomeKey] ?? NIGHT_MOBS);
    return Object.freeze(pool.map((type) => Object.freeze({ type, weight: 1, count: 1 })));
  }

  const vanillaCategory = daylight ? "creature" : "monster";
  const entries = data?.spawns?.[vanillaCategory] ?? [];
  return Object.freeze(entries.filter((entry) => MOB_PROFILES[entry.type]).map((entry) => Object.freeze({ ...entry })));
}

/** Returns a type-only view for existing callers. */
export function naturalMobSpawnPool(options = {}) {
  return Object.freeze(naturalMobSpawnEntries(options).map((entry) => entry.type));
}

export function chooseNaturalMobType(daylight, random = Math.random, dimensionId = DIMENSION_IDS.OVERWORLD, biome = "plains", category = null) {
  if (typeof random !== "function") return null;
  const dimension = normalizeDimensionId(dimensionId);
  if (dimension === DIMENSION_IDS.OVERWORLD && typeof daylight !== "boolean" && category == null) return null;
  const entries = naturalMobSpawnEntries({ dimensionId: dimension, biome, daylight, category });
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1 || !entries.length) return null;
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight) || 0), 0);
  if (totalWeight <= 0) return entries[Math.floor(value * entries.length)]?.type ?? null;
  let cursor = value * totalWeight;
  for (const entry of entries) {
    cursor -= Math.max(0, Number(entry.weight) || 0);
    if (cursor < 0) return entry.type;
  }
  return entries[entries.length - 1]?.type ?? null;
}

/** Natural mobs unload only when every living player in the same dimension is beyond the configured radius. Summoned and legacy mobs are retained. */
export function shouldDespawnNaturalMob(mob, players, maxDistance = NATURAL_MOB_DESPAWN_DISTANCE) {
  if (!mob || mob.spawnReason !== "natural" || !Array.isArray(players)
    || ![mob.x, mob.y, mob.z].every(Number.isFinite)
    || !Number.isFinite(maxDistance) || maxDistance <= 0 || maxDistance > 10_000) return false;
  const dimensionId = normalizeDimensionId(mob.dimensionId ?? DIMENSION_IDS.OVERWORLD);
  const candidates = players.filter((player) => player && player.dead !== true
    && Array.isArray(player.p) && player.p.length >= 3 && player.p.slice(0, 3).every(Number.isFinite)
    && normalizeDimensionId(player.dimensionId ?? DIMENSION_IDS.OVERWORLD) === dimensionId);
  if (!candidates.length) return false;
  const maxDistanceSquared = maxDistance * maxDistance;
  return candidates.every((player) => {
    const dx = player.p[0] - mob.x, dy = player.p[1] - mob.y, dz = player.p[2] - mob.z;
    return dx * dx + dy * dy + dz * dz > maxDistanceSquared;
  });
}

function isEligiblePlayer(player) {
  return !!player && !player.dead && player.gameMode !== "creative" && player.gameMode !== "spectator"
    && Array.isArray(player.p) && player.p.length >= 3 && player.p.slice(0, 3).every(Number.isFinite);
}

/**
 * Finds a spawn point 16-32 blocks from an active player. `getSurfaceY` returns
 * a solid floor-block Y; `isClear` must reject solids and liquids. Headroom is
 * configurable so taller Mob profiles are not placed into ceilings.
 */
function hasMobClearance(isClear, blockX, floorY, blockZ, width, headroom) {
  if (typeof isClear !== "function" || ![blockX,floorY,blockZ,width].every(Number.isFinite)
    || width <= 0 || width > 16 || !Number.isInteger(headroom) || headroom < 1 || headroom > 8) return false;
  const half = width / 2;
  const minX = Math.floor(blockX + 0.5 - half + 1e-6);
  const maxX = Math.floor(blockX + 0.5 + half - 1e-6);
  const minZ = Math.floor(blockZ + 0.5 - half + 1e-6);
  const maxZ = Math.floor(blockZ + 0.5 + half - 1e-6);
  for (let x=minX; x<=maxX; x++) for (let z=minZ; z<=maxZ; z++) {
    for (let dy=1; dy<=headroom; dy++) if (!isClear(x,floorY+dy,z)) return false;
  }
  return true;
}

export function findNaturalSpawnSpot({ players, random = Math.random, getSurfaceY, isClear, attempts = 10, minDistance = 16, maxDistance = 32, headroom = 2, width = 0.6 } = {}) {
  if (!Array.isArray(players) || typeof random !== "function" || typeof getSurfaceY !== "function" || typeof isClear !== "function") return null;
  if (!Number.isFinite(attempts) || attempts < 1 || !Number.isFinite(minDistance) || !Number.isFinite(maxDistance) || minDistance < 0 || maxDistance <= minDistance) return null;
  if (!Number.isInteger(headroom) || headroom < 1 || headroom > 8 || !Number.isFinite(width) || width <= 0 || width > 16) return null;
  const eligible = players.filter(isEligiblePlayer);
  if (!eligible.length) return null;
  const playerRoll = random();
  if (!Number.isFinite(playerRoll) || playerRoll < 0 || playerRoll >= 1) return null;
  const player = eligible[Math.floor(playerRoll * eligible.length)];
  const tries = Math.min(32, Math.floor(attempts));
  for (let i = 0; i < tries; i++) {
    const angleRoll = random(), distanceRoll = random();
    if (![angleRoll, distanceRoll].every(value => Number.isFinite(value) && value >= 0 && value < 1)) return null;
    const angle = angleRoll * Math.PI * 2;
    const distance = minDistance + distanceRoll * (maxDistance - minDistance);
    const x = Math.floor(player.p[0] + Math.cos(angle) * distance);
    const z = Math.floor(player.p[2] + Math.sin(angle) * distance);
    const floorY = getSurfaceY(x, z);
    if (!Number.isFinite(floorY) || floorY < 1 || floorY > 61) continue;
    if (!hasMobClearance(isClear, x, floorY, z, width, headroom)) continue;
    return { x: x + 0.5, y: floorY + 1, z: z + 0.5 };
  }
  return null;
}

const HERD_MOBS = new Set(["cow", "pig", "sheep", "chicken", "rabbit"]);

/** Herd-capable prototype species get a small 2-4 member group; other Mobs spawn alone. */
export function naturalMobSpawnGroupSize(type, random = Math.random) {
  if (!HERD_MOBS.has(type)) return 1;
  if (typeof random !== "function") return null;
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) return null;
  return 2 + Math.floor(value * 3);
}

/**
 * Places group members near a previously validated spawn point. Every added
 * member gets its own solid floor, clear headroom, and non-overlapping block.
 * The group can be smaller than requested if nearby terrain is unsuitable.
 */
export function findNaturalSpawnGroup({ center, size = 1, random = Math.random, getSurfaceY, isClear, headroom = 2, radius = 4, minSeparation = 1.5, attempts = 24, width = 0.6 } = {}) {
  if (!center || ![center.x, center.y, center.z].every(Number.isFinite)
    || !Number.isInteger(size) || size < 1 || size > 4
    || typeof random !== "function" || typeof getSurfaceY !== "function" || typeof isClear !== "function"
    || !Number.isInteger(headroom) || headroom < 1 || headroom > 8
    || !Number.isFinite(radius) || radius < 1 || radius > 8
    || !Number.isFinite(minSeparation) || minSeparation < 1 || minSeparation > radius
    || !Number.isFinite(attempts) || attempts < 1) return [];
  const centerFloorY = Math.floor(center.y) - 1;
  if (!hasMobClearance(isClear, Math.floor(center.x), centerFloorY, Math.floor(center.z), width, headroom)) return [];
  const group = [{ x: center.x, y: center.y, z: center.z }];
  if (size === 1) return group;
  const occupied = new Set([`${Math.floor(center.x)},${Math.floor(center.z)}`]);
  const maxAttempts = Math.min(64, Math.floor(attempts));
  for (let attempt = 0; attempt < maxAttempts && group.length < size; attempt++) {
    const angleRoll = random(), distanceRoll = random();
    if (![angleRoll, distanceRoll].every(value => Number.isFinite(value) && value >= 0 && value < 1)) break;
    const angle = angleRoll * Math.PI * 2;
    const distance = minSeparation + distanceRoll * (radius - minSeparation);
    const blockX = Math.floor(center.x + Math.cos(angle) * distance);
    const blockZ = Math.floor(center.z + Math.sin(angle) * distance);
    const cell = `${blockX},${blockZ}`;
    if (occupied.has(cell)) continue;
    const floorY = getSurfaceY(blockX, blockZ);
    if (!Number.isFinite(floorY) || floorY < 1 || floorY > 61 || Math.abs(floorY + 1 - center.y) > 2) continue;
    if (!hasMobClearance(isClear, blockX, floorY, blockZ, width, headroom)) continue;
    const position = { x: blockX + 0.5, y: floorY + 1, z: blockZ + 0.5 };
    if (group.some(member => Math.hypot(member.x - position.x, member.z - position.z) < minSeparation)) continue;
    occupied.add(cell);
    group.push(position);
  }
  return group;
}

