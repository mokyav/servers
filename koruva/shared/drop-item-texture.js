import { MINECRAFT_ITEM_TEXTURE_MAP } from "./minecraft-item-texture-map.js";

/** Return a safe texture-relative path for sprite-like inventory items. */
export function itemDropTexturePath(def) {
  if (!def || typeof def.key !== "string") return null;
  if (def.key === "minecraft:potion" || def.key.startsWith("koruva:potion_")) return "item/potion";
  if (!def.itemOnly) return null;
  const texture = def.iconTexture ?? MINECRAFT_ITEM_TEXTURE_MAP[def.key];
  if (typeof texture !== "string" || texture.length === 0) return null;
  const relative = texture.replace(/^minecraft:/, "").replace(/\.png$/i, "").replace(/^\/+/, "");
  if (!relative || relative.includes("..") || relative.includes("\\") || !/^[a-z0-9_/-]+$/i.test(relative)) return null;
  return relative;
}
