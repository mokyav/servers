import test from "node:test";
import assert from "node:assert/strict";
import { playerCraftGridToRecipeGrid, consumePlayerCraftGrid } from "../shared/inventory-crafting.js";
import { MINECRAFT_ITEM_TO_RUNTIME_ID } from "../shared/minecraft-item-runtime.js";
import { createCraftRecipes, craftFromGrid } from "../shared/gameplay.js";

const oakPlanks = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:oak_planks"];
const recipes = createCraftRecipes({ OAK_PLANKS: oakPlanks });
const inventorySize = Math.max(...Object.values(MINECRAFT_ITEM_TO_RUNTIME_ID)) + 1;

test("player 2×2 grid maps into the matching 3×3 positions", () => {
  assert.deepEqual(playerCraftGridToRecipeGrid([1, 2, 3, 4]), [1, 2, 0, 3, 4, 0, 0, 0, 0]);
  assert.equal(playerCraftGridToRecipeGrid([1, -1, 0, 0]), null);
});

test("one successful craft consumes one item per occupied cell and preserves remaining stacks", () => {
  assert.deepEqual(consumePlayerCraftGrid([10, 11, 12, 0], [3, 1, 2, 0]), {
    items: [10, 0, 12, 0], amounts: [2, 0, 1, 0],
  });
});

test("2×2 grid accepts a matching crafting-table recipe and rejects 3×3-only stair recipes", () => {
  const twoByTwoRecipe = recipes.find((recipe) => recipe.id === "minecraft:crafting_table_from_oak_planks");
  assert.ok(twoByTwoRecipe, "vanilla 2×2 crafting-table recipe exists");
  const grid = playerCraftGridToRecipeGrid([oakPlanks, oakPlanks, oakPlanks, oakPlanks]);
  const counts = Array(inventorySize).fill(0);
  counts[oakPlanks] = 4;
  assert.equal(craftFromGrid(counts, twoByTwoRecipe.id, grid, recipes).ok, true);
  const stairs = recipes.find((recipe) => /oak_stairs/.test(recipe.id));
  assert.ok(stairs);
  const stairGrid = playerCraftGridToRecipeGrid([oakPlanks, 0, oakPlanks, oakPlanks]);
  assert.equal(craftFromGrid(counts, stairs.id, stairGrid, recipes).ok, false);
});

test("crafting enforces the item-specific output stack cap", () => {
  const recipe = recipes.find((item) => item.id === "minecraft:crafting_table_from_oak_planks");
  const craftingTable = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:crafting_table"];
  assert.ok(recipe);
  assert.ok(Number.isInteger(craftingTable) && craftingTable > 0);
  const grid = playerCraftGridToRecipeGrid([oakPlanks, oakPlanks, oakPlanks, oakPlanks]);

  const almostFull = Array(inventorySize).fill(0);
  almostFull[oakPlanks] = 4;
  almostFull[craftingTable] = 63;
  const accepted = craftFromGrid(almostFull, recipe.id, grid, recipes, { maxCount: 64 });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.counts[craftingTable], 64);

  const full = almostFull.slice();
  full[craftingTable] = 64;
  const rejected = craftFromGrid(full, recipe.id, grid, recipes, { maxCount: 64 });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "stack_limit");
  assert.deepEqual(rejected.counts, full);
});

