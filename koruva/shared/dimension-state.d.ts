export const MAX_SAVED_DIMENSION_EDITS: number;
export function normalizeDimensionEditList(list: unknown, options?: { worldHeight?: number; maxBlockId?: number; maxEdits?: number }): number[];
export function normalizeDimensionEditRecord(record: unknown, options?: { worldHeight?: number; maxBlockId?: number; maxEdits?: number }): Record<string, number[]>;
export function normalizeSavedDimensionState(record: unknown, dimensionId: string, legacyEdits: unknown, options?: { worldHeight?: number; maxBlockId?: number; maxEdits?: number }): { dimensionId: string; edits: Record<string, number[]> };
