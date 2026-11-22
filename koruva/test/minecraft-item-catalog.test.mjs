import test from "node:test";
import assert from "node:assert/strict";
import { MINECRAFT_ITEM_CATALOG_SOURCE, MINECRAFT_ITEM_COUNT, MINECRAFT_ITEM_IDS, isMinecraftItemId } from "../shared/minecraft-item-catalog.js";

test("item identifier catalog matches the attached data-version count and has unique namespaced IDs", () => {
  assert.deepEqual(MINECRAFT_ITEM_CATALOG_SOURCE, { dataVersionMajor: 121, dataVersionMinor: 0 });
  assert.equal(MINECRAFT_ITEM_COUNT, 1658);
  assert.equal(new Set(MINECRAFT_ITEM_IDS).size, MINECRAFT_ITEM_COUNT);
  assert.deepEqual([...MINECRAFT_ITEM_IDS], [...MINECRAFT_ITEM_IDS].sort());
  for (const id of MINECRAFT_ITEM_IDS) assert.match(id, /^minecraft:[a-z0-9_./-]+$/);
});

test("catalog lookup accepts only registered item identifiers", () => {
  assert.equal(isMinecraftItemId("minecraft:stone"), true);
  assert.equal(isMinecraftItemId("minecraft:not_a_real_item"), false);
  assert.equal(isMinecraftItemId(null), false);
});
