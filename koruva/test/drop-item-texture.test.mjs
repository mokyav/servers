import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { MINECRAFT_ITEM_TEXTURE_MAP } from "../shared/minecraft-item-texture-map.js";
import { itemDropTexturePath } from "../shared/drop-item-texture.js";

const textureRoot = new URL("../src/client/public/assets/minecraft/textures/", import.meta.url);

test("mapped item-only drop textures resolve to safe packaged pixel-art assets", () => {
  const entries = Object.entries(MINECRAFT_ITEM_TEXTURE_MAP)
    .map(([key]) => ({ key, path: itemDropTexturePath({ key, itemOnly: true }) }))
    .filter(({ path }) => path);
  assert.ok(entries.length > 0);
  for (const { key, path } of entries) {
    assert.match(path, /^[a-z0-9_/-]+$/i, `unsafe texture path for ${key}`);
    assert.ok(!path.includes(".."));
    assert.ok(existsSync(fileURLToPath(new URL(`${path}.png`, textureRoot))), `missing texture for ${key}: ${path}`);
  }
});

test("block drops remain cubes while known sprite items and potions resolve texture paths", () => {
  const applePath = itemDropTexturePath({ key: "minecraft:apple", itemOnly: true });
  assert.ok(applePath);
  assert.ok(existsSync(fileURLToPath(new URL(`${applePath}.png`, textureRoot))));
  assert.equal(itemDropTexturePath({ key: "minecraft:dirt", itemOnly: false }), null);
  assert.equal(itemDropTexturePath({ key: "minecraft:potion", itemOnly: true }), "item/potion");
  assert.equal(itemDropTexturePath(null), null);
  assert.equal(itemDropTexturePath({ key: "koruva:fake", itemOnly: true, iconTexture: "../escape" }), null);
});

test("inventory icons and world drop entities share the item texture resolver", () => {
  const icons = readFileSync(new URL("../src/client/icons.ts", import.meta.url), "utf8");
  const drops = readFileSync(new URL("../src/client/drops.ts", import.meta.url), "utf8");
  assert.match(icons, /itemDropTexturePath\(def\)/);
  assert.match(drops, /itemDropTexturePath\(BLOCKS\[itemId\]\)/);
  assert.match(drops, /new THREE\.TextureLoader\(\)/);
  assert.match(drops, /replaceWithItemSprites/);
});
