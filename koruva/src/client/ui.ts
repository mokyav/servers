import { BLOCKS } from "../../shared/blocks";
import type { Skin } from "../../shared/protocol";
import { EFFECT_DEFS, type EffectLayer, type EffectId } from "../../shared/vitals";
import { blockIcon } from "./icons";
import { maxDurabilityForItemKey } from "../../shared/item-durability.js";
import { CHAT_HISTORY_MAX, loadChat, saveChat, type ChatLine } from "./save";

import { MOB_TYPES } from "../../shared/entities";

import { FOOD_DEFS } from "../../shared/food";

import { commonPrefix, suggestCommand, type SuggestContext, type Suggestion } from "../../shared/commands";

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

/** Count shown in the HUD is the quantity in that exact hotbar slot. */
export function hotbarSlotCount(itemId: number, amount: number, survival: boolean): number | null {
  if (!survival || !Number.isSafeInteger(itemId) || itemId <= 0) return null;
  return Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
}

export class Hotbar {
  private slots: HTMLElement[] = [];
  private invSlots: HTMLElement[] = [];
  constructor(
    private atlas: HTMLCanvasElement,
    private get: () => { hotbar: number[]; hotbarCounts: number[]; sel: number; survival: boolean; stackData?: Record<string, { itemId?: number; damage?: number }> },
    private onSelect: (i: number) => void,
    private onAssign: (blockId: number) => void,
  ) {
    const hb = $("hotbar"), ih = $("invhotbar");
    for (let i = 0; i < 9; i++) {
      hb.appendChild(this.mk(i, this.slots));
      ih.appendChild(this.mk(i, this.invSlots));
    }
  }
  /** インベントリ一覧を作り直す。クリエイティブは全カタログアイテム、サバイバルは所持品のみ。 */
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
      d.innerHTML = `<img loading="lazy" alt="${BLOCKS[it.id].name}" src="${blockIcon(this.atlas, it.id)}">` + (it.count !== null ? `<span class="c">${it.count}</span>` : "");
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
    const { hotbar, hotbarCounts, sel, survival, stackData } = this.get();
    for (const list of [this.slots, this.invSlots]) {
      list.forEach((el, i) => {
        const id = hotbar[i];
        const c = hotbarSlotCount(id, hotbarCounts[i] ?? 0, survival);
        el.className = "slot" + (i === sel ? " sel" : "") + (id && c === 0 ? " none" : "");
        el.title = id ? BLOCKS[id].name : "";
        el.innerHTML = (id ? `<img alt="" src="${blockIcon(this.atlas, id)}">` : "") + `<span class="n">${i + 1}</span>` +
          (id && c !== null ? `<span class="c">${c}</span>` : "");
        if (id > 0) {
          const maximum = maxDurabilityForItemKey(BLOCKS[id]?.key);
          const damage = Number(stackData?.[`hotbar:${i}`]?.damage ?? 0);
          if (maximum > 0 && damage > 0) {
            const remaining = Math.max(0, maximum - Math.floor(damage));
            const ratio = remaining / maximum;
            const bar = document.createElement("span"); bar.className = "slot-durability";
            const fill = document.createElement("i"); fill.style.width = `${ratio * 100}%`;
            fill.style.backgroundColor = ratio > 0.5 ? "#54c85a" : ratio > 0.25 ? "#e1c14a" : "#e14949";
            bar.appendChild(fill); el.appendChild(bar);
            el.title += ` · 耐久値 ${remaining}/${maximum}`;
          }
        }
      });
    }
  }
}

/** ピクセルテクスチャによるHP/満腹度表示。 */
export function renderHearts(health: number, maxHealth = 20, effects: EffectId[] = [], absorption = 0) {
  const el = $("hearts"); if (!el) return; el.textContent = "";
  const hp = Math.max(0, Number.isFinite(health) ? health : 0);
  const maxHp = Math.max(1, Number.isFinite(maxHealth) ? maxHealth : 20);
  const extraHp = Math.max(0, Number.isFinite(absorption) ? absorption : 0);
  const healthSlots = Math.min(20, Math.max(10, Math.ceil(maxHp / 2)));
  const count = Math.min(20, healthSlots + Math.ceil(extraHp / 2));
  const poison = effects.some(e => e === "poison" || e === "fatal_poison");
  const wither = effects.includes("wither");
  const base = poison ? "poison" : wither ? "wither" : "normal";
  for (let i = 0; i < count; i++) {
    let value: number, isAbsorption = false;
    if (i < healthSlots) value = hp - i * 2;
    else { value = extraHp - (i - healthSlots) * 2; isAbsorption = value > 0; }
    const kind = value >= 2 ? "full" : value >= 1 ? "half" : "empty";
    const img = document.createElement("img");
    const heartSprite = isAbsorption && kind !== "empty"
      ? `absorbing_${kind}`
      : kind === "empty" ? "container"
        : base === "poison" ? `poisoned_${kind}`
          : base === "wither" ? `withered_${kind}`
            : kind;
    img.src = `/assets/minecraft/textures/gui/sprites/hud/heart/${heartSprite}.png`;
    img.alt = isAbsorption ? `追加体力 ${kind}` : kind === "full" ? "体力" : kind === "half" ? "半分の体力" : "体力なし";
    img.draggable = false;
    img.className = "heart-slot" + (hp <= 4 && i < healthSlots && kind !== "empty" ? " shake" : "") + (isAbsorption && kind === "half" ? " absorption-half" : "");
    el.appendChild(img);
  }
  el.setAttribute("aria-label", `体力 ${hp}/${maxHp}${extraHp ? `、追加体力 ${extraHp}` : ""}`);
}
export function renderArmor(points: number) {
  const el = $("armor");
  if (!el) return;
  el.textContent = "";
  const armor = Math.max(0, Math.min(20, Number.isFinite(points) ? points : 0));
  el.hidden = armor <= 0;
  for (let i = 0; i < 10; i++) {
    const remaining = armor - i * 2;
    const sprite = remaining >= 2 ? "armor_full" : remaining >= 1 ? "armor_half" : "armor_empty";
    const img = document.createElement("img");
    img.src = `/assets/minecraft/textures/gui/sprites/hud/${sprite}.png`;
    img.alt = remaining >= 2 ? "防具" : remaining >= 1 ? "半分の防具" : "防具なし";
    img.draggable = false;
    el.appendChild(img);
  }
  el.setAttribute("aria-label", `防具 ${armor}/20`);
}

export function renderHunger(value: number, hungerEffect = false) {
  const el=$("hunger"); el.textContent=""; const safe=Math.max(0,Math.min(20,value));
  for(let i=0;i<10;i++){
    const remaining=safe-i*2; const kind=remaining>=2?"full":remaining>=1?"half":"empty";
    const img=document.createElement("img");img.className="food-icon"+(hungerEffect?" hunger-effect":"");
    img.src=`/assets/minecraft/textures/gui/sprites/hud/food_${kind}${hungerEffect?"_hunger":""}.png`;
    img.alt=kind==="full"?"満腹":kind==="half"?"半分の満腹度":"空腹";img.draggable=false;el.appendChild(img);
  }
  el.setAttribute("aria-label",`満腹度 ${safe}/20`);
}
export function renderEffects(containerId: string, effects: EffectLayer[]) {
  const el=$(containerId); if(!el)return; el.textContent="";
  const live=effects.filter(e=>e.durationTicks>0);
  if(!live.length){if(containerId==="inventory-effects"){const empty=document.createElement("span");empty.className="effect-empty";empty.textContent="効果なし";el.appendChild(empty);}return;}
  for(const e of live){const def=EFFECT_DEFS[e.effectId];const row=document.createElement("div");row.className="effect-item"+(e.durationTicks<200?" expiring":"");row.style.setProperty("--effect-color",def.color);if(e.durationTicks<200)row.style.setProperty("--effect-blink",`${Math.max(0.12,Math.min(0.65,e.durationTicks/200))}s`);
    const seconds=Math.ceil(e.durationTicks/20);const mm=Math.floor(seconds/60);const ss=String(seconds%60).padStart(2,"0");
    const level=e.amplifier===0?"I":e.amplifier===1?"II":e.amplifier===2?"III":String(e.amplifier+1);
    const img=document.createElement("img");img.src=`/assets/effects/${def.icon}`;img.alt=def.name;img.draggable=false;
    const label=document.createElement("span");label.textContent=`${def.name} ${level} · ${mm}:${ss}`;
    row.title=`${def.name} レベル${e.amplifier+1}、残り ${mm}:${ss}`;row.append(img,label);el.appendChild(row);
  }
}

function completeChatCommand(input: HTMLInputElement): boolean {
  const caret = input.selectionStart ?? input.value.length;
  const before = input.value.slice(0, caret);
  if (!before.startsWith("/")) return false;
  const token = /\S*$/.exec(before)?.[0] ?? "";
  const tokenStart = caret - token.length;
  const words = before.trimStart().split(/\s+/);
  const index = /\s$/.test(before) ? words.length : words.length - 1;
  const command = (words[0] ?? "").replace(/^\/+/, "").toLowerCase();
  const sub = (words[1] ?? "").toLowerCase();
  const listText = document.getElementById("playerlist")?.textContent ?? "";
  const names = Array.from(new Set(listText.match(/[A-Za-z0-9_]{1,16}/g) ?? []))
    .filter(n => !/^(players?|host)$/i.test(n));
  let choices: string[] = [];
  if (index === 0) choices = ["effect", "gamemode", "difficulty", "givefood"];
  else if (command === "effect" && index === 1) choices = ["give", "clear"];
  else if (command === "effect" && index === 2 && (sub === "give" || sub === "clear")) choices = ["@a", "@s", ...names];
  else if (command === "effect" && index === 3 && (sub === "give" || sub === "clear")) choices = Object.keys(EFFECT_DEFS);
  else if (command === "gamemode" && index === 1) choices = ["survival", "creative", "adventure", "spectator"];
  else if (command === "difficulty" && index === 1) choices = ["peaceful", "easy", "normal", "hard"];
  const matches = choices.filter(c => c.toLowerCase().startsWith(token.toLowerCase()));
  if (!matches.length) return false;
  const selected = matches[0];
  const addSpace = index < 3 || (command === "effect" && sub === "give" && index === 3);
  input.setRangeText(selected + (addSpace ? " " : ""), tokenStart, caret, "end");
  return true;
}

export class Chat {
  private log = $("chatlog");
  private lines: HTMLElement[] = [];
  private history: ChatLine[] = [];
  private scope = "solo";
  private open = false;
  /** Tab 補完候補(複数あるときは入力欄の上にポップアップ) */
  private suggestEl = document.getElementById("chatsuggest");
  private opts: string[] = [];
  private sel = -1;
  private range = { start: 0, end: 0 };
  private addSpace = true;
  private nameProvider: () => string[] = () => [];
  setNameProvider(fn: () => string[]) { this.nameProvider = fn; }

  private ctx(): SuggestContext {
    return { players: this.nameProvider(), items: BLOCKS.slice(1).filter(b => b.itemId === b.id).map(b => b.key), foods: Object.keys(FOOD_DEFS), effects: Object.keys(EFFECT_DEFS), mobs: [...MOB_TYPES] };
  }
  private compute(input: HTMLInputElement): Suggestion | null {
    return suggestCommand(input.value, input.selectionStart ?? input.value.length, this.ctx());
  }
  private hideSuggest() {
    this.opts = []; this.sel = -1;
    if (this.suggestEl) { this.suggestEl.hidden = true; this.suggestEl.textContent = ""; }
  }
  private showSuggest(input: HTMLInputElement, sug: Suggestion, selected = -1) {
    if (!this.suggestEl) return;
    this.opts = sug.options; this.sel = selected; this.range = { start: sug.start, end: sug.end }; this.addSpace = sug.addSpace;
    this.paintSuggest(input);
  }
  private paintSuggest(input: HTMLInputElement) {
    const el = this.suggestEl; if (!el) return;
    el.textContent = "";
    this.opts.forEach((o, i) => {
      const d = document.createElement("div");
      d.className = "opt" + (i === this.sel ? " on" : "");
      d.textContent = o;
      d.addEventListener("mousedown", (ev) => { ev.preventDefault(); this.choose(input, i); this.hideSuggest(); });
      el.appendChild(d);
    });
    el.hidden = !this.opts.length;
    el.querySelector(".on")?.scrollIntoView({ block: "nearest" });
  }
  /** i 番目の候補を入力欄へ反映(直前に入れた候補は置き換える) */
  private choose(input: HTMLInputElement, i: number) {
    const text = this.opts[i] + (this.addSpace ? " " : "");
    input.setRangeText(text, this.range.start, this.range.end, "end");
    this.range.end = this.range.start + text.length;
    this.sel = i;
    this.paintSuggest(input);
  }

  constructor() {
    const input = $("chatinput") as HTMLInputElement;
    input?.addEventListener("input", () => {
      const sug = this.compute(input);
      // 完全一致で次の引数も無いときは出さない
      if (!sug || (sug.options.length === 1 && input.value.slice(sug.start, sug.end).toLowerCase() === sug.options[0].toLowerCase() && !sug.addSpace)) this.hideSuggest();
      else this.showSuggest(input, sug);
    });
    input?.addEventListener("focus", () => this.hideSuggest());
    input?.addEventListener("keydown", (event) => {
      if (event.isComposing) return;
      const open = !!this.opts.length && !!this.suggestEl && !this.suggestEl.hidden;
      const stop = () => { event.preventDefault(); event.stopImmediatePropagation(); };
      if (event.key === "Tab") {
        const back = event.shiftKey;
        stop();
        if (open) { this.choose(input, back ? (this.sel <= 0 ? this.opts.length - 1 : this.sel - 1) : (this.sel + 1) % this.opts.length); return; }
        const sug = this.compute(input); if (!sug) return;
        if (sug.options.length === 1) { this.opts = sug.options; this.range = { start: sug.start, end: sug.end }; this.addSpace = sug.addSpace; this.choose(input, 0); this.hideSuggest(); return; }
        const token = input.value.slice(sug.start, sug.end), prefix = commonPrefix(sug.options);
        let end = sug.end;
        if (prefix.length > token.length) { input.setRangeText(prefix, sug.start, sug.end, "end"); end = sug.start + prefix.length; }
        this.showSuggest(input, { ...sug, end }, -1);
        return;
      }
      if (open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        stop();
        const n = this.opts.length;
        this.choose(input, event.key === "ArrowDown" ? (this.sel + 1) % n : (this.sel <= 0 ? n - 1 : this.sel - 1));
        return;
      }
      if (open && event.key === "Enter" && this.sel >= 0) { stop(); this.hideSuggest(); return; } // 候補を確定(送信はしない)
      if (open && event.key === "Escape") { stop(); this.hideSuggest(); return; }
      if (event.key === "Enter") this.hideSuggest();
    });
  }

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
