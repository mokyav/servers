/** Shared, bounded End boss rules used by the room worker and tests. */
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));

/** The dragon gains one health per second while at least one nearby crystal remains. */
export function tickDragonCrystalHealing({ health, maxHealth = 200, nextHealAt = 0, now, hasCrystal }) {
  const maximum = clamp(maxHealth, 1, 200);
  const current = clamp(health, 0, maximum);
  const timestamp = Number.isFinite(Number(now)) ? Number(now) : 0;
  const dueAt = Number.isFinite(Number(nextHealAt)) ? Number(nextHealAt) : 0;
  if (timestamp < dueAt) return { health: current, maxHealth: maximum, nextHealAt: dueAt, healed: 0 };
  const healed = hasCrystal && current < maximum ? 1 : 0;
  return { health: Math.min(maximum, current + healed), maxHealth: maximum, nextHealAt: timestamp + 1000, healed };
}

/** Distance-falloff and armor reduction for a dragon-fireball / crystal blast. */
export function dragonBlastDamage(distance, armorPoints = 0) {
  const d = Number(distance), armor = clamp(armorPoints, 0, 20);
  if (!Number.isFinite(d) || d > 4 || d < 0) return 0;
  const raw = Math.max(1, 8 * (1 - d / 5));
  return raw * (1 - Math.min(0.8, armor / 25));
}
