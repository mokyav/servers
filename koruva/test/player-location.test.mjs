import test from "node:test";
import assert from "node:assert/strict";
import { normalizePlayerLocation } from "../shared/player-location.js";

test("valid persisted locations retain a supported dimension, position and rotation", () => {
  const input = { version: 1, dimensionId: "minecraft:the_nether", p: [12.5, 64, -3], r: [1.2, 0.1] };
  assert.deepEqual(normalizePlayerLocation(input), input);
});

test("unknown dimensions and malformed/non-finite location data are rejected", () => {
  const valid = { version: 1, dimensionId: "minecraft:the_end", p: [0, 40, 0], r: [0, 0] };
  assert.equal(normalizePlayerLocation({ ...valid, dimensionId: "minecraft:moon" }), null);
  assert.equal(normalizePlayerLocation({ ...valid, p: [0, NaN, 0] }), null);
  assert.equal(normalizePlayerLocation({ ...valid, r: [0] }), null);
  assert.equal(normalizePlayerLocation({ ...valid, version: 2 }), null);
  assert.equal(normalizePlayerLocation(null), null);
});
