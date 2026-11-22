/**
 * Server-shared Elytra glide integration used by both client prediction and the room worker.
 * This is Koruva's deterministic server-authoritative flight model, not a bit-for-bit
 * replacement for every vanilla Minecraft movement edge case.
 */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0));
export function stepElytraPhysics(position, velocity, yaw, pitch, strafe = 0, dtSeconds = 1 / 20) {
  const dt = clamp(dtSeconds, 0, 0.25);
  const p = Array.isArray(position) && position.length >= 3 ? position.map((v) => clamp(v, -30_000_000, 30_000_000)) : [0, 80, 0];
  const v = Array.isArray(velocity) && velocity.length >= 3 ? velocity.map((n) => clamp(n, -60, 60)) : [0, 0, 0];
  const lookX = -Math.sin(yaw) * Math.cos(pitch), lookZ = -Math.cos(yaw) * Math.cos(pitch);
  const lookY = -Math.sin(pitch), horizontal = Math.hypot(v[0], v[2]);
  const desired = Math.max(7, Math.min(30, horizontal + (-lookY) * 2.5 * dt - Math.max(0, lookY) * 1.4 * dt));
  const side = clamp(strafe, -1, 1) * 0.14;
  const targetX = lookX * desired + Math.cos(yaw) * side * desired;
  const targetZ = lookZ * desired + Math.sin(yaw) * side * desired;
  v[0] += (targetX - v[0]) * Math.min(1, dt * 2.2);
  v[2] += (targetZ - v[2]) * Math.min(1, dt * 2.2);
  v[1] = clamp(v[1] + (-3.2 + horizontal * lookY * 2.4) * dt, -18, 8);
  const next = [p[0] + v[0] * dt, p[1] + v[1] * dt, p[2] + v[2] * dt];
  return { position: next, velocity: v };
}
