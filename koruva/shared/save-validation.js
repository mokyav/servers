/** Structural validation for persisted solo-world records. It intentionally preserves legacy v1 fields. */
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const finite = (v) => typeof v === "number" && Number.isFinite(v);
const finiteVector3 = (v) => Array.isArray(v) && v.length === 3 && v.every(finite);
const integerArray = (v, maxLength = 5_000_000) => Array.isArray(v) && v.length <= maxLength && v.every(Number.isSafeInteger);
const editList = (v) => integerArray(v) && v.length % 4 === 0;
const SLOT_KEY = /^(hotbar:[0-8]|main:(?:[0-9]|1[0-9]|2[0-6])|armor:[0-3]|offhand:0|cursor:0|craft:[0-3]|craft-table:[0-8])$/;
const validStackData = (raw) => {
  if (!isObject(raw) || Object.keys(raw).length > 64) return false;
  for (const [slot, record] of Object.entries(raw)) {
    if (!SLOT_KEY.test(slot) || !isObject(record) || !Number.isSafeInteger(record.itemId) || record.itemId <= 0 || record.itemId >= 100_000 ||
        !Number.isSafeInteger(record.count) || record.count <= 0 || record.count > 99) return false;
    if (record.damage !== undefined && (!Number.isSafeInteger(record.damage) || record.damage < 0 || record.damage > 10_000_000)) return false;
    if (record.repairCost !== undefined && (!Number.isSafeInteger(record.repairCost) || record.repairCost < 0 || record.repairCost > 127)) return false;
    if (record.stackId !== undefined && (typeof record.stackId !== "string" || !/^[a-zA-Z0-9_-]{8,64}$/.test(record.stackId))) return false;
    if (record.customName !== undefined && (typeof record.customName !== "string" || record.customName.length > 50)) return false;
    if (record.enchantments !== undefined) {
      if (!isObject(record.enchantments) || Object.keys(record.enchantments).length > 64) return false;
      for (const level of Object.values(record.enchantments)) if (!Number.isSafeInteger(level) || level < 1 || level > 10) return false;
    }
    if (record.chargedProjectiles !== undefined && (!Array.isArray(record.chargedProjectiles) || record.chargedProjectiles.length > 3 || record.chargedProjectiles.some((id) => !Number.isSafeInteger(id) || id <= 0 || id >= 100_000))) return false;
  }
  return true;
};

export function isValidSoloSave(value) {
  if (!isObject(value) || value.v !== 1 || !finite(value.seed) || !editList(value.edits) ||
      !finite(value.time) || !finite(value.savedAt) || !isObject(value.player)) return false;
  const p = value.player;
  if (!finiteVector3(p.pos) || !finite(p.yaw) || !finite(p.pitch) ||
      !integerArray(p.hotbar, 64) || !Number.isInteger(p.sel) || p.sel < 0 || p.sel > 8) return false;
  if (p.counts !== undefined && (!integerArray(p.counts) || p.counts.some((n) => n < 0))) return false;
  if (p.cursorItem !== undefined && (!Number.isSafeInteger(p.cursorItem) || p.cursorItem < 0 || p.cursorItem >= 100_000)) return false;
  if (p.cursorCount !== undefined && (!Number.isSafeInteger(p.cursorCount) || p.cursorCount < 0 || p.cursorCount > 64)) return false;
  if ((p.cursorItem ?? 0) === 0 && (p.cursorCount ?? 0) !== 0) return false;
  if ((p.cursorItem ?? 0) > 0 && (p.cursorCount ?? 0) <= 0) return false;
  if (p.stackData !== undefined && !validStackData(p.stackData)) return false;
  if (p.health !== undefined && !finite(p.health)) return false;
  if (p.hunger !== undefined && !finite(p.hunger)) return false;
  if (value.worldgenVersion !== undefined && (!Number.isInteger(value.worldgenVersion) || value.worldgenVersion < 1)) return false;
  if (value.dimensionId !== undefined && typeof value.dimensionId !== "string") return false;
  if (value.spawn !== undefined && !finiteVector3(value.spawn)) return false;
  if (value.dimensionEdits !== undefined) {
    if (!isObject(value.dimensionEdits)) return false;
    for (const edits of Object.values(value.dimensionEdits)) if (!editList(edits)) return false;
  }
  return true;
}
