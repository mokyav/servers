import type { ClientMsg, GameMode, ServerMsg } from "../../shared/protocol";

export type NetHandler = (msg: ServerMsg) => void;
export interface NetCloseInfo {
  code: number;
  reason: string;
  wasClean: boolean;
  ageMs: number;
  lastPongAgeMs: number;
}

const CONNECT_TIMEOUT_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 45_000;

export async function createRoom(mode: GameMode): Promise<{ code: string; hostToken: string }> {
  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error("ルームを作成できませんでした");
  return (await res.json()) as { code: string; hostToken: string };
}

export async function checkRoom(code: string): Promise<void> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error("ルーム情報を取得できませんでした");
  const info = (await res.json()) as { exists: boolean; players: number; max: number };
  if (!info.exists) throw new Error("そのルームコードは存在しません");
  if (info.players >= info.max) throw new Error("ルームが満員です");
}

export class Net {
  private ws: WebSocket | null = null;
  private connectTimer = 0;
  private pingTimer = 0;
  private heartbeatTimer = 0;
  onMessage: NetHandler = () => {};
  onClose: (reason: string, info?: NetCloseInfo) => void = () => {};

  private clearTimers(connect: number, ping: number, heartbeat: number) {
    if (connect) window.clearTimeout(connect);
    if (ping) window.clearInterval(ping);
    if (heartbeat) window.clearInterval(heartbeat);
    if (this.connectTimer === connect) this.connectTimer = 0;
    if (this.pingTimer === ping) this.pingTimer = 0;
    if (this.heartbeatTimer === heartbeat) this.heartbeatTimer = 0;
  }

  connect(code: string, hello: Extract<ClientMsg, { t: "hello" }>): Promise<void> {
    // A previous socket must never share timers or callbacks with a new connection.
    this.close();
    return new Promise((resolve, reject) => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws/${code}`);
      this.ws = ws;
      let opened = false;
      let settled = false;
      let openedAt = 0;
      let lastPongAt = 0;
      let connectTimer = 0, pingTimer = 0, heartbeatTimer = 0;

      const clear = () => this.clearTimers(connectTimer, pingTimer, heartbeatTimer);
      const failBeforeOpen = (error: Error) => {
        if (settled || opened) return;
        settled = true;
        clear();
        if (this.ws === ws) this.ws = null;
        try { ws.close(4000, "connect-failed"); } catch { /* already closed */ }
        reject(error);
      };

      connectTimer = window.setTimeout(() => {
        if (opened || settled) return;
        failBeforeOpen(new Error("サーバーへの接続が30秒以内に完了しませんでした"));
      }, CONNECT_TIMEOUT_MS);
      this.connectTimer = connectTimer;

      ws.onopen = () => {
        if (settled) {
          try { ws.close(4000, "connect-cancelled"); } catch { /* already closed */ }
          return;
        }
        opened = true;
        settled = true;
        openedAt = Date.now();
        lastPongAt = openedAt;
        if (connectTimer) { window.clearTimeout(connectTimer); connectTimer = 0; }
        if (this.connectTimer) this.connectTimer = 0;
        try {
          ws.send(JSON.stringify(hello));
        } catch (error) {
          if (this.ws === ws) this.ws = null;
          clear();
          try { ws.close(4000, "hello-send-failed"); } catch { /* already closed */ }
          reject(error instanceof Error ? error : new Error("接続情報を送信できませんでした"));
          return;
        }
        pingTimer = window.setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          try { ws.send("ping"); }
          catch {
            this.failHeartbeat(ws, openedAt, lastPongAt, clear);
          }
        }, HEARTBEAT_INTERVAL_MS);
        heartbeatTimer = window.setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          if (Date.now() - lastPongAt > HEARTBEAT_TIMEOUT_MS) {
            this.failHeartbeat(ws, openedAt, lastPongAt, clear);
          }
        }, HEARTBEAT_INTERVAL_MS);
        this.pingTimer = pingTimer;
        this.heartbeatTimer = heartbeatTimer;
        resolve();
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        if (event.data === "pong") {
          lastPongAt = Date.now();
          return;
        }
        try { this.onMessage(JSON.parse(event.data) as ServerMsg); }
        catch (error) { console.error("[Koruva WS] invalid server message", error); }
      };

      ws.onerror = () => {
        console.error("[Koruva WS] connection error", { url: ws.url, readyState: ws.readyState, opened });
        failBeforeOpen(new Error("サーバーに接続できませんでした"));
      };

      ws.onclose = (event) => {
        clear();
        const now = Date.now();
        const info: NetCloseInfo = {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          ageMs: openedAt ? Math.max(0, now - openedAt) : 0,
          lastPongAgeMs: lastPongAt ? Math.max(0, now - lastPongAt) : 0,
        };
        console.warn("[Koruva WS] connection closed", info);
        if (!opened && !settled) {
          settled = true;
          reject(new Error(`サーバーに接続できませんでした (close ${event.code})`));
        } else if (opened && this.ws === ws) {
          this.ws = null;
          this.onClose("サーバーとの接続が切れました", info);
        }
      };
    });
  }

  private failHeartbeat(
    ws: WebSocket,
    openedAt: number,
    lastPongAt: number,
    clear: () => void,
  ) {
    if (this.ws !== ws) return;
    const now = Date.now();
    const info: NetCloseInfo = {
      code: 4005,
      reason: "heartbeat-timeout",
      wasClean: false,
      ageMs: Math.max(0, now - openedAt),
      lastPongAgeMs: Math.max(0, now - lastPongAt),
    };
    this.ws = null;
    clear();
    try { ws.close(4005, "heartbeat-timeout"); } catch { /* already closed */ }
    console.error("[Koruva WS] heartbeat lost; scheduling room recovery", info);
    this.onClose("サーバーからの応答が45秒間ありません", info);
  }

  get connected() { return this.ws?.readyState === WebSocket.OPEN; }

  send(msg: ClientMsg): boolean {
    const ws = this.ws;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(msg));
      return true;
    } catch (error) {
      console.error("[Koruva WS] send failed", error);
      const now = Date.now();
      if (this.ws === ws) {
        this.ws = null;
        this.clearTimers(this.connectTimer, this.pingTimer, this.heartbeatTimer);
        this.onClose("サーバーへの送信に失敗しました", {
          code: 4005, reason: "send-failed", wasClean: false, ageMs: 0, lastPongAgeMs: 0,
        });
      }
      try { ws.close(4005, "send-failed"); } catch { /* already closed */ }
      return false;
    }
  }

  close() {
    const ws = this.ws;
    this.ws = null;
    this.clearTimers(this.connectTimer, this.pingTimer, this.heartbeatTimer);
    try { ws?.close(1000, "client-close"); } catch { /* already closed */ }
  }
}
