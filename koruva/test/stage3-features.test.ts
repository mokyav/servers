import test from "node:test";
import assert from "node:assert/strict";
import {
  BLOCKS,
  MINECRAFT_BLOCK_TO_ID,
  MINECRAFT_ITEM_TO_RUNTIME_ID,
  POTION_VARIANT_ITEM_IDS,
  blockPlacementId,
  blockStateVariantId,
  blockOccupiesSubcell,
  resolveBlockStateChanges,
} from "../shared/blocks.ts";
import {
  damageItemDurability,
  itemDurabilityForId,
  efficiencyMultiplier,
  sharpnessBonus,
  enchantmentProtection,
  normalizeItemEnchantments,
} from "../shared/item-mechanics.js";
import { potionSpecForItemId, POTION_VARIANTS, potionSplashLanding } from "../shared/potions.js";
import { craftRecipeFitsGrid, createCraftRecipes, craftFromGrid } from "../shared/gameplay.js";

test("stairs expose separate straight, top, inner and outer block states with matching collision cells", () => {
  const id = MINECRAFT_BLOCK_TO_ID["minecraft:oak_stairs"];
  const top = blockStateVariantId(id, { half: "top" });
  const inner = blockStateVariantId(id, { shape: "inner_left" });
  const outer = blockStateVariantId(id, { shape: "outer_right" });
  assert.notEqual(top, id);
  assert.notEqual(inner, id);
  assert.notEqual(outer, id);
  assert.equal(BLOCKS[top].state.half, "top");
  assert.equal(BLOCKS[inner].state.shape, "inner_left");
  assert.equal(BLOCKS[outer].state.shape, "outer_right");
  assert.equal(blockOccupiesSubcell(id, 1, 0, 1), true);
  assert.notEqual(blockOccupiesSubcell(id, 1, 3, 1), blockOccupiesSubcell(id, 1, 3, 3));
});

test("slab upper/lower collision differs and doors retain synchronized open/closed states", () => {
  const slab = MINECRAFT_BLOCK_TO_ID["minecraft:oak_slab"];
  const topSlab = blockStateVariantId(slab, { type: "top" });
  assert.equal(blockOccupiesSubcell(slab, 1, 0, 1), true);
  assert.equal(blockOccupiesSubcell(topSlab, 1, 0, 1), false);
  assert.equal(blockOccupiesSubcell(topSlab, 1, 3, 1), true);
  const door = MINECRAFT_BLOCK_TO_ID["minecraft:oak_door"];
  const placedLower = blockPlacementId(door, 0, "bottom");
  const placedUpper = blockStateVariantId(placedLower, { half: "upper" });
  const open = blockStateVariantId(placedLower, { open: true });
  assert.notEqual(placedLower, door);
  assert.equal(BLOCKS[placedLower].state.half, "lower");
  assert.equal(BLOCKS[placedUpper].state.half, "upper");
  assert.notEqual(open, placedLower);
  assert.equal(BLOCKS[open].state.open, true);
  assert.equal(BLOCKS[open].state.half, "lower");
});

test("fence and pane connection masks recalculate after a neighboring solid block is placed", () => {
  const fence = MINECRAFT_BLOCK_TO_ID["minecraft:oak_fence"];
  const stone = MINECRAFT_BLOCK_TO_ID["minecraft:stone"];
  const get = (x, y, z) => x === 0 && y === 0 && z === 0 ? fence : x === 1 && y === 0 && z === 0 ? stone : 0;
  const changes = resolveBlockStateChanges(get, 1, 0, 0);
  const update = changes.find(change => change.x === 0 && change.y === 0 && change.z === 0);
  assert.ok(update);
  assert.equal(BLOCKS[update.id].state.connections & 2, 2);
  const gateItem = MINECRAFT_BLOCK_TO_ID["minecraft:oak_fence_gate"];
  const placedGate = blockPlacementId(gateItem, 0);
  assert.equal(BLOCKS[placedGate].shape, "door");
  assert.ok(BLOCKS[placedGate].key.includes("_fence_gate"));
  assert.equal(BLOCKS[placedGate].state.facing, "south");
  const gate = blockStateVariantId(placedGate, { open: true, in_wall: true });
  assert.equal(BLOCKS[gate].state.open, true);
  assert.equal(BLOCKS[gate].state.in_wall, true);
});

test("tools and armor have durability; Unbreaking reduces wear and enchantments affect combat values", () => {
  const pickaxe = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:iron_pickaxe"];
  const helmet = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:iron_helmet"];
  assert.equal(itemDurabilityForId(pickaxe, BLOCKS), 250);
  assert.equal(itemDurabilityForId(helmet, BLOCKS), 165);
  assert.deepEqual(damageItemDurability(pickaxe, 250, BLOCKS, {}, () => 0).durability, 249);
  assert.equal(damageItemDurability(pickaxe, 250, BLOCKS, { unbreaking: 3 }, () => 0.9).damaged, false);
  assert.equal(efficiencyMultiplier(3), 10);
  assert.equal(sharpnessBonus(5), 3);
  assert.equal(enchantmentProtection({ protection: 4 }), 0.16);
  const clean = normalizeItemEnchantments({ [pickaxe]: { efficiency: 5, bad: 20, sharpness: 99 } }, BLOCKS);
  assert.deepEqual({ ...clean[pickaxe] }, { efficiency: 5 });
});

test("splash potions are catalogued separately and have a deterministic landing point", () => {
  assert.ok(POTION_VARIANTS.some(item => item.token === "splash_potion_swiftness" && item.delivery === "splash"));
  const id = POTION_VARIANT_ITEM_IDS.splash_potion_swiftness;
  assert.equal(potionSpecForItemId(id, BLOCKS).delivery, "splash");
  const landing = potionSplashLanding([0, 2, 0], [0, 0, 1], (x, y, z) => y <= 0);
  assert.ok(landing[2] > 0);
  assert.ok(landing[1] >= 0);
});

test("crafting-table recipes are 3x3-only; inventory recipes fit in the 2x2 grid", () => {
  const recipes = createCraftRecipes({});
  const table = recipes.find(recipe => recipe.id.includes("crafting_table_from_oak_planks"));
  assert.ok(table);
  assert.equal(craftRecipeFitsGrid(table, 2, 2), true);
  const pickaxe = recipes.find(recipe => recipe.id === "minecraft:iron_pickaxe");
  if (pickaxe) {
    assert.equal(craftRecipeFitsGrid(pickaxe, 2, 2), false);
    const counts = Array(BLOCKS.length).fill(0);
    const grid = Array(9).fill(0);
    const crafted = craftFromGrid(counts, pickaxe.id, grid, recipes, { creative: true });
    assert.equal(crafted.ok, false);
  }
});
