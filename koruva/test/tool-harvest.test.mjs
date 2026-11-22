import test from "node:test";
import assert from "node:assert/strict";
import { MINECRAFT_ITEM_TO_RUNTIME_ID } from "../shared/minecraft-item-runtime.js";
import { canHarvestBlock, getBlockDrop } from "../shared/gameplay.js";

const B = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, LEAVES: 5, WATER: 6, BEDROCK: 7,
  GRAVEL: 8, COAL_ORE: 9, IRON_ORE: 10, GOLD_ORE: 11, ORE: 12, LAVA: 13, OBSIDIAN: 14 };
const ids = { wooden: 1000, stone: 1001, iron: 1002, diamond: 1003, netherite: 1004 };
const blocks = [];
for (const [id, key] of [[B.STONE,"stone"],[B.COBBLE,"cobble"],[B.LEAVES,"leaves"],[B.WATER,"water"],
  [B.GRAVEL,"gravel"],[B.COAL_ORE,"coal_ore"],[B.IRON_ORE,"iron_ore"],[B.GOLD_ORE,"gold_ore"],[B.ORE,"ore"],[B.OBSIDIAN,"obsidian"]])
  blocks[id] = { key: `minecraft:${key}`, itemId: id };
for (const [tier, id] of Object.entries(ids)) blocks[id] = { key: `minecraft:${tier === "wooden" ? "wooden" : tier}_pickaxe` };
const item = key => MINECRAFT_ITEM_TO_RUNTIME_ID[`minecraft:${key}`] || 0;
const blockItemId = id => id + 500;

test("harvest rules require a pickaxe and progressively stronger tiers", () => {
  assert.equal(canHarvestBlock(B.STONE, 0, B, blocks), false);
  assert.equal(canHarvestBlock(B.STONE, ids.wooden, B, blocks), true);
  assert.equal(canHarvestBlock(B.COAL_ORE, ids.wooden, B, blocks), true);
  assert.equal(canHarvestBlock(B.IRON_ORE, ids.wooden, B, blocks), false);
  assert.equal(canHarvestBlock(B.IRON_ORE, ids.stone, B, blocks), true);
  assert.equal(canHarvestBlock(B.GOLD_ORE, ids.stone, B, blocks), false);
  assert.equal(canHarvestBlock(B.GOLD_ORE, ids.iron, B, blocks), true);
  assert.equal(canHarvestBlock(B.OBSIDIAN, ids.iron, B, blocks), false);
  assert.equal(canHarvestBlock(B.OBSIDIAN, ids.diamond, B, blocks), true);
});

test("survival drops return resources only when the held pickaxe can harvest", () => {
  assert.equal(getBlockDrop(B.COAL_ORE, B, blockItemId, ids.wooden, blocks), item("coal"));
  assert.equal(getBlockDrop(B.IRON_ORE, B, blockItemId, ids.wooden, blocks), 0);
  assert.equal(getBlockDrop(B.IRON_ORE, B, blockItemId, ids.stone, blocks), item("raw_iron"));
  assert.equal(getBlockDrop(B.GOLD_ORE, B, blockItemId, ids.iron, blocks), item("raw_gold"));
  assert.equal(getBlockDrop(B.STONE, B, blockItemId, 0, blocks), 0);
  assert.equal(getBlockDrop(B.STONE, B, blockItemId, ids.wooden, blocks), blockItemId(B.COBBLE));
});

test("special block drops and gravel chance are deterministic in tests", () => {
  assert.equal(getBlockDrop(B.GRAVEL, B, blockItemId, 0, blocks, () => 0.05), item("flint"));
  assert.equal(getBlockDrop(B.GRAVEL, B, blockItemId, 0, blocks, () => 0.5), blockItemId(B.GRAVEL));
  assert.equal(getBlockDrop(B.LEAVES, B, blockItemId, ids.wooden, blocks), 0);
  assert.equal(getBlockDrop(B.WATER, B, blockItemId, 0, blocks), 0);
});

test("legacy three-argument drop calls remain backward compatible", () => {
  assert.equal(getBlockDrop(B.STONE, B, blockItemId), blockItemId(B.COBBLE));
  assert.equal(getBlockDrop(B.GRASS, B, blockItemId), blockItemId(B.DIRT));
});
