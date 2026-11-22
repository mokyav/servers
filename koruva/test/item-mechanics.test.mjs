import test from "node:test";
import assert from "node:assert/strict";
import {
  armorSlotForItemId, normalizeArmorSlots, armorTotals, applyArmorReduction,
  toolKindForItemId, miningSpeedMultiplier, weaponStatsForItemId,
} from "../shared/item-mechanics.js";

const blocks = [
  undefined,
  { key: "minecraft:leather_helmet" },
  { key: "minecraft:iron_chestplate" },
  { key: "minecraft:diamond_leggings" },
  { key: "minecraft:netherite_boots" },
  { key: "minecraft:iron_pickaxe" },
  { key: "minecraft:golden_pickaxe" },
  { key: "minecraft:wooden_axe" },
  { key: "minecraft:diamond_sword" },
  { key: "minecraft:trident" },
  { key: "minecraft:oak_log" },
  { key: "minecraft:stone" },
  { key: "minecraft:diamond_helmet" },
  { key: "minecraft:golden_hoe" },
  { key: "minecraft:golden_axe" },
];

test("armor equipment accepts only the matching armor slot", () => {
  assert.equal(armorSlotForItemId(1, blocks), 0);
  assert.equal(armorSlotForItemId(2, blocks), 1);
  assert.equal(armorSlotForItemId(3, blocks), 2);
  assert.equal(armorSlotForItemId(4, blocks), 3);
  assert.deepEqual(normalizeArmorSlots([2, 1, 3, 4], blocks, [], true), [0, 0, 3, 4]);
  assert.deepEqual(normalizeArmorSlots([1, 2, 3, 4], blocks, [0, 1, 1, 1, 0], false), [1, 2, 3, 0]);
});

test("armor points and toughness mitigate damage using Java-style armor formula", () => {
  const slots = [1, 2, 3, 4];
  const totals = armorTotals(slots, blocks);
  assert.equal(totals.armor, 1 + 6 + 6 + 3);
  assert.equal(totals.toughness, 6);
  assert.ok(applyArmorReduction(10, slots, blocks) < 10);
  assert.equal(applyArmorReduction(10, [], blocks), 10);
});

test("tool classes and material tiers affect mining speed only for matching blocks", () => {
  assert.equal(toolKindForItemId(5, blocks), "pickaxe");
  assert.equal(miningSpeedMultiplier(11, 5, blocks), 6);
  assert.equal(miningSpeedMultiplier(10, 5, blocks), 1);
  assert.equal(miningSpeedMultiplier(11, 6, blocks), 12);
  assert.equal(miningSpeedMultiplier(10, 7, blocks), 2);
});

test("weapon stats use material damage and weapon kind", () => {
  assert.deepEqual(weaponStatsForItemId(8, blocks), { kind: "sword", damage: 7 });
  assert.deepEqual(weaponStatsForItemId(9, blocks), { kind: "trident", damage: 9 });
  assert.deepEqual(weaponStatsForItemId(0, blocks), { kind: "fist", damage: 1 });
  assert.deepEqual(weaponStatsForItemId(13, blocks), { kind: "golden_hoe", damage: 1 });
  assert.deepEqual(weaponStatsForItemId(14, blocks), { kind: "golden_axe", damage: 7 });
});

test("newer spear, mace and copper axe items are not treated as fists", () => {
  const newer = [
    undefined,
    { key: "minecraft:wooden_spear" },
    { key: "minecraft:diamond_spear" },
    { key: "minecraft:mace" },
    { key: "minecraft:copper_axe" },
  ];
  assert.deepEqual(weaponStatsForItemId(1, newer), { kind: "spear", damage: 5 });
  assert.deepEqual(weaponStatsForItemId(2, newer), { kind: "spear", damage: 8 });
  assert.deepEqual(weaponStatsForItemId(3, newer), { kind: "mace", damage: 6 });
  assert.deepEqual(weaponStatsForItemId(4, newer), { kind: "copper_axe", damage: 8 });
});
