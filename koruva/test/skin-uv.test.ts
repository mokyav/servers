import assert from "node:assert/strict";
import { LEGACY_MIRROR_COPIES, RIGHT_SIDE, skinFaces, type PartFaces, type SkinFace } from "../src/client/skin-uv";

// Atlas regions from the 64x64 guide: [x, y, w, h]
const REGION: Record<string, [number, number, number, number]> = {
  headBase: [0, 0, 32, 16], headOuter: [32, 0, 32, 16],
  bodyBase: [16, 16, 24, 16], bodyOuter: [16, 32, 24, 16],
  armRBase: [40, 16, 16, 16], armROuter: [40, 32, 16, 16],
  legRBase: [0, 16, 16, 16], legROuter: [0, 32, 16, 16],
  armLBase: [32, 48, 16, 16], armLOuter: [48, 48, 16, 16],
  legLBase: [16, 48, 16, 16], legLOuter: [0, 48, 16, 16],
};
const inside = (f: SkinFace, r: [number, number, number, number]) => f.x >= r[0] && f.y >= r[1] && f.x + f.w <= r[0] + r[2] && f.y + f.h <= r[1] + r[3];
const check = (name: string, faces: SkinFace[]) => {
  assert.equal(faces.length, 6, name);
  for (const f of faces) assert.ok(inside(f, REGION[name]), `${name} face ${JSON.stringify(f)} leaves its atlas region`);
};

for (const model of ["classic", "slim"] as const) {
  const s = skinFaces(model);
  const parts: [string, PartFaces][] = [["head", s.head], ["body", s.body], ["armR", s.armR], ["armL", s.armL], ["legR", s.legR], ["legL", s.legL]];
  for (const [n, p] of parts) { check(n + "Base", p.base); check(n + "Outer", p.outer); }
}

// +X = skin "left" face, -X = skin "right" face; front is +Z.
const c = skinFaces("classic");
assert.equal(RIGHT_SIDE, -1);
assert.deepEqual(c.armR.base[0], { x: 48, y: 20, w: 4, h: 12 }); // inner side of right arm at +X
assert.deepEqual(c.armR.base[1], { x: 40, y: 20, w: 4, h: 12 }); // outer side at -X
assert.deepEqual(c.armL.base[0], { x: 40, y: 52, w: 4, h: 12 }); // outer side of left arm at +X
assert.deepEqual(c.armL.outer[4], { x: 52, y: 52, w: 4, h: 12 }); // left-arm overlay front (was out of range before)
assert.deepEqual(c.head.base[4], { x: 8, y: 8, w: 8, h: 8 });
assert.deepEqual(c.body.outer[4], { x: 20, y: 36, w: 8, h: 12 });
const slim = skinFaces("slim");
assert.deepEqual(slim.armL.outer[3], { x: 55, y: 48, w: 3, h: 4 }); // slim bottom is 3px wide

// Legacy 64x32 → 64x64: mirrored copies must land inside the left limb base regions.
for (const [sx, sy, dx, dy, w, h] of LEGACY_MIRROR_COPIES) {
  const srcOk = inside({ x: sx, y: sy, w, h }, REGION.legRBase) || inside({ x: sx, y: sy, w, h }, REGION.armRBase);
  const dstOk = inside({ x: dx, y: dy, w, h }, REGION.legLBase) || inside({ x: dx, y: dy, w, h }, REGION.armLBase);
  assert.ok(srcOk && dstOk, `bad legacy copy ${[sx, sy, dx, dy]}`);
}
// right outer face (src) must become left outer face (dst) of the left limb
assert.ok(LEGACY_MIRROR_COPIES.some(([sx, sy, dx, dy]) => sx === 40 && sy === 20 && dx === c.armL.base[0].x && dy === 52));
assert.ok(LEGACY_MIRROR_COPIES.some(([sx, sy, dx, dy]) => sx === 0 && sy === 20 && dx === c.legL.base[0].x && dy === 52));
console.log("skin-uv tests passed");
