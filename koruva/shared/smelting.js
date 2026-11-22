import { PROCESSING_RECIPES, fuelBurnTicks as sourceFuelBurnTicks } from "./processing.js";
import { MINECRAFT_ITEM_TO_RUNTIME_ID } from "./minecraft-item-runtime.js";

const recipes = new Map();
const fuels = new Set();
const outputs = new Set();
for (const recipe of PROCESSING_RECIPES) {
  const station = recipe.type === "smelting" ? "furnace"
    : recipe.type === "blasting" ? "blast_furnace"
      : recipe.type === "smoking" ? "smoker" : null;
  if (!station) continue;
  for (const choices of recipe.inputs || []) for (const itemId of choices) {
    if (!recipes.has(`${station}:${itemId}`)) recipes.set(`${station}:${itemId}`, recipe);
  }
  if (recipe.output?.itemId > 0) outputs.add(recipe.output.itemId);
}
for (const recipe of PROCESSING_RECIPES) {
  if (recipe.type !== "smelting" && recipe.type !== "blasting" && recipe.type !== "smoking") continue;
  for (const choices of recipe.inputs || []) for (const itemId of choices) {
    if (!recipes.has(`furnace:${itemId}`) && recipe.type === "smelting") recipes.set(`furnace:${itemId}`, recipe);
  }
}
const fuelIds = new Set();
for (const recipe of PROCESSING_RECIPES) {
  // fuelBurnTicks resolves IDs against the current runtime catalogue; cache the supported set below.
}
for (const itemId of Object.values(MINECRAFT_ITEM_TO_RUNTIME_ID)) if (sourceFuelBurnTicks(itemId) > 0) fuelIds.add(itemId);
const validCount = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 64;

export const FURNACE_COOK_TICKS = 200;
export const BLAST_FURNACE_COOK_TICKS = 100;
export const SMOKER_COOK_TICKS = 100;
export const FURNACE_MAX_STACK = 64;
export const SMELTABLE_ITEM_IDS = Object.freeze([...new Set([...recipes.keys()].map((key) => Number(key.slice(key.indexOf(":") + 1))) )]);
export const FUEL_ITEM_IDS = Object.freeze([...fuelIds]);
export const SMELTED_OUTPUT_ITEM_IDS = Object.freeze([...outputs]);

export function smeltingRecipe(itemId, station = "furnace") {
  const recipe = recipes.get(`${station}:${itemId}`);
  if (!recipe) return null;
  return {
    outputItemId: recipe.output.itemId,
    outputCount: recipe.output.count || 1,
    cookingTime: station === "furnace" ? FURNACE_COOK_TICKS : station === "blast_furnace" ? BLAST_FURNACE_COOK_TICKS : SMOKER_COOK_TICKS,
    experience: recipe.experience || 0,
    category: station === "blast_furnace" ? "ore" : station === "smoker" ? "food" : "other",
  };
}
export function fuelBurnTicks(itemId) { return sourceFuelBurnTicks(itemId); }
export function isSmeltableItem(itemId) { return [...recipes.keys()].some((key) => key.endsWith(`:${itemId}`)); }
export function isFuelItem(itemId) { return fuelBurnTicks(itemId) > 0; }
export function createFurnaceState() {
  return { inputItemId: 0, inputCount: 0, fuelItemId: 0, fuelCount: 0, burnTicks: 0, cookTicks: 0, outputItemId: 0, outputCount: 0 };
}
export function normalizeFurnaceState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createFurnaceState();
  const inputCount = validCount(value.inputCount) ? value.inputCount : 0;
  const fuelCount = validCount(value.fuelCount) ? value.fuelCount : 0;
  const outputCount = validCount(value.outputCount) ? value.outputCount : 0;
  const inputItemId = inputCount && isSmeltableItem(value.inputItemId) ? value.inputItemId : 0;
  const fuelItemId = fuelCount && isFuelItem(value.fuelItemId) ? value.fuelItemId : 0;
  const outputItemId = outputCount && outputs.has(value.outputItemId) ? value.outputItemId : 0;
  return {
    inputItemId, inputCount: inputItemId ? inputCount : 0,
    fuelItemId, fuelCount: fuelItemId ? fuelCount : 0,
    burnTicks: Number.isSafeInteger(value.burnTicks) ? Math.max(0, Math.min(20000, value.burnTicks)) : 0,
    cookTicks: Number.isSafeInteger(value.cookTicks) ? Math.max(0, Math.min(199, value.cookTicks)) : 0,
    outputItemId, outputCount: outputItemId ? outputCount : 0,
  };
}
export function insertFurnaceItems(value, slot, itemId, count = 1) {
  const state = normalizeFurnaceState(value);
  if ((slot !== "input" && slot !== "fuel") || !Number.isSafeInteger(itemId) || itemId <= 0 || !Number.isSafeInteger(count) || count <= 0
      || !(slot === "input" ? isSmeltableItem(itemId) : isFuelItem(itemId))) return { ok: false, moved: 0, state };
  const idKey = `${slot}ItemId`, countKey = `${slot}Count`;
  if (state[idKey] && state[idKey] !== itemId) return { ok: false, moved: 0, state };
  const moved = Math.min(FURNACE_MAX_STACK - state[countKey], count);
  if (!moved) return { ok: false, moved: 0, state };
  return { ok: true, moved, state: { ...state, [idKey]: itemId, [countKey]: state[countKey] + moved } };
}
export function removeFurnaceItems(value, slot, count = 64) {
  const state = normalizeFurnaceState(value);
  if (!["input", "fuel", "output"].includes(slot) || !Number.isSafeInteger(count) || count <= 0) return { ok: false, moved: 0, itemId: 0, state };
  const idKey = `${slot}ItemId`, countKey = `${slot}Count`;
  const itemId = state[idKey], moved = Math.min(state[countKey], count);
  if (!itemId || !moved) return { ok: false, moved: 0, itemId: 0, state };
  const remaining = state[countKey] - moved;
  const next = { ...state, [idKey]: remaining ? itemId : 0, [countKey]: remaining };
  if (slot === "input" && !remaining) next.cookTicks = 0;
  return { ok: true, moved, itemId, state: next };
}
export function furnaceHasContents(value) {
  const state = normalizeFurnaceState(value);
  return !!(state.inputCount || state.fuelCount || state.outputCount || state.burnTicks || state.cookTicks);
}
export function advanceFurnaceState(value, ticks = 1, station = "furnace") {
  const state = normalizeFurnaceState(value), next = { ...state };
  const steps = Math.max(0, Math.min(1200, Number.isSafeInteger(ticks) ? ticks : 0));
  let completed = 0;
  for (let i = 0; i < steps; i++) {
    const recipe = smeltingRecipe(next.inputItemId, station);
    const canCook = !!(recipe && next.inputCount > 0
      && (!next.outputCount || next.outputItemId === recipe.outputItemId)
      && next.outputCount + recipe.outputCount <= FURNACE_MAX_STACK);
    if (next.burnTicks <= 0 && canCook && next.fuelCount > 0) {
      const burn = fuelBurnTicks(next.fuelItemId);
      if (burn > 0) { next.burnTicks = burn; next.fuelCount--; if (!next.fuelCount) next.fuelItemId = 0; }
    }
    if (next.burnTicks > 0) {
      next.burnTicks--;
      if (canCook && ++next.cookTicks >= recipe.cookingTime) {
        next.outputItemId = recipe.outputItemId;
        next.outputCount += recipe.outputCount;
        next.inputCount--;
        if (!next.inputCount) next.inputItemId = 0;
        next.cookTicks = 0;
        completed++;
      }
    }
  }
  return { state: next, changed: JSON.stringify(state) !== JSON.stringify(next), completed };
}
