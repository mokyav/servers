import { World } from "../src/client/world";
import { collides, moveBody, raycast, type Body } from "../src/client/physics";
import { getModelCollisionMask, modelCollisionCellIsSolid } from "../src/client/model-collision";
import { B, BLOCK_COUNT, BLOCKS, MINECRAFT_BLOCK_TO_ID, MINECRAFT_ITEM_TO_RUNTIME_ID, blockHasPartialModelShape, blockPlacementId } from "../shared/blocks";
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok  ", m); };
const w = new World(1);
for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) { const c = w.ensureChunk(cx, cz); c.data.fill(0); for (let i = 0; i < 256; i++) c.data[i] = B.STONE; } // y=0 の床のみ
const body: Body = { x: 0.5, y: 10, z: 0.5, vx: 0, vy: 0, vz: 0, onGround: false };
for (let i = 0; i < 200; i++) { body.vy -= 28 * 0.016; moveBody(w, body, 0.016); }
ok(Math.abs(body.y - 1) < 0.01 && body.onGround, `着地 y=${body.y.toFixed(3)}`);
w.setBlock(3, 1, 0, B.STONE); w.setBlock(3, 2, 0, B.STONE);
body.x = 0.5; body.z = 0.5; body.vx = 6;
for (let i = 0; i < 100; i++) moveBody(w, body, 0.016);
ok(body.x < 3 - 0.3 + 0.001, `壁で停止 x=${body.x.toFixed(3)}`);
const h = raycast(w, 0.5, 2.6, 0.5, 1, 0, 0, 6);
ok(!!h && h.x === 3 && h.nx === -1 && h.y === 2, `レイキャスト ${JSON.stringify(h)}`);
const h2 = raycast(w, 0.5, 5, 0.5, 0, -1, 0, 6);
ok(!!h2 && h2.y === 0 && h2.ny === 1, "下向きレイ");
// 高速落下でもすり抜けない
body.y = 50; body.vy = -300; body.x = 8; body.z = 8; body.vx = 0;
moveBody(w, body, 0.1);
ok(body.y >= 1 - 0.001, `高速落下でもすり抜けない y=${body.y.toFixed(2)}`);
// 4×4×4 collision-shape regressions: slabs and directional stairs are not full cubes.
const shaped = new World(2);
const shapeChunk = shaped.ensureChunk(0, 0); shapeChunk.data.fill(0);
shaped.setBlock(4, 1, 0, B.OAK_SLAB);
ok(!collides(shaped, 4.5, 1.51, 0.5), "ハーフブロック上面より上は通過できる");
ok(collides(shaped, 4.5, 1.4, 0.5), "ハーフブロック内部は衝突する");
const slabFall: Body = { x: 4.5, y: 3, z: 0.5, vx: 0, vy: 0, vz: 0, onGround: false };
for (let i = 0; i < 80; i++) { slabFall.vy -= 28 * 0.016; moveBody(shaped, slabFall, 0.016); }
ok(Math.abs(slabFall.y - 1.5) < 0.01 && slabFall.onGround, `ハーフブロック上面の高さで着地 y=${slabFall.y.toFixed(3)}`);
shaped.setBlock(2, 1, 2, B.OAK_STAIRS); // north-facing: upper half is on the south side
ok(!collides(shaped, 2.5, 1.5, 2.15), "階段の欠けている上段側は通過できる");
ok(collides(shaped, 2.5, 1.5, 2.85), "階段の上段側は衝突する");
// All four stair facings must leave the correct upper-half gap and block the back half.
const facingCases = [
  { id: B.OAK_STAIRS, gap: [0.5, 0.15, 0.5] as const, solid: [0.5, 0.85, 0.5] as const },
  { id: B.OAK_STAIRS + 1, gap: [0.85, 0.5, 0.5] as const, solid: [0.15, 0.5, 0.5] as const },
  { id: B.OAK_STAIRS + 2, gap: [0.5, 0.85, 0.5] as const, solid: [0.5, 0.15, 0.5] as const },
  { id: B.OAK_STAIRS + 3, gap: [0.15, 0.5, 0.5] as const, solid: [0.85, 0.5, 0.5] as const },
];
for (const facing of facingCases) {
  const fw = new World(20 + facing.id); const fc = fw.ensureChunk(0, 0); fc.data.fill(0);
  fw.setBlock(4, 1, 4, facing.id);
  ok(!collides(fw, 4 + facing.gap[0], 1.5, 4 + facing.gap[1]), `階段の向き${facing.id - B.OAK_STAIRS}の欠けた側`);
  ok(collides(fw, 4 + facing.solid[0], 1.5, 4 + facing.solid[1]), `階段の向き${facing.id - B.OAK_STAIRS}の上段側`);
}
// Common non-cube Java block shapes now have collision volumes instead of full-cube/pass-through behavior.
const oakDoor = MINECRAFT_BLOCK_TO_ID["minecraft:oak_door"];
const oakTrapdoor = MINECRAFT_BLOCK_TO_ID["minecraft:oak_trapdoor"];
const oakFence = MINECRAFT_BLOCK_TO_ID["minecraft:oak_fence"];
const glassPane = MINECRAFT_BLOCK_TO_ID["minecraft:glass_pane"];
const whiteCarpet = MINECRAFT_BLOCK_TO_ID["minecraft:white_carpet"];
const doorWorld = new World(31); doorWorld.ensureChunk(0, 0).data.fill(0); doorWorld.setBlock(4, 1, 4, oakDoor);
ok(!!BLOCKS[oakDoor] && BLOCKS[oakDoor].shape === "door" && collides(doorWorld, 4.1, 1, 4.1), "ドアは薄い縦面で衝突する");
const trapWorld = new World(32); trapWorld.ensureChunk(0, 0).data.fill(0); trapWorld.setBlock(4, 1, 4, oakTrapdoor);
ok(!!BLOCKS[oakTrapdoor] && BLOCKS[oakTrapdoor].shape === "trapdoor" && collides(trapWorld, 4.5, 1.1, 4.5) && !collides(trapWorld, 4.5, 1.3, 4.5), "トラップドアは薄い水平面として衝突する");
const fenceWorld = new World(33); fenceWorld.ensureChunk(0, 0).data.fill(0); fenceWorld.setBlock(4, 1, 4, oakFence);
ok(!!BLOCKS[oakFence] && BLOCKS[oakFence].shape === "fence" && collides(fenceWorld, 4.5, 1, 4.5), "フェンスの支柱は衝突する");
const paneWorld = new World(34); paneWorld.ensureChunk(0, 0).data.fill(0); paneWorld.setBlock(4, 1, 4, glassPane);
ok(!!BLOCKS[glassPane] && BLOCKS[glassPane].shape === "pane" && collides(paneWorld, 4.5, 1, 4.5), "ガラス板は中央の薄い十字形で衝突する");
const carpetWorld = new World(35); carpetWorld.ensureChunk(0, 0).data.fill(0); carpetWorld.setBlock(4, 1, 4, whiteCarpet);
ok(!!BLOCKS[whiteCarpet] && BLOCKS[whiteCarpet].shape === "carpet" && collides(carpetWorld, 4.5, 1.02, 4.5) && !collides(carpetWorld, 4.5, 1.1, 4.5), "カーペットは薄い高さの衝突判定を持つ");
// Modern model-based blocks can be visually partial even when their broad shape is "cube".
const lanternId = MINECRAFT_BLOCK_TO_ID["minecraft:lantern"];
const lanternWorld = new World(36); lanternWorld.ensureChunk(0, 0).data.fill(0);
lanternWorld.setBlock(4, 1, 4, lanternId);
ok(BLOCKS[lanternId]?.shape === "cube" && blockHasPartialModelShape(lanternId), "ランタンは部分モデル衝突マスクを使う");
ok(!collides(lanternWorld, 4.5, 1.75, 4.5), "ランタンのモデル上部の空間ではプレイヤーが衝突しない");
ok(collides(lanternWorld, 4.5, 1.05, 4.5), "ランタンの下部モデルにはプレイヤーが衝突する");
const lanternMask = getModelCollisionMask(lanternId);
ok(!!lanternMask && !modelCollisionCellIsSolid(lanternMask, 4, 2, 8) && modelCollisionCellIsSolid(lanternMask, 5, 2, 8), "モデルの座標を1/16ブロック単位で衝突マスクに反映する");
ok(!collides(lanternWorld, 4.0, 1.05, 4.5), "ランタンの見た目より外側に当たり判定がはみ出さない");
ok(collides(lanternWorld, 4.1, 1.05, 4.5), "ランタンの見た目に重なる位置では衝突する");
ok(!raycast(lanternWorld, 4.28, 1.2, 4.5, -1, 0, 0, 0.2), "ランタンの見た目より外側からは選択できない");
const movingBesideLantern: Body = { x: 3.5, y: 1.05, z: 4.5, vx: 5, vy: 0, vz: 0, onGround: false };
moveBody(lanternWorld, movingBesideLantern, 0.2);
ok(movingBesideLantern.x > 4.0 && movingBesideLantern.x < 4.02, `ランタンの見た目の輪郭で移動が止まる x=${movingBesideLantern.x.toFixed(3)}`);

// Loading a neighbour must invalidate the already-meshed chunk at their shared edge.
const edgeWorld = new World(37);
const existingEdge = edgeWorld.ensureChunk(0, 0);
existingEdge.dirty = false;
let edgeInvalidated = false;
edgeWorld.onChunkDirty = (chunk) => { if (chunk === existingEdge) edgeInvalidated = true; };
edgeWorld.ensureChunk(1, 0);
ok(existingEdge.dirty && edgeInvalidated, "隣接チャンク生成時に既存チャンクの境界メッシュを再生成対象にする");

const sword = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:diamond_sword"];
ok(sword > BLOCK_COUNT && BLOCKS[sword].itemOnly === true && blockPlacementId(sword, 0) === 0, "非ブロックアイテムはワールドに設置できない");
// Sneak edge clamp: a player on a one-block platform must not walk off its edge.
shaped.setBlock(0, 1, 0, B.STONE);
const sneaking: Body = { x: 0.5, y: 2, z: 0.5, vx: 8, vy: -0.01, vz: 0, onGround: true };
for (let i = 0; i < 12; i++) moveBody(shaped, sneaking, 0.025, true);
ok(sneaking.x < 1.36, `スニーク中は足場の端で止まる x=${sneaking.x.toFixed(3)}`);
console.log(fail ? "FAILED" : "ALL PASSED"); process.exit(fail ? 1 : 0);
