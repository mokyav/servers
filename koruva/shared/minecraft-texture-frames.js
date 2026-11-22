/**
 * Resolve Minecraft Java's vertical/horizontal texture animation sheet into
 * fixed-size frame rectangles. Frame indices follow the order in .mcmeta.
 */
export const MINECRAFT_BLOCK_TILE_SIZE = 16;

const positiveInt = (value) => Number.isInteger(value) && value > 0 ? value : null;

export function resolveMinecraftTextureAnimation(imageWidth, imageHeight, metadata = null) {
  if (!Number.isInteger(imageWidth) || !Number.isInteger(imageHeight) || imageWidth < 1 || imageHeight < 1) {
    throw new RangeError("Texture dimensions must be positive integers");
  }
  const animation = metadata && typeof metadata === "object" && metadata.animation && typeof metadata.animation === "object"
    ? metadata.animation : {};
  const explicitWidth = positiveInt(animation.width);
  const explicitHeight = positiveInt(animation.height);

  let frameWidth = explicitWidth ?? imageWidth;
  let frameHeight = explicitHeight ?? imageHeight;
  if (!explicitWidth && !explicitHeight && imageWidth !== imageHeight) {
    // Vanilla animated block textures in this client use square frames in a strip.
    const edge = Math.min(imageWidth, imageHeight);
    if (imageWidth % edge === 0 && imageHeight % edge === 0) {
      frameWidth = edge;
      frameHeight = edge;
    }
  } else if (explicitWidth && !explicitHeight) {
    frameHeight = explicitWidth;
  } else if (!explicitWidth && explicitHeight) {
    frameWidth = explicitHeight;
  }

  frameWidth = Math.min(imageWidth, frameWidth);
  frameHeight = Math.min(imageHeight, frameHeight);
  const columns = Math.max(1, Math.floor(imageWidth / frameWidth));
  const rows = Math.max(1, Math.floor(imageHeight / frameHeight));
  const frameCount = columns * rows;
  const defaultTicks = positiveInt(animation.frametime) ?? 1;
  const sourceFrames = Array.isArray(animation.frames) && animation.frames.length
    ? animation.frames
    : Array.from({ length: frameCount }, (_, index) => index);
  const frames = sourceFrames.map((entry) => {
    const index = typeof entry === "number" ? entry : entry && typeof entry === "object" ? entry.index : NaN;
    const ticks = typeof entry === "object" && entry ? positiveInt(entry.time) ?? defaultTicks : defaultTicks;
    if (!Number.isInteger(index) || index < 0 || index >= frameCount) return null;
    return { index, durationMs: ticks * 50 };
  }).filter(Boolean);
  if (!frames.length) frames.push({ index: 0, durationMs: defaultTicks * 50 });

  return { frameWidth, frameHeight, columns, rows, frames, interpolate: animation.interpolate === true };
}

export function minecraftTextureFrameRect(layout, frameIndex) {
  const safeIndex = Number.isInteger(frameIndex) && frameIndex >= 0 && frameIndex < layout.columns * layout.rows ? frameIndex : 0;
  return {
    x: (safeIndex % layout.columns) * layout.frameWidth,
    y: Math.floor(safeIndex / layout.columns) * layout.frameHeight,
    width: layout.frameWidth,
    height: layout.frameHeight,
  };
}
