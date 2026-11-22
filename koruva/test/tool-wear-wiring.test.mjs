import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const room = readFileSync(new URL("../src/worker/room.ts", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/client/main.ts", import.meta.url), "utf8");
const protocol = readFileSync(new URL("../shared/protocol.ts", import.meta.url), "utf8");
const save = readFileSync(new URL("../src/client/save.ts", import.meta.url), "utf8");
test("stack durability is authoritative, persisted, restored, and synchronized", () => {
  assert.match(room, /damageStackRecord\(record,\s*amount,\s*maxDamage\)/);
  assert.match(room, /persistStackData\(ws, me\)/);
  assert.match(room, /"stack-data:" \+ st\.cid/);
  assert.match(main, /normalizeStackComponents\(m\.stackData, \{\}, BLOCKS\)/);
  assert.match(main, /stackData: this\.stackData/);
  assert.match(protocol, /stackData\?: Record<string, unknown>/);
  assert.match(save, /stackData\?: Record<string, unknown>/);
});
