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
  private connectTimer = 0;
  onMessage: NetHandler = () => {};
  onClose: (reason: string) => void = () => {};

  connect(code: string, hello: Extract<ClientMsg, { t: "hello" }>): Promise<void> {
    clearInterval(this.pingTimer);
    clearTimeout(this.connectTimer);
    this.ws?.close(1000, "replaced");
    return new Promise((resolve, reject) => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      let ws: WebSocket;
      try {
        ws = new WebSocket(`${proto}://${location.host}/ws/${code}`);
      } catch {
        reject(new Error("サーバーに接続できませんでした"));
        return;
      }
      this.ws = ws;
      let opened = false;
      let settled = false;

      const failBeforeOpen = (message: string) => {
        if (settled || opened) return;
        settled = true;
        clearTimeout(this.connectTimer);
        if (this.ws === ws) this.ws = null;
        try { ws.close(); } catch { /* already closed */ }
        reject(new Error(message));
      };

      this.connectTimer = window.setTimeout(() => {
        failBeforeOpen("サーバーへの接続がタイムアウトしました（15秒）");
      }, 15000);

      ws.onopen = () => {
        if (settled) return;
        opened = true;
        clearTimeout(this.connectTimer);
        try {
          // Send the handshake on this exact socket and report synchronous send failures.
          ws.send(JSON.stringify(hello));
        } catch {
          settled = true;
          if (this.ws === ws) this.ws = null;
          try { ws.close(); } catch { /* already closed */ }
          reject(new Error("サーバーへ入室情報を送信できませんでした"));
          return;
        }
        this.pingTimer = window.setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          try { ws.send("ping"); } catch { /* onclose will report the disconnect */ }
        }, 25000);
        resolve();
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data !== "string" || ev.data === "pong") return;
        try {
          this.onMessage(JSON.parse(ev.data) as ServerMsg);
        } catch (error) {
          console.error("[Koruva WS] invalid server message", error);
        }
      };

      ws.onerror = () => {
        console.error("[Koruva WS] connection error", { url: ws.url, readyState: ws.readyState });
        if (!opened) failBeforeOpen("サーバーに接続できませんでした");
      };

      ws.onclose = (event) => {
        clearTimeout(this.connectTimer);
        clearInterval(this.pingTimer);
        console.warn("[Koruva WS] connection closed", { code: event.code, reason: event.reason, wasClean: event.wasClean });
        if (!opened) {
          failBeforeOpen(`サーバーに接続できませんでした (close ${event.code})`);
        } else if (this.ws === ws) {
          this.ws = null;
          this.onClose("サーバーとの接続が切れました");
        }
      };
    });
  }

  get connected() { return this.ws?.readyState === WebSocket.OPEN; }

  send(msg: ClientMsg): boolean {
    const ws = this.ws;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(msg));
      return true;
    } catch (error) {
      console.warn("[Koruva WS] message send failed", error);
      return false;
    }
  }

  close() {
    const ws = this.ws;
    this.ws = null;
    clearTimeout(this.connectTimer);
    clearInterval(this.pingTimer);
    ws?.close(1000);
  }
}
