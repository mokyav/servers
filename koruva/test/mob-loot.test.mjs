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
  assert.deepEqual(rollMobFoodLoot("rabbit", () => 0), { raw_rabbit: 1 });
  assert.deepEqual(rollMobFoodLoot("zombie", () => 0), {});
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
  const spiderRolls=[0.999,0.999];
  assert.deepEqual(rollMobMaterialLoot("spider", () => spiderRolls.shift() ?? 0.999, 0, true), { string: 2, spider_eye: 1 });
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

test("expanded mob material tables cover passive, boss, and rare-drop rewards",async()=>{
  const {rollMobMaterialLoot,MOB_MATERIAL_ITEM_IDS}=await import("../shared/mob-loot.js");
  assert.deepEqual(rollMobMaterialLoot("chicken",()=>0.999),{feather:2});
  assert.deepEqual(rollMobMaterialLoot("cow",()=>0.999),{leather:2});
  assert.deepEqual(rollMobMaterialLoot("iron_golem",()=>0.999),{iron_ingot:5,poppy:2});
  assert.deepEqual(rollMobMaterialLoot("wither",()=>0.999),{nether_star:1});
  assert.deepEqual(rollMobMaterialLoot("evoker",()=>0.999),{totem_of_undying:1});
  assert.ok(MOB_MATERIAL_ITEM_IDS.includes("wither_skeleton_skull"));
  const {MINECRAFT_ITEM_TO_RUNTIME_ID}=await import("../shared/minecraft-item-runtime.js");
  for(const id of MOB_MATERIAL_ITEM_IDS) assert.ok(Number.isInteger(MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:"+id]),id);
});
test("rare drops use bounded chances and Looting raises the probability",async()=>{
  const {rollMobMaterialLoot}=await import("../shared/mob-loot.js");
  const noLooting=[0.9,0.15,0.999];
  const withLooting=[0.9,0.15,0.999];
  assert.deepEqual(rollMobMaterialLoot("rabbit",()=>noLooting.shift()??0.999,0),{rabbit_hide:1});
  assert.deepEqual(rollMobMaterialLoot("rabbit",()=>withLooting.shift()??0.999,3),{rabbit_hide:1,rabbit_foot:1});
});
test("room reward flow and drop position stay consistent across death sources",async()=>{
  const {readFile}=await import("node:fs/promises");
  const room=await readFile(new URL("../src/worker/room.ts",import.meta.url),"utf8");
  assert.match(room,/private async awardMobDeathRewards\(/);
  assert.ok((room.match(/awardMobDeathRewards\(/g)||[]).length>=6);
  assert.match(room,/spawnDrop\(mob\.x - 0\.5, mob\.y, mob\.z - 0\.5/);
  assert.match(room,/canMobOccupy\(kind,x,y,z,isSolidAt\)/);
  assert.match(room,/const hitRadius = Math\.min\(8, width \/ 2 \+ 0\.12\)/);
});

test("player-only drops are not produced by environmental mob deaths",async()=>{
  const {rollMobMaterialLoot}=await import("../shared/mob-loot.js");
  assert.deepEqual(rollMobMaterialLoot("blaze",()=>0.999,0,false),{});
  assert.deepEqual(rollMobMaterialLoot("blaze",()=>0.999,0,true),{blaze_rod:1});
  assert.deepEqual(rollMobMaterialLoot("spider",()=>0.999,0,false),{string:2});
  const rolls=[0.999,0.999];
  assert.deepEqual(rollMobMaterialLoot("spider",()=>rolls.shift()??0.999,0,true),{string:2,spider_eye:1});
});
test("Java 26.3 mob loot registry covers the added creature-specific drops",async()=>{
  const {MOB_MATERIAL_ITEM_IDS,rollMobMaterialLoot}=await import("../shared/mob-loot.js");
  assert.ok(MOB_MATERIAL_ITEM_IDS.includes("sculk_catalyst"));
  assert.ok(MOB_MATERIAL_ITEM_IDS.includes("saddle"));
  assert.ok(MOB_MATERIAL_ITEM_IDS.includes("bamboo"));
  assert.deepEqual(rollMobMaterialLoot("warden",()=>0.999),{sculk_catalyst:1});
  assert.deepEqual(rollMobMaterialLoot("ravager",()=>0.999),{saddle:1});
  assert.deepEqual(rollMobMaterialLoot("panda",()=>0.999),{bamboo:1});
});

test("guardian exclusive fish drop pool never yields both alternatives",async()=>{
  const {rollMobMaterialLoot}=await import("../shared/mob-loot.js");
  const codRolls=[0.999,0.1,0.999];
  assert.deepEqual(rollMobMaterialLoot("guardian",()=>codRolls.shift()??0.999),{prismarine_shard:2,cod:1});
  const emptyRolls=[0.999,0.9];
  assert.deepEqual(rollMobMaterialLoot("guardian",()=>emptyRolls.shift()??0.999),{prismarine_shard:2});
  const crystalRolls=[0.999,0.5,0.999];
  assert.deepEqual(rollMobMaterialLoot("guardian",()=>crystalRolls.shift()??0.999),{prismarine_shard:2,prismarine_crystals:1});
});
