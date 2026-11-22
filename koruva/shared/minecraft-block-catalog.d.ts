export const MINECRAFT_BLOCK_CATALOG_SOURCE: Readonly<{ gameVersion: string; dataVersionMajor: number; dataVersionMinor: number }>;
export const MINECRAFT_BLOCK_IDS: readonly string[];
export const MINECRAFT_BLOCK_COUNT: number;
export function isMinecraftBlockId(id: unknown): boolean;
