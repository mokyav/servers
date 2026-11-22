import { DIMENSION_IDS, normalizeDimensionId } from "./dimensions.js";

/** Resolve travel caused by a portal block. This is intentionally a simple Koruva rule,
 * not Minecraft's frame/ignition/portal-link algorithm. */
export function portalTargetForBlock(blockId, currentDimension, portalIds) {
  if (!Number.isSafeInteger(blockId) || !portalIds || typeof portalIds !== "object") return null;
  const current = normalizeDimensionId(currentDimension);
  if (Number.isSafeInteger(portalIds.netherPortal) && blockId === portalIds.netherPortal) {
    if (current === DIMENSION_IDS.OVERWORLD) return DIMENSION_IDS.NETHER;
    if (current === DIMENSION_IDS.NETHER) return DIMENSION_IDS.OVERWORLD;
    return null;
  }
  if (Number.isSafeInteger(portalIds.endPortal) && blockId === portalIds.endPortal) {
    if (current === DIMENSION_IDS.OVERWORLD) return DIMENSION_IDS.END;
    if (current === DIMENSION_IDS.END) return DIMENSION_IDS.OVERWORLD;
  }
  return null;
}

/** Search the player's feet, body, and adjacent cells for a portal block. */
export function findPortalAt(world, position, currentDimension, portalIds) {
  if (!world || typeof world.get !== "function") throw new TypeError("world.get(x,y,z) is required");
  const x = Number.isFinite(position?.x) ? Math.floor(position.x) : 0;
  const y = Number.isFinite(position?.y) ? Math.floor(position.y) : 0;
  const z = Number.isFinite(position?.z) ? Math.floor(position.z) : 0;
  const heights = [y, y + 1, y + 2];
  for (const yy of heights) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const blockId = world.get(x + dx, yy, z + dz);
        const target = portalTargetForBlock(blockId, currentDimension, portalIds);
        if (target) return target;
      }
    }
  }
  return null;
}
