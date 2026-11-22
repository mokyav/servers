import test from "node:test";
import assert from "node:assert/strict";
import { DIMENSION_IDS } from "../shared/dimensions.js";
import { normalizeDimensionEditList, normalizeDimensionEditRecord, normalizeSavedDimensionState } from "../shared/dimension-state.js";

test("dimension edit records contain only known dimensions and sanitize malformed tuples", () => {
  const state = normalizeDimensionEditRecord({
    [DIMENSION_IDS.OVERWORLD]: [1, 4, 2, 3, 1, 4, 2, 5, 0, 4, 0, 999, 0, 64, 0, 1, "bad", 1, 1, 1],
    "minecraft:custom": [9, 2, 9, 1],
    [DIMENSION_IDS.NETHER]: [-16, 5, 32, 7],
  }, { worldHeight: 64, maxBlockId: 20 });
  assert.deepEqual(Object.keys(state).sort(), Object.values(DIMENSION_IDS).sort());
  assert.deepEqual(state[DIMENSION_IDS.OVERWORLD], [1, 4, 2, 5]); // duplicate coordinate: last edit wins
  assert.deepEqual(state[DIMENSION_IDS.NETHER], [-16, 5, 32, 7]);
  assert.deepEqual(state[DIMENSION_IDS.END], []);
});

test("legacy solo edits migrate to Overworld and unknown dimension IDs normalize safely", () => {
  const legacy = [3, 10, -4, 2];
  const migrated = normalizeSavedDimensionState(null, "invalid:dimension", legacy, { worldHeight: 64, maxBlockId: 10 });
  assert.equal(migrated.dimensionId, DIMENSION_IDS.OVERWORLD);
  assert.deepEqual(migrated.edits[DIMENSION_IDS.OVERWORLD], legacy);
  const current = normalizeSavedDimensionState({ [DIMENSION_IDS.END]: [8, 9, 8, 6] }, DIMENSION_IDS.END, [], { worldHeight: 64, maxBlockId: 10 });
  assert.deepEqual(current.edits[DIMENSION_IDS.END], [8, 9, 8, 6]);
});

test("edit list bounds invalid coordinates, heights, and IDs", () => {
  assert.deepEqual(normalizeDimensionEditList([-524289,1,0,1, 0,64,0,1, 0,2,0,256, 0,2,0,1], { worldHeight:64, maxBlockId:10 }), [0,2,0,1]);
});
