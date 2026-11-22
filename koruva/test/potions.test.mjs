import test from "node:test";
import assert from "node:assert/strict";
import { POTION_VARIANTS, isDrinkablePotionItemId, potionSpecForItemId } from "../shared/potions.js";

test("plain potion is water and generated potion stacks preserve their effect identity", () => {
  const blocks = [undefined, { key: "minecraft:potion" }, { key: "koruva:potion_swiftness" }, { key: "koruva:potion_healing" }, { key: "minecraft:splash_potion" }];
  assert.equal(potionSpecForItemId(1, blocks).effectId, null);
  assert.deepEqual(potionSpecForItemId(2, blocks), {
    token: "potion_swiftness", name: "俊敏のポーション", effectId: "speed", durationTicks: 3600, amplifier: 0,
  });
  assert.equal(potionSpecForItemId(3, blocks).effectId, "instant_health");
  assert.equal(isDrinkablePotionItemId(2, blocks), true);
  assert.equal(isDrinkablePotionItemId(4, blocks), false);
  assert.equal(potionSpecForItemId(999, blocks), null);
});

test("potion variant catalog covers core vanilla drink effects", () => {
  const effects = new Set(POTION_VARIANTS.map((potion) => potion.effectId));
  for (const id of ["speed", "strength", "instant_health", "instant_damage", "regeneration", "fire_resistance", "night_vision", "invisibility", "water_breathing", "jump_boost", "slow_falling", "poison", "slowness", "weakness"]) {
    assert.equal(effects.has(id), true, `missing potion effect ${id}`);
  }
  assert.equal(new Set(POTION_VARIANTS.map((potion) => potion.token)).size, POTION_VARIANTS.length);
});
