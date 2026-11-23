import { MINECRAFT_BIOME_IDS } from "../../shared/minecraft-worldgen-catalog.js";
import { minecraftBlockVariantId } from "../../shared/minecraft-block-runtime.js";

const LEGACY_WORLDGEN_VERSION = 1, WORLDGEN_VERSION = 3;

/** Twelve End Portal Frames arranged around a 3×3 opening, all facing inward. */
export function strongholdPortalFramePlacements(cx, cz, y, frameForFacing) {
  const placements = [];
  for (let offset = -1; offset <= 1; offset++) {
    placements.push([cx + offset, y, cz - 2, frameForFacing("south")]);
    placements.push([cx + offset, y, cz + 2, frameForFacing("north")]);
    placements.push([cx - 2, y, cz + offset, frameForFacing("east")]);
    placements.push([cx + 2, y, cz + offset, frameForFacing("west")]);
  }
  return placements;
}

/** Floor, carved interior, walls, roof, entrance corridor, and portal frame ring. */
export function strongholdPortalRoomPlacements(cx, cz, floorY, brick, frameForFacing) {
  const edits = [];
  const set = (x, y, z, id) => edits.push([x, y, z, id]);

  for (let z = -5; z <= 5; z++) for (let x = -7; x <= 7; x++) set(cx + x, floorY, cz + z, brick);

  // Explicitly carve the entire interior out of the pre-existing terrain.
  for (let y = 1; y <= 4; y++) {
    for (let z = -4; z <= 4; z++) for (let x = -6; x <= 6; x++) set(cx + x, floorY + y, cz + z, 0);
  }

  for (let y = 1; y <= 4; y++) {
    for (let z = -5; z <= 5; z++) {
      set(cx - 7, floorY + y, cz + z, brick);
      set(cx + 7, floorY + y, cz + z, brick);
    }
    for (let x = -7; x <= 7; x++) {
      set(cx + x, floorY + y, cz - 5, brick);
      set(cx + x, floorY + y, cz + 5, brick);
    }
  }
  for (let z = -5; z <= 5; z++) for (let x = -7; x <= 7; x++) set(cx + x, floorY + 5, cz + z, brick);

  // Open a three-wide doorway and a short corridor on the north side.
  for (let y = 1; y <= 3; y++) {
    for (let x = -1; x <= 1; x++) set(cx + x, floorY + y, cz - 5, 0);
    for (let z = -12; z <= -6; z++) {
      set(cx - 2, floorY + y, cz + z, brick);
      set(cx + 2, floorY + y, cz + z, brick);
      for (let x = -1; x <= 1; x++) set(cx + x, floorY + y, cz + z, 0);
    }
  }
  for (let z = -12; z <= -6; z++) {
    for (let x = -2; x <= 2; x++) {
      set(cx + x, floorY, cz + z, brick);
      set(cx + x, floorY + 4, cz + z, brick);
    }
  }

  for (const frame of strongholdPortalFramePlacements(cx, cz, floorY + 1, frameForFacing)) edits.push(frame);
  return edits;
}
const hash2 = (s, x, z) => {
  let h = (s | 0) ^ Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h = Math.imul(h ^ (h >>> 16), 2246822519);
  return (h ^ (h >>> 15)) >>> 0;
};
const hash3 = (s, x, y, z) => {
  let h = (s | 0) ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 1274126177) ^ Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 2246822519); h = Math.imul(h ^ (h >>> 16), 3266489917);
  return (h ^ (h >>> 15)) >>> 0;
};
const rand2 = (s, x, z) => hash2(s, x, z) / 4294967296;
const rand3 = (s, x, y, z) => hash3(s, x, y, z) / 4294967296;
const fade = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
function noise2(s, x, z) {
  const x0 = Math.floor(x), z0 = Math.floor(z), fx = fade(x - x0), fz = fade(z - z0);
  const a = rand2(s, x0, z0), b = rand2(s, x0 + 1, z0), c = rand2(s, x0, z0 + 1), d = rand2(s, x0 + 1, z0 + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
function fbm(s, x, z, octaves) {
  let amplitude = 1, frequency = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) { sum += noise2(s + i * 131, x * frequency, z * frequency) * amplitude; norm += amplitude; amplitude *= .5; frequency *= 2; }
  return sum / norm;
}
function noise3(s, x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), fx = fade(x - X), fy = fade(y - Y), fz = fade(z - Z);
  const a = rand3(s, X, Y, Z), b = rand3(s, X + 1, Y, Z), c = rand3(s, X, Y + 1, Z), d = rand3(s, X + 1, Y + 1, Z);
  const e = rand3(s, X, Y, Z + 1), f = rand3(s, X + 1, Y, Z + 1), g = rand3(s, X, Y + 1, Z + 1), h = rand3(s, X + 1, Y + 1, Z + 1);
  return lerp(lerp(lerp(a, b, fx), lerp(c, d, fx), fy), lerp(lerp(e, f, fx), lerp(g, h, fx), fy), fz);
}
export { LEGACY_WORLDGEN_VERSION, WORLDGEN_VERSION };
export function normalizeWorldgenVersion(v) { return v === 1 ? 1 : v === 2 ? 2 : 3; }

const choose = (list, roll) => list[Math.min(list.length - 1, Math.floor(roll * list.length))];
const OW_VARIANTS = Object.freeze({
  cold: ["snowy_plains", "snowy_taiga", "ice_spikes", "grove", "snowy_slopes"],
  coldHigh: ["frozen_peaks", "jagged_peaks", "snowy_slopes", "grove"],
  cool: ["taiga", "old_growth_pine_taiga", "old_growth_spruce_taiga", "meadow", "windswept_forest", "windswept_hills"],
  mild: ["plains", "forest", "birch_forest", "old_growth_birch_forest", "dappled_forest", "flower_forest", "cherry_grove", "pale_garden", "dark_forest", "swamp", "sunflower_plains"],
  warmWet: ["jungle", "bamboo_jungle", "sparse_jungle", "mangrove_swamp", "mushroom_fields"],
  warmDry: ["desert", "badlands", "wooded_badlands", "eroded_badlands", "savanna", "savanna_plateau", "windswept_savanna"],
});

export function createWorldgen({ blocks: B, blockIds = {}, chunkSize: S, chunkVolume: V, seaLevel: SEA, worldHeight: H }) {
  const idx = (x, y, z) => (y * S + z) * S + x;
  const block = (name, fallback) => Number.isInteger(blockIds[`minecraft:${name}`]) ? blockIds[`minecraft:${name}`] : fallback;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function heightAt(seed, x, z) {
    const cont = Math.min(1, Math.max(0, (fbm(seed, x / 160, z / 160, 3) - .5) * 1.9 + .5));
    const hills = fbm(seed + 101, x / 44, z / 44, 4);
    let h = 12 + cont * 15 + hills * 11;
    const mountain = Math.max(0, cont - .6) / .4; h += mountain * mountain * 24;
    return Math.max(3, Math.min(H - 8, Math.floor(h)));
  }

  function biomeAt(seed, x, z, version = WORLDGEN_VERSION) {
    const normalized = normalizeWorldgenVersion(version);
    if (normalized === 1) return "legacy";
    if (normalized === 2) {
      const t = fbm(seed + 201, x / 180, z / 180, 3), m = fbm(seed + 401, x / 160, z / 160, 3);
      if (t < .43) return "snowy"; if (t > .57 && m < .48) return "desert";
      if (t < .49 && m > .52) return "taiga"; if (m > .56) return "forest"; return "plains";
    }
    const temp = fbm(seed + 201, x / 180, z / 180, 3);
    const moisture = fbm(seed + 401, x / 160, z / 160, 3);
    const continents = fbm(seed, x / 160, z / 160, 3);
    const ridge = fbm(seed + 811, x / 94, z / 94, 3);
    const height = heightAt(seed, x, z);
    const patch = rand2(seed + 9001, Math.floor(x / 64), Math.floor(z / 64));
    const detail = rand2(seed + 9007, Math.floor(x / 28), Math.floor(z / 28));

    if (continents < .20) {
      if (temp < .22) return moisture < .55 ? "deep_frozen_ocean" : "frozen_ocean";
      if (temp < .40) return moisture < .5 ? "deep_cold_ocean" : "cold_ocean";
      if (temp < .63) return moisture < .52 ? "deep_ocean" : "ocean";
      if (temp < .82) return moisture < .52 ? "deep_lukewarm_ocean" : "lukewarm_ocean";
      return moisture < .5 ? "deep_lukewarm_ocean" : "warm_ocean";
    }
    if (continents < .30) {
      if (temp < .25) return detail < .35 ? "snowy_beach" : "stony_shore";
      if (temp > .72) return detail < .4 ? "stony_shore" : "beach";
      return detail < .2 ? "river" : "beach";
    }
    if (continents < .37 && ridge < .35) return temp < .3 ? "frozen_river" : "river";
    if (continents < .40 && patch < .10) return "mushroom_fields";

    if (height > 43) {
      if (temp < .25) return choose(OW_VARIANTS.coldHigh, patch);
      if (temp < .45) return choose(["stony_peaks", "windswept_gravelly_hills", "windswept_hills", "meadow"], patch);
      return choose(["windswept_savanna", "savanna_plateau", "badlands"], patch);
    }
    if (temp < .22) return choose(OW_VARIANTS.cold, patch);
    if (temp < .42) {
      if (moisture > .68 && patch < .28) return "grove";
      return choose(OW_VARIANTS.cool, patch);
    }
    if (temp < .68) {
      if (moisture > .74 && detail < .30) return "swamp";
      if (moisture > .78 && patch < .24) return "mangrove_swamp";
      if (moisture > .72 && patch < .48) return choose(OW_VARIANTS.warmWet, detail);
      return choose(OW_VARIANTS.mild, patch);
    }
    if (moisture > .68 && patch < .32) return choose(OW_VARIANTS.warmWet, detail);
    return choose(OW_VARIANTS.warmDry, patch);
  }

  function treeAt(seed, x, z, h, version = WORLDGEN_VERSION) {
    if (h <= SEA + 1 || h >= H - 12) return 0;
    const r = rand2(seed + 999, x, z);
    const normalized = normalizeWorldgenVersion(version);
    if (normalized === 1) return r < .012 ? 4 + (hash2(seed + 7, x, z) % 3) : 0;
    if (normalized === 2) {
      const oldBiome = biomeAt(seed, x, z, 2), chance = oldBiome === "forest" ? .032 : oldBiome === "taiga" ? .018 : oldBiome === "plains" ? .004 : oldBiome === "snowy" ? .003 : 0;
      return r < chance ? 4 + (hash2(seed + 7, x, z) % 3) : 0;
    }
    const biome = biomeAt(seed, x, z, version);
    const p = ["forest", "birch_forest", "old_growth_birch_forest", "dappled_forest", "flower_forest", "dark_forest", "pale_garden", "cherry_grove"].includes(biome) ? .030
      : ["taiga", "old_growth_pine_taiga", "old_growth_spruce_taiga", "windswept_forest"].includes(biome) ? .022
        : ["plains", "meadow", "savanna", "savanna_plateau"].includes(biome) ? .004 : 0;
    return r < p ? 4 + (hash2(seed + 7, x, z) % 3) : 0;
  }

  function caveBiomeAt(seed, x, y, z) {
    const a = fbm(seed + 13001, x / 90, z / 90, 3), b = noise3(seed + 13007, x / 25, y / 16, z / 25);
    if (y < 14 && a > .68 && b > .48) return "deep_dark";
    if (b < .28) return "lush_caves";
    if (b > .74) return "dripstone_caves";
    if (y < 10 && a < .3) return "sulfur_caves";
    return "cave";
  }

  function put(d, ox, oz, x, y, z, id, force = false) {
    const lx = x - ox, lz = z - oz;
    if (lx < 0 || lx >= S || lz < 0 || lz >= S || y < 1 || y >= H || !Number.isInteger(id)) return;
    const i = idx(lx, y, lz); if (force || d[i] === B.AIR) d[i] = id;
  }
  function veins(d, ox, oz, seed, id, salt, chance, maxY) {
    const cell = 8, pad = 15, minX = Math.floor((ox - pad) / cell), maxX = Math.floor((ox + S - 1 + pad) / cell);
    const minZ = Math.floor((oz - pad) / cell), maxZ = Math.floor((oz + S - 1 + pad) / cell);
    for (let gy = 0; gy <= Math.floor((maxY + pad) / cell); gy++) for (let gz = minZ; gz <= maxZ; gz++) for (let gx = minX; gx <= maxX; gx++) {
      if (rand3(seed + salt, gx, gy, gz) >= chance) continue;
      const cx = gx * cell + Math.floor(rand3(seed + salt + 1, gx, gy, gz) * cell), cy = gy * cell + Math.floor(rand3(seed + salt + 2, gx, gy, gz) * cell), cz = gz * cell + Math.floor(rand3(seed + salt + 3, gx, gy, gz) * cell);
      if (cy < 2 || cy > maxY) continue;
      const angle = rand3(seed + salt + 4, gx, gy, gz) * Math.PI * 2, slope = (rand3(seed + salt + 5, gx, gy, gz) - .5) * .55, norm = Math.sqrt(1 + slope * slope);
      const dxv = Math.cos(angle) / norm, dzv = Math.sin(angle) / norm, dyv = slope / norm, len = 3 + Math.floor(rand3(seed + salt + 6, gx, gy, gz) * 4);
      for (let q = 0; q <= len; q++) {
        const vx = Math.round(cx + dxv * q), vy = Math.round(cy + dyv * q), vz = Math.round(cz + dzv * q);
        for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (dx * dx + dy * dy + dz * dz > 1.5) continue;
          const x = vx + dx, y = vy + dy, z = vz + dz, lx = x - ox, lz = z - oz;
          if (y < 2 || y > maxY || lx < 0 || lx >= S || lz < 0 || lz >= S) continue;
          const i = idx(lx, y, lz); if (d[i] === B.STONE) d[i] = id;
        }
      }
    }
  }
  function cave(seed, x, y, z) {
    return y >= 4 && Math.abs(noise3(seed + 7001, x / 21, y / 13, z / 21) - .5) < .055
      && Math.abs(noise3(seed + 9059, x / 9, y / 7, z / 9) - .5) < .19;
  }
  function surfaceFor(biome) {
    if (/^(?:desert|badlands|eroded_badlands|wooded_badlands|beach|ocean|deep_.*ocean|warm_ocean|lukewarm_ocean|cold_ocean|frozen_ocean|snowy_beach)$/.test(biome)) return [block("sand", B.SAND), block("sandstone", B.SANDSTONE)];
    if (/^(?:snow|frozen|ice_spikes|grove)/.test(biome)) return [block("snow_block", B.SNOW), block("dirt", B.DIRT)];
    if (/^(?:stony|windswept_gravelly)/.test(biome)) return [block("stone", B.STONE), block("stone", B.STONE)];
    if (biome === "mushroom_fields") return [block("mycelium", B.GRASS), block("dirt", B.DIRT)];
    if (biome.includes("swamp")) return [block("mud", B.DIRT), block("mud", B.DIRT)];
    return [block("grass_block", B.GRASS), block("dirt", B.DIRT)];
  }

  function addTree(d, ox, oz, seed, x, z, h, biome, version) {
    const height = treeAt(seed, x, z, h, version); if (!height) return;
    const species = biome === "cherry_grove" ? ["cherry_log", "cherry_leaves"]
      : biome === "pale_garden" ? ["pale_oak_log", "pale_oak_leaves"]
        : biome.includes("birch") ? ["birch_log", "birch_leaves"]
          : biome.includes("taiga") || biome === "grove" ? ["spruce_log", "spruce_leaves"]
            : biome === "jungle" || biome === "bamboo_jungle" || biome === "sparse_jungle" ? ["jungle_log", "jungle_leaves"]
              : biome === "dark_forest" ? ["dark_oak_log", "dark_oak_leaves"] : ["oak_log", "oak_leaves"];
    const log = block(species[0], B.LOG), leaves = block(species[1], B.LEAVES);
    for (let i = 1; i <= height; i++) put(d, ox, oz, x, h + i, z, log, true);
    for (let dy = height - 2; dy <= height + 1; dy++) {
      const radius = dy >= height ? 1 : 2;
      for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
        if (radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        put(d, ox, oz, x + dx, h + dy + 1, z + dz, leaves, false);
      }
    }
  }

  function buildStructure(d, ox, oz, seed, cx, cz, kind, baseY) {
    const sand = block("sandstone", B.SANDSTONE), smooth = block("smooth_sandstone", sand), bricks = block("stone_bricks", B.BRICK), mossy = block("mossy_stone_bricks", bricks);
    const cobble = block("cobblestone", B.COBBLE), planks = block("oak_planks", B.PLANKS), log = block("oak_log", B.LOG), glass = block("glass", B.GLASS);
    const snow = block("snow_block", B.SNOW), water = block("water", B.WATER), dirt = block("dirt", B.DIRT);
    const set = (x, y, z, id) => put(d, ox, oz, x, y, z, id, true);
    const floor = (x0, z0, w, dep, id) => { for (let z = z0; z < z0 + dep; z++) for (let x = x0; x < x0 + w; x++) set(x, baseY, z, id); };

    if (kind === "desert_well") {
      floor(cx - 2, cz - 2, 5, 5, sand);
      for (let y = 1; y <= 3; y++) for (const [dx, dz] of [[-2,-2],[2,-2],[-2,2],[2,2]]) set(cx + dx, baseY + y, cz + dz, smooth);
      for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) set(cx + x, baseY + 1, cz + z, water);
      for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) if (Math.abs(x) === 2 || Math.abs(z) === 2) set(cx + x, baseY + 4, cz + z, smooth);
    } else if (kind === "desert_pyramid") {
      for (let tier = 0; tier < 5; tier++) {
        const r = 6 - tier;
        for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) set(cx + x, baseY + tier, cz + z, tier === 4 ? smooth : sand);
      }
      for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) {
        set(cx + x, baseY + 1, cz + z, block("orange_terracotta", sand));
        if (Math.abs(x) === 2 || Math.abs(z) === 2) set(cx + x, baseY + 2, cz + z, sand);
      }
      set(cx, baseY + 1, cz, block("tnt", cobble));
    } else if (kind === "igloo") {
      for (let y = 0; y <= 4; y++) {
        const radius = Math.max(1, Math.round(Math.sqrt(16 - y * y)));
        for (let z = -radius; z <= radius; z++) for (let x = -radius; x <= radius; x++) if (x*x + z*z <= radius*radius + 1) set(cx + x, baseY + y, cz + z, snow);
      }
      for (let y = 1; y <= 2; y++) set(cx, baseY + y, cz - 4, B.AIR);
      floor(cx - 2, cz - 2, 5, 5, snow);
    } else if (kind === "jungle_temple") {
      floor(cx - 4, cz - 5, 9, 11, mossy);
      for (let y = 1; y <= 7; y++) for (let z = -5; z <= 5; z++) for (let x = -4; x <= 4; x++) {
        if (Math.abs(x) === 4 || Math.abs(z) === 5) set(cx + x, baseY + y, cz + z, (rand2(seed + 8821, x, z) < .3) ? mossy : bricks);
      }
      for (let y = 1; y <= 5; y++) { set(cx, baseY + y, cz - 5, B.AIR); set(cx, baseY + y, cz + 5, B.AIR); }
      for (let z = -3; z <= 3; z++) for (let x = -2; x <= 2; x++) set(cx + x, baseY + 8, cz + z, bricks);
    } else if (kind === "village") {
      floor(cx - 8, cz - 3, 16, 7, cobble);
      for (const [hx, hz] of [[-5,-1],[4,-1],[0,2]]) {
        for (let y = 1; y <= 3; y++) for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) {
          const edge = Math.abs(x) === 2 || Math.abs(z) === 2;
          set(cx + hx + x, baseY + y, cz + hz + z, edge ? planks : B.AIR);
        }
        for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) if (Math.abs(x) === 2 || Math.abs(z) === 2) set(cx + hx + x, baseY + 4, cz + hz + z, log);
        set(cx + hx, baseY + 1, cz + hz - 2, B.AIR);
        set(cx + hx + 1, baseY + 2, cz + hz - 2, glass);
      }
    } else if (kind === "ruined_portal") {
      const obsidian = block("obsidian", B.BLACKSTONE), crying = block("crying_obsidian", obsidian), netherrack = block("netherrack", B.STONE), magma = block("magma_block", B.STONE);
      floor(cx - 4, cz - 3, 9, 7, block("blackstone", B.BLACKSTONE));
      for (let y = 1; y <= 6; y++) for (const x of [-3, 3]) set(cx + x, baseY + y, cz, (y === 3 && x === 3) ? crying : obsidian);
      for (let x = -3; x <= 3; x++) for (const y of [1, 6]) set(cx + x, baseY + y, cz, obsidian);
      set(cx - 3, baseY + 1, cz, crying); set(cx + 3, baseY + 6, cz, crying);
      for (let x = -1; x <= 1; x++) set(cx + x, baseY + 1, cz + 2, netherrack);
      set(cx, baseY + 1, cz + 2, magma);
    } else if (kind === "swamp_hut") {
      const dark = block("spruce_planks", planks), fence = block("spruce_fence", log);
      floor(cx - 3, cz - 3, 7, 7, dark);
      for (let y = 1; y <= 4; y++) for (const [x,z] of [[-3,-3],[3,-3],[-3,3],[3,3]]) set(cx+x,baseY+y,cz+z,log);
      for (let z=-2;z<=2;z++) for(let x=-2;x<=2;x++) if(Math.abs(x)===2||Math.abs(z)===2) set(cx+x,baseY+3,cz+z,dark);
      for (let z=-3;z<=3;z++) for(let x=-3;x<=3;x++) if(Math.abs(x)+Math.abs(z)<=5) set(cx+x,baseY+5,cz+z,block("spruce_stairs",dark));
      for (const [x,z] of [[-4,-3],[4,-3],[-4,3],[4,3]]) { set(cx+x,baseY+1,cz+z,fence); set(cx+x,baseY+2,cz+z,fence); }
    } else if (kind === "pillager_outpost") {
      const stripped = block("stripped_spruce_log", log), fence = block("dark_oak_fence", planks);
      floor(cx-3,cz-3,7,7,cobble);
      for(let y=1;y<=10;y++) for(const [x,z] of [[-3,-3],[3,-3],[-3,3],[3,3]]) set(cx+x,baseY+y,cz+z,stripped);
      for(let y=1;y<=7;y++) for(let z=-2;z<=2;z++) for(let x=-2;x<=2;x++) if(Math.abs(x)===2||Math.abs(z)===2) set(cx+x,baseY+y,cz+z,planks);
      for(let z=-3;z<=3;z++) for(let x=-3;x<=3;x++) set(cx+x,baseY+10,cz+z,block("dark_oak_planks",planks));
      for(let x=-2;x<=2;x++) for(let z=-2;z<=2;z++) if(x===-2||x===2||z===-2||z===2) set(cx+x,baseY+11,cz+z,fence);
    } else if (kind === "shipwreck") {
      const wood = block("spruce_planks", planks), log = block("spruce_log", B.LOG);
      for(let y=0;y<=3;y++) for(let z=-6;z<=6;z++) for(let x=-3;x<=3;x++) {
        const edge=Math.abs(x), taper=Math.abs(z)>4?1:3;
        if(edge<=Math.max(1,taper-y/2) && (y===0 || edge>=Math.max(1,taper-y/2)-1)) set(cx+x,baseY+y,cz+z,wood);
      }
      for(let y=1;y<=5;y++) set(cx,baseY+y,cz,log);
      for(let x=-4;x<=4;x++) set(cx+x,baseY+5,cz,block("white_wool",snow));
    } else if (kind === "ocean_ruin") {
      const brick = block("stone_bricks", B.BRICK), moss = block("mossy_stone_bricks", brick), cracked = block("cracked_stone_bricks", brick);
      floor(cx-4,cz-4,9,9,moss);
      for(let y=1;y<=4;y++) for(let z=-4;z<=4;z++) for(let x=-4;x<=4;x++) if((Math.abs(x)===4||Math.abs(z)===4) && rand2(seed+9203,x+cx,z+cz)>.25) set(cx+x,baseY+y,cz+z,rand2(seed+9209,x+cx,z+cz)<.45?moss:brick);
      for(const [x,z] of [[-2,-2],[2,-2],[-2,2],[2,2]]) set(cx+x,baseY+5,cz+z,cracked);
    } else if (kind === "mineshaft") {
      const beam = block("oak_fence", log), rail = block("rail", planks);
      for(let x=-7;x<=7;x++) { set(cx+x,baseY+3,cz-2,log); set(cx+x,baseY+3,cz+2,log); set(cx+x,baseY+4,cz-2,beam); set(cx+x,baseY+4,cz+2,beam); if(x%3===0) set(cx+x,baseY+5,cz,log); }
      for(let x=-7;x<=7;x++) set(cx+x,baseY,cz,rail);
    } else if (kind === "stronghold") {
      const strongholdBrick = block("stone_bricks", B.BRICK);
      const y0 = baseY - 16;
      const frameForFacing = (facing) =>
        minecraftBlockVariantId("minecraft:end_portal_frame", { eye: "false", facing })
        ?? block("end_portal_frame", strongholdBrick);
      for (const [x, y, z, id] of strongholdPortalRoomPlacements(cx, cz, y0, strongholdBrick, frameForFacing)) {
        set(x, y, z, id);
      }
    } else if (kind === "trial_chambers" || kind === "ancient_city") {
      const deepBrick = kind === "ancient_city" ? block("deepslate_bricks", bricks) : block("tuff_bricks", bricks);
      const accent = kind === "ancient_city" ? block("sculk", B.BLACKSTONE) : block("copper_block", smooth);
      const y0 = baseY - (kind === "ancient_city" ? 18 : 12);
      for (let z = -5; z <= 5; z++) for (let x = -7; x <= 7; x++) {
        set(cx + x, y0, cz + z, deepBrick);
        if (Math.abs(x) === 7 || Math.abs(z) === 5) for (let y = 1; y <= 4; y++) set(cx + x, y0 + y, cz + z, deepBrick);
      }
      for (let x = -2; x <= 2; x++) { set(cx + x, y0 + 1, cz - 5, B.AIR); set(cx + x, y0 + 2, cz - 5, B.AIR); }
      for (let x = -5; x <= 5; x += 5) for (let z = -3; z <= 3; z += 3) set(cx + x, y0 + 4, cz + z, accent);
    } else if (kind === "monument") {
      const prism = block("prismarine", bricks), dark = block("dark_prismarine", mossy), seaLantern = block("sea_lantern", glass);
      floor(cx-6,cz-6,13,13,prism);
      for(let y=1;y<=7;y++) for(const [x,z] of [[-6,-6],[6,-6],[-6,6],[6,6]]) set(cx+x,baseY+y,cz+z,dark);
      for(let y=1;y<=4;y++) for(let x=-4;x<=4;x++) { set(cx+x,baseY+y,cz-4,prism); set(cx+x,baseY+y,cz+4,prism); }
      set(cx,baseY+5,cz,seaLantern);
    } else if (kind === "mansion") {
      const wood = block("dark_oak_planks", planks), log = block("dark_oak_log", B.LOG);
      for(let floorNo=0;floorNo<3;floorNo++) {
        const y=baseY+floorNo*4;
        floor(cx-7,cz-5,15,11,wood);
        for(let z=-5;z<=5;z++) for(let x=-7;x<=7;x++) if(Math.abs(x)===7||Math.abs(z)===5) for(let dy=1;dy<=3;dy++) set(cx+x,y+dy,cz+z,dy===3?log:wood);
      }
      for(let x=-8;x<=8;x++) for(let z=-6;z<=6;z++) if(Math.abs(x)===8||Math.abs(z)===6) set(cx+x,baseY+12,cz+z,wood);
    } else if (kind === "abandoned_camp") {
      floor(cx - 4, cz - 3, 9, 7, dirt);
      for (let side = -1; side <= 1; side += 2) for (let z = -2; z <= 2; z++) set(cx + side * 3, baseY + 2, cz + z, planks);
      for (let z = -2; z <= 2; z++) for (let x = -3; x <= 3; x++) if (Math.abs(x) + Math.abs(z) <= 4) set(cx + x, baseY + 3, cz + z, block("white_wool", snow));
      set(cx, baseY + 1, cz, block("campfire", cobble));
    }
  }

  function addStructures(d, ox, oz, seed) {
    const region = 128, minGX = Math.floor((ox - 32) / region), maxGX = Math.floor((ox + S + 31) / region);
    const minGZ = Math.floor((oz - 32) / region), maxGZ = Math.floor((oz + S + 31) / region);
    for (let gz = minGZ; gz <= maxGZ; gz++) for (let gx = minGX; gx <= maxGX; gx++) {
      const roll = rand2(seed + 14001, gx, gz); if (roll > .24) continue;
      const cx = gx * region + 24 + Math.floor(rand2(seed + 14003, gx, gz) * 80);
      const cz = gz * region + 24 + Math.floor(rand2(seed + 14009, gx, gz) * 80);
      const biome = biomeAt(seed, cx, cz), h = heightAt(seed, cx, cz);
      let kind = null;
      if (["desert", "badlands", "eroded_badlands", "wooded_badlands"].includes(biome)) kind = roll < .06 ? "desert_pyramid" : "desert_well";
      else if (["snowy_plains", "snowy_taiga", "ice_spikes", "grove"].includes(biome)) kind = "igloo";
      else if (["jungle", "bamboo_jungle", "sparse_jungle"].includes(biome)) kind = "jungle_temple";
      else if (["swamp", "mangrove_swamp"].includes(biome)) kind = "swamp_hut";
      else if (["beach", "stony_shore", "ocean", "deep_ocean", "cold_ocean", "warm_ocean", "lukewarm_ocean"].includes(biome)) kind = roll < .12 ? "shipwreck" : "ocean_ruin";
      else if (["pale_garden", "dappled_forest"].includes(biome)) kind = "abandoned_camp";
      else if (biome === "dark_forest" && roll < .08) kind = "mansion";
      else if (["plains", "forest", "birch_forest", "taiga", "savanna", "meadow"].includes(biome)) kind = roll < .06 ? "pillager_outpost" : "village";
      else if (["windswept_forest", "old_growth_birch_forest", "old_growth_pine_taiga", "old_growth_spruce_taiga"].includes(biome)) kind = "mineshaft";
      else if (roll < .04) kind = "ruined_portal";
      else if (roll < .10) kind = "stronghold";
      else if (roll < .18) kind = "trial_chambers";
      const underwater = ["shipwreck", "ocean_ruin"].includes(kind);
      if (!kind || (!underwater && h <= SEA + 1) || h >= H - 12) continue;
      // Avoid dramatically sloped foundations; structure placement remains deterministic at chunk borders.
      let minH = h, maxH = h;
      for (const [dx, dz] of [[-5,0],[5,0],[0,-5],[0,5],[-3,-3],[3,3]]) { const y = heightAt(seed, cx + dx, cz + dz); minH = Math.min(minH, y); maxH = Math.max(maxH, y); }
      if (maxH - minH > 4) continue;
      if (cx + 20 < ox || cx - 20 >= ox + S || cz + 20 < oz || cz - 20 >= oz + S) continue;
      buildStructure(d, ox, oz, seed, cx, cz, kind, h);
    }
  }

  function generateChunkLegacy(seed, cx, cz, v) {
    const data = new Uint16Array(V), ox = cx * S, oz = cz * S;
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const wx = ox + x, wz = oz + z, h = heightAt(seed, wx, wz), biome = biomeAt(seed, wx, wz, v), coast = h <= SEA + 3;
      for (let y = 0; y <= h; y++) {
        let id = B.STONE;
        if (y === 0) id = B.BEDROCK;
        else if (y === h) id = v === 1 ? (h >= 46 ? B.SNOW : h <= SEA + 1 ? B.SAND : B.GRASS) : (coast || biome === "desert" ? B.SAND : biome === "snowy" ? B.SNOW : B.GRASS);
        else if (y >= h - 3) id = v === 1 ? (h <= SEA + 1 ? B.SAND : h >= 46 ? B.STONE : B.DIRT) : (coast || biome === "desert" ? B.SAND : h >= 46 ? B.STONE : B.DIRT);
        else if (v === 1 && y < h - 3 && y > 1 && rand2(seed + 5, wx + y * 7919, wz - y * 104729) < .012) id = B.ORE;
        else if (v === 1 && y < h - 4 && y > 1 && rand2(seed + 6, wx - y * 3571, wz + y * 6803) < .006) id = B.GRAVEL;
        else if (v !== 1 && y > 1 && rand3(seed + 6, wx, y, wz) < .007) id = B.GRAVEL;
        data[idx(x, y, z)] = id;
      }
      for (let y = h + 1; y <= SEA; y++) data[idx(x, y, z)] = B.WATER;
    }
    if (v !== 1) {
      veins(data, ox, oz, seed, B.COAL_ORE, 1103, .095, Math.min(42, H - 8));
      veins(data, ox, oz, seed, B.IRON_ORE, 2207, .066, Math.min(31, H - 8));
      veins(data, ox, oz, seed, B.GOLD_ORE, 3313, .032, Math.min(17, H - 8));
      for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
        const wx = ox + x, wz = oz + z, h = heightAt(seed, wx, wz);
        for (let y = 4; y < h - 4; y++) if (cave(seed, wx, y, wz)) data[idx(x, y, z)] = B.AIR;
      }
    }
    for (let z = oz - 2; z < oz + S + 2; z++) for (let x = ox - 2; x < ox + S + 2; x++) {
      const h = heightAt(seed, x, z), th = treeAt(seed, x, z, h, v); if (!th) continue;
      for (let i = 1; i <= th; i++) put(data, ox, oz, x, h + i, z, B.LOG, true);
      for (let dy = th - 2; dy <= th + 1; dy++) {
        const radius = dy >= th ? 1 : 2;
        for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
          if (radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          put(data, ox, oz, x + dx, h + dy + 1, z + dz, B.LEAVES, false);
        }
      }
    }
    return data;
  }

  function generateChunk(seed, cx, cz, version = WORLDGEN_VERSION) {
    const v = normalizeWorldgenVersion(version);
    if (v !== 3) return generateChunkLegacy(seed, cx, cz, v);
    const data = new Uint16Array(V), ox = cx * S, oz = cz * S;
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const wx = ox + x, wz = oz + z, h = heightAt(seed, wx, wz), biome = v === 1 ? "legacy" : biomeAt(seed, wx, wz, v), coast = h <= SEA + 3;
      const [topBlock, subBlock] = v === 1 ? [h >= 46 ? B.SNOW : h <= SEA + 1 ? B.SAND : B.GRASS, h <= SEA + 1 ? B.SAND : h >= 46 ? B.STONE : B.DIRT] : surfaceFor(biome);
      const baseStone = block("stone", B.STONE), bedrock = block("bedrock", B.BEDROCK);
      for (let y = 0; y <= h; y++) {
        let id = baseStone;
        if (y === 0) id = bedrock;
        else if (y === h) id = v === 1 ? topBlock : (coast && !biome.includes("desert") ? block("sand", B.SAND) : topBlock);
        else if (y >= h - 3) id = y === h - 1 && (biome === "desert" || biome.includes("badlands")) ? block("sandstone", B.SANDSTONE) : subBlock;
        else if (v === 1 && y > 1 && rand2(seed + 5, wx + y * 7919, wz - y * 104729) < .012) id = B.ORE;
        else if (v !== 1 && y > 1 && rand3(seed + 6, wx, y, wz) < .007) id = B.GRAVEL;
        data[idx(x, y, z)] = id;
      }
      for (let y = h + 1; y <= SEA; y++) data[idx(x, y, z)] = block("water", B.WATER);
    }

    if (v !== 1) {
      veins(data, ox, oz, seed, block("coal_ore", B.COAL_ORE), 1103, .095, Math.min(42, H - 8));
      veins(data, ox, oz, seed, block("iron_ore", B.IRON_ORE), 2207, .066, Math.min(31, H - 8));
      veins(data, ox, oz, seed, block("gold_ore", B.GOLD_ORE), 3313, .032, Math.min(17, H - 8));
      for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
        const wx = ox + x, wz = oz + z, h = heightAt(seed, wx, wz);
        for (let y = 4; y < h - 4; y++) if (cave(seed, wx, y, wz)) {
          data[idx(x, y, z)] = B.AIR;
          const caveBiome = caveBiomeAt(seed, wx, y, wz);
          if (caveBiome === "lush_caves" && y > 4 && data[idx(x, y - 1, z)] !== B.AIR && rand3(seed + 15001, wx, y, wz) < .08) data[idx(x, y - 1, z)] = block("moss_block", B.GRASS);
          else if (caveBiome === "dripstone_caves" && y > 4 && data[idx(x, y - 1, z)] !== B.AIR && rand3(seed + 15007, wx, y, wz) < .04) data[idx(x, y - 1, z)] = block("pointed_dripstone", B.STONE);
          else if (caveBiome === "deep_dark" && y > 4 && data[idx(x, y - 1, z)] !== B.AIR && rand3(seed + 15011, wx, y, wz) < .06) data[idx(x, y - 1, z)] = block("sculk", B.BLACKSTONE);
          else if (caveBiome === "sulfur_caves" && y > 4 && data[idx(x, y - 1, z)] !== B.AIR && rand3(seed + 15013, wx, y, wz) < .04) data[idx(x, y - 1, z)] = block("sulfur_block", B.GLOWSTONE);
        }
      }
    }

    for (let z = oz - 2; z < oz + S + 2; z++) for (let x = ox - 2; x < ox + S + 2; x++) {
      const h = heightAt(seed, x, z), biome = v === 1 ? "legacy" : biomeAt(seed, x, z, v);
      addTree(data, ox, oz, seed, x, z, h, biome, v);
    }
    if (v !== 1) addStructures(data, ox, oz, seed);
    return data;
  }
  return { rand2, heightAt, biomeAt, treeAt, generateChunk, biomeIds: MINECRAFT_BIOME_IDS };
}

// Simplified, deterministic dimension generators; biome registry IDs are vanilla 26.3 names.
export function createDimensionWorldgen({ blocks: B, blockIds = {}, chunkSize: S, chunkVolume: V, worldHeight: H }) {
  const idx = (x, y, z) => (y * S + z) * S + x, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const block = (name, fallback) => Number.isInteger(blockIds[`minecraft:${name}`]) ? blockIds[`minecraft:${name}`] : fallback;
  function netherBiome(seed, x, z) {
    const heat = fbm(seed + 5101, x / 180, z / 180, 3), moisture = fbm(seed + 7103, x / 140, z / 140, 3), ridge = Math.abs(fbm(seed + 9109, x / 42, z / 42, 3) - .5);
    if (ridge > .24) return "basalt_deltas"; if (moisture < .35) return "soul_sand_valley"; if (heat > .58) return "crimson_forest"; if (heat < .43) return "warped_forest"; return "nether_wastes";
  }
  function islandColumn(seed, x, z) {
    const radial = Math.hypot(x, z), warp = (fbm(seed + 2201, x / 28, z / 28, 3) - .5) * 9, d = radial + warp, radius = 39;
    if (d < radius) return { d, radius, center: 30 + Math.floor((fbm(seed + 2203, x / 35, z / 35, 3) - .5) * 8) };
    const cell = 128, gx = Math.floor(x / cell), gz = Math.floor(z / cell);
    for (let cz = gz - 1; cz <= gz + 1; cz++) for (let cx = gx - 1; cx <= gx + 1; cx++) {
      const px = cx * cell + (rand2(seed + 2309, cx, cz) - .5) * 70, pz = cz * cell + (rand2(seed + 2311, cx, cz) - .5) * 70;
      if (Math.hypot(px, pz) < 92) continue;
      const r = 9 + rand2(seed + 2317, cx, cz) * 14, dd = Math.hypot(x - px, z - pz) + (fbm(seed + 2323, x / 15, z / 15, 2) - .5) * 4;
      if (dd < r) return { d: dd, radius: r, center: 29 + Math.floor((rand2(seed + 2333, cx, cz) - .5) * 10), outer: true };
    }
    return null;
  }
  function addNetherStructures(data, seed, ox, oz) {
    const region = 192, minGX = Math.floor((ox - 24) / region), maxGX = Math.floor((ox + S + 23) / region);
    const minGZ = Math.floor((oz - 24) / region), maxGZ = Math.floor((oz + S + 23) / region);
    const set = (x,y,z,id) => { const lx=x-ox,lz=z-oz; if(lx>=0&&lx<S&&lz>=0&&lz<S&&y>=1&&y<H) data[idx(lx,y,lz)]=id; };
    for(let gz=minGZ;gz<=maxGZ;gz++) for(let gx=minGX;gx<=maxGX;gx++) {
      const roll=rand2(seed+42001,gx,gz); if(roll>.075) continue;
      const x=gx*region+48+Math.floor(rand2(seed+42003,gx,gz)*96), z=gz*region+48+Math.floor(rand2(seed+42007,gx,gz)*96);
      const biome=netherBiome(seed,x,z), y=24+Math.floor(rand2(seed+42011,gx,gz)*12);
      if(Math.abs(fbm(seed+42013,x/40,z/40,2)-.5)>.22) continue;
      if(roll<.025) {
        const black=block("blackstone",B.BLACKSTONE), bricks=block("polished_blackstone_bricks",black), gold=block("gold_block",block("glowstone",B.GLOWSTONE));
        for(let dz=-6;dz<=6;dz++) for(let dx=-6;dx<=6;dx++) set(x+dx,y,z+dz,black);
        for(let dy=1;dy<=7;dy++) for(const [dx,dz] of [[-5,-5],[5,-5],[-5,5],[5,5]]) set(x+dx,y+dy,z+dz,bricks);
        for(let dx=-2;dx<=2;dx++) set(x+dx,y+3,z,gold);
        for(let dz=-5;dz<=5;dz++) { set(x-5,y+8,z+dz,bricks); set(x+5,y+8,z+dz,bricks); }
      } else if(roll<.055) {
        const brick=block("nether_bricks",B.NETHERRACK), fence=block("nether_brick_fence",brick);
        for(let dx=-10;dx<=10;dx++) { set(x+dx,y,z,brick); if(dx%5===0) { set(x+dx,y+1,z-1,fence); set(x+dx,y+1,z+1,fence); } }
        for(const dx of [-8,8]) for(let dy=1;dy<=8;dy++) for(let dz=-3;dz<=3;dz++) { set(x+dx,y+dy,z+dz,brick); if(dy===8) set(x+dx,y+dy+1,z+dz,fence); }
      } else if(biome!="basalt_deltas") {
        const bone=block("bone_block",B.NETHERRACK);
        for(let n=-5;n<=5;n++) { set(x+n,y,z,bone); if(n%3===0) set(x+n,y+1,z+2,bone); }
      }
    }
  }

  function addEndStructures(data, seed, ox, oz) {
    const region=128,minGX=Math.floor((ox-30)/region),maxGX=Math.floor((ox+S+29)/region),minGZ=Math.floor((oz-30)/region),maxGZ=Math.floor((oz+S+29)/region);
    const set=(x,y,z,id)=>{const lx=x-ox,lz=z-oz;if(lx>=0&&lx<S&&lz>=0&&lz<S&&y>=1&&y<H)data[idx(lx,y,lz)]=id;};
    const brick=block("end_stone_bricks",B.END_STONE),purpur=block("purpur_block",brick),pillar=block("purpur_pillar",purpur),rod=block("end_rod",B.GLOWSTONE);
    for(let gz=minGZ;gz<=maxGZ;gz++) for(let gx=minGX;gx<=maxGX;gx++) {
      if(rand2(seed+43001,gx,gz)>.18) continue;
      const x=gx*region+(rand2(seed+43003,gx,gz)-.5)*70,z=gz*region+(rand2(seed+43007,gx,gz)-.5)*70;
      if(Math.hypot(x,z)<92) continue;
      const col=islandColumn(seed,x,z); if(!col?.outer) continue;
      const base=clamp(col.center+Math.floor((fbm(seed+2401,x/11,z/11,2)-.5)*3)+col.radius*.65,12,H-15);
      for(let dz=-4;dz<=4;dz++) for(let dx=-4;dx<=4;dx++) set(x+dx,base,z+dz,brick);
      for(let dy=1;dy<=10;dy++) for(const [dx,dz] of [[-3,-3],[3,-3],[-3,3],[3,3]]) set(x+dx,base+dy,z+dz,purpur);
      for(let dx=-2;dx<=2;dx++) for(let dz=-2;dz<=2;dz++) if(Math.abs(dx)+Math.abs(dz)<=3) set(x+dx,base+11,z+dz,pillar);
      set(x,base+12,z,rod);
    }
  }

  function generateNether(seed, cx, cz) {
    const data = new Uint16Array(V), ox = cx * S, oz = cz * S;
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const wx = ox + x, wz = oz + z, biome = netherBiome(seed, wx, wz), floor = 22 + Math.floor(fbm(seed + 3101, wx / 72, wz / 72, 3) * 13), roof = H - 7 - Math.floor(fbm(seed + 3107, wx / 95, wz / 95, 3) * 7);
      for (let y = 0; y < H; y++) {
        let id = B.AIR;
        if (y === 0 || y === H - 1) id = block("bedrock", B.BEDROCK);
        else if (y < floor) {
          const surface = y === floor - 1, cavity = Math.abs(noise3(seed + 3203, wx / 18, y / 12, wz / 18) - .5) < .11 && y > 4;
          if (cavity) id = y <= 11 ? block("lava", B.LAVA) : B.AIR;
          else if (surface && biome === "soul_sand_valley") id = block("soul_sand", B.SOUL_SAND);
          else if (surface && biome === "basalt_deltas") id = block("basalt", B.BASALT);
          else if (surface && biome === "crimson_forest") id = block("crimson_nylium", B.CRIMSON_NYLIUM);
          else if (surface && biome === "warped_forest") id = block("warped_nylium", B.WARPED_NYLIUM);
          else if (y < floor - 1 && biome === "basalt_deltas" && rand3(seed + 3301, wx, y, wz) < .08) id = block("blackstone", B.BLACKSTONE);
          else if (y < floor - 2 && rand3(seed + 3307, wx, y, wz) < .013) id = block("glowstone", B.GLOWSTONE);
          else id = block("netherrack", B.NETHERRACK);
        } else if (y >= roof) {
          const cavity = Math.abs(noise3(seed + 3203, wx / 18, y / 12, wz / 18) - .5) < .12;
          id = cavity ? B.AIR : (biome === "basalt_deltas" ? block("basalt", B.BASALT) : block("netherrack", B.NETHERRACK));
        } else if (y <= 10 && Math.abs(noise3(seed + 3407, wx / 22, y / 9, wz / 22) - .5) < .16) id = block("lava", B.LAVA);
        data[idx(x, y, z)] = id;
      }
    }
    addNetherStructures(data, seed, ox, oz);
    return data;
  }
  function generateEnd(seed, cx, cz) {
    const data = new Uint16Array(V), ox = cx * S, oz = cz * S;
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const wx = ox + x, wz = oz + z, col = islandColumn(seed, wx, wz); if (!col) continue;
      const taper = clamp(1 - col.d / col.radius, 0, 1), thickness = 2 + Math.floor(taper * 15);
      const center = clamp(col.center + Math.floor((fbm(seed + 2401, wx / 11, wz / 11, 2) - .5) * 3), 8, H - 8), lo = Math.max(1, center - thickness), hi = Math.min(H - 1, center + thickness);
      for (let y = lo; y <= hi; y++) { const edge = Math.abs(y - center) / Math.max(1, thickness), hollow = Math.abs(noise3(seed + 2411, wx / 16, y / 10, wz / 16) - .5) > .39; if (edge < 1 && !hollow) data[idx(x, y, z)] = block("end_stone", B.END_STONE); }
    }
    // Ten deterministic obsidian pillars around the central island; End Crystal
    // entities are spawned and persisted by the server when the dragon fight begins.
    const set=(x,y,z,id)=>{const lx=x-ox,lz=z-oz;if(lx>=0&&lx<S&&lz>=0&&lz<S&&y>=1&&y<H)data[idx(lx,y,lz)]=id;};
    const obsidian=block("obsidian",B.END_STONE),bars=block("iron_bars",B.END_STONE);
    const pillars=[[-36,-20,10],[-36,20,13],[-20,-36,16],[-20,36,9],[0,-42,18],[0,42,12],[20,-36,11],[20,36,17],[36,-20,14],[36,20,10]];
    for(const [px,pz,height] of pillars){
      for(let y=29;y<=29+height;y++)for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)set(px+dx,y,pz+dz,obsidian);
      if(bars){const cageY=30+height;for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(Math.abs(dx)+Math.abs(dz)===2)set(px+dx,cageY,pz+dz,bars);}
    }
    addEndStructures(data, seed, ox, oz);
    return data;
  }
  function biomeAt(seed, x, z, dimension) {
    if (dimension === "minecraft:the_nether") return netherBiome(seed, x, z);
    if (dimension === "minecraft:the_end") {
      const col = islandColumn(seed, x, z); if (!col) return "the_void";
      if (col.outer) return "small_end_islands";
      if (col.d < 10) return "end_highlands"; if (col.d < 25) return "end_midlands"; return "end_barrens";
    }
    return "plains";
  }
  function generateChunk(seed, cx, cz, dimension) {
    if (dimension === "minecraft:the_nether") return generateNether(seed, cx, cz);
    if (dimension === "minecraft:the_end") return generateEnd(seed, cx, cz);
    throw new RangeError("dimension generator only accepts Nether or End");
  }
  return { biomeAt, generateChunk };
}
