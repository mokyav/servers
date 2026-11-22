export function dimensionChunkStoragePrefix(dimensionId: string): string;
export function parseDimensionChunkStorageKey(storageKey: unknown): { dimensionId: string; chunkKey: string } | null;
