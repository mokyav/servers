import test from "node:test";
import { MINECRAFT_BLOCK_RUNTIME_ID_START, MINECRAFT_BLOCK_RUNTIME_ID_END, MINECRAFT_BLOCK_RUNTIME_STATE_COUNT, MINECRAFT_BLOCK_TO_RUNTIME_ID, resolveMinecraftBlockRuntimeId } from "../shared/minecraft-block-runtime.js";
import assert from "node:assert/strict";
import { MINECRAFT_BLOCK_CATALOG_SOURCE, MINECRAFT_BLOCK_COUNT, MINECRAFT_BLOCK_IDS, isMinecraftBlockId } from "../shared/minecraft-block-catalog.js";

test("blockstate identifier catalog matches the attached client data version and has unique sorted IDs", () => {
  assert.deepEqual(MINECRAFT_BLOCK_CATALOG_SOURCE, { gameVersion: "26.3", dataVersionMajor: 121, dataVersionMinor: 0 });
  assert.equal(MINECRAFT_BLOCK_COUNT, 1288);
  assert.equal(new Set(MINECRAFT_BLOCK_IDS).size, MINECRAFT_BLOCK_COUNT);
  assert.deepEqual([...MINECRAFT_BLOCK_IDS], [...MINECRAFT_BLOCK_IDS].sort());
  for (const id of MINECRAFT_BLOCK_IDS) assert.match(id, /^minecraft:[a-z0-9_./-]+$/);
});

test("catalog lookup accepts registered blockstate IDs only", () => {
  assert.equal(isMinecraftBlockId("minecraft:stone"), true);
  assert.equal(isMinecraftBlockId("minecraft:not_a_real_block"), false);
  assert.equal(isMinecraftBlockId(null), false);
});


test("all catalog blocks resolve to append-only Uint16 world IDs", () => {
  assert.equal(MINECRAFT_BLOCK_RUNTIME_ID_START, 92);
  assert.ok(MINECRAFT_BLOCK_IDS.every(id => Object.hasOwn(MINECRAFT_BLOCK_TO_RUNTIME_ID, id)));
  assert.equal(resolveMinecraftBlockRuntimeId("minecraft:air"), 0);
  assert.ok(resolveMinecraftBlockRuntimeId("minecraft:stone") >= MINECRAFT_BLOCK_RUNTIME_ID_START);
  assert.equal(resolveMinecraftBlockRuntimeId("minecraft:not_a_real_block"), undefined);
  const mapped = MINECRAFT_BLOCK_IDS.map(id => resolveMinecraftBlockRuntimeId(id));
  assert.ok(mapped.every(id => Number.isInteger(id) && id >= 0 && id <= 65535));
  const nonAir = mapped.filter(id => id > 0);
  assert.equal(new Set(nonAir).size, nonAir.length);
  assert.equal(mapped.filter(id => id === 0).length, MINECRAFT_BLOCK_IDS.filter(id => ["minecraft:air", "minecraft:cave_air", "minecraft:void_air"].includes(id)).length);
  assert.ok(MINECRAFT_BLOCK_RUNTIME_ID_END <= 65535);
  assert.ok(MINECRAFT_BLOCK_RUNTIME_STATE_COUNT >= nonAir.length);
});
