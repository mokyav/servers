/** Map the four player-inventory crafting slots to the shared 3×3 recipe matcher. */
export function playerCraftGridToRecipeGrid(cells) {
  if (!Array.isArray(cells) || cells.length !== 4 || !cells.every((id) => Number.isInteger(id) && id >= 0)) return null;
  return [cells[0], cells[1], 0, cells[2], cells[3], 0, 0, 0, 0];
}

/** Consume one item from every occupied player crafting slot after a successful craft. */
export function consumePlayerCraftGrid(cells, amounts) {
  if (!Array.isArray(cells) || !Array.isArray(amounts) || cells.length !== 4 || amounts.length !== 4) return null;
  const nextItems = [...cells];
  const nextAmounts = amounts.map((n) => Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
  for (let i = 0; i < 4; i++) {
    if (!Number.isInteger(nextItems[i]) || nextItems[i] < 0) return null;
    if (nextItems[i] > 0) {
      if (nextAmounts[i] <= 0) return null;
      nextAmounts[i]--;
      if (nextAmounts[i] === 0) nextItems[i] = 0;
    } else {
      nextAmounts[i] = 0;
    }
  }
  return { items: nextItems, amounts: nextAmounts };
}
