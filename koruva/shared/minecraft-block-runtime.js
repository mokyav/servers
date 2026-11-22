// Stable Minecraft block IDs. Legacy Koruva IDs (0..91) and the original
// Minecraft base IDs are kept in their prior order; state variants append after them.
import { MINECRAFT_BLOCK_IDS } from "./minecraft-block-catalog.js";
import { MINECRAFT_ITEM_IDS } from "./minecraft-item-catalog.js";
import { MINECRAFT_GENERIC_BLOCKSTATE_VARIANTS } from "./minecraft-blockstate-variant-catalog.js";
export const MINECRAFT_BLOCK_RUNTIME_ID_START = 92;
const AIR_IDS = new Set(["minecraft:air", "minecraft:cave_air", "minecraft:void_air"]);
let nextId = MINECRAFT_BLOCK_RUNTIME_ID_START;
const map = Object.create(null);
const stateById = Object.create(null);
const variantsByKey = Object.create(null);
const baseByToken = Object.create(null);
const genericStateIdsByToken = Object.create(null);

function stateKey(kind, state) {
  if (kind === "stairs") return `${state.facing}|${state.half}|${state.shape}`;
  if (kind === "slab") return `${state.type}`;
  if (kind === "door") return `${state.facing}|${state.half}|${state.hinge}|${state.open ? 1 : 0}`;
  if (kind === "gate") return `${state.facing}|${state.open ? 1 : 0}|${state.in_wall ? 1 : 0}`;
  if (kind === "trapdoor") return `${state.facing}|${state.half}|${state.open ? 1 : 0}`;
  if (kind === "fence" || kind === "pane") return `${state.connections}`;
  if (kind === "cube") return Object.entries(state).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join(",") || "default";
  return "default";
}
function kindFor(token) {
  if (token.endsWith("_stairs")) return "stairs";
  if (token.endsWith("_slab")) return "slab";
  if (token.endsWith("_fence_gate")) return "gate";
  if (token.endsWith("_door")) return "door";
  if (token.endsWith("_trapdoor")) return "trapdoor";
  if (token.endsWith("_fence") || token.endsWith("_wall")) return "fence";
  if (token.endsWith("_pane") || token === "iron_bars") return "pane";
  return "cube";
}
function statesFor(kind) {
  const facings = ["north", "east", "south", "west"];
  if (kind === "stairs") return facings.flatMap(facing => ["bottom", "top"].flatMap(half => ["straight", "inner_left", "inner_right", "outer_left", "outer_right"].map(shape => ({ facing, half, shape }))));
  if (kind === "slab") return [{ type: "bottom" }, { type: "top" }, { type: "double" }];
  if (kind === "door") return facings.flatMap(facing => ["lower", "upper"].flatMap(half => ["left", "right"].flatMap(hinge => [false, true].map(open => ({ facing, half, hinge, open })))));
  if (kind === "gate") return facings.flatMap(facing => [false, true].flatMap(open => [false, true].map(in_wall => ({ facing, open, in_wall }))));
  if (kind === "trapdoor") return facings.flatMap(facing => ["bottom", "top"].flatMap(half => [false, true].map(open => ({ facing, half, open }))));
  if (kind === "fence" || kind === "pane") return Array.from({ length: 16 }, (_, connections) => ({ connections }));
  return [{}];
}

// First reserve legacy base IDs. Stairs retain their original four directional IDs.
for (const key of MINECRAFT_BLOCK_IDS) {
  if (AIR_IDS.has(key)) { map[key] = 0; continue; }
  const token = key.slice("minecraft:".length);
  const base = nextId;
  map[key] = base;
  baseByToken[token] = base;
  nextId += token.endsWith("_stairs") ? 4 : 1;
}
for (const key of AIR_IDS) if (map[key] === undefined) map[key] = 0;
const legacyEnd = nextId - 1;

// Preserve the entire pre-state item-only ID range as well. New state IDs begin after it.
let nextStateId = legacyEnd + 1;
for (const itemKey of MINECRAFT_ITEM_IDS) if (map[itemKey] === undefined) nextStateId++;
nextId = nextStateId;

// Append state variants without changing any old block or item IDs. Default state always maps to base ID.
for (const key of MINECRAFT_BLOCK_IDS) {
  const base = map[key];
  if (!base) continue;
  const token = key.slice("minecraft:".length);
  const kind = kindFor(token);
  if (kind === "cube") { stateById[base] = { token, kind, state: {} }; continue; }
  const states = statesFor(kind);
  for (const state of states) {
    const variantKey = `${key}|${stateKey(kind, state)}`;
    let id;
    if (kind === "stairs" && state.half === "bottom" && state.shape === "straight") {
      id = base + ["north", "east", "south", "west"].indexOf(state.facing);
    } else if ((kind === "slab" && state.type === "bottom") || (kind === "door" && state.facing === "north" && state.half === "lower" && state.hinge === "left" && state.open === false) || (kind === "gate" && state.facing === "north" && state.open === false && state.in_wall === false) ||
      (kind === "trapdoor" && state.facing === "north" && state.half === "bottom" && state.open === false) ||
      ((kind === "fence" || kind === "pane") && state.connections === 0)) {
      id = base;
    } else {
      id = nextId++;
    }
    variantsByKey[variantKey] = id;
    stateById[id] = { token, kind, state: { ...state } };
  }
}

// Append all remaining official JSON state variants after the legacy state-ID range.
// This keeps every already-issued base/item/shape-state ID stable.
for (const [token, states] of Object.entries(MINECRAFT_GENERIC_BLOCKSTATE_VARIANTS)) {
  const key = `minecraft:${token}`;
  const base = map[key];
  if (!base) continue;
  const candidates = [];
  for (const state of states) {
    const canonical = stateKey("cube", state);
    if (canonical === "default") continue;
    const variantKey = `${key}|${canonical}`;
    if (variantsByKey[variantKey] !== undefined) continue;
    const id = nextId++;
    variantsByKey[variantKey] = id;
    stateById[id] = { token, kind: "cube", state: { ...state } };
    candidates.push({ id, state: { ...state } });
  }
  if (candidates.length) genericStateIdsByToken[token] = candidates;
}

export const MINECRAFT_BLOCK_RUNTIME_ID_END = legacyEnd;
export const MINECRAFT_BLOCK_STATE_RUNTIME_ID_END = nextId - 1;
export const MINECRAFT_BLOCK_RUNTIME_STATE_COUNT = MINECRAFT_BLOCK_STATE_RUNTIME_ID_END - MINECRAFT_BLOCK_RUNTIME_ID_START + 1;
export const MINECRAFT_BLOCK_LEGACY_RUNTIME_ID_END = legacyEnd;
export const MINECRAFT_BLOCK_TO_RUNTIME_ID = Object.freeze(map);
export const MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID = Object.freeze(stateById);
export function resolveMinecraftBlockRuntimeId(id) { return typeof id === "string" ? MINECRAFT_BLOCK_TO_RUNTIME_ID[id] : undefined; }
export function minecraftBlockVariantId(identifier, state = {}) {
  if (typeof identifier !== "string") return undefined;
  const key = identifier.startsWith("minecraft:") ? identifier : `minecraft:${identifier}`;
  const base = MINECRAFT_BLOCK_TO_RUNTIME_ID[key];
  if (!base) return undefined;
  const token = key.slice("minecraft:".length);
  const kind = kindFor(token);
  const defaults = kind === "stairs" ? { facing: "north", half: "bottom", shape: "straight" }
    : kind === "slab" ? { type: "bottom" }
      : kind === "door" ? { facing: "north", half: "lower", hinge: "left", open: false }
        : kind === "gate" ? { facing: "north", open: false, in_wall: false }
        : kind === "trapdoor" ? { facing: "north", half: "bottom", open: false }
          : kind === "fence" || kind === "pane" ? { connections: 0 } : {};
  const normalized = { ...defaults, ...state };
  const exact = variantsByKey[`${key}|${stateKey(kind, normalized)}`];
  if (exact !== undefined) return exact;
  if (kind === "cube" && Object.keys(state).length) {
    const patch = Object.entries(state).map(([k, v]) => [k, String(v)]);
    const matches = (genericStateIdsByToken[token] ?? []).filter((candidate) => patch.every(([k, v]) => String(candidate.state[k]) === v));
    matches.sort((a, b) => Object.keys(a.state).length - Object.keys(b.state).length || a.id - b.id);
    if (matches.length) return matches[0].id;
  }
  return base;
}
