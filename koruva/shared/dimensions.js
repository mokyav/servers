import { MINECRAFT_DIMENSION_TYPE_DATA } from "./minecraft-worldgen-catalog.js";
export const DIMENSION_IDS = Object.freeze({ OVERWORLD: "minecraft:overworld", NETHER: "minecraft:the_nether", END: "minecraft:the_end" });
export const END_CENTER_SURFACE_Y = 48;
export const END_CONTINENT_RADIUS = 88;
export const END_OUTER_ISLAND_MIN_DISTANCE = 128;
const vanillaType = (key) => MINECRAFT_DIMENSION_TYPE_DATA[key] ?? {};
const runtimeDimension = (id, generator, typeKey, hasSky, naturalLight) => {
  const type = vanillaType(typeKey);
  return Object.freeze({
    id, generator, dimensionType: typeKey,
    runtimeHeight: 128, // Koruva keeps a 0..127 runtime slice; vanilla metadata is retained below.
    minY: type.min_y ?? 0, vanillaHeight: type.height ?? 256, logicalHeight: type.logical_height ?? 256,
    coordinateScale: type.coordinate_scale ?? 1,
    hasSky, naturalLight, hasCeiling: type.has_ceiling ?? false,
    ambientLight: type.ambient_light ?? 0, infiniburn: type.infiniburn ?? null,
  });
};
export const DIMENSIONS = Object.freeze({
  [DIMENSION_IDS.OVERWORLD]: runtimeDimension(DIMENSION_IDS.OVERWORLD, "overworld", "overworld", true, true),
  [DIMENSION_IDS.NETHER]: runtimeDimension(DIMENSION_IDS.NETHER, "nether", "the_nether", false, false),
  [DIMENSION_IDS.END]: runtimeDimension(DIMENSION_IDS.END, "end", "the_end", false, false),
});
export function normalizeDimensionId(id) { return Object.prototype.hasOwnProperty.call(DIMENSIONS,id)?id:DIMENSION_IDS.OVERWORLD; }
export function isDimensionId(id) { return Object.prototype.hasOwnProperty.call(DIMENSIONS,id); }
export function mapDimensionCoordinates(from,to,position) {
  from=normalizeDimensionId(from);to=normalizeDimensionId(to);
  const x=Number.isFinite(position?.x)?position.x:0,z=Number.isFinite(position?.z)?position.z:0,y=Number.isFinite(position?.y)?position.y:40;
  if(from===to)return{x,y,z};
  if(from===DIMENSION_IDS.OVERWORLD&&to===DIMENSION_IDS.NETHER)return{x:x/8,y,z:z/8};
  if(from===DIMENSION_IDS.NETHER&&to===DIMENSION_IDS.OVERWORLD)return{x:x*8,y,z:z*8};
  if(to===DIMENSION_IDS.END)return{x:0,y:END_CENTER_SURFACE_Y+1,z:0};
  if(from===DIMENSION_IDS.END)return{x:0,y:64,z:0};
  return{x,y,z};
}


/** Find a deterministic two-block-high spawn above solid ground in a loaded dimension.
 * `isSolid` and `isHazard` are supplied by the game so block rules stay data-driven.
 */
export function findSafeSpawn(world, position, { height = 128, searchRadius = 8, isSolid, isHazard = () =>false } = {}) {
  if (!world || typeof world.ensureChunk !== "function" || typeof world.get !== "function") throw new TypeError("world must expose ensureChunk() and get()");
  if (typeof isSolid !== "function") throw new TypeError("isSolid(blockId) is required");
  const x = Number.isFinite(position?.x) ? position.x : 0;
  const z = Number.isFinite(position?.z) ? position.z : 0;
  const bx = Math.floor(x), bz = Math.floor(z);
  const radius = Math.min(32, Math.max(0, Math.floor(searchRadius)));
  const maxY = Math.min(127, Math.max(3, Math.floor(height))) - 3;
  const candidates = [];
  for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
    candidates.push({ dx, dz, d: dx * dx + dz * dz });
  }
  candidates.sort((a, b) => a.d - b.d || a.dz - b.dz || a.dx - b.dx);
  const blockAt = (px, py, pz) => {
    world.ensureChunk(Math.floor(px / 16), Math.floor(pz / 16));
    return world.get(px, py, pz);
  };
  for (const { dx, dz } of candidates) {
    const px = bx + dx, pz = bz + dz;
    for (let floorY = maxY; floorY >= 0; floorY--) {
      const floor = blockAt(px, floorY, pz);
      const feet = blockAt(px, floorY + 1, pz);
      const head = blockAt(px, floorY + 2, pz);
      if (isSolid(floor) && !isHazard(floor) && !isSolid(feet) && !isHazard(feet) && !isSolid(head) && !isHazard(head)) {
        return { x: px + 0.5, y: floorY + 1, z: pz + 0.5 };
      }
    }
  }
  return null;
}


/** Resolve user-facing dimension names without accepting arbitrary IDs. */
export function resolveDimensionAlias(value) {
  const key = String(value ?? "").trim().toLowerCase();
  const aliases = { overworld: DIMENSION_IDS.OVERWORLD, nether: DIMENSION_IDS.NETHER, the_nether: DIMENSION_IDS.NETHER, end: DIMENSION_IDS.END, the_end: DIMENSION_IDS.END };
  const id = aliases[key] ?? key;
  return isDimensionId(id) ? id : null;
}
