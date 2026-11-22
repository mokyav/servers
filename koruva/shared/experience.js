/** Bounded experience totals and Mob XP rewards for the currently supported roster. */
export const MAX_EXPERIENCE = 2_147_483_647;
const MAX_LEVEL = 65_536;

export function normalizeExperience(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.floor(Math.min(MAX_EXPERIENCE, Math.max(0, value)))
    : 0;
}

/** Total points required to reach a level (Minecraft-style piecewise curve). */
export function experienceThreshold(level) {
  const n = Math.floor(Number.isFinite(level) ? Math.max(0, Math.min(MAX_LEVEL, level)) : 0);
  if (n <= 16) return n * n + 6 * n;
  if (n <= 31) return 2.5 * n * n - 40.5 * n + 360;
  return 4.5 * n * n - 162.5 * n + 2220;
}

export function getExperienceProgress(total) {
  const points = normalizeExperience(total);
  let low = 0, high = MAX_LEVEL;
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    if (experienceThreshold(mid) <= points) low = mid;
    else high = mid;
  }
  const level = low;
  const start = experienceThreshold(level);
  const end = experienceThreshold(level + 1);
  const pointsInLevel = points - start;
  const pointsToNextLevel = Math.max(1, end - start);
  return { level, pointsInLevel, pointsToNextLevel, progress: Math.max(0, Math.min(1, pointsInLevel / pointsToNextLevel)) };
}

export function addExperience(current, amount) {
  const start = normalizeExperience(current);
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return start;
  return normalizeExperience(start + Math.floor(amount));
}

/** Vanilla-style death drop: 7 points per current level, at most 100. */
export function experienceDropOnDeath(total) {
  const points = normalizeExperience(total);
  const level = getExperienceProgress(points).level;
  return Math.min(points, 100, level * 7);
}

/** Claim as much of a persisted XP orb as the player's bounded total can hold. */
export function takeExperienceFromDrop(current, amount) {
  const before = normalizeExperience(current);
  const offered = Number.isSafeInteger(amount) && amount > 0 ? Math.min(MAX_EXPERIENCE, amount) : 0;
  const taken = Math.min(offered, MAX_EXPERIENCE - before);
  return { experience: before + taken, taken, remaining: offered - taken };
}


const LOW_XP = Object.freeze({ chicken: [1, 3], cow: [1, 3], mooshroom: [1, 3], pig: [1, 3], rabbit: [1, 3], sheep: [1, 3] });
const HOSTILE_XP = Object.freeze({
  blaze: [10, 10], bogged: [5, 5], breeze: [5, 5], cave_spider: [5, 5], creeper: [5, 5], drowned: [5, 5],
  enderman: [5, 5], endermite: [3, 3], ghast: [5, 5], guardian: [10, 10], hoglin: [5, 5], husk: [5, 5],
  magma_cube: [1, 4], phantom: [5, 5], piglin: [5, 5], piglin_brute: [5, 5], pillager: [5, 5], silverfish: [5, 5],
  skeleton: [5, 5], slime: [1, 4], spider: [5, 5], stray: [5, 5], vex: [3, 3], vindicator: [5, 5], witch: [5, 5],
  wither_skeleton: [5, 5], zoglin: [5, 5], zombie: [5, 5], zombie_villager: [5, 5], zombified_piglin: [5, 5],
});
const MOB_XP_RANGES = Object.freeze({ ...LOW_XP, ...HOSTILE_XP });

/** Return 0 for Mob types without an implemented reward; RNG is injectable for tests. */
export function rollMobExperience(type, rng = Math.random) {
  if (!Object.prototype.hasOwnProperty.call(MOB_XP_RANGES, type)) return 0;
  const range = MOB_XP_RANGES[type];
  const raw = typeof rng === "function" ? rng() : 0.5;
  const sample = Number.isFinite(raw) ? Math.max(0, Math.min(0.999999999999, raw)) : 0.5;
  return range[0] + Math.floor(sample * (range[1] - range[0] + 1));
}
