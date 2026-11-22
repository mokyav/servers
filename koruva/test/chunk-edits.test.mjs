import test from "node:test";
import assert from "node:assert/strict";
import { MAX_BLOCK_ID, NO_EDIT_U16, PersistentChunkEdits, normalizeChunkRecord } from "../shared/chunk-edits.js";
const options = { prefix: "c:", volume: 4, maxRecords: 8, noEdit: NO_EDIT_U16 };

test("chunk edits publish a cloned 16-bit record only after persistence succeeds", async () => {
  const original = new Uint16Array([10, 10, NO_EDIT_U16, NO_EDIT_U16]);
  const chunks = new Map([["0,0", original]]); let persisted;
  const writer = new PersistentChunkEdits(chunks, async (key, value) => { persisted = [key, value.slice()]; }, options);
  assert.equal(await writer.apply("0,0", 1, 4), true);
  assert.deepEqual([...original], [10, 10, NO_EDIT_U16, NO_EDIT_U16]);
  assert.deepEqual([...chunks.get("0,0")], [10, 4, NO_EDIT_U16, NO_EDIT_U16]);
  assert.deepEqual([persisted[0], [...persisted[1]]], ["c:0,0", [10, 4, NO_EDIT_U16, NO_EDIT_U16]]);
  assert.ok(persisted[1] instanceof Uint16Array);
});

test("legacy byte chunk records migrate sentinel 255 and preserve prior IDs", () => {
  const migrated = normalizeChunkRecord(new Uint8Array([7, 8, 250, 255]), 4);
  assert.ok(migrated instanceof Uint16Array);
  assert.deepEqual([...migrated], [7, 8, 250, NO_EDIT_U16]);
  assert.equal(normalizeChunkRecord(new Uint8Array(3), 4), null);
});

test("block IDs above 255 persist without truncation", async () => {
  const chunks = new Map(); let persisted;
  const writer = new PersistentChunkEdits(chunks, async (_key, value) => { persisted = value.slice(); }, options);
  assert.equal(await writer.apply("high-id", 2, 4097), true);
  assert.equal(chunks.get("high-id")[2], 4097);
  assert.equal(persisted[2], 4097);
  assert.equal(MAX_BLOCK_ID, 65534);
  assert.equal(await writer.apply("high-id", 3, NO_EDIT_U16), false);
});

test("failed write leaves the live chunk unchanged and later queued writes recover", async () => {
  const live = new Uint16Array([7, 8, NO_EDIT_U16, NO_EDIT_U16]); const chunks = new Map([["0,0", live]]); let attempts = 0;
  const writer = new PersistentChunkEdits(chunks, async () => { attempts++; if (attempts === 1) throw new Error("storage unavailable"); }, options);
  await assert.rejects(writer.apply("0,0", 0, 1), /storage unavailable/);
  assert.equal(chunks.get("0,0"), live); assert.deepEqual([...live], [7, 8, NO_EDIT_U16, NO_EDIT_U16]);
  assert.equal(await writer.apply("0,0", 1, 2), true);
  assert.deepEqual([...chunks.get("0,0")], [7, 2, NO_EDIT_U16, NO_EDIT_U16]); assert.equal(attempts, 2);
});

test("failed first write does not publish a new chunk", async () => {
  const chunks = new Map(); const writer = new PersistentChunkEdits(chunks, async () => { throw new Error("write failed"); }, options);
  await assert.rejects(writer.apply("1,-1", 2, 3), /write failed/); assert.equal(chunks.size, 0);
});

test("concurrent writes serialize without losing either edit", async () => {
  const chunks = new Map([["0,0", new Uint16Array([NO_EDIT_U16, NO_EDIT_U16, NO_EDIT_U16, NO_EDIT_U16])]]); const snapshots = [];
  const writer = new PersistentChunkEdits(chunks, async (_key, value) => { await new Promise(resolve => setTimeout(resolve, 2)); snapshots.push([...value]); }, options);
  const first = writer.apply("0,0", 0, 5), second = writer.apply("0,0", 3, 9);
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.deepEqual([...chunks.get("0,0")], [5, NO_EDIT_U16, NO_EDIT_U16, 9]);
  assert.deepEqual(snapshots, [[5, NO_EDIT_U16, NO_EDIT_U16, NO_EDIT_U16], [5, NO_EDIT_U16, NO_EDIT_U16, 9]]);
});

test("record cap and invalid inputs do not write", async () => {
  const chunks = new Map([["full", new Uint16Array(4)]]); let writes = 0;
  const writer = new PersistentChunkEdits(chunks, async () => { writes++; }, { ...options, maxRecords: 1 });
  assert.equal(await writer.apply("new", 0, 1), false); assert.equal(await writer.apply("full", 4, 1), false);
  assert.equal(await writer.apply("full", 0, -1), false); assert.equal(await writer.apply("full", 0, NO_EDIT_U16), false); assert.equal(writes, 0);
});


test("streaming edit iterator preserves negative chunk coordinates and skips sentinel cells", async () => {
  const { iterateChunkEdits } = await import("../shared/chunk-edits.js");
  const chunks = new Map([
    ["-1,2", new Uint16Array([NO_EDIT, 7, NO_EDIT, NO_EDIT, 9, NO_EDIT, NO_EDIT, NO_EDIT])],
    ["0,-1", new Uint16Array([NO_EDIT, NO_EDIT, 5, NO_EDIT, NO_EDIT, NO_EDIT, NO_EDIT, NO_EDIT])],
  ]);
  assert.deepEqual([...iterateChunkEdits(chunks, 2)], [
    [-1, 0, 2, 7],
    [-2, 1, 2, 9],
    [0, 0, -1, 5],
  ]);
});

test("streaming edit iterator rejects invalid configuration and ignores malformed records", async () => {
  const { iterateChunkEdits } = await import("../shared/chunk-edits.js");
  assert.throws(() => [...iterateChunkEdits([], 16)], /Map/);
  assert.throws(() => [...iterateChunkEdits(new Map(), 0)], /options/);
  const chunks = new Map([
    ["bad", new Uint16Array([1, 2])],
    ["1,2", new Uint16Array([NO_EDIT, 11, NO_EDIT, NO_EDIT])],
  ]);
  assert.deepEqual([...iterateChunkEdits(chunks, 2)], [[3, 0, 2, 11]]);
});
