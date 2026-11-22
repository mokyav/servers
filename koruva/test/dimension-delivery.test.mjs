import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const room = read("../src/worker/room.ts");
const net = read("../src/client/net.ts");
const main = read("../src/client/main.ts");
const protocol = read("../shared/protocol.ts");

test("room edits are streamed in bounded progress batches instead of one flattened array", () => {
  assert.match(room, /iterateChunkEditBatches\(/);
  assert.match(room, /private async sendDimensionEdits\(/);
  assert.match(room, /await this\.sendDimensionEdits\(ws, me\.dimensionId\)/);
  assert.match(room, /await this\.sendDimensionEdits\(ws, target\)/);
  assert.match(room, /await new Promise<void>\(\(resolve\) => setTimeout\(resolve, 0\)\)/);
  assert.doesNotMatch(room, /this\.allEdits\(/);
  assert.match(protocol, /editCount\?: number/);
});

test("initial room streaming and dimension transfer share one worldgen version normalizer", () => {
  assert.match(room, /worldgenVersion: normalizeWorldgenVersion\(this\.meta\.worldgenVersion \?\? LEGACY_WORLDGEN_VERSION\)/);
  assert.match(room, /normalizeWorldgenVersion\(this\.meta\?\.worldgenVersion \?\? LEGACY_WORLDGEN_VERSION\)/);
  assert.doesNotMatch(room, /worldgenVersion === WORLDGEN_VERSION \? WORLDGEN_VERSION : LEGACY_WORLDGEN_VERSION/);
});

test("WebSocket opening has a finite timeout and ping heartbeat remains enabled", () => {
  assert.match(net, /connectionTimer = window\.setTimeout\(/);
  assert.match(net, /}, 15000\)/);
  assert.match(net, /window\.setInterval\([\s\S]*?ws\.send\("ping"\)[\s\S]*?25000\)/);
  assert.match(room, /setWebSocketAutoResponse\(new WebSocketRequestResponsePair\("ping", "pong"\)\)/);
  assert.match(net, /ws\.send\(JSON\.stringify\(hello\)\)/);
});

test("room initialization timeout is reset by transfer progress and close rejects immediately", () => {
  assert.match(main, /let touchProgress: \(\) => void/);
  assert.match(main, /progressTimer = window\.setTimeout\([\s\S]*?60000\)/);
  assert.match(main, /if \(m\.t === "init"\) \{[\s\S]*?touchProgress\(\)/);
  assert.match(main, /else if \(m\.t === "edits" && gotInit\) \{\s*touchProgress\(\)/);
  assert.match(main, /this\.net\.onClose = \(reason\) => \{\s*if \(!doneSettled\) failDone/);
  assert.doesNotMatch(main, /ルームの読み込みがタイムアウトしました", 20000/);
});

test("dimension transfer trusts the server's target-world safe arrival position", () => {
  const start = main.indexOf('      case "dimension": {');
  const end = main.indexOf('      case "join":', start);
  assert.ok(start >= 0 && end > start, "dimension message handler exists");
  const handler = main.slice(start, end);
  assert.match(handler, /const pos = \{ x: m\.p\[0\], y: m\.p\[1\], z: m\.p\[2\] \}/);
  assert.doesNotMatch(handler, /safeDimensionSpawn/);
});


test("post-join dimension edits are applied by the normal server-message handler", () => {
  const start = main.indexOf("  onServerMsg(m: ServerMsg) {");
  const end = main.indexOf("\n  roomTime(): number", start);
  const handler = main.slice(start, end > start ? end : undefined);
  assert.match(handler, /case "edits": \{[\s\S]*?this\.world\.importEdits\(m\.list\)/);
});
