/** Pure, copy-on-write inventory clearing used by authoritative server commands. */
export function clearInventoryState(counts, foodCounts, item = null, foodKeys = []) {
  if (!Array.isArray(counts) || !foodCounts || typeof foodCounts !== "object" || Array.isArray(foodCounts)) return null;
  const nextCounts = counts.slice();
  const nextFoodCounts = { ...foodCounts };
  if (item === null || item === undefined) {
    nextCounts.fill(0);
    const keys = new Set([...Object.keys(nextFoodCounts), ...(Array.isArray(foodKeys) ? foodKeys : [])]);
    for (const key of keys) if (typeof key === "string" && key.length) nextFoodCounts[key] = 0;
    return { counts: nextCounts, foodCounts: nextFoodCounts };
  }
  if (item.kind === "block") {
    if (!Number.isInteger(item.id) || item.id < 0 || item.id >= nextCounts.length) return null;
    nextCounts[item.id] = 0;
    return { counts: nextCounts, foodCounts: nextFoodCounts };
  }
  if (item.kind === "food") {
    if (typeof item.id !== "string" || !item.id) return null;
    nextFoodCounts[item.id] = 0;
    return { counts: nextCounts, foodCounts: nextFoodCounts };
  }
  return null;
}
