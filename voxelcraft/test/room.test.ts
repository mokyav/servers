// Durable Object (Room) のロジックを、Cloudflare ランタイムの簡易モックで検証する
const OrigResponse = Response;
(globalThis as any).Response = class extends OrigResponse {
  webSocket: any;
  constructor(b?: any, init?: any) {
    if (init?.status === 101) { super(null, { status: 200 }); Object.defineProperty(this, "status", { value: 101 }); this.webSocket = init.webSocket; }
    else super(b, init);
  }
};
class FakeSocket {
  inbox: any[] = []; att: any = null; closed = false; peer!: FakeSocket;
  send(d: string) { this.inbox.push(JSON.parse(d)); }
  serializeAttachment(v: any) { this.att = JSON.parse(JSON.stringify(v)); }
  deserializeAttachment() { return this.att; }
  close() { this.closed = true; }
}
(globalThis as any).WebSocketPair = class { 0 = new FakeSocket(); 1 = new FakeSocket(); };
(globalThis as any).WebSocketRequestResponsePair = class { constructor(public a: string, public b: string) {} };

const { Room } = await import("../src/worker/room");

function makeCtx(storage: Map<string, any>) {
  const sockets: any[] = [];
  return {
    sockets,
    storage: {
      get: async (k: string) => storage.get(k),
      put: async (k: string, v: any) => { storage.set(k, structuredClone(v)); },
      list: async ({ prefix }: any) => new Map([...storage].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])),
    },
    getWebSockets: () => sockets,
    acceptWebSocket: (s: any) => sockets.push(s),
    setWebSocketAutoResponse() {},
    blockConcurrencyWhile: (fn: () => Promise<void>) => { (globalThis as any).__pending = fn(); },
  };
}
let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok  ", m); };
const wsReq = () => new Request("https://x/ws/ABC234", { headers: { Upgrade: "websocket" } });

async function connect(room: any, name: string, p?: number[]) {
  const res: any = await room.fetch(wsReq());
  const client = res.webSocket as FakeSocket; // クライアント側 = pair[0]
  // サーバー側ソケットは ctx.sockets の最後
  const server = room.ctx.sockets[room.ctx.sockets.length - 1] as FakeSocket;
  await room.webSocketMessage(server, JSON.stringify({ t: "hello", name, skin: { skin: "#ffffff", hair: "#000000", shirt: "#ff0000", pants: "#00ff00" }, p }));
  return server;
}

const storage = new Map<string, any>();
let ctx = makeCtx(storage);
let room: any = new Room(ctx as any, {} as any);
await (globalThis as any).__pending;
ok(await room.create("ABC234", 42) === true, "ルーム作成");
ok(await room.create("ABC234", 43) === false, "二重作成は不可");

const a = await connect(room, "Alice", [0.5, 30, 0.5]);
const init = a.inbox.find((m) => m.t === "init");
ok(init?.seed === 42 && init.code === "ABC234" && init.players.length === 0, "init: seed/code");
ok(a.inbox.some((m) => m.t === "edits" && m.done === true), "初回 edits done");
const b = await connect(room, "Bob<script>", [2.5, 30, 0.5]);
ok(a.inbox.some((m) => m.t === "join" && m.player.name === "Bobscript"), "入室通知(名前サニタイズ)");
ok(b.inbox.find((m) => m.t === "init").players.length === 1, "既存プレイヤー一覧");

await room.webSocketMessage(a, JSON.stringify({ t: "set", x: 3, y: 28, z: 1, b: 7 }));
ok(a.inbox.some((m) => m.t === "set" && m.x === 3 && m.b === 7) && b.inbox.some((m) => m.t === "set" && m.x === 3 && m.b === 7), "設置が全員に同期");
ok(storage.has("c:0,0"), "チャンクが永続化");
await room.webSocketMessage(a, JSON.stringify({ t: "set", x: -1, y: 28, z: -10, b: 3 }));
ok(storage.has("c:-1,-1"), "負座標チャンクキー");

const n0 = b.inbox.length;
await room.webSocketMessage(a, JSON.stringify({ t: "set", x: 3, y: 0, z: 1, b: 0 }));
await room.webSocketMessage(a, JSON.stringify({ t: "set", x: 3, y: 28, z: 1, b: 14 }));
await room.webSocketMessage(a, JSON.stringify({ t: "set", x: 3.5, y: 28, z: 1, b: 1 }));
await room.webSocketMessage(a, JSON.stringify({ t: "set", x: 3, y: 28, z: 1, b: 999 }));
ok(b.inbox.length === n0, "不正な set は無視");
await room.webSocketMessage(a, JSON.stringify({ t: "set", x: 90, y: 28, z: 90, b: 3 }));
ok(a.inbox.some((m) => m.t === "reject" && m.x === 90), "遠すぎる編集は reject");

await room.webSocketMessage(a, JSON.stringify({ t: "pos", p: [1, 30, 1], r: [0.5, 0.1] }));
ok(b.inbox.some((m) => m.t === "pos" && m.p[0] === 1), "位置同期");
await room.webSocketMessage(a, JSON.stringify({ t: "pos", p: ["x", 1, 1], r: [0, 0] }));
await room.webSocketMessage(b, JSON.stringify({ t: "chat", text: "こんにちは" }));
ok(a.inbox.some((m) => m.t === "chat" && m.name === "Bobscript" && m.text === "こんにちは"), "チャット");
for (let i = 0; i < 12; i++) await room.webSocketMessage(b, JSON.stringify({ t: "chat", text: "spam" + i }));
ok(a.inbox.filter((m) => m.t === "chat").length <= 7, "チャットのレート制限");

// 永続化: 新しいインスタンス(DO 再起動を模擬)で編集が復元される
ctx = makeCtx(storage);
const room2: any = new Room(ctx as any, {} as any);
await (globalThis as any).__pending;
const c = await connect(room2, "Carol", [0.5, 30, 0.5]);
const edits = c.inbox.filter((m) => m.t === "edits").flatMap((m) => m.list);
ok(edits.length === 8 && edits.join().includes("3,28,1,7") && edits.join().includes("-1,28,-10,3"), `再起動後に編集を復元 ${edits}`);

// 退室
await room.webSocketClose(b);
ok(a.inbox.some((m) => m.t === "leave" && m.name === "Bobscript"), "退室通知");

// 満員
const full = new Room(makeCtx(new Map([["meta", { code: "ZZZ999", seed: 1, createdAt: 1 }]])) as any, {} as any);
await (globalThis as any).__pending;
for (let i = 0; i < 8; i++) await connect(full, "p" + i);
const r: any = await full.fetch(wsReq());
ok(r.status === 409, "満員は 409");
const none: any = new Room(makeCtx(new Map()) as any, {} as any);
await (globalThis as any).__pending;
ok((await none.fetch(wsReq())).status === 404, "存在しないルームは 404");

console.log(fail ? `${fail} FAILED` : "ALL PASSED");
process.exit(fail ? 1 : 0);
