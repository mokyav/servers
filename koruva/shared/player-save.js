/**
 * Versioned player save records. The old loc:/p:/i: keys remain as
 * compatibility mirrors so deployments can roll back without losing saves.
 */
export const PLAYER_SAVE_SCHEMA_VERSION = 1;
const SAVE_PREFIX = "player-save:";
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export function playerSaveStorageKey(cid) { return `${SAVE_PREFIX}${cid}`; }

export function isPlayerSaveSnapshot(value) {
  return isRecord(value)
    && value.schemaVersion === PLAYER_SAVE_SCHEMA_VERSION
    && Number.isFinite(value.savedAt)
    && hasOwn(value, "location")
    && hasOwn(value, "vitals")
    && Array.isArray(value.inventory);
}

export function createPlayerSaveSnapshot(value = {}, savedAt = Date.now()) {
  const source = isRecord(value) ? value : {};
  const snapshot = {
    schemaVersion: PLAYER_SAVE_SCHEMA_VERSION,
    location: source.location ?? null,
    vitals: source.vitals ?? null,
    inventory: Array.isArray(source.inventory) ? source.inventory.slice() : [],
    savedAt: Number.isFinite(savedAt) ? savedAt : Date.now(),
  };
  if (Array.isArray(source.armorSlots)) snapshot.armorSlots = source.armorSlots.slice();
  if (Array.isArray(source.wear)) snapshot.wear = source.wear.slice();
  return snapshot;
}

async function readLegacy(storage, cid) {
  const location = await storage.get(`loc:${cid}`);
  const vitals = await storage.get(`p:${cid}`);
  const inventory = await storage.get(`i:${cid}`);
  const hasInventory = inventory !== undefined;
  const hasLegacy = location !== undefined || vitals !== undefined || hasInventory;
  return {
    snapshot: createPlayerSaveSnapshot({ location, vitals, inventory }),
    source: hasLegacy ? "legacy" : "empty",
    hasInventory,
  };
}

async function writeRecord(storage, cid, snapshot) {
  await storage.put(playerSaveStorageKey(cid), snapshot);
  await storage.put(`loc:${cid}`, snapshot.location);
  await storage.put(`p:${cid}`, snapshot.vitals);
  await storage.put(`i:${cid}`, snapshot.inventory);
}

export async function loadPlayerSave(storage, cid) {
  if (typeof cid !== "string" || !cid) throw new TypeError("player save requires a non-empty cid");
  return storage.transaction(async () => {
    const saved = await storage.get(playerSaveStorageKey(cid));
    if (isPlayerSaveSnapshot(saved)) {
      return { snapshot: createPlayerSaveSnapshot(saved, saved.savedAt), source: "snapshot", hasInventory: true };
    }
    return readLegacy(storage, cid);
  });
}

export async function writePlayerSave(storage, cid, value) {
  if (typeof cid !== "string" || !cid) throw new TypeError("player save requires a non-empty cid");
  const snapshot = createPlayerSaveSnapshot(value, value?.savedAt);
  await storage.transaction(() => writeRecord(storage, cid, snapshot));
  return snapshot;
}

export async function updatePlayerSave(storage, cid, patch) {
  if (typeof cid !== "string" || !cid) throw new TypeError("player save requires a non-empty cid");
  const changes = isRecord(patch) ? patch : {};
  return storage.transaction(async () => {
    const saved = await storage.get(playerSaveStorageKey(cid));
    const base = isPlayerSaveSnapshot(saved) ? saved : (await readLegacy(storage, cid)).snapshot;
    const snapshot = createPlayerSaveSnapshot({ ...base, ...changes }, Date.now());
    await writeRecord(storage, cid, snapshot);
    return snapshot;
  });
}
