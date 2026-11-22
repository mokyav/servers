export type ClearInventoryItem = { kind: "block"; id: number } | { kind: "food"; id: string };
export interface ClearedInventoryState { counts: number[]; foodCounts: Record<string, number> }
export declare function clearInventoryState(
  counts: readonly number[],
  foodCounts: Readonly<Record<string, number>>,
  item?: ClearInventoryItem | null,
  foodKeys?: readonly string[],
): ClearedInventoryState | null;
