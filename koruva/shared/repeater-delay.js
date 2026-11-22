/** Deterministic per-repeater delay queue. Time is expressed in redstone ticks (1-4). */
export const MIN_REPEATER_DELAY_TICKS = 1;
export const MAX_REPEATER_DELAY_TICKS = 4;
export const DEFAULT_MAX_PENDING_REPEATERS = 4096;
function validateId(id) { if (typeof id !== "string" || id.length < 1 || id.length > 128) throw new TypeError("repeater id must be a 1-128 character string"); }
function validateTick(tick, label = "tick") { if (!Number.isSafeInteger(tick) || tick < 0) throw new RangeError(`${label} must be a non-negative safe integer`); }
function validatePower(powered) { if (typeof powered !== "boolean") throw new TypeError("repeater power must be boolean"); }
function validateDelay(delayTicks) { if (!Number.isSafeInteger(delayTicks) || delayTicks < 1 || delayTicks > 4) throw new RangeError("repeater delay must be an integer from 1 to 4 ticks"); }
/** Bounded deterministic transition queue. The world's tick loop must call advance(); state is not persisted here. */
export function createRepeaterDelayController({ maxPending = DEFAULT_MAX_PENDING_REPEATERS } = {}) {
  if (!Number.isSafeInteger(maxPending) || maxPending < 0) throw new RangeError("maxPending must be a non-negative safe integer");
  const outputs = new Map(), pending = new Map(); let lastTick = 0;
  return {
    get size() { return pending.size; }, get tick() { return lastTick; },
    getOutput(id) { validateId(id); return outputs.get(id) ?? false; },
    initialize(id, powered) { validateId(id); validatePower(powered); if (pending.has(id)) throw new Error("cannot initialize a repeater with a pending transition"); outputs.set(id, powered); },
    schedule(id, inputPowered, delayTicks, currentTick) {
      validateId(id); validatePower(inputPowered); validateDelay(delayTicks); validateTick(currentTick, "currentTick");
      if (currentTick < lastTick) throw new RangeError("currentTick cannot move backwards"); lastTick = currentTick;
      const current = outputs.get(id) ?? false;
      if (inputPowered === current) { pending.delete(id); return true; }
      if (!pending.has(id) && pending.size >= maxPending) return false;
      const prior = pending.get(id);
      if (prior?.powered === inputPowered) return true;
      pending.set(id, { id, powered: inputPowered, dueTick: currentTick + delayTicks }); return true;
    },
    advance(tick, limit = maxPending) {
      validateTick(tick); if (tick < lastTick) throw new RangeError("tick cannot move backwards");
      if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError("limit must be a non-negative safe integer"); lastTick = tick;
      const due = [...pending.values()].filter(e => e.dueTick <= tick).sort((a,b) => a.dueTick - b.dueTick || a.id.localeCompare(b.id)).slice(0, limit);
      for (const event of due) { if (pending.get(event.id) !== event) continue; pending.delete(event.id); outputs.set(event.id, event.powered); }
      return due.map(({id,powered,dueTick}) => ({id,powered,dueTick}));
    },
    cancel(id) { validateId(id); return pending.delete(id); },
    remove(id) { validateId(id); const hadPending = pending.delete(id); const hadOutput = outputs.delete(id); return hadPending || hadOutput; },
    snapshot() { return { tick: lastTick, outputs: [...outputs.entries()], pending: [...pending.values()].map(e => ({ ...e })) }; },
    restore(snapshot) {
      if (!snapshot || typeof snapshot !== "object") throw new TypeError("snapshot must be an object");
      validateTick(snapshot.tick, "snapshot tick");
      if (!Array.isArray(snapshot.outputs) || !Array.isArray(snapshot.pending) || snapshot.pending.length > maxPending) throw new RangeError("invalid repeater snapshot");
      const nextOutputs = new Map(), nextPending = new Map();
      for (const entry of snapshot.outputs) {
        if (!Array.isArray(entry) || entry.length !== 2) throw new TypeError("invalid repeater output snapshot");
        const [id, powered] = entry; validateId(id); validatePower(powered);
        if (nextOutputs.has(id)) throw new TypeError("duplicate repeater output snapshot id"); nextOutputs.set(id, powered);
      }
      for (const event of snapshot.pending) {
        if (!event || typeof event !== "object") throw new TypeError("invalid repeater transition snapshot");
        validateId(event.id); validatePower(event.powered); validateTick(event.dueTick, "dueTick");
        if (nextPending.has(event.id)) throw new TypeError("duplicate repeater transition snapshot id");
        nextPending.set(event.id, { id: event.id, powered: event.powered, dueTick: event.dueTick });
      }
      outputs.clear(); for (const [id, value] of nextOutputs) outputs.set(id, value);
      pending.clear(); for (const [id, event] of nextPending) pending.set(id, event); lastTick = snapshot.tick;
    },
    clear() { pending.clear(); outputs.clear(); lastTick = 0; },
  };
}
