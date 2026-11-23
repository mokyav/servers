import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const net = readFileSync(new URL("../src/client/net.ts", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/client/main.ts", import.meta.url), "utf8");
const room = readFileSync(new URL("../src/worker/room.ts", import.meta.url), "utf8");

test("WebSocket keeps a connection heartbeat and reports actionable close diagnostics", () => {
  assert.match(net, /CONNECT_TIMEOUT_MS\s*=\s*30_000/);
  assert.match(net, /HEARTBEAT_INTERVAL_MS\s*=\s*15_000/);
  assert.match(net, /HEARTBEAT_TIMEOUT_MS\s*=\s*45_000/);
  assert.match(net, /lastPongAgeMs/);
  assert.match(net, /ageMs:/);
  assert.match(net, /this\.failHeartbeat\(ws, openedAt, lastPongAt, clear\)/);
  assert.match(net, /this\.clearTimers\(this\.connectTimer, this\.pingTimer, this\.heartbeatTimer\)/);
  assert.match(net, /return false;/, "failed sends must be reported to the caller");
});

test("unexpected room disconnects retry with backoff and preserve the session", () => {
  assert.ok(main.includes("private roomSessionToken = 0"));
  assert.ok(main.includes("private roomHasConnected = false"));
  assert.ok(main.includes("private roomReconnectTask: Promise<void> | null = null"));
  assert.match(main, /Math\.min\(15_000, 1_000 \* \(2 \*\* Math\.min\(attempt, 4\)\)\)/);
  assert.ok(main.includes("await this.startRoom(code, true)"));
  assert.ok(main.includes("this.autosave(true)"));
  assert.ok(main.includes("this.resetMobileInputState()"));
  const connected = main.indexOf("this.roomHasConnected = true;");
  const syncWait = main.indexOf("const roomEntry = await done;");
  assert.ok(connected >= 0 && connected < syncWait, "recovery must cover interrupted initial synchronization too");
  assert.ok(main.includes("sessionToken !== this.roomSessionToken"), "leaving or starting a new room must cancel stale retries");
  assert.ok(main.includes("this.backToTitle(this.kickMsg || reason)"), "explicit server refusal or kick must not loop forever");
});

test("room synchronization timeout measures inactivity rather than total world transfer duration", () => {
  assert.ok(main.includes("const refreshSyncWatchdog = () =>"));
  assert.ok(main.includes("timer = window.setTimeout"));
  assert.ok(main.includes("}, 60_000);"));
  assert.ok(main.includes("if (!settled) refreshSyncWatchdog();"));
  assert.ok(main.includes("if (m.done) resolveOnce();"));
  assert.ok(main.includes("syncWait.reject?.(new Error(reason));"));
});

test("durable-object game ticks are batched and expose slow alarm diagnostics", () => {
  assert.ok(room.includes("await storage.setAlarm(Date.now() + 100)"));
  assert.ok(room.includes("const ticks = Math.max(1, Math.min(1200"));
  assert.ok(room.includes('console.warn("[Koruva DO] slow room alarm"'));
  assert.ok(room.includes("elapsedMs,"));
  assert.ok(room.includes("cachedMobChunks: this.mobChunkCache.size"));
});

test("server logs websocket close codes and completes valid close handshakes", () => {
  assert.ok(room.includes("webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean)"));
  assert.ok(room.includes('console.info("[Koruva DO] websocket closed"'));
  assert.ok(room.includes("code,"));
  assert.ok(room.includes("wasClean,"));
  assert.ok(room.includes("ws.close(code, reason)"));
  assert.ok(room.includes("webSocketError(ws: WebSocket, error?: unknown)"));
});


test("initial-sync disconnect and slow WebSocket messages are recoverable and diagnosable", () => {
  assert.ok(main.includes("if (!reconnecting && this.roomHasConnected && roomSessionToken === this.roomSessionToken && !this.roomReconnectTask)"));
  assert.ok(main.includes("await this.roomReconnectTask;"));
  assert.ok(room.includes("async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void>"));
  assert.ok(room.includes("private async handleWebSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void>"));
  assert.ok(room.includes('console.warn("[Koruva DO] slow websocket message"'));
  assert.ok(room.includes("type: messageType,"));
  assert.ok(room.includes("elapsedMs,"));
  assert.ok(room.includes("cachedMobChunks: this.mobChunkCache.size"));
});
