import test from "node:test";
import assert from "node:assert/strict";
import {
  inventoryStorageCapacity, maxInventoryCountForItemKey, maxStackSizeForItemKey,
  mergeStackAmounts, splitStackInHalf, stackComponentsEqual,
} from "../shared/inventory-stacks.js";

test("stack limits match common Java inventory item categories", () => {
  assert.equal(maxStackSizeForItemKey("minecraft:diamond_pickaxe"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:wooden_spear"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:enchanted_book"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:shield"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:potion"), 1);
  assert.equal(maxStackSizeForItemKey("koruva:potion_swiftness"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:ender_pearl"), 16);
  assert.equal(maxStackSizeForItemKey("minecraft:bucket"), 16);
  assert.equal(maxStackSizeForItemKey("minecraft:water_bucket"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:oak_boat"), 1);
  assert.equal(maxStackSizeForItemKey("minecraft:oak_sign"), 16);
  assert.equal(maxStackSizeForItemKey("minecraft:oak_planks"), 64);
});

test("aggregate count limits cover all inventory UI slots, not one stack", () => {
  assert.equal(maxInventoryCountForItemKey("minecraft:oak_planks"), 55 * 64);
  assert.equal(maxInventoryCountForItemKey("minecraft:diamond_pickaxe"), 55);
  assert.equal(maxInventoryCountForItemKey("minecraft:oak_planks", 36), 36 * 64);
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

test("stack component equality allows plain stacks but separates distinct item data", () => {
  assert.equal(stackComponentsEqual(null, { itemId: 1, count: 12 }), true);
  assert.equal(stackComponentsEqual(
    { enchantments: { efficiency: 3, unbreaking: 2 }, damage: 10 },
    { enchantments: { unbreaking: 2, efficiency: 3 }, damage: 10, count: 1 },
  ), true);
  assert.equal(stackComponentsEqual({ customName: "Named" }, null), false);
  assert.equal(stackComponentsEqual({ damage: 3 }, { damage: 4 }), false);
});

test("storage capacity counts empty slots and only merges compatible stacks", () => {
  const blocks = [null, { key: "minecraft:oak_planks" }, { key: "minecraft:diamond_pickaxe" }, { key: "minecraft:enchanted_book" }];
  assert.equal(inventoryStorageCapacity({}, 1, blocks, 0), 36 * 64);
  assert.equal(inventoryStorageCapacity({ "hotbar:0": { itemId: 1, count: 32 } }, 1, blocks, 32), 35 * 64 + 32);
  assert.equal(inventoryStorageCapacity({ "hotbar:0": { itemId: 1, count: 32, customName: "Named" } }, 1, blocks, 32), 35 * 64);
  assert.equal(inventoryStorageCapacity({ "hotbar:0": { itemId: 2, count: 1 } }, 1, blocks, 0), 35 * 64);
  assert.equal(inventoryStorageCapacity({ "hotbar:0": { itemId: 3, count: 1 } }, 3, blocks, 1), 35);
});

test("legacy aggregate counts reserve storage slots when slot data is missing", () => {
  const blocks = [null, { key: "minecraft:oak_planks" }];
  assert.equal(inventoryStorageCapacity({}, 1, blocks, 64), 35 * 64);
  assert.equal(inventoryStorageCapacity({}, 1, blocks, 65), 34 * 64 + 63);
});
