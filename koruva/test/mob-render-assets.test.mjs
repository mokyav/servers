import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MOB_RENDER_TEXTURES,
  MOB_RENDER_TEXTURE_SIZES,
  MOB_RENDER_HEIGHTS,
  MOB_MODEL_BASE_HEIGHTS,
  MOB_RENDER_OVERLAYS,
  PIGLIN_RIG_TYPES,
  atlasBoxFaceRects,
  mapAtlasFaceUV,
  mapAtlasPlaneUV,
} from "../shared/mob-render-assets.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mobSource = readFileSync(path.join(root, "src/client/mobs.ts"), "utf8");
const entitiesSource = readFileSync(path.join(root, "shared/entities.ts"), "utf8");
const mobTypesDeclaration = entitiesSource.match(/export const MOB_TYPES = \[([\s\S]*?)\] as const/);
assert.ok(mobTypesDeclaration, "MOB_TYPES declaration not found");
const registeredMobTypes = [...mobTypesDeclaration[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
const pngSize = (file) => {
  const data = readFileSync(file);
  assert.equal(data.toString("hex", 0, 8), "89504e470d0a1a0a", `${file} is not a PNG`);
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
};

test("all 88 registered mobs have an explicit existing Java 26.3 texture and exact atlas dimensions", () => {
  assert.equal(registeredMobTypes.length, 88, "source mob registry should contain 88 spawn-egg mobs");
  assert.deepEqual(Object.keys(MOB_RENDER_TEXTURES).sort(), [...registeredMobTypes].sort(), "texture map must cover exactly every registered mob");
  assert.deepEqual(Object.keys(MOB_RENDER_TEXTURE_SIZES).sort(), [...registeredMobTypes].sort(), "size map must cover exactly every registered mob");
  for (const mob of registeredMobTypes) {
    const resource = MOB_RENDER_TEXTURES[mob];
    const expectedSize = MOB_RENDER_TEXTURE_SIZES[mob];
    assert.ok(resource, `${mob} texture mapping missing`);
    assert.ok(Array.isArray(expectedSize) && expectedSize.length === 2 && expectedSize.every((v) => Number.isInteger(v) && v > 0), `${mob} texture size metadata invalid`);
    const file = path.join(root, "src/client/public/assets/minecraft/textures/entity", `${resource}.png`);
    assert.ok(existsSync(file), `${mob} texture missing: ${resource}`);
    assert.deepEqual(pngSize(file), expectedSize, `${mob} texture dimensions differ from source-client manifest`);
  }
  for (const [mob, overlays] of Object.entries(MOB_RENDER_OVERLAYS)) {
    for (const resource of overlays) {
      const file = path.join(root, "src/client/public/assets/minecraft/textures/entity", `${resource}.png`);
      assert.ok(existsSync(file), `${mob} overlay missing: ${resource}`);
      assert.deepEqual(pngSize(file), MOB_RENDER_TEXTURE_SIZES[mob], `${mob} overlay atlas dimensions`);
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
  const dimensions = { pig: [64, 64], cow: [64, 64], chicken: [64, 32], creeper: [64, 32], zombie: [64, 64], skeleton: [64, 32], villager: [64, 64], piglin: [64, 64], enderman: [64, 32], spider: [64, 32], blaze: [64, 32], ghast: [64, 32], slime: [64, 32], magma_cube: [64, 64], silverfish: [64, 32], endermite: [64, 32] };
  const starts = [...modelSection.matchAll(/^\s*(pig|cow|chicken|creeper|zombie|skeleton|villager|piglin|enderman|spider|blaze|ghast|slime|magma_cube|silverfish|endermite):\[/gm)];
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
  assert.match(mobSource, /mapAtlasFaceUV\(p\.mirrorX\?1-baseU:baseU/);
  assert.match(mobSource, /MOB_RENDER_TEXTURE_SIZES/);
  assert.match(mobSource, /applyUV\(g,key,p,info\.type\)/);
  assert.doesNotMatch(mobSource, /`\/assets\/mobs\/\$\{key\}\.png`/, "renderer must not request missing generic texture files");
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
  assert.match(mobSource, /PIGLIN_RIG_TYPES\.includes\(type as string\)\)return "piglin"/);
  assert.match(mobSource, /pos:\[0,29,0\],uv:\[0,0\]/); // Java 26.3 villager head
  assert.match(mobSource, /pos:\[-6,19,1\],uv:\[44,22\]/); // folded villager arm
  assert.match(mobSource, /inflate:\.5/); // robe and hat layer separation
  assert.match(mobSource, /applyPlaneAtlasUV\(brimGeometry,\[30,47,16,1\],\[64,64\]\)/); // villager hat brim
  assert.match(mobSource, /atlasBoxFaceRects\(p\.size,p\.uv,sourceSize\)/);
  assert.match(mobSource, /const scaleU=textureSize\[0\]\/sourceSize\[0\],scaleV=textureSize\[1\]\/sourceSize\[1\]/);
});

test("dedicated 26.3 mob families route to the correct rigs and keep family UVs inside their real atlases", () => {
  assert.match(mobSource, /if\(type==="enderman"\)return "enderman"/);
  assert.match(mobSource, /if\(type==="spider"\|\|type==="cave_spider"\)return "spider"/);
  assert.match(mobSource, /if\(type==="blaze"\)return "blaze"/);
  assert.match(mobSource, /if\(type==="ghast"\)return "ghast"/);
  assert.match(mobSource, /if\(type==="slime"\)return "slime"/);
  assert.match(mobSource, /if\(type==="magma_cube"\)return "magma_cube"/);
  assert.match(mobSource, /if\(type==="silverfish"\)return "silverfish"/);
  assert.match(mobSource, /if\(type==="endermite"\)return "endermite"/);

  assert.equal(MOB_RENDER_TEXTURES.enderman, "enderman/enderman");
  assert.equal(MOB_RENDER_TEXTURES.spider, "spider/spider");
  assert.equal(MOB_RENDER_TEXTURES.cave_spider, "spider/cave_spider");
  assert.equal(MOB_RENDER_TEXTURES.blaze, "blaze/blaze");
  assert.equal(MOB_RENDER_TEXTURES.ghast, "ghast/ghast");
  assert.equal(MOB_RENDER_TEXTURES.slime, "slime/slime");
  assert.equal(MOB_RENDER_TEXTURES.magma_cube, "slime/magmacube");
  assert.equal(MOB_RENDER_TEXTURES.silverfish, "silverfish/silverfish");
  assert.equal(MOB_RENDER_TEXTURES.endermite, "endermite/endermite");

  assert.deepEqual(MOB_RENDER_OVERLAYS.enderman, ["enderman/enderman_eyes"]);
  assert.deepEqual(MOB_RENDER_OVERLAYS.spider, ["spider/spider_eyes"]);
  assert.equal(MOB_MODEL_BASE_HEIGHTS.ghast, 28 / 16, "ghast model extent before vanilla layer scaling");
  assert.equal(MOB_RENDER_HEIGHTS.ghast, (28 / 16) * 4.5, "GhastModel applies a 4.5x MeshTransformer");
  assert.deepEqual(MOB_RENDER_HEIGHTS, {
    enderman: 2.9, spider: 0.9, cave_spider: 0.5, blaze: 1.8, ghast: 7.875,
    slime: 1, magma_cube: 1, silverfish: 0.4, endermite: 0.4,
  });

  // UV rectangles below are from the Java 26.3 model-layer definitions.
  for (const [size, uv, dims] of [
    [[2,30,2],[56,0],[64,32]], // Enderman long arm/leg
    [[16,2,2],[18,0],[64,32]], // Spider leg
    [[2,8,2],[0,16],[64,32]], // Blaze rod
    [[16,16,16],[0,0],[64,32]], // Ghast base model atlas; the PNG is 2x larger
    [[8,8,8],[0,0],[64,32]], // Slime outer cube
    [[8,1,8],[32,27],[64,64]], // Magma Cube final slice
    [[6,4,3],[0,9],[64,32]], // Silverfish mid-body segment
    [[6,4,5],[0,5],[64,32]], // Endermite mid-body segment
  ]) assert.equal(atlasBoxFaceRects(size, uv, dims).length, 6);

  assert.ok(mobSource.includes("const BLAZE_RODS:Part[]=Array.from({length:12}"));
  assert.ok(mobSource.includes("const GHAST_TENTACLE_LENGTHS=[8,13,9,11,11,10,12,9,12]"));
  assert.ok(mobSource.includes("const MAGMA_CUBE_SLICES:Part[]=Array.from({length:8}"));
  assert.ok(mobSource.includes("const SILVERFISH_SIZES:[number,number,number][]=[[3,2,2],[4,3,2],[6,4,3],[3,3,3],[2,2,3],[2,1,2],[1,1,2]]"));
  assert.ok(mobSource.includes("const ENDERMITE_SIZES:[number,number,number][]=[[4,3,2],[6,4,5],[3,3,1],[1,2,1]]"));
  assert.ok(mobSource.split("pivot:[").length - 1 >= 25, "articulated model families must have explicit pivots");
  assert.ok(mobSource.includes("parent.rotation.set(p.rotationX??0,p.rotationY??0,p.rotationZ??0)"));
  assert.ok(mobSource.includes("const yaw=-Math.cos(phase*2+phaseOffsets[pair])*.4*speed"));
  assert.ok(mobSource.includes("const roll=Math.abs(Math.sin(phase+phaseOffsets[pair])*.4)*speed"));
  assert.ok(mobSource.includes("m.rotation.x=.2*Math.sin(ageInTicks*.3+i)+.4"));
  assert.ok(mobSource.includes("const angularVelocity=ring===0?-.1*Math.PI:ring===1?.03*Math.PI:-.05*Math.PI"));
  assert.ok(mobSource.includes("m.position.set(Math.cos(angle)*radius/16,(24-modelY)/16,Math.sin(angle)*radius/16)"));
});

test("dragon wings remain parented to the torso pivot instead of being detached to the root", () => {
  assert.match(mobSource, /const wing=makePart\(body,\[side\*12,-15,-6\]\)/);
  assert.doesNotMatch(mobSource, /root\.add\(wing\)/);
  assert.match(mobSource, /wings\.push\(wing\);wingTips\.push\(tip\)/);
});

test("piglin variants use their dedicated 26.3 PiglinModel UV rig", () => {
  assert.deepEqual(PIGLIN_RIG_TYPES, ["piglin", "piglin_brute", "zombified_piglin"]);
  assert.equal(MOB_RENDER_TEXTURES.piglin, "piglin/piglin");
  assert.equal(MOB_RENDER_TEXTURES.piglin_brute, "piglin/piglin_brute");
  assert.equal(MOB_RENDER_TEXTURES.zombified_piglin, "piglin/zombified_piglin");
  assert.match(mobSource, /size:\[10,8,8\],pos:\[0,28,0\],uv:\[0,0\]/); // 26.3 piglin head
  assert.match(mobSource, /size:\[4,4,1\],pos:\[0,30,4\.5\],uv:\[31,1\]/); // snout
  assert.match(mobSource, /uv:\[51,6\],rotationZ:-Math\.PI\/6/); // left ear
  assert.match(mobSource, /uv:\[39,6\],rotationZ:Math\.PI\/6/); // right ear
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

test("removing or clearing mobs disposes per-instance GPU resources without disposing shared materials", () => {
  assert.match(mobSource, /private disposeEntry\(entry:MobEntry\)/);
  assert.match(mobSource, /mesh\.geometry\.dispose\(\)/);
  assert.match(mobSource, /!sharedMaterials\.has\(material\)\)material\.dispose\(\)/);
  assert.match(mobSource, /this\.disposeEntry\(e\)/);
  assert.match(mobSource, /clear\(\)\{for\(const id of \[\.\.\.this\.entries\.keys\(\)\]\)this\.remove\(id\);\}/);
});
