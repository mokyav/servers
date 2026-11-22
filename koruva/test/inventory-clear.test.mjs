import test from "node:test";
import assert from "node:assert/strict";
import { clearInventoryState } from "../shared/inventory-clear.js";
test("full clear zeros every block and food count without mutating source state", () => {
  const counts = [0, 3, 64, 2], foodCounts = { apple: 2, bread: 7 };
  const cleared = clearInventoryState(counts, foodCounts, null, ["apple", "bread", "carrot"]);
  assert.deepEqual(cleared, { counts: [0, 0, 0, 0], foodCounts: { apple: 0, bread: 0, carrot: 0 } });
  assert.deepEqual(counts, [0, 3, 64, 2]);
  assert.deepEqual(foodCounts, { apple: 2, bread: 7 });
});
test("invalid inventory state is rejected", () => {
  assert.equal(clearInventoryState(null, {}, null, []), null);
  assert.equal(clearInventoryState([], [], null, []), null);
});
