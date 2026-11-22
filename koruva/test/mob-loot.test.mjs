import test from "node:test";
import assert from "node:assert/strict";
import { applyMobFoodLoot, rollMobFoodLoot } from "../shared/mob-loot.js";

test("mob food loot maps supported animals and undead to existing food inventory ids", () => {
  assert.deepEqual(rollMobFoodLoot("chicken", () => 0), { raw_chicken: 1 });
  assert.deepEqual(rollMobFoodLoot("cow", () => 0.999), { raw_beef: 3 });
  assert.deepEqual(rollMobFoodLoot("sheep", () => 0.999), { raw_mutton: 2 });
  assert.deepEqual(rollMobFoodLoot("zombie", () => 0.999), { rotten_flesh: 2 });
  assert.deepEqual(rollMobFoodLoot("unknown_mob", () => 0), {});
});

test("zero-minimum loot may yield no item and random samples are bounded", () => {
  assert.deepEqual(rollMobFoodLoot("rabbit", () => 0), {});
  assert.deepEqual(rollMobFoodLoot("rabbit", () => 0.75), { raw_rabbit: 1 });
  assert.deepEqual(rollMobFoodLoot("zombie", () => NaN), {});
  assert.deepEqual(rollMobFoodLoot("zombie", () => 1), { rotten_flesh: 2 });
});

test("loot merge is copy-on-write, capped, and ignores invalid keys/counts", () => {
  const source = { raw_beef: 998, rotten_flesh: 999 };
  const merged = applyMobFoodLoot(source, { raw_beef: 5, rotten_flesh: 1, not_food: 8, raw_mutton: -2 });
  assert.deepEqual(merged, { foodCounts: { raw_beef: 999, rotten_flesh: 999 }, changed: true });
  assert.deepEqual(source, { raw_beef: 998, rotten_flesh: 999 });
  assert.equal(applyMobFoodLoot(source, { raw_beef: 4 }).changed, true);
  assert.equal(applyMobFoodLoot(source, { rotten_flesh: 4 }).changed, false);
});

test("prototype material loot produces real material entries for common hostile mobs", async () => {
  const { rollMobMaterialLoot } = await import("../shared/mob-loot.js");
  assert.deepEqual(rollMobMaterialLoot("skeleton", () => 0.999), { bone: 2, arrow: 2 });
  assert.deepEqual(rollMobMaterialLoot("creeper", () => 0.999), { gunpowder: 2 });
  assert.deepEqual(rollMobMaterialLoot("spider", () => 0.999), { string: 2, spider_eye: 1 });
  assert.deepEqual(rollMobMaterialLoot("enderman", () => 0.999), { ender_pearl: 1 });
  assert.deepEqual(rollMobMaterialLoot("unknown_mob", () => 0), {});
});

test("prototype material loot is wired to valid runtime item identifiers", async () => {
  const { rollMobMaterialLoot } = await import("../shared/mob-loot.js");
  const { MINECRAFT_ITEM_TO_RUNTIME_ID } = await import("../shared/minecraft-item-runtime.js");
  for (const [key, count] of Object.entries(rollMobMaterialLoot("guardian", () => 0.999))) {
    assert.ok(count > 0, key);
    assert.ok(Number.isInteger(MINECRAFT_ITEM_TO_RUNTIME_ID[`minecraft:${key}`]), key);
  }
});
