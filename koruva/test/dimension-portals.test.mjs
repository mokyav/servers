import test from "node:test";
import assert from "node:assert/strict";
import { DIMENSION_IDS } from "../shared/dimensions.js";
import { findPortalAt, portalTargetForBlock } from "../shared/dimension-portals.js";

const ids = { netherPortal: 909, endPortal: 567 };

test("Nether portals route between the Overworld and Nether only", () => {
  assert.equal(portalTargetForBlock(909, DIMENSION_IDS.OVERWORLD, ids), DIMENSION_IDS.NETHER);
  assert.equal(portalTargetForBlock(909, DIMENSION_IDS.NETHER, ids), DIMENSION_IDS.OVERWORLD);
  assert.equal(portalTargetForBlock(909, DIMENSION_IDS.END, ids), null);
});

test("End portals route between the Overworld and End", () => {
  assert.equal(portalTargetForBlock(567, DIMENSION_IDS.OVERWORLD, ids), DIMENSION_IDS.END);
  assert.equal(portalTargetForBlock(567, DIMENSION_IDS.END, ids), DIMENSION_IDS.OVERWORLD);
  assert.equal(portalTargetForBlock(567, DIMENSION_IDS.NETHER, ids), null);
});

test("portal contact checks nearby feet/body cells and ignores non-portals", () => {
  const world = { get: (x, y, z) => x === 1 && y === 12 && z === 0 ? 909 : 0 };
  assert.equal(findPortalAt(world, { x: 0.4, y: 10.2, z: 0.1 }, DIMENSION_IDS.OVERWORLD, ids), DIMENSION_IDS.NETHER);
  assert.equal(findPortalAt({ get: () => 0 }, { x: 0, y: 10, z: 0 }, DIMENSION_IDS.OVERWORLD, ids), null);
});

test("unknown block IDs do not activate travel", () => {
  assert.equal(portalTargetForBlock(99999, DIMENSION_IDS.OVERWORLD, ids), null);
  assert.equal(portalTargetForBlock("909", DIMENSION_IDS.OVERWORLD, ids), null);
});
