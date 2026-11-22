import test from "node:test";
import assert from "node:assert/strict";
import { maxStackSizeForItemKey, mergeStackAmounts, splitStackInHalf } from "../shared/inventory-stacks.js";

test("stack limits follow common Java item categories", () => {
  assert.equal(maxStackSizeForItemKey("minecraft:diamond_pickaxe"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:shield"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:potion"), 1);
  assert.equal(maxStackSizeForItemKey("koruva:potion_swiftness"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:ender_pearl"), 16);
  assert.equal(maxStackSizeForItemKey("minecraft:bucket"), 16);
  assert.equal(maxStackSizeForItemKey("minecraft:water_bucket"), 1);
  // Java boats/rafts and all minecart variants are non-stackable.
  assert.equal(maxStackSizeForItemKey("minecraft:oak_boat"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:oak_chest_boat"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:bamboo_raft"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:bamboo_chest_raft"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:minecart"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:hopper_minecart"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:tnt_minecart"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:command_block_minecart"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:oak_planks"), 64);
});

test("right-click splitting picks the rounded-up half", () => {
  assert.deepEqual(splitStackInHalf(64), { taken: 32, remaining: 32 });
  assert.deepEqual(splitStackInHalf(5), { taken: 3, remaining: 2 });
  assert.deepEqual(splitStackInHalf(1), { taken: 1, remaining: 0 });
  assert.deepEqual(splitStackInHalf(0), { taken: 0, remaining: 0 });
});

test("stack merging never crosses the item limit or loses the remainder", () => {
  assert.deepEqual(mergeStackAmounts(48, 20, 64), { moved: 16, total: 64, remaining: 4 });
  assert.deepEqual(mergeStackAmounts(64, 3, 64), { moved: 0, total: 64, remaining: 3 });
  assert.deepEqual(mergeStackAmounts(0, 5, 1), { moved: 1, total: 1, remaining: 4 });
});
