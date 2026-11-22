// Minecraft Java 26.3 の公式テクスチャを16×16ピクセルのタイルとして描画する。
import { TILE_KEYS } from "../../shared/blocks";
import { MINECRAFT_BLOCK_MODEL_REGISTRY } from "../../shared/minecraft-block-model-registry.js";
import { LEGACY_TEXTURE_ALIASES, resolveBlockTextureResource } from "../../shared/legacy-texture-aliases.js";
import { MINECRAFT_BLOCK_TILE_SIZE, minecraftTextureFrameRect, resolveMinecraftTextureAnimation } from "../../shared/minecraft-texture-frames.js";

export const TILE = MINECRAFT_BLOCK_TILE_SIZE;
export const ATLAS_COLS = 16;
export const ATLAS_TILE_KEYS = Array.from(new Set([...TILE_KEYS, ...MINECRAFT_BLOCK_MODEL_REGISTRY.textures]));
export const ATLAS_ROWS = Math.ceil(ATLAS_TILE_KEYS.length / ATLAS_COLS);
export const ATLAS_READY_EVENT = "koruva-atlas-ready";
export const ATLAS_FRAME_EVENT = "koruva-atlas-frame";

interface TextureAsset {
  image: HTMLImageElement;
  layout: ReturnType<typeof resolveMinecraftTextureAnimation>;
}
interface AtlasAnimation {
  asset: TextureAsset;
  x: number;
  y: number;
  startedAt: number | null;
  currentSequenceFrame: number;
}

const textureAssetCache = new Map<string, Promise<TextureAsset | null>>();
const atlasAnimations = new WeakMap<HTMLCanvasElement, AtlasAnimation[]>();

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

async function loadTextureAsset(resource: string): Promise<TextureAsset | null> {
  const cached = textureAssetCache.get(resource);
  if (cached) return cached;
  const pending = (async () => {
    const path = `/assets/minecraft/textures/${resource.replace(/^minecraft:/, "")}.png`;
    const image = await loadImage(path);
    if (!image) return null;
    let metadata: unknown = null;
    if (image.naturalWidth !== image.naturalHeight) {
      try {
        const response = await fetch(`${path}.mcmeta`, { cache: "force-cache" });
        if (response.ok) metadata = await response.json();
      } catch { /* static texture or unavailable animation metadata */ }
    }
    return {
      image,
      layout: resolveMinecraftTextureAnimation(image.naturalWidth, image.naturalHeight, metadata),
    };
  })();
  textureAssetCache.set(resource, pending);
  return pending;
}

function drawFrame(ctx: CanvasRenderingContext2D, asset: TextureAsset, x: number, y: number, sequenceFrame: number, alpha = 1) {
  const rect = minecraftTextureFrameRect(asset.layout, asset.layout.frames[sequenceFrame]?.index ?? 0);
  // Nearest-neighbour scaling keeps every source pixel crisp at the 16×16 block resolution.
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  ctx.drawImage(asset.image, rect.x, rect.y, rect.width, rect.height, x, y, TILE, TILE);
  ctx.globalAlpha = 1;
}

function drawAnimationFrame(ctx: CanvasRenderingContext2D, animation: AtlasAnimation, sequenceFrame: number, progress = 0) {
  const { asset, x, y } = animation;
  ctx.clearRect(x, y, TILE, TILE);
  if (asset.layout.interpolate && progress > 0) {
    const next = (sequenceFrame + 1) % asset.layout.frames.length;
    drawFrame(ctx, asset, x, y, sequenceFrame, 1 - progress);
    drawFrame(ctx, asset, x, y, next, progress);
  } else {
    drawFrame(ctx, asset, x, y, sequenceFrame);
  }
}

export function createAtlasCanvas(): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = ATLAS_COLS * TILE;
  cv.height = ATLAS_ROWS * TILE;
  const ctx = cv.getContext("2d", { alpha: true })!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cv.width, cv.height);
  const animations: AtlasAnimation[] = [];

  void Promise.all(ATLAS_TILE_KEYS.map(async (key, index) => {
    const resource = resolveBlockTextureResource(key);
    if (!resource) return; // air / invisible blocks remain transparent
    const asset = await loadTextureAsset(resource);
    if (!asset) {
      // Make a missing upstream asset visible during development instead of silently hiding it.
      const x = (index % ATLAS_COLS) * TILE, y = Math.floor(index / ATLAS_COLS) * TILE;
      ctx.fillStyle = "#ff00ff";
      ctx.fillRect(x, y, TILE, TILE);
      return;
    }
    const x = (index % ATLAS_COLS) * TILE, y = Math.floor(index / ATLAS_COLS) * TILE;
    ctx.clearRect(x, y, TILE, TILE);
    drawFrame(ctx, asset, x, y, 0);
    if (asset.layout.frames.length > 1) animations.push({ asset, x, y, startedAt: null, currentSequenceFrame: 0 });
  })).then(() => {
    atlasAnimations.set(cv, animations);
    cv.dispatchEvent(new Event(ATLAS_READY_EVENT));
  });
  return cv;
}

/** Advance official .mcmeta block animations. Returns true when the atlas canvas changed. */
export function updateAtlasAnimations(atlas: HTMLCanvasElement, nowMs: number): boolean {
  const animations = atlasAnimations.get(atlas);
  if (!animations?.length) return false;
  const ctx = atlas.getContext("2d");
  if (!ctx) return false;
  let changed = false;
  for (const animation of animations) {
    if (animation.startedAt === null) {
      animation.startedAt = nowMs;
      continue;
    }
    const frames = animation.asset.layout.frames;
    const totalDuration = frames.reduce((sum, frame) => sum + frame.durationMs, 0);
    if (totalDuration <= 0) continue;
    let phase = (nowMs - animation.startedAt) % totalDuration;
    let sequenceFrame = 0;
    while (sequenceFrame < frames.length - 1 && phase >= frames[sequenceFrame].durationMs) {
      phase -= frames[sequenceFrame].durationMs;
      sequenceFrame++;
    }
    const duration = Math.max(1, frames[sequenceFrame].durationMs);
    const progress = Math.max(0, Math.min(1, phase / duration));
    const changedFrame = sequenceFrame !== animation.currentSequenceFrame;
    if (!changedFrame && !animation.asset.layout.interpolate) continue;
    animation.currentSequenceFrame = sequenceFrame;
    drawAnimationFrame(ctx, animation, sequenceFrame, animation.asset.layout.interpolate ? progress : 0);
    changed = true;
  }
  if (changed) atlas.dispatchEvent(new Event(ATLAS_FRAME_EVENT));
  return changed;
}

/** 互換アイコン描画用のアトラスタイル番号。未知のキーは透明タイルへ退避。 */
export function tileIndex(key: string): number {
  const index = ATLAS_TILE_KEYS.indexOf(key);
  return index >= 0 ? index : Math.max(0, ATLAS_TILE_KEYS.indexOf("none"));
}

/** u0,v0,u1,v1 (v は上が1: three.js の flipY 前提) */
export function tileUV(key: string): [number, number, number, number] {
  const i = tileIndex(key);
  if (i < 0) return [0, 1 - 1 / ATLAS_ROWS, 1 / ATLAS_COLS, 1];
  const c = i % ATLAS_COLS, r = Math.floor(i / ATLAS_COLS);
  // Inset half a texel so bilinear precision/mesh seams never sample a neighbour tile.
  const atlasWidth = ATLAS_COLS * TILE, atlasHeight = ATLAS_ROWS * TILE;
  const u0 = (c * TILE + 0.5) / atlasWidth;
  const u1 = ((c + 1) * TILE - 0.5) / atlasWidth;
  const v0 = 1 - ((r + 1) * TILE - 0.5) / atlasHeight;
  const v1 = 1 - (r * TILE + 0.5) / atlasHeight;
  return [u0, v0, u1, v1];
}

export const ATLAS_TEXTURE_ALIASES = LEGACY_TEXTURE_ALIASES;
