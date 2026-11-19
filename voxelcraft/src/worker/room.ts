import { DurableObject } from "cloudflare:workers";
import {
  CHUNK_SIZE, CHUNK_VOLUME, MAX_CHUNK_RECORDS, MAX_PLAYERS, NO_EDIT, SERVER_REACH,
} from "../../shared/constants";
import { chunkCoord, localIndex } from "../../shared/coords";
import {
  DEFAULT_SKIN, type ClientMsg, type PlayerInfo, type Rot, type ServerMsg, type Skin, type Vec3,
} from "../../shared/protocol";
import {
  isValidSet, sanitizeChat, sanitizeName, sanitizeRot, sanitizeSkin, sanitizeVec3,
} from "../../shared/validate";
import type { Env } from "./env";

interface Meta {
  code: string;
  seed: number;
  createdAt: number;
}

interface Bucket {
  tokens: number;
  last: number;
}

interface PlayerState {
  id: string;
  name: string;
  skin: Skin;
  p: Vec3;
  r: Rot;
  joined: boolean;
  setB: Bucket;
  chatB: Bucket;
}

const EDIT_BATCH = 3000;

/**
 * 1ルーム = 1 Durable Object。
 * - WebSocket Hibernation API を使用(誰も操作していない間は課金対象外)
 * - ワールドは「シードから決定的に生成される地形 + 編集差分」。差分だけをチャンク単位で
 *   Durable Object Storage(SQLite バックエンド)に永続保存する。
 */
export class Room extends DurableObject<Env> {
  private meta: Meta | null = null;
  /** key "cx,cz" -> Uint8Array(16384)。255 = 未編集、それ以外 = ブロックID(0=空気) */
  private chunks = new Map<string, Uint8Array>();
  private mem = new Map<WebSocket, PlayerState>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    ctx.blockConcurrencyWhile(async () => {
      this.meta = (await ctx.storage.get<Meta>("meta")) ?? null;
      if (this.meta) {
        const all = await ctx.storage.list<Uint8Array>({ prefix: "c:" });
        for (const [k, v] of all) this.chunks.set(k.slice(2), v);
      }
    });
  }

  // ---- RPC ----
  async create(code: string, seed: number): Promise<boolean> {
    if (this.meta) return false;
    this.meta = { code, seed, createdAt: Date.now() };
    await this.ctx.storage.put("meta", this.meta);
    return true;
  }

  async info(): Promise<{ exists: boolean; players: number; max: number }> {
    return {
      exists: !!this.meta,
      players: this.ctx.getWebSockets().length,
      max: MAX_PLAYERS,
    };
  }

  // ---- WebSocket ----
  async fetch(request: Request): Promise<Response> {
    if (!this.meta) return new Response("room not found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    if (this.ctx.getWebSockets().length >= MAX_PLAYERS) {
      return new Response("room full", { status: 409 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const now = Date.now();
    const st: PlayerState = {
      id: crypto.randomUUID().slice(0, 8),
      name: "",
      skin: DEFAULT_SKIN,
      p: [0, 40, 0],
      r: [0, 0],
      joined: false,
      setB: { tokens: 30, last: now },
      chatB: { tokens: 5, last: now },
    };
    server.serializeAttachment(st);
    this.mem.set(server, st);
    return new Response(null, { status: 101, webSocket: client });
  }

  private player(ws: WebSocket): PlayerState {
    let p = this.mem.get(ws);
    if (!p) {
      const a = ws.deserializeAttachment() as PlayerState | null;
      p = a ?? {
        id: crypto.randomUUID().slice(0, 8), name: "Player", skin: DEFAULT_SKIN, p: [0, 40, 0], r: [0, 0],
        joined: false, setB: { tokens: 30, last: Date.now() }, chatB: { tokens: 5, last: Date.now() },
      };
      this.mem.set(ws, p);
    }
    return p;
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== "string" || raw.length > 4096 || !this.meta) return;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const me = this.player(ws);
    if (!msg || typeof msg !== "object") return;

    if (msg.t === "hello") {
      if (me.joined) return;
      me.name = sanitizeName(msg.name);
      me.skin = sanitizeSkin(msg.skin);
      me.p = sanitizeVec3(msg.p, [0, 40, 0]);
      me.r = sanitizeRot(msg.r, [0, 0]);
      me.joined = true;
      ws.serializeAttachment(me);

      const edits = this.allEdits();
      const others: PlayerInfo[] = [];
      for (const s of this.ctx.getWebSockets()) {
        if (s === ws) continue;
        const o = this.player(s);
        if (o.joined) others.push(this.info2(o));
      }
      this.send(ws, {
        t: "init", id: me.id, code: this.meta.code, seed: this.meta.seed,
        now: Date.now(), t0: this.meta.createdAt, players: others, editCount: edits.length / 4,
      });
      const step = EDIT_BATCH * 4;
      if (edits.length === 0) {
        this.send(ws, { t: "edits", list: [], done: true });
      } else {
        for (let i = 0; i < edits.length; i += step) {
          this.send(ws, { t: "edits", list: edits.slice(i, i + step), done: i + step >= edits.length });
        }
      }
      this.broadcast({ t: "join", player: this.info2(me) }, ws);
      return;
    }

    if (!me.joined) return;

    switch (msg.t) {
      case "pos": {
        me.p = sanitizeVec3(msg.p, me.p);
        me.r = sanitizeRot(msg.r, me.r);
        this.broadcast({ t: "pos", id: me.id, p: me.p, r: me.r }, ws);
        return;
      }
      case "set": {
        if (!this.take(me.setB, 30, 20)) return;
        const { x, y, z, b } = msg;
        if (!isValidSet(x, y, z, b)) return;
        const dx = x + 0.5 - me.p[0], dy = y + 0.5 - (me.p[1] + 1.6), dz = z + 0.5 - me.p[2];
        if (dx * dx + dy * dy + dz * dz > SERVER_REACH * SERVER_REACH) {
          this.send(ws, { t: "reject", x, y, z });
          return;
        }
        const ok = await this.applyEdit(x, y, z, b);
        if (!ok) {
          this.send(ws, { t: "reject", x, y, z });
          return;
        }
        this.broadcast({ t: "set", x, y, z, b, id: me.id });
        return;
      }
      case "chat": {
        if (!this.take(me.chatB, 5, 1)) return;
        const text = sanitizeChat(msg.text);
        if (!text) return;
        this.broadcast({ t: "chat", id: me.id, name: me.name, text });
        return;
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.leave(ws);
    try { ws.close(1000, "bye"); } catch { /* already closed */ }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.leave(ws);
  }

  // ---- helpers ----
  private leave(ws: WebSocket) {
    const me = this.mem.get(ws) ?? (ws.deserializeAttachment() as PlayerState | null);
    this.mem.delete(ws);
    if (me?.joined) this.broadcast({ t: "leave", id: me.id, name: me.name }, ws);
  }

  private info2(p: PlayerState): PlayerInfo {
    return { id: p.id, name: p.name, skin: p.skin, p: p.p, r: p.r };
  }

  private send(ws: WebSocket, msg: ServerMsg) {
    try { ws.send(JSON.stringify(msg)); } catch { /* closed */ }
  }

  private broadcast(msg: ServerMsg, except?: WebSocket) {
    const data = JSON.stringify(msg);
    for (const s of this.ctx.getWebSockets()) {
      if (s === except) continue;
      if (!this.player(s).joined) continue;
      try { s.send(data); } catch { /* closed */ }
    }
  }

  private take(b: Bucket, capacity: number, perSec: number): boolean {
    const now = Date.now();
    b.tokens = Math.min(capacity, b.tokens + ((now - b.last) / 1000) * perSec);
    b.last = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  private async applyEdit(x: number, y: number, z: number, b: number): Promise<boolean> {
    const key = `${chunkCoord(x)},${chunkCoord(z)}`;
    let arr = this.chunks.get(key);
    if (!arr) {
      if (this.chunks.size >= MAX_CHUNK_RECORDS) return false;
      arr = new Uint8Array(CHUNK_VOLUME).fill(NO_EDIT);
      this.chunks.set(key, arr);
    }
    arr[localIndex(x, y, z)] = b;
    await this.ctx.storage.put("c:" + key, arr);
    return true;
  }

  private allEdits(): number[] {
    const out: number[] = [];
    for (const [key, arr] of this.chunks) {
      const [cx, cz] = key.split(",").map(Number);
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] === NO_EDIT) continue;
        out.push(cx * CHUNK_SIZE + (i & 15), i >> 8, cz * CHUNK_SIZE + ((i >> 4) & 15), arr[i]);
      }
    }
    return out;
  }
}
