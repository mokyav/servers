import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dimensionChunkStoragePrefix, parseDimensionChunkStorageKey } from "../shared/dimension-chunk-store.js";
import { DIMENSION_IDS } from "../shared/dimensions.js";

test("legacy keys remain Overworld and other dimensions are stored under separate prefixes", () => {
  assert.deepEqual(parseDimensionChunkStorageKey("c:-2,7"), { dimensionId: DIMENSION_IDS.OVERWORLD, chunkKey: "-2,7" });
  assert.equal(dimensionChunkStoragePrefix(DIMENSION_IDS.NETHER), "c:minecraft:the_nether:");
  assert.equal(dimensionChunkStoragePrefix(DIMENSION_IDS.END), "c:minecraft:the_end:");
  assert.deepEqual(parseDimensionChunkStorageKey("c:minecraft:the_nether:-2,7"), { dimensionId: DIMENSION_IDS.NETHER, chunkKey: "-2,7" });
  assert.deepEqual(parseDimensionChunkStorageKey("c:minecraft:the_end:0,0"), { dimensionId: DIMENSION_IDS.END, chunkKey: "0,0" });
});

test("malformed and unknown chunk namespaces are rejected", () => {
  assert.equal(parseDimensionChunkStorageKey("c:minecraft:custom:0,0"), null);
  assert.equal(parseDimensionChunkStorageKey("c:bad"), null);
  assert.equal(parseDimensionChunkStorageKey("other:0,0"), null);
});

test("Worker reads and writes chunk maps through dimension-aware helpers", () => {
  const room = readFileSync(new URL("../src/worker/room.ts", import.meta.url), "utf8");
  assert.match(room, /parseDimensionChunkStorageKey\(storageKey\)/);
  assert.match(room, /chunksForDimension\(parsed\.dimensionId\)/);
  assert.match(room, /chunkWriterForDimension\(id\)\.apply/);
  assert.match(room, /generateDimensionChunk/);
});
