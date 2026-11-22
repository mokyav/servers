import test from "node:test";
import assert from "node:assert/strict";
import { DIMENSION_IDS } from "../shared/dimensions.js";
import { mobDimensionId, mobsForDimension, normalizeSavedMobs, withMobDimension } from "../shared/mob-dimensions.js";
const pig = { id: "pig-1", type: "pig", x: 1, y: 2, z: 3, yaw: 0 };
test("legacy mobs without dimension are treated as overworld", () => {
  assert.equal(mobDimensionId(pig), DIMENSION_IDS.OVERWORLD);
  assert.deepEqual(mobsForDimension([pig], DIMENSION_IDS.OVERWORLD), [pig]);
  assert.deepEqual(mobsForDimension([pig], DIMENSION_IDS.NETHER), []);
});
test("mob snapshots filter by canonical dimension", () => {
  const nether = withMobDimension({ ...pig, id: "nether-pig" }, DIMENSION_IDS.NETHER);
  const end = withMobDimension({ ...pig, id: "end-pig" }, DIMENSION_IDS.END);
  assert.deepEqual(mobsForDimension([pig, nether, end], DIMENSION_IDS.NETHER), [nether]);
  assert.deepEqual(mobsForDimension([pig, nether, end], DIMENSION_IDS.END), [end]);
});
test("saved mobs migrate legacy dimension and reject malformed or duplicate records", () => {
  const restored = normalizeSavedMobs([pig, { ...pig, id: "n", dimensionId: DIMENSION_IDS.NETHER }, { ...pig, id: "n" }, { ...pig, id: "bad", x: NaN }, null], { maxMobs: 10, isValidType: (type) => type === "pig" });
  assert.equal(restored.length, 2);
  assert.equal(restored[0].dimensionId, DIMENSION_IDS.OVERWORLD);
  assert.equal(restored[1].dimensionId, DIMENSION_IDS.NETHER);
});
test("saved mob cap and type validation are enforced", () => {
  const restored = normalizeSavedMobs([pig, { ...pig, id: "cow", type: "cow" }, { ...pig, id: "pig-2" }], { maxMobs: 1, isValidType: (type) => type === "pig" });
  assert.deepEqual(restored.map((mob) => mob.id), ["pig-1"]);
});

test("saved mob flee state is retained only when finite and bounded", () => {
  const [valid] = normalizeSavedMobs([{ ...pig, fleeYaw: 1.25, fleeUntil: 9000.8 }]);
  assert.equal(valid.fleeYaw, 1.25);
  assert.equal(valid.fleeUntil, 9000);
  const [invalid] = normalizeSavedMobs([{ ...pig, fleeYaw: Infinity, fleeUntil: "later" }]);
  assert.equal("fleeYaw" in invalid, false);
  assert.equal("fleeUntil" in invalid, false);
});
