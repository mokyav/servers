import { ENCHANTMENT_MAX_LEVEL } from "./enchantments.js";

export function countEnchantingBookshelves(blockAt, x, y, z, bookshelfId) {
  if (typeof blockAt !== "function" || !Number.isSafeInteger(bookshelfId) || bookshelfId <= 0) return 0;
  let count = 0;
  // A one-block air gap must remain between the table and each shelf. Two-high
  // shelves are counted once per column, capped at the vanilla 15 power.
  const positions = [];
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== 2) continue;
    positions.push([dx, dz]);
  }
  for (const [dx, dz] of positions) {
    const gapX = x + Math.sign(dx), gapZ = z + Math.sign(dz);
    if (blockAt(gapX, y, gapZ) !== 0 || blockAt(gapX, y + 1, gapZ) !== 0) continue;
    const shelf = blockAt(x + dx, y, z + dz) === bookshelfId || blockAt(x + dx, y + 1, z + dz) === bookshelfId;
    if (shelf) count++;
  }
  return Math.min(15, count);
}

export function enchantingOfferCosts(power, randomSeed = 0, itemEnchantability = 10) {
  const p = Math.max(0, Math.min(15, Math.floor(Number(power) || 0)));
  const e = Math.max(1, Math.min(30, Math.floor(Number(itemEnchantability) || 10)));
  const rand = xorshift32((Number(randomSeed) | 0) ^ (p * 0x9e3779b9) ^ (e * 0x85ebca6b));
  const base = p + 1 + Math.floor(rand() * 8) + Math.floor(p / 2) + Math.floor(rand() * (e / 4 + 1));
  return [Math.max(1, Math.floor(base / 3)), Math.max(1, Math.floor(base * 2 / 3 + 1)), Math.max(1, Math.min(30, base))];
}

export function createEnchantingOffers(itemId, compatibleEnchantments, power, seed = 0) {
  const costs = enchantingOfferCosts(power, seed);
  const candidates = [...new Set(compatibleEnchantments)].filter((id) => ENCHANTMENT_MAX_LEVEL[id]);
  if (!candidates.length || power <= 0) return [];
  const rng = xorshift32((Number(seed) | 0) ^ (itemId * 0x45d9f3b) ^ (power * 0x27d4eb2d));
  const shuffled = candidates.map((value) => ({ value, key: rng() })).sort((a, b) => a.key - b.key).map((item) => item.value);
  return costs.map((cost, index) => {
    if (index === 0 && cost > 1) return null;
    const enchantmentId = shuffled[index % shuffled.length];
    const max = ENCHANTMENT_MAX_LEVEL[enchantmentId] ?? 1;
    const level = Math.max(1, Math.min(max, Math.ceil(cost / Math.max(1, power / 5 + 1))));
    return { slot: index, cost: Math.min(30, cost), enchantmentId, level };
  }).filter(Boolean);
}

export function bowShotProfile(chargeMs, power = 0, punch = 0, flame = 0) {
  const charge = Math.max(0, Math.min(1, Number(chargeMs) / 1000));
  const velocity = charge >= 1 ? 3 : 3 * (charge * charge + charge * 2) / 3;
  const damage = 2 + 2 * velocity + (power > 0 ? 0.25 * (power + 1) : 0);
  return { velocity, damage, knockback: Math.max(0, Math.min(2, punch)), fireTicks: flame > 0 ? 100 : 0, critical: charge >= 1 };
}

export function crossbowShotProfile({ quickCharge = 0, multishot = 0, piercing = 0, firework = false } = {}) {
  const loadMs = Math.max(250, 1250 - Math.max(0, quickCharge) * 250);
  const count = multishot > 0 && !firework ? 3 : 1;
  return { loadMs, count, piercing: Math.max(0, Math.min(4, piercing)), firework: !!firework };
}

export function tridentShotProfile({ loyalty = 0, channeling = 0, riptide = 0, impaling = 0 } = {}) {
  return { velocity: 2.5, damage: 8 + Math.max(0, impaling) * 2.5, loyalty: Math.max(0, Math.min(3, loyalty)), channeling: !!channeling, riptide: Math.max(0, Math.min(3, riptide)) };
}

export function thornsRetaliation(level, random = Math.random) {
  const n = Math.max(0, Math.min(3, Math.floor(Number(level) || 0)));
  if (!n || random() >= Math.min(1, 0.15 * n)) return 0;
  return Math.floor(1 + random() * 4);
}

export function windBurstImpulse(level, fallDistance) {
  const n = Math.max(0, Math.min(3, Math.floor(Number(level) || 0)));
  const fall = Math.max(0, Number(fallDistance) || 0);
  return n && fall >= 1.5 ? { x: 0, y: 0.6 + n * 0.32 + Math.min(1.5, fall * 0.03), z: 0 } : null;
}

export function frostWalkerRadius(level) { return Math.max(0, Math.min(2, Math.floor(Number(level) || 0))) + 1; }
export function respirationAirBonus(level) { return Math.max(0, Math.min(3, Math.floor(Number(level) || 0))) * 15; }
export function sweepingDamage(level, baseDamage) { const n = Math.max(0, Math.min(3, Math.floor(Number(level) || 0))); return n ? Math.max(0, Number(baseDamage) || 0) * (1 - 1 / (1 + n)) : 0; }
export function breachArmorMultiplier(level) { return 1 - Math.min(0.8, Math.max(0, Math.min(4, Number(level) || 0)) * 0.15); }
export function mendingRepairFromXp(xp, damage) { return Math.min(Math.max(0, Math.floor(damage)), Math.max(0, Math.floor(xp / 2))); }

function xorshift32(seed) { let x = seed || 0x6d2b79f5; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }
