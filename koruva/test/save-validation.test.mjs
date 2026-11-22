import test from "node:test";
import assert from "node:assert/strict";
import { isValidSoloSave } from "../shared/save-validation.js";

const validLegacy = () => ({
  v: 1, seed: 123, edits: [1, 2, 3, 4], time: 12, savedAt: 1000,
  player: { pos: [1, 20, 3], yaw: 0, pitch: 0, hotbar: Array(9).fill(1), sel: 0 },
});

test("accepts legacy v1 solo saves and newer optional dimension fields", () => {
  assert.equal(isValidSoloSave(validLegacy()), true);
  const current = validLegacy();
  current.worldgenVersion = 2;
  current.dimensionId = "minecraft:the_nether";
  current.dimensionEdits = { "minecraft:overworld": [0, 3, 0, 1], "minecraft:the_nether": [] };
  current.spawn = [0.5, 40, 0.5];
  current.player.counts = [0, 3, 1];
  current.player.health = 20;
  current.player.hunger = 20;
  assert.equal(isValidSoloSave(current), true);
});

test("rejects malformed records without throwing or mutating them", () => {
  const broken = validLegacy();
  broken.player.pos = [0, NaN, 0];
  const before = JSON.stringify(validLegacy());
  assert.equal(isValidSoloSave(broken), false);
  assert.equal(JSON.stringify(validLegacy()), before);
  assert.equal(isValidSoloSave(null), false);
  assert.equal(isValidSoloSave({ ...validLegacy(), edits: [1, 2, 3] }), false);
  assert.equal(isValidSoloSave({ ...validLegacy(), player: { ...validLegacy().player, sel: 9 } }), false);
});

test("rejects malformed optional dimension edits and negative inventory counts", () => {
  assert.equal(isValidSoloSave({ ...validLegacy(), dimensionEdits: { "minecraft:the_end": [1, 2, 3] } }), false);
  const invalidCounts = validLegacy();
  invalidCounts.player.counts = [0, -1];
  assert.equal(isValidSoloSave(invalidCounts), false);
});
