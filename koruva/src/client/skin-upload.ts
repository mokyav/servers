const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
// First-layer UV areas in a standard 64x64 Minecraft skin atlas.
const BASE_LAYER = [
  [0, 0, 32, 16], [0, 16, 56, 16], [16, 48, 32, 16],
] as const;

/** Read an exact 64x64 PNG skin. Base-layer transparent pixels become opaque black;
 * transparency in the second-layer UV regions is preserved for hats/jackets/etc. */
export async function readMinecraftSkin(file: File): Promise<string> {
  if (file.size > 2_000_000) throw new Error("PNGファイルは2MB以下にしてください");
  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (signature.length !== 8 || !PNG_SIGNATURE.every((v, i) => signature[i] === v)) {
    throw new Error("64×64のPNG画像を選んでください");
  }
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("PNG画像を読み込めませんでした"); }
  try {
    if (bitmap.width !== 64 || bitmap.height !== 64) throw new Error("スキン画像は64×64ピクセルにしてください");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("画像を処理できませんでした");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0);
    const image = ctx.getImageData(0, 0, 64, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      const a = image.data[i + 3];
      if (a !== 0 && a !== 255) throw new Error("半透明ピクセルは使えません。透明か不透明にしてください");
      const base = BASE_LAYER.some(([bx, by, bw, bh]) => x >= bx && x < bx + bw && y >= by && y < by + bh);
      if (base && a === 0) {
        image.data[i] = image.data[i + 1] = image.data[i + 2] = 0;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  } finally { bitmap.close(); }
}
