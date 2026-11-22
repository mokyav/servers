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
  const urgentStart = chunkView.indexOf("// 2) 編集・新規隣接チャンク由来の再メッシュ。");
  const normalStart = chunkView.indexOf("// 3) 未メッシュ/ダーティを近い順に処理", urgentStart);
  assert.ok(urgentStart >= 0 && normalStart > urgentStart);
  const urgent = chunkView.slice(urgentStart, normalStart);
  const normal = chunkView.slice(normalStart, chunkView.indexOf("// 4) 遠いチャンク", normalStart));

  assert.match(urgent, /if \(meshed >= meshBudget\) break/);
  assert.match(urgent, /this\.mesh\(c\);\s*meshed\+\+/);
  assert.match(normal, /if \(meshed >= meshBudget\) break/);
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
  assert.match(mesher, /target\.pos\.push\(x - ox \+ transformed\[0\] \/ 16, y \+ transformed\[1\] \/ 16, z - oz \+ transformed\[2\] \/ 16\)/);
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
