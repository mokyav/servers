/** Vanilla Java 26.3 block texture aliases for Koruva's original append-only block IDs. */
export const LEGACY_TEXTURE_ALIASES = Object.freeze({
  grass_top: "minecraft:block/grass_block_top",
  grass_side: "minecraft:block/grass_block_side",
  dirt: "minecraft:block/dirt",
  stone: "minecraft:block/stone",
  sand: "minecraft:block/sand",
  log_top: "minecraft:block/oak_log_top",
  log_side: "minecraft:block/oak_log",
  leaves: "minecraft:block/oak_leaves",
  planks: "minecraft:block/oak_planks",
  glass: "minecraft:block/glass",
  cobble: "minecraft:block/cobblestone",
  brick: "minecraft:block/bricks",
  snow: "minecraft:block/snow",
  water: "minecraft:block/water_still",
  lamp: "minecraft:block/glowstone",
  bedrock: "minecraft:block/bedrock",
  gravel: "minecraft:block/gravel",
  ore: "minecraft:block/coal_ore",
  red: "minecraft:block/red_concrete",
  blue: "minecraft:block/blue_concrete",
  yellow: "minecraft:block/yellow_concrete",
  white: "minecraft:block/white_concrete",
  oak_planks: "minecraft:block/oak_planks",
  spruce_planks: "minecraft:block/spruce_planks",
  birch_planks: "minecraft:block/birch_planks",
  sandstone: "minecraft:block/sandstone",
  coal_ore: "minecraft:block/coal_ore",
  iron_ore: "minecraft:block/iron_ore",
  gold_ore: "minecraft:block/gold_ore",
});

export function resolveBlockTextureResource(key) {
  if (key === "none") return null;
  if (typeof key !== "string" || !key) return null;
  if (key.startsWith("minecraft:")) return key;
  return LEGACY_TEXTURE_ALIASES[key] ?? null;
}
