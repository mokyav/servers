// チャンク単位のメッシュ生成: 隠れ面カリング + 頂点AO。three.js に依存しない純粋関数。
import { BLOCKS, blockOccupiesSubcell } from "../../shared/blocks";
import { CHUNK_SIZE, WORLD_HEIGHT } from "../../shared/constants";
import { MINECRAFT_BLOCK_MODEL_REGISTRY, type MinecraftModelElement, type MinecraftModelFace, type MinecraftModelInstance } from "../../shared/minecraft-block-model-registry.js";
import { MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID } from "../../shared/minecraft-block-runtime.js";
import { biomeAt, dimensionBiomeAt } from "./worldgen";
import type { Chunk, World } from "./world";

export interface MeshData {
  positions: Float32Array;
  uvs: Float32Array;
  /** rgba: rgb=明るさ(面の向き×AO), a=自己発光 */
  colors: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
}

export interface ChunkMeshes {
  solid: MeshData | null;
  /** Alpha-tested, double-sided Minecraft cutout models (plants, leaves, etc.). */
  cutout: MeshData | null;
  translucent: MeshData | null;
  liquid: MeshData | null;
}

export type TileUV = (tileKey: string) => [number, number, number, number]; // u0,v0,u1,v1

interface FaceDef {
  n: [number, number, number];
  a: [number, number, number];
  b: [number, number, number];
  swap: boolean;
  shade: number;
  which: "top" | "side" | "bottom";
}

const FACES: FaceDef[] = [
  { n: [1, 0, 0], a: [0, 1, 0], b: [0, 0, 1], swap: true, shade: 0.82, which: "side" },
  { n: [-1, 0, 0], a: [0, 0, 1], b: [0, 1, 0], swap: false, shade: 0.82, which: "side" },
  { n: [0, 1, 0], a: [0, 0, 1], b: [1, 0, 0], swap: false, shade: 1.0, which: "top" },
  { n: [0, -1, 0], a: [1, 0, 0], b: [0, 0, 1], swap: false, shade: 0.5, which: "bottom" },
  { n: [0, 0, 1], a: [1, 0, 0], b: [0, 1, 0], swap: false, shade: 0.68, which: "side" },
  { n: [0, 0, -1], a: [0, 1, 0], b: [1, 0, 0], swap: true, shade: 0.68, which: "side" },
];
const CORNERS: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const AO_LEVEL = [0.5, 0.68, 0.84, 1.0];

class Builder {
  pos: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  n = 0;
  finish(): MeshData | null {
    if (this.n === 0) return null;
    return {
      positions: new Float32Array(this.pos),
      uvs: new Float32Array(this.uv),
      colors: new Float32Array(this.col),
      indices: new Uint32Array(this.idx),
      vertexCount: this.n,
    };
  }
}

const UV_PAD = 0.0005;
type Vec3 = [number, number, number];

const MODEL_FACE_INDEX: Record<string, number> = { east: 0, west: 1, up: 2, down: 3, south: 4, north: 5 };
const MODEL_FACE_NORMAL: Record<string, Vec3> = {
  east: [1, 0, 0], west: [-1, 0, 0], up: [0, 1, 0], down: [0, -1, 0], south: [0, 0, 1], north: [0, 0, -1],
};
const MODEL_FACE_UV_BASIS: Record<string, { u: Vec3; v: Vec3 }> = {
  east: { u: [0, 0, -1], v: [0, -1, 0] },
  west: { u: [0, 0, 1], v: [0, -1, 0] },
  up: { u: [1, 0, 0], v: [0, 0, 1] },
  down: { u: [1, 0, 0], v: [0, 0, -1] },
  north: { u: [-1, 0, 0], v: [0, -1, 0] },
  south: { u: [1, 0, 0], v: [0, -1, 0] },
};
const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function lockModelUv(u: number, v: number, direction: string, instance: MinecraftModelInstance): [number, number] {
  if (!instance.uvlock) return [u, v];
  const normal = rotateBlockVector(MODEL_FACE_NORMAL[direction] ?? [0, 1, 0], instance);
  const axis = normal.findIndex((value) => Math.abs(value) > 0.999);
  if (axis < 0) return [u, v];
  const worldDirection = `${axis === 0 ? (normal[0] > 0 ? "east" : "west") : axis === 1 ? (normal[1] > 0 ? "up" : "down") : (normal[2] > 0 ? "south" : "north")}`;
  const sourceBasis = MODEL_FACE_UV_BASIS[direction];
  const targetBasis = MODEL_FACE_UV_BASIS[worldDirection];
  const sourceU = rotateBlockVector(sourceBasis.u, instance);
  const sourceV = rotateBlockVector(sourceBasis.v, instance);
  const du = u - 0.5, dv = v - 0.5;
  return [
    0.5 + dot3(sourceU, targetBasis.u) * du + dot3(sourceV, targetBasis.u) * dv,
    0.5 + dot3(sourceU, targetBasis.v) * du + dot3(sourceV, targetBasis.v) * dv,
  ];
}
const GRASS_TINT: Record<string, [number, number, number]> = {
  // Sampled from vanilla textures/colormap/grass.png at representative climate coordinates.
  plains: [145, 189, 89], forest: [121, 192, 91], taiga: [134, 183, 131], snowy: [131, 181, 147], desert: [191, 183, 85], legacy: [145, 189, 89],
};
const FOLIAGE_TINT: Record<string, [number, number, number]> = {
  // Sampled from vanilla textures/colormap/foliage.png using the same climate points.
  plains: [119, 171, 47], forest: [88, 174, 49], taiga: [104, 164, 100], snowy: [99, 162, 120], desert: [174, 164, 42], legacy: [119, 171, 47],
};
const WATER_TINT: [number, number, number] = [63, 118, 228];

function rotateModelPoint(point: Vec3, axis: string, degrees: number, origin: Vec3 = [8, 8, 8], rescale = false): Vec3 {
  if (!degrees) return [...point];
  const angle = degrees * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  let [x, y, z] = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]];
  if (axis === "x") [y, z] = [y * c - z * s, y * s + z * c];
  else if (axis === "y") [x, z] = [x * c + z * s, -x * s + z * c];
  else [x, y] = [x * c - y * s, x * s + y * c];
  if (rescale) {
    const scale = 1 / Math.max(0.0001, Math.abs(c));
    if (axis === "x") { y *= scale; z *= scale; }
    else if (axis === "y") { x *= scale; z *= scale; }
    else { x *= scale; y *= scale; }
  }
  return [x + origin[0], y + origin[1], z + origin[2]];
}

function rotateBlockPoint(point: Vec3, instance: MinecraftModelInstance): Vec3 {
  let next = [...point] as Vec3;
  if (instance.x) next = rotateModelPoint(next, "x", instance.x);
  if (instance.y) next = rotateModelPoint(next, "y", instance.y);
  if (instance.z) next = rotateModelPoint(next, "z", instance.z);
  return next;
}

function rotateBlockVector(vector: Vec3, instance: MinecraftModelInstance): Vec3 {
  let next = [...vector] as Vec3;
  if (instance.x) next = rotateModelPoint(next, "x", instance.x, [0, 0, 0]);
  if (instance.y) next = rotateModelPoint(next, "y", instance.y, [0, 0, 0]);
  if (instance.z) next = rotateModelPoint(next, "z", instance.z, [0, 0, 0]);
  return next;
}

function defaultUvBounds(direction: string, from: number[], to: number[]): [number, number, number, number] {
  switch (direction) {
    case "east": return [16 - to[2], 16 - to[1], 16 - from[2], 16 - from[1]];
    case "west": return [from[2], 16 - to[1], to[2], 16 - from[1]];
    case "up": return [from[0], from[2], to[0], to[2]];
    case "down": return [from[0], 16 - to[2], to[0], 16 - from[2]];
    case "north": return [16 - to[0], 16 - to[1], 16 - from[0], 16 - from[1]];
    default: return [from[0], 16 - to[1], to[0], 16 - from[1]]; // south
  }
}

function faceUvPixels(direction: string, point: Vec3, from: number[], to: number[], face: MinecraftModelFace): [number, number] {
  let u = 0, v = 0;
  if (direction === "east") { u = 16 - point[2]; v = 16 - point[1]; }
  else if (direction === "west") { u = point[2]; v = 16 - point[1]; }
  else if (direction === "up") { u = point[0]; v = point[2]; }
  else if (direction === "down") { u = point[0]; v = 16 - point[2]; }
  else if (direction === "north") { u = 16 - point[0]; v = 16 - point[1]; }
  else { u = point[0]; v = 16 - point[1]; }
  const defaults = defaultUvBounds(direction, from, to);
  const normU = Math.max(0, Math.min(1, (u - defaults[0]) / Math.max(0.0001, defaults[2] - defaults[0])));
  const normV = Math.max(0, Math.min(1, (v - defaults[1]) / Math.max(0.0001, defaults[3] - defaults[1])));
  const uv = face.uv ?? defaults;
  return [uv[0] + (uv[2] - uv[0]) * normU, uv[1] + (uv[3] - uv[1]) * normV];
}

function biomeTintForTexture(texture: string, biome: string, dimension: string): [number, number, number] {
  if (dimension !== "minecraft:overworld") return [255, 255, 255];
  const lower = texture.toLowerCase();
  if (lower.includes("water")) return WATER_TINT;
  if (/(?:leaves|foliage|vine|azalea|moss|lily_pad)/.test(lower)) return FOLIAGE_TINT[biome] ?? FOLIAGE_TINT.plains;
  if (/(?:grass|fern|seagrass|kelp|sprout|bush|crop|flower)/.test(lower)) return GRASS_TINT[biome] ?? GRASS_TINT.plains;
  return [255, 255, 255];
}

function tintForBlock(world: World, id: number, x: number, z: number, texture: string): [number, number, number] {
  const meta = MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID[id];
  const token = meta?.token ?? BLOCKS[id]?.key ?? "";
  const biome = world.dimensionId === "minecraft:overworld"
    ? biomeAt(world.seed, x, z, world.worldgenVersion)
    : dimensionBiomeAt(world.seed, x, z, world.dimensionId);
  const textureTint = biomeTintForTexture(texture || token, biome, world.dimensionId);
  if (textureTint.some((value) => value !== 255)) return textureTint;
  if (/(?:leaves|grass_block|fern|short_grass|tall_grass|vine|moss)/.test(token)) {
    const palette = /leaves|vine|moss/.test(token) ? FOLIAGE_TINT : GRASS_TINT;
    if (world.dimensionId === "minecraft:overworld") return palette[biome] ?? palette.plains;
  }
  return [255, 255, 255];
}

export function buildChunkMesh(world: World, chunk: Chunk, tileUV: TileUV): ChunkMeshes {
  const solid = new Builder();
  const cutout = new Builder();
  const translucent = new Builder();
  const liquid = new Builder();
  const ox = chunk.cx * CHUNK_SIZE, oz = chunk.cz * CHUNK_SIZE;
  const topY = Math.min(WORLD_HEIGHT - 1, chunk.maxY);
  const opaqueAt = (x: number, y: number, z: number): boolean => {
    const b = world.get(x, y, z);
    // An unloaded neighbour is temporary empty space. It is remeshed when loaded.
    return b > 0 && BLOCKS[b]?.render === "opaque";
  };

  const emitFace = (target: Builder, def: typeof BLOCKS[number], x: number, y: number, z: number,
    f: FaceDef, center: [number, number, number], half: number, sub?: [number, number, number]) => {
    const [u0, v0, u1, v1] = tileUV(def.tiles[f.which]);
    const base = target.n;
    const ao: number[] = [];
    for (let q = 0; q < 4; q++) {
      const [sa, sb] = CORNERS[q];
      const px = center[0] + half * (f.n[0] + sa * f.a[0] + sb * f.b[0]);
      const py = center[1] + half * (f.n[1] + sa * f.a[1] + sb * f.b[1]);
      const pz = center[2] + half * (f.n[2] + sa * f.a[2] + sb * f.b[2]);
      // Geometry is chunk-local; ChunkView applies the chunk world offset to the mesh.
      target.pos.push(px - ox, py, pz - oz);
      let level = 3;
      if (!def.emissive && def.render !== "liquid") {
        const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2];
        const s1 = opaqueAt(nx + sa * f.a[0], ny + sa * f.a[1], nz + sa * f.a[2]) ? 1 : 0;
        const s2 = opaqueAt(nx + sb * f.b[0], ny + sb * f.b[1], nz + sb * f.b[2]) ? 1 : 0;
        const cr = opaqueAt(nx + sa * f.a[0] + sb * f.b[0], ny + sa * f.a[1] + sb * f.b[1], nz + sa * f.a[2] + sb * f.b[2]) ? 1 : 0;
        level = s1 && s2 ? 0 : 3 - (s1 + s2 + cr);
      }
      ao.push(level);
      const sh = def.emissive ? 1 : f.shade * AO_LEVEL[level];
      const tint = tintForBlock(world, def.id, x, z, def.tiles[f.which]);
      target.col.push(sh * tint[0] / 255, sh * tint[1] / 255, sh * tint[2] / 255, def.emissive ? 1 : 0);
      let ua = (sa + 1) / 2, ub = (sb + 1) / 2;
      if (sub) {
        const tangent = (axis: [number, number, number], sign: number) => {
          const k = axis[0] !== 0 ? 0 : axis[1] !== 0 ? 1 : 2;
          const qv = sub[k];
          const part = (qv + (sign + 1) / 2) / 4;
          return axis[k] > 0 ? part : 1 - part;
        };
        ua = tangent(f.a, sa); ub = tangent(f.b, sb);
      }
      const tu = f.swap ? ub : ua, tv = f.swap ? ua : ub;
      target.uv.push(u0 + UV_PAD + (u1 - u0 - 2 * UV_PAD) * tu, v0 + UV_PAD + (v1 - v0 - 2 * UV_PAD) * tv);
    }
    if (ao[0] + ao[2] >= ao[1] + ao[3]) target.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else target.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    target.n += 4;
  };

  const emitMinecraftModel = (target: Builder, def: typeof BLOCKS[number], id: number, x: number, y: number, z: number) => {
    const instances = MINECRAFT_BLOCK_MODEL_REGISTRY.byId[id];
    if (!instances?.length) return false;
    const token = MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID[id]?.token ?? def.key;
    const getFaceDef = (direction: string) => FACES[MODEL_FACE_INDEX[direction]];
    // Treat the model as handled only after at least one real face was emitted.
    // A dangling model reference must fall back to the block's safe voxel shape,
    // rather than silently making the placed block disappear.
    let emittedFace = false;
    for (const instance of instances) {
      const model = MINECRAFT_BLOCK_MODEL_REGISTRY.models[instance.m];
      if (!model) continue;
      for (const element of model.elements as MinecraftModelElement[]) {
        const from = element.from, to = element.to;
        for (const [direction, face] of Object.entries(element.faces) as Array<[string, MinecraftModelFace]>) {
          const f = getFaceDef(direction);
          if (!f) continue;
          // Vanilla cullface is tested after the blockstate rotation, against opaque full-cube neighbours.
          if (face.cullface) {
            const cullNormal = rotateBlockVector(MODEL_FACE_NORMAL[face.cullface] ?? f.n, instance);
            const cdx = Math.round(cullNormal[0]), cdy = Math.round(cullNormal[1]), cdz = Math.round(cullNormal[2]);
            if (Math.abs(cdx) + Math.abs(cdy) + Math.abs(cdz) === 1) {
              const neighbourId = world.get(x + cdx, y + cdy, z + cdz);
              if (neighbourId > 0 && BLOCKS[neighbourId]?.render === "opaque" && BLOCKS[neighbourId]?.shape === "cube") continue;
            }
          }
          const center: Vec3 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
          const normalAxis = f.n.findIndex((v) => v !== 0);
          center[normalAxis] = f.n[normalAxis] > 0 ? to[normalAxis] : from[normalAxis];
          const axisExtent = (axis: Vec3) => axis.findIndex((v) => v !== 0);
          const aAxis = axisExtent(f.a), bAxis = axisExtent(f.b);
          const halfA = (to[aAxis] - from[aAxis]) / 2, halfB = (to[bAxis] - from[bAxis]) / 2;
          const base = target.n, ao: number[] = [];
          const uvRect = tileUV(face.texture);
          const tint = face.tintindex >= 0 ? tintForBlock(world, id, x, z, face.texture) : [255, 255, 255];
          let normal: Vec3 = [...f.n];
          if (element.rotation?.angle) normal = rotateModelPoint(normal, element.rotation.axis, element.rotation.angle, [0, 0, 0]);
          normal = rotateBlockVector(normal, instance);
          const normalLength = Math.hypot(...normal) || 1;
          normal = normal.map((v) => v / normalLength) as Vec3;
          const shade = element.shade === false || def.emissive ? 1 : normal[1] > 0.5 ? 1 : normal[1] < -0.5 ? 0.5 : Math.abs(normal[0]) > 0.5 ? 0.82 : 0.68;
          const neighbour = world.get(x + Math.round(normal[0]), y + Math.round(normal[1]), z + Math.round(normal[2]));
          const aoValue = neighbour > 0 && BLOCKS[neighbour]?.render === "opaque" ? 0.84 : 1;
          for (const [sa, sb] of CORNERS) {
            const local: Vec3 = [
              center[0] + f.a[0] * halfA * sa + f.b[0] * halfB * sb,
              center[1] + f.a[1] * halfA * sa + f.b[1] * halfB * sb,
              center[2] + f.a[2] * halfA * sa + f.b[2] * sb,
            ];
            let transformed = local;
            if (element.rotation?.angle) transformed = rotateModelPoint(transformed, element.rotation.axis, element.rotation.angle, element.rotation.origin as Vec3, element.rotation.rescale === true);
            transformed = rotateBlockPoint(transformed, instance);
            // Keep model-backed vertices in the same chunk-local coordinate space as cube faces.
            target.pos.push(x - ox + transformed[0] / 16, y + transformed[1] / 16, z - oz + transformed[2] / 16);
            emittedFace = true;
            const [pixelU, pixelV] = faceUvPixels(direction, local, from, to, face);
            let [tu, tv] = lockModelUv(pixelU / 16, pixelV / 16, direction, instance);
            const uvTurn = ((face.rotation % 360) + 360) % 360;
            if (uvTurn === 90) [tu, tv] = [tv, 1 - tu];
            else if (uvTurn === 180) [tu, tv] = [1 - tu, 1 - tv];
            else if (uvTurn === 270) [tu, tv] = [1 - tv, tu];
            target.uv.push(uvRect[0] + (uvRect[2] - uvRect[0]) * tu, uvRect[3] - (uvRect[3] - uvRect[1]) * tv);
            const light = shade * aoValue;
            target.col.push(light * tint[0] / 255, light * tint[1] / 255, light * tint[2] / 255, def.emissive ? 1 : 0);
            ao.push(aoValue > 0.9 ? 3 : 2);
          }
          if (ao[0] + ao[2] >= ao[1] + ao[3]) target.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          else target.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
          target.n += 4;
        }
      }
    }
    return emittedFace;
  };

  for (let y = 0; y <= topY; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = chunk.data[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
        if (id === 0) continue;
        // A corrupt/unknown runtime ID must not abort the entire chunk mesh build.
        // Render it as a visible stone placeholder so one bad cell cannot hide a full chunk.
        const def = BLOCKS[id] ?? BLOCKS[3];
        if (!def) continue;
        const x = ox + lx, z = oz + lz;
        const target = def.render === "liquid" ? liquid
          : def.render === "translucent" ? translucent
            : def.render === "cutout" ? cutout
              : solid;
        if (id >= 92 && emitMinecraftModel(target, def, id, x, y, z)) continue;
        if (def.shape === "cube") {
          for (const f of FACES) {
            const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2];
            const nid = world.get(nx, ny, nz);
            if (nid > 0) {
              const nd = BLOCKS[nid];
              // 隣が部分ブロックなら面を残す。接する部分での同一平面重なりは視覚上不可視。
              if (nd.render === "opaque" && nd.shape === "cube") continue;
              if (nid === id && def.cullSame) continue;
              if (def.render === "liquid" && nd.render === "liquid") continue;
            }
            emitFace(target, def, x, y, z, f, [x + 0.5, y + 0.5, z + 0.5], 0.5);
          }
          continue;
        }
        for (let qy = 0; qy < 4; qy++) for (let qz = 0; qz < 4; qz++) for (let qx = 0; qx < 4; qx++) {
          if (!blockOccupiesSubcell(id, qx, qy, qz)) continue;
          const sub: [number, number, number] = [qx, qy, qz];
          for (const f of FACES) {
            const aqx = qx + f.n[0], aqy = qy + f.n[1], aqz = qz + f.n[2];
            if (aqx >= 0 && aqx < 4 && aqy >= 0 && aqy < 4 && aqz >= 0 && aqz < 4) {
              if (blockOccupiesSubcell(id, aqx, aqy, aqz)) continue;
            } else {
              const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2];
              const nid = world.get(nx, ny, nz);
              if (nid > 0) {
                const nd = BLOCKS[nid];
                if (nd.render === "opaque") {
                  if (nd.shape === "cube") continue;
                  const nq: [number, number, number] = [aqx < 0 ? 3 : aqx > 3 ? 0 : qx, aqy < 0 ? 3 : aqy > 3 ? 0 : qy, aqz < 0 ? 3 : aqz > 3 ? 0 : qz];
                  if (blockOccupiesSubcell(nid, nq[0], nq[1], nq[2])) continue;
                }
                if (nid === id && def.cullSame) continue;
                if (def.render === "liquid" && nd.render === "liquid") continue;
              }
            }
            const center: [number, number, number] = [x + 0.125 + qx * 0.25, y + 0.125 + qy * 0.25, z + 0.125 + qz * 0.25];
            emitFace(target, def, x, y, z, f, center, 0.125, sub);
          }
        }
      }
    }
  }
  return { solid: solid.finish(), cutout: cutout.finish(), translucent: translucent.finish(), liquid: liquid.finish() };
}
