/** Minecraft-style selected-stack drop quantities. */
export function getDropCount(stackAmount, wholeStack = false) {
  if (!Number.isSafeInteger(stackAmount) || stackAmount <= 0) return 0;
  const available = Math.min(64, stackAmount);
  return wholeStack ? available : 1;
}
export function clampDropCount(requested, available) {
  if (!Number.isSafeInteger(requested) || !Number.isSafeInteger(available) || requested <= 0 || available <= 0) return 0;
  return Math.min(64, requested, available);
}
