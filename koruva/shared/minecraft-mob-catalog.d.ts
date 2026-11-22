export const MINECRAFT_MOB_SOURCE: Readonly<{ gameVersion: string; source: string }>;
export const MINECRAFT_MOB_IDS: readonly string[];
export function isMinecraftMobId(id: unknown): id is string;
