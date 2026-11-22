export interface MinecraftBiomeSpawnEntry { type: string; weight: number; count: unknown }
export interface MinecraftBiomeData {
  hasPrecipitation: boolean;
  temperature: number;
  downfall: number;
  carvers: readonly string[];
  features: readonly string[];
  spawns: Readonly<Record<string, readonly MinecraftBiomeSpawnEntry[]>>;
  effects: Readonly<Record<string, string | number>>;
  attributes: Readonly<Record<string, unknown>>;
}
export const MINECRAFT_WORLDGEN_SOURCE: Readonly<{ gameVersion: string; dataVersion: number; dataPackFormat: number }>;
export const MINECRAFT_BIOME_IDS: readonly string[];
export const MINECRAFT_BIOME_DATA: Readonly<Record<string, MinecraftBiomeData>>;
export const MINECRAFT_STRUCTURE_IDS: readonly string[];
export const MINECRAFT_STRUCTURE_DATA: Readonly<Record<string, Record<string, unknown>>>;
export const MINECRAFT_DIMENSION_TYPE_DATA: Readonly<Record<string, Record<string, unknown>>>;
export const MINECRAFT_WORLDGEN_REGISTRY_COUNTS: Readonly<Record<string, number>>;
export function minecraftBiomeData(id: string): MinecraftBiomeData | null;
