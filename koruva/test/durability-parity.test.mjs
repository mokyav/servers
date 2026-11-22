import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { durabilityStatus, damageTool } from "../shared/item-mechanics.js";
import { isValidSoloSave } from "../shared/save-validation.js";

const root = process.cwd();
test("durability status renders unused and worn items accurately", () => {
  const blocks = [{ key: "minecraft:air" }, { key: "minecraft:iron_sword" }];
  assert.deepEqual(durabilityStatus(1, [], blocks), { max: 250, remaining: 250, ratio: 1, color: "#54c85a" });
  assert.deepEqual(durabilityStatus(1, [0, 125], blocks), { max: 250, remaining: 125, ratio: 0.5, color: "#e1c14a" });
  assert.equal(durabilityStatus(0, [], blocks), null);
  const wear = [0, 2], counts = [0, 1];
  assert.deepEqual(damageTool(wear, 1, counts, blocks, 2), { changed: true, broke: true, remaining: 0 });
  assert.equal(counts[1], 0);
});
test("solo saves accept legacy wear omission and reject corrupt durability arrays", () => {
  const save = { v: 1, seed: 5, edits: [], time: 0.25, savedAt: 1, player: { pos: [0, 40, 0], yaw: 0, pitch: 0, hotbar: Array(9).fill(0), sel: 0 } };
  assert.equal(isValidSoloSave(save), true);
  assert.equal(isValidSoloSave({ ...save, player: { ...save.player, wear: [0, 58] } }), true);
  assert.equal(isValidSoloSave({ ...save, player: { ...save.player, stackData: { "hotbar:0": { itemId: 1, count: 1, damage: 12 } } } }), true);
  assert.equal(isValidSoloSave({ ...save, player: { ...save.player, stackData: { "hotbar:0": { itemId: 1, count: 1, damage: -1 } } } }), false);
  assert.equal(isValidSoloSave({ ...save, player: { ...save.player, stackData: { "invalid:0": { itemId: 1, count: 1 } } } }), false);
});
test("HUD, inventory, solo save and confirmed combat hits expose/update durability", () => {
  const main = readFileSync(`${root}/src/client/main.ts`, "utf8");
  const hud = readFileSync(`${root}/src/client/ui.ts`, "utf8");
  const inventory = readFileSync(`${root}/src/client/inventory-ui.ts`, "utf8");
  const room = readFileSync(`${root}/src/worker/room.ts`, "utf8");
  const save = readFileSync(`${root}/src/client/save.ts`, "utf8");
  assert.match(main, /stackData: this\.stackData/);
  assert.match(main, /normalizeStackComponents\(m\.stackData, \{\}, BLOCKS\)/);
  assert.match(main, /damageStackRecord\(/);
  assert.match(save, /stackData\?: Record<string, unknown>/);
  assert.match(hud, /maxDurabilityForItemKey/);
  assert.match(hud, /slot-durability/);
  assert.match(inventory, /maxDurabilityForItemKey/);
  assert.match(inventory, /mc-durability-bar/);
  assert.match(room, /hurt\.applied <= 0/);
  assert.match(room, /damageInventoryStack\(ws,\s*me,\s*attackSlotKey,\s*heldItemId,\s*1\)/);
  assert.match(room, /damageStackRecord\(record,\s*amount,\s*maxDamage\)/);
});
