/**
 * Server-authoritative compact mob loot tables.
 * Common vanilla drops are represented as real item entities; meat and rotten
 * flesh remain in the project's existing foodCounts inventory.
 */
export const MOB_FOOD_LOOT = Object.freeze({
  chicken: Object.freeze([{ foodId: "raw_chicken", min: 1, max: 1 }]),
  cow: Object.freeze([{ foodId: "raw_beef", min: 1, max: 3 }]),
  mooshroom: Object.freeze([{ foodId: "raw_beef", min: 1, max: 3 }]),
  pig: Object.freeze([{ foodId: "raw_pork", min: 1, max: 3 }]),
  hoglin: Object.freeze([{ foodId: "raw_pork", min: 2, max: 4 }]),
  sheep: Object.freeze([{ foodId: "raw_mutton", min: 1, max: 2 }]),
  rabbit: Object.freeze([{ foodId: "raw_rabbit", min: 1, max: 1 }]),
  zombie: Object.freeze([{ foodId: "rotten_flesh", min: 0, max: 2 }]),
  zombie_villager: Object.freeze([{ foodId: "rotten_flesh", min: 0, max: 2 }]),
  husk: Object.freeze([{ foodId: "rotten_flesh", min: 0, max: 2 }]),
  drowned: Object.freeze([{ foodId: "rotten_flesh", min: 0, max: 2 }]),
  zombified_piglin: Object.freeze([{ foodId: "rotten_flesh", min: 0, max: 1 }]),
  zoglin: Object.freeze([{ foodId: "rotten_flesh", min: 1, max: 3 }]),
  zombie_horse: Object.freeze([{ foodId: "rotten_flesh", min: 2, max: 3 }]),
});

const LOOT_FOOD_IDS = new Set(Object.values(MOB_FOOD_LOOT).flat().map(entry => entry.foodId));
function sample01(random) {
  let value = 0;
  try { value = Number(random()); } catch { value = 0; }
  if (!Number.isFinite(value)) value = 0;
  return Math.max(0, Math.min(1 - Number.EPSILON, value));
}
function normalizedLooting(level) {
  return Number.isInteger(level) ? Math.max(0, Math.min(3, level)) : 0;
}
function rollCount(entry, random, lootingLevel = 0) {
  const base = entry.min + Math.floor(sample01(random) * (entry.max - entry.min + 1));
  const looting = normalizedLooting(lootingLevel);
  const bonus = looting > 0 && entry.lootingCount !== false ? Math.floor(sample01(random) * (looting + 1)) : 0;
  return base + bonus;
}

/** Roll food rewards; unknown mob types and invalid RNG inputs never create invalid counts. */
export function rollMobFoodLoot(type, random = Math.random, lootingLevel = 0) {
  const entries = MOB_FOOD_LOOT[type];
  if (!entries || typeof random !== "function") return {};
  const result = {};
  for (const item of entries) {
    const count = rollCount(item, random, lootingLevel);
    if (count > 0) result[item.foodId] = (result[item.foodId] ?? 0) + count;
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

/** Item names shown in debugging and loot tables. */
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
  leather: "革",
  feather: "羽根",
  rabbit_hide: "ウサギの皮",
  rabbit_foot: "ウサギの足",
  iron_ingot: "鉄インゴット",
  poppy: "ポピー",
  snowball: "雪玉",
  emerald: "エメラルド",
  coal: "石炭",
  wither_skeleton_skull: "ウィザースケルトンの頭蓋骨",
  nether_star: "ネザースター",
  totem_of_undying: "不死のトーテム",
  shulker_shell: "シュルカーの殻",
  phantom_membrane: "ファントムの皮膜",
  breeze_rod: "ブリーズロッド",
  nautilus_shell: "オウムガイの殻",
  wet_sponge: "濡れたスポンジ",
  gold_nugget: "金塊", gold_ingot: "金インゴット",
  bamboo: "竹", saddle: "鞍", sculk_catalyst: "スカルクカタリスト", cod: "タラ",
  glowstone_dust: "グロウストーンダスト", sugar: "砂糖", glass_bottle: "ガラス瓶", stick: "棒", redstone: "レッドストーン",
});
export const MOB_MATERIAL_ITEM_IDS = Object.freeze(Object.keys(MOB_MATERIAL_NAMES));
const LOOT_MATERIAL_IDS = new Set(MOB_MATERIAL_ITEM_IDS);

/** Material drops aligned to the bundled Java 26.3 entity loot tables and their special rules. */
const entry = (itemId, min, max, options = {}) => Object.freeze({ itemId, min, max, ...options });
const pool = (...entries) => Object.freeze(entries);
export const MOB_MATERIAL_LOOT = Object.freeze({
  chicken: pool(entry("feather", 0, 2)),
  cow: pool(entry("leather", 0, 2)),
  mooshroom: pool(entry("leather", 0, 2)),
  hoglin: pool(entry("leather", 0, 1)),
  horse: pool(entry("leather", 0, 2)),
  donkey: pool(entry("leather", 0, 2)),
  mule: pool(entry("leather", 0, 2)),
  llama: pool(entry("leather", 0, 2)),
  trader_llama: pool(entry("leather", 0, 2)),
  zombie_horse: pool(entry("leather", 0, 2)),
  skeleton_horse: pool(entry("bone", 0, 2)),
  rabbit: pool(entry("rabbit_hide", 0, 1), entry("rabbit_foot", 1, 1, { chance: 0.1, lootingChance: 0.03, lootingCount: false })),
  skeleton: pool(entry("bone", 0, 2), entry("arrow", 0, 2)),
  stray: pool(entry("bone", 0, 2), entry("arrow", 0, 2)),
  bogged: pool(entry("bone", 0, 2), entry("arrow", 0, 2)),
  wither_skeleton: pool(entry("bone", 0, 2), entry("coal", -1, 1), entry("wither_skeleton_skull", 1, 1, { chance: 0.025, lootingChance: 0.01, lootingCount: false, killedByPlayer: true })),
  creeper: pool(entry("gunpowder", 0, 2)),
  parched: pool(entry("bone", 0, 2), entry("arrow", 0, 2)),
  cat: pool(entry("string", 0, 2)),
  panda: pool(entry("bamboo", 1, 1)),
  ravager: pool(entry("saddle", 1, 1)),
  strider: pool(entry("string", 2, 5)),
  warden: pool(entry("sculk_catalyst", 1, 1)),
  dolphin: pool(entry("cod", 0, 1)),
  witch: pool(
    entry("glowstone_dust", 0, 2), entry("sugar", 0, 2), entry("spider_eye", 0, 2),
    entry("glass_bottle", 0, 2), entry("gunpowder", 0, 2), entry("stick", 0, 2),
    entry("redstone", 4, 8),
  ),
  vindicator: pool(entry("emerald", 0, 1, { killedByPlayer: true })),
  zombified_piglin: pool(entry("gold_nugget", 0, 1), entry("rotten_flesh", 0, 1), entry("gold_ingot", 1, 1, { chance: 0.025, lootingChance: 0.01, lootingCount: false, killedByPlayer: true })),
  spider: pool(entry("string", 0, 2), entry("spider_eye", -1, 1, { killedByPlayer: true })),
  cave_spider: pool(entry("string", 0, 2), entry("spider_eye", -1, 1, { killedByPlayer: true })),
  enderman: pool(entry("ender_pearl", 0, 1)),
  blaze: pool(entry("blaze_rod", 0, 1, { killedByPlayer: true })),
  breeze: pool(entry("breeze_rod", 1, 2, { killedByPlayer: true })),
  ghast: pool(entry("ghast_tear", 0, 1), entry("gunpowder", 0, 2)),
  slime: pool(entry("slime_ball", 0, 4)),
  magma_cube: pool(entry("magma_cream", 0, 1)),
  guardian: pool(entry("prismarine_shard", 0, 2), entry("cod", 1, 1, { choiceGroup: "guardian-fish" }), entry("prismarine_crystals", 1, 1, { choiceGroup: "guardian-fish" }), entry("", 0, 0, { choiceGroup: "guardian-fish" })),
  elder_guardian: pool(entry("prismarine_shard", 0, 2), entry("cod", 1, 1, { choiceGroup: "elder-guardian-fish" }), entry("prismarine_crystals", 1, 1, { choiceGroup: "elder-guardian-fish" }), entry("", 0, 0, { choiceGroup: "elder-guardian-fish" }), entry("wet_sponge", 1, 1, { killedByPlayer: true })),
  drowned: pool(entry("copper_ingot", 1, 1, { chance: 0.11, lootingChance: 0.02, lootingCount: false, killedByPlayer: true })),
  iron_golem: pool(entry("iron_ingot", 3, 5), entry("poppy", 0, 2)),
  snow_golem: pool(entry("snowball", 0, 15)),
  evoker: pool(entry("totem_of_undying", 1, 1), entry("emerald", 0, 1, { killedByPlayer: true })),
  shulker: pool(entry("shulker_shell", 1, 1, { chance: 0.5, lootingChance: 0.05, lootingCount: false })),
  phantom: pool(entry("phantom_membrane", 0, 1, { killedByPlayer: true })),
  wither: pool(entry("nether_star", 1, 1)),
});

/** Roll bounded material rewards and optional rare-drop chances. */
export function rollMobMaterialLoot(type, random = Math.random, lootingLevel = 0, killedByPlayer = false) {
  const entries = MOB_MATERIAL_LOOT[type];
  if (!entries || typeof random !== "function") return {};
  const result = {};
  const looting = normalizedLooting(lootingLevel);
  const handledGroups = new Set();

  const addItem = (item) => {
    if (!item || !item.itemId) return;
    if (item.chance !== undefined) {
      const chance = Math.max(0, Math.min(1, item.chance + (item.lootingChance ?? 0) * looting));
      if (sample01(random) >= chance) return;
    }
    const count = rollCount(item, random, looting);
    if (count > 0) result[item.itemId] = (result[item.itemId] ?? 0) + count;
  };

  for (const item of entries) {
    if (item.choiceGroup) {
      if (handledGroups.has(item.choiceGroup)) continue;
      handledGroups.add(item.choiceGroup);
      const choices = entries.filter(candidate => candidate.choiceGroup === item.choiceGroup
        && (candidate.killedByPlayer !== true || killedByPlayer === true));
      const totalWeight = choices.reduce((sum, candidate) => sum + Math.max(0, candidate.weight ?? 1), 0);
      if (totalWeight <= 0) continue;
      let roll = sample01(random) * totalWeight;
      let selected = choices[choices.length - 1];
      for (const candidate of choices) {
        roll -= Math.max(0, candidate.weight ?? 1);
        if (roll < 0) { selected = candidate; break; }
      }
      addItem(selected);
      continue;
    }
    if (item.killedByPlayer === true && killedByPlayer !== true) continue;
    addItem(item);
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

/** Copy-on-write merge for material inventory; unknown keys and malformed rewards are ignored. */
export function applyMobMaterialLoot(materialCounts, loot, maxCount = 999) {
  const cap = Number.isSafeInteger(maxCount) ? Math.max(0, maxCount) : 999;
  const next = normalizeMobMaterialCounts(materialCounts, cap);
  let changed = false;
  if (!loot || typeof loot !== "object" || Array.isArray(loot)) return { materialCounts: next, changed };
  for (const [itemId, rawCount] of Object.entries(loot)) {
    if (!LOOT_MATERIAL_IDS.has(itemId) || !Number.isSafeInteger(rawCount) || rawCount <= 0) continue;
    const before = next[itemId] ?? 0;
    const after = Math.min(cap, before + rawCount);
    if (after !== before) { next[itemId] = after; changed = true; }
  }
  return { materialCounts: next, changed };
}
