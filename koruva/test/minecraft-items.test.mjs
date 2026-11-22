import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MINECRAFT_ITEM_IDS } from "../shared/minecraft-item-catalog.js";
import { MINECRAFT_ITEM_TEXTURE_MAP } from "../shared/minecraft-item-texture-map.js";
import { MINECRAFT_ITEM_RUNTIME_IDS, MINECRAFT_ITEM_RUNTIME_ID_END, MINECRAFT_ITEM_TO_RUNTIME_ID } from "../shared/minecraft-item-runtime.js";
import { MINECRAFT_BLOCK_RUNTIME_ID_END } from "../shared/minecraft-block-runtime.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/client/public/assets/minecraft/textures");

test("all Java 26.3 item identifiers have a unique inventory runtime ID", () => {
  assert.equal(MINECRAFT_ITEM_IDS.length, 1658);
  assert.equal(MINECRAFT_ITEM_RUNTIME_IDS.length, MINECRAFT_ITEM_IDS.length - 1); // air is not an inventory item
  assert.equal(new Set(MINECRAFT_ITEM_RUNTIME_IDS).size, MINECRAFT_ITEM_IDS.length - 1);
  for (const key of MINECRAFT_ITEM_IDS) {
    if (key === "minecraft:air") continue;
    const id = MINECRAFT_ITEM_TO_RUNTIME_ID[key];
    assert.ok(Number.isInteger(id) && id > 0 && id <= MINECRAFT_ITEM_RUNTIME_ID_END, key);
    assert.ok(MINECRAFT_ITEM_TEXTURE_MAP[key], `missing icon mapping: ${key}`);
    const texture = path.join(root, MINECRAFT_ITEM_TEXTURE_MAP[key].replace(/^minecraft:/, "") + ".png");
    assert.ok(fs.existsSync(texture), `missing texture file: ${key} => ${texture}`);
  }
});

test("non-block item IDs are allocated after the world block ID range", () => {
  const id = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:diamond_sword"];
  assert.ok(id > MINECRAFT_BLOCK_RUNTIME_ID_END);
  assert.ok(id <= MINECRAFT_ITEM_RUNTIME_ID_END);
  assert.equal(MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:oak_planks"] <= MINECRAFT_BLOCK_RUNTIME_ID_END, true);
});
