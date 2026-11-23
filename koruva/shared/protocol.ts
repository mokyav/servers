import type { FurnaceState, FurnaceStation } from "./smelting.js";
import type { DamageCause, PlayerVitals } from "./vitals";
import type { MobInfo, ProjectileInfo } from "./entities";

export interface Skin {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  /** Minecraft Java PNG skin, normalized to 64x64 */
  image?: string;
  /** Java skin arm model; omitted values use classic */
  model?: "classic" | "slim";
}
export type Vec3 = [number, number, number];
export type Rot = [number, number];

export const DEFAULT_SKIN: Skin = { skin: "#e8b48a", hair: "#4a3022", shirt: "#3b82c4", pants: "#2f3a63" };

export type FurnaceSlot = "input" | "fuel" | "output";

export type GameMode = "survival" | "creative" | "adventure" | "spectator";

export interface PlayerInfo {
  id: string;
  name: string;
  skin: Skin;
  p: Vec3;
  r: Rot;
  /** ルームを作成したホストか(表示用) */
  host?: boolean;
  /** スニーク状態(後方互換のため任意) */
  sneak?: boolean;
  fallFlying?: boolean;
  armorSlots?: number[];
  /** クライアント側の参考ping値(任意) */
  ms?: number;
}

export interface BanEntry {
  bid: string;
  name: string;
}

export type ClientMsg =
  | { t: "hello"; name: string; skin: Skin; p?: Vec3; r?: Rot; dimensionId?: string; cid?: string; hostToken?: string; counts?: number[]; armorSlots?: number[]; itemEnchantments?: Record<string, Record<string, number>>; stackData?: Record<string, unknown> }
  | { t: "pos"; p: Vec3; r: Rot; sprint?: boolean; swimming?: boolean; sneak?: boolean; fallFlying?: boolean; flightStrafe?: number }
  | { t: "set"; x: number; y: number; z: number; b: number; d?: number } // d: 壊したブロックのドロップ(サバイバルのみ有効)
  | { t: "use"; x: number; y: number; z: number; itemId?: number; nx?: number; ny?: number; nz?: number; slotKey?: string } // server-authoritative block interaction
  | { t: "furnace"; action: "open" | "insert" | "take" | "close"; x: number; y: number; z: number; slot?: FurnaceSlot; itemId?: number; count?: number }
  | { t: "place-door"; x: number; y: number; z: number; blockId: number }
  | { t: "place-bed"; x: number; y: number; z: number; blockId: number }
  | { t: "craft"; recipeId: string; grid?: number[]; workbench?: [number, number, number] }
  | { t: "dig-start"; x: number; y: number; z: number; toolItemId?: number; slotKey?: string }
  | { t: "equipment"; armorSlots: number[] }
  | { t: "stack-data"; stackData: Record<string, unknown> }
  | { t: "use-start"; weaponId: number; slotKey: string }
  | { t: "shoot"; weaponId: number; slotKey: string }
  | { t: "anvil"; x: number; y: number; z: number; operation: "combine" | "rename"; firstSlot: string; secondSlot?: string; rename?: string }
  | { t: "grindstone"; x: number; y: number; z: number; firstSlot: string; secondSlot?: string }
  | { t: "use-item"; itemId: number }
  | { t: "fish"; itemId: number; slotKey: string }
  | { t: "end-crystal-place"; x: number; y: number; z: number; itemId: number }
  | { t: "enchant"; x: number; y: number; z: number; itemId: number; enchantmentId: string; level: number; costLevel?: number; slotKey?: string }
  | { t: "dig-cancel" }
  | { t: "pickup"; eid: string }
  | { t: "drop-item"; slotKey: string; itemId: number; count: number }
  | { t: "jump" }
  | { t: "hurt"; cause: DamageCause; amount: number }
  | { t: "eat"; foodId: string }
  | { t: "chat"; text: string } // "/" で始まる場合はコマンドとしてサーバーが処理
  | { t: "portal"; inside?: boolean } // サーバーが実際のポータルブロック接触を検証して移動
  // ---- ホスト専用(サーバー側で権限を検証) ----
  | { t: "kick"; id: string }
  | { t: "ban"; id: string }
  | { t: "unban"; bid: string }
  | { t: "bans" }
  | { t: "attack"; mobId: string; heldItemId: number; slotKey?: string };

export type ServerMsg =
  | { t: "init"; id: string; code: string; seed: number; dimensionId?: string; p?: Vec3; r?: Rot; worldgenVersion?: number; now: number; t0: number; players: PlayerInfo[]; editCount: number; mode: GameMode; host: boolean; vitals?: PlayerVitals; drops?: { eid: string; x: number; y: number; z: number; b?: number; itemId?: number; xp?: number; count?: number }[] ; counts: number[]; mobs: MobInfo[]; projectiles?: ProjectileInfo[]; armorSlots?: number[]; itemEnchantments?: Record<string, Record<string, number>>; stackData?: Record<string, unknown>; elytraDamage?: number }
  | { t: "dimension"; dimensionId: string; seed: number; worldgenVersion?: number; p: Vec3; r: Rot; players: PlayerInfo[]; drops?: { eid: string; x: number; y: number; z: number; b?: number; itemId?: number; xp?: number; count?: number }[]; mobs?: MobInfo[]; projectiles?: ProjectileInfo[] }
  | { t: "teleport"; p: Vec3; r: Rot }
  | { t: "edits"; list: number[]; done: boolean } // [x,y,z,b, x,y,z,b, ...]
  | { t: "join"; player: PlayerInfo }
  | { t: "leave"; id: string; name: string }
  | { t: "pos"; id: string; p: Vec3; r: Rot; sneak?: boolean; fallFlying?: boolean }
  | { t: "player-equipment"; id: string; armorSlots: number[] }
  | { t: "set"; x: number; y: number; z: number; b: number; id?: string }
  | { t: "chat"; id: string; name: string; text: string }
  | { t: "reject"; x: number; y: number; z: number }
  | { t: "drop"; eid: string; x: number; y: number; z: number; b?: number; itemId?: number; xp?: number; count?: number }
  | { t: "gone"; eid: string; by: string } // by = 回収したプレイヤーID(期限切れ等は空)
  | { t: "drop-item-result"; slotKey: string; itemId: number; count: number; remaining: number; accepted: boolean }
  | { t: "mode"; mode: GameMode }
  | { t: "stats"; id: string; vitals: PlayerVitals; event?: "death" | "respawn" }
  | { t: "kicked"; reason: string }
  | { t: "bans"; list: BanEntry[] }
  | { t: "error"; message: string }
  | { t: "inventory"; counts: number[]; clearHotbar?: boolean }
  | { t: "furnace"; x: number; y: number; z: number; station: FurnaceStation; state: FurnaceState; active: boolean; open?: boolean }
  | { t: "dig-ready"; x: number; y: number; z: number }
  | { t: "mob"; mob: MobInfo }
  | { t: "mobbatch"; mobs: MobInfo[] }
  | { t: "mobgone"; id: string }
  | { t: "projectile"; projectile: ProjectileInfo }
  | { t: "projectilegone"; eid: string }
  | { t: "item-enchantments"; itemEnchantments: Record<string, Record<string, number>> }
  | { t: "stack-data"; stackData: Record<string, unknown> }
  | { t: "elytra-state"; damage: number; broken: boolean }
  | { t: "rocket-boost"; vx: number; vy: number; vz: number }
  | { t: "impulse"; vx: number; vy: number; vz: number }
  | { t: "fishing"; id: string; ownerId: string; dimensionId: string; x: number; y: number; z: number; state: "waiting" | "bite" }
  | { t: "fishing-gone"; id: string; ownerId: string }
  | { t: "bossbar"; id: string; name: string; progress: number; visible: boolean; color?: string };
