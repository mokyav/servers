import test from "node:test";
import assert from "node:assert/strict";
import { ATTACK_INTERVAL_SECONDS, ACTION_COOLDOWN_SECONDS, attackDelayTicks, attackChargeProgress, damageMultiplier, actionCooldownTicks, isCriticalHit, meleeDamage, applyDamageWithInvulnerability } from "../shared/combat.js";

test("Java attack intervals are converted to 20 TPS tick durations", () => {
  assert.equal(attackDelayTicks("sword"), 12);
  assert.equal(attackDelayTicks("trident"), 18);
  assert.equal(attackDelayTicks("fist"), 5);
  assert.equal(attackDelayTicks("iron_hoe"), 7);
  assert.equal(attackDelayTicks("unknown"), 5);
  assert.equal(Object.keys(ATTACK_INTERVAL_SECONDS).length, 22);
  assert.equal(attackDelayTicks("golden_axe"), 20);
  assert.equal(attackDelayTicks("golden_hoe"), 20);
});

test("charge multiplier follows the Java formula and caps at full charge", () => {
  const T = attackDelayTicks("sword");
  assert.equal(damageMultiplier(T, T), 1);
  assert.ok(damageMultiplier(0, T) >= 0.2 && damageMultiplier(0, T) < 1);
  assert.ok(damageMultiplier(3, T) < damageMultiplier(T, T));
  assert.equal(damageMultiplier(1000, T), 1);
  assert.equal(damageMultiplier(-10, T), damageMultiplier(0, T));
});

test("critical hit requires falling and excludes listed states", () => {
  const base = { falling: true, onGround: false };
  assert.equal(isCriticalHit(base), true);
  for (const state of [{ onGround: true }, { climbing: true }, { inWater: true }, { blinded: true }, { riding: true }])
    assert.equal(isCriticalHit({ ...base, ...state }), false);
  assert.equal(meleeDamage(4, 12, 12, true), 6);
});

test("hurt resistance applies only the increase during 500ms and resets after", () => {
  const first = applyDamageWithInvulnerability(5, 1000);
  assert.deepEqual(first, { applied: 5, lastHurtAtMs: 1000, lastDamage: 5 });
  assert.equal(applyDamageWithInvulnerability(3, 1200, first.lastHurtAtMs, first.lastDamage).applied, 0);
  const stronger = applyDamageWithInvulnerability(7, 1300, first.lastHurtAtMs, first.lastDamage);
  assert.deepEqual(stronger, { applied: 2, lastHurtAtMs: 1000, lastDamage: 7 });
  assert.equal(applyDamageWithInvulnerability(4, 1600, stronger.lastHurtAtMs, stronger.lastDamage).applied, 4);
});

test("action cooldown table and instant-mining exception", () => {
  assert.equal(actionCooldownTicks("mining"), ACTION_COOLDOWN_SECONDS.mining * 20);
  assert.equal(actionCooldownTicks("mining", 0.05), 0);
  assert.equal(actionCooldownTicks("shield"), 5);
  assert.equal(actionCooldownTicks("goat_horn"), 120);
});


test("charge meter reports linear 0-100% recharge progress, separately from damage", () => {
  const T = attackDelayTicks("sword");
  assert.equal(attackChargeProgress(0, T), 0);
  assert.equal(attackChargeProgress(T / 2, T), 0.5);
  assert.equal(attackChargeProgress(T, T), 1);
  assert.equal(attackChargeProgress(T * 4, T), 1);
  assert.equal(attackChargeProgress(-5, T), 0);
  assert.equal(attackChargeProgress(Number.NaN, T), 0);
  assert.ok(damageMultiplier(0, T) > 0);
  assert.notEqual(attackChargeProgress(0, T), damageMultiplier(0, T));
});

test("26.3 spear, mace, and copper-axe weapons have dedicated recharge intervals", () => {
  assert.equal(attackDelayTicks("spear"), 17);
  assert.equal(attackDelayTicks("mace"), 22);
  assert.equal(attackDelayTicks("copper_axe"), 22);
});
