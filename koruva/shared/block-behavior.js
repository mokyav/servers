import { MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID } from "./minecraft-block-runtime.js";

const DIR = Object.freeze({
  north: [0, 0, -1], east: [1, 0, 0], south: [0, 0, 1], west: [-1, 0, 0],
  up: [0, 1, 0], down: [0, -1, 0],
});
const FLOOR_ATTACHED = /(?:^|_)(?:sapling|flower|poppy|dandelion|tulip|orchid|daisy|allium|azure_bluet|cornflower|lily_of_the_valley|wither_rose|rose_bush|sunflower|lilac|peony|pink_petals|wildflowers|torchflower|pitcher_plant|red_mushroom|brown_mushroom|torch|redstone_torch|soul_torch|rail|powered_rail|detector_rail|activator_rail|repeater|comparator|carpet|pressure_plate|redstone_wire|tripwire|tripwire_hook|lever|button|candle|candle_cake|cake|coral_fan|dead_bush|fern|short_grass|tall_grass|large_fern|seagrass|kelp|sugar_cane|cactus|wheat|carrots|potatoes|beetroots|nether_wart|sweet_berry_bush|bamboo|bamboo_sapling|melon_stem|pumpkin_stem|lily_pad|sea_pickle|small_dripleaf|big_dripleaf|chorus_flower|flower_pot|potted_[a-z0-9_]+)$/;
const WALL_ATTACHED = /(?:^|_)(?:wall_torch|wall_sign|wall_hanging_sign|wall_banner|wall_head|wall_skull|ladder|wall_lever|wall_button)$/;
const FALLING = /^(?:sand|red_sand|gravel|(?:white|orange|magenta|light_blue|yellow|lime|pink|gray|light_gray|cyan|purple|blue|brown|green|red|black)_concrete_powder|anvil|chipped_anvil|damaged_anvil|pointed_dripstone|dragon_egg)$/;
const FLOOR_TOKENS = new Set(["grass", "grass_block", "dirt", "coarse_dirt", "podzol", "mycelium", "rooted_dirt", "moss_block", "mud", "farmland", "sand", "red_sand", "gravel", "soul_sand", "soul_soil", "clay", "netherrack", "crimson_nylium", "warped_nylium"]);
const PLANT_SOIL = new Set(["grass_block", "dirt", "coarse_dirt", "podzol", "mycelium", "rooted_dirt", "moss_block", "mud", "farmland", "sand", "red_sand", "soul_sand", "soul_soil", "crimson_nylium", "warped_nylium"]);

function tokenFor(id, blocks) {
  const meta = MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID[id];
  if (meta?.token) return meta.token;
  return String(blocks?.[id]?.key ?? "").replace(/^minecraft:/, "").replace(/_(?:north|east|south|west|top|bottom|upper|lower|left|right|open|closed|straight|inner_left|inner_right|outer_left|outer_right)(?:_.*)?$/, "");
}

export function blockToken(id, blocks) {
  return tokenFor(id, blocks);
}

export function isReplaceableBlock(id, blocks) {
  if (!Number.isInteger(id) || id === 0) return true;
  const def = blocks?.[id];
  if (!def || def.render === "liquid") return true;
  const token = tokenFor(id, blocks);
  return !def.solid && (FLOOR_ATTACHED.test(token) || /(?:^|_)(?:vine|glow_lichen|lichen|fire|soul_fire|snow|dead_bush|cobweb|spore_blossom|hanging_roots)$/.test(token));
}

export function isFallingBlock(id, blocks) {
  return FALLING.test(tokenFor(id, blocks));
}

export function neighborCells(x, y, z) {
  return [
    { x, y, z }, { x: x + 1, y, z }, { x: x - 1, y, z },
    { x, y: y + 1, z }, { x, y: y - 1, z },
    { x, y, z: z + 1 }, { x, y, z: z - 1 },
  ];
}

function facingVector(state) {
  const facing = typeof state?.facing === "string" ? state.facing : "north";
  return DIR[facing] ?? DIR.north;
}

export function blockSupportPosition(id, x, y, z, blocks) {
  const def = blocks?.[id];
  if (!def) return null;
  const state = def.state ?? {};
  const token = tokenFor(id, blocks);
  // Fence gates are supported by their neighbouring fence/wall posts, not by the floor.
  if (def.shape === "door" && token.endsWith("_fence_gate")) return null;
  if (def.shape === "door") return state.half === "upper" ? { x, y: y - 1, z } : { x, y: y - 1, z };
  if (token.endsWith("_bed")) return { x, y: y - 1, z };
  if (state.face === "ceiling" || token.endsWith("_hanging_sign") && !token.includes("wall_hanging_sign") || token.endsWith("_chain")) return { x, y: y + 1, z };
  if (["spore_blossom", "hanging_roots", "weeping_vines", "weeping_vines_plant", "twisting_vines", "twisting_vines_plant", "cave_vines", "cave_vines_plant"].includes(token)) return { x, y: y + 1, z };
  if (token === "end_rod" || token === "lightning_rod") {
    const [dx, dy, dz] = DIR[state.facing] ?? DIR.up;
    return { x: x - dx, y: y - dy, z: z - dz };
  }
  if (token === "bell") {
    if (state.attachment === "ceiling") return { x, y: y + 1, z };
    if (state.attachment === "single_wall" || state.attachment === "double_wall") {
      const [dx, dy, dz] = facingVector(state);
      return { x: x - dx, y: y - dy, z: z - dz };
    }
    return { x, y: y - 1, z };
  }
  if (token === "lantern" || token.endsWith("_lantern")) return state.hanging === true || state.hanging === "true" ? { x, y: y + 1, z } : { x, y: y - 1, z };
  if (token === "vine") {
    for (const facing of ["north", "east", "south", "west"]) {
      if (state[facing] === true || state[facing] === "true") {
        const [dx, , dz] = DIR[facing];
        return { x: x - dx, y, z: z - dz };
      }
    }
    if (state.up === true || state.up === "true") return { x, y: y + 1, z };
    return { x, y: y + 1, z };
  }
  if (state.face === "wall" || WALL_ATTACHED.test(token) || token.endsWith("_wall_sign") || token.endsWith("_wall_banner")) {
    const [dx, dy, dz] = facingVector(state);
    return { x: x - dx, y: y - dy, z: z - dz };
  }
  if (token === "cocoa") {
    const [dx, dy, dz] = facingVector(state);
    return { x: x - dx, y: y - dy, z: z - dz };
  }
  if (def.shape === "trapdoor") {
    const [dx, , dz] = facingVector(state);
    return { x: x - dx, y, z: z - dz };
  }
  if (token.endsWith("_sign") && !token.endsWith("_wall_sign") || token.endsWith("_banner") && !token.endsWith("_wall_banner")) {
    return { x, y: y - 1, z };
  }
  if (FLOOR_ATTACHED.test(token) || token === "snow" || token === "big_dripleaf" || token === "small_dripleaf") {
    return { x, y: y - 1, z };
  }
  return null;
}

export function requiresBlockSupport(id, blocks) {
  return blockSupportPosition(id, 0, 0, 0, blocks) !== null || tokenFor(id, blocks) === "vine";
}

/** Return the second cell occupied by a vanilla double-height door or two-block bed. */
export function pairedBlockPosition(id, x, y, z, blocks) {
  const def = blocks?.[id];
  if (!def || id <= 0) return null;
  const token = tokenFor(id, blocks);
  if (def.shape === "door" && !token.endsWith("_fence_gate")) {
    return { x, y: y + (def.state?.half === "upper" ? -1 : 1), z };
  }
  if (token.endsWith("_bed")) {
    const facing = typeof def.state?.facing === "string" ? def.state.facing : "north";
    const [dx, , dz] = DIR[facing] ?? DIR.north;
    const sign = def.state?.part === "head" ? -1 : 1;
    return { x: x + dx * sign, y, z: z + dz * sign };
  }
  return null;
}

export function canBlockStay(get, id, x, y, z, blocks) {
  const def = blocks?.[id];
  if (!def || id <= 0) return true;
  const token = tokenFor(id, blocks);
  if (token === "vine") {
    const state = def.state ?? {};
    const attached = ["north", "east", "south", "west"].filter(face => state[face] === true || state[face] === "true");
    if (attached.length) return attached.some(face => {
      const [dx, , dz] = DIR[face];
      const neighbor = get(x + dx, y, z + dz);
      return neighbor > 0 && !!blocks?.[neighbor]?.solid;
    });
    const above = get(x, y + 1, z);
    return above > 0 && !!blocks?.[above]?.solid;
  }
  if (def.shape === "door" && !token.endsWith("_fence_gate")) {
    const otherY = def.state?.half === "upper" ? y - 1 : y + 1;
    const other = get(x, otherY, z);
    if (other <= 0 || blocks?.[other]?.shape !== "door" || tokenFor(other, blocks) !== token) return false;
    if (def.state?.half !== "upper") {
      const below = get(x, y - 1, z);
      return !!blocks?.[below]?.solid;
    }
    return true;
  }
  if (token.endsWith("_bed")) {
    const below = get(x, y - 1, z);
    if (!blocks?.[below]?.solid) return false;
    const facing = typeof def.state?.facing === "string" ? def.state.facing : "north";
    const [dx, , dz] = DIR[facing] ?? DIR.north;
    const isHead = def.state?.part === "head";
    const other = get(x + (isHead ? -dx : dx), y, z + (isHead ? -dz : dz));
    return other > 0 && tokenFor(other, blocks) === token && blocks?.[other]?.state?.part !== def.state?.part;
  }
  const support = blockSupportPosition(id, x, y, z, blocks);
  if (!support) return true;
  const supportId = get(support.x, support.y, support.z);
  if (supportId <= 0) return false;
  const supportDef = blocks?.[supportId];
  if (token === "chorus_flower") return ["chorus_plant", "end_stone"].includes(tokenFor(supportId, blocks));
  if (token === "lily_pad") return /^(?:water|bubble_column)$/.test(tokenFor(supportId, blocks));
  if (token === "seagrass" || token === "tall_seagrass" || token === "kelp" || token === "kelp_plant") {
    return /^(?:water|bubble_column)$/.test(tokenFor(supportId, blocks));
  }
  if (!supportDef?.solid) return false;
  if (/(?:sapling|flower|tulip|orchid|daisy|allium|azure_bluet|cornflower|lily_of_the_valley|wither_rose|sunflower|lilac|peony|pink_petals|torchflower|pitcher_plant)$/.test(token)) {
    return PLANT_SOIL.has(tokenFor(supportId, blocks));
  }
  if (token === "dead_bush") return ["sand", "red_sand", "terracotta"].includes(tokenFor(supportId, blocks));
  if (token === "sea_pickle") return /^(?:tube|brain|bubble|fire|horn)_coral_block$/.test(tokenFor(supportId, blocks));
  if (token === "small_dripleaf" || token === "big_dripleaf") return ["clay", "grass_block", "dirt", "coarse_dirt", "podzol", "mycelium", "moss_block", "rooted_dirt"].includes(tokenFor(supportId, blocks));
  if (token === "wheat" || token === "carrots" || token === "potatoes" || token === "beetroots" || token === "melon_stem" || token === "pumpkin_stem") {
    return tokenFor(supportId, blocks) === "farmland";
  }
  if (token === "nether_wart") return tokenFor(supportId, blocks) === "soul_sand";
  if (token === "cocoa") return /^(?:jungle_log|jungle_wood|stripped_jungle_log|stripped_jungle_wood)$/.test(tokenFor(supportId, blocks));
  if (token === "bamboo" || token === "bamboo_sapling") return ["grass_block", "dirt", "coarse_dirt", "podzol", "mycelium", "rooted_dirt", "moss_block", "sand", "red_sand", "gravel"].includes(tokenFor(supportId, blocks));
  if (token === "red_mushroom" || token === "brown_mushroom") return ["mycelium", "podzol", "moss_block", "dirt", "grass_block", "crimson_nylium", "warped_nylium"].includes(tokenFor(supportId, blocks));
  if (token === "sweet_berry_bush") return PLANT_SOIL.has(tokenFor(supportId, blocks));
  if (token === "sugar_cane") {
    const soil = new Set(["grass_block", "dirt", "coarse_dirt", "podzol", "mycelium", "rooted_dirt", "moss_block", "mud", "sand", "red_sand"]);
    const adjacent = [get(x + 1, y - 1, z), get(x - 1, y - 1, z), get(x, y - 1, z + 1), get(x, y - 1, z - 1)];
    return soil.has(tokenFor(supportId, blocks)) && adjacent.some(neighbor => /^(?:water|bubble_column)$/.test(tokenFor(neighbor, blocks)));
  }
  if (token === "cactus") return [
    get(x + 1, y, z), get(x - 1, y, z), get(x, y, z + 1), get(x, y, z - 1),
  ].every(neighbor => neighbor === 0 || !blocks?.[neighbor]?.solid) && (tokenFor(supportId, blocks) === "sand" || tokenFor(supportId, blocks) === "red_sand" || tokenFor(supportId, blocks) === "cactus");
  return true;
}

export function canPlaceBlockAt(get, id, x, y, z, blocks) {
  if (!Number.isInteger(id) || id <= 0 || !blocks?.[id]?.placeable || blocks[id].itemOnly) return false;
  const existing = get(x, y, z);
  if (!isReplaceableBlock(existing, blocks)) return false;
  return canBlockStay(get, id, x, y, z, blocks);
}
