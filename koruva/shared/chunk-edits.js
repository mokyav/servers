/**
 * Chunk edits use 16-bit cells so Java Edition block/state registries can grow
 * beyond 255 IDs. Legacy Uint8Array records used 255 as the empty-cell marker.
 */
export const MAX_BLOCK_ID = 65534;
export const NO_EDIT_U16 = 65535;

/** Convert an old byte record or validate a current word record. */
export function normalizeChunkRecord(record, volume, noEdit = NO_EDIT_U16) {
  if (!Number.isSafeInteger(volume) || volume <= 0 || !Number.isInteger(noEdit) || noEdit < 1 || noEdit > NO_EDIT_U16) return null;
  if (record instanceof Uint16Array) return record.length === volume ? record : null;
  if (!(record instanceof Uint8Array) || record.length !== volume) return null;
  const migrated = new Uint16Array(volume);
  for (let i = 0; i < volume; i++) migrated[i] = record[i] === 255 ? noEdit : record[i];
  return migrated;
}

/** Durable chunk edit writer: persist a cloned record before publishing it to live memory. */
export class PersistentChunkEdits {
  constructor(chunks, persist, options) {
    if (!(chunks instanceof Map) || typeof persist !== "function") throw new TypeError("invalid chunk writer dependencies");
    const { prefix, volume, maxRecords, noEdit = NO_EDIT_U16 } = options ?? {};
    if (typeof prefix !== "string" || !Number.isSafeInteger(volume) || volume <= 0 ||
        !Number.isSafeInteger(maxRecords) || maxRecords < 0 || !Number.isInteger(noEdit) || noEdit < 1 || noEdit > NO_EDIT_U16) {
      throw new TypeError("invalid chunk writer options");
    }
    this.chunks = chunks;
    this.persist = persist;
    this.prefix = prefix;
    this.volume = volume;
    this.maxRecords = maxRecords;
    this.noEdit = noEdit;
    this.queue = Promise.resolve();
  }

  apply(key, index, value) {
    if (typeof key !== "string" || !key || !Number.isSafeInteger(index) || index < 0 || index >= this.volume ||
        !Number.isInteger(value) || value < 0 || value >= this.noEdit) return Promise.resolve(false);
    const commit = async () => {
      const current = this.chunks.get(key);
      if (!current && this.chunks.size >= this.maxRecords) return false;
      const normalized = current ? normalizeChunkRecord(current, this.volume, this.noEdit) : null;
      if (current && !normalized) return false;
      const next = normalized ? normalized.slice() : new Uint16Array(this.volume).fill(this.noEdit);
      next[index] = value;
      // Publish only after Durable Object storage confirms the write.
      await this.persist(this.prefix + key, next);
      this.chunks.set(key, next);
      return true;
    };
    const task = this.queue.then(commit, commit);
    this.queue = task.then(() => undefined, () => undefined);
    return task;
  }
}
