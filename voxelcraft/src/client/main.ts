import * as THREE from "three";
import { B, BLOCKS } from "../../shared/blocks";
import { DAY_LENGTH_SEC, REACH, SEA_LEVEL } from "../../shared/constants";
import type { PlayerInfo, ServerMsg, Skin } from "../../shared/protocol";
import { createAtlasCanvas } from "./atlas";
import { ChunkView } from "./chunkview";
import { Net, checkRoom, createRoom } from "./net";
import { EYE_H, PLAYER_H, PLAYER_W, collides, inLiquid, moveBody, raycast, type Body, type RayHit } from "./physics";
import { PlayerModel, RemotePlayers } from "./remote";
import {
  deleteSolo, loadProfile, loadRoomPlayer, loadSolo, saveProfile, saveRoomPlayer, saveSolo,
  type PlayerSave, type Profile,
} from "./save";
import { Sky, skyAt } from "./sky";
import { $, Chat, Hotbar, drawSkinPreview, randomSkin, toast } from "./ui";
import { World } from "./world";
import { heightAt } from "./worldgen";

THREE.ColorManagement.enabled = false;

type State = "title" | "loading" | "paused" | "playing" | "inventory" | "chat";
const SETTINGS_KEY = "voxelcraft:settings";
const DEFAULT_HOTBAR: number[] = [B.GRASS, B.DIRT, B.STONE, B.PLANKS, B.LOG, B.GLASS, B.BRICK, B.LAMP, B.SAND];

class Game {
  // three
  canvas = $<HTMLCanvasElement>("gl");
  renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: "high-performance" });
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 1, 0.05, 400);
  world = new World(1);
  view = new ChunkView(this.world);
  sky = new Sky();
  remotes = new RemotePlayers();
  ownModel: PlayerModel | null = null;
  highlight: THREE.LineSegments;
  atlas = createAtlasCanvas();

  // state
  state: State = "title";
  mode: "solo" | "room" = "solo";
  roomCode = "";
  myId = "";
  net = new Net();
  profile: Profile = loadProfile();
  settings = { rd: 6, sens: 5 };

  body: Body = { x: 0.5, y: 60, z: 0.5, vx: 0, vy: 0, vz: 0, onGround: false };
  yaw = 0;
  pitch = 0;
  fly = false;
  thirdPerson = false;
  keys = new Set<string>();
  lastSpace = 0;
  hotbar: number[] = [...DEFAULT_HOTBAR];
  sel = 0;
  time = 0.05;
  clockOffset = 0;
  t0 = 0;
  target: RayHit | null = null;
  mouseL = false;
  mouseR = false;
  lastBreak = 0;
  lastPlace = 0;
  pending = new Map<string, number>();
  lastSend = 0;
  lastSent = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  lastAutosave = 0;
  fps = 0;
  fpsAcc = 0;
  fpsN = 0;
  lastT = performance.now();
  loadStart = 0;
  loadingFor: "world" | "net" = "world";
  ready = false;

  hotbarUI: Hotbar;
  chat = new Chat();
  spawn: [number, number, number] = [0.5, 40, 0.5];

  constructor() {
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.add(this.view.group, this.sky.group, this.remotes.group);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0x000000 }),
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
      if (s) this.settings = { rd: clampN(s.rd, 3, 12, 6), sens: clampN(s.sens, 1, 10, 5) };
    } catch { /* ignore */ }
    this.view.renderDistance = this.settings.rd;

    this.hotbarUI = new Hotbar(
      this.atlas,
      () => ({ hotbar: this.hotbar, sel: this.sel }),
      (i) => { this.sel = i; this.hotbarUI.refresh(); },
      (id) => { this.hotbar[this.sel] = id; this.hotbarUI.refresh(); toast(BLOCKS[id].name); },
    );
    this.hotbarUI.refresh();

    this.bindUI();
    this.bindInput();
    addEventListener("resize", () => this.resize());
    this.resize();
    addEventListener("beforeunload", () => this.autosave(true));
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ UI wiring
  bindUI() {
    const nameEl = $<HTMLInputElement>("name");
    const cols = { skin: $<HTMLInputElement>("c-skin"), hair: $<HTMLInputElement>("c-hair"), shirt: $<HTMLInputElement>("c-shirt"), pants: $<HTMLInputElement>("c-pants") };
    const preview = $<HTMLCanvasElement>("skinpreview");
    const syncSkin = () => {
      this.profile.skin = { skin: cols.skin.value, hair: cols.hair.value, shirt: cols.shirt.value, pants: cols.pants.value };
      drawSkinPreview(preview, this.profile.skin);
    };
    const applySkin = (s: Skin) => { for (const k of Object.keys(cols) as (keyof Skin)[]) cols[k].value = s[k]; syncSkin(); };
    nameEl.value = this.profile.name;
    applySkin(this.profile.skin);
    for (const el of Object.values(cols)) el.addEventListener("input", syncSkin);
    $("skinrandom").addEventListener("click", () => applySkin(randomSkin()));

    const solo = loadSolo();
    if (solo) {
      $("btn-solo").textContent = "ソロ: 続きから";
      $("btn-solo-new").hidden = false;
    }
    const prep = () => {
      this.profile.name = nameEl.value.trim() || "Player";
      saveProfile(this.profile);
      $("titleerr").textContent = "";
    };
    $("btn-solo").addEventListener("click", () => { prep(); this.startSolo(false); });
    $("btn-solo-new").addEventListener("click", () => {
      if (confirm("保存済みのソロワールドを破棄して新しく始めますか？")) { prep(); deleteSolo(); this.startSolo(true); }
    });
    $("btn-create").addEventListener("click", async () => {
      prep();
      try { this.showLoading("ルームを作成中…"); const code = await createRoom(); await this.startRoom(code); }
      catch (e) { this.backToTitle((e as Error).message); }
    });
    const join = async () => {
      prep();
      const code = $<HTMLInputElement>("joincode").value.trim().toUpperCase();
      if (code.length !== 6) { $("titleerr").textContent = "6文字のルームコードを入力してください"; return; }
      try { this.showLoading("ルームを確認中…"); await checkRoom(code); await this.startRoom(code); }
      catch (e) { this.backToTitle((e as Error).message); }
    };
    $("btn-join").addEventListener("click", join);
    $("joincode").addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Enter") join(); });
    const hash = location.hash.replace("#", "").trim().toUpperCase();
    if (/^[A-Z0-9]{6}$/.test(hash)) $<HTMLInputElement>("joincode").value = hash;

    // ポーズメニュー
    $("btn-resume").addEventListener("click", () => this.requestLock());
    $("btn-save").addEventListener("click", () => this.manualSave());
    $("btn-load").addEventListener("click", () => this.manualLoad());
    $("btn-quit").addEventListener("click", () => this.quit());
    $("btn-copycode").addEventListener("click", () => this.copyLink());
    $("copylink").addEventListener("click", () => this.copyLink());
    const rd = $<HTMLInputElement>("rd"), sens = $<HTMLInputElement>("sens");
    rd.value = String(this.settings.rd); sens.value = String(this.settings.sens);
    const syncSettings = () => {
      this.settings.rd = +rd.value; this.settings.sens = +sens.value;
      $("rdval").textContent = String(this.settings.rd); $("sensval").textContent = String(this.settings.sens);
      this.view.renderDistance = this.settings.rd;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    };
    rd.addEventListener("input", syncSettings); sens.addEventListener("input", syncSettings);
    syncSettings();

    // チャット入力
    const ci = $<HTMLInputElement>("chatinput");
    ci.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        const text = ci.value.trim();
        if (text) {
          if (this.mode === "room") this.net.send({ t: "chat", text });
          else this.chat.add(text, this.profile.name);
        }
        this.closeChat(true);
      } else if (e.key === "Escape") this.closeChat(false);
    });
  }

  copyLink() {
    const url = `${location.origin}/#${this.roomCode}`;
    navigator.clipboard?.writeText(url).then(() => toast("招待リンクをコピーしました"), () => toast(`コード: ${this.roomCode}`));
  }

  // ------------------------------------------------------------ input
  bindInput() {
    document.addEventListener("pointerlockchange", () => {
      const locked = document.pointerLockElement === this.canvas;
      if (locked) {
        if (this.state === "paused") { this.state = "playing"; $("pause").hidden = true; }
      } else if (this.state === "playing") this.openPause("一時停止");
    });
    document.addEventListener("pointerlockerror", () => { if (this.state === "playing") this.openPause("一時停止"); });
    this.canvas.addEventListener("click", () => { if (this.state === "playing" && document.pointerLockElement !== this.canvas) this.requestLock(); });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    addEventListener("mousemove", (e) => {
      if (this.state !== "playing" || document.pointerLockElement !== this.canvas) return;
      const k = this.settings.sens * 0.0005;
      this.yaw -= e.movementX * k;
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - e.movementY * k));
    });
    this.canvas.addEventListener("mousedown", (e) => {
      if (this.state !== "playing" || document.pointerLockElement !== this.canvas) return;
      e.preventDefault();
      if (e.button === 0) { this.mouseL = true; this.doBreak(); this.lastBreak = performance.now(); }
      else if (e.button === 2) { this.mouseR = true; this.doPlace(); this.lastPlace = performance.now(); }
      else if (e.button === 1) this.doPick();
    });
    addEventListener("mouseup", (e) => { if (e.button === 0) this.mouseL = false; if (e.button === 2) this.mouseR = false; });
    addEventListener("wheel", (e) => {
      if (this.state !== "playing") return;
      this.sel = (this.sel + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
      this.hotbarUI.refresh();
      this.showHeld();
    }, { passive: true });
    addEventListener("blur", () => { this.keys.clear(); this.mouseL = this.mouseR = false; });

    addEventListener("keydown", (e) => {
      if (this.state === "title" || this.state === "loading") return;
      if (this.state === "chat") return;
      if (e.code === "Tab") { e.preventDefault(); if (this.mode === "room") this.showPlayers(true); return; }
      if (this.state === "inventory") {
        if (e.code === "KeyE" || e.code === "Escape") { e.preventDefault(); this.closeInventory(); }
        return;
      }
      if (this.state !== "playing") return;
      if (e.repeat) { this.keys.add(e.code); return; }
      this.keys.add(e.code);
      if (/^Digit[1-9]$/.test(e.code)) { this.sel = +e.code.slice(5) - 1; this.hotbarUI.refresh(); this.showHeld(); }
      else if (e.code === "KeyE") { e.preventDefault(); this.openInventory(); }
      else if (e.code === "KeyT" || e.code === "Enter") { e.preventDefault(); this.openChat(); }
      else if (e.code === "KeyV") { this.thirdPerson = !this.thirdPerson; toast(this.thirdPerson ? "三人称視点" : "一人称視点"); }
      else if (e.code === "Space") {
        const now = performance.now();
        if (now - this.lastSpace < 300) { this.fly = !this.fly; this.body.vy = 0; toast(this.fly ? "飛行モード ON" : "飛行モード OFF"); }
        this.lastSpace = now;
      }
    });
    addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "Tab") this.showPlayers(false);
    });
  }

  requestLock() {
    try {
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => { /* ブラウザの再ロック待ち時間など */ });
    } catch { /* ignore */ }
  }

  showHeld() { const id = this.hotbar[this.sel]; if (id) toast(BLOCKS[id].name); }

  showPlayers(show: boolean) {
    const el = $("playerlist");
    el.hidden = !show;
    if (!show) return;
    el.innerHTML = "<h3>プレイヤー</h3>";
    const add = (n: string) => { const d = document.createElement("div"); d.textContent = n; el.appendChild(d); };
    add(this.profile.name + "（あなた）");
    for (const p of this.remotes.names()) add(p.name);
  }

  openPause(title: string) {
    if (this.state === "title" || this.state === "loading") return;
    this.state = "paused";
    this.mouseL = this.mouseR = false;
    this.keys.clear();
    $("pausetitle").textContent = title;
    $("btn-load").hidden = false;
    $("btn-copycode").hidden = this.mode !== "room";
    $("pausemsg").textContent = this.mode === "room" ? `ルーム ${this.roomCode}（ワールドはサーバーに自動保存）` : "ソロワールド（ブラウザに保存）";
    $("pause").hidden = false;
  }

  openInventory() {
    this.state = "inventory";
    this.keys.clear(); this.mouseL = this.mouseR = false;
    document.exitPointerLock();
    this.hotbarUI.refresh();
    $("inventory").hidden = false;
  }
  closeInventory() {
    $("inventory").hidden = true;
    this.state = "playing";
    this.requestLock();
  }
  openChat() {
    this.state = "chat";
    this.keys.clear(); this.mouseL = this.mouseR = false;
    document.exitPointerLock();
    const ci = $<HTMLInputElement>("chatinput");
    ci.hidden = false; ci.value = "";
    this.chat.setOpen(true);
    setTimeout(() => ci.focus(), 0);
  }
  closeChat(relock: boolean) {
    const ci = $<HTMLInputElement>("chatinput");
    ci.hidden = true; ci.blur();
    this.chat.setOpen(false);
    if (relock) { this.state = "playing"; this.requestLock(); }
    else this.openPause("一時停止");
  }

  // ------------------------------------------------------------ flow
  showLoading(text: string) {
    this.state = "loading";
    $("title").hidden = true;
    $("pause").hidden = true;
    $("loading").hidden = false;
    $("loadtext").textContent = text;
    $("loadbar").style.width = "5%";
  }

  backToTitle(err = "") {
    this.net.close();
    this.ready = false;
    this.state = "title";
    this.remotes.clear();
    this.view.clear();
    this.world.reset(1);
    $("hud").hidden = true;
    $("pause").hidden = true;
    $("loading").hidden = true;
    $("inventory").hidden = true;
    $("title").hidden = false;
    $("titleerr").textContent = err;
    $("chatlog").innerHTML = "";
    const solo = loadSolo();
    $("btn-solo").textContent = solo ? "ソロ: 続きから" : "ソロで遊ぶ";
    $("btn-solo-new").hidden = !solo;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  quit() {
    this.autosave(true);
    this.backToTitle();
  }

  startSolo(fresh: boolean) {
    this.mode = "solo";
    this.roomCode = "";
    const save = fresh ? null : loadSolo();
    const seed = save?.seed ?? (Math.random() * 2 ** 31) >>> 0;
    this.world.reset(seed);
    this.view.clear();
    this.remotes.clear();
    if (save) {
      this.world.importEdits(save.edits);
      this.time = save.time;
      this.applyPlayerSave(save.player);
    } else {
      this.time = 0.05;
      this.setSpawn();
    }
    this.beginLoading("ワールドを生成中…");
  }

  async startRoom(code: string) {
    this.mode = "room";
    this.roomCode = code;
    this.showLoading("ルームに接続中…");
    this.pending.clear();
    const saved = loadRoomPlayer(code);
    let gotInit = false;
    const done = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("ルームの読み込みがタイムアウトしました")), 20000);
      this.net.onMessage = (m) => {
        if (m.t === "init") {
          gotInit = true;
          this.myId = m.id;
          this.world.reset(m.seed);
          this.view.clear();
          this.remotes.clear();
          this.t0 = m.t0;
          this.clockOffset = m.now - Date.now();
          for (const p of m.players) this.remotes.add(p);
        } else if (m.t === "edits" && gotInit) {
          this.world.importEdits(m.list);
          if (m.done) { clearTimeout(timer); resolve(); }
        } else if (m.t === "error") { clearTimeout(timer); reject(new Error(m.message)); }
        else this.onServerMsg(m);
      };
    });
    this.net.onClose = (reason) => {
      if (this.state !== "title") { this.backToTitle(reason); }
    };
    await this.net.connect(code, { t: "hello", name: this.profile.name, skin: this.profile.skin, p: saved?.pos, r: saved ? [saved.yaw, saved.pitch] : undefined });
    await done;
    if (saved) this.applyPlayerSave(saved); else this.setSpawn();
    this.time = this.roomTime();
    history.replaceState(null, "", `#${code}`);
    this.beginLoading("ワールドを生成中…");
  }

  roomTime(): number {
    const t = ((Date.now() + this.clockOffset - this.t0) / 1000 / DAY_LENGTH_SEC + 0.05) % 1;
    return t < 0 ? t + 1 : t;
  }

  setSpawn() {
    const h = Math.max(heightAt(this.world.seed, 0, 0), SEA_LEVEL);
    this.body = { x: 0.5, y: h + 2, z: 0.5, vx: 0, vy: 0, vz: 0, onGround: false };
    this.yaw = 0; this.pitch = 0;
    this.hotbar = [...DEFAULT_HOTBAR]; this.sel = 0;
    this.spawn = [0.5, h + 2, 0.5];
  }

  applyPlayerSave(p: PlayerSave) {
    this.body = { x: p.pos[0], y: p.pos[1], z: p.pos[2], vx: 0, vy: 0, vz: 0, onGround: false };
    this.yaw = p.yaw; this.pitch = p.pitch;
    this.hotbar = p.hotbar.length === 9 ? p.hotbar.map((v) => (v >= 1 && v < BLOCKS.length ? v : 0)) : [...DEFAULT_HOTBAR];
    this.sel = Math.min(8, Math.max(0, p.sel | 0));
    const h = Math.max(heightAt(this.world.seed, 0, 0), SEA_LEVEL);
    this.spawn = [0.5, h + 2, 0.5];
  }

  beginLoading(text: string) {
    this.showLoading(text);
    this.ready = false;
    this.loadStart = performance.now();
    this.hotbarUI.refresh();
    $("hud").hidden = false;
    $("roombadge").hidden = this.mode !== "room";
    $("roomcode").textContent = this.roomCode;
    this.loadingFor = "world";
  }

  finishLoading() {
    // めり込み回避
    for (let i = 0; i < 80 && collides(this.world, this.body.x, this.body.y, this.body.z); i++) this.body.y += 1;
    this.ready = true;
    $("loading").hidden = true;
    this.openPause("準備完了");
    if (this.mode === "room") this.chat.add(`ルーム ${this.roomCode} に参加しました`);
  }

  // ------------------------------------------------------------ server
  onServerMsg(m: ServerMsg) {
    switch (m.t) {
      case "join":
        this.remotes.add(m.player);
        this.chat.add(`${m.player.name} が入室しました`);
        toast(`${m.player.name} が入室しました`);
        break;
      case "leave":
        this.remotes.remove(m.id);
        this.chat.add(`${m.name} が退室しました`);
        break;
      case "pos": this.remotes.move(m.id, m.p, m.r); break;
      case "set":
        this.pending.delete(`${m.x},${m.y},${m.z}`);
        this.world.setBlock(m.x, m.y, m.z, m.b);
        break;
      case "chat": this.chat.add(m.text, m.name); break;
      case "reject": {
        const k = `${m.x},${m.y},${m.z}`;
        const prev = this.pending.get(k);
        if (prev !== undefined) { this.world.setBlock(m.x, m.y, m.z, prev); this.pending.delete(k); }
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------------------ block edit
  setLocal(x: number, y: number, z: number, b: number) {
    const prev = this.world.get(x, y, z);
    if (prev === -1 || prev === b) return;
    if (this.mode === "room") {
      if (!this.net.connected) { toast("サーバーに接続されていません"); return; }
      const k = `${x},${y},${z}`;
      if (!this.pending.has(k)) this.pending.set(k, prev);
      this.net.send({ t: "set", x, y, z, b });
    }
    this.world.setBlock(x, y, z, b);
  }

  doBreak() {
    const t = this.target;
    if (!t) return;
    const id = this.world.get(t.x, t.y, t.z);
    if (id === B.BEDROCK || t.y < 1) { toast("これは壊せません"); return; }
    this.setLocal(t.x, t.y, t.z, B.AIR);
  }

  doPlace() {
    const t = this.target;
    const id = this.hotbar[this.sel];
    if (!t || !id) return;
    const x = t.x + t.nx, y = t.y + t.ny, z = t.z + t.nz;
    if (y < 1 || y >= 64) return;
    const cur = this.world.get(x, y, z);
    if (cur !== B.AIR && !(cur > 0 && BLOCKS[cur].render === "liquid")) return;
    if (BLOCKS[id].solid) {
      const b = this.body, hw = PLAYER_W / 2;
      if (b.x + hw > x && b.x - hw < x + 1 && b.y + PLAYER_H > y && b.y < y + 1 && b.z + hw > z && b.z - hw < z + 1) return;
    }
    this.setLocal(x, y, z, id);
  }

  doPick() {
    const t = this.target;
    if (!t) return;
    const id = this.world.get(t.x, t.y, t.z);
    if (id <= 0 || id === B.BEDROCK) return;
    this.hotbar[this.sel] = id;
    this.hotbarUI.refresh();
    this.showHeld();
  }

  // ------------------------------------------------------------ save
  playerSave(): PlayerSave {
    return { pos: [this.body.x, this.body.y, this.body.z], yaw: this.yaw, pitch: this.pitch, hotbar: [...this.hotbar], sel: this.sel };
  }

  autosave(force = false) {
    if (!this.ready) return;
    if (this.mode === "solo") {
      saveSolo({ v: 1, seed: this.world.seed, edits: this.world.exportEdits(), time: this.time, player: this.playerSave(), savedAt: Date.now() });
    } else if (this.roomCode) {
      saveRoomPlayer(this.roomCode, this.playerSave());
    }
    this.lastAutosave = performance.now();
    void force;
  }

  manualSave() {
    this.autosave(true);
    $("pausemsg").textContent = this.mode === "solo" ? "セーブしました" : "プレイヤー位置を保存しました（ワールドはサーバーに自動保存されています）";
  }

  manualLoad() {
    if (this.mode === "solo") {
      const s = loadSolo();
      if (!s) { $("pausemsg").textContent = "セーブデータがありません"; return; }
      this.world.reset(s.seed);
      this.view.clear();
      this.world.importEdits(s.edits);
      this.time = s.time;
      this.applyPlayerSave(s.player);
      this.ready = false;
      this.state = "loading";
      $("pause").hidden = true;
      this.beginLoading("ロード中…");
    } else {
      const p = loadRoomPlayer(this.roomCode);
      if (!p) { $("pausemsg").textContent = "保存済みの位置がありません"; return; }
      this.applyPlayerSave(p);
      $("pausemsg").textContent = "保存した位置に戻りました";
    }
  }

  // ------------------------------------------------------------ frame
  frame(now: number) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    if (this.state === "title") {
      this.renderer.setClearColor(new THREE.Color(0.06, 0.08, 0.13));
      this.renderer.clear();
      return;
    }

    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }

    const loading = this.state === "loading";
    this.view.update(this.body.x, this.body.z, loading ? 6 : 2, loading ? 6 : 3);

    if (loading && !this.ready) {
      const r = this.view.readyRatio(this.body.x, this.body.z, 2);
      $("loadbar").style.width = `${Math.round(5 + r * 95)}%`;
      if (r >= 0.99 || performance.now() - this.loadStart > 10000) this.finishLoading();
    }

    if (this.ready) {
      this.updatePlayer(dt, now);
      this.updateTarget(now);
      if (now - this.lastAutosave > 15000) this.autosave();
      if (this.mode === "room") this.sendPos(now);
    }

    // 時間と空
    this.time = this.mode === "room" && this.ready ? this.roomTime() : (this.time + dt / DAY_LENGTH_SEC) % 1;
    const sky = skyAt(this.time);
    const eye = this.camera.position;
    const under = this.ready && inLiquid(this.world, eye.x, eye.y, eye.z);
    $("underwater").hidden = !under;
    let fog: [number, number, number] = sky.skyColor;
    const far = Math.max(40, this.settings.rd * 16 - 6);
    let near = far * 0.55, farD = far;
    if (under) { fog = [0.12 * sky.light[0], 0.28 * sky.light[1], 0.55 * sky.light[2]]; near = 1; farD = 30; }
    this.renderer.setClearColor(new THREE.Color(fog[0], fog[1], fog[2]));
    this.view.uniforms.uFog.value.set(fog[0], fog[1], fog[2]);
    this.view.uniforms.uLight.value.set(sky.light[0], sky.light[1], sky.light[2]);
    this.view.setFog(near, farD);
    this.sky.group.visible = !under;
    this.sky.update(this.time, this.camera, sky);

    this.remotes.update(dt, 0.3 + 0.7 * sky.daylight);
    this.updateOwnModel(dt, sky.daylight);
    this.updateInfo();
    this.renderer.render(this.scene, this.camera);
  }

  updatePlayer(dt: number, now: number) {
    const b = this.body;
    const active = this.state === "playing";
    const k = this.keys;
    if (!this.world.hasChunkAt(b.x, b.z)) return;

    const ix = active ? (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0) : 0;
    const iz = active ? (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0) : 0;
    const sprint = active && (k.has("ShiftLeft") || k.has("ShiftRight"));
    const jump = active && k.has("Space");
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let wx = -sin * iz + cos * ix, wz = -cos * iz - sin * ix;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }

    const feetWater = inLiquid(this.world, b.x, b.y + 0.3, b.z);
    const headWater = inLiquid(this.world, b.x, b.y + 1.4, b.z);
    let speed = 4.4;
    if (this.fly) speed = sprint ? 20 : 11;
    else if (feetWater) speed = 2.6;
    else if (sprint) speed = 6.4;

    const resp = this.fly ? 10 : b.onGround ? 14 : 4;
    const a = Math.min(1, dt * resp);
    b.vx += (wx * speed - b.vx) * a;
    b.vz += (wz * speed - b.vz) * a;

    if (this.fly) {
      const up = (jump ? 1 : 0) - (active && sprint ? 1 : 0);
      b.vy += (up * (sprint ? 14 : 9) - b.vy) * Math.min(1, dt * 10);
    } else if (feetWater) {
      b.vy -= 6 * dt;
      if (jump) b.vy = Math.min(b.vy + 28 * dt, 3.6);
      b.vy *= 1 - Math.min(1, dt * 2.5);
      if (headWater === false && jump && b.vy > 0) b.vy = Math.max(b.vy, 4.5);
    } else {
      b.vy = Math.max(-50, b.vy - 28 * dt);
      if (jump && b.onGround) b.vy = 8.6;
    }
    moveBody(this.world, b, dt);
    if (this.fly && b.onGround) { /* 着地しても飛行は維持 */ }
    if (b.y < -30) { b.x = this.spawn[0]; b.y = this.spawn[1] + 5; b.z = this.spawn[2]; b.vx = b.vy = b.vz = 0; toast("リスポーンしました"); }

    if (active) {
      if (this.mouseL && now - this.lastBreak > 190) { this.doBreak(); this.lastBreak = now; }
      if (this.mouseR && now - this.lastPlace > 220) { this.doPlace(); this.lastPlace = now; }
    }

    // カメラ
    const cx = b.x, cy = b.y + EYE_H, cz = b.z;
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    if (this.thirdPerson) {
      const dx = Math.sin(this.yaw) * Math.cos(this.pitch), dy = -Math.sin(this.pitch), dz = Math.cos(this.yaw) * Math.cos(this.pitch);
      // 視線の後ろ方向に最大4ブロック、壁があれば手前で止める
      const h = raycast(this.world, cx, cy, cz, dx, dy, dz, 4);
      const dist = h ? Math.max(0.5, Math.hypot(h.x + 0.5 - cx, h.y + 0.5 - cy, h.z + 0.5 - cz) - 0.9) : 4;
      this.camera.position.set(cx + dx * dist, cy + dy * dist, cz + dz * dist);
    } else this.camera.position.set(cx, cy, cz);
  }

  updateTarget(now: number) {
    void now;
    if (this.state !== "playing") { this.highlight.visible = false; this.target = null; return; }
    const o = new THREE.Vector3(this.body.x, this.body.y + EYE_H, this.body.z);
    const d = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    this.target = raycast(this.world, o.x, o.y, o.z, d.x, d.y, d.z, REACH);
    if (this.target) { this.highlight.visible = true; this.highlight.position.set(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5); }
    else this.highlight.visible = false;
  }

  updateOwnModel(dt: number, daylight: number) {
    if (!this.ownModel) { this.ownModel = new PlayerModel(this.profile.skin, null); this.scene.add(this.ownModel.root); }
    const m = this.ownModel;
    m.root.visible = this.thirdPerson && this.ready;
    if (!m.root.visible) return;
    m.root.position.set(this.body.x, this.body.y, this.body.z);
    m.root.rotation.y = this.yaw + Math.PI;
    m.animate(dt, Math.hypot(this.body.vx, this.body.vz));
    m.setLight(0.3 + 0.7 * daylight);
  }

  sendPos(now: number) {
    if (!this.net.connected || now - this.lastSend < 80) return;
    const b = this.body, l = this.lastSent;
    const moved = Math.abs(b.x - l.x) + Math.abs(b.y - l.y) + Math.abs(b.z - l.z) > 0.01 || Math.abs(this.yaw - l.yaw) > 0.01 || Math.abs(this.pitch - l.pitch) > 0.01;
    if (!moved && now - this.lastSend < 1000) return;
    this.lastSend = now;
    this.lastSent = { x: b.x, y: b.y, z: b.z, yaw: this.yaw, pitch: this.pitch };
    const r2 = (n: number) => Math.round(n * 100) / 100;
    this.net.send({ t: "pos", p: [r2(b.x), r2(b.y), r2(b.z)], r: [r2(this.yaw), r2(this.pitch)] });
  }

  updateInfo() {
    if (!this.ready) return;
    const b = this.body, hrs = (this.time * 24 + 6) % 24;
    const hh = String(Math.floor(hrs)).padStart(2, "0"), mm = String(Math.floor((hrs % 1) * 60)).padStart(2, "0");
    const st = this.view.stats;
    $("info").textContent =
      `${this.fps} FPS   ${hh}:${mm}${this.fly ? "   飛行" : ""}\n` +
      `XYZ ${b.x.toFixed(1)} ${b.y.toFixed(1)} ${b.z.toFixed(1)}\n` +
      `チャンク ${st.chunks} / 描画 ${st.meshed}   △ ${Math.round(st.triangles / 1000)}k` +
      (this.mode === "room" ? `\nプレイヤー ${this.remotes.count() + 1}人` : "");
  }
}

function clampN(v: unknown, lo: number, hi: number, def: number) {
  return typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : def;
}

new Game();
export type { PlayerInfo };
