export type DimensionId = "minecraft:overworld" | "minecraft:the_nether" | "minecraft:the_end";
export interface DimensionInfo {
  id: DimensionId; generator: string; dimensionType: string;
  runtimeHeight: 128; minY: number; vanillaHeight: number; logicalHeight: number;
  hasSky: boolean; naturalLight: boolean; hasCeiling: boolean;
  coordinateScale: number; ambientLight: number; infiniburn: string | null;
}
export const DIMENSION_IDS: Readonly<{ OVERWORLD: "minecraft:overworld"; NETHER: "minecraft:the_nether"; END: "minecraft:the_end" }>;
export const DIMENSIONS: Readonly<Record<DimensionId, Readonly<DimensionInfo>>>;
export function normalizeDimensionId(id: unknown): DimensionId;
export function isDimensionId(id: unknown): id is DimensionId;
export function mapDimensionCoordinates(from: unknown, to: unknown, position: { x?: number; y?: number; z?: number }): { x: number; y: number; z: number };
export function findSafeSpawn(world: { ensureChunk(cx: number, cz: number): unknown; get(x: number,y: number,z: number): number }, position: { x?:number; y?:number; z?:number }, options: { height?:number; searchRadius?:number; isSolid:(blockId:number)=>boolean; isHazard?:(blockId:number)=>boolean }): { x:number;y:number;z:number } | null;
export function resolveDimensionAlias(value: unknown): DimensionId | null;
