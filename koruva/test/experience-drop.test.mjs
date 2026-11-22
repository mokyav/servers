import assert from "node:assert/strict";
import test from "node:test";
import { MAX_EXPERIENCE, experienceDropOnDeath, takeExperienceFromDrop } from "../shared/experience.js";
import { normalizeSavedDrops } from "../shared/drop-store.js";

test("saved XP drops keep valid amounts and reject malformed or ambiguous values", () => {
  const base = { x: 2, y: 8, z: -3, at: 1_000 };
  const saved = normalizeSavedDrops([
    { ...base, eid: "xp-valid", xp: 19 },
    { ...base, eid: "xp-zero", xp: 0 },
    { ...base, eid: "xp-fraction", xp: 1.5 },
    { ...base, eid: "xp-too-large", xp: MAX_EXPERIENCE + 1 },
    { ...base, eid: "xp-no-downgrade", xp: 0, b: 1 },
  ], { now: 1_000, isValidItem: () => true, isValidInventoryItem: () => true });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].eid, "xp-valid");
  assert.equal(saved[0].xp, 19);
});

test("death XP follows 7 points per current level, capped at 100", () => {
  assert.equal(experienceDropOnDeath(0), 0);
  assert.equal(experienceDropOnDeath(6), 0);
  assert.equal(experienceDropOnDeath(10), 7);
  assert.equal(experienceDropOnDeath(7), 7);
  assert.equal(experienceDropOnDeath(1395), 100);
});

test("XP orb pickup awards full points or leaves only the unclaimed remainder at the cap", () => {
  assert.deepEqual(takeExperienceFromDrop(40, 12), { experience: 52, taken: 12, remaining: 0 });
  assert.deepEqual(takeExperienceFromDrop(MAX_EXPERIENCE - 2, 12), { experience: MAX_EXPERIENCE, taken: 2, remaining: 10 });
  assert.deepEqual(takeExperienceFromDrop(MAX_EXPERIENCE, 12), { experience: MAX_EXPERIENCE, taken: 0, remaining: 12 });
  assert.deepEqual(takeExperienceFromDrop(0, 1.2), { experience: 0, taken: 0, remaining: 0 });
});
