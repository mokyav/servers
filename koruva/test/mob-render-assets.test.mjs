import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MOB_RENDER_TEXTURES,
  MOB_RENDER_OVERLAYS,
  atlasBoxFaceRects,
  mapAtlasFaceUV,
  mapAtlasPlaneUV,
} from "../shared/mob-render-assets.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mobSource = readFileSync(path.join(root, "src/client/mobs.ts"), "utf8");
const pngSize = (file) => {
  const data = readFileSync(file);
  assert.equal(data.toString("hex", 0, 8), "89504e470d0a1a0a", `${file} is not a PNG`);
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
};

test("all explicit mob texture and overlay resources exist", () => {
  for (const [mob, resource] of Object.entries(MOB_RENDER_TEXTURES)) {
    const file = path.join(root, "src/client/public/assets/minecraft/textures/entity", `${resource}.png`);
    assert.ok(existsSync(file), `${mob} texture missing: ${resource}`);
    const [w, h] = pngSize(file);
    assert.ok(w >= 64 && h >= 32, `${mob} texture has unexpected size ${w}x${h}`);
  }
  for (const [mob, overlays] of Object.entries(MOB_RENDER_OVERLAYS)) {
    for (const resource of overlays) {
      const file = path.join(root, "src/client/public/assets/minecraft/textures/entity", `${resource}.png`);
      assert.ok(existsSync(file), `${mob} overlay missing: ${resource}`);
        const expectedSize = mob.includes("villager") ? [64, 64] : [64, 32];
      assert.deepEqual(pngSize(file), expectedSize, `${mob} overlay atlas dimensions`);
    }
  }
});

test("boss texture atlases have the expected 26.3 dimensions", () => {
  const base = path.join(root, "src/client/public/assets/minecraft/textures/entity");
  assert.deepEqual(pngSize(path.join(base, "enderdragon/dragon.png")), [256, 256]);
  assert.deepEqual(pngSize(path.join(base, "enderdragon/dragon_eyes.png")), [256, 256]);
  assert.deepEqual(pngSize(path.join(base, "wither/wither.png")), [64, 64]);
  assert.deepEqual(pngSize(path.join(base, "warden/warden.png")), [128, 128]);
  assert.deepEqual(pngSize(path.join(base, "warden/warden_bioluminescent_layer.png")), [128, 128]);
});

test("the core MobModels cuboid UV rectangles all fit their texture atlases", () => {
  const modelSection = mobSource.slice(mobSource.indexOf("const MODELS:"), mobSource.indexOf("function applyBoxAtlasUV"));
  const dimensions = { pig: [64, 64], cow: [64, 64], chicken: [64, 32], creeper: [64, 32], zombie: [64, 64], skeleton: [64, 32], villager: [64, 64] };
  const starts = [...modelSection.matchAll(/^\s*(pig|cow|chicken|creeper|zombie|skeleton|villager):\[/gm)];
  let count = 0;
  for (let i = 0; i < starts.length; i++) {
    const type = starts[i][1];
    const from = starts[i].index + starts[i][0].length;
    const to = i + 1 < starts.length ? starts[i + 1].index : modelSection.length;
    const body = modelSection.slice(from, to);
    for (const part of body.matchAll(/size:\[([\d,]+)\],pos:\[([\d.,-]+)\],uv:\[([\d,]+)\]/g)) {
      const size = part[1].split(",").map(Number);
      const uv = part[3].split(",").map(Number);
      assert.equal(atlasBoxFaceRects(size, uv, dimensions[type]).length, 6);
      count++;
    }
  }
  assert.ok(count >= 30, `only checked ${count} core cuboids`);
});

test("dragon, wither and warden atlas cuboids stay inside their 26.3 texture bounds", () => {
  let dragonCount = 0;
  for (const m of mobSource.matchAll(/this\.addDragonBox\([^,]+,\[([\d,]+)\],\[([\d.,-]+)\],\[([\d,]+)\](?:,(?:true|false))?\)/g)) {
    atlasBoxFaceRects(m[1].split(",").map(Number), m[3].split(",").map(Number), [256, 256]);
    dragonCount++;
  }
  assert.ok(dragonCount >= 18, `only checked ${dragonCount} explicit dragon cuboids; looped segments are validated by the renderer tests`);
  for (const sizeUv of [
    [[20, 3, 3], [0, 16]], [[3, 10, 3], [0, 22]], [[11, 2, 2], [24, 22]], [[3, 6, 3], [12, 22]], [[8, 8, 8], [0, 0]], [[6, 6, 6], [32, 0]],
  ]) atlasBoxFaceRects(sizeUv[0], sizeUv[1], [64, 64]);
  for (const sizeUv of [
    [[18, 21, 11], [0, 0]], [[9, 21, 1], [90, 11]], [[16, 16, 10], [0, 32]], [[16, 16, 1], [52, 32]], [[8, 28, 8], [44, 50]], [[6, 13, 6], [76, 48]],
  ]) atlasBoxFaceRects(sizeUv[0], sizeUv[1], [128, 128]);
});

test("plane UV mirroring reverses the horizontal span without leaving the atlas", () => {
  const rect = [56, 88, 56, 56];
  const left = mapAtlasPlaneUV(0, 0.5, rect, [256, 256], true);
  const right = mapAtlasPlaneUV(1, 0.5, rect, [256, 256], true);
  assert.equal(left[0], 112 / 256);
  assert.equal(right[0], 56 / 256);
  assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite));
  const face = mapAtlasFaceUV(0.25, 0.75, [10, 20, 30, 40], [256, 256]);
  assert.deepEqual(face, [17.5 / 256, 1 - (30 / 256)]);
});

test("renderer uses per-face UV remapping and dedicated boss rigs without hue tint fallback", () => {
  assert.match(mobSource, /mapAtlasFaceUV\(mirrorX\?1-baseU:baseU/);
  assert.match(mobSource, /addWitherModel\(root\)/);
  assert.match(mobSource, /addWardenModel\(root\)/);
  assert.match(mobSource, /applyPlaneAtlasUV\(membrane,\[56,88,56,56\],\[256,256\],true\)/);
  assert.match(mobSource, /warden_bioluminescent_layer\.png/);
  assert.doesNotMatch(mobSource, /typeHue|color\.setHSL/);
});

test("vanilla core rigs keep entity feet on the ground and preserve mirrored limb UVs", () => {
  assert.match(mobSource, /pos:\[0,12,10\],uv:\[0,0\]/); // pig head from PigModel
  assert.match(mobSource, /pos:\[0,17,-1\],uv:\[18,4\],rotationX:Math\.PI\/2/); // cow body
  assert.match(mobSource, /pos:\[0,8,0\],uv:\[0,9\],rotationX:Math\.PI\/2/); // chicken body
  assert.match(mobSource, /pos:\[0,22,0\],uv:\[0,0\]/); // creeper head
  assert.match(mobSource, /pos:\[0,28,0\],uv:\[0,0\]/); // humanoid head
  assert.match(mobSource, /VILLAGER_RIG_TYPES\.includes\(type as string\)\)return "villager"/);
  assert.match(mobSource, /pos:\[0,29,0\],uv:\[0,0\]/); // Java 26.3 villager head
  assert.match(mobSource, /pos:\[-6,19,1\],uv:\[44,22\]/); // folded villager arm
  assert.match(mobSource, /inflate:\.5/); // robe and hat layer separation
  assert.match(mobSource, /applyBoxAtlasUV\(g,p\.size,p\.uv,DIMS\[t\],!!p\.mirrorX\)/);
});

test("dragon wings remain parented to the torso pivot instead of being detached to the root", () => {
  assert.match(mobSource, /const wing=makePart\(body,\[side\*12,-15,-6\]\)/);
  assert.doesNotMatch(mobSource, /root\.add\(wing\)/);
  assert.match(mobSource, /wings\.push\(wing\);wingTips\.push\(tip\)/);
});

test("villager and wandering trader use their matching 26.3 entity atlases", () => {
  assert.equal(MOB_RENDER_TEXTURES.villager, "villager/villager");
  assert.equal(MOB_RENDER_TEXTURES.wandering_trader, "wandering_trader/wandering_trader");
  assert.deepEqual(MOB_RENDER_OVERLAYS.villager, [
    "villager/type/plains", "villager/profession/nitwit", "villager/profession_level/stone",
  ]);
  assert.deepEqual(MOB_RENDER_OVERLAYS.zombie_villager, [
    "zombie_villager/type/plains", "zombie_villager/profession/nitwit", "zombie_villager/profession_level/stone",
  ]);
  assert.match(mobSource, /VILLAGER_RIG_TYPES/);
  assert.ok(existsSync(path.join(root, "src/client/public/assets/minecraft/textures/entity/villager/villager.png")));
  assert.ok(existsSync(path.join(root, "src/client/public/assets/minecraft/textures/entity/wandering_trader/wandering_trader.png")));
});
