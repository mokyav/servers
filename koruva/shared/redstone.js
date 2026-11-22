export const REDSTONE_MAX_SIGNAL = 15;
export const REDSTONE_DEFAULT_MAX_NODES = 4096;
export const REDSTONE_DEFAULT_MAX_STEPS = 65536;
const NODE_KINDS = new Set(["source", "repeater", "wire", "consumer"]);

export function normalizeRedstoneSignal(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError("signal must be a finite number");
  return Math.max(0, Math.min(REDSTONE_MAX_SIGNAL, Math.floor(value)));
}

function normalizeNodes(input, maxNodes) {
  if (!Array.isArray(input)) throw new TypeError("nodes must be an array");
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 0) throw new RangeError("maxNodes must be a non-negative safe integer");
  if (input.length > maxNodes) throw new RangeError("redstone node limit exceeded");
  const nodes = new Map();
  for (const raw of input) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || raw.id.length < 1 || raw.id.length > 128) {
      throw new TypeError("each node needs a 1-128 character id");
    }
    if (nodes.has(raw.id)) throw new TypeError(`duplicate redstone node id: ${raw.id}`);
    if (!NODE_KINDS.has(raw.kind)) throw new TypeError(`unsupported redstone node kind: ${raw.kind}`);
    if (raw.connections !== undefined && !Array.isArray(raw.connections)) throw new TypeError("connections must be an array");
    const connections = raw.connections ?? [];
    if (connections.length > 64 || connections.some((id) => typeof id !== "string" || id.length > 128)) {
      throw new RangeError("invalid redstone connection list");
    }
    nodes.set(raw.id, {
      id: raw.id,
      kind: raw.kind,
      power: raw.kind === "source" || raw.kind === "repeater" ? normalizeRedstoneSignal(raw.power ?? 0) : 0,
      connections: [...new Set(connections)].filter((id) => id !== raw.id),
    });
  }
  return nodes;
}

/**
 * Compute a bounded, deterministic redstone signal graph.
 * `source` and powered `repeater` nodes emit 0..15. Connected wire-to-wire
 * paths attenuate by one per block; wires connected to a source receive its
 * full strength. Consumers read the maximum adjacent source/wire output.
 * Connections between two wires are treated as undirected, which makes the
 * result independent of node declaration order. This core has no block-ID or
 * Minecraft update-order integration; callers provide the data-driven graph.
 */
export function computeRedstoneSignals(input, options = {}) {
  const maxNodes = options.maxNodes ?? REDSTONE_DEFAULT_MAX_NODES;
  const maxSteps = options.maxSteps ?? REDSTONE_DEFAULT_MAX_STEPS;
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 0) throw new RangeError("maxSteps must be a non-negative safe integer");
  const nodes = normalizeNodes(input, maxNodes);
  const adjacentWires = new Map();
  for (const id of nodes.keys()) adjacentWires.set(id, new Set());
  for (const node of nodes.values()) {
    if (node.kind !== "wire") continue;
    for (const otherId of node.connections) {
      const other = nodes.get(otherId);
      if (other?.kind === "wire") {
        adjacentWires.get(node.id).add(otherId);
        adjacentWires.get(otherId).add(node.id);
      }
    }
  }
  const levels = new Map([...nodes.keys()].map((id) => [id, 0]));
  const queue = [];
  for (const node of nodes.values()) {
    if (node.kind === "source" || node.kind === "repeater") levels.set(node.id, node.power);
    if ((node.kind === "source" || node.kind === "repeater") && node.power > 0) {
      for (const otherId of node.connections) {
        if (nodes.get(otherId)?.kind === "wire" && node.power > levels.get(otherId)) {
          levels.set(otherId, node.power);
          queue.push(otherId);
        }
      }
    }
    if (node.kind === "wire") {
      for (const otherId of node.connections) {
        const other = nodes.get(otherId);
        if ((other?.kind === "source" || other?.kind === "repeater") && other.power > levels.get(node.id)) {
          levels.set(node.id, other.power);
          queue.push(node.id);
        }
      }
    }
  }
  let head = 0;
  let steps = 0;
  while (head < queue.length) {
    const id = queue[head++];
    const nextLevel = levels.get(id) - 1;
    if (nextLevel <= 0) continue;
    for (const otherId of adjacentWires.get(id)) {
      steps++;
      if (steps > maxSteps) throw new RangeError("redstone propagation step limit exceeded");
      if (nextLevel > levels.get(otherId)) {
        levels.set(otherId, nextLevel);
        queue.push(otherId);
      }
    }
  }
  for (const node of nodes.values()) {
    if (node.kind !== "consumer") continue;
    let level = 0;
    for (const otherId of node.connections) {
      const other = nodes.get(otherId);
      if (other && (other.kind === "wire" || other.kind === "source" || other.kind === "repeater")) {
        level = Math.max(level, levels.get(otherId));
      }
    }
    levels.set(node.id, level);
  }
  return levels;
}

/** Create a deterministic, bounded tick scheduler for delayed device updates. */
export function createRedstoneScheduler(options = {}) {
  const maxPending = options.maxPending ?? 4096;
  if (!Number.isSafeInteger(maxPending) || maxPending < 0) throw new RangeError("maxPending must be a non-negative safe integer");
  const pending = new Map();
  let sequence = 0;
  return {
    schedule(id, signal, dueTick) {
      if (typeof id !== "string" || id.length < 1 || id.length > 128) throw new TypeError("update id must be a 1-128 character string");
      if (!Number.isSafeInteger(dueTick) || dueTick < 0) throw new RangeError("dueTick must be a non-negative safe integer");
      if (!pending.has(id) && pending.size >= maxPending) return false;
      pending.set(id, { id, signal: normalizeRedstoneSignal(signal), dueTick, sequence: sequence++ });
      return true;
    },
    popDue(tick, limit = 256) {
      if (!Number.isSafeInteger(tick) || tick < 0) throw new RangeError("tick must be a non-negative safe integer");
      if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError("limit must be a non-negative safe integer");
      const due = [...pending.values()]
        .filter((entry) => entry.dueTick <= tick)
        .sort((a, b) => a.dueTick - b.dueTick || a.sequence - b.sequence)
        .slice(0, limit);
      for (const entry of due) {
        if (pending.get(entry.id)?.sequence === entry.sequence) pending.delete(entry.id);
      }
      return due.map(({ id, signal, dueTick }) => ({ id, signal, dueTick }));
    },
    cancel(id) { return pending.delete(id); },
    clear() { pending.clear(); },
    get size() { return pending.size; },
  };
}
