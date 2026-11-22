export function mobDimensionId(mob: { dimensionId?: string } | null | undefined): string;
export function mobsForDimension<T extends { dimensionId?: string }>(mobs: Iterable<T>, dimensionId: string): T[];
export function withMobDimension<T extends object>(mob: T, dimensionId: string): T & { dimensionId: string };
export function normalizeSavedMobs<T extends { id: string; type: unknown; x: number; y: number; z: number; yaw: number; dimensionId?: string }>(raw: unknown, options?: { maxMobs?: number; isValidType?: (type: unknown) => boolean }): T[];
