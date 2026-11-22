import {
  MINECRAFT_BLOCK_MODEL_REGISTRY,
  type MinecraftModelElement,
  type MinecraftModelInstance,
} from "../../shared/minecraft-block-model-registry.js";

export const MODEL_COLLISION_RESOLUTION = 16;
const CELLS_PER_BLOCK = MODEL_COLLISION_RESOLUTION ** 3;
const WORD_COUNT = CELLS_PER_BLOCK / 32;

export interface ModelCollisionMask {
  readonly words: Uint32Array;
  readonly full: boolean;
  readonly empty: boolean;
}

interface ModelPart {
  instance: MinecraftModelInstance;
  elements: MinecraftModelElement[];
}

type Vec3 = [number, number, number];

const cache = new Map<number, ModelCollisionMask | null>();

function rotatePoint(point: Vec3, axis: string, degrees: number, origin: Vec3 = [8, 8, 8]): Vec3 {
  if (!degrees) return [...point];
  const angle = degrees * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  let [x, y, z] = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]];
  if (axis === "x") [y, z] = [y * c - z * s, y * s + z * c];
  else if (axis === "y") [x, z] = [x * c + z * s, -x * s + z * c];
  else [x, y] = [x * c - y * s, x * s + y * c];
  return [x + origin[0], y + origin[1], z + origin[2]];
}

function inverseBlockstateRotation(point: Vec3, instance: MinecraftModelInstance): Vec3 {
  let local = [...point] as Vec3;
  // The renderer applies X, then Y, then Z around the block centre.
  if (instance.z) local = rotatePoint(local, "z", -instance.z);
  if (instance.y) local = rotatePoint(local, "y", -instance.y);
  if (instance.x) local = rotatePoint(local, "x", -instance.x);
  return local;
}

function inverseElementRotation(point: Vec3, rotation: MinecraftModelElement["rotation"]): Vec3 {
  if (!rotation?.angle) return [...point];
  let local = [...point] as Vec3;
  if (rotation.rescale === true) {
    // Forward transform is rotation followed by expansion; undo the expansion first.
    const inverseScale = Math.max(0.0001, Math.abs(Math.cos(rotation.angle * Math.PI / 180)));
    const relative: Vec3 = [
      local[0] - rotation.origin[0],
      local[1] - rotation.origin[1],
      local[2] - rotation.origin[2],
    ];
    if (rotation.axis === "x") { relative[1] *= inverseScale; relative[2] *= inverseScale; }
    else if (rotation.axis === "y") { relative[0] *= inverseScale; relative[2] *= inverseScale; }
    else { relative[0] *= inverseScale; relative[1] *= inverseScale; }
    local = [
      relative[0] + rotation.origin[0],
      relative[1] + rotation.origin[1],
      relative[2] + rotation.origin[2],
    ];
  }
  return rotatePoint(local, rotation.axis, -rotation.angle, rotation.origin as Vec3);
}

function modelContainsPoint(parts: ModelPart[], point: Vec3): boolean {
  for (const part of parts) {
    const blockLocal = inverseBlockstateRotation(point, part.instance);
    for (const element of part.elements) {
      const local = inverseElementRotation(blockLocal, element.rotation);
      if (
        local[0] >= element.from[0] && local[0] <= element.to[0] &&
        local[1] >= element.from[1] && local[1] <= element.to[1] &&
        local[2] >= element.from[2] && local[2] <= element.to[2]
      ) return true;
    }
  }
  return false;
}

/**
 * Build a cached 16×16×16 occupancy mask from the exact model elements used by
 * the chunk renderer. Each cell is one Minecraft model pixel (1/16 block).
 * null means this block has no resolved model and should use the legacy shape.
 */
export function getModelCollisionMask(id: number): ModelCollisionMask | null {
  if (cache.has(id)) return cache.get(id) ?? null;
  const instances = MINECRAFT_BLOCK_MODEL_REGISTRY.byId[id];
  if (!instances?.length) {
    cache.set(id, null);
    return null;
  }

  const parts: ModelPart[] = [];
  for (const instance of instances) {
    const model = MINECRAFT_BLOCK_MODEL_REGISTRY.models[instance.m];
    if (model?.elements.length) parts.push({ instance, elements: model.elements });
  }
  if (!parts.length) {
    cache.set(id, null);
    return null;
  }

  const words = new Uint32Array(WORD_COUNT);
  let occupiedCount = 0;
  for (let qy = 0; qy < MODEL_COLLISION_RESOLUTION; qy++) {
    for (let qz = 0; qz < MODEL_COLLISION_RESOLUTION; qz++) {
      for (let qx = 0; qx < MODEL_COLLISION_RESOLUTION; qx++) {
        // A 1-pixel cell is sampled at its centre in the model's 0..16 space.
        if (!modelContainsPoint(parts, [qx + 0.5, qy + 0.5, qz + 0.5])) continue;
        const bit = qy * MODEL_COLLISION_RESOLUTION * MODEL_COLLISION_RESOLUTION + qz * MODEL_COLLISION_RESOLUTION + qx;
        words[bit >>> 5] |= 1 << (bit & 31);
        occupiedCount++;
      }
    }
  }

  const mask: ModelCollisionMask = {
    words,
    full: occupiedCount === CELLS_PER_BLOCK,
    empty: occupiedCount === 0,
  };
  cache.set(id, mask);
  return mask;
}

export function modelCollisionCellIsSolid(mask: ModelCollisionMask, qx: number, qy: number, qz: number): boolean {
  if (
    !Number.isInteger(qx) || !Number.isInteger(qy) || !Number.isInteger(qz) ||
    qx < 0 || qy < 0 || qz < 0 ||
    qx >= MODEL_COLLISION_RESOLUTION || qy >= MODEL_COLLISION_RESOLUTION || qz >= MODEL_COLLISION_RESOLUTION
  ) return false;
  const bit = qy * MODEL_COLLISION_RESOLUTION * MODEL_COLLISION_RESOLUTION + qz * MODEL_COLLISION_RESOLUTION + qx;
  return (mask.words[bit >>> 5] & (1 << (bit & 31))) !== 0;
}
