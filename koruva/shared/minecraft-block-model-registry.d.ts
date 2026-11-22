export interface MinecraftModelFace { texture: string; uv: number[] | null; rotation: number; tintindex: number; cullface: string | null }
export interface MinecraftModelElement { from: number[]; to: number[]; rotation: { origin: number[]; axis: string; angle: number; rescale?: boolean } | null; shade: boolean; faces: Record<string, MinecraftModelFace> }
export interface MinecraftResolvedModel { name: string; elements: MinecraftModelElement[] }
export interface MinecraftModelInstance { m: number; x: number; y: number; z: number; uvlock: boolean }
export interface MinecraftBlockModelRegistry { version: number; modelCount: number; blockStateCount: number; textures: string[]; models: MinecraftResolvedModel[]; byId: MinecraftModelInstance[][] }
export const MINECRAFT_BLOCK_MODEL_REGISTRY: MinecraftBlockModelRegistry;
