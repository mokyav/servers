import { DIMENSIONS, normalizeDimensionId } from "./dimensions.js";

// Local saves are untrusted input. Bound their size and discard malformed tuples rather than
// allowing corrupt coordinates or block IDs to poison chunk indexing.
export const MAX_SAVED_DIMENSION_EDITS = 250_000;
const MIN_BLOCK_COORD = -524_288; // chunk coordinate -32768 at 16 blocks/chunk
const MAX_BLOCK_COORD = 524_287;

export function normalizeDimensionEditList(list, options = {}) {
  const worldHeight = Number.isSafeInteger(options.worldHeight) && options.worldHeight > 1 ? options.worldHeight : 128;
  const maxBlockId = Number.isSafeInteger(options.maxBlockId) && options.maxBlockId >= 0 ? options.maxBlockId : 255;
  const cap = Number.isSafeInteger(options.maxEdits) && options.maxEdits >= 0 ? options.maxEdits : MAX_SAVED_DIMENSION_EDITS;
  if (!Array.isArray(list) || cap === 0) return [];
  const result = new Map();
  const tupleLimit = Math.min(list.length - (list.length % 4), cap * 4);
  for (let i = 0; i + 3 < tupleLimit; i += 4) {
    const x = list[i], y = list[i + 1], z = list[i + 2], blockId = list[i + 3];
    if (![x, y, z, blockId].every(Number.isSafeInteger)) continue;
    if (x < MIN_BLOCK_COORD || x > MAX_BLOCK_COORD || z < MIN_BLOCK_COORD || z > MAX_BLOCK_COORD) continue;
    if (y < 1 || y >= worldHeight || blockId < 0 || blockId > maxBlockId) continue;
    const key = `${x},${y},${z}`;
    if (!result.has(key) && result.size >= cap) continue;
    result.set(key, [x, y, z, blockId]);
  }
  return [...result.values()].flat();
}

export function normalizeDimensionEditRecord(record, options = {}) {
  const out = Object.create(null);
  let remaining = Number.isSafeInteger(options.maxEdits) && options.maxEdits >= 0
    ? options.maxEdits : MAX_SAVED_DIMENSION_EDITS;
  for (const id of Object.keys(DIMENSIONS)) {
    const list = normalizeDimensionEditList(record && typeof record === "object" ? record[id] : null, { ...options, maxEdits: remaining });
    out[id] = list;
    remaining = Math.max(0, remaining - list.length / 4);
  }
  return out;
}

export function normalizeSavedDimensionState(record, dimensionId, legacyEdits, options = {}) {
  const id = normalizeDimensionId(dimensionId);
  const edits = normalizeDimensionEditRecord(record, options);
  const rawCurrent = record && typeof record === "object" ? record[id] : null;
  const cleanLegacy = normalizeDimensionEditList(legacyEdits, options);
  // Old v1 saves only have `edits`; retain them when the new per-dimension field is absent
  // or unusable, while preferring a valid current-dimension list in new saves.
  if (!Array.isArray(rawCurrent) || (edits[id].length === 0 && cleanLegacy.length > 0)) edits[id] = cleanLegacy;
  return { dimensionId: id, edits };
}
