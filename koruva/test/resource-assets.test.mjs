import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../src/client/public/assets/minecraft/", import.meta.url));
function countFiles(dir) {
  return readdirSync(dir).reduce((count, name) => {
    const full = join(dir, name);
    return count + (statSync(full).isDirectory() ? countFiles(full) : 1);
  }, 0);
}
test("Minecraft 26.3 asset audit includes the previously missing resource families", () => {
  assert.ok(countFiles(root) >= 11608, `expected audited resource baseline, got ${countFiles(root)} files`);
  for (const rel of ["atlases/items.json", "equipment/armadillo_scute.json", "font/default.json", "post_effect/blur.json"]) {
    const full = join(root, rel);
    assert.ok(existsSync(full), `missing ${rel}`);
    assert.doesNotThrow(() => JSON.parse(readFileSync(full, "utf8")), `invalid JSON: ${rel}`);
  }
});

test("all supplied Minecraft 26.3 block-state definitions are bundled and valid JSON", () => {
  const dir = join(root, "blockstates");
  const files = readdirSync(dir).filter((name) => name.endsWith(".json"));
  assert.equal(files.length, 1288, `expected 1,288 block-state definitions, got ${files.length}`);
  for (const name of files) {
    const parsed = JSON.parse(readFileSync(join(dir, name), "utf8"));
    assert.ok(parsed && typeof parsed === "object", `invalid block-state data: ${name}`);
  }
  for (const name of ["oak_stairs.json", "stone_slab.json", "redstone_wire.json", "oak_door.json"]) {
    assert.ok(files.includes(name), `missing representative block state: ${name}`);
  }
});
