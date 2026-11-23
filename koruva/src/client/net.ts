import type { ClientMsg, GameMode, ServerMsg } from "../../shared/protocol";

export type NetHandler = (msg: ServerMsg) => void;

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
  private pingTimer = 0;
  onMessage: NetHandler = () => {};
  onClose: (reason: string) => void = () => {};

  connect(code: string, hello: Extract<ClientMsg, { t: "hello" }>): Promise<void> {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws/${code}`);
      this.ws = ws;
      let opened = false;
      let settled = false;
      const connectTimer = window.setTimeout(() => {
        if (opened || settled) return;
        settled = true;
        if (this.ws === ws) this.ws = null;
        try { ws.close(4000, "connect-timeout"); } catch { /* already closed */ }
        reject(new Error("サーバーへの接続が時間内に完了しませんでした"));
      }, 30000);
      ws.onopen = () => {
        if (settled) { try { ws.close(4000, "connect-cancelled"); } catch { /* already closed */ } return; }
        opened = true;
        settled = true;
        clearTimeout(connectTimer);
        this.send(hello);
        this.pingTimer = window.setInterval(() => ws.readyState === 1 && ws.send("ping"), 25000);
        resolve();
      };
      ws.onmessage = (ev) => {
        if (typeof ev.data !== "string" || ev.data === "pong") return;
        try { this.onMessage(JSON.parse(ev.data) as ServerMsg); } catch (e) { console.error(e); }
      };
      ws.onerror = () => {
        console.error("[Koruva WS] connection error", { url: ws.url, readyState: ws.readyState });
        if (!opened && !settled) { settled = true; clearTimeout(connectTimer); reject(new Error("サーバーに接続できませんでした")); }
      };
      ws.onclose = (event) => {
        clearTimeout(connectTimer);
        clearInterval(this.pingTimer);
        console.warn("[Koruva WS] connection closed", { code: event.code, reason: event.reason, wasClean: event.wasClean });
        if (!opened && !settled) { settled = true; reject(new Error(`サーバーに接続できませんでした (close ${event.code})`)); }
        else if (opened && this.ws === ws) { this.ws = null; this.onClose("サーバーとの接続が切れました"); }
      };
    });
  }

  get connected() { return this.ws?.readyState === WebSocket.OPEN; }

  send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close() {
    const ws = this.ws;
    this.ws = null;
    clearInterval(this.pingTimer);
    ws?.close(1000);
  }
}
