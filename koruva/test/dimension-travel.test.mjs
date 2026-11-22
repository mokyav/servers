import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findSafeSpawn } from "../shared/dimensions.js";

function fakeWorld(getBlock) {
  const loaded = new Set();
  return {
    loaded,
    ensureChunk(cx, cz) { loaded.add(`${cx},${cz}`); },
    get(x, y, z) { return getBlock(x, y, z); },
  };
}

test("safe spawn is centered above solid ground and loads the target chunk", () => {
  const world = fakeWorld((x, y, z) => y === 9 ? 3 : 0);
  const spawn = findSafeSpawn(world, { x: 2.2, z: -1.1 }, { isSolid: (id) => id === 3 });
  assert.deepEqual(spawn, { x: 2.5, y: 10, z: -1.5 });
  assert.ok(world.loaded.has("0,-1"));
});

test("safe spawn rejects hazard blocks and searches nearby deterministically", () => {
  const world = fakeWorld((x, y, z) => {
    if (y === 9 && x === 0 && z === 0) return 3;
    if (y === 10 && x === 0 && z === 0) return 69; // hazard occupying the feet cell
    if (y === 9 && x === 1 && z === 0) return 3;
    return 0;
  });
  const opts = { isSolid: (id) => id === 3, isHazard: (id) => id === 69, searchRadius: 2 };
  assert.deepEqual(findSafeSpawn(world, { x: 0, z: 0 }, opts), { x: 1.5, y: 10, z: 0.5 });
});

test("safe spawn returns null if there is no two-block clearance", () => {
  const world = fakeWorld(() => 3);
  assert.equal(findSafeSpawn(world, { x: 0, z: 0 }, { isSolid: (id) => id === 3, searchRadius: 0 }), null);
});

const roomSource = readFileSync(new URL("../src/worker/room.ts", import.meta.url), "utf8");

test("initial room snapshot only includes players in the joining dimension", () => {
  assert.match(roomSource, /if \(o\.joined \&\& o\.dimensionId === me\.dimensionId\) others\.push\(this\.info2\(o\)\);/);
});

test("room reconnect restores a validated durable location before using client fallback", () => {
  const loadAt = roomSource.indexOf('loadPlayerSave(this.ctx.storage, me.cid)');
  const snapshotAt = roomSource.indexOf('const savedLocation = saveSnapshot?.location');
  const restoredAt = roomSource.indexOf('const restoredLocation = normalizePlayerLocation(savedLocation)');
  const fallbackAt = roomSource.indexOf('if (!restoredLocation)');
  assert.ok(loadAt >= 0 && snapshotAt > loadAt && restoredAt > snapshotAt && fallbackAt > restoredAt);
  assert.match(roomSource, /me\.dimensionId = restoredLocation\.dimensionId/);
  assert.match(roomSource, /await this\.persistPlayerLocation\(me\)/);
  assert.match(roomSource, /updatePlayerSave\(this\.ctx\.storage, st\.cid, \{ location \}\)/);
});


test("online drops are dimension-scoped for snapshots, spawning, pickup, and events", () => {
  assert.match(roomSource, /liveDrops\(me\.dimensionId\)/);
  assert.match(roomSource, /liveDrops\(target\)/);
  assert.match(roomSource, /spawnDrop\(x, y, z, drop\.itemId, me\.dimensionId, drop\.count\)/);
  assert.match(roomSource, /if \(dr\.dimensionId !== me\.dimensionId\) return/);
  assert.match(roomSource, /broadcastDimension\(\{ t: "drop", eid, x, y, z, b, count: stackCount \}, normalizedDimension\)/);
});
