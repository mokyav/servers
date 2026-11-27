export const MOB_TYPES = [
  "allay", "armadillo", "axolotl", "bat", "bee", "blaze",
  "bogged", "breeze", "camel", "camel_husk", "cat", "cave_spider",
  "chicken", "cod", "copper_golem", "cow", "creaking", "creeper",
  "dolphin", "donkey", "drowned", "elder_guardian", "ender_dragon", "enderman",
  "endermite", "evoker", "fox", "frog", "ghast", "glow_squid",
  "goat", "guardian", "happy_ghast", "hoglin", "horse", "husk",
  "iron_golem", "llama", "magma_cube", "mooshroom", "mule", "nautilus",
  "ocelot", "panda", "parched", "parrot", "phantom", "pig",
  "piglin", "piglin_brute", "pillager", "polar_bear", "pufferfish", "rabbit",
  "ravager", "salmon", "sheep", "shulker", "silverfish", "skeleton",
  "skeleton_horse", "slime", "sniffer", "snow_golem", "spider", "squid",
  "stray", "strider", "sulfur_cube", "tadpole", "trader_llama", "tropical_fish",
  "turtle", "vex", "villager", "vindicator", "wandering_trader", "warden",
  "witch", "wither", "wither_skeleton", "wolf", "zoglin", "zombie",
  "zombie_horse", "zombie_nautilus", "zombie_villager", "zombified_piglin",
] as const;
export type MobType = typeof MOB_TYPES[number] | "end_crystal";
export type MobState = "idle" | "wander" | "chase" | "attack" | "retreat" | "fuse" | "circle" | "strafe" | "swoop";
/** Optional AI fields preserve compatibility with older saved MobInfo records. */
export interface MobInfo {
  id:string; type:MobType; x:number; y:number; z:number; yaw:number; dimensionId?:string; spawnReason?:"natural"|"summoned";
  health?:number; maxHealth?:number; respawnCrystal?:boolean; respawnInvulnerable?:boolean; beamTarget?:[number,number,number]; lastHurtAt?:number; lastDamage?:number; burningUntil?:number; lastFireDamageAt?:number;
  state?:MobState; targetId?:string; attackAt?:number; wanderYaw?:number; nextThinkAt?:number; fuse?:number; fleeYaw?:number; fleeUntil?:number; dragonPhase?:"circle"|"strafe"|"swoop"|"landing"; dragonOrbit?:number; armorPoints?:number; nextHealAt?:number; angryUntil?:number; angryTargetId?:string;
}

/** Server-authoritative projectile synchronized to players in the same dimension. */
export interface ProjectileInfo {
  eid: string; type: "arrow" | "trident" | "dragon_fireball" | "firework_rocket"; dimensionId: string; ownerId: string;
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  damage: number; createdAt: number;
  itemId?: number; pierceLevel?: number; hitTargets?: string[]; knockback?: number; fireTicks?: number;
  loyalty?: number; returning?: boolean; channeling?: boolean; ownerKind?: "player" | "mob";
}
