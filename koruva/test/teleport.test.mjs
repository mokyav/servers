import test from "node:test";
import assert from "node:assert/strict";
import { parseTeleportPosition } from "../shared/teleport.js";
test("absolute and relative coordinates resolve against the command source", () => {
  assert.deepEqual(parseTeleportPosition(["12.5", "40", "-3"], [0, 20, 0]), [12.5, 40, -3]);
  assert.deepEqual(parseTeleportPosition(["~", "~+2.5", "~-3"], [12, 20, -7]), [12, 22.5, -10]);
});
test("invalid coordinates and out-of-world positions are rejected", () => {
  assert.equal(parseTeleportPosition(["x", "2", "3"], [0, 0, 0]), null);
  assert.equal(parseTeleportPosition(["~bad", "2", "3"], [0, 0, 0]), null);
  assert.equal(parseTeleportPosition(["100001", "2", "3"], [0, 0, 0]), null);
  assert.deepEqual(parseTeleportPosition(["0", "64", "0"], [0, 0, 0]), [0, 64, 0]);
  assert.deepEqual(parseTeleportPosition(["0", "127", "0"], [0, 0, 0]), [0, 127, 0]);
  assert.equal(parseTeleportPosition(["0", "128", "0"], [0, 0, 0]), null);
  assert.equal(parseTeleportPosition(["0", "0", "0"], [0, 0, 0]), null);
});
