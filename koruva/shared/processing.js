import { MINECRAFT_26_3_PROCESSING_RECIPES } from "./minecraft-26.3-recipe-catalog.js";
import { MINECRAFT_ITEM_TO_RUNTIME_ID as globalItemIds } from "./minecraft-item-runtime.js";
import { MINECRAFT_BLOCK_LEGACY_RUNTIME_ID_END, MINECRAFT_BLOCK_STATE_RUNTIME_ID_END } from "./minecraft-block-runtime.js";

// The extracted recipe catalogue uses the pre-blockstate item-only ID range.
// Shift only IDs above the legacy block range into the current, non-overlapping runtime range.
const LEGACY_ITEM_ID_OFFSET = MINECRAFT_BLOCK_STATE_RUNTIME_ID_END - MINECRAFT_BLOCK_LEGACY_RUNTIME_ID_END;
const remapLegacyId = (id) => Number.isSafeInteger(id) && id > MINECRAFT_BLOCK_LEGACY_RUNTIME_ID_END
  ? id + LEGACY_ITEM_ID_OFFSET
  : id;
export const PROCESSING_RECIPES = Object.freeze(MINECRAFT_26_3_PROCESSING_RECIPES.map((recipe) => Object.freeze({
  ...recipe,
  inputs: Object.freeze((recipe.inputs || []).map((choices) => Object.freeze(choices.map(remapLegacyId)))),
  output: Object.freeze({ ...recipe.output, itemId: remapLegacyId(recipe.output?.itemId) }),
})));

const STATION_RECIPE_TYPES = Object.freeze({
  furnace: ["smelting"],
  blast_furnace: ["blasting"],
  smoker: ["smoking"],
  campfire: ["campfire_cooking"],
  stonecutter: ["stonecutting"],
  smithing_table: ["smithing_transform", "smithing_trim"],
});

export function processingRecipeFor(station, inputItemId) {
  const allowed = STATION_RECIPE_TYPES[station];
  if (!allowed || !Number.isSafeInteger(inputItemId) || inputItemId <= 0) return null;
  return PROCESSING_RECIPES.find((recipe) => allowed.includes(recipe.type)
    && Array.isArray(recipe.inputs?.[0]) && recipe.inputs[0].includes(inputItemId)) ?? null;
}

export function smithingRecipeFor(templateItemId, baseItemId, additionItemId) {
  return PROCESSING_RECIPES.find((recipe) => recipe.type === "smithing_transform"
    && recipe.inputs.length === 3
    && recipe.inputs[0].includes(templateItemId)
    && recipe.inputs[1].includes(baseItemId)
    && recipe.inputs[2].includes(additionItemId)) ?? null;
}

const ITEM_NAME_BY_ID = new Map(Object.entries(globalItemIds).map(([name, id]) => [id, name]));

/** Vanilla-style furnace fuel duration in game ticks (20 ticks = 1 second). */
export function fuelBurnTicks(itemId) {
  if (!Number.isSafeInteger(itemId) || itemId <= 0) return 0;
  const name = ITEM_NAME_BY_ID.get(itemId);
  if (!name) return 0;
  if (name === "minecraft:lava_bucket") return 20000;
  if (name === "minecraft:coal_block") return 16000;
  if (name === "minecraft:dried_kelp_block") return 4000;
  if (name === "minecraft:blaze_rod") return 2400;
  if (name === "minecraft:coal" || name === "minecraft:charcoal") return 1600;
  if (name.endsWith("_boat") || name.endsWith("_chest_boat") || name.endsWith("_raft") || name.endsWith("_chest_raft")) return 1200;
  if (name === "minecraft:scaffolding" || name === "minecraft:bamboo") return 50;
  if (name === "minecraft:stick" || name.endsWith("_sapling") || name === "minecraft:sapling"
      || name === "minecraft:bowl" || name === "minecraft:dead_bush" || name === "minecraft:azalea"
      || name === "minecraft:flowering_azalea"
      || /minecraft:(?:oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|pale_oak|bamboo|crimson|warped|poplar)_button$/.test(name)) return 100;
  if (name === "minecraft:bow" || name === "minecraft:crossbow" || name === "minecraft:fishing_rod") return 300;
  if (/minecraft:(?:oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|pale_oak|bamboo|crimson|warped|poplar)_(?:door|sign|hanging_sign|sword|pickaxe|axe|shovel|hoe)$/.test(name)) return 200;
  const woodPrefixes = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak", "bamboo", "crimson", "warped", "poplar"];
  const woodFamily = woodPrefixes.some((prefix) => name.startsWith(`minecraft:${prefix}_`));
  if (woodFamily && (name.endsWith("_planks") || name.endsWith("_log") || name.endsWith("_wood")
      || name.endsWith("_stem") || name.endsWith("_hyphae") || name.endsWith("_stripped_log")
      || name.endsWith("_stripped_wood") || name.endsWith("_stripped_stem") || name.endsWith("_stripped_hyphae")
      || name.endsWith("_stairs") || name.endsWith("_fence") || name.endsWith("_fence_gate")
      || name.endsWith("_trapdoor") || name.endsWith("_pressure_plate") || name.endsWith("_chest")
      || name.endsWith("_bookshelf") || name.endsWith("_shelf") || name.endsWith("_barrel")
      || name.endsWith("_crafting_table") || name.endsWith("_banner") || name.endsWith("_ladder"))) return 300;
  if (woodFamily && name.endsWith("_slab")) return 150;
  if (["minecraft:chest", "minecraft:trapped_chest", "minecraft:crafting_table", "minecraft:bookshelf",
      "minecraft:bookshelf", "minecraft:lectern", "minecraft:cartography_table", "minecraft:fletching_table",
      "minecraft:smithing_table", "minecraft:loom", "minecraft:composter", "minecraft:barrel",
      "minecraft:note_block", "minecraft:jukebox", "minecraft:daylight_detector", "minecraft:target"].includes(name)) return 300;
  if (name.endsWith("_wool")) return 100;
  if (name.endsWith("_carpet")) return 67;
  if (name === "minecraft:wooden_slab" || name === "minecraft:bamboo_mosaic_slab") return 150;
  return 0;
}

export function createFurnaceState(machineId, dimensionId, x, y, z) {
  return {
    machineId: String(machineId), dimensionId: String(dimensionId), x: Math.floor(x), y: Math.floor(y), z: Math.floor(z),
    inputId: 0, inputCount: 0, fuelId: 0, fuelCount: 0, outputId: 0, outputCount: 0,
    burnTicks: 0, cookTicks: 0, experience: 0,
  };
}

/** Deterministic furnace state transition, in Minecraft ticks; caller persists and authorizes inventories. */
export function stepFurnace(state, station, elapsedTicks = 1) {
  const next = { ...state };
  const dt = Math.max(0, Math.min(1200, Math.floor(Number(elapsedTicks) || 0)));
  const recipe = processingRecipeFor(station, next.inputId);
  if (!recipe || next.inputCount <= 0 || (next.outputId && next.outputId !== recipe.output.itemId)
      || next.outputCount + recipe.output.count > 64) {
    next.cookTicks = 0;
    next.burnTicks = Math.max(0, next.burnTicks - dt);
    return { state: next, cooked: 0, recipe: null };
  }
  if (next.burnTicks <= 0 && next.fuelCount > 0) {
    const duration = fuelBurnTicks(next.fuelId);
    if (duration > 0) {
      next.burnTicks = duration;
      next.fuelCount--;
      if (next.fuelCount === 0) next.fuelId = 0;
    }
  }
  if (next.burnTicks <= 0) {
    next.cookTicks = Math.max(0, next.cookTicks - dt * 2);
    return { state: next, cooked: 0, recipe };
  }
  const activeTicks = Math.min(dt, next.burnTicks);
  next.burnTicks = Math.max(0, next.burnTicks - activeTicks);
  next.cookTicks += activeTicks;
  let cooked = 0;
  const cookingTime = Math.max(1, Math.floor(recipe.cookingTime || 200));
  while (next.cookTicks >= cookingTime && next.inputCount > 0 && next.outputCount + recipe.output.count <= 64) {
    next.cookTicks -= cookingTime;
    next.inputCount--;
    if (next.inputCount <= 0) { next.inputCount = 0; next.inputId = 0; }
    if (!next.outputId) next.outputId = recipe.output.itemId;
    next.outputCount += recipe.output.count;
    next.experience += Math.max(0, Number(recipe.experience) || 0);
    cooked++;
  }
  return { state: next, cooked, recipe };
}

export function applyStonecutting(inputItemId, recipeId) {
  return PROCESSING_RECIPES.find((recipe) => recipe.id === recipeId && recipe.type === "stonecutting"
    && recipe.inputs[0]?.includes(inputItemId)) ?? null;
}
