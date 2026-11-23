import { mirrorLegacySkinPixels } from "./skin-uv";
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
// First-layer UV areas in a standard 64x64 Minecraft skin atlas.
const BASE_LAYER = [
  [0, 0, 32, 16], [0, 16, 56, 16], [16, 48, 32, 16],
] as const;

/** Read a modern 64x64 or classic 64x32 Minecraft PNG skin and normalize it to 64x64.
 * Classic skins have no second layer or left-limb textures, so their right limbs are
 * copied into the modern left-limb UV slots. Java's base layer is always opaque:
 * fully transparent base pixels become black, while partially transparent base pixels
 * keep their RGB color and become opaque. The outer layer retains its full alpha channel. */
export async function readMinecraftSkin(file: File): Promise<string> {
  if (file.size > 24_000) throw new Error("PNGファイルは24KB以下にしてください");
  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (signature.length !== 8 || !PNG_SIGNATURE.every((v, i) => signature[i] === v)) {
    throw new Error("64×64または旧形式64×32のPNG画像を選んでください");
  }
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("PNG画像を読み込めませんでした"); }
  try {
    const legacy = bitmap.width === 64 && bitmap.height === 32;
    if (!legacy && (bitmap.width !== 64 || bitmap.height !== 64)) {
      throw new Error("スキン画像は64×64または旧形式64×32ピクセルにしてください");
    }
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("画像を処理できませんでした");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 64, 64);
    ctx.drawImage(bitmap, 0, 0);
    const image = ctx.getImageData(0, 0, 64, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      const a = image.data[i + 3];
      const base = BASE_LAYER.some(([bx, by, bw, bh]) => x >= bx && x < bx + bw && y >= by && y < by + bh);
      if (base) {
        if (a === 0) {
          image.data[i] = image.data[i + 1] = image.data[i + 2] = 0;
        }
        // Java draws the inner/base skin layer as fully opaque, unlike the outer layer.
        image.data[i + 3] = 255;
      }
    }
    if (legacy) {
      // Copy each classic right-limb face into the modern left-limb UV slots.
      mirrorLegacySkinPixels(image.data);
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  } finally { bitmap.close(); }
}
