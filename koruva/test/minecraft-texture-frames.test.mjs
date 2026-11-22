import test from "node:test";
import assert from "node:assert/strict";
import { MINECRAFT_BLOCK_TILE_SIZE, minecraftTextureFrameRect, resolveMinecraftTextureAnimation } from "../shared/minecraft-texture-frames.js";

test("vertical vanilla animation strips resolve to one 16x16 frame", () => {
  const layout = resolveMinecraftTextureAnimation(16, 512, { animation: { frametime: 2 } });
  assert.equal(layout.frameWidth, 16);
  assert.equal(layout.frameHeight, 16);
  assert.equal(layout.frames.length, 32);
  assert.deepEqual(minecraftTextureFrameRect(layout, 0), { x: 0, y: 0, width: 16, height: 16 });
});

test("Minecraft .mcmeta frame order and per-frame durations are preserved", () => {
  const layout = resolveMinecraftTextureAnimation(16, 512, {
    animation: { frametime: 4, frames: [16, { index: 17, time: 2 }, 0] },
  });
  assert.deepEqual(layout.frames, [
    { index: 16, durationMs: 200 },
    { index: 17, durationMs: 100 },
    { index: 0, durationMs: 200 },
  ]);
  assert.deepEqual(minecraftTextureFrameRect(layout, layout.frames[0].index), { x: 0, y: 256, width: 16, height: 16 });
  assert.deepEqual(minecraftTextureFrameRect(layout, layout.frames[1].index), { x: 0, y: 272, width: 16, height: 16 });
});

test("higher-resolution square client textures are resampled into a single tile", () => {
  const layout = resolveMinecraftTextureAnimation(32, 32, null);
  assert.equal(layout.frameWidth, 32);
  assert.equal(layout.frameHeight, 32);
  assert.deepEqual(minecraftTextureFrameRect(layout, 0), { x: 0, y: 0, width: 32, height: 32 });
});

test("horizontal animation sheets use square frames and invalid frame indexes are safe", () => {
  const layout = resolveMinecraftTextureAnimation(128, 16, { animation: { frames: [7, 0] } });
  assert.equal(layout.frameWidth, 16);
  assert.equal(layout.columns, 8);
  assert.deepEqual(minecraftTextureFrameRect(layout, layout.frames[0].index), { x: 112, y: 0, width: 16, height: 16 });
  assert.deepEqual(minecraftTextureFrameRect(layout, 99), { x: 0, y: 0, width: 16, height: 16 });
});


test("animated vanilla texture metadata preserves interpolation option", () => {
  const layout = resolveMinecraftTextureAnimation(16, 80, { animation: { frametime: 10, interpolate: true } });
  assert.equal(layout.interpolate, true);
  assert.equal(layout.frames.length, 5);
  assert.deepEqual(minecraftTextureFrameRect(layout, layout.frames[0].index), { x: 0, y: 0, width: 16, height: 16 });
});

test("vanilla block atlas output tile is fixed to the Java 16x16 pixel standard", () => {
  assert.equal(MINECRAFT_BLOCK_TILE_SIZE, 16);
});
