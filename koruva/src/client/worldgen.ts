// クライアントとWorkerで共有する決定的なチャンク生成API。
import { B } from "../../shared/blocks";
import { CHUNK_SIZE, CHUNK_VOLUME, SEA_LEVEL, WORLD_HEIGHT } from "../../shared/constants";
import { createWorldgen, createDimensionWorldgen, normalizeWorldgenVersion, LEGACY_WORLDGEN_VERSION, WORLDGEN_VERSION } from "./worldgen-core.js";
import { normalizeDimensionId } from "../../shared/dimensions.js";
import { MINECRAFT_BLOCK_TO_RUNTIME_ID } from "../../shared/minecraft-block-runtime.js";
const generator=createWorldgen({blocks:B,blockIds:MINECRAFT_BLOCK_TO_RUNTIME_ID,chunkSize:CHUNK_SIZE,chunkVolume:CHUNK_VOLUME,seaLevel:SEA_LEVEL,worldHeight:WORLD_HEIGHT});
const dimensionGenerator=createDimensionWorldgen({blocks:B,blockIds:MINECRAFT_BLOCK_TO_RUNTIME_ID,chunkSize:CHUNK_SIZE,chunkVolume:CHUNK_VOLUME,worldHeight:WORLD_HEIGHT});
export { LEGACY_WORLDGEN_VERSION, WORLDGEN_VERSION, normalizeWorldgenVersion };
export const WORLDGEN_BIOME_IDS: readonly string[] = generator.biomeIds;
export const rand2=generator.rand2;
export function heightAt(seed:number,x:number,z:number,_version: number = WORLDGEN_VERSION):number{return generator.heightAt(seed,x,z);}
export function biomeAt(seed:number,x:number,z:number,version: number = WORLDGEN_VERSION):string{return generator.biomeAt(seed,x,z,normalizeWorldgenVersion(version));}
export function treeAt(seed:number,x:number,z:number,h:number,version: number = WORLDGEN_VERSION):number{return generator.treeAt(seed,x,z,h,normalizeWorldgenVersion(version));}
export function caveBiomeAt(seed:number,x:number,y:number,z:number):string{return generator.caveBiomeAt(seed,x,y,z);}
export function caveAt(seed:number,x:number,y:number,z:number):boolean{return generator.caveAt(seed,x,y,z);}
export function generateChunk(seed:number,cx:number,cz:number,version: number = WORLDGEN_VERSION):Uint16Array{return generator.generateChunk(seed,cx,cz,normalizeWorldgenVersion(version));}
export function generateDimensionChunk(seed:number,cx:number,cz:number,dimension:string):Uint16Array{return dimensionGenerator.generateChunk(seed,cx,cz,normalizeDimensionId(dimension));}
export function dimensionBiomeAt(seed:number,x:number,z:number,dimension:string):string{return dimensionGenerator.biomeAt(seed,x,z,normalizeDimensionId(dimension));}
