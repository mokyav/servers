import assert from "node:assert/strict";
import { test } from "node:test";
import { LEGACY_MIRROR_COPIES, mirrorLegacySkinPixels } from "../src/client/skin-uv.ts";

test("legacy limb mirror copies each mapped face horizontally from the original pixels", () => {
  const pixels = new Uint8ClampedArray(64 * 64 * 4);
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 29 + 17) & 255;
  const before = pixels.slice();
  mirrorLegacySkinPixels(pixels);
  for (const [sx, sy, dx, dy, w, h] of LEGACY_MIRROR_COPIES) {
    for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
      const from = ((sy + row) * 64 + sx + (w - 1 - col)) * 4;
      const to = ((dy + row) * 64 + dx + col) * 4;
      assert.deepEqual([...pixels.slice(to, to + 4)], [...before.slice(from, from + 4)]);
    }
  }
});

test("legacy limb mirror rejects malformed image buffers before writing", () => {
  const short = new Uint8ClampedArray(64);
  assert.throws(() => mirrorLegacySkinPixels(short), RangeError);
  assert.equal(short.some(Boolean), false);
});
