import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chooseNaturalMobType, naturalMobSpawnEntries, daylightAtTime, findNaturalSpawnGroup, findNaturalSpawnSpot, isNaturalMobSpawnDue, naturalMobSpawnGroupSize, shouldDespawnNaturalMob, NATURAL_MOB_DIMENSIONS, NATURAL_MOB_MAX_PER_DIMENSION, NATURAL_MOB_DESPAWN_DISTANCE, NATURAL_MOB_SPAWN_INTERVAL_MS } from "../shared/natural-spawning.js";
import { normalizeSavedMobs } from "../shared/mob-dimensions.js";

const rolls = (...values) => { let index = 0; return () => values[index++] ?? 0; };

test("natural spawn interval and per-dimension cap are bounded", () => {
  assert.equal(isNaturalMobSpawnDue(14_999, 0), false);
  assert.equal(isNaturalMobSpawnDue(15_000, 0), true);
  assert.equal(isNaturalMobSpawnDue(NaN, 0), false);
  assert.equal(NATURAL_MOB_SPAWN_INTERVAL_MS, 15_000);
  assert.equal(NATURAL_MOB_MAX_PER_DIMENSION, 18);
});

test("daylight follows the shared sunrise-to-sunset half-cycle", () => {
  const start = 1_000_000;
  assert.equal(daylightAtTime(start, start, 480), true);
  assert.equal(daylightAtTime(start + 120_000, start, 480), true);
  assert.equal(daylightAtTime(start + 240_000, start, 480), false);
  assert.equal(daylightAtTime(start + 480_000, start, 480), true);
  assert.equal(daylightAtTime(start, start, 0), null);
});

test("day and night choose only their limited natural spawn rosters", () => {
  assert.equal(chooseNaturalMobType(true, () => 0), "cow");
  assert.equal(chooseNaturalMobType(true, () => 0.99), "rabbit");
  assert.equal(chooseNaturalMobType(false, () => 0), "zombie");
  assert.equal(chooseNaturalMobType(false, () => 0.99), "creeper");
  assert.equal(chooseNaturalMobType(true, () => 1), null);
});

test("dimension and biome choose distinct supported natural Mob pools", () => {
  assert.deepEqual(NATURAL_MOB_DIMENSIONS, ["minecraft:overworld", "minecraft:the_nether", "minecraft:the_end"]);
  assert.equal(chooseNaturalMobType(true, () => 0, "minecraft:overworld", "desert"), "camel");
  assert.equal(chooseNaturalMobType(false, () => 0, "minecraft:overworld", "snowy"), "stray");
  assert.equal(chooseNaturalMobType(true, () => 0, "minecraft:the_nether", "crimson_forest"), "hoglin");
  assert.equal(chooseNaturalMobType(false, () => 0, "minecraft:the_nether", "soul_sand_valley"), "skeleton");
  assert.equal(chooseNaturalMobType(false, () => 0, "minecraft:the_end", "the_end_islands"), "enderman");
});

test("spawn spot can require three clear blocks for taller Mobs", () => {
  const options = {
    players: [{ p: [0, 12, 0], gameMode: "survival" }],
    random: rolls(0, 0, 0.25), getSurfaceY: () => 5,
    isClear: (_x, y) => y === 6 || y === 7 || y === 8,
    headroom: 3,
  };
  assert.deepEqual(findNaturalSpawnSpot(options), { x: 20.5, y: 6, z: 0.5 });
  assert.equal(findNaturalSpawnSpot({ ...options, isClear: (_x, y) => y === 6 || y === 7 }), null);
});

test("surface spot selection enforces distance, valid player, floor, and headroom", () => {
  let checks = 0;
  const spot = findNaturalSpawnSpot({
    players: [{ p: [0, 12, 0], gameMode: "survival" }, { p: [0, 12, 0], gameMode: "creative" }],
    random: rolls(0, 0, 0.25), getSurfaceY: () => 5, isClear: (_x, y) => { checks++; return y === 6 || y === 7; },
  });
  assert.deepEqual(spot, { x: 20.5, y: 6, z: 0.5 });
  assert.equal(checks, 2);
  assert.equal(findNaturalSpawnSpot({ players: [{ p: [0, 0, 0], dead: true }], getSurfaceY: () => 5, isClear: () => true }), null);
  assert.equal(findNaturalSpawnSpot({ players: [{ p: [0, 0, 0] }], random: rolls(0, 0, 0.25), getSurfaceY: () => 5, isClear: () => false }), null);
});

test("worker runs Mob ticks in empty rooms and persists/broadcasts natural spawns", async () => {
  const room = await readFile(new URL("../src/worker/room.ts", import.meta.url), "utf8");
  assert.match(room, /if \(online\.length\) \{/);
  assert.match(room, /trySpawnNaturalMob\(now, online\)/);
  assert.match(room, /for \(const dimensionId of NATURAL_MOB_DIMENSIONS\)/);
  assert.match(room, /dimensionBiomeAt\(seed, Math.floor\(spot.x\), Math.floor\(spot.z\), dimensionId\)/);
  assert.match(room, /this\.broadcastDimension\(\{ t: "mob", mob \}, dimensionId\)/);
  assert.match(room, /spawned \|\| now - this\.lastMobPersistAt/);
  assert.match(room, /shouldDespawnNaturalMob\(mobForTick/);
  assert.match(room, /spawnReason: "natural" as const/);
});

test("herd species get bounded small groups while other species remain solitary", () => {
  assert.equal(naturalMobSpawnGroupSize("cow", () => 0), 2);
  assert.equal(naturalMobSpawnGroupSize("rabbit", () => 0.999), 4);
  assert.equal(naturalMobSpawnGroupSize("enderman"), 1);
  assert.equal(naturalMobSpawnGroupSize("pig", () => NaN), null);
});

test("nearby group members require distinct supported cells and clear headroom", () => {
  const options = {
    center: { x: 0.5, y: 6, z: 0.5 }, size: 3, random: rolls(0, 0, 0.25, 0),
    getSurfaceY: () => 5, isClear: () => true, headroom: 3,
  };
  assert.deepEqual(findNaturalSpawnGroup(options), [
    { x: 0.5, y: 6, z: 0.5 },
    { x: 2.5, y: 6, z: 0.5 },
    { x: 0.5, y: 6, z: 2.5 },
  ]);
  assert.deepEqual(findNaturalSpawnGroup({ ...options, isClear: (_x, y) => y === 6 }), [{ x: 0.5, y: 6, z: 0.5 }]);
  assert.equal(findNaturalSpawnGroup({ ...options, size: 5 }).length, 0);
});


test("only far-away natural mobs despawn, respecting same-dimension living players", () => {
  const mob = { x: 0, y: 64, z: 0, dimensionId: "minecraft:overworld", spawnReason: "natural" };
  assert.equal(NATURAL_MOB_DESPAWN_DISTANCE, 128);
  assert.equal(shouldDespawnNaturalMob(mob, [{ p: [128, 64, 0], dimensionId: "minecraft:overworld" }]), false);
  assert.equal(shouldDespawnNaturalMob(mob, [{ p: [129, 64, 0], dimensionId: "minecraft:overworld" }]), true);
  assert.equal(shouldDespawnNaturalMob(mob, [
    { p: [129, 64, 0], dimensionId: "minecraft:overworld" },
    { p: [1, 64, 0], dimensionId: "minecraft:overworld" },
  ]), false);
  assert.equal(shouldDespawnNaturalMob(mob, [{ p: [129, 64, 0], dimensionId: "minecraft:the_nether" }]), false);
  assert.equal(shouldDespawnNaturalMob(mob, [{ p: [129, 64, 0], dimensionId: "minecraft:overworld", dead: true }]), false);
  assert.equal(shouldDespawnNaturalMob({ ...mob, spawnReason: "summoned" }, [{ p: [129, 64, 0] }]), false);
  assert.equal(shouldDespawnNaturalMob({ ...mob, spawnReason: undefined }, [{ p: [129, 64, 0] }]), false);
  assert.equal(shouldDespawnNaturalMob(mob, []), false);
  assert.equal(shouldDespawnNaturalMob(mob, [{ p: [129, 64, 0] }], NaN), false);
});

test("natural spawn reason survives saved Mob normalization", () => {
  const [mob] = normalizeSavedMobs([{ id: "natural1", type: "cow", x: 1, y: 2, z: 3, yaw: 0, spawnReason: "natural" }]);
  assert.equal(mob.spawnReason, "natural");
});


test("26.3 biome spawn tables expose all 67 vanilla biomes and extra spawn categories", async () => {
  const { MINECRAFT_BIOME_IDS, MINECRAFT_BIOME_DATA } = await import("../shared/minecraft-worldgen-catalog.js");
  assert.equal(MINECRAFT_BIOME_IDS.length, 67);
  assert.equal(Object.keys(MINECRAFT_BIOME_DATA).length, 67);
  const snowy = naturalMobSpawnEntries({ biome: "snowy_plains", daylight: true });
  assert.ok(snowy.length > 0);
  assert.ok(snowy.every((entry) => typeof entry.weight === "number"));
  const axolotls = naturalMobSpawnEntries({ biome: "lush_caves", category: "axolotls" });
  assert.equal(axolotls[0]?.type, "axolotl");
  const ambient = naturalMobSpawnEntries({ biome: "plains", category: "ambient" });
  assert.equal(ambient[0]?.type, "bat");
});

test("large mob spawn footprint and full model headroom are checked",()=>{
  const base={
    players:[{p:[0,12,0],gameMode:"survival"}],
    random:rolls(0,0,0.25),getSurfaceY:()=>5,
    isClear:(x,y,z)=>!((x===1||x===20)&&y===7),
    headroom:2,width:1.4,
  };
  assert.equal(findNaturalSpawnSpot(base),null);
  const centre={x:.5,y:6,z:.5};
  assert.deepEqual(findNaturalSpawnGroup({...base,center:centre,size:1}),[]);
  assert.deepEqual(findNaturalSpawnGroup({...base,center:centre,size:1,width:.6}),[{x:.5,y:6,z:.5}]);
});
test("natural group candidates check every block covered by mob width",()=>{
  const group=findNaturalSpawnGroup({
    center:{x:.5,y:6,z:.5},size:2,random:rolls(0,0),
    getSurfaceY:()=>5,isClear:(x,y,z)=>!(x===1&&y===7),
    headroom:2,width:1.4,
  });
  assert.equal(group.length,1);
});
