import test from "node:test";
import assert from "node:assert/strict";
import { buildDeathDropStacks } from "../shared/death-drops.js";
import { normalizeSavedDrops } from "../shared/drop-store.js";

test("death drops preserve inventory and equipped armor as capped stacks", () => {
  assert.deepEqual(buildDeathDropStacks([0, 3, 64, 64, 65, 7], [1, 4, 4, 99], 6), [
    { itemId: 1, count: 4 }, { itemId: 2, count: 64 }, { itemId: 3, count: 64 },
    { itemId: 4, count: 64 }, { itemId: 4, count: 3 }, { itemId: 5, count: 7 },
  ]);
});

test("death drops split tools and vehicles into one-item stacks", () => {
  const stacks = buildDeathDropStacks([0, 0, 3, 0, 0], [], 5, 64, (id) => id === 2 ? 1 : 64);
  assert.deepEqual(stacks, [
    { itemId: 2, count: 1 }, { itemId: 2, count: 1 }, { itemId: 2, count: 1 },
  ]);
});

test("death-drop construction rejects invalid IDs and malformed counts", () => {
  assert.deepEqual(buildDeathDropStacks([0, 2.5, -1, 4], [NaN, 0], 4), [{ itemId: 3, count: 4 }]);
});

test("saved direct item drops preserve amount while legacy block drops remain compatible", () => {
  const now = 1_000_000;
  const raw = [
    { eid: "legacy", x: 1, y: 2, z: 3, b: 1, at: now },
    { eid: "stack", x: 4, y: 5, z: 6, itemId: 12, count: 17, at: now },
    { eid: "single", x: 7, y: 8, z: 9, itemId: 13, at: now },
    { eid: "bad-count", x: 0, y: 0, z: 0, itemId: 12, count: 65, at: now },
  ];
  const saved = normalizeSavedDrops(raw, { now, isValidItem: (id) => id === 1, isValidInventoryItem: (id) => id === 12 || id === 13 });
  assert.deepEqual(saved.map(({ eid, b, itemId, count }) => ({ eid, b, itemId, count })), [
    { eid: "legacy", b: 1, itemId: undefined, count: 1 },
    { eid: "stack", b: undefined, itemId: 12, count: 17 },
    { eid: "single", b: undefined, itemId: 13, count: 1 },
  ]);
});
