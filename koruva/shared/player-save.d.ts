export interface PlayerSaveSnapshot {
  schemaVersion: 1;
  location: unknown;
  vitals: unknown;
  inventory: unknown[];
  armorSlots?: unknown[];
  wear?: number[];
  savedAt: number;
}
export interface PlayerSaveStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  transaction<T>(callback: (txn: any) => Promise<T> | T): Promise<T>;
}
export type PlayerSaveSource = "snapshot" | "legacy" | "empty";
export interface LoadedPlayerSave { snapshot: PlayerSaveSnapshot; source: PlayerSaveSource; hasInventory: boolean; }
export declare const PLAYER_SAVE_SCHEMA_VERSION: 1;
export declare function playerSaveStorageKey(cid: string): string;
export declare function isPlayerSaveSnapshot(value: unknown): value is PlayerSaveSnapshot;
export declare function createPlayerSaveSnapshot(value?: { location?: unknown; vitals?: unknown; inventory?: unknown[]; armorSlots?: unknown[]; wear?: number[] }, savedAt?: number): PlayerSaveSnapshot;
export declare function loadPlayerSave(storage: PlayerSaveStorage, cid: string): Promise<LoadedPlayerSave>;
export declare function writePlayerSave(storage: PlayerSaveStorage, cid: string, value: Partial<PlayerSaveSnapshot>): Promise<PlayerSaveSnapshot>;
export declare function updatePlayerSave(storage: PlayerSaveStorage, cid: string, patch: Partial<Pick<PlayerSaveSnapshot, "location" | "vitals" | "inventory" | "armorSlots" | "wear">>): Promise<PlayerSaveSnapshot>;
