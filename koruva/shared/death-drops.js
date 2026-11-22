/** Build item-stack drops from a player's inventory and equipped armor. */
export function buildDeathDropStacks(counts, armorSlots, itemCount, maxStack = 64, stackLimitForItem = null) {
  const limit = Number.isSafeInteger(itemCount) ? Math.max(1, itemCount) : 1;
  const stackSize = Number.isSafeInteger(maxStack) ? Math.max(1, Math.min(64, maxStack)) : 64;
  const totals = new Map();
  const add = (itemId, amount) => {
    if (!Number.isSafeInteger(itemId) || itemId <= 0 || itemId >= limit) return;
    if (!Number.isSafeInteger(amount) || amount <= 0) return;
    totals.set(itemId, (totals.get(itemId) ?? 0) + amount);
  };
  if (Array.isArray(counts)) counts.forEach((amount, itemId) => add(itemId, amount));
  if (Array.isArray(armorSlots)) for (const itemId of armorSlots) add(itemId, 1);
  const stacks = [];
  for (const [itemId, total] of [...totals.entries()].sort((a, b) => a[0] - b[0])) {
    let remaining = total;
    while (remaining > 0) {
      const itemLimit = typeof stackLimitForItem === "function" ? Number(stackLimitForItem(itemId)) : stackSize;
      const perStackLimit = Number.isSafeInteger(itemLimit) ? Math.max(1, Math.min(stackSize, itemLimit)) : stackSize;
      const count = Math.min(perStackLimit, remaining);
      stacks.push({ itemId, count });
      remaining -= count;
    }
  }
  return stacks;
}
