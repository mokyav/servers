import { DIMENSION_IDS, DIMENSIONS, normalizeDimensionId } from "./dimensions.js";

/** Storage prefix for persistent chunk edits; legacy Overworld keys remain unchanged. */
export function dimensionChunkStoragePrefix(dimensionId) {
  const id = normalizeDimensionId(dimensionId);
  return id === DIMENSION_IDS.OVERWORLD ? "c:" : `c:${id}:`;
}

/** Parse a stored key. Legacy c:cx,cz keys are treated as Overworld records. */
export function parseDimensionChunkStorageKey(storageKey) {
  if (typeof storageKey !== "string" || !storageKey.startsWith("c:")) return null;
  const rest = storageKey.slice(2);
  if (/^-?\d+,-?\d+$/.test(rest)) return { dimensionId: DIMENSION_IDS.OVERWORLD, chunkKey: rest };
  for (const id of Object.keys(DIMENSIONS)) {
    if (id === DIMENSION_IDS.OVERWORLD) continue;
    const prefix = `${id}:`;
    if (!rest.startsWith(prefix)) continue;
    const chunkKey = rest.slice(prefix.length);
    if (/^-?\d+,-?\d+$/.test(chunkKey)) return { dimensionId: id, chunkKey };
  }
  return null;
}
