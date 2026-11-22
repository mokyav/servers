import { maxDurabilityForItemKey } from "./item-durability.js";
import { normalizeItemEnchantments as normalizeEnchantments } from "./enchantments.js";
import { getItemEnchantment, enchantmentDamageProtection } from "./enchantments.js";
/** Shared Java-style item mechanics used by both client prediction and the room server. */
export function armorSlotForItemId(itemId, blocks) {
  const key = blocks[itemId]?.key;
  if (typeof key !== "string") return -1;
  const id = key.replace(/^minecraft:/, "");
  if (/(?:^|_)helmet$/.test(id) || id === "turtle_helmet") return 0;
  if (/(?:^|_)chestplate$/.test(id) || id === "elytra") return 1;
  if (/(?:^|_)leggings$/.test(id)) return 2;
  if (/(?:^|_)boots$/.test(id)) return 3;
  return -1;
}

export function normalizeArmorSlots(raw, blocks, counts, creative = false) {
  const slots = [0, 0, 0, 0];
  if (!Array.isArray(raw)) return slots;
  for (let slot = 0; slot < 4; slot++) {
    const id = raw[slot];
    if (!Number.isInteger(id) || id <= 0 || id >= blocks.length || armorSlotForItemId(id, blocks) !== slot) continue;
    if (!creative && (!Array.isArray(counts) || (counts[id] ?? 0) <= 0)) continue;
    slots[slot] = id;
  }
  return slots;
}

function armorStats(key) {
  const id = String(key || "").replace(/^minecraft:/, "");
  const material = id.match(/^(leather|chainmail|iron|golden|diamond|netherite)_/)?.[1];
  if (id === "turtle_helmet") return { points: 2, toughness: 0 };
  if (!material) return { points: 0, toughness: 0 };
  const points = {
    leather: [1, 3, 2, 1], chainmail: [2, 5, 4, 1], iron: [2, 6, 5, 2],
    golden: [2, 5, 3, 1], diamond: [3, 8, 6, 3], netherite: [3, 8, 6, 3],
  }[material];
  const part = id.endsWith("_helmet") ? 0 : id.endsWith("_chestplate") ? 1 : id.endsWith("_leggings") ? 2 : id.endsWith("_boots") ? 3 : -1;
  return { points: part < 0 ? 0 : points[part], toughness: material === "diamond" || material === "netherite" ? 3 : 0 };
}

export function armorTotals(armorSlots, blocks) {
  let armor = 0, toughness = 0;
  for (const id of Array.isArray(armorSlots) ? armorSlots : []) {
    const stats = armorStats(blocks[id]?.key);
    armor += stats.points; toughness += stats.toughness;
  }
  return { armor, toughness };
}

/** Java-style armor reduction. This intentionally does not apply enchantment protection. */
export function applyArmorReduction(damage, armorSlots, blocks, itemEnchantments = {}, cause = "generic", enchantmentSlots = armorSlots) {
  const raw = Math.max(0, Number.isFinite(damage) ? damage : 0);
  const { armor, toughness } = armorTotals(armorSlots, blocks);
  const reduction = Math.min(20, Math.max(armor / 5, armor - raw / (2 + toughness / 4))) / 25;
  const protectedDamage = raw * (1 - reduction);
  const protection = enchantmentDamageProtection(itemEnchantments, enchantmentSlots, blocks, cause);
  return protectedDamage * (1 - Math.min(0.8, protection / 25));
}

export function toolKindForItemId(itemId, blocks) {
  const id = String(blocks[itemId]?.key || "").replace(/^minecraft:/, "");
  if (/(?:^|_)(?:wooden|stone|iron|golden|diamond|netherite)_pickaxe$/.test(id)) return "pickaxe";
  if (/(?:^|_)(?:wooden|stone|iron|golden|diamond|netherite)_axe$/.test(id)) return "axe";
  if (/(?:^|_)(?:wooden|stone|iron|golden|diamond|netherite)_shovel$/.test(id)) return "shovel";
  if (/(?:^|_)(?:wooden|stone|iron|golden|diamond|netherite)_hoe$/.test(id)) return "hoe";
  return "hand";
}

function toolTier(itemId, blocks) {
  const id = String(blocks[itemId]?.key || "").replace(/^minecraft:/, "");
  return id.startsWith("netherite_") ? 9 : id.startsWith("diamond_") ? 8 : id.startsWith("iron_") ? 6 : id.startsWith("golden_") ? 12 : id.startsWith("stone_") ? 4 : id.startsWith("wooden_") ? 2 : 1;
}

export function miningSpeedMultiplier(blockId, toolItemId, blocks, itemEnchantments = {}) {
  const block = String(blocks[blockId]?.key || "").replace(/^minecraft:/, "");
  const kind = toolKindForItemId(toolItemId, blocks);
  if (kind === "hand") return 1;
  const matches = kind === "pickaxe"
    ? /(?:stone|ore|metal|copper|anvil|obsidian|deepslate|netherrack|blackstone|end_stone|bricks|terracotta|concrete)/.test(block)
    : kind === "axe" ? /(?:log|wood|planks|stem|hyphae|chest|barrel|pumpkin|melon|bookshelf)/.test(block)
      : kind === "shovel" ? /(?:dirt|grass_block|sand|gravel|snow|clay|mud|soul_sand|soul_soil|powder_snow)/.test(block)
        : /(?:leaves|hay|target|wet_sponge)/.test(block);
  if (!matches) return 1;
  const tier = toolTier(toolItemId, blocks);
  const efficiency = getItemEnchantment(itemEnchantments, toolItemId, "efficiency");
  return tier + (efficiency > 0 ? efficiency * efficiency + 1 : 0);
}

export function weaponReachForItemId(itemId, blocks) {
  const id = String(blocks[itemId]?.key || "").replace(/^minecraft:/, "");
  return /(?:^|_)(?:wooden|stone|copper|iron|golden|diamond|netherite)_spear$/.test(id) ? 4.5 : id === "trident" ? 4.0 : 3.2;
}

export function weaponStatsForItemId(itemId, blocks) {
  const id = String(blocks[itemId]?.key || "").replace(/^minecraft:/, "");
  const material = id.split("_")[0];
  const swordDamage = { wooden: 4, golden: 4, stone: 5, iron: 6, diamond: 7, netherite: 8 };
  const axeDamage = { wooden: 7, golden: 7, stone: 9, copper: 8, iron: 9, diamond: 9, netherite: 10 };
  if (/_sword$/.test(id)) return { kind: "sword", damage: swordDamage[material] ?? 4 };
  if (/_axe$/.test(id)) return { kind: id, damage: axeDamage[material] ?? 7 };
  if (/_spear$/.test(id)) return { kind: "spear", damage: (swordDamage[material] ?? 4) + 1 };
  if (id === "mace") return { kind: "mace", damage: 6 };
  if (id === "trident") return { kind: "trident", damage: 9 };
  if (id.endsWith("_pickaxe")) return { kind: "pickaxe", damage: 2 };
  if (id.endsWith("_shovel")) return { kind: "shovel", damage: 2 };
  if (/(?:wooden|stone|iron|golden|diamond|netherite)_hoe$/.test(id)) return { kind: id, damage: 1 };
  return { kind: "fist", damage: 1 };
}


/** Backward-compatible ID-based durability lookup used by older integrations. */
export function itemDurabilityForId(itemId, blocks) {
  return maxDurabilityForItemKey(blocks?.[itemId]?.key ?? "");
}

/** Backward-compatible one-point durability tick; current inventory uses stack damage records. */
export function damageItemDurability(itemId, current, blocks, enchantments = {}, rng = Math.random, armor = false) {
  const max = itemDurabilityForId(itemId, blocks);
  const durabilityNow = Number.isInteger(current) && current >= 0 ? Math.min(max, current) : max;
  const level = Math.max(0, Math.min(3, Number.isInteger(enchantments?.unbreaking) ? enchantments.unbreaking : 0));
  const chance = armor ? 1 / (level * 4 + 1) : 1 / (level + 1);
  if (!max || rng() >= chance) return { max, durability: durabilityNow, broken: false, damaged: false };
  const durability = Math.max(0, durabilityNow - 1);
  return { max, durability, broken: durability <= 0, damaged: true };
}

export function efficiencyMultiplier(level) {
  const n = Math.max(0, Math.min(5, Number.isInteger(level) ? level : 0));
  return n > 0 ? n * n + 1 : 1;
}

export function sharpnessBonus(level) {
  const n = Math.max(0, Math.min(5, Number.isInteger(level) ? level : 0));
  return n > 0 ? 0.5 * n + 0.5 : 0;
}

export function enchantmentProtection(enchantments = {}, damageType = "generic") {
  const level = Math.max(0, Number(enchantments.protection) || 0) +
    (damageType === "fire" ? Math.max(0, Number(enchantments.fire_protection) || 0) * 2 : 0) +
    (damageType === "blast" ? Math.max(0, Number(enchantments.blast_protection) || 0) * 2 : 0) +
    (damageType === "projectile" ? Math.max(0, Number(enchantments.projectile_protection) || 0) * 2 : 0);
  return Math.min(0.8, level * 0.04);
}

export const normalizeItemEnchantments = normalizeEnchantments;


/** Legacy durability helpers retained for older saves and external integrations.
 * The active game uses per-stack damage records from shared/item-durability.js. */
export function toolDurability(itemId, blocks) {
  return itemDurabilityForId(itemId, blocks);
}

export function durabilityStatus(itemId, wear, blocks) {
  const max = toolDurability(itemId, blocks);
  if (!max) return null;
  const stored = Array.isArray(wear) ? Number(wear[itemId]) : 0;
  const remaining = Number.isSafeInteger(stored) && stored > 0 ? Math.min(max, stored) : max;
  const ratio = remaining / max;
  const color = ratio > 0.5 ? "#54c85a" : ratio > 0.25 ? "#e1c14a" : "#e14949";
  return { max, remaining, ratio, color };
}

export function normalizeToolWear(raw, counts, blocks) {
  const wear = new Array(Array.isArray(blocks) ? blocks.length : 0).fill(0);
  if (!Array.isArray(counts) || !raw || typeof raw !== "object") return wear;
  for (let id = 1; id < wear.length; id++) {
    if ((counts[id] ?? 0) <= 0) continue;
    const max = toolDurability(id, blocks);
    const value = Array.isArray(raw) ? raw[id] : raw[String(id)];
    if (max > 0 && Number.isInteger(value) && value > 0 && value < max) wear[id] = value;
  }
  return wear;
}

export function damageTool(wear, itemId, counts, blocks, amount = 1) {
  if (!Array.isArray(wear) || !Array.isArray(counts) || !Number.isInteger(itemId) || itemId <= 0 || (counts[itemId] ?? 0) <= 0) return { changed: false, broke: false, remaining: 0 };
  const max = toolDurability(itemId, blocks);
  if (!max) return { changed: false, broke: false, remaining: 0 };
  const current = Number.isInteger(wear[itemId]) && wear[itemId] > 0 ? Math.min(max, wear[itemId]) : max;
  const next = Math.max(0, current - Math.max(1, Math.floor(Number(amount) || 1)));
  if (next <= 0) {
    counts[itemId] = Math.max(0, counts[itemId] - 1);
    wear[itemId] = 0;
    return { changed: true, broke: true, remaining: 0 };
  }
  wear[itemId] = next;
  return { changed: true, broke: false, remaining: next };
}
