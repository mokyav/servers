// Shared, deterministic combat rules. Times are expressed in Minecraft ticks unless noted.
export const TICKS_PER_SECOND = 20;
export const TICK_MS = 50;

// Java Edition base attack intervals, seconds. Extend this table when weapon items exist.
export const ATTACK_INTERVAL_SECONDS = Object.freeze({
  fist: 0.25,
  sword: 0.60,
  trident: 0.90,
  spear: 0.85,
  mace: 1.10,
  shovel: 1.00,
  pickaxe: 0.85,
  wooden_axe: 1.25,
  stone_axe: 1.25,
  copper_axe: 1.10,
  iron_axe: 1.10,
  gold_axe: 1.00,
  golden_axe: 1.00,
  diamond_axe: 1.00,
  netherite_axe: 1.00,
  wooden_hoe: 1.00,
  gold_hoe: 1.00,
  golden_hoe: 1.00,
  stone_hoe: 0.50,
  iron_hoe: 0.35,
  diamond_hoe: 0.25,
  netherite_hoe: 0.25,
});

export const ACTION_COOLDOWN_SECONDS = Object.freeze({
  mining: 0.30, shield: 0.25, ender_pearl: 1.00, wind_charge: 0.50,
  chorus_fruit: 1.00, goat_horn: 6.00, bucket: 0.30, flint_and_steel: 0.30,
  nether_portal: 0.50, damage: 0.50,
});

export function attackDelayTicks(item = 'fist') {
  const seconds = ATTACK_INTERVAL_SECONDS[item] ?? ATTACK_INTERVAL_SECONDS.fist;
  return seconds * TICKS_PER_SECOND;
}

export function attackChargeProgress(elapsedTicks, fullChargeTicks) {
  const t = Math.max(0, Number.isFinite(elapsedTicks) ? elapsedTicks : 0);
  const T = Math.max(Number.EPSILON, Number.isFinite(fullChargeTicks) ? fullChargeTicks : attackDelayTicks('fist'));
  return Math.min(1, t / T);
}

export function damageMultiplier(elapsedTicks, fullChargeTicks) {
  const t = Math.max(0, Number.isFinite(elapsedTicks) ? elapsedTicks : 0);
  const T = Math.max(Number.EPSILON, Number.isFinite(fullChargeTicks) ? fullChargeTicks : attackDelayTicks('fist'));
  return Math.max(0.2, Math.min(1, 0.2 + 0.8 * Math.min(1, ((t + 0.5) / T) ** 2)));
}

export function actionCooldownTicks(action, blockBreakSeconds = Infinity) {
  if (action === 'mining' && blockBreakSeconds <= 0.05) return 0;
  return (ACTION_COOLDOWN_SECONDS[action] ?? 0) * TICKS_PER_SECOND;
}

export function isCriticalHit(state) {
  return !!state.falling && !state.onGround && !state.climbing && !state.inWater && !state.blinded && !state.riding;
}

export function meleeDamage(baseDamage, elapsedTicks, fullChargeTicks, critical = false) {
  const raw = Math.max(0, Number.isFinite(baseDamage) ? baseDamage : 0);
  return raw * damageMultiplier(elapsedTicks, fullChargeTicks) * (critical ? 1.5 : 1);
}

// Java-style hurt resistance: during the 500 ms window only damage above the previous hit is applied.
export function applyDamageWithInvulnerability(amount, nowMs, lastHurtAtMs = -Infinity, lastDamage = 0, durationMs = 500) {
  const incoming = Math.max(0, Number.isFinite(amount) ? amount : 0);
  if (incoming === 0) return { applied: 0, lastHurtAtMs, lastDamage };
  if (Number.isFinite(lastHurtAtMs) && nowMs - lastHurtAtMs < durationMs) {
    if (incoming <= lastDamage) return { applied: 0, lastHurtAtMs, lastDamage };
    return { applied: incoming - lastDamage, lastHurtAtMs, lastDamage: incoming };
  }
  return { applied: incoming, lastHurtAtMs: nowMs, lastDamage: incoming };
}

export const MOB_BASE_HEALTH = Object.freeze({
  chicken: 4, rabbit: 3, cow: 10, pig: 10, sheep: 8, zombie: 20, skeleton: 20,
  creeper: 20, spider: 16, enderman: 40, slime: 16, witch: 26, blaze: 20,
  ghast: 10, piglin: 16, hoglin: 40, shulker: 30, ender_dragon: 200,
});
export function mobBaseHealth(type) { return MOB_BASE_HEALTH[type] ?? 20; }
