export type NaturalMobType = string;
export interface NaturalMobSpawnEntry { type: NaturalMobType; weight: number; count: unknown }
export const NATURAL_MOB_SPAWN_INTERVAL_MS: number;
export const NATURAL_MOB_MAX_PER_DIMENSION: number;
export const NATURAL_MOB_DESPAWN_DISTANCE: number;
export const NATURAL_MOB_DIMENSIONS: readonly string[];
export function isNaturalMobSpawnDue(nowMs: number, lastSpawnMs: number, intervalMs?: number): boolean;
export function daylightAtTime(nowMs: number, createdAtMs: number, dayLengthSeconds: number): boolean | null;
export function naturalMobSpawnEntries(options?: { dimensionId?: string; biome?: string; daylight?: boolean; category?: string | null }): readonly NaturalMobSpawnEntry[];
export function naturalMobSpawnPool(options?: { dimensionId?: string; biome?: string; daylight?: boolean; category?: string | null }): readonly NaturalMobType[];
export function chooseNaturalMobType(daylight: boolean, random?: () => number, dimensionId?: string, biome?: string, category?: string | null): NaturalMobType | null;
export interface NaturalSpawnPlayer { p: [number, number, number]; dead?: boolean; gameMode?: "survival" | "creative" | "adventure" | "spectator" }
export interface NaturalMobDespawnPlayer { p: [number, number, number]; dimensionId?: string; dead?: boolean }
export function shouldDespawnNaturalMob(mob: { spawnReason?: "natural" | "summoned"; dimensionId?: string; x: number; y: number; z: number }, players: NaturalMobDespawnPlayer[], maxDistance?: number): boolean;
export function findNaturalSpawnSpot(options: { players: NaturalSpawnPlayer[]; random?: () => number; getSurfaceY: (x: number, z: number) => number | null; isClear: (x: number, y: number, z: number) => boolean; attempts?: number; minDistance?: number; maxDistance?: number; headroom?: number; width?: number }): { x: number; y: number; z: number } | null;
export function naturalMobSpawnGroupSize(type: NaturalMobType, random?: () => number): number | null;
export function findNaturalSpawnGroup(options: { center: { x: number; y: number; z: number }; size?: number; random?: () => number; getSurfaceY: (x: number, z: number) => number | null; isClear: (x: number, y: number, z: number) => boolean; headroom?: number; radius?: number; minSeparation?: number; attempts?: number; width?: number }): { x: number; y: number; z: number }[];
