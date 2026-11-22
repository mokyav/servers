import test from "node:test";
import assert from "node:assert/strict";
import { addExperience, experienceThreshold, getExperienceProgress, MAX_EXPERIENCE, normalizeExperience, rollMobExperience } from "../shared/experience.js";

test("cumulative level thresholds follow the piecewise curve", () => {
  assert.equal(experienceThreshold(0), 0);
  assert.equal(experienceThreshold(1), 7);
  assert.equal(experienceThreshold(16), 352);
  assert.equal(experienceThreshold(17), 394);
  assert.equal(experienceThreshold(31), 1507);
  assert.equal(experienceThreshold(32), 1628);
});

test("level and within-level progress are derived from total points", () => {
  assert.deepEqual(getExperienceProgress(0), { level: 0, pointsInLevel: 0, pointsToNextLevel: 7, progress: 0 });
  assert.equal(getExperienceProgress(6).level, 0);
  assert.equal(getExperienceProgress(7).level, 1);
  assert.equal(getExperienceProgress(8).pointsInLevel, 1);
  assert.equal(getExperienceProgress(352).level, 16);
});

test("stored totals and increments are finite, integral, and bounded", () => {
  assert.equal(normalizeExperience(-4), 0);
  assert.equal(normalizeExperience(3.9), 3);
  assert.equal(normalizeExperience(NaN), 0);
  assert.equal(normalizeExperience(Infinity), 0);
  assert.equal(normalizeExperience(MAX_EXPERIENCE + 5), MAX_EXPERIENCE);
  assert.equal(addExperience(5, 2), 7);
  assert.equal(addExperience(5, -2), 5);
  assert.equal(addExperience(MAX_EXPERIENCE - 1, 10), MAX_EXPERIENCE);
});

test("Mob XP reward rolls are deterministic when supplied an RNG", () => {
  assert.equal(rollMobExperience("cow", () => 0), 1);
  assert.equal(rollMobExperience("cow", () => 0.999), 3);
  assert.equal(rollMobExperience("zombie", () => 0.3), 5);
  assert.equal(rollMobExperience("magma_cube", () => 0.5), 3);
  assert.equal(rollMobExperience("not_a_mob", () => 0), 0);
  assert.equal(rollMobExperience("toString", () => 0), 0);
  assert.equal(rollMobExperience("cow", () => NaN), 2);
});
