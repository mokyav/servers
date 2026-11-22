import { isDimensionId } from "./dimensions.js";

/** Normalize untrusted persisted room location data. */
export function normalizePlayerLocation(value) {
  if (!value || typeof value !== "object" || value.version !== 1) return null;
  if (!isDimensionId(value.dimensionId)) return null;
  const p = value.p, r = value.r;
  if (!Array.isArray(p) || p.length !== 3 || !p.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  if (!Array.isArray(r) || r.length !== 2 || !r.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return { version: 1, dimensionId: value.dimensionId, p: [...p], r: [...r] };
}
