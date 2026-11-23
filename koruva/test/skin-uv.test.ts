import assert from "node:assert/strict";
import { readMinecraftSkin } from "../src/client/skin-upload";
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
// Semi-transparent RGBA pixels must load unchanged; only transparent base-layer pixels
// are made opaque black because the base skin layer is drawn over a black canvas.
const originalDocument = (globalThis as any).document;
const originalCreateImageBitmap = (globalThis as any).createImageBitmap;
const rgba = new Uint8ClampedArray(64 * 64 * 4);
const putPixel = (x: number, y: number, color: [number, number, number, number]) => {
  rgba.set(color, (y * 64 + x) * 4);
};
putPixel(3, 3, [255, 255, 255, 70]); // partially transparent pixel in the base head region
putPixel(40, 40, [255, 255, 255, 70]); // partially transparent pixel in the outer body layer
let written: ImageData | null = null;
const mockContext = {
  imageSmoothingEnabled: true,
  clearRect() {},
  drawImage() {},
  getImageData() { return { data: rgba, width: 64, height: 64 } as ImageData; },
  putImageData(image: ImageData) { written = image; },
};
const mockCanvas = {
  width: 0,
  height: 0,
  getContext() { return mockContext; },
  toDataURL() { return "data:image/png;base64,AA=="; },
};
(globalThis as any).document = { createElement: () => mockCanvas };
(globalThis as any).createImageBitmap = async () => ({ width: 64, height: 64, close() {} });
try {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const pngLikeFile = new Blob([signature]) as File;
  const normalized = await readMinecraftSkin(pngLikeFile);
  assert.equal(normalized, "data:image/png;base64,AA==");
  assert.ok(written, "normalized pixel data must be written to the canvas");
  const data = (written as ImageData).data;
  assert.equal(data[(3 * 64 + 3) * 4 + 3], 70, "base-layer partial alpha must be preserved for black compositing");
  assert.equal(data[(40 * 64 + 40) * 4 + 3], 70, "outer-layer partial alpha must be preserved for blending");
  assert.deepEqual(Array.from(data.slice(3, 4)), [255], "partial alpha does not cause upload rejection");
  assert.deepEqual(Array.from(data.slice(3, 3)), []);
  assert.deepEqual(Array.from(data.slice(0, 4)), [0, 0, 0, 255], "transparent base pixels remain opaque black");
} finally {
  if (originalDocument === undefined) delete (globalThis as any).document;
  else (globalThis as any).document = originalDocument;
  if (originalCreateImageBitmap === undefined) delete (globalThis as any).createImageBitmap;
  else (globalThis as any).createImageBitmap = originalCreateImageBitmap;
}
console.log("skin-uv and alpha-upload tests passed");
