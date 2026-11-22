import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasClearLine } from "../shared/mob-ai.js";

const wall = (x, y, z) => x === 1 && y >= 10 && y <= 12 && z === 0;

test("server ray rejects a mob hit through a solid block", () => {
  assert.equal(hasClearLine([0, 11.62, 0], [2, 10.8, 0], wall), false);
});

test("server ray allows an unobstructed mob hit", () => {
  assert.equal(hasClearLine([0, 11.62, 0], [2, 10.8, 0], () => false), true);
});

test("server ray ignores blocks outside the attack line", () => {
  assert.equal(hasClearLine([0, 11.62, 0], [2, 10.8, 0], (x, y, z) => x === 1 && z === 2), true);
});

test("invalid ray input fails closed", () => {
  assert.equal(hasClearLine([0, 0, 0], [1, 1, 1], undefined), false);
  assert.equal(hasClearLine([0, 0, NaN], [1, 1, 1], () => false), false);
});

test("Worker mob attacks consult server world blocks before applying damage", () => {
  const room = readFileSync(new URL("../src/worker/room.ts", import.meta.url), "utf8");
  assert.match(room, /import \{ createMob, hasClearLine, MOB_PROFILES, stepMobAI \}/);
  assert.match(room, /hasClearLine\(attackerEye, mobBody, solidAt\)/);
  assert.match(room, /this\.blockAt\(x, y, z, me\.dimensionId\)/);
});

test("Worker gives damaged passive mobs a bounded flee impulse", () => {
  const room = readFileSync(new URL("../src/worker/room.ts", import.meta.url), "utf8");
  assert.ok(room.includes('MOB_PROFILES[target.type]?.kind === "passive"'));
  assert.ok(room.includes("fleeUntil: now + 4000"));
});
