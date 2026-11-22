import test from "node:test";
import assert from "node:assert/strict";
import { computeRedstoneSignals, createRedstoneScheduler, normalizeRedstoneSignal } from "../shared/redstone.js";

test("signal values are finite integers clamped to 0..15", () => {
  assert.equal(normalizeRedstoneSignal(-2), 0);
  assert.equal(normalizeRedstoneSignal(7.9), 7);
  assert.equal(normalizeRedstoneSignal(19), 15);
  assert.throws(() => normalizeRedstoneSignal(NaN), TypeError);
});

test("wire signal starts at full adjacent source strength and attenuates one per wire", () => {
  const levels = computeRedstoneSignals([
    { id: "lever", kind: "source", power: 15, connections: ["w1"] },
    { id: "w1", kind: "wire", connections: ["w2"] },
    { id: "w2", kind: "wire", connections: ["w3"] },
    { id: "w3", kind: "wire", connections: ["lamp"] },
    { id: "lamp", kind: "consumer", connections: ["w3"] },
  ]);
  assert.deepEqual(Object.fromEntries(levels), { lever: 15, w1: 15, w2: 14, w3: 13, lamp: 13 });
});

test("weak source reaches only as far as its signal permits", () => {
  const levels = computeRedstoneSignals([
    { id: "s", kind: "source", power: 2, connections: ["a"] },
    { id: "a", kind: "wire", connections: ["b"] },
    { id: "b", kind: "wire", connections: ["c"] },
    { id: "c", kind: "wire" },
  ]);
  assert.equal(levels.get("a"), 2);
  assert.equal(levels.get("b"), 1);
  assert.equal(levels.get("c"), 0);
});

test("loops converge deterministically and disconnected wires stay unpowered", () => {
  const nodes = [
    { id: "s", kind: "source", power: 8, connections: ["a"] },
    { id: "a", kind: "wire", connections: ["b", "c"] },
    { id: "b", kind: "wire", connections: ["c", "a"] },
    { id: "c", kind: "wire", connections: ["a", "b"] },
    { id: "d", kind: "wire", connections: ["e"] },
    { id: "e", kind: "wire", connections: ["d"] },
  ];
  const one = computeRedstoneSignals(nodes);
  const two = computeRedstoneSignals([...nodes].reverse());
  assert.deepEqual(Object.fromEntries(one), Object.fromEntries(two));
  assert.equal(one.get("d"), 0);
  assert.equal(one.get("e"), 0);
});

test("invalid graphs and configured work limits fail closed", () => {
  assert.throws(() => computeRedstoneSignals([{ id: "x", kind: "wire" }, { id: "x", kind: "wire" }]), /duplicate/);
  assert.throws(() => computeRedstoneSignals([{ id: "x", kind: "wire" }], { maxNodes: 0 }), /node limit/);
  assert.throws(() => computeRedstoneSignals([
    { id: "s", kind: "source", power: 15, connections: ["a"] },
    { id: "a", kind: "wire", connections: ["b"] },
    { id: "b", kind: "wire" },
  ], { maxSteps: 0 }), /step limit/);
});

test("tick scheduler orders due updates, replaces per-device pending work, and bounds backlog", () => {
  const q = createRedstoneScheduler({ maxPending: 2 });
  assert.equal(q.schedule("late", 3, 8), true);
  assert.equal(q.schedule("early", 4, 4), true);
  assert.equal(q.schedule("third", 1, 5), false);
  assert.equal(q.schedule("late", 9, 3), true); // coalesces by device ID
  assert.equal(q.size, 2);
  assert.deepEqual(q.popDue(2), []);
  assert.deepEqual(q.popDue(3), [{ id: "late", signal: 9, dueTick: 3 }]);
  assert.deepEqual(q.popDue(4), [{ id: "early", signal: 4, dueTick: 4 }]);
  assert.equal(q.size, 0);
});
