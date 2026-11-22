export const MINECRAFT_BLOCK_TILE_SIZE: 16;

export interface MinecraftTextureAnimationLayout {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  frames: Array<{ index: number; durationMs: number }>;
  interpolate: boolean;
}

export function resolveMinecraftTextureAnimation(
  imageWidth: number,
  imageHeight: number,
  metadata?: unknown
): MinecraftTextureAnimationLayout;

export function minecraftTextureFrameRect(
  layout: MinecraftTextureAnimationLayout,
  frameIndex: number
): any;
