import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROCESSING_RECIPES, processingRecipeFor, fuelBurnTicks,
  createFurnaceState, stepFurnace, applyStonecutting,
} from '../shared/processing.js';
import { MINECRAFT_ITEM_TO_RUNTIME_ID as ids } from '../shared/minecraft-item-runtime.js';

test('26.3 processing registry includes source-backed smelting, blasting, smoking and stonecutting recipes', () => {
  assert.equal(PROCESSING_RECIPES.length, 479);
  const ironOre = processingRecipeFor('furnace', ids['minecraft:iron_ore']);
  assert.equal(ironOre.output.itemId, ids['minecraft:iron_ingot']);
  assert.equal(processingRecipeFor('blast_furnace', ids['minecraft:raw_iron']).type, 'blasting');
  assert.equal(processingRecipeFor('smoker', ids['minecraft:beef']).type, 'smoking');
  assert.equal(processingRecipeFor('campfire', ids['minecraft:cod']).type, 'campfire_cooking');
  assert.ok(applyStonecutting(ids['minecraft:stone'], 'minecraft:stone_brick_slab_from_stone_stonecutting') ||
    PROCESSING_RECIPES.some((r) => r.type === 'stonecutting' && r.inputs[0].includes(ids['minecraft:stone'])));
});

test('fuel duration resolves source-registry IDs for coal and wood without treating stone tools as fuel', () => {
  assert.equal(fuelBurnTicks(ids['minecraft:coal']), 1600);
  assert.equal(fuelBurnTicks(ids['minecraft:lava_bucket']), 20000);
  assert.equal(fuelBurnTicks(ids['minecraft:oak_planks']), 300);
  assert.equal(fuelBurnTicks(ids['minecraft:oak_log']), 300);
  assert.equal(fuelBurnTicks(ids['minecraft:oak_slab']), 150);
  assert.equal(fuelBurnTicks(ids['minecraft:oak_door']), 200);
  assert.equal(fuelBurnTicks(ids['minecraft:oak_button']), 100);
  assert.equal(fuelBurnTicks(ids['minecraft:bow']), 300);
  assert.equal(fuelBurnTicks(ids['minecraft:stick']), 100);
  assert.equal(fuelBurnTicks(ids['minecraft:stone_button']), 0);
  assert.equal(fuelBurnTicks(ids['minecraft:iron_door']), 0);
});

test('furnace advances cook time, consumes fuel and input, and emits a source-defined output', () => {
  const state = createFurnaceState('furnace-1', 'overworld', 2, 64, 3);
  state.inputId = ids['minecraft:iron_ore'];
  state.inputCount = 2;
  state.fuelId = ids['minecraft:coal'];
  state.fuelCount = 1;
  const step = stepFurnace(state, 'furnace', 400);
  assert.equal(step.cooked, 2);
  assert.equal(step.state.inputCount, 0);
  assert.equal(step.state.outputId, ids['minecraft:iron_ingot']);
  assert.equal(step.state.outputCount, 2);
  assert.equal(step.state.fuelCount, 0);
  assert.equal(step.state.burnTicks, 1200);
});

test('furnace rejects incompatible output and invalid stations safely', () => {
  const state = createFurnaceState('furnace-2', 'overworld', 0, 64, 0);
  state.inputId = ids['minecraft:iron_ore'];
  state.inputCount = 1;
  state.outputId = ids['minecraft:gold_ingot'];
  state.outputCount = 1;
  state.fuelId = ids['minecraft:coal'];
  state.fuelCount = 1;
  const result = stepFurnace(state, 'furnace', 20);
  assert.equal(result.cooked, 0);
  assert.equal(result.state.inputCount, 1);
  assert.equal(processingRecipeFor('not-a-station', ids['minecraft:iron_ore']), null);
});
