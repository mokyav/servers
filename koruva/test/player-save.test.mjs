import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPlayerSaveSnapshot, loadPlayerSave, playerSaveStorageKey, updatePlayerSave, writePlayerSave } from "../shared/player-save.js";

class MemoryStorage {
  constructor(entries = []) { this.data = new Map(entries); this.failOnKey = null; }
  async get(key) { return this.data.get(key); }
  async put(key, value) {
    if (key === this.failOnKey) throw new Error(`synthetic write failure at ${key}`);
    this.data.set(key, value);
  }
  async transaction(callback) {
    const before = this.data;
    this.data = new Map(before);
    try { return await callback(); }
    catch (error) { this.data = before; throw error; }
  }
}
const legacy = (cid = "old") => [
  [`loc:${cid}`, { version: 1, dimensionId: "minecraft:the_nether", p: [4, 70, -2], r: [0.5, 0.2] }],
  [`p:${cid}`, { health: 17, food: 16, gameMode: "survival" }],
  [`i:${cid}`, [0, 3, 1]],
];

test("legacy location, vitals, and inventory load and migrate to schema v1", async () => {
  const storage = new MemoryStorage(legacy());
  const loaded = await loadPlayerSave(storage, "old");
  assert.equal(loaded.source, "legacy");
  assert.equal(loaded.hasInventory, true);
  assert.equal(loaded.snapshot.location.dimensionId, "minecraft:the_nether");
  assert.deepEqual(loaded.snapshot.inventory, [0, 3, 1]);
  const saved = await writePlayerSave(storage, "old", loaded.snapshot);
  assert.equal(saved.schemaVersion, 1);
  assert.equal(storage.data.get(playerSaveStorageKey("old")).schemaVersion, 1);
  assert.deepEqual(storage.data.get("i:old"), [0, 3, 1]);
});

test("a malformed snapshot falls back to legacy state; a valid snapshot wins over stale mirrors", async () => {
  const entries = new Map(legacy("restore"));
  entries.set(playerSaveStorageKey("restore"), { schemaVersion: 1, savedAt: 1, location: null, vitals: null, inventory: "corrupt" });
  const storage = new MemoryStorage(entries);
  const recovered = await loadPlayerSave(storage, "restore");
  assert.equal(recovered.source, "legacy");
  assert.deepEqual(recovered.snapshot.inventory, [0, 3, 1]);
  await writePlayerSave(storage, "restore", createPlayerSaveSnapshot({
    location: { version: 1, dimensionId: "minecraft:the_end", p: [8, 90, 1], r: [0, 0] },
    vitals: { health: 9 }, inventory: [5],
  }, 123));
  storage.data.set("i:restore", [99]);
  const loaded = await loadPlayerSave(storage, "restore");
  assert.equal(loaded.source, "snapshot");
  assert.deepEqual(loaded.snapshot.inventory, [5]);
});

test("component updates preserve other snapshot fields and refresh compatibility mirrors", async () => {
  const storage = new MemoryStorage();
  const initial = createPlayerSaveSnapshot({
    location: { version: 1, dimensionId: "minecraft:overworld", p: [1, 2, 3], r: [0, 0] },
    vitals: { health: 20 }, inventory: [1, 2],
  }, 100);
  await writePlayerSave(storage, "patch", initial);
  const next = await updatePlayerSave(storage, "patch", { inventory: [7, 8] });
  assert.deepEqual(next.location, initial.location);
  assert.deepEqual(next.vitals, initial.vitals);
  assert.deepEqual(next.inventory, [7, 8]);
  assert.deepEqual(storage.data.get("i:patch"), [7, 8]);
  assert.deepEqual(storage.data.get("p:patch"), initial.vitals);
});

test("a failed compatibility-key write rolls back the snapshot and all mirrors", async () => {
  const storage = new MemoryStorage(legacy("rollback"));
  const before = new Map(storage.data);
  storage.failOnKey = "p:rollback";
  await assert.rejects(updatePlayerSave(storage, "rollback", { inventory: [42] }), /synthetic write failure/);
  assert.deepEqual(storage.data, before);
  assert.equal(storage.data.has(playerSaveStorageKey("rollback")), false);
});

test("Room join and component persistence use the versioned save helper", () => {
  const room = readFileSync(new URL("../src/worker/room.ts", import.meta.url), "utf8");
  assert.match(room, /loadPlayerSave\(this\.ctx\.storage, me\.cid\)/);
  assert.match(room, /writePlayerSave\(this\.ctx\.storage, st\.cid, snapshot\)/);
  assert.match(room, /updatePlayerSave\(this\.ctx\.storage, st\.cid, \{ inventory: st\.counts \}\)/);
  assert.match(room, /updatePlayerSave\(this\.ctx\.storage, st\.cid, \{ vitals: st\.vitals \}\)/);
  assert.doesNotMatch(room, /ctx\.storage\.get<unknown>\("loc:" \+ me\.cid\)/);
});


test("room re-entry restores saved dimension and checkpoints live movement", () => {
  const room = readFileSync(new URL("../src/worker/room.ts", import.meta.url), "utf8");
  const main = readFileSync(new URL("../src/client/main.ts", import.meta.url), "utf8");
  const save = readFileSync(new URL("../src/client/save.ts", import.meta.url), "utf8");
  assert.match(save, /dimensionId\?: string/);
  assert.match(main, /dimensionId: this\.world\.dimensionId/);
  assert.match(main, /dimensionId: saved\?\.dimensionId/);
  assert.match(room, /isDimensionId\(msg\.dimensionId\)/);
  assert.match(room, /persistPlayerLocation\(me, 2000\)/);
  assert.match(room, /restoredLocation/);
});

test("room item drops validate the selected hotbar stack and persist inventory with the drop", () => {
  const room = readFileSync(new URL("../src/worker/room.ts", import.meta.url), "utf8");
  const protocol = readFileSync(new URL("../shared/protocol.ts", import.meta.url), "utf8");
  assert.match(protocol, /t: "drop-item"/);
  assert.match(room, /case "drop-item"/);
  assert.match(room, /me\.stackData\[slotKey\]/);
  assert.match(room, /clampDropCount\(msg\.count, available\)/);
  assert.match(room, /dropInventoryStack\(ws, me, itemId, count, slotKey, slotCount\)/);
  assert.match(room, /txn\.put\("drops"/);
  assert.match(room, /txn\.put\("player-save:" \+ st\.cid, nextSave\)/);
  assert.match(room, /txn\.put\("stack-data:" \+ st\.cid, nextStackData\)/);
});

test("wear is cloned and survives player-save updates",async()=>{const storage=new MemoryStorage(),original=createPlayerSaveSnapshot({inventory:[0,1],wear:[0,58]},100);await writePlayerSave(storage,"wear",original);original.wear[1]=1;assert.deepEqual((await loadPlayerSave(storage,"wear")).snapshot.wear,[0,58]);await updatePlayerSave(storage,"wear",{wear:[0,57]});assert.deepEqual((await loadPlayerSave(storage,"wear")).snapshot.wear,[0,57])});
