/** Minecraft 64x64 skin UV tables (see the Unity-style guide: head 32x16, body 24x16, limbs 16x16).
 *
 * Model space: the character's FRONT faces +Z, so the character's RIGHT-hand side is -X
 * and the LEFT-hand side is +X. BoxGeometry face order is +X, -X, +Y, -Y, +Z, -Z, i.e.
 * [skin "left" face, skin "right" face, top, bottom, front, back]. */
export type SkinFace = { x: number; y: number; w: number; h: number; flipX?: boolean; flipY?: boolean };
export type SkinModel = "classic" | "slim";
export interface PartFaces { base: SkinFace[]; outer: SkinFace[] }
export interface SkinFaces { head: PartFaces; body: PartFaces; armR: PartFaces; armL: PartFaces; legR: PartFaces; legL: PartFaces }

/** Sign of the model-space X coordinate of the character's right-hand side. */
export const RIGHT_SIDE = -1;

/** Standard Minecraft cuboid unwrap for a w×h×d box whose UV origin is (ox, oy). */
export function boxFaces(ox: number, oy: number, w: number, h: number, d: number): SkinFace[] {
  const left: SkinFace = { x: ox + d + w, y: oy + d, w: d, h };
  const right: SkinFace = { x: ox, y: oy + d, w: d, h };
  const top: SkinFace = { x: ox + d, y: oy, w, h: d };
  // Java's unfolded skin atlas stores every bottom face rotated 180 degrees.
  const bottom: SkinFace = { x: ox + d + w, y: oy, w, h: d, flipX: true, flipY: true };
  const front: SkinFace = { x: ox + d, y: oy + d, w, h };
  const back: SkinFace = { x: ox + d + w + d, y: oy + d, w, h };
  return [left, right, top, bottom, front, back];
}

/** Draw one skin-atlas face into its own canvas, applying Java's per-face UV orientation. */
export function drawSkinFaceTexture(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  rect: SkinFace,
): void {
  ctx.save();
  if (rect.flipX || rect.flipY) {
    ctx.translate(rect.flipX ? rect.w : 0, rect.flipY ? rect.h : 0);
    ctx.scale(rect.flipX ? -1 : 1, rect.flipY ? -1 : 1);
  }
  ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  ctx.restore();
}

export function skinFaces(model: SkinModel = "classic"): SkinFaces {
  const aw = model === "slim" ? 3 : 4;
  const part = (b: [number, number], o: [number, number], w: number, h: number, d: number): PartFaces => ({
    base: boxFaces(b[0], b[1], w, h, d), outer: boxFaces(o[0], o[1], w, h, d),
  });
  return {
    head: part([0, 0], [32, 0], 8, 8, 8),
    body: part([16, 16], [16, 32], 8, 12, 4),
    armR: part([40, 16], [40, 32], aw, 12, 4),
    armL: part([32, 48], [48, 48], aw, 12, 4),
    legR: part([0, 16], [0, 32], 4, 12, 4),
    legL: part([16, 48], [0, 48], 4, 12, 4),
  };
}

/** Copy rectangles (with horizontal flip) that turn a classic 64x32 skin's right limbs into
 * the modern left-limb UVs, exactly like Minecraft's own legacy-skin upgrade. */
export const LEGACY_MIRROR_COPIES: readonly [number, number, number, number, number, number][] = [
  // [srcX, srcY, dstX, dstY, w, h]  — leg (right → left), faces: top, bottom, right→left, front, left→right, back
  [4, 16, 20, 48, 4, 4], [8, 16, 24, 48, 4, 4], [0, 20, 24, 52, 4, 12], [4, 20, 20, 52, 4, 12], [8, 20, 16, 52, 4, 12], [12, 20, 28, 52, 4, 12],
  // arm
  [44, 16, 36, 48, 4, 4], [48, 16, 40, 48, 4, 4], [40, 20, 40, 52, 4, 12], [44, 20, 36, 52, 4, 12], [48, 20, 32, 52, 4, 12], [52, 20, 44, 52, 4, 12],
];


/** Mirror legacy 64x32 skin limb faces into the modern left-limb UV locations. */
export function mirrorLegacySkinPixels(data: Uint8ClampedArray): void {
  if (!(data instanceof Uint8ClampedArray) || data.length !== 64 * 64 * 4) {
    throw new RangeError("Expected one 64x64 RGBA skin image");
  }
  const source = data.slice();
  for (const [sx, sy, dx, dy, w, h] of LEGACY_MIRROR_COPIES) {
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const from = ((sy + row) * 64 + sx + (w - 1 - col)) * 4;
        const to = ((dy + row) * 64 + dx + col) * 4;
        data[to] = source[from]; data[to + 1] = source[from + 1];
        data[to + 2] = source[from + 2]; data[to + 3] = source[from + 3];
      }
    }
  }
}
