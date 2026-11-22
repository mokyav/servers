import { DIMENSION_IDS, normalizeDimensionId } from "./dimensions.js";

/** Validate saved item drops before exposing them to players. */
export function normalizeSavedDrops(raw, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const ttlMs = Number.isFinite(options.ttlMs) ? Math.max(0, options.ttlMs) : 300_000;
  const maxDrops = Number.isSafeInteger(options.maxDrops) ? Math.max(0, options.maxDrops) : 300;
  const isValidItem = typeof options.isValidItem === "function" ? options.isValidItem : () => true;
  if (!Array.isArray(raw) || maxDrops === 0) return [];

  const seen = new Set();
  const drops = [];
  const isValidInventoryItem = typeof options.isValidInventoryItem === "function" ? options.isValidInventoryItem : isValidItem;
  for (const value of raw) {
    if (!value || typeof value !== "object") continue;
    const { eid, x, y, z, at } = value;
    const dimensionId = normalizeDimensionId(value.dimensionId ?? DIMENSION_IDS.OVERWORLD);
    if (typeof eid !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(eid) || seen.has(eid)) continue;
    if (![x, y, z, at].every(Number.isFinite)) continue;
    if (at <= 0 || now - at > ttlMs || at > now + 60_000) continue;

    // XP orbs are first-class persisted drops. They intentionally have no item ID.
    if (value.xp !== undefined) {
      if (!Number.isSafeInteger(value.xp) || value.xp <= 0 || value.xp > 2_147_483_647) continue;
      if (value.itemId !== undefined || value.b !== undefined || value.count !== undefined) continue;
      seen.add(eid);
      drops.push({ eid, x, y, z, xp: value.xp, at, dimensionId });
      if (drops.length > maxDrops) drops.shift();
      continue;
    }

    const directItem = Number.isSafeInteger(value.itemId);
    const itemId = directItem ? value.itemId : value.b;
    if (value.count !== undefined && (!Number.isSafeInteger(value.count) || value.count < 1 || value.count > 64)) continue;
    const count = value.count ?? 1;
    if (!Number.isSafeInteger(itemId) || itemId <= 0) continue;
    let validItem = false;
    try { validItem = Boolean((directItem ? isValidInventoryItem : isValidItem)(itemId)); } catch { validItem = false; }
    if (!validItem) continue;
    seen.add(eid);
    const drop = directItem
      ? { eid, x, y, z, itemId, count, at, dimensionId }
      : { eid, x, y, z, b: itemId, count, at, dimensionId };
    drops.push(drop);
    if (drops.length > maxDrops) drops.shift();
  }
  return drops;
}

/** Return only drops belonging to one dimension; legacy drops normalize to Overworld. */
export function dropsForDimension(drops, dimensionId) {
  const target = normalizeDimensionId(dimensionId);
  return Array.isArray(drops) ? drops.filter((drop) => drop && normalizeDimensionId(drop.dimensionId ?? DIMENSION_IDS.OVERWORLD) === target) : [];
}
