/** チャットコマンドの補完(Tab / 候補ポップアップ)。クライアントとテストで共有する純粋関数。 */
export const SELECTORS = ["@a", "@r", "@s", "@p"] as const;
export const GAMERULES = ["keepInventory", "pvp"] as const;
export type GameRuleName = (typeof GAMERULES)[number];
export const COMMANDS = ["clear", "claer", "difficulty", "dimension", "effect", "gamemode", "give", "givefood", "kill", "summon", "tp"] as const;

export interface SuggestContext {
  players: string[];
  items: string[];
  foods: string[];
  effects: string[];
  mobs: string[];
}
export interface Suggestion {
  /** 置き換える範囲(text 上の添字) */
  start: number;
  end: number;
  options: string[];
  /** 確定時に末尾へ空白を付けるか(次の引数がある場合) */
  addSpace: boolean;
}

const MODES = ["survival", "creative", "adventure", "spectator"];
const DIFFICULTIES = ["easy", "normal", "hard"];

type ArgKind = "target" | "targetClear" | "targetOrCoord" | "targetOrMob" | "item" | "food" | "effect" | "mob" | "coord" | string[] | null;

/** index = コマンド名の次を 0 とした引数の位置。prev = それより前の引数 */
function argKind(cmd: string, index: number, prev: string[]): { kind: ArgKind; more: boolean } {
  if (!(COMMANDS as readonly string[]).includes(cmd)) return { kind: null, more: false };
  const sub = (prev[0] ?? "").toLowerCase();
  switch (cmd) {
    case "dimension": return { kind: index === 0 ? ["overworld", "nether", "end"] : null, more: false };
    case "gamemode": return { kind: index === 0 ? MODES : null, more: false };
    case "difficulty": return { kind: index === 0 ? DIFFICULTIES : null, more: false };
    case "gamerule":
      if (index === 0) return { kind: [...GAMERULES], more: true };
      return { kind: index === 1 ? ["true", "false"] : null, more: false };
    case "summon": return { kind: index === 0 ? "mob" : null, more: false };
    case "kill": return { kind: index === 0 ? "targetOrMob" : null, more: false };
    case "clear": case "claer":
      return { kind: index === 0 ? "targetClear" : null, more: false };
    case "give":
      if (index === 0) return { kind: "target", more: true };
      if (index === 1) return { kind: "item", more: true };
      return { kind: null, more: false };
    case "givefood":
      if (index === 0) return { kind: "target", more: true };
      if (index === 1) return { kind: "food", more: true };
      return { kind: null, more: false };
    case "effect":
      if (index === 0) return { kind: ["give", "clear"], more: true };
      if (index === 1) return { kind: "target", more: true };
      if (index === 2) return { kind: sub === "give" || sub === "clear" ? "effect" : null, more: sub === "give" };
      return { kind: null, more: sub === "give" && index < 4 };
    case "tp":
      // /tp <destination> | /tp <targets> <destination> | /tp [<targets>] <x> <y> <z>
      if (index === 0 || index === 1) return { kind: "targetOrCoord", more: true };
      if (index === 2 || index === 3) return { kind: "coord", more: index === 2 };
      return { kind: null, more: false };
    default: return { kind: null, more: false };
  }
}

function pool(kind: ArgKind, ctx: SuggestContext, index: number): string[] {
  if (kind === null) return [];
  if (Array.isArray(kind)) return kind;
  switch (kind) {
    case "target": return [...SELECTORS, ...ctx.players, ...(index === 1 ? ["~"] : [])];
    case "targetClear": return [...SELECTORS, ...ctx.players, ...ctx.players.map(name => `:${name}`)];
    case "targetOrCoord": return [...SELECTORS, ...ctx.players, "~"];
    case "targetOrMob": return [...SELECTORS, ...ctx.players, "@e"];
    case "item": return ctx.items;
    case "food": return ctx.foods;
    case "effect": return ctx.effects;
    case "mob": return ctx.mobs;
    case "coord": return ["~"];
    default: return [];
  }
}

/** caret 位置の語に対する候補。"/" で始まらない、または候補が無ければ null。 */
export function suggestCommand(text: string, caret: number, ctx: SuggestContext): Suggestion | null {
  const before = text.slice(0, caret);
  if (!before.startsWith("/")) return null;
  const token = /\S*$/.exec(before)?.[0] ?? "";
  const start = caret - token.length;
  const words = before.slice(1).split(/\s+/); // 末尾の語 = 編集中の語(空白直後は "")
  const index = words.length - 1;
  const lower = token.toLowerCase();
  let options: string[]; let addSpace = true;
  if (index === 0) {
    options = [...COMMANDS];
  } else {
    const cmd = (words[0] ?? "").toLowerCase();
    const { kind, more } = argKind(cmd, index - 1, words.slice(1, -1));
    options = pool(kind, ctx, index - 1);
    addSpace = more;
  }
  const seen = new Set<string>();
  const matches = options.filter((o) => {
    if (seen.has(o) || !o.toLowerCase().startsWith(index === 0 ? lower.replace(/^\//, "") : lower)) return false;
    seen.add(o); return true;
  });
  if (!matches.length) return null;
  const from = index === 0 ? start + 1 : start; // コマンド名は "/" を残す
  return { start: from, end: caret, options: matches, addSpace };
}

/** 候補の共通接頭辞(大文字小文字は先頭候補に合わせる) */
export function commonPrefix(options: string[]): string {
  if (!options.length) return "";
  let p = options[0];
  for (const o of options.slice(1)) { let i = 0; while (i < p.length && i < o.length && p[i].toLowerCase() === o[i].toLowerCase()) i++; p = p.slice(0, i); }
  return p;
}
