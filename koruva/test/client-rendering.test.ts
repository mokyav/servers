import test from "node:test";
import assert from "node:assert/strict";
import { inventoryPanelVisibility } from "../src/client/inventory-ui";
import { hotbarSlotCount } from "../src/client/ui";
import { World } from "../src/client/world";
import { B } from "../shared/blocks";
import { CHUNK_SIZE, CHUNK_VOLUME, WORLD_HEIGHT } from "../shared/constants";
import { buildChunkMesh } from "../src/client/mesher";
import type { Chunk, World } from "../src/client/world";

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

function makeChunk(blocks: Array<[number, number, number]>) {
  const data = new Uint16Array(CHUNK_VOLUME);
  let maxY = 0;
  for (const [x, y, z] of blocks) {
    data[(y * CHUNK_SIZE + z) * CHUNK_SIZE + x] = B.STONE;
    maxY = Math.max(maxY, y);
  }
  const chunk: Chunk = { cx: 0, cz: 0, data, dirty: true, maxY };
  const world = {
    seed: 12345,
    dimensionId: "minecraft:overworld",
    get(x: number, y: number, z: number) {
      if (y < 0) return B.BEDROCK;
      if (y >= WORLD_HEIGHT) return B.AIR;
      if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) return -1;
      return data[(y * CHUNK_SIZE + z) * CHUNK_SIZE + x] ?? B.AIR;
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
