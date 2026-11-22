export const MINECRAFT_BLOCK_RUNTIME_ID_START: number;
export const MINECRAFT_BLOCK_RUNTIME_ID_END: number;
export const MINECRAFT_BLOCK_STATE_RUNTIME_ID_END: number;
export const MINECRAFT_BLOCK_RUNTIME_STATE_COUNT: number;
export const MINECRAFT_BLOCK_LEGACY_RUNTIME_ID_END: number;
export const MINECRAFT_BLOCK_TO_RUNTIME_ID: Readonly<Record<string, number>>;
export const MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID: Readonly<Record<number, { token: string; kind: string; state: Record<string, string | number | boolean> }>>;
export function resolveMinecraftBlockRuntimeId(id: string): number | undefined;
export function minecraftBlockVariantId(identifier: string, state?: Record<string, string | number | boolean>): number | undefined;
