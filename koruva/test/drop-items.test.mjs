import test from "node:test";
import assert from "node:assert/strict";
import { getDropCount, clampDropCount } from "../shared/item-drop.js";

test("Q drops one item and Ctrl+Q drops the selected stack", () => {
  assert.equal(getDropCount(16, false), 1);
  assert.equal(getDropCount(16, true), 16);
  assert.equal(getDropCount(1, true), 1);
});

test("drop counts reject empty/invalid stacks and clamp to server inventory", () => {
  assert.equal(getDropCount(0), 0);
  assert.equal(getDropCount(-1, true), 0);
  assert.equal(clampDropCount(5, 3), 3);
  assert.equal(clampDropCount(65, 80), 64);
  assert.equal(clampDropCount(0, 8), 0);
  assert.equal(clampDropCount(2, 0), 0);
  assert.equal(clampDropCount(1.5, 8), 0);
});
