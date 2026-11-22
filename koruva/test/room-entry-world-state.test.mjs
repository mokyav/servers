import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("room init carries the persisted dimension and player transform", () => {
  const protocol = read("../shared/protocol.ts");
  const room = read("../src/worker/room.ts");
  const main = read("../src/client/main.ts");

  assert.match(protocol, /t: "init";[^\n]*dimensionId\?: string; p\?: Vec3; r\?: Rot;/);
  assert.match(room, /t: "init", id: me\.id,[\s\S]*?dimensionId: me\.dimensionId, p: \[\.\.\.me\.p\], r: \[\.\.\.me\.r\]/);
  assert.match(main, /this\.world\.reset\(m\.seed, normalizeWorldgenVersion\(m\.worldgenVersion \?\? LEGACY_WORLDGEN_VERSION\), initDimensionId\)/);
  assert.match(main, /roomEntryPosition = m\.p && m\.p\.every/);

  const localRestore = main.indexOf("if (saved) this.applyPlayerSave(saved, true)");
  const serverRestore = main.indexOf("if (roomEntryPosition) {", localRestore);
  assert.ok(localRestore >= 0 && serverRestore > localRestore,
    "server position must be applied after local save/spawn restoration");
  assert.match(main.slice(serverRestore), /this\.body = \{ x, y, z, vx: 0, vy: 0, vz: 0, onGround: false \}/);
});
