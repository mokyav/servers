#!/usr/bin/env node
/**
 * Builds a deterministic, compact lookup from Minecraft Java block runtime IDs
 * to the official blockstate/model JSON bundled under src/client/public/assets.
 * No external packages are required.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID,
  MINECRAFT_BLOCK_STATE_RUNTIME_ID_END,
} from '../shared/minecraft-block-runtime.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'src/client/public/assets/minecraft');
const modelCache = new Map();
const modelIndex = new Map();
const models = [];
const textureKeys = new Set();
const instancesById = Array.from({ length: MINECRAFT_BLOCK_STATE_RUNTIME_ID_END + 1 }, () => []);

const DEFAULTS = {
  facing: 'north', axis: 'y', half: 'bottom', type: 'bottom', part: 'foot', hinge: 'left',
  shape: 'straight', open: 'false', powered: 'false', lit: 'false', waterlogged: 'false',
  snowy: 'false', persistent: 'false', age: '0', stage: '0', distance: '1', rotation: '0',
  attached: 'false', drag: 'false', in_wall: 'false', berries: 'false', hanging: 'false', up: 'true',
  tip: 'none', vertical_direction: 'up', extended: 'false', triggered: 'false',
};

const readJson = (file) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
};
const normalizeResource = (value) => {
  if (typeof value !== 'string') return null;
  const raw = value.replace(/^#/, '');
  if (raw.includes(':')) return raw;
  return `minecraft:${raw}`;
};
const resourcePath = (value) => {
  const raw = value.replace(/^minecraft:/, '');
  return path.join(assets, 'models', `${raw}.json`);
};

function resolveModel(name, chain = []) {
  const normalized = normalizeResource(name);
  if (!normalized || chain.includes(normalized)) return { elements: [], textures: {} };
  const cached = modelCache.get(normalized);
  if (cached) return cached;
  const raw = readJson(resourcePath(normalized));
  if (!raw) {
    const empty = { elements: [], textures: {} };
    modelCache.set(normalized, empty);
    return empty;
  }
  const parentName = raw.parent ? normalizeResource(raw.parent) : null;
  const parent = parentName ? resolveModel(parentName, [...chain, normalized]) : { elements: [], textures: {} };
  const textures = { ...parent.textures, ...(raw.textures ?? {}) };
  // Keep symbolic texture variables unresolved here: a child model may override
  // a parent's #texture variable, so resolving it while caching the parent loses it.
  const sourceElements = raw.elements ?? parent.elements ?? [];
  const elements = sourceElements.map((element) => {
    const faces = {};
    for (const [direction, face] of Object.entries(element.faces ?? {})) {
      const textureRef = face.textureRef ?? face.texture;
      if (typeof textureRef !== 'string') continue;
      faces[direction] = {
        textureRef,
        uv: face.uv ?? null,
        rotation: face.rotation ?? 0,
        tintindex: Number.isInteger(face.tintindex) ? face.tintindex : -1,
        cullface: face.cullface ?? null,
      };
    }
    return {
      from: element.from ?? [0, 0, 0],
      to: element.to ?? [16, 16, 16],
      rotation: element.rotation ?? null,
      shade: element.shade !== false,
      faces,
    };
  });
  const resolved = { elements, textures };
  modelCache.set(normalized, resolved);
  return resolved;
}

function stateProperties(meta) {
  const props = { ...DEFAULTS, ...(meta?.state ?? {}) };
  if (typeof props.connections === 'number') {
    const wall = meta?.kind === 'fence' && meta?.token?.endsWith('_wall');
    props.north = wall ? (props.connections & 1 ? 'low' : 'none') : Boolean(props.connections & 1);
    props.east = wall ? (props.connections & 2 ? 'low' : 'none') : Boolean(props.connections & 2);
    props.south = wall ? (props.connections & 4 ? 'low' : 'none') : Boolean(props.connections & 4);
    props.west = wall ? (props.connections & 8 ? 'low' : 'none') : Boolean(props.connections & 8);
  }
  for (const key of Object.keys(props)) props[key] = String(props[key]);
  return props;
}

function matchesWhen(when, props) {
  if (!when) return true;
  if (Array.isArray(when.OR)) return when.OR.some((part) => matchesWhen(part, props));
  if (Array.isArray(when.AND)) return when.AND.every((part) => matchesWhen(part, props));
  return Object.entries(when).every(([key, expected]) => {
    const actual = props[key] ?? String(DEFAULTS[key] ?? 'false');
    const choices = String(expected).split('|');
    return choices.includes(actual);
  });
}

function selectVariant(variants, props) {
  const candidates = Object.entries(variants ?? {}).map(([condition, apply], order) => {
    const pairs = condition ? condition.split(',').map((entry) => entry.split('=')) : [];
    let matched = true, score = 0;
    for (const [key, expected] of pairs) {
      const actual = props[key] ?? String(DEFAULTS[key] ?? 'false');
      if (actual !== expected) { matched = false; break; }
      score++;
    }
    return { matched, score, order, apply };
  }).filter((candidate) => candidate.matched);
  candidates.sort((a, b) => b.score - a.score || a.order - b.order);
  return candidates[0]?.apply ?? Object.values(variants ?? {})[0] ?? null;
}

function normalizeApply(apply) {
  if (Array.isArray(apply)) return apply.length ? [apply[0]] : [];
  return apply ? [apply] : [];
}

function modelInstance(apply) {
  if (!apply?.model) return null;
  const modelName = normalizeResource(apply.model);
  const rawModel = resolveModel(modelName);
  if (!rawModel.elements.length) return null;
  const resolveTexture = (reference, seen = []) => {
    if (reference && typeof reference === 'object') reference = reference.sprite ?? reference.texture ?? null;
    if (typeof reference !== 'string') return null;
    const key = reference.startsWith('#') ? reference.slice(1) : reference;
    if (Object.prototype.hasOwnProperty.call(rawModel.textures, key)) {
      if (seen.includes(key)) return null;
      return resolveTexture(rawModel.textures[key], [...seen, key]);
    }
    if (reference.startsWith('#')) return null;
    return normalizeResource(reference);
  };
  const elements = rawModel.elements.map((element) => {
    const faces = {};
    for (const [direction, face] of Object.entries(element.faces)) {
      const texture = resolveTexture(face.textureRef);
      if (!texture) continue;
      textureKeys.add(texture);
      faces[direction] = { texture, uv: face.uv, rotation: face.rotation, tintindex: face.tintindex, cullface: face.cullface };
    }
    return { from: element.from, to: element.to, rotation: element.rotation, shade: element.shade, faces };
  });
  if (elements.every((element) => !Object.keys(element.faces).length)) return null;
  const cacheKey = `${modelName}|${JSON.stringify(rawModel.textures)}`;
  let index = modelIndex.get(cacheKey);
  if (index === undefined) {
    index = models.length;
    modelIndex.set(cacheKey, index);
    models.push({ name: modelName, elements });
  }
  return {
    m: index,
    x: Number(apply.x ?? 0),
    y: Number(apply.y ?? 0),
    z: Number(apply.z ?? 0),
    uvlock: apply.uvlock === true,
  };
}

function resolveBlockstate(token, meta) {
  const file = path.join(assets, 'blockstates', `${token}.json`);
  const blockstate = readJson(file);
  if (!blockstate) {
    const fallback = `minecraft:block/${token}`;
    return [modelInstance({ model: fallback })].filter(Boolean);
  }
  const props = stateProperties(meta);
  const applies = [];
  if (blockstate.variants) {
    const selected = selectVariant(blockstate.variants, props);
    applies.push(...normalizeApply(selected));
  }
  if (Array.isArray(blockstate.multipart)) {
    for (const part of blockstate.multipart) {
      if (matchesWhen(part.when, props)) applies.push(...normalizeApply(part.apply));
    }
  }
  return applies.map(modelInstance).filter(Boolean);
}

for (const [idText, meta] of Object.entries(MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID)) {
  const id = Number(idText);
  const token = meta.token;
  if (!token || id < 92) continue;
  instancesById[id] = resolveBlockstate(token, meta);
}


function addCustomModel(name, elements) {
  const index = models.length;
  const normalized = elements.map((element) => {
    const faces = {};
    for (const [direction, texture] of Object.entries(element.faces)) {
      textureKeys.add(texture);
      faces[direction] = { texture, uv: [0, 0, 16, 16], rotation: 0, tintindex: -1, cullface: null };
    }
    return { from: element.from, to: element.to, rotation: null, shade: true, faces };
  });
  models.push({ name: `koruva:special/${name}`, elements: normalized });
  return index;
}
const allFaces = (texture, overrides = {}) => Object.fromEntries(
  ['down', 'up', 'north', 'south', 'west', 'east'].map((direction) => [direction, overrides[direction] ?? texture]),
);
const chestColors = (token) => {
  if (token === 'trapped_chest') return 'trapped';
  if (token === 'ender_chest') return 'ender';
  if (token.includes('oxidized_copper')) return 'oxidized_copper';
  if (token.includes('weathered_copper')) return 'weathered_copper';
  if (token.includes('exposed_copper')) return 'exposed_copper';
  if (token.includes('copper')) return 'copper';
  return 'normal';
};
const shulkerColors = ['white','orange','magenta','light_blue','yellow','lime','pink','gray','light_gray','cyan','purple','blue','brown','green','red','black'];
const woolColors = new Set(shulkerColors);
const specialTokens = [...new Set(Object.values(MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID).map((meta) => meta.token))];
for (const token of specialTokens) {
  const stateIds = Object.entries(MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID).filter(([, meta]) => meta.token === token).map(([id]) => Number(id));
  if (!stateIds.length || stateIds.every((id) => instancesById[id]?.length)) continue;
  let parts = null;
  if (token === 'chest' || token === 'trapped_chest' || token === 'ender_chest' || token.endsWith('_chest')) {
    const type = chestColors(token);
    const tile = (face) => `minecraft:koruva/chest/${type}_${face}`;
    const body = allFaces(tile('base_side'), {
      down: tile('base_bottom'), up: tile('base_top'), south: tile('base_front'), north: tile('base_back'),
    });
    const lid = allFaces(tile('lid_side'), {
      down: tile('base_top'), up: tile('lid_top'), south: tile('lid_front'), north: tile('lid_back'),
    });
    parts = [
      { from: [1, 0, 1], to: [15, 10, 15], faces: body },
      { from: [1, 10, 1], to: [15, 15, 15], faces: lid },
      { from: [7, 6, 0], to: [9, 12, 1], faces: allFaces(tile('latch')) },
    ];
  } else if (token === 'shulker_box' || token.endsWith('_shulker_box')) {
    const color = shulkerColors.find((candidate) => token.startsWith(`${candidate}_`)) ?? '';
    const texture = `minecraft:block/${color ? `${color}_` : ''}shulker_box`;
    parts = [
      { from: [1, 0, 1], to: [15, 11, 15], faces: allFaces(texture) },
      { from: [0, 11, 0], to: [16, 16, 16], faces: allFaces(texture) },
    ];
  } else if (token === 'decorated_pot') {
    const side = 'minecraft:entity/decorated_pot/decorated_pot_side';
    const base = 'minecraft:entity/decorated_pot/decorated_pot_base';
    parts = [
      { from: [4, 2, 4], to: [12, 14, 12], faces: allFaces(side, { down: base, up: side }) },
      { from: [3, 12, 3], to: [13, 14, 13], faces: allFaces(side) },
      { from: [5, 0, 5], to: [11, 2, 11], faces: allFaces(base) },
    ];
  } else if (token.endsWith('_banner') || token === 'banner') {
    const color = shulkerColors.find((candidate) => token.startsWith(`${candidate}_`)) ?? 'white';
    const cloth = `minecraft:koruva/banner/${color}`;
    const pole = 'minecraft:block/oak_planks';
    const wall = token.endsWith('_wall_banner');
    parts = wall ? [
      { from: [2, 2, 1], to: [14, 14, 4], faces: allFaces(cloth) },
    ] : [
      { from: [7, 0, 7], to: [9, 16, 9], faces: allFaces(pole) },
      { from: [2, 3, 6], to: [14, 14, 10], faces: allFaces(cloth) },
    ];
  } else if (token.endsWith('_wall')) {
    // Walls are multipart variants; this model is used only if the official
    // multipart cannot be resolved. The normal wall post/arms are preferred.
    continue;
  } else if (token.endsWith('_head') || token.endsWith('_skull')) {
    const texture = 'minecraft:block/bone_block_side';
    parts = [{ from: [4, 4, 4], to: [12, 12, 12], faces: allFaces(texture) }];
  } else if (token === 'conduit') {
    parts = [{ from: [2, 2, 2], to: [14, 14, 14], faces: allFaces('minecraft:block/conduit') }];
  } else if (token.includes('copper_golem_statue')) {
    const textureName = token.includes('oxidized') ? 'oxidized_copper' : token.includes('weathered') ? 'weathered_copper' : token.includes('exposed') ? 'exposed_copper' : 'copper_block';
    const texture = `minecraft:block/${textureName}`;
    parts = [
      { from: [6, 11, 6], to: [10, 16, 10], faces: allFaces(texture) },
      { from: [4, 5, 5], to: [12, 12, 11], faces: allFaces(texture) },
      { from: [5, 0, 5], to: [8, 5, 11], faces: allFaces(texture) },
      { from: [8, 0, 5], to: [11, 5, 11], faces: allFaces(texture) },
      { from: [2, 5, 5], to: [5, 11, 11], faces: allFaces(texture) },
      { from: [11, 5, 5], to: [14, 11, 11], faces: allFaces(texture) },
    ];
  } else if (token === 'redstone_wire') {
    parts = [{ from: [0, 0.5, 0], to: [16, 1, 16], faces: { up: 'minecraft:block/redstone_dust_dot' } }];
  } else if (token === 'pale_moss_carpet') {
    parts = [{ from: [0, 0, 0], to: [16, 1, 16], faces: allFaces('minecraft:block/pale_moss_carpet') }];
  } else if (token === 'leaf_litter') {
    parts = [{ from: [0, 0, 0], to: [16, 1, 16], faces: allFaces('minecraft:block/leaf_litter') }];
  } else if (token === 'end_portal' || token === 'end_gateway') {
    parts = [{ from: [0, 0, 0], to: [16, 0.5, 16], faces: allFaces('minecraft:environment/end_sky') }];
  }
  if (parts) {
    const modelId = addCustomModel(token, parts);
    for (const id of stateIds) if (!instancesById[id]?.length) {
      const state = MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID[id]?.state ?? {};
      let facingRotation = 0;
      if (token.endsWith('_chest') || token === 'chest' || token === 'trapped_chest' || token === 'ender_chest' || token.endsWith('_wall_banner')) {
        facingRotation = ({ south: 0, east: 90, north: 180, west: 270 }[state.facing] ?? 0);
      } else if (token.endsWith('_banner')) {
        facingRotation = ((Number(state.rotation ?? 0) * 22.5) % 360);
      }
      instancesById[id] = [{ m: modelId, x: 0, y: facingRotation, z: 0, uvlock: false }];
    }
  }
}

function rotatePoint(point, axis, degrees, origin = [8, 8, 8], rescale = false) {
  const angle = degrees * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  let [x, y, z] = point.map((value, index) => value - origin[index]);
  if (axis === 'x') [y, z] = [y * c - z * s, y * s + z * c];
  else if (axis === 'y') [x, z] = [x * c + z * s, -x * s + z * c];
  else [x, y] = [x * c - y * s, x * s + y * c];
  if (rescale) {
    const scale = 1 / Math.max(0.0001, Math.abs(c));
    if (axis === 'x') { y *= scale; z *= scale; }
    else if (axis === 'y') { x *= scale; z *= scale; }
    else { x *= scale; y *= scale; }
  }
  return [x + origin[0], y + origin[1], z + origin[2]];
}
function inversePoint(point, instance, elementRotation) {
  let p = [...point];
  // Inverse blockstate transform (the rendering order is X, then Y, then Z).
  if (instance.z) p = rotatePoint(p, 'z', -instance.z);
  if (instance.y) p = rotatePoint(p, 'y', -instance.y);
  if (instance.x) p = rotatePoint(p, 'x', -instance.x);
  if (elementRotation?.angle) {
    const axis = elementRotation.axis;
    const c = Math.cos(elementRotation.angle * Math.PI / 180);
    const rescale = elementRotation.rescale === true;
    p = rotatePoint(p, axis, -elementRotation.angle, elementRotation.origin, false);
    if (rescale) {
      const scale = Math.max(0.0001, Math.abs(c));
      const relative = p.map((value, index) => value - elementRotation.origin[index]);
      if (axis === 'x') { relative[1] *= scale; relative[2] *= scale; }
      else if (axis === 'y') { relative[0] *= scale; relative[2] *= scale; }
      else { relative[0] *= scale; relative[1] *= scale; }
      p = relative.map((value, index) => value + elementRotation.origin[index]);
    }
  }
  return p;
}
function computeOccupancy(parts) {
  let mask = 0n;
  for (let qy = 0; qy < 4; qy++) for (let qz = 0; qz < 4; qz++) for (let qx = 0; qx < 4; qx++) {
    const point = [(qx + .5) * 4, (qy + .5) * 4, (qz + .5) * 4];
    let occupied = false;
    for (const instance of parts) {
      const model = models[instance.m];
      for (const element of model.elements) {
        const p = inversePoint(point, instance, element.rotation);
        if (p[0] >= element.from[0] && p[0] <= element.to[0] && p[1] >= element.from[1] && p[1] <= element.to[1] && p[2] >= element.from[2] && p[2] <= element.to[2]) {
          occupied = true; break;
        }
      }
      if (occupied) break;
    }
    if (occupied) mask |= 1n << BigInt(qy * 16 + qz * 4 + qx);
  }
  return mask.toString(16).padStart(16, '0');
}
const occupancy = instancesById.map((parts) => parts?.length ? computeOccupancy(parts) : null);

const output = {
  version: 1,
  modelCount: models.length,
  blockStateCount: Object.values(instancesById).filter((parts) => parts.length).length,
  textures: [...textureKeys].sort(),
  models,
  byId: instancesById,
};
const outFile = path.join(root, 'shared/minecraft-block-model-registry.js');
fs.writeFileSync(outFile, `// Generated from the bundled Minecraft Java 26.3 blockstates and block models.\n// Regenerate with: node scripts/generate-minecraft-model-registry.mjs\nexport const MINECRAFT_BLOCK_MODEL_REGISTRY = ${JSON.stringify(output)};\n`);
fs.writeFileSync(path.join(root, 'shared/minecraft-block-occupancy.js'), `// Generated 4×4×4 collision occupancy masks from the bundled Java block models.\nexport const MINECRAFT_BLOCK_OCCUPANCY = ${JSON.stringify(occupancy)};\n`);
fs.writeFileSync(path.join(root, 'shared/minecraft-block-occupancy.d.ts'), `export const MINECRAFT_BLOCK_OCCUPANCY: (string | null)[];\n`);
fs.writeFileSync(path.join(root, 'shared/minecraft-block-model-registry.d.ts'), `export interface MinecraftModelFace { texture: string; uv: number[] | null; rotation: number; tintindex: number; cullface: string | null }\nexport interface MinecraftModelElement { from: number[]; to: number[]; rotation: { origin: number[]; axis: string; angle: number; rescale?: boolean } | null; shade: boolean; faces: Record<string, MinecraftModelFace> }\nexport interface MinecraftResolvedModel { name: string; elements: MinecraftModelElement[] }\nexport interface MinecraftModelInstance { m: number; x: number; y: number; z: number; uvlock: boolean }\nexport interface MinecraftBlockModelRegistry { version: number; modelCount: number; blockStateCount: number; textures: string[]; models: MinecraftResolvedModel[]; byId: MinecraftModelInstance[][] }\nexport const MINECRAFT_BLOCK_MODEL_REGISTRY: MinecraftBlockModelRegistry;\n`);
console.log(`Generated ${outFile}: ${output.modelCount} models, ${output.blockStateCount} block states, ${output.textures.length} textures.`);
