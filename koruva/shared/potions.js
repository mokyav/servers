/**
 * Potion contents represented as distinct stack IDs because the current inventory
 * protocol stores item IDs/counts and does not yet serialize Minecraft data components.
 * Durations are Java Edition ticks (20 ticks per second).
 */
const DRINK_POTION_VARIANTS = Object.freeze([
  { token: "potion_swiftness", name: "俊敏のポーション", effectId: "speed", durationTicks: 3600, amplifier: 0 },
  { token: "potion_long_swiftness", name: "俊敏のポーション（延長）", effectId: "speed", durationTicks: 9600, amplifier: 0 },
  { token: "potion_strong_swiftness", name: "俊敏のポーション（強化）", effectId: "speed", durationTicks: 1800, amplifier: 1 },
  { token: "potion_strength", name: "力のポーション", effectId: "strength", durationTicks: 3600, amplifier: 0 },
  { token: "potion_long_strength", name: "力のポーション（延長）", effectId: "strength", durationTicks: 9600, amplifier: 0 },
  { token: "potion_healing", name: "治癒のポーション", effectId: "instant_health", durationTicks: 1, amplifier: 0 },
  { token: "potion_strong_healing", name: "治癒のポーション（強化）", effectId: "instant_health", durationTicks: 1, amplifier: 1 },
  { token: "potion_harming", name: "負傷のポーション", effectId: "instant_damage", durationTicks: 1, amplifier: 0 },
  { token: "potion_strong_harming", name: "負傷のポーション（強化）", effectId: "instant_damage", durationTicks: 1, amplifier: 1 },
  { token: "potion_regeneration", name: "再生のポーション", effectId: "regeneration", durationTicks: 900, amplifier: 0 },
  { token: "potion_long_regeneration", name: "再生のポーション（延長）", effectId: "regeneration", durationTicks: 1800, amplifier: 0 },
  { token: "potion_fire_resistance", name: "耐火のポーション", effectId: "fire_resistance", durationTicks: 3600, amplifier: 0 },
  { token: "potion_long_fire_resistance", name: "耐火のポーション（延長）", effectId: "fire_resistance", durationTicks: 9600, amplifier: 0 },
  { token: "potion_night_vision", name: "暗視のポーション", effectId: "night_vision", durationTicks: 3600, amplifier: 0 },
  { token: "potion_long_night_vision", name: "暗視のポーション（延長）", effectId: "night_vision", durationTicks: 9600, amplifier: 0 },
  { token: "potion_invisibility", name: "透明化のポーション", effectId: "invisibility", durationTicks: 3600, amplifier: 0 },
  { token: "potion_water_breathing", name: "水中呼吸のポーション", effectId: "water_breathing", durationTicks: 3600, amplifier: 0 },
  { token: "potion_leaping", name: "跳躍のポーション", effectId: "jump_boost", durationTicks: 3600, amplifier: 0 },
  { token: "potion_slow_falling", name: "低速落下のポーション", effectId: "slow_falling", durationTicks: 1800, amplifier: 0 },
  { token: "potion_poison", name: "毒のポーション", effectId: "poison", durationTicks: 900, amplifier: 0 },
  { token: "potion_slowness", name: "鈍化のポーション", effectId: "slowness", durationTicks: 1800, amplifier: 0 },
  { token: "potion_weakness", name: "弱化のポーション", effectId: "weakness", durationTicks: 1800, amplifier: 0 },
]);

export const POTION_VARIANTS = Object.freeze([
  ...DRINK_POTION_VARIANTS,
  ...DRINK_POTION_VARIANTS.filter(potion => potion.effectId).map(potion => ({ ...potion, token: `splash_${potion.token}`, name: `スプラッシュ${potion.name}`, delivery: "splash" })),
]);

const BY_TOKEN = new Map(POTION_VARIANTS.map((potion) => [`koruva:${potion.token}`, potion]));

export function potionSpecForItemId(itemId, blocks) {
  const key = blocks?.[itemId]?.key;
  if (key === "minecraft:potion") return { token: "water", name: "水入り瓶", effectId: null, durationTicks: 0, amplifier: 0 };
  return typeof key === "string" ? BY_TOKEN.get(key) ?? null : null;
}

export function isDrinkablePotionItemId(itemId, blocks) {
  return potionSpecForItemId(itemId, blocks) !== null;
}

/** Deterministic bottle-throw trajectory shared by client prediction and room authority. */
export function potionSplashLanding(origin, direction, isSolid) {
  const dir = Array.isArray(direction) && direction.length === 3 ? direction.map(v => Number.isFinite(v) ? v : 0) : [0, 0, 1];
  const length = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const pos = [origin[0], origin[1], origin[2]];
  // Match the client projectile: 8 blocks/s aim velocity, 1.4 upward bias,
  // 9.8 blocks/s² gravity, 50 ms integration steps and light air drag.
  const velocity = [dir[0] / length * 8, dir[1] / length * 8 + 1.4, dir[2] / length * 8];
  const step = 0.05;
  for (let i = 0; i < 30; i++) {
    const next = [pos[0] + velocity[0] * step, pos[1] + velocity[1] * step, pos[2] + velocity[2] * step];
    if (isSolid(Math.floor(next[0]), Math.floor(next[1]), Math.floor(next[2]))) return pos;
    pos[0] = next[0]; pos[1] = next[1]; pos[2] = next[2];
    velocity[1] -= 9.8 * step; velocity[0] *= 0.99; velocity[2] *= 0.99;
  }
  return pos;
}
