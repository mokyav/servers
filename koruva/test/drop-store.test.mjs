import test from "node:test";
import assert from "node:assert/strict";
import { dropsForDimension, normalizeSavedDrops } from "../shared/drop-store.js";

test("saved drops discard malformed, expired, duplicate, future, and invalid-item entries", () => {
  const now = 1_000_000;
  const valid = { eid: "drop_1", x: 2, y: 29, z: -4, b: 5, at: now - 10_000 };
  const raw = [valid, { ...valid, x: 99 },
    { eid: "expired", x: 0, y: 1, z: 0, b: 1, at: now - 300_001 },
    { eid: "bad/id", x: 0, y: 1, z: 0, b: 1, at: now },
    { eid: "bad-number", x: Infinity, y: 1, z: 0, b: 1, at: now },
    { eid: "bad-item", x: 0, y: 1, z: 0, b: 99, at: now },
    { eid: "far-future", x: 0, y: 1, z: 0, b: 1, at: now + 60_001 }, null];
  assert.deepEqual(normalizeSavedDrops(raw, { now, isValidItem: (id) => id < 10 }), [{ ...valid, count: 1, dimensionId: "minecraft:overworld" }]);
  assert.equal(raw.length, 8, "source array is not mutated");
});

test("saved drops keep only newest valid entries within cap", () => {
  const now = 1_000_000;
  const raw = [1, 2, 3, 4].map((n) => ({ eid: `d${n}`, x: n, y: 2, z: 3, b: n, at: now }));
  assert.deepEqual(normalizeSavedDrops(raw, { now, maxDrops: 2 }).map((d) => d.eid), ["d3", "d4"]);
  assert.deepEqual(normalizeSavedDrops("not an array", { now }), []);
});


test("saved drops preserve dimension and migrate legacy entries to Overworld", () => {
  const now = 1_000_000;
  const raw = [
    { eid: "old", x: 0, y: 1, z: 0, b: 1, at: now },
    { eid: "nether", x: 1, y: 2, z: 3, b: 2, at: now, dimensionId: "minecraft:the_nether" },
    { eid: "end", x: 4, y: 5, z: 6, b: 3, at: now, dimensionId: "minecraft:the_end" },
  ];
  const saved = normalizeSavedDrops(raw, { now });
  assert.deepEqual(saved.map((drop) => drop.dimensionId), ["minecraft:overworld", "minecraft:the_nether", "minecraft:the_end"]);
  assert.deepEqual(dropsForDimension(saved, "minecraft:the_nether").map((drop) => drop.eid), ["nether"]);
  assert.deepEqual(dropsForDimension(saved, "minecraft:the_end").map((drop) => drop.eid), ["end"]);
  assert.deepEqual(dropsForDimension(saved, "minecraft:overworld").map((drop) => drop.eid), ["old"]);
});
