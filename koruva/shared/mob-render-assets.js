/** Texture resources whose atlas layout matches a dedicated lightweight MobModels rig.
 * Entities with a different vanilla UV net must not borrow an unrelated texture atlas.
 */
export const MOB_RENDER_TEXTURES = Object.freeze({
  pig: "pig/pig_temperate",
  cow: "cow/cow_temperate",
  chicken: "chicken/chicken_temperate",
  creeper: "creeper/creeper",
  zombie: "zombie/zombie",
  husk: "zombie/husk",
  drowned: "zombie/drowned",
  zombie_villager: "zombie_villager/zombie_villager",
  skeleton: "skeleton/skeleton",
  stray: "skeleton/stray",
  bogged: "skeleton/bogged",
  parched: "skeleton/parched",
  wither_skeleton: "skeleton/wither_skeleton",
  piglin: "piglin/piglin",
  piglin_brute: "piglin/piglin_brute",
  zombified_piglin: "piglin/zombified_piglin",
  villager: "villager/villager",
  wandering_trader: "wandering_trader/wandering_trader",
  mooshroom: "cow/mooshroom_red",
});

export const MOB_RENDER_OVERLAYS = Object.freeze({
  stray: ["skeleton/stray_overlay"],
  bogged: ["skeleton/bogged_overlay"],
  // Villager skins are layered by biome, profession and profession level in vanilla.
  // Until entity metadata carries those values, use the neutral plains nitwit defaults.
  villager: [
    "villager/type/plains",
    "villager/profession/nitwit",
    "villager/profession_level/stone",
  ],
  zombie_villager: [
    "zombie_villager/type/plains",
    "zombie_villager/profession/nitwit",
    "zombie_villager/profession_level/stone",
  ],
});

export const SKELETON_RIG_TYPES = Object.freeze([
  "skeleton", "stray", "bogged", "parched", "wither_skeleton",
]);

export const HUMANOID_RIG_TYPES = Object.freeze([
  "zombie", "husk", "drowned", "zombie_villager", "evoker", "pillager", "vindicator", "illusioner",
]);

// Java 26.3 PiglinModel / ZombifiedPiglinModel use their own 64x64 head, snout and ear UV layout.
export const PIGLIN_RIG_TYPES = Object.freeze(["piglin", "piglin_brute", "zombified_piglin"]);

// Java 26.3 uses VillagerModel for both villagers and wandering traders.
export const VILLAGER_RIG_TYPES = Object.freeze(["villager", "wandering_trader"]);

/** Height in blocks of the lightweight model before scaling to the server profile. */
export const MOB_MODEL_BASE_HEIGHTS = Object.freeze({
  pig: 1,
  cow: 25 / 16,
  chicken: 15 / 16,
  creeper: 26 / 16,
  zombie: 2,
  skeleton: 2,
  villager: 2,
  piglin: 2,
});

/** Vanilla cuboid UV net in +X, -X, +Y, -Y, +Z, -Z face order. */
export function atlasBoxFaceRects(size, offset, textureSize) {
  const [w, h, d] = size;
  const [u, v] = offset;
  const [tw, th] = textureSize;
  const rects = [
    [u + d + w, v + d, d, h],
    [u, v + d, d, h],
    [u + d, v, w, d],
    [u + d + w, v, w, d],
    [u + d, v + d, w, h],
    [u + d + w + d, v + d, w, h],
  ];
  for (const [x, y, rw, rh] of rects) {
    if (![x, y, rw, rh].every(Number.isFinite) || rw <= 0 || rh <= 0 || x < 0 || y < 0 || x + rw > tw || y + rh > th) {
      throw new RangeError(`Mob atlas UV rectangle outside ${tw}x${th} texture: ${[x, y, rw, rh].join(",")}`);
    }
  }
  return rects;
}

/** Maps Three.js face-local UVs into a top-origin Minecraft texture atlas. */
export function mapAtlasFaceUV(localU, localV, rect, textureSize) {
  const [x, y, w, h] = rect;
  const [tw, th] = textureSize;
  return [
    (x + localU * w) / tw,
    1 - (y + (1 - localV) * h) / th,
  ];
}

/** Signed vanilla plane UV offsets are represented as an explicit horizontal mirror. */
export function mapAtlasPlaneUV(localU, localV, rect, textureSize, mirrorX = false) {
  const [x, y, w, h] = rect;
  const [tw, th] = textureSize;
  const u = mirrorX ? x + (1 - localU) * w : x + localU * w;
  return [u / tw, 1 - (y + (1 - localV) * h) / th];
}
