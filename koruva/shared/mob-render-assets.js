/** Texture resources from the supplied Java 26.3 client.
 * Keep an explicit path for every registered mob: falling back to a generic
 * /assets/mobs image hides missing resources and applies the wrong atlas.
 */
export const MOB_RENDER_TEXTURES = Object.freeze({
  allay: "allay/allay",
  armadillo: "armadillo/armadillo",
  axolotl: "axolotl/axolotl_lucy",
  bat: "bat/bat",
  bee: "bee/bee",
  blaze: "blaze/blaze",
  bogged: "skeleton/bogged",
  breeze: "breeze/breeze",
  camel: "camel/camel",
  camel_husk: "camel/camel_husk",
  cat: "cat/cat_black",
  cave_spider: "spider/cave_spider",
  chicken: "chicken/chicken_temperate",
  cod: "fish/cod",
  copper_golem: "copper_golem/copper_golem",
  cow: "cow/cow_temperate",
  creaking: "creaking/creaking",
  creeper: "creeper/creeper",
  dolphin: "dolphin/dolphin",
  donkey: "horse/donkey",
  drowned: "zombie/drowned",
  elder_guardian: "guardian/guardian_elder",
  ender_dragon: "enderdragon/dragon",
  enderman: "enderman/enderman",
  endermite: "endermite/endermite",
  evoker: "illager/evoker",
  fox: "fox/fox",
  frog: "frog/frog_temperate",
  ghast: "ghast/ghast",
  glow_squid: "squid/glow_squid",
  goat: "goat/goat",
  guardian: "guardian/guardian",
  happy_ghast: "ghast/happy_ghast",
  hoglin: "hoglin/hoglin",
  horse: "horse/horse_white",
  husk: "zombie/husk",
  iron_golem: "iron_golem/iron_golem",
  llama: "llama/llama_creamy",
  magma_cube: "slime/magmacube",
  mooshroom: "cow/mooshroom_red",
  mule: "horse/mule",
  nautilus: "nautilus/nautilus",
  ocelot: "cat/ocelot",
  panda: "panda/panda",
  parched: "skeleton/parched",
  parrot: "parrot/parrot_blue",
  phantom: "phantom/phantom",
  pig: "pig/pig_temperate",
  piglin: "piglin/piglin",
  piglin_brute: "piglin/piglin_brute",
  pillager: "illager/pillager",
  polar_bear: "bear/polarbear",
  pufferfish: "fish/pufferfish",
  rabbit: "rabbit/rabbit_brown",
  ravager: "illager/ravager",
  salmon: "fish/salmon",
  sheep: "sheep/sheep",
  shulker: "shulker/shulker",
  silverfish: "silverfish/silverfish",
  skeleton: "skeleton/skeleton",
  skeleton_horse: "horse/horse_skeleton",
  slime: "slime/slime",
  sniffer: "sniffer/sniffer",
  snow_golem: "snow_golem/snow_golem",
  spider: "spider/spider",
  squid: "squid/squid",
  stray: "skeleton/stray",
  strider: "strider/strider",
  sulfur_cube: "sulfur_cube/sulfur_cube_outer",
  tadpole: "tadpole/tadpole",
  trader_llama: "llama/llama_brown",
  tropical_fish: "fish/tropical_a",
  turtle: "turtle/turtle",
  vex: "illager/vex",
  villager: "villager/villager",
  vindicator: "illager/vindicator",
  wandering_trader: "wandering_trader/wandering_trader",
  warden: "warden/warden",
  witch: "witch/witch",
  wither: "wither/wither",
  wither_skeleton: "skeleton/wither_skeleton",
  wolf: "wolf/wolf",
  zoglin: "hoglin/zoglin",
  zombie: "zombie/zombie",
  zombie_horse: "horse/horse_zombie",
  zombie_nautilus: "nautilus/zombie_nautilus",
  zombie_villager: "zombie_villager/zombie_villager",
  zombified_piglin: "piglin/zombified_piglin",
});

/** Exact PNG dimensions in the source client. Used to validate assets and scale
 * UV rectangles when an entity atlas is not the same resolution as its rig.
 */
export const MOB_RENDER_TEXTURE_SIZES = Object.freeze({
  allay: [32, 32],
  armadillo: [64, 64],
  axolotl: [64, 64],
  bat: [32, 32],
  bee: [64, 64],
  blaze: [64, 32],
  bogged: [64, 32],
  breeze: [32, 32],
  camel: [128, 128],
  camel_husk: [128, 128],
  cat: [64, 32],
  cave_spider: [64, 32],
  chicken: [64, 32],
  cod: [32, 32],
  copper_golem: [64, 64],
  cow: [64, 64],
  creaking: [64, 64],
  creeper: [64, 32],
  dolphin: [64, 64],
  donkey: [64, 64],
  drowned: [64, 64],
  elder_guardian: [64, 64],
  ender_dragon: [256, 256],
  enderman: [64, 32],
  endermite: [64, 32],
  evoker: [64, 64],
  fox: [48, 32],
  frog: [48, 48],
  ghast: [128, 64],
  glow_squid: [64, 32],
  goat: [64, 64],
  guardian: [64, 64],
  happy_ghast: [128, 128],
  hoglin: [128, 64],
  horse: [64, 64],
  husk: [64, 64],
  iron_golem: [128, 128],
  llama: [128, 64],
  magma_cube: [64, 64],
  mooshroom: [64, 64],
  mule: [64, 64],
  nautilus: [128, 128],
  ocelot: [64, 32],
  panda: [64, 64],
  parched: [64, 64],
  parrot: [32, 32],
  phantom: [64, 64],
  pig: [64, 64],
  piglin: [64, 64],
  piglin_brute: [64, 64],
  pillager: [64, 64],
  polar_bear: [128, 64],
  pufferfish: [32, 32],
  rabbit: [64, 64],
  ravager: [128, 128],
  salmon: [32, 32],
  sheep: [64, 32],
  shulker: [64, 64],
  silverfish: [64, 32],
  skeleton: [64, 32],
  skeleton_horse: [64, 64],
  slime: [64, 32],
  sniffer: [192, 192],
  snow_golem: [64, 64],
  spider: [64, 32],
  squid: [64, 32],
  stray: [64, 32],
  strider: [64, 128],
  sulfur_cube: [128, 128],
  tadpole: [16, 16],
  trader_llama: [128, 64],
  tropical_fish: [32, 32],
  turtle: [128, 64],
  vex: [32, 32],
  villager: [64, 64],
  vindicator: [64, 64],
  wandering_trader: [64, 64],
  warden: [128, 128],
  witch: [64, 128],
  wither: [64, 64],
  wither_skeleton: [64, 32],
  wolf: [64, 32],
  zoglin: [128, 64],
  zombie: [64, 64],
  zombie_horse: [64, 64],
  zombie_nautilus: [128, 128],
  zombie_villager: [64, 64],
  zombified_piglin: [64, 64],
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
