import type { MobInfo, MobType } from "./entities";
export type MobVisual = "pig" | "cow" | "chicken" | "creeper" | "zombie" | "skeleton";
export type MobBehavior = "passive" | "melee" | "ranged" | "fuse";
export interface MobProfile { maxHealth:number; speed:number; kind:MobBehavior; height:number; damage?:number; attackRange?:number; visual:MobVisual }
export interface MobActor { id:string; p:[number,number,number]; dead?:boolean; gameMode?:"survival"|"creative"|"adventure"|"spectator" }
export interface MobAttack { targetId:string; damage:number; kind:"melee"|"ranged"|"explosion" }

export interface MobProjectile { type:"arrow"|"dragon_fireball"; ownerId:string; targetId?:string; x:number; y:number; z:number; vx:number; vy:number; vz:number; damage:number }
export const MOB_PROFILES: Readonly<Record<MobType,MobProfile>>;
export function createMob(type:MobType,id:string,x:number,y:number,z:number,yaw?:number):MobInfo;
export function stepMobAI(mob:MobInfo,players:MobActor[],dtSeconds:number,nowMs:number,isSolid?:(x:number,y:number,z:number)=>boolean):{mob:MobInfo;attacks:MobAttack[];projectiles:MobProjectile[];remove:boolean;changed:boolean};
/** Voxel-ray visibility test used by player and mob combat. */
export function hasClearLine(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  solidAt: (x: number, y: number, z: number) => boolean,
): boolean;
