import type { Rot, Vec3 } from "./protocol";
export interface SavedPlayerLocation { version: 1; dimensionId: string; p: Vec3; r: Rot }
export function normalizePlayerLocation(value: unknown): SavedPlayerLocation | null;
