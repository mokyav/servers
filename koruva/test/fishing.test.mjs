import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fishingBiteDelay,
  isFishingOpenWater,
  rollFishingLootEntry,
} from "../shared/fishing.js";

const seq = (...values) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
};

test("Lure reduces the bite delay by five seconds per level and remains bounded", () => {
  assert.equal(fishingBiteDelay(0, () => 0), 5_000);
  assert.equal(fishingBiteDelay(1, () => 0), 1_000);
  assert.equal(fishingBiteDelay(3, () => 0), 1_000);
  assert.equal(fishingBiteDelay(0, () => .999999), 30_000);
  assert.equal(fishingBiteDelay(99, () => .999999), 15_000);
});

test("open-water detection allows only air and water in the 5x4x5 check volume", () => {
  const blocks = new Map([ ["0,0,0", 8] ]);
  const get = (x, y, z) => blocks.get(`${x},${y},${z}`) ?? 0;
  assert.equal(isFishingOpenWater(get, 0, 0, 0, [8, 9]), true);
  blocks.set("2,1,2", 4);
  assert.equal(isFishingOpenWater(get, 0, 0, 0, [8, 9]), false);
  assert.equal(isFishingOpenWater(get, 4, 0, 4, [8, 9]), false);
  assert.equal(isFishingOpenWater(null, 0, 0, 0), false);
});

test("treasure is excluded outside open water and available inside open water", () => {
  const closed = rollFishingLootEntry(0, seq(.12, 0), { openWater: false });
  const open = rollFishingLootEntry(0, seq(.12, 0), { openWater: true });
  assert.notEqual(closed.category, "treasure");
  assert.equal(open.category, "treasure");
  assert.equal(open.itemKey, "name_tag");
});

test("Luck of the Sea changes category weights and jungle junk includes bamboo", () => {
  assert.equal(rollFishingLootEntry(0, seq(.06, 0), { openWater: true }).category, "junk");
  assert.equal(rollFishingLootEntry(3, seq(.06, 0), { openWater: true }).category, "treasure");
  const jungle = rollFishingLootEntry(0, seq(.05, .999999), { openWater: false, biome: "jungle" });
  const plains = rollFishingLootEntry(0, seq(.05, .999999), { openWater: false, biome: "plains" });
  assert.equal(jungle.itemKey, "bamboo");
  assert.equal(plains.itemKey, "rotten_flesh");
});

test("all fishing loot entries map to registered 26.3 items", async () => {
  const { MINECRAFT_ITEM_TO_RUNTIME_ID } = await import("../shared/minecraft-item-runtime.js");
  const keys = [
    "cod", "salmon", "tropical_fish", "pufferfish", "lily_pad", "leather_boots", "leather",
    "bone", "potion", "string", "fishing_rod", "bowl", "stick", "ink_sac", "tripwire_hook",
    "rotten_flesh", "bamboo", "name_tag", "saddle", "bow", "enchanted_book", "nautilus_shell",
  ];
  for (const key of keys) assert.ok(MINECRAFT_ITEM_TO_RUNTIME_ID[`minecraft:${key}`] > 0, `${key} has no runtime ID`);
});

const dragonDir = "../src/client/public/assets/minecraft/textures/entity/enderdragon/";
test("Ender Dragon model assets are the expected 26.3 atlas files", () => {
  for (const name of ["dragon.png", "dragon_eyes.png", "dragon_exploding.png"]) {
    const png = readFileSync(new URL(`${dragonDir}${name}`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 256, `${name} width`);
    assert.equal(png.readUInt32BE(20), 256, `${name} height`);
  }
  const fireball = readFileSync(new URL(`${dragonDir}dragon_fireball.png`, import.meta.url));
  assert.equal(fireball.readUInt32BE(16), 16);
  assert.equal(fireball.readUInt32BE(20), 16);
  const model = readFileSync(new URL("../src/client/mobs.ts", import.meta.url), "utf8");
  for (const token of ["dragon.png", "dragon_eyes.png", "wingTips", "legBaseX", "[112,30]", "[176,65]"]) {
    assert.ok(model.includes(token), `Dragon model is missing ${token}`);
  }
});
