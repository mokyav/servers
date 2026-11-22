import { DIMENSION_IDS, normalizeDimensionId } from "./dimensions.js";
export function mobDimensionId(mob) { return normalizeDimensionId(mob?.dimensionId ?? DIMENSION_IDS.OVERWORLD); }
export function mobsForDimension(mobs, dimensionId) {
  const wanted = normalizeDimensionId(dimensionId);
  return Array.from(mobs ?? []).filter((mob) => mob && mobDimensionId(mob) === wanted);
}
export function withMobDimension(mob, dimensionId) { return { ...mob, dimensionId: normalizeDimensionId(dimensionId) }; }
export function normalizeSavedMobs(raw, { maxMobs = 100, isValidType = () => true } = {}) {
  if (!Array.isArray(raw)) return [];
  const limit = Number.isFinite(maxMobs) ? Math.max(0, Math.floor(maxMobs)) : 100;
  const result = [], seen = new Set();
  for (const value of raw) {
    if (result.length >= limit) break;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    if (typeof value.id !== "string" || !value.id.trim() || !isValidType(value.type)) continue;
    if (![value.x, value.y, value.z, value.yaw].every(Number.isFinite)) continue;
    if (Math.abs(value.x) > 100000 || Math.abs(value.y) > 100000 || Math.abs(value.z) > 100000 || Math.abs(value.yaw) > 1000000) continue;
    const id = value.id.trim().slice(0, 64);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const normalized = { ...value, id, dimensionId: mobDimensionId(value) };
    const validFlee = Number.isFinite(value.fleeYaw) && Math.abs(value.fleeYaw) <= 1000000
      && Number.isFinite(value.fleeUntil) && value.fleeUntil >= 0 && value.fleeUntil <= Number.MAX_SAFE_INTEGER;
    if (validFlee) { normalized.fleeYaw = value.fleeYaw; normalized.fleeUntil = Math.floor(value.fleeUntil); }
    else { delete normalized.fleeYaw; delete normalized.fleeUntil; }
    result.push(normalized);
  }
  return result;
}
