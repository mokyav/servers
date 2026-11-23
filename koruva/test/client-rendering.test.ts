import test from "node:test";
import assert from "node:assert/strict";
import { inventoryPanelVisibility, shouldCloseInventoryFromKey } from "../src/client/inventory-ui";
import { hotbarSlotCount } from "../src/client/ui";
import { World } from "../src/client/world";
import { B, BLOCKS, MINECRAFT_BLOCK_TO_ID, blockHasPartialModelShape } from "../shared/blocks";
import { resolveBlockTextureResource } from "../shared/legacy-texture-aliases.js";
import { itemDropTexturePath } from "../shared/drop-item-texture.js";
import { CHUNK_SIZE, CHUNK_VOLUME, WORLD_HEIGHT } from "../shared/constants";
import { buildChunkMesh } from "../src/client/mesher";
import type { Chunk } from "../src/client/world";

test("creative catalogue and player inventory never overlap", () => {
  assert.deepEqual(inventoryPanelVisibility("creative"), {
    creativeInventory: true,
    survivalInventory: false,
  });
  assert.deepEqual(inventoryPanelVisibility("creative", true), {
    creativeInventory: false,
    survivalInventory: true,
  });
  for (const mode of ["survival", "adventure"]) {
    assert.deepEqual(inventoryPanelVisibility(mode), {
      creativeInventory: false,
      survivalInventory: true,
    });
  }
  assert.deepEqual(inventoryPanelVisibility("spectator"), {
    creativeInventory: true,
    survivalInventory: false,
  });
});

function makeChunk(blocks: Array<[number, number, number, number?]>, cx = 0, cz = 0) {
  const data = new Uint16Array(CHUNK_VOLUME);
  let maxY = 0;
  for (const [x, y, z, id = B.STONE] of blocks) {
    data[(y * CHUNK_SIZE + z) * CHUNK_SIZE + x] = id;
    maxY = Math.max(maxY, y);
  }
  const chunk: Chunk = { cx, cz, data, dirty: true, maxY };
  const world = {
    seed: 12345,
    dimensionId: "minecraft:overworld",
    get(x: number, y: number, z: number) {
      if (y < 0) return B.BEDROCK;
      if (y >= WORLD_HEIGHT) return B.AIR;
      const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return -1;
      return data[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] ?? B.AIR;
    },
  } as unknown as World;
  return { chunk, world };
}

const fullTile = () => [0, 0, 1, 1] as [number, number, number, number];

test("a chunk border beside an unloaded chunk still emits its visible terrain face", () => {
  const { chunk, world } = makeChunk([[0, 2, 8]]);
  const mesh = buildChunkMesh(world, chunk, fullTile);
  assert.ok(mesh.solid);
  assert.equal(mesh.solid.vertexCount, 24, "one isolated cube must emit all six faces");
  assert.equal(mesh.solid.indices.length, 36);
});

test("adjacent solid blocks keep their shared face culled", () => {
  const { chunk, world } = makeChunk([[0, 2, 8], [1, 2, 8]]);
  const mesh = buildChunkMesh(world, chunk, fullTile);
  assert.ok(mesh.solid);
  assert.equal(mesh.solid.vertexCount, 40, "two adjacent cubes must emit ten outer faces");
  assert.equal(mesh.solid.indices.length, 60);
});


test("HUD count uses the exact hotbar stack rather than the aggregate item total", () => {
  assert.equal(hotbarSlotCount(12, 7, true), 7);
  assert.equal(hotbarSlotCount(12, 0, true), 0);
  assert.equal(hotbarSlotCount(12, 64, false), null);
  assert.equal(hotbarSlotCount(0, 7, true), null);
});

test("unloading a chunk invalidates retained neighbours so their border faces return", () => {
  const world = new World(9876);
  const retained = world.ensureChunk(0, 0);
  world.ensureChunk(1, 0);
  retained.dirty = false;

  const notified: unknown[] = [];
  world.onChunkDirty = (chunk) => notified.push(chunk);
  world.unloadChunk(1, 0);

  assert.equal(world.getChunk(1, 0), undefined);
  assert.equal(retained.dirty, true);
  assert.deepEqual(notified, [retained]);
});


test("non-origin chunk meshes use chunk-local coordinates for every emitted cube vertex", () => {
  const { chunk, world } = makeChunk([[0, 2, 8]], 3, -4);
  const mesh = buildChunkMesh(world, chunk, fullTile);
  assert.ok(mesh.solid);
  const xs = Array.from({ length: mesh.solid.positions.length / 3 }, (_, i) => mesh.solid!.positions[i * 3]);
  const zs = Array.from({ length: mesh.solid.positions.length / 3 }, (_, i) => mesh.solid!.positions[i * 3 + 2]);
  assert.equal(Math.min(...xs), 0);
  assert.equal(Math.max(...xs), 1);
  assert.equal(Math.min(...zs), 8);
  assert.equal(Math.max(...zs), 9);
});


test("legacy and vanilla glass are routed to the translucent render layer", () => {
  assert.equal(BLOCKS[B.GLASS].render, "translucent");
  const vanillaGlass = MINECRAFT_BLOCK_TO_ID["minecraft:glass"];
  assert.ok(vanillaGlass > 0);
  assert.equal(BLOCKS[vanillaGlass].render, "translucent");

  const { chunk, world } = makeChunk([[4, 3, 6, B.GLASS]]);
  const mesh = buildChunkMesh(world, chunk, fullTile);
  assert.equal(mesh.solid, null, "glass must not be emitted into the opaque mesh");
  assert.equal(mesh.translucent?.vertexCount, 24, "isolated glass must emit six translucent faces");
  assert.equal(mesh.liquid, null);
});


test("vanilla cutout plants are emitted to their own model layer", () => {
  const birchSapling = MINECRAFT_BLOCK_TO_ID["minecraft:birch_sapling"];
  assert.ok(birchSapling > 0);
  assert.equal(BLOCKS[birchSapling].render, "cutout");
  const { chunk, world } = makeChunk([[4, 3, 6, birchSapling]]);
  const mesh = buildChunkMesh(world, chunk, fullTile);
  assert.equal(mesh.solid, null, "saplings must not be emitted into the opaque layer");
  assert.ok(mesh.cutout && mesh.cutout.vertexCount > 0, "saplings must use the alpha-tested cutout layer");
});

test("items with an official item sprite use it even when the item is also a placeable block", () => {
  const cake = MINECRAFT_BLOCK_TO_ID["minecraft:cake"];
  assert.ok(cake > 0);
  assert.equal(itemDropTexturePath(BLOCKS[cake]), "item/cake");
  const birchSapling = MINECRAFT_BLOCK_TO_ID["minecraft:birch_sapling"];
  assert.equal(itemDropTexturePath(BLOCKS[birchSapling]), null, "block-only sapling texture should remain a block icon");
});

test("an invalid runtime block ID cannot abort or hide the rest of a chunk mesh", () => {
  const invalidId = BLOCKS.length + 20;
  assert.ok(invalidId < 65535, "test ID must fit the world's Uint16Array");
  const { chunk, world } = makeChunk([[2, 4, 3, invalidId]]);
  const mesh = buildChunkMesh(world, chunk, fullTile);
  assert.ok(mesh.solid);
  assert.equal(mesh.solid.vertexCount, 24, "unknown blocks use a visible placeholder cube");
  assert.equal(mesh.solid.indices.length, 36);
});


test("creative inventory search can type the letter E without closing the inventory", () => {
  assert.equal(shouldCloseInventoryFromKey("KeyE", true), false);
  assert.equal(shouldCloseInventoryFromKey("KeyE", false), true);
  assert.equal(shouldCloseInventoryFromKey("Escape", true), true);
});


function meshHasFaceNormal(mesh: NonNullable<ReturnType<typeof buildChunkMesh>["solid"]>, expected: [number, number, number], planeAxis?: number, planeValue?: number) {
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ids = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
    const p = ids.map(index => [
      mesh.positions[index * 3],
      mesh.positions[index * 3 + 1],
      mesh.positions[index * 3 + 2],
    ]);
    const a = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]];
    const b = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
    const normal = [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const length = Math.hypot(...normal) || 1;
    const dot = normal[0] / length * expected[0] + normal[1] / length * expected[1] + normal[2] / length * expected[2];
    const onPlane = planeAxis === undefined || planeValue === undefined
      || ids.every(index => Math.abs(mesh.positions[index * 3 + planeAxis] - planeValue) < 1e-5);
    if (dot > 0.99 && onPlane) return true;
  }
  return false;
}

test("bottom bedrock keeps its underside because render culling ignores the physics void bedrock sentinel", () => {
  const { chunk, world } = makeChunk([[0, 0, 8, B.BEDROCK]]);
  const mesh = buildChunkMesh(world, chunk, fullTile);
  assert.ok(mesh.solid);
  assert.ok(meshHasFaceNormal(mesh.solid, [0, -1, 0]), "the -Y bottom face must be emitted");
});

test("negative-X chunk boundary emits the west-facing outer face with correct winding", () => {
  const { chunk, world } = makeChunk([[0, 2, 8]], -1, 0);
  const mesh = buildChunkMesh(world, chunk, fullTile);
  assert.ok(mesh.solid);
  assert.ok(meshHasFaceNormal(mesh.solid, [-1, 0, 0]), "the -X face must be emitted with an outward normal");
});


test("all six isolated solid cube faces have outward normals", () => {
  const { chunk, world } = makeChunk([[4, 4, 4, B.STONE]]);
  const mesh = buildChunkMesh(world, chunk, fullTile);
  assert.ok(mesh.solid);
  for (const normal of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]] as [number,number,number][]) {
    assert.ok(meshHasFaceNormal(mesh.solid, normal), `missing outward face ${normal.join(",")}`);
  }
});

test("partial vanilla models with cube fallback shape do not cull adjacent solid faces", () => {
  // Cauldron's official collision mask is partial even though the fallback BlockDef shape is "cube".
  const cauldronId = MINECRAFT_BLOCK_TO_ID["minecraft:cauldron"];
  assert.ok(cauldronId > 0);
  assert.equal(BLOCKS[cauldronId].shape, "cube");
  assert.equal(BLOCKS[cauldronId].render, "opaque");
  assert.ok(blockHasPartialModelShape(cauldronId), "official cauldron model occupancy must be partial");
  const { chunk, world } = makeChunk([[0, 2, 8, cauldronId], [1, 2, 8, B.STONE]]);
  const mesh = buildChunkMesh(world, chunk, fullTile);
  assert.ok(mesh.solid);
  assert.ok(meshHasFaceNormal(mesh.solid, [-1,0,0], 0, 1), "stone's -X face must remain beside the partial cauldron model");
});

test("non-air texture keys without explicit aliases resolve to a vanilla texture path", () => {
  assert.equal(resolveBlockTextureResource("none"), null);
  assert.equal(resolveBlockTextureResource("end_stone"), "minecraft:block/end_stone");
});
