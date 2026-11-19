import { DEFAULT_SKIN, type Skin } from "../../shared/protocol";

export interface Profile { name: string; skin: Skin }
export interface PlayerSave {
  pos: [number, number, number];
  yaw: number;
  pitch: number;
  hotbar: number[];
  sel: number;
  /** サバイバル用(古いセーブには無い) */
  counts?: number[];
  health?: number;
}
export interface SoloSave {
  v: 1;
  seed: number;
  edits: number[];
  time: number;
  player: PlayerSave;
  savedAt: number;
}

const K_PROFILE = "voxelcraft:profile";
const K_SOLO = "voxelcraft:solo";
const K_ROOM = (code: string) => `voxelcraft:room:${code}`;
const K_HOST = (code: string) => `voxelcraft:host:${code}`;
const K_CID = "voxelcraft:cid";

function read<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch { return null; }
}
function write(key: string, v: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch { return false; }
}

export const loadProfile = (): Profile => read<Profile>(K_PROFILE) ?? { name: "", skin: { ...DEFAULT_SKIN } };
export const saveProfile = (p: Profile) => write(K_PROFILE, p);
export const loadSolo = () => { const s = read<SoloSave>(K_SOLO); return s && s.v === 1 ? s : null; };
export const saveSolo = (s: SoloSave) => write(K_SOLO, s);
export const deleteSolo = () => localStorage.removeItem(K_SOLO);
export const loadRoomPlayer = (code: string) => read<PlayerSave>(K_ROOM(code));
export const saveRoomPlayer = (code: string, p: PlayerSave) => write(K_ROOM(code), p);

/** ルーム作成者だけが持つホストトークン(ルームごとに保存) */
export const loadHostToken = (code: string): string => { try { return localStorage.getItem(K_HOST(code)) ?? ""; } catch { return ""; } };
export const saveHostToken = (code: string, token: string) => { try { localStorage.setItem(K_HOST(code), token); } catch { /* ignore */ } };
/** この端末(ブラウザ)の識別子。BAN の判定に使う。 */
export function clientId(): string {
  try {
    let id = localStorage.getItem(K_CID);
    if (!id || !/^[A-Za-z0-9-]{8,64}$/.test(id)) { id = crypto.randomUUID(); localStorage.setItem(K_CID, id); }
    return id;
  } catch { return crypto.randomUUID(); }
}
