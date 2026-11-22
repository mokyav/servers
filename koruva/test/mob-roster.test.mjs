import test from "node:test";
import assert from "node:assert/strict";
import { MINECRAFT_MOB_IDS } from "../shared/minecraft-mob-catalog.js";
import { MOB_PROFILES, createMob, stepMobAI } from "../shared/mob-ai.js";

const roster = MINECRAFT_MOB_IDS.map((id) => id.replace(/^minecraft:/, ""));

test("every 26.3 spawn-egg mob is accepted by the server AI registry", () => {
  assert.equal(roster.length, 88);
  assert.equal(new Set(roster).size, roster.length);
  assert.deepEqual(Object.keys(MOB_PROFILES).sort(), [...roster].sort());
});

test("every registered mob has bounded profile data and a supported visual fallback", () => {
  const visuals = new Set(["pig", "cow", "chicken", "creeper", "zombie", "skeleton"]);
  for (const type of roster) {
    const p = MOB_PROFILES[type];
    assert.ok(p, type);
    assert.ok(["passive", "melee", "ranged", "fuse", "dragon"].includes(p.kind), type);
    assert.ok(Number.isFinite(p.maxHealth) && p.maxHealth > 0 && p.maxHealth <= 500, type);
    assert.ok(Number.isFinite(p.speed) && p.speed > 0 && p.speed <= 2, type);
    assert.ok(Number.isFinite(p.height) && p.height > 0 && p.height <= 4, type);
    assert.ok(visuals.has(p.visual), type);
    if (p.kind !== "passive") assert.ok(Number.isFinite(p.damage) && p.damage > 0, type);
    const mob = createMob(type, `test-${type}`, 0, 10, 0);
    assert.equal(mob.type, type);
    assert.equal(mob.maxHealth, p.maxHealth);
    const result = stepMobAI(mob, [{ id: "player", p: [5, 10, 0] }], 0.1, 1000, () => false);
    assert.equal(result.mob.id, mob.id);
    assert.ok(Number.isFinite(result.mob.x) && Number.isFinite(result.mob.z), type);
  }
});

test("representative archetypes remain differentiated", () => {
  assert.equal(MOB_PROFILES.pig.kind, "passive");
  assert.equal(MOB_PROFILES.pillager.kind, "ranged");
  assert.equal(MOB_PROFILES.zombie.kind, "melee");
  assert.equal(MOB_PROFILES.creeper.kind, "fuse");
  assert.equal(MOB_PROFILES.ender_dragon.maxHealth, 200);
});
