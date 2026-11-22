// ブロックの等角アイコンをテクスチャアトラスから生成
import { BLOCKS } from "../../shared/blocks";
import { MINECRAFT_ITEM_TEXTURE_MAP } from "../../shared/minecraft-item-texture-map.js";
import { itemDropTexturePath } from "../../shared/drop-item-texture.js";
import { ATLAS_COLS, TILE, tileIndex } from "./atlas";

const cache = new Map<number, string>();

export function clearBlockIconCache(): void { cache.clear(); }

/** Resolve the client-provided 26.3 texture for a catalog item. */
export function minecraftItemTextureUrl(id: string): string | null {
  const canonical = id.includes(":") ? id : `minecraft:${id}`;
  const texture = MINECRAFT_ITEM_TEXTURE_MAP[canonical];
  return texture ? `/assets/minecraft/textures/${texture.replace(/^minecraft:/, "")}.png` : null;
}

export function blockIcon(atlas: HTMLCanvasElement, id: number, size = 48): string {
  const key = id * 1000 + size;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = BLOCKS[id];
  const itemTexture = itemDropTexturePath(def);
  if (itemTexture) return `/assets/minecraft/textures/${itemTexture}.png`;
  if (def.key === "minecraft:potion" || def.key.startsWith("koruva:potion_")) {
    return "/assets/minecraft/textures/item/potion.png";
  }
  if (def.itemOnly) {
    const texture = def.iconTexture ?? MINECRAFT_ITEM_TEXTURE_MAP[def.key];
    if (texture) return `/assets/minecraft/textures/${texture.replace(/^minecraft:/, "")}.png`;
  }
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const s = size / 48;
  const sx = (k: string) => (tileIndex(k) % ATLAS_COLS) * TILE;
  const sy = (k: string) => Math.floor(tileIndex(k) / ATLAS_COLS) * TILE;
  const draw = (k: string, m: [number, number, number, number, number, number], dark: number) => {
    ctx.save();
    ctx.setTransform(m[0] * s, m[1] * s, m[2] * s, m[3] * s, m[4] * s, m[5] * s);
    ctx.drawImage(atlas, sx(k), sy(k), TILE, TILE, 0, 0, TILE, TILE);
    if (dark > 0) { ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(0, 0, TILE, TILE); }
    ctx.restore();
  };
  // 上面 / 左面 / 右面
  draw(def.tiles.top, [20 / 16, 10 / 16, -20 / 16, 10 / 16, 24, 2], 0);
  draw(def.tiles.side, [20 / 16, 10 / 16, 0, 22 / 16, 4, 12], 0.22);
  draw(def.tiles.side, [20 / 16, -10 / 16, 0, 22 / 16, 24, 22], 0.4);
  const url = cv.toDataURL();
  cache.set(key, url);
  return url;
}
