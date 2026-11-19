import { BLOCK_COUNT, B } from "./blocks";
import { MAX_COORD, WORLD_HEIGHT } from "./constants";
import { DEFAULT_SKIN, type Rot, type Skin, type Vec3 } from "./protocol";

const HEX = /^#[0-9a-fA-F]{6}$/;

export function sanitizeName(v: unknown): string {
  const s = typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 16) : "";
  return s || "Player";
}
export function sanitizeSkin(v: unknown): Skin {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const pick = (k: keyof Skin) => (typeof o[k] === "string" && HEX.test(o[k] as string) ? (o[k] as string) : DEFAULT_SKIN[k]);
  return { skin: pick("skin"), hair: pick("hair"), shirt: pick("shirt"), pants: pick("pants") };
}
export function sanitizeVec3(v: unknown, fallback: Vec3): Vec3 {
  if (!Array.isArray(v) || v.length !== 3) return fallback;
  const [x, y, z] = v as number[];
  if (![x, y, z].every((n) => typeof n === "number" && Number.isFinite(n))) return fallback;
  return [clamp(x, -MAX_COORD, MAX_COORD), clamp(y, -100, 400), clamp(z, -MAX_COORD, MAX_COORD)];
}
export function sanitizeRot(v: unknown, fallback: Rot): Rot {
  if (!Array.isArray(v) || v.length !== 2) return fallback;
  const [a, b] = v as number[];
  if (![a, b].every((n) => typeof n === "number" && Number.isFinite(n))) return fallback;
  return [clamp(a, -1000, 1000), clamp(b, -2, 2)];
}
export function sanitizeChat(v: unknown): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200) : "";
}
/** ブロック設置/破壊の妥当性。b=0 は破壊。 */
export function isValidSet(x: unknown, y: unknown, z: unknown, b: unknown): boolean {
  return (
    Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) && Number.isInteger(b) &&
    Math.abs(x as number) <= MAX_COORD && Math.abs(z as number) <= MAX_COORD &&
    (y as number) >= 1 && (y as number) < WORLD_HEIGHT &&
    (b as number) >= 0 && (b as number) <= BLOCK_COUNT && b !== B.BEDROCK
  );
}
function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}
