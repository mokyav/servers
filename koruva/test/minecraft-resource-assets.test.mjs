import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { MINECRAFT_BLOCK_IDS } from "../shared/minecraft-block-catalog.js";
import { MINECRAFT_ITEM_IDS } from "../shared/minecraft-item-catalog.js";
import { MINECRAFT_BLOCK_TEXTURE_MAP } from "../shared/minecraft-block-texture-map.js";
import { MINECRAFT_ITEM_TEXTURE_MAP } from "../shared/minecraft-item-texture-map.js";
import { MINECRAFT_MOB_IDS } from "../shared/minecraft-mob-catalog.js";
import { LEGACY_TEXTURE_ALIASES } from "../shared/legacy-texture-aliases.js";
import { resolveMinecraftTextureAnimation } from "../shared/minecraft-texture-frames.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function localTexture(resource) { return path.join(root, "src/client/public/assets/minecraft/textures", resource.replace(/^minecraft:/, "") + ".png"); }
test("26.3 block resource textures cover every registered block ID", () => {
  assert.equal(MINECRAFT_BLOCK_IDS.length, 1288);
  for (const id of MINECRAFT_BLOCK_IDS) {
    const entry = MINECRAFT_BLOCK_TEXTURE_MAP[id.slice("minecraft:".length)];
    assert.ok(entry, `missing block texture mapping ${id}`);
    for (const face of ["top", "side", "bottom"]) {
      if (entry[face] === "none") continue;
      assert.ok(existsSync(localTexture(entry[face])), `missing ${face} texture for ${id}: ${entry[face]}`);
    }
  }
});
test("26.3 item icon resources cover every registered item ID", () => {
  assert.equal(MINECRAFT_ITEM_IDS.length, 1658);
  assert.equal(Object.keys(MINECRAFT_ITEM_TEXTURE_MAP).length, MINECRAFT_ITEM_IDS.length);
  for (const id of MINECRAFT_ITEM_IDS) assert.ok(existsSync(localTexture(MINECRAFT_ITEM_TEXTURE_MAP[id])), `missing item texture for ${id}`);
});
test("spawn egg roster is unique and derived from registered spawn eggs", () => {
  const expected = MINECRAFT_ITEM_IDS.filter((id) => id.endsWith("_spawn_egg")).map((id) => id.slice(0, -"_spawn_egg".length)).sort();
  assert.deepEqual(MINECRAFT_MOB_IDS, [...new Set(expected)].sort());
});
test("versioned asset manifest matches the packed data", () => {
  const manifest = JSON.parse(readFileSync(path.join(root, "src/client/public/assets/minecraft/koruva-resource-manifest.json"), "utf8"));
  assert.equal(manifest.gameVersion, "26.3");
  assert.equal(manifest.dataVersion.major, 121);
  assert.equal(manifest.counts.registeredBlockTextureMappings, 1288);
  assert.equal(manifest.counts.registeredItemTextureMappings, 1658);
});


test("all legacy block tiles resolve to real vanilla 26.3 texture files", () => {
  assert.equal(Object.keys(LEGACY_TEXTURE_ALIASES).length, 29);
  for (const [alias, resource] of Object.entries(LEGACY_TEXTURE_ALIASES)) {
    assert.ok(existsSync(localTexture(resource)), `missing vanilla texture for legacy tile ${alias}: ${resource}`);
  }
});

test("all mapped block textures are sampled as a single vanilla pixel-art frame", () => {
  const resources = new Set(Object.values(MINECRAFT_BLOCK_TEXTURE_MAP).flatMap((entry) => [entry.top, entry.side, entry.bottom]).filter((resource) => resource !== "none"));
  for (const resource of resources) {
    const file = localTexture(resource);
    assert.ok(existsSync(file), `missing ${resource}`);
    const png = readFileSync(file);
    assert.equal(png.toString("ascii", 1, 4), "PNG", `${resource} is not a PNG`);
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    let metadata = null;
    const metaPath = `${file}.mcmeta`;
    if (existsSync(metaPath)) metadata = JSON.parse(readFileSync(metaPath, "utf8"));
    const layout = resolveMinecraftTextureAnimation(width, height, metadata);
    assert.ok(layout.frameWidth > 0 && layout.frameHeight > 0, `invalid frame for ${resource}`);
    assert.ok(layout.frameWidth <= width && layout.frameHeight <= height, `frame exceeds ${resource}`);
  }
});

test("grass block side samples the base side texture before optional biome overlay", () => {
  assert.equal(MINECRAFT_BLOCK_TEXTURE_MAP.grass_block.side, "minecraft:block/grass_block_side");
});


test("stained glass and redstone components use their official dedicated 26.3 textures", () => {
  assert.equal(MINECRAFT_BLOCK_TEXTURE_MAP.black_stained_glass.side, "minecraft:block/black_stained_glass");
  assert.equal(MINECRAFT_BLOCK_TEXTURE_MAP.blue_stained_glass.side, "minecraft:block/blue_stained_glass");
  assert.equal(MINECRAFT_BLOCK_TEXTURE_MAP.glass.side, "minecraft:block/glass");
  assert.equal(MINECRAFT_BLOCK_TEXTURE_MAP.glass_pane.side, "minecraft:block/glass_pane_top");
  assert.equal(MINECRAFT_BLOCK_TEXTURE_MAP.repeater.top, "minecraft:block/repeater");
  assert.equal(MINECRAFT_BLOCK_TEXTURE_MAP.comparator.top, "minecraft:block/comparator");
});

test("all block texture definitions are explicit vanilla block resources", () => {
  for (const [block, faces] of Object.entries(MINECRAFT_BLOCK_TEXTURE_MAP)) {
    for (const face of ["top", "side", "bottom"]) {
      if (faces[face] === "none") continue; // barrier, light and structure_void have no world sprite.
      assert.match(faces[face], /^minecraft:(?:block|item)\//, `${block} ${face} must use a client resource`);
      assert.ok(existsSync(localTexture(faces[face])), `missing official ${block} ${face} texture`);
    }
  }
});
