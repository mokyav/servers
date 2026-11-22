/**
 * Small, server-authoritative mob food-loot table for Koruva's existing foodCounts inventory.
 * Prototype subset only; this is not a complete Minecraft loot-table implementation.
 */
export const MOB_FOOD_LOOT = Object.freeze({
  chicken: Object.freeze([{ foodId: "raw_chicken", min: 1, max: 2 }]),
  cow: Object.freeze([{ foodId: "raw_beef", min: 1, max: 3 }]),
  mooshroom: Object.freeze([{ foodId: "raw_beef", min: 1, max: 3 }]),
  pig: Object.freeze([{ foodId: "raw_pork", min: 1, max: 3 }]),
  hoglin: Object.freeze([{ foodId: "raw_pork", min: 2, max: 4 }]),
  sheep: Object.freeze([{ foodId: "raw_mutton", min: 1, max: 2 }]),
  rabbit: Object.freeze([{ foodId: "raw_rabbit", min: 0, max: 1 }]),
  zombie: Object.freeze([{ foodId: "rotten_flesh", min: 0, max: 2 }]),
  zombie_villager: Object.freeze([{ foodId: "rotten_flesh", min: 0, max: 2 }]),
  husk: Object.freeze([{ foodId: "rotten_flesh", min: 0, max: 2 }]),
  drowned: Object.freeze([{ foodId: "rotten_flesh", min: 0, max: 2 }]),
  zombified_piglin: Object.freeze([{ foodId: "rotten_flesh", min: 0, max: 2 }]),
  zoglin: Object.freeze([{ foodId: "rotten_flesh", min: 0, max: 2 }]),
});

const LOOT_FOOD_IDS = new Set(Object.values(MOB_FOOD_LOOT).flat().map(entry => entry.foodId));

/** Roll a compact food reward. Random input is clamped so malformed RNG cannot create invalid counts. */
export function rollMobFoodLoot(type, random = Math.random, lootingLevel = 0) {
  const entries = MOB_FOOD_LOOT[type];
  if (!entries) return {};
  const result = {};
  for (const entry of entries) {
    let sample = 0;
    try { sample = Number(random()); } catch { sample = 0; }
    if (!Number.isFinite(sample)) sample = 0;
    sample = Math.max(0, Math.min(1 - Number.EPSILON, sample));
    const base = entry.min + Math.floor(sample * (entry.max - entry.min + 1));
    let bonusSample = 0;
    try { bonusSample = Number(random()); } catch { bonusSample = 0; }
    if (!Number.isFinite(bonusSample)) bonusSample = 0;
    bonusSample = Math.max(0, Math.min(1 - Number.EPSILON, bonusSample));
    const looting = Number.isInteger(lootingLevel) ? Math.max(0, Math.min(3, lootingLevel)) : 0;
    const count = base + Math.floor(bonusSample * (looting + 1));
    if (count > 0) result[entry.foodId] = (result[entry.foodId] ?? 0) + count;
  }
  return result;
}

/** Copy-on-write merge for persisted food inventory; unknown keys and malformed counts are ignored. */
export function applyMobFoodLoot(foodCounts, loot, maxCount = 999) {
  const source = foodCounts && typeof foodCounts === "object" && !Array.isArray(foodCounts) ? foodCounts : {};
  const next = { ...source };
  const cap = Number.isSafeInteger(maxCount) ? Math.max(0, maxCount) : 999;
  let changed = false;
  if (!loot || typeof loot !== "object" || Array.isArray(loot)) return { foodCounts: next, changed };
  for (const [foodId, rawCount] of Object.entries(loot)) {
    if (!LOOT_FOOD_IDS.has(foodId) || !Number.isSafeInteger(rawCount) || rawCount <= 0) continue;
    const before = Number.isSafeInteger(next[foodId]) && next[foodId] >= 0 ? next[foodId] : 0;
    const after = Math.min(cap, before + rawCount);
    if (after !== before) { next[foodId] = after; changed = true; }
  }
  return { foodCounts: next, changed };
}


/** Display labels and whitelist for the prototype's non-food mob material inventory. */
export const MOB_MATERIAL_NAMES = Object.freeze({
  bone: "骨",
  arrow: "矢",
  gunpowder: "火薬",
  string: "糸",
  spider_eye: "クモの目",
  ender_pearl: "エンダーパール",
  blaze_rod: "ブレイズロッド",
  ghast_tear: "ガストの涙",
  slime_ball: "スライムボール",
  magma_cream: "マグマクリーム",
  prismarine_shard: "プリズマリンの欠片",
  prismarine_crystals: "プリズマリンクリスタル",
  copper_ingot: "銅インゴット",
});
export const MOB_MATERIAL_ITEM_IDS = Object.freeze(Object.keys(MOB_MATERIAL_NAMES));
const LOOT_MATERIAL_IDS = new Set(MOB_MATERIAL_ITEM_IDS);

/** Compact prototype table used by the server to spawn real world item entities; not a complete vanilla loot table. */
export const MOB_MATERIAL_LOOT = Object.freeze({
  skeleton: Object.freeze([{ itemId: "bone", min: 0, max: 2 }, { itemId: "arrow", min: 0, max: 2 }]),
  stray: Object.freeze([{ itemId: "bone", min: 0, max: 2 }, { itemId: "arrow", min: 0, max: 2 }]),
  bogged: Object.freeze([{ itemId: "bone", min: 0, max: 2 }, { itemId: "arrow", min: 0, max: 2 }]),
  creeper: Object.freeze([{ itemId: "gunpowder", min: 0, max: 2 }]),
  spider: Object.freeze([{ itemId: "string", min: 0, max: 2 }, { itemId: "spider_eye", min: 0, max: 1 }]),
  cave_spider: Object.freeze([{ itemId: "string", min: 0, max: 2 }, { itemId: "spider_eye", min: 0, max: 1 }]),
  enderman: Object.freeze([{ itemId: "ender_pearl", min: 0, max: 1 }]),
  blaze: Object.freeze([{ itemId: "blaze_rod", min: 0, max: 1 }]),
  ghast: Object.freeze([{ itemId: "ghast_tear", min: 0, max: 1 }, { itemId: "gunpowder", min: 0, max: 2 }]),
  slime: Object.freeze([{ itemId: "slime_ball", min: 1, max: 4 }]),
  magma_cube: Object.freeze([{ itemId: "magma_cream", min: 0, max: 1 }]),
  guardian: Object.freeze([{ itemId: "prismarine_shard", min: 0, max: 2 }, { itemId: "prismarine_crystals", min: 0, max: 1 }]),
  elder_guardian: Object.freeze([{ itemId: "prismarine_shard", min: 0, max: 2 }, { itemId: "prismarine_crystals", min: 0, max: 1 }]),
  drowned: Object.freeze([{ itemId: "copper_ingot", min: 0, max: 1 }]),
});

/** Roll bounded material rewards; malformed RNG is treated as the lowest roll. */
export function rollMobMaterialLoot(type, random = Math.random) {
  const entries = MOB_MATERIAL_LOOT[type];
  if (!entries) return {};
  const result = {};
  for (const entry of entries) {
    let sample = 0;
    try { sample = Number(random()); } catch { sample = 0; }
    if (!Number.isFinite(sample)) sample = 0;
    sample = Math.max(0, Math.min(1 - Number.EPSILON, sample));
    const count = entry.min + Math.floor(sample * (entry.max - entry.min + 1));
    if (count > 0) result[entry.itemId] = (result[entry.itemId] ?? 0) + count;
  }
  return result;
}

/** Keep only whitelisted, positive integer material counts, capped for persisted state. */
export function normalizeMobMaterialCounts(raw, maxCount = 999) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const cap = Number.isSafeInteger(maxCount) ? Math.max(0, maxCount) : 999;
  const result = {};
  for (const itemId of MOB_MATERIAL_ITEM_IDS) {
    const count = source[itemId];
    if (!Number.isSafeInteger(count) || count <= 0) continue;
    const bounded = Math.min(cap, count);
    if (bounded > 0) result[itemId] = bounded;
  }
  return result;
}

/** Copy-on-write merge for the material inventory; unknown keys and malformed rewards are ignored. */
export function applyMobMaterialLoot(materialCounts, loot, maxCount = 999) {
  const cap = Number.isSafeInteger(maxCount) ? Math.max(0, maxCount) : 999;
  const next = normalizeMobMaterialCounts(materialCounts, cap);
  let changed = false;
  if (!loot || typeof loot !== "object" || Array.isArray(loot)) return { materialCounts: next, changed };
  for (const [itemId, rawCount] of Object.entries(loot)) {
    if (!LOOT_MATERIAL_IDS.has(itemId) || !Number.isSafeInteger(rawCount) || rawCount <= 0) continue;
    const before = next[itemId] ?? 0;
    const after = Math.min(cap, before + rawCount);
    if (after !== before) {
      if (after > 0) next[itemId] = after;
      else delete next[itemId];
      changed = true;
    }
  }
  return { materialCounts: next, changed };
}

