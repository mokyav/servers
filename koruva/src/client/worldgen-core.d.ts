import type { B } from "../../shared/blocks";
export interface WorldgenConfig { blocks: typeof B; blockIds?: Record<string, number>; chunkSize: number; chunkVolume: number; seaLevel: number; worldHeight: number }
export interface WorldgenCore { biomeIds: readonly string[]; rand2(seed:number,x:number,z:number):number; heightAt(seed:number,x:number,z:number):number; biomeAt(seed:number,x:number,z:number,version?:number):string; caveBiomeAt(seed:number,x:number,y:number,z:number):string; caveAt(seed:number,x:number,y:number,z:number):boolean; treeAt(seed:number,x:number,z:number,height:number,version?:number):number; generateChunk(seed:number,cx:number,cz:number,version?:number):Uint16Array }
export const LEGACY_WORLDGEN_VERSION: 1;
export const WORLDGEN_VERSION: 6;
export function normalizeWorldgenVersion(v: unknown): 1 | 2 | 3 | 4 | 5 | 6;
export function createWorldgen(config: WorldgenConfig): WorldgenCore;
export function createDimensionWorldgen(options: { blocks: typeof B; blockIds?: Record<string, number>; chunkSize: number; chunkVolume: number; worldHeight: number }): { biomeAt(seed:number,x:number,z:number,dimension:string):string; generateChunk(seed:number,cx:number,cz:number,dimension:string):Uint16Array };
