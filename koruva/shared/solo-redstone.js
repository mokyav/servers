import { createRepeaterDelayController } from "./repeater-delay.js";
import { evaluateRedstoneWorld } from "./redstone-world.js";

const coordKey = (x, y, z) => `${x},${y},${z}`;
const isCoord = (n) => Number.isSafeInteger(n);

/** Solo redstone driver: 50 ms ticks, delayed repeater transitions and bounded recalculation. */
export function createSoloRedstoneRuntime({ blockAt, setBlock, ids, tickSeconds = 0.05, maxNodes, maxSteps, maxPending }) {
  if (typeof blockAt !== "function" || typeof setBlock !== "function") throw new TypeError("blockAt and setBlock must be functions");
  if (!Number.isFinite(tickSeconds) || tickSeconds <= 0 || tickSeconds > 1) throw new RangeError("tickSeconds must be in (0, 1]");
  if (!ids || !Array.isArray(ids.repeaters)) throw new TypeError("ids.repeaters is required");
  const queue = createRepeaterDelayController(maxPending === undefined ? undefined : { maxPending });
  let accumulator = 0;
  const repeaterSet = new Set(ids.repeaters);

  function evaluateAt(x, y, z) {
    if (![x, y, z].every(isCoord)) throw new TypeError("coordinates must be safe integers");
    const result = evaluateRedstoneWorld({
      x, y, z, blockAt, ids, maxNodes, maxSteps,
      repeaterOutputAt: (rx, ry, rz) => queue.getOutput(coordKey(rx, ry, rz)),
    });
    if (!result.bounded) return result;
    for (const input of result.repeaterInputs) {
      queue.schedule(coordKey(input.x, input.y, input.z), input.powered, input.delayTicks, queue.tick);
    }
    for (const change of result.lampChanges) setBlock(change.x, change.y, change.z, change.to);
    return result;
  }

  function onBlockChanged(x, y, z) {
    if (![x, y, z].every(isCoord)) throw new TypeError("coordinates must be safe integers");
    if (!repeaterSet.has(blockAt(x, y, z))) queue.remove(coordKey(x, y, z));
    return evaluateAt(x, y, z);
  }

  function advance(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new RangeError("deltaSeconds must be finite and non-negative");
    accumulator += Math.min(deltaSeconds, 1);
    const transitions = [];
    let ticks = 0;
    while (accumulator + 1e-12 >= tickSeconds && ticks < 20) {
      accumulator -= tickSeconds;
      ticks++;
      const due = queue.advance(queue.tick + 1);
      transitions.push(...due);
      for (const event of due) {
        const parts = event.id.split(",").map(Number);
        if (parts.length !== 3 || !parts.every(isCoord) || !repeaterSet.has(blockAt(parts[0], parts[1], parts[2]))) continue;
        evaluateAt(parts[0], parts[1], parts[2]);
      }
    }
    return transitions;
  }

  function snapshot() { return { version: 1, accumulator, queue: queue.snapshot() }; }
  function restore(state) {
    if (!state || state.version !== 1 || !Number.isFinite(state.accumulator) || state.accumulator < 0 || state.accumulator >= tickSeconds) throw new TypeError("invalid solo redstone snapshot");
    queue.restore(state.queue);
    accumulator = state.accumulator;
  }
  function clear() { queue.clear(); accumulator = 0; }

  return { evaluateAt, onBlockChanged, advance, snapshot, restore, clear, get tick() { return queue.tick; }, get pending() { return queue.size; } };
}
