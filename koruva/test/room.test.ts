import { B, BLOCKS, MINECRAFT_ITEM_TO_RUNTIME_ID, POTION_VARIANT_ITEM_IDS } from "../shared/blocks";
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
      transaction: async (fn: (tx: any) => Promise<any>) => {
        const draft = new Map([...storage].map(([k, v]) => [k, structuredClone(v)]));
        const tx = { put: async (k: string, v: any) => { draft.set(k, structuredClone(v)); } };
        const result = await fn(tx);
        storage.clear(); for (const [k, v] of draft) storage.set(k, v);
        return result;
      },
      list: async ({ prefix }: any) => new Map([...storage].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])),
    },
    getWebSockets: () => sockets.filter((x) => !x.closed), // 実環境では閉じたソケットは含まれない
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

const a = await connect(room, "Alice", [3.5, 50, 1.5]);
const init = a.inbox.find((m) => m.t === "init");
ok(init?.seed === 42 && init.code === "ABC234" && init.players.length === 0, "init: seed/code");
ok(a.inbox.some((m) => m.t === "edits" && m.done === true), "初回 edits done");
const b = await connect(room, "Bob_1", [4.5, 50, 1.5]);
ok(a.inbox.some((m) => m.t === "join" && m.player.name === "Bob_1"), "入室通知");
ok(b.inbox.find((m) => m.t === "init").players.length === 1, "既存プレイヤー一覧");

await room.webSocketMessage(a, JSON.stringify({ t: "set", x: 3, y: 49, z: 1, b: 7 }));
ok(a.inbox.some((m) => m.t === "set" && m.x === 3 && m.b === 7) && b.inbox.some((m) => m.t === "set" && m.x === 3 && m.b === 7), "設置が全員に同期");
ok(storage.has("c:0,0"), "チャンクが永続化");
await room.webSocketMessage(a, JSON.stringify({ t: "pos", p: [-0.5, 46, -9.5], r: [0, 0] }));
await room.webSocketMessage(a, JSON.stringify({ t: "set", x: -1, y: 45, z: -10, b: 3 }));
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
ok(a.inbox.some((m) => m.t === "chat" && m.name === "Bob_1" && m.text === "こんにちは"), "チャット");
for (let i = 0; i < 12; i++) await room.webSocketMessage(b, JSON.stringify({ t: "chat", text: "spam" + i }));
ok(a.inbox.filter((m) => m.t === "chat").length <= 7, "チャットのレート制限");

// 永続化: 新しいインスタンス(DO 再起動を模擬)で編集が復元される
ctx = makeCtx(storage);
const room2: any = new Room(ctx as any, {} as any);
await (globalThis as any).__pending;
const c = await connect(room2, "Carol", [0.5, 30, 0.5]);
const edits = c.inbox.filter((m) => m.t === "edits").flatMap((m) => m.list);
ok(edits.length === 8 && edits.join().includes("3,49,1,7") && edits.join().includes("-1,45,-10,3"), `再起動後に編集を復元 ${edits}`);

// 退室
await room.webSocketClose(b);
ok(a.inbox.some((m) => m.t === "leave" && m.name === "Bob_1"), "退室通知");

// ---- ゲームモード / ホスト / キック / BAN ----
const HOST_TOKEN = "host-token-1234567890";
const hstore = new Map<string, any>();
const hctx = makeCtx(hstore);
const hroom: any = new Room(hctx as any, {} as any);
await (globalThis as any).__pending;
ok(await hroom.create("SURV22", 7, "survival", HOST_TOKEN) === true, "サバイバルルーム作成");
ok((await hroom.info()).mode === "survival", "info に mode");
async function join2(r: any, name: string, extra: Record<string, unknown>, ip = "1.1.1.1") {
  const res: any = await r.fetch(new Request("https://x/ws/SURV22", { headers: { Upgrade: "websocket", "CF-Connecting-IP": ip } }));
  void res;
  const server = r.ctx.sockets[r.ctx.sockets.length - 1] as FakeSocket;
  await r.webSocketMessage(server, JSON.stringify({ t: "hello", name, skin: {}, ...extra }));
  return server;
}
const host = await join2(hroom, "Host", { cid: "cid-host-0001", hostToken: HOST_TOKEN }, "9.9.9.9");
const guest = await join2(hroom, "Guest", { cid: "cid-guest-0002" }, "2.2.2.2");
const hi = host.inbox.find((m: any) => m.t === "init"), gi = guest.inbox.find((m: any) => m.t === "init");
ok(hi.mode === "survival" && hi.host === true, "ホストは host=true / mode 通知");
ok(gi.mode === "survival" && gi.host === false, "ゲストは host=false");
ok(gi.players.some((p: any) => p.name === "Host" && p.host === true), "ホストは一覧で host 表示");
const gid = host.inbox.find((m: any) => m.t === "join").player.id;
const hid = hi.id;
// Inventory catalog IDs beyond the world-block range can still be persisted and granted.
await hroom.webSocketMessage(host, JSON.stringify({ t: "chat", text: "/give @s diamond_sword 3" }));
const swordId = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:diamond_sword"];
const swordInventory = host.inbox.filter((m: any) => m.t === "inventory").pop();
ok(swordId > 0 && swordInventory?.counts?.[swordId] === 3, "非ブロックアイテムを /give で所持できる");
await hroom.webSocketMessage(host, JSON.stringify({ t: "chat", text: "/give @s potion_swiftness 1" }));
const swiftnessPotionId = POTION_VARIANT_ITEM_IDS.potion_swiftness;
await hroom.webSocketMessage(host, JSON.stringify({ t: "use-item", itemId: swiftnessPotionId }));
const potionStats = host.inbox.filter((m: any) => m.t === "stats").pop();
const potionInventory = host.inbox.filter((m: any) => m.t === "inventory").pop();
const glassBottleId = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:glass_bottle"];
ok(potionStats?.vitals?.activeEffects?.some((e: any) => e.effectId === "speed" && e.durationTicks === 3600), "ポーションがJava式の効果と持続時間を適用する");
ok(potionInventory?.counts?.[swiftnessPotionId] === 0 && potionInventory?.counts?.[glassBottleId] === 1, "ポーション使用で1個消費し、ガラス瓶を返す");
await hroom.webSocketMessage(host, JSON.stringify({ t: "pos", p: [0, 40, 0], r: [0, 0], sneak: true }));
ok(guest.inbox.some((m: any) => m.t === "pos" && m.sneak === true), "スニーク状態がマルチへ同期される");

// 偽トークン / ゲストは管理コマンド不可
const fake = await join2(hroom, "Fake", { cid: "cid-fake-0003", hostToken: "wrong-token-123456" }, "3.3.3.3");
ok(fake.inbox.find((m: any) => m.t === "init").host === false, "偽トークンはホストになれない");
await hroom.webSocketMessage(guest, JSON.stringify({ t: "kick", id: hid }));
await hroom.webSocketMessage(fake, JSON.stringify({ t: "ban", id: gid }));
await hroom.webSocketMessage(guest, JSON.stringify({ t: "bans" }));
ok(!host.closed && !guest.closed && !guest.inbox.some((m: any) => m.t === "bans"), "非ホストの kick/ban/bans は無視");

// ホストは自分をキックできない
await hroom.webSocketMessage(host, JSON.stringify({ t: "kick", id: hid }));
ok(!host.closed, "ホスト自身はキック不可");

// キック
await hroom.webSocketMessage(host, JSON.stringify({ t: "kick", id: gid }));
ok(guest.inbox.some((m: any) => m.t === "kicked") && guest.closed, "キック: 本人に通知して切断");
ok(host.inbox.some((m: any) => m.t === "leave" && m.id === gid), "キック: 退室が通知される");
const nChat = host.inbox.length;
await hroom.webSocketMessage(guest, JSON.stringify({ t: "set", x: 1, y: 30, z: 1, b: 3 }));
ok(host.inbox.length === nChat, "キック後のソケットからの操作は無視");
await hroom.webSocketClose(guest);
ok(host.inbox.filter((m: any) => m.t === "leave" && m.id === gid).length === 1, "退室通知は1回だけ");
const guest2 = await join2(hroom, "Guest", { cid: "cid-guest-0002" });
ok(guest2.inbox.some((m: any) => m.t === "init"), "キックだけなら再入室できる");

// BAN(cid でも IP でも弾く)
const gid2 = host.inbox.filter((m: any) => m.t === "join").pop().player.id;
await hroom.webSocketMessage(host, JSON.stringify({ t: "ban", id: gid2 }));
ok(guest2.inbox.some((m: any) => m.t === "kicked") && guest2.closed, "BAN: 本人に通知して切断");
const again = await join2(hroom, "Guest", { cid: "cid-guest-0002" }, "7.7.7.7");
ok(again.inbox.some((m: any) => m.t === "kicked") && !again.inbox.some((m: any) => m.t === "init"), "BAN: 同じ端末ID(別IP)は入室拒否");
const again2 = await join2(hroom, "Other", { cid: "cid-other-0009" }, "1.1.1.1");
ok(again2.inbox.some((m: any) => m.t === "kicked"), "BAN: 同じIP(別端末ID)も入室拒否");
await hroom.webSocketMessage(host, JSON.stringify({ t: "bans" }));
const bl = host.inbox.filter((m: any) => m.t === "bans").pop();
ok(bl?.list.length === 1 && bl.list[0].name === "Guest", "BAN一覧");

// 再起動(DO の再生成)してもBANは残る
const hroom2: any = new Room(makeCtx(hstore) as any, {} as any);
await (globalThis as any).__pending;
const afterRestart = await join2(hroom2, "Guest", { cid: "cid-guest-0002" }, "8.8.8.8");
ok(afterRestart.inbox.some((m: any) => m.t === "kicked") && !afterRestart.inbox.some((m: any) => m.t === "init"), "再起動後もBANが有効");

// 解除
await hroom.webSocketMessage(host, JSON.stringify({ t: "unban", bid: bl.list[0].bid }));
const back = await join2(hroom, "Guest", { cid: "cid-guest-0002" });
ok(back.inbox.some((m: any) => m.t === "init"), "BAN解除後は入室できる");

// ホスト本人は(同じ端末/IPがBANされていても)締め出されない
const stor3 = new Map<string, any>();
const r3: any = new Room(makeCtx(stor3) as any, {} as any);
await (globalThis as any).__pending;
await r3.create("HOST33", 1, "creative", HOST_TOKEN);
const h3 = await join2(r3, "H", { cid: "cid-same-0001", hostToken: HOST_TOKEN }, "5.5.5.5");
const g3 = await join2(r3, "G", { cid: "cid-same-0001" }, "5.5.5.5"); // 同じ端末の別タブ
await r3.webSocketMessage(h3, JSON.stringify({ t: "ban", id: g3.inbox.find((m: any) => m.t === "init").id }));
ok(g3.closed, "同端末の別タブ(ゲスト)はBANされる");
const h3b = await join2(r3, "H2", { cid: "cid-same-0001", hostToken: HOST_TOKEN }, "5.5.5.5");
ok(h3b.inbox.some((m: any) => m.t === "init" && m.host === true), "BAN済みと同じ端末でもホストは入室できる");


// ---- 名前の検証(空・使えない文字・重複は入室不可) ----
{
  const nstore = new Map<string, any>();
  const nr: any = new Room(makeCtx(nstore) as any, {} as any);
  await (globalThis as any).__pending;
  await nr.create("NAME22", 3, "creative", HOST_TOKEN);
  const tryJoin = async (name: unknown) => {
    await nr.fetch(new Request("https://x/ws/NAME22", { headers: { Upgrade: "websocket" } }));
    const sv = nr.ctx.sockets[nr.ctx.sockets.length - 1] as FakeSocket;
    await nr.webSocketMessage(sv, JSON.stringify({ t: "hello", name, skin: {} }));
    return sv;
  };
  const accepted = (sv: FakeSocket) => sv.inbox.some((m: any) => m.t === "init");
  const rejected = (sv: FakeSocket) => sv.inbox.some((m: any) => m.t === "error") && sv.closed && !accepted(sv);
  ok(rejected(await tryJoin("")), "名前が空だと入室できない");
  ok(rejected(await tryJoin("   ")), "空白だけの名前は入室できない");
  ok(rejected(await tryJoin(undefined)), "名前なし(未送信)は入室できない");
  for (const bad of ["a b", "a,b", "a.b", "a-b", "名前", "a<b>", " abc", "abc ", "a".repeat(17)]) ok(rejected(await tryJoin(bad)), `使えない名前を拒否: "${bad}"`);
  const good = await tryJoin("Steve_01");
  ok(accepted(good), "英数字と _ の名前は入室できる");
  ok(accepted(await tryJoin("_")) && accepted(await tryJoin("a".repeat(16))), "_ だけ / 16文字ちょうども可");
  const dup = await tryJoin("Steve_01");
  ok(rejected(dup) && dup.inbox.some((m: any) => m.t === "error" && /使われて/.test(m.message)), "同じ名前は使えない");
  ok(rejected(await tryJoin("steve_01")), "大文字小文字違いの同名も使えない");
  await nr.webSocketClose(good);
  ok(accepted(await tryJoin("Steve_01")), "退室後はその名前を再び使える");
}

// ---- ドロップ(エンティティ) ----
{
  const dstore = new Map<string, any>();
  const dr: any = new Room(makeCtx(dstore) as any, {} as any);
  await (globalThis as any).__pending;
  await dr.create("DROP22", 2, "survival", HOST_TOKEN);
  const j = async (name: string, extra: Record<string, unknown>) => {
    await dr.fetch(new Request("https://x/ws/DROP22", { headers: { Upgrade: "websocket" } }));
    const sv = dr.ctx.sockets[dr.ctx.sockets.length - 1] as FakeSocket;
    await dr.webSocketMessage(sv, JSON.stringify({ t: "hello", name, skin: {}, ...extra }));
    return sv;
  };
  const p1 = await j("P1", { p: [4.5, 21, 3.5], cid: "cid-p1-00001", hostToken: HOST_TOKEN });
  const p2 = await j("P2", { p: [5.5, 21, 3.5], cid: "cid-p2-00002" });
  const p3 = await j("P3", { p: [50.5, 30, 0.5], cid: "cid-p3-00003" });
  const id1 = p1.inbox.find((m: any) => m.t === "init").id, id2 = p2.inbox.find((m: any) => m.t === "init").id;
  const dropsOf = (sv: FakeSocket) => sv.inbox.filter((m: any) => m.t === "drop");
  await dr.applyEdit(4, 20, 3, B.COBBLE);

  await dr.webSocketMessage(p1, JSON.stringify({ t: "dig-start", x: 4, y: 20, z: 3 }));
  dr.player(p1).digStartedAt = Date.now() - 10000; // 採掘時間経過をテスト内で進める
  await dr.webSocketMessage(p1, JSON.stringify({ t: "set", x: 4, y: 20, z: 3, b: 0, d: 9 }));
  ok(dropsOf(p1).length === 1 && dropsOf(p2).length === 1 && dropsOf(p3).length === 1, "サバイバルで壊すと全員にドロップが出る");
  const dp = dropsOf(p2)[0];
  ok(dp.b === 9 && dp.x === 4 && dp.y === 20 && dp.z === 3 && typeof dp.eid === "string", "ドロップの種類と座標");
  await dr.webSocketMessage(p1, JSON.stringify({ t: "set", x: 3, y: 29, z: 0, b: 7, d: 9 }));
  await dr.webSocketMessage(p1, JSON.stringify({ t: "set", x: 4, y: 29, z: 0, b: 0, d: 999 }));
  await dr.webSocketMessage(p1, JSON.stringify({ t: "set", x: 5, y: 29, z: 0, b: 0, d: 14 }));
  await dr.webSocketMessage(p1, JSON.stringify({ t: "set", x: 6, y: 29, z: 0, b: 0, d: "x" }));
  ok(dropsOf(p1).length === 1, "設置・不正なID・岩盤・水・不正型ではドロップしない");

  // 遠いプレイヤーは回収できない
  await dr.webSocketMessage(p3, JSON.stringify({ t: "pickup", eid: dp.eid }));
  ok(!p1.inbox.some((m: any) => m.t === "gone"), "遠すぎると回収できない");
  // 近い人が回収 → 全員に gone(by=回収者)
  await dr.webSocketMessage(p2, JSON.stringify({ t: "pickup", eid: dp.eid }));
  const g1 = p1.inbox.find((m: any) => m.t === "gone");
  ok(g1?.eid === dp.eid && g1.by === id2 && p3.inbox.some((m: any) => m.t === "gone" && m.by === id2), "回収すると全員に通知(by=回収者)");
  // 二重取得できない
  await dr.webSocketMessage(p1, JSON.stringify({ t: "pickup", eid: dp.eid }));
  const mine = p1.inbox.filter((m: any) => m.t === "gone" && m.by === id1);
  ok(mine.length === 0, "同じドロップは2人が取れない");
  ok(p1.inbox.filter((m: any) => m.t === "gone" && m.by === "").length === 1, "既に無いドロップを要求した人には空の gone を返す");

  // 途中参加者にも既存のドロップが見える
  await dr.applyEdit(4, 20, 4, B.COBBLE);
  await dr.webSocketMessage(p1, JSON.stringify({ t: "dig-start", x: 4, y: 20, z: 4 }));
  dr.player(p1).digStartedAt = Date.now() - 10000;
  await dr.webSocketMessage(p1, JSON.stringify({ t: "set", x: 4, y: 20, z: 4, b: 0, d: 3 }));
  const late = await j("Late", { p: [4.5, 21, 3.5], cid: "cid-late-0004" });
  ok(late.inbox.find((m: any) => m.t === "init").drops?.length === 1, "途中参加者に既存のドロップを送る");

}

// ---- /gamemode(ホスト専用) ----
{
  const gstore = new Map<string, any>();
  const gr: any = new Room(makeCtx(gstore) as any, {} as any);
  await (globalThis as any).__pending;
  await gr.create("GAME22", 9, "creative", HOST_TOKEN);
  const j = async (name: string, extra: Record<string, unknown>) => {
    await gr.fetch(new Request("https://x/ws/GAME22", { headers: { Upgrade: "websocket" } }));
    const sv = gr.ctx.sockets[gr.ctx.sockets.length - 1] as FakeSocket;
    await gr.webSocketMessage(sv, JSON.stringify({ t: "hello", name, skin: {}, ...extra }));
    return sv;
  };
  const h = await j("Admin", { p: [0.5, 30, 0.5], cid: "cid-admin-001", hostToken: HOST_TOKEN });
  const g = await j("Guest", { p: [1.5, 30, 0.5], cid: "cid-guest-001" });
  const say = async (sv: FakeSocket, text: string) => { gr.player(sv).chatB.tokens = 5; /* レート制限を満タンに */ sv.inbox.length = 0; gr.ctx.sockets.forEach((x: any) => { if (x !== sv) x.inbox.length = 0; }); await gr.webSocketMessage(sv, JSON.stringify({ t: "chat", text })); };
  const modes = (sv: FakeSocket) => sv.inbox.filter((m: any) => m.t === "mode").map((m: any) => m.mode);
  const sys = (sv: FakeSocket) => sv.inbox.filter((m: any) => m.t === "chat" && m.name === "").map((m: any) => m.text);

  await say(g, "/gamemode survival");
  ok(modes(g).length === 0 && modes(h).length === 0 && sys(g).some((t) => /管理者/.test(t)), "ゲストは /gamemode を使えない(拒否メッセージは本人にだけ)");
  ok(!h.inbox.some((m: any) => m.t === "chat"), "コマンドの文面は他人に流れない");
  ok((await gr.info()).mode === "creative", "拒否されたらモードは変わらない");

  await say(h, "/gamemode survival");
  ok(modes(h)[0] === "survival" && modes(g)[0] === "survival", "ホストが /gamemode survival → 全員に mode 通知");
  ok((await gr.info()).mode === "survival" && gstore.get("meta").mode === "survival", "モードが保存される");
  await say(h, "/gamemode survival");
  ok(modes(h).length === 0 && sys(h).some((t) => /既に/.test(t)), "同じモードなら変更しない");

  for (const [cmd, want] of [["/gamemode c", "creative"], ["/gamemode s", "survival"], ["/gamemode cr", "creative"], ["/gamemode SU", "survival"], ["/GAMEMODE Creative", "creative"], ["/gamemode  s", "survival"]] as const) {
    await say(h, cmd);
    ok(modes(g)[0] === want, `${cmd} → ${want}`);
  }
  await say(h, "/gamemode x");
  await say(h, "/gamemode");
  await say(h, "/gamemode creativex");
  ok(modes(h).length === 0 && (await gr.info()).mode === "survival", "不正な引数ではモードは変わらない");
  ok(sys(h).some((t) => /使い方/.test(t)), "不正な引数は使い方を表示");
  await say(h, "/foo");
  ok(sys(h).some((t) => /不明/.test(t)), "不明なコマンド");

  // クリエイティブに切り替えるとドロップは消える
  await gr.applyEdit(2, 30, -1, B.COBBLE);
  await gr.webSocketMessage(h, JSON.stringify({ t: "dig-start", x: 2, y: 30, z: -1 }));
  gr.player(h).digStartedAt = Date.now() - 10000;
  await gr.webSocketMessage(h, JSON.stringify({ t: "set", x: 2, y: 30, z: -1, b: 0, d: 9 }));
  ok(h.inbox.some((m: any) => m.t === "drop"), "(サバイバルに戻してドロップを出す)");
   const spawnedDrop = [...h.inbox].reverse().find((m: any) => m.t === "drop");
   const dropRestart = new Room(makeCtx(gstore) as any, {} as any);
   await (globalThis as any).__pending;
   const dropViewer = await connect(dropRestart, "DropViewer", [2.5, 30, -0.5]);
   const dropInit = dropViewer.inbox.find((m: any) => m.t === "init");
   ok(dropInit?.drops?.some((d: any) => d.eid === spawnedDrop?.eid), "DO再起動後もドロップが復元される");
  await say(h, "/gamemode c");
  ok(g.inbox.some((m: any) => m.t === "gone" && m.by === ""), "クリエイティブ切り替えでドロップが消える");
  await gr.webSocketMessage(h, JSON.stringify({ t: "set", x: 2, y: 29, z: 1, b: 0, d: 9 }));
  ok(!h.inbox.some((m: any) => m.t === "drop"), "クリエイティブではドロップしない");

  // 再起動後も保持
  const gr2: any = new Room(makeCtx(gstore) as any, {} as any);
  await (globalThis as any).__pending;
  ok((await gr2.info()).mode === "creative", "再起動後もモードが保持される");
}

// 旧ルーム(mode/hostToken なし)はクリエイティブ・ホスト不在
const legacy: any = new Room(makeCtx(new Map([["meta", { code: "OLD111", seed: 1, createdAt: 1 }]])) as any, {} as any);
await (globalThis as any).__pending;
const lg = await join2(legacy, "L", { cid: "cid-legacy-01", hostToken: HOST_TOKEN });
const li = lg.inbox.find((m: any) => m.t === "init");
ok(li.mode === "creative" && li.host === false, "旧ルームは creative・ホストなし");

// 満員
const full = new Room(makeCtx(new Map([["meta", { code: "ZZZ999", seed: 1, createdAt: 1 }]])) as any, {} as any);
await (globalThis as any).__pending;
for (let i = 0; i < 8; i++) await connect(full, "p" + i);
const r: any = await full.fetch(wsReq());
ok(r.status === 409, "満員は 409");
const none: any = new Room(makeCtx(new Map()) as any, {} as any);
await (globalThis as any).__pending;
ok((await none.fetch(wsReq())).status === 404, "存在しないルームは 404");

// ---- 大きな hello と拒否済みソケットの後始末 ----
{
  const largeStore = new Map<string, any>();
  const largeRoom: any = new Room(makeCtx(largeStore) as any, {} as any);
  await (globalThis as any).__pending;
  await largeRoom.create("LARGE1", 11);
  await largeRoom.fetch(wsReq());
  const largeSocket = largeRoom.ctx.sockets[largeRoom.ctx.sockets.length - 1] as FakeSocket;
  const counts = new Array(BLOCKS.length).fill(0);
  const hello = JSON.stringify({ t: "hello", name: "LargeHello", skin: {}, counts });
  ok(hello.length > 4096 && hello.length < 262144, "大きな hello のサイズは通常メッセージ上限を超える");
  await largeRoom.webSocketMessage(largeSocket, hello);
  ok(largeSocket.inbox.some((m: any) => m.t === "init") && largeSocket.inbox.some((m: any) => m.t === "edits" && m.done), "大きな hello でも入室・初期同期できる");

  const refusedSocket = await connect(largeRoom, "Invalid Name");
  ok(refusedSocket.closed && !largeRoom.mem.has(refusedSocket), "名前拒否時にソケット状態も即座に解放する");
  await largeRoom.webSocketClose(refusedSocket);
  ok(!largeRoom.mem.has(refusedSocket), "拒否済みソケットの close 後も mem に残らない");

  await largeRoom.fetch(wsReq());
  const oversizedSocket = largeRoom.ctx.sockets[largeRoom.ctx.sockets.length - 1] as FakeSocket;
  await largeRoom.webSocketMessage(oversizedSocket, JSON.stringify({ t: "hello", name: "TooLarge", skin: {}, padding: "x".repeat(262144) }));
  ok(oversizedSocket.closed && !largeRoom.mem.has(oversizedSocket), "上限超過 hello は切断して接続枠を解放する");
}

console.log(fail ? `${fail} FAILED` : "ALL PASSED");
process.exit(fail ? 1 : 0);
