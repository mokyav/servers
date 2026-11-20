import { BLOCKS } from "../../shared/blocks";
import type { Skin } from "../../shared/protocol";
import { EFFECT_DEFS, type EffectLayer, type EffectId } from "../../shared/vitals";
import { blockIcon } from "./icons";
import { CHAT_HISTORY_MAX, loadChat, saveChat, type ChatLine } from "./save";

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const skinPreviewImages = new Map<string, HTMLImageElement>();

/** スキンの2Dプレビュー(タイトル画面) */
export function drawSkinPreview(cv: HTMLCanvasElement, s: Skin) {
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const k = cv.width / 16;
  const rect = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x * k, y * k, w * k, h * k); };
  const placeholder = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    rect(4, 0, 8, 8, s.skin); rect(4, 0, 8, 3, s.hair); rect(3, 3, 1, 3, s.hair); rect(12, 3, 1, 3, s.hair);
    rect(5, 5, 2, 2, "#fff"); rect(9, 5, 2, 2, "#fff"); rect(6, 5, 1, 2, "#2a3550"); rect(9, 5, 1, 2, "#2a3550");
    rect(3, 8, 10, 10, s.shirt); rect(0, 8, 3, 10, s.shirt); rect(13, 8, 3, 10, s.shirt);
    rect(0, 15, 3, 3, s.skin); rect(13, 15, 3, 3, s.skin);
    rect(4, 18, 4, 10, s.pants); rect(8, 18, 4, 10, s.pants); rect(4, 26, 4, 2, "#2b2b30"); rect(8, 26, 4, 2, "#2b2b30");
  };
  if (!s.image) { delete cv.dataset.skinImage; placeholder(); return; }
  cv.dataset.skinImage = s.image;
  const image = new Image();
  image.onload = () => {
    if (cv.dataset.skinImage !== s.image) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const crop = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw = sw, dh = sh) => {
      ctx.drawImage(image, sx, sy, sw, sh, dx * k, dy * k, dw * k, dh * k);
    };
    const part = (base: [number, number], overlay: [number, number], sw: number, sh: number, dx: number, dy: number, dw = sw, dh = sh) => {
      crop(base[0], base[1], sw, sh, dx, dy, dw, dh);
      crop(overlay[0], overlay[1], sw, sh, dx, dy, dw, dh);
    };
    part([8, 8], [40, 8], 8, 8, 4, 0);
    part([20, 20], [20, 36], 8, 12, 4, 8, 8, 10);
    // Front view: player's right limb is on the viewer's left.
    const armWidth = s.model === "slim" ? 3 : 4;
    part([44, 20], [44, 36], armWidth, 12, 0, 8, armWidth, 10);
    part([36, 52], [52, 52], armWidth, 12, 16 - armWidth, 8, armWidth, 10);
    part([4, 20], [4, 36], 4, 12, 4, 18, 4, 10);
    part([20, 52], [4, 52], 4, 12, 8, 18, 4, 10);
  };
  image.onerror = () => { if (cv.dataset.skinImage === s.image) placeholder(); };
  image.src = s.image;
}

const PALETTE = {
  skin: ["#f1c9a5", "#e8b48a", "#c68a5e", "#8d5a3b", "#5c3b27", "#f6d6c0"],
  hair: ["#2b1d14", "#4a3022", "#8a5a2b", "#d9b45a", "#c0392b", "#e5e5e5", "#3b82c4"],
  shirt: ["#3b82c4", "#d0453a", "#4aa860", "#e0b43a", "#8a56c6", "#e8e8ee", "#2f2f38"],
  pants: ["#2f3a63", "#3a3a40", "#6a4a2a", "#2d5a3d", "#7a2f3a", "#4d5d7a"],
};
export function randomSkin(): Skin {
  const p = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  return { skin: p(PALETTE.skin), hair: p(PALETTE.hair), shirt: p(PALETTE.shirt), pants: p(PALETTE.pants) };
}

export interface InvItem { id: number; count: number | null } // count=null → 無限(クリエイティブ)

export class Hotbar {
  private slots: HTMLElement[] = [];
  private invSlots: HTMLElement[] = [];
  constructor(
    private atlas: HTMLCanvasElement,
    private get: () => { hotbar: number[]; sel: number; count: (id: number) => number | null },
    private onSelect: (i: number) => void,
    private onAssign: (blockId: number) => void,
  ) {
    const hb = $("hotbar"), ih = $("invhotbar");
    for (let i = 0; i < 9; i++) {
      hb.appendChild(this.mk(i, this.slots));
      ih.appendChild(this.mk(i, this.invSlots));
    }
  }
  /** インベントリ一覧を作り直す。クリエイティブは全ブロック、サバイバルは所持品のみ。 */
  setInventory(items: InvItem[]) {
    const grid = $("invgrid");
    grid.textContent = "";
    if (items.length === 0) {
      const e = document.createElement("div");
      e.className = "empty";
      e.textContent = "まだアイテムを持っていません。ブロックを壊して集めよう";
      grid.appendChild(e);
      return;
    }
    for (const it of items) {
      const d = document.createElement("div");
      d.className = "slot";
      d.title = BLOCKS[it.id].name;
      d.innerHTML = `<img alt="${BLOCKS[it.id].name}" src="${blockIcon(this.atlas, it.id)}">` + (it.count !== null ? `<span class="c">${it.count}</span>` : "");
      d.addEventListener("click", () => this.onAssign(it.id));
      grid.appendChild(d);
    }
  }
  private mk(i: number, list: HTMLElement[]) {
    const d = document.createElement("div");
    d.className = "slot";
    d.addEventListener("click", (e) => { e.stopPropagation(); this.onSelect(i); });
    list.push(d);
    return d;
  }
  refresh() {
    const { hotbar, sel, count } = this.get();
    for (const list of [this.slots, this.invSlots]) {
      list.forEach((el, i) => {
        const id = hotbar[i];
        const c = id ? count(id) : null;
        el.className = "slot" + (i === sel ? " sel" : "") + (id && c === 0 ? " none" : "");
        el.title = id ? BLOCKS[id].name : "";
        el.innerHTML = (id ? `<img alt="" src="${blockIcon(this.atlas, id)}">` : "") + `<span class="n">${i + 1}</span>` +
          (id && c !== null ? `<span class="c">${c}</span>` : "");
      });
    }
  }
}

/** ピクセルテクスチャによるHP/満腹度表示。 */
export function renderHearts(hp: number, maxHp = 20, effects: EffectId[] = [], absorption = 0) {
  const el=$("hearts"); el.textContent=""; const toxic=effects.includes("poison"), wither=effects.includes("wither"), frozen=effects.includes("darkness");
  for(let i=0;i<10;i++){
    const value=hp-i*2; const kind=value>=2?"full":value>=1?"half":"empty";
    const span=document.createElement("span"); span.className="heart"+(hp<=4?" shake":"");
    const img=document.createElement("img"); img.alt=kind==="full"?"体力":kind==="half"?"半分の体力":"空の体力";
    const base=toxic?"poison":wither?"wither":frozen?"freezing":"normal";
    img.src=`/assets/hud/heart-${base}-${kind}.png`; img.draggable=false;
    if(kind==="empty"&&absorption>i*2){img.src="/assets/hud/heart-absorption.png";img.alt="衝撃吸収";}
    span.appendChild(img);el.appendChild(span);
  }
  el.setAttribute("aria-label",`体力 ${hp}/${maxHp}`);
}
export function renderHunger(value: number, hungerEffect = false) {
  const el=$("hunger"); el.textContent=""; const safe=Math.max(0,Math.min(20,value));
  for(let i=0;i<10;i++){
    const remaining=safe-i*2; const kind=remaining>=2?"full":remaining>=1?"half":"empty";
    const img=document.createElement("img");img.className="food-icon"+(hungerEffect?" hunger-effect":"");
    img.src=`/assets/hud/${kind==="full"?"hunger":kind==="half"?"half-hunger":"empty-hunger"}.svg`;
    img.alt=kind==="full"?"満腹":kind==="half"?"半分の満腹度":"空腹";img.draggable=false;el.appendChild(img);
  }
  el.setAttribute("aria-label",`満腹度 ${safe}/20`);
}
export function renderEffects(containerId: string, effects: EffectLayer[]) {
  const el=$(containerId); if(!el)return; el.textContent="";
  const live=effects.filter(e=>e.durationTicks>0);
  if(!live.length){if(containerId==="inventory-effects"){const empty=document.createElement("span");empty.className="effect-empty";empty.textContent="効果なし";el.appendChild(empty);}return;}
  for(const e of live){const def=EFFECT_DEFS[e.effectId];const row=document.createElement("div");row.className="effect-item"+(e.durationTicks<200?" expiring":"");
    const seconds=Math.ceil(e.durationTicks/20);const mm=Math.floor(seconds/60);const ss=String(seconds%60).padStart(2,"0");
    const level=e.amplifier===0?"I":e.amplifier===1?"II":e.amplifier===2?"III":String(e.amplifier+1);
    const img=document.createElement("img");img.src=`/assets/effects/${def.icon}`;img.alt=def.name;img.draggable=false;
    const label=document.createElement("span");label.textContent=`${def.name} ${level} · ${mm}:${ss}`;
    row.title=`${def.name} レベル${e.amplifier+1}、残り ${mm}:${ss}`;row.append(img,label);el.appendChild(row);
  }
}

export class Chat {
  private log = $("chatlog");
  private lines: HTMLElement[] = [];
  private history: ChatLine[] = [];
  private scope = "solo";
  private open = false;

  /** 保存先(ルームコード / "solo")を切り替えて履歴を読み込む */
  setScope(scope: string) {
    this.scope = scope || "solo";
    this.history = loadChat(this.scope);
    this.clearView();
  }

  private clearView() {
    this.log.textContent = "";
    this.lines = [];
  }

  private render(l: ChatLine): HTMLElement {
    const el = document.createElement("div");
    el.className = "line" + (l.name === undefined ? " sys" : "");
    if (l.name !== undefined) {
      const b = document.createElement("b");
      b.textContent = l.name;
      el.append(b, document.createTextNode(": " + l.text));
    } else el.textContent = l.text;
    return el;
  }

  add(text: string, name?: string) {
    const line: ChatLine = name === undefined ? { text } : { text, name };
    this.history.push(line);
    if (this.history.length > CHAT_HISTORY_MAX) this.history.splice(0, this.history.length - CHAT_HISTORY_MAX);
    saveChat(this.scope, this.history);

    const el = this.render(line);
    this.log.appendChild(el);
    this.lines.push(el);
    if (this.open) {
      // チャットを開いている間は履歴として全て残す
      while (this.lines.length > CHAT_HISTORY_MAX) this.lines.shift()!.remove();
      this.log.scrollTop = this.log.scrollHeight;
      return;
    }
    while (this.lines.length > 10) this.lines.shift()!.remove();
    setTimeout(() => { el.style.opacity = "0"; }, 9000);
    setTimeout(() => { el.remove(); this.lines = this.lines.filter((l) => l !== el); }, 9700);
  }

  /** 開いたら保存済みの履歴(最大30件)を全て表示。閉じたら通常の一時表示に戻す。 */
  setOpen(open: boolean) {
    this.open = open;
    this.clearView();
    this.log.classList.toggle("open", open);
    if (!open) return;
    for (const l of this.history) {
      const el = this.render(l);
      this.log.appendChild(el);
      this.lines.push(el);
    }
    this.log.scrollTop = this.log.scrollHeight;
  }
}

let toastTimer = 0;
export function toast(msg: string, ms = 1600) {
  const t = $("toast");
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { t.style.opacity = "0"; }, ms);
}
