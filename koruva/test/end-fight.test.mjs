import test from "node:test";
import assert from "node:assert/strict";
import { tickDragonCrystalHealing, dragonBlastDamage } from "../shared/end-fight.js";

test("End crystals heal the Ender Dragon by one health each second", () => {
  assert.deepEqual(tickDragonCrystalHealing({ health: 120, maxHealth: 200, nextHealAt: 1000, now: 999, hasCrystal: true }),
    { health: 120, maxHealth: 200, nextHealAt: 1000, healed: 0 });
  assert.deepEqual(tickDragonCrystalHealing({ health: 120, maxHealth: 200, nextHealAt: 1000, now: 1000, hasCrystal: true }),
    { health: 121, maxHealth: 200, nextHealAt: 2000, healed: 1 });
  assert.equal(tickDragonCrystalHealing({ health: 200, maxHealth: 200, now: 2000, hasCrystal: true }).health, 200);
  assert.equal(tickDragonCrystalHealing({ health: 120, maxHealth: 200, now: 2000, hasCrystal: false }).health, 120);
});

test("dragon blasts have bounded distance falloff and armor mitigation", () => {
  assert.equal(dragonBlastDamage(5, 0), 0);
  assert.equal(dragonBlastDamage(0, 0), 8);
  assert.ok(dragonBlastDamage(2, 10) < dragonBlastDamage(2, 0));
  assert.equal(dragonBlastDamage(2, 100), dragonBlastDamage(2, 20));
});
