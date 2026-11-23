import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("block targeting ray starts at the rendered camera and follows its world direction", () => {
  const main = read("../src/client/main.ts");
  const start = main.indexOf("  updateTarget(now: number) {");
  const end = main.indexOf("\n  updateOwnModel(", start);
  assert.ok(start >= 0 && end > start, "updateTarget method must exist");
  const aim = main.slice(start, end);

  assert.match(aim, /this\.camera\.updateWorldMatrix\(true, false\)/);
  assert.match(aim, /const origin = this\.camera\.position/);
  assert.match(aim, /this\.camera\.getWorldDirection\(new THREE\.Vector3\(\)\)/);
  assert.match(aim, /raycast\(this\.world, origin\.x, origin\.y, origin\.z, direction\.x, direction\.y, direction\.z, REACH\)/);
  assert.doesNotMatch(aim, /this\.body\.x|this\.body\.y|this\.body\.z|this\.yaw|this\.pitch/,
    "target ray must not use a separate player-body origin or independently reconstructed direction");
});

test("urgent chunk remeshing shares the per-frame mesh budget", () => {
  const chunkView = read("../src/client/chunkview.ts");
  const urgentStart = chunkView.indexOf("// 2) 表示中の既存チャンクだけを緊急再メッシュ。");
  const normalStart = chunkView.indexOf("// 3) 未メッシュ/ダーティを近い順に処理", urgentStart);
  assert.ok(urgentStart >= 0 && normalStart > urgentStart);
  const urgent = chunkView.slice(urgentStart, normalStart);
  const normal = chunkView.slice(normalStart, chunkView.indexOf("// 4) 遠いチャンク", normalStart));

  assert.match(urgent, /if \(meshed >= meshBudget\) break/);
  assert.match(urgent, /this\.mesh\(c\);\s*meshed\+\+/);
  assert.match(normal, /if \(meshed >= meshBudget\) break/);
});


test("cutout block models render both sides without entering the blended transparency layer", () => {
  const mesher = read("../src/client/mesher.ts");
  const chunkView = read("../src/client/chunkview.ts");
  assert.match(mesher, /def\.render === "cutout" \? cutout/);
  assert.match(mesher, /cutout: cutout\.finish\(\)/);
  assert.match(chunkView, /this\.cutoutMat = new THREE\.ShaderMaterial/);
  assert.match(chunkView, /side: THREE\.DoubleSide/);
  assert.match(chunkView, /e\.cutout = this\.swap\(e\.cutout, res\.cutout, this\.cutoutMat/);
});

test("V cycles through first person, rear third person, and front third person", () => {
  const main = read("../src/client/main.ts");
  assert.match(main, /KeyQ/);
  assert.match(main, /dropSelectedItem\(e\.ctrlKey\)/);
  assert.match(main, /drop-item-result/);
  assert.match(main, /thirdPersonFront = false/);
  assert.match(main, /三人称視点（前）/);
  assert.match(main, /this\.yaw \+ \(this\.thirdPersonFront \? Math\.PI : 0\)/);
  assert.match(main, /this\.camera\.position\.set\(cx \+ ox \* dist, cy \+ oy \* dist, cz \+ oz \* dist\)/);
});

test("initial loading waits for every chunk in the visible streaming ring", () => {
  const main = read("../src/client/main.ts");
  const chunkView = read("../src/client/chunkview.ts");
  assert.match(main, /readyRatio\(this\.body\.x, this\.body\.z, this\.view\.renderDistance\)/);
  assert.match(main, /if \(r >= 1\) this\.finishLoading\(\)/);
  assert.doesNotMatch(main, /r >= 0\.99 \|\| performance\.now\(\) - this\.loadStart > 10000/);
  assert.match(chunkView, /for \(const \[dx, dz\] of this\.ring\(radius\)\)/);
  assert.match(chunkView, /return total > 0 \? ready \/ total : 1/);
});


test("chunk vertices stay local while the renderer applies the chunk transform once", () => {
  const mesher = read("../src/client/mesher.ts");
  const chunkView = read("../src/client/chunkview.ts");
  assert.match(mesher, /target\.pos\.push\(px - ox, py, pz - oz\)/);
  assert.match(mesher, /faceTarget\.pos\.push\(x - ox \+ transformed\[0\] \/ 16, y \+ transformed\[1\] \/ 16, z - oz \+ transformed\[2\] \/ 16\)/);
  assert.match(chunkView, /m\.position\.set\(c\.cx \* CHUNK_SIZE, 0, c\.cz \* CHUNK_SIZE\)/);
});

test("translucent block meshes use blending without writing depth", () => {
  const chunkView = read("../src/client/chunkview.ts");
  const blocks = read("../shared/blocks.ts");
  const main = read("../src/client/main.ts");
  const drops = read("../src/client/drops.ts");
  const remote = read("../src/client/remote.ts");
  assert.match(blocks, /render: "translucent"/);
  assert.match(chunkView, /uOpacity: \{ value: 0\.42 \}/);
  assert.match(chunkView, /transparent: true, depthWrite: false/);
  assert.match(chunkView, /res\.translucent/);
  assert.match(main, /renderer\.outputColorSpace = THREE\.SRGBColorSpace/);
  assert.match(drops, /tex\.colorSpace = THREE\.SRGBColorSpace/);
  assert.match(drops, /texture\.colorSpace = THREE\.SRGBColorSpace/);
  assert.match(main, /texture\.colorSpace = THREE\.SRGBColorSpace/);
  assert.match(remote, /t\.colorSpace = THREE\.SRGBColorSpace/);
});


test("model-less runtime blocks fall back instead of silently omitting their geometry", () => {
  const mesher = read("../src/client/mesher.ts");
  assert.match(mesher, /let emittedFace = false/);
  assert.match(mesher, /emittedFace = true/);
  assert.match(mesher, /return emittedFace/);
  assert.match(mesher, /const def = BLOCKS\[id\] \?\? BLOCKS\[3\]/);
});

test("merged chunk meshes are not discarded by camera-side frustum culling", () => {
  const chunkView = read("../src/client/chunkview.ts");
  assert.match(chunkView, /m\.frustumCulled = false/);
});

test("chunk frustum bounds come from actual mesh vertices", () => {
  const chunkView = read("../src/client/chunkview.ts");
  assert.match(chunkView, /g\.computeBoundingBox\(\)/);
  assert.match(chunkView, /g\.computeBoundingSphere\(\)/);
  assert.doesNotMatch(chunkView, /g\.boundingSphere = new THREE\.Sphere/);
});

test("fog end distance extends beyond the outer chunk ring", () => {
  const main = read("../src/client/main.ts");
  assert.match(main, /const far = Math\.max\(64, \(this\.settings\.rd \+ 3\) \* 16\)/);
  for (const rd of [2, 6, 12]) {
    const far = Math.max(64, (rd + 3) * 16);
    assert.ok(far > rd * 16, `fog end must not stop before render distance ${rd}`);
  }
});


test("urgent remeshing cannot spend the frame budget on offscreen or never-meshed chunks", () => {
  const chunkView = read("../src/client/chunkview.ts");
  const urgentStart = chunkView.indexOf("// 2) 表示中の既存チャンクだけを緊急再メッシュ。");
  const normalStart = chunkView.indexOf("// 3) 未メッシュ/ダーティ", urgentStart);
  assert.ok(urgentStart >= 0 && normalStart > urgentStart);
  const urgent = chunkView.slice(urgentStart, normalStart);
  assert.match(urgent, /const inVisibleRing = dx \* dx \+ dz \* dz <= rd \* rd \+ rd/);
  assert.match(urgent, /!this\.entries\.has\(key\)/);
  assert.match(urgent, /if \(c\.dirty\)/);
});


test("solid block faces render from either winding so X and bottom faces cannot disappear", () => {
  const chunkView = read("../src/client/chunkview.ts");
  const start = chunkView.indexOf("this.solidMat = new THREE.ShaderMaterial");
  const end = chunkView.indexOf("this.cutoutMat =", start);
  assert.ok(start >= 0 && end > start, "solid chunk material must exist");
  assert.match(chunkView.slice(start, end), /side: THREE\.DoubleSide/);
});

test("the E inventory shortcut ignores text-entry targets while typing", () => {
  const main = read("../src/client/main.ts");
  const start = main.indexOf('if (this.state === "inventory") {');
  const end = main.indexOf('if (this.state === "paused")', start);
  assert.ok(start >= 0 && end > start, "inventory keyboard handler must exist");
  const handler = main.slice(start, end);
  assert.match(handler, /target instanceof HTMLInputElement/);
  assert.match(handler, /target instanceof HTMLTextAreaElement/);
  assert.match(handler, /shouldCloseInventoryFromKey\(e\.code, isTextEntry\)/);
});


test("solid, cutout, and blended block textures use different alpha policies", () => {
  const chunkView = read("../src/client/chunkview.ts");
  assert.match(chunkView, /uniform float uAlphaMode/);
  assert.match(chunkView, /uAlphaMode > 0\.5 && uAlphaMode < 1\.5 && t\.a < 0\.5/);
  assert.match(chunkView, /uAlphaMode: \{ value: 0 \}/);
  assert.match(chunkView, /uAlphaMode: \{ value: 1 \}/);
  assert.match(chunkView, /uAlphaMode: \{ value: 2 \}/);
  assert.match(chunkView, /float outAlpha = uAlphaMode < 1\.5 \? 1\.0 : t\.a \* uOpacity/);
});
