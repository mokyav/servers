export interface SavedDrop {
  eid: string;
  x: number;
  y: number;
  z: number;
  b?: number;
  itemId?: number;
  xp?: number;
  count?: number;
  at: number;
  dimensionId: string;
}

export interface NormalizeSavedDropsOptions {
  now?: number;
  ttlMs?: number;
  maxDrops?: number;
  isValidItem?: (itemId: number) => boolean;
  isValidInventoryItem?: (itemId: number) => boolean;
}

export function normalizeSavedDrops(raw: unknown, options?: NormalizeSavedDropsOptions): SavedDrop[];

export function dropsForDimension<T extends { dimensionId?: string }>(
  drops: readonly T[],
  dimensionId: string
): T[];
