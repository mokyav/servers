const BASE = "/assets/sounds/";
const VOLUME_KEY = "koruva.volume";
const MAX_VOICES = 24;
const MAX_BUFFER_CACHE = 48;
const MAX_PLAY_KEYS = 512;

export type Vec = [number, number, number];
export interface PlayOpts {
  volume?: number;
  pitch?: number;
  at?: Vec;
  range?: number;
  key?: string;
  minGap?: number;
}
export type BlockSoundKind = "break" | "place" | "hit" | "step";
type Material = "stone" | "wood" | "grass" | "gravel" | "sand" | "snow" | "cloth" | "coral" | "wet_grass" | "glass" | "metal" | "ladder";

export function blockMaterial(blockKey: string): Material {
  const key = String(blockKey ?? "").replace(/^minecraft:/, "").toLowerCase();
  const has = (...words: string[]) => words.some(word => key.includes(word));
  if (key.endsWith("_ore") || has("sandstone", "nether_brick", "stone_brick", "mud_brick", "terracotta")) return "stone";
  if (has("glass", "ice") && !has("glazed")) return "glass";
  if (key === "ladder" || has("scaffolding")) return "ladder";
  if (has("coral")) return "coral";
  if (has("wool", "carpet", "_bed", "banner", "cactus")) return "cloth";
  if (has("snow")) return "snow";
  if (has("sand", "concrete_powder")) return "sand";
  if (has("mud", "mangrove_roots")) return "wet_grass";
  if (has("gravel", "dirt", "clay", "farmland", "soul_soil")) return "gravel";
  if (has("grass", "leaves", "fern", "vine", "moss", "sapling", "flower", "tulip", "dandelion", "poppy",
    "orchid", "allium", "bluet", "cornflower", "lily", "bush", "azalea", "sprouts", "crop", "wheat",
    "carrots", "potatoes", "beetroots", "melon", "pumpkin", "sugar_cane", "kelp", "seagrass",
    "hay_block", "mycelium", "podzol", "peony", "lilac")) return "grass";
  if (has("iron", "gold_block", "copper", "netherite", "chain", "anvil", "bell", "lantern", "rail", "hopper", "cauldron")) return "metal";
  if (has("planks", "log", "wood", "stem", "hyphae", "chest", "barrel", "crafting_table", "bookshelf",
    "fence", "sign", "door", "note_block", "jukebox", "bamboo", "composter", "lectern", "loom", "torch")) return "wood";
  return "stone";
}

const MOB_DIR: Record<string, string> = {
  cave_spider: "mob/spider",
  cod: "entity/fish", salmon: "entity/fish", tropical_fish: "entity/fish", pufferfish: "entity/fish",
  copper_golem: "mob/coppergolem",
  donkey: "mob/horse/donkey", mule: "mob/horse/donkey", skeleton_horse: "mob/horse", zombie_horse: "mob/horse",
  elder_guardian: "mob/guardian", ender_dragon: "mob/enderdragon", enderman: "mob/endermen",
  endermite: "mob/silverfish", evoker: "mob/evocation_illager", vindicator: "mob/vindication_illager",
  iron_golem: "mob/irongolem", magma_cube: "mob/magmacube", ocelot: "mob/cat", polar_bear: "mob/polarbear",
  snow_golem: "entity/snowman", shulker: "entity/shulker", witch: "entity/witch", trader_llama: "mob/llama",
  zombified_piglin: "mob/pigzombie", wither_skeleton: "mob/skeleton",
};
const MOB_RE = {
  say: /^(say|idle|ambient|breathe|moan|growl|moody|meow|bark|cackle|elder_idle)/,
  hurt: /^(elder_)?(hurt|hit|damage)/,
  death: /^(elder_)?death/,
} as const;
export type MobSoundKind = keyof typeof MOB_RE;

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const escapeRegExp = (value: string) => value.replace(/[.*+?^$|()[\]\\]/g, "\\$&");

class SoundEngine {
  volume = 0.6;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private files = new Set<string>();
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private pools = new Map<string, string[]>();
  private lastPick = new Map<string, string>();
  private lastPlay = new Map<string, number>();
  private voices = 0;
  private pendingVoices = 0;
  private listener = { x: 0, y: 0, z: 0, yaw: 0 };

  async init() {
    try {
      const saved = localStorage.getItem(VOLUME_KEY);
      if (saved !== null) {
        const value = Number(saved);
        if (Number.isFinite(value)) this.volume = Math.max(0, Math.min(1, value));
      }
      if (this.master) this.master.gain.value = this.volume;
    } catch { /* localStorage can be unavailable */ }
    try {
      const response = await fetch(BASE + "manifest.json", { cache: "force-cache" });
      if (!response.ok) return;
      const data: unknown = await response.json();
      if (!Array.isArray(data)) return;
      const files = new Set<string>();
      for (const entry of data) {
        if (typeof entry !== "string" || !entry.endsWith(".ogg")) continue;
        if (entry.startsWith("/") || entry.split("/").some(part => part === "..")) continue;
        files.add(entry);
      }
      this.files = files;
      this.pools.clear();
    } catch { /* absent sound assets leave the game playable and silent */ }
  }

  unlock() {
    try {
      if (!this.context) {
        const win = window as Window & { webkitAudioContext?: typeof AudioContext };
        const Constructor = window.AudioContext ?? win.webkitAudioContext;
        if (!Constructor) return;
        this.context = new Constructor();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === "suspended") void this.context.resume().catch(() => undefined);
    } catch { /* unsupported or restricted audio environment */ }
  }

  setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.value = this.volume;
    try { localStorage.setItem(VOLUME_KEY, String(this.volume)); } catch { /* storage can be unavailable */ }
  }

  setListener(x: number, y: number, z: number, yaw: number) {
    if (![x, y, z, yaw].every(Number.isFinite)) return;
    this.listener = { x, y, z, yaw };
  }

  pool(directory: string, expression: RegExp): string[] {
    const normalized = directory.replace(/^\/+|\/+$/g, "");
    const cacheKey = normalized + "|" + expression.source + "|" + expression.flags;
    const cached = this.pools.get(cacheKey);
    if (cached) return cached;
    const prefix = normalized + "/";
    const regex = new RegExp(expression.source, expression.flags.replace(/[gy]/g, ""));
    const matches: string[] = [];
    for (const file of this.files) {
      if (!file.startsWith(prefix)) continue;
      const relative = file.slice(prefix.length);
      const basename = relative.slice(relative.lastIndexOf("/") + 1);
      if (regex.test(basename)) matches.push(file);
    }
    const direct = matches.filter(file => !file.slice(prefix.length).includes("/"));
    const result = direct.length ? direct : matches;
    this.pools.set(cacheKey, result);
    return result;
  }

  private trimBuffers() {
    while (this.buffers.size > MAX_BUFFER_CACHE) {
      const oldest = this.buffers.keys().next();
      if (oldest.done) break;
      this.buffers.delete(oldest.value);
    }
  }

  private load(path: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(path);
    if (cached) return cached;
    const context = this.context;
    const promise = (async () => {
      if (!context) return null;
      try {
        const response = await fetch(BASE + path, { cache: "force-cache" });
        if (!response.ok) return null;
        return await context.decodeAudioData(await response.arrayBuffer());
      } catch { return null; }
    })();
    this.buffers.set(path, promise);
    this.trimBuffers();
    return promise;
  }

  play(path: string | undefined, options: PlayOpts = {}) {
    if (!path || !this.context || !this.master || this.volume <= 0) return;
    const normalized = path.replace(/^\/+/, "");
    const file = normalized.endsWith(".ogg") ? normalized : normalized + ".ogg";
    if (!this.files.has(file)) return;
    const now = performance.now() / 1000;
    const key = options.key ?? file;
    if (now - (this.lastPlay.get(key) ?? -Infinity) < Math.max(0, options.minGap ?? 0.03)) return;
    if (this.voices + this.pendingVoices >= MAX_VOICES) return;

    let gain = Math.max(0, Math.min(2, options.volume ?? 1));
    let pan = 0;
    if (options.at) {
      const dx = options.at[0] - this.listener.x;
      const dy = options.at[1] - this.listener.y;
      const dz = options.at[2] - this.listener.z;
      const distance = Math.hypot(dx, dy, dz);
      const range = Math.max(0.1, options.range ?? 16);
      if (!Number.isFinite(distance) || distance >= range) return;
      gain *= Math.pow(1 - distance / range, 1.5);
      if (distance > 0.5) pan = Math.max(-1, Math.min(1,
        (dx * Math.cos(this.listener.yaw) - dz * Math.sin(this.listener.yaw)) / distance));
    }
    if (gain < 0.01) return;
    this.lastPlay.set(key, now);
    if (this.lastPlay.size > MAX_PLAY_KEYS) {
      const oldest = this.lastPlay.keys().next();
      if (!oldest.done) this.lastPlay.delete(oldest.value);
    }

    this.pendingVoices++;
    const context = this.context;
    const master = this.master;
    void this.load(file).then(buffer => {
      if (!buffer) return;
      const source = context.createBufferSource();
      const gainNode = context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = Math.max(0.25, Math.min(4, options.pitch ?? 1));
      gainNode.gain.value = gain;
      source.connect(gainNode);
      let panner: StereoPannerNode | null = null;
      if (pan !== 0 && typeof context.createStereoPanner === "function") {
        panner = context.createStereoPanner();
        panner.pan.value = pan;
        gainNode.connect(panner);
        panner.connect(master);
      } else gainNode.connect(master);
      this.voices++;
      source.onended = () => {
        this.voices = Math.max(0, this.voices - 1);
        source.disconnect(); gainNode.disconnect(); panner?.disconnect();
      };
      try { source.start(0); }
      catch {
        this.voices = Math.max(0, this.voices - 1);
        source.disconnect(); gainNode.disconnect(); panner?.disconnect();
      }
    }).catch(() => undefined).finally(() => {
      this.pendingVoices = Math.max(0, this.pendingVoices - 1);
    });
  }

  playPool(directory: string, expression: RegExp, options: PlayOpts = {}) {
    const list = this.pool(directory, expression);
    if (!list.length) return;
    const key = directory + "|" + expression.source;
    let selected = list[Math.floor(Math.random() * list.length)];
    const previous = this.lastPick.get(key);
    if (list.length > 1 && selected === previous) selected = list[(list.indexOf(selected) + 1) % list.length];
    this.lastPick.set(key, selected);
    this.play(selected, { ...options, key: options.key ?? key });
  }

  fx(path: string, options: PlayOpts = {}) {
    const index = path.lastIndexOf("/");
    if (index < 1 || index === path.length - 1) return;
    const directory = path.slice(0, index);
    const name = path.slice(index + 1).replace(/\.ogg$/i, "");
    this.playPool(directory, new RegExp("^" + escapeRegExp(name) + "\\d*\\.ogg$"), options);
  }

  ui() {
    const options = { volume: 0.55, key: "ui-click", minGap: 0.05 };
    if (this.pool("random", /^click\d*\.ogg$/).length) this.fx("random/click", options);
    else this.playPool("ui/button", /^click\d*\.ogg$/, options);
  }

  block(kind: BlockSoundKind, blockKey: string, at?: Vec, extra: PlayOpts = {}) {
    if (!blockKey || /water|lava|^minecraft:air$/.test(blockKey)) return;
    const material = blockMaterial(blockKey);
    const volume = kind === "step" ? 0.15 : kind === "hit" ? 0.25 : 1;
    const pitch = (kind === "step" ? 1 : kind === "hit" ? 0.5 : 0.8) *
      randomBetween(0.94, 1.06) * (material === "metal" ? 1.25 : 1);
    const options: PlayOpts = {
      volume, pitch, at, key: "block-" + kind,
      minGap: kind === "step" ? 0.08 : 0.04, ...extra,
    };
    if (material === "glass" && kind === "break") {
      this.fx("random/glass", { ...options, pitch: randomBetween(0.9, 1.1) });
      return;
    }
    const directory = kind === "step" ? "step" : "dig";
    const soundMaterial = material === "glass" || material === "metal" ? "stone"
      : material === "ladder" ? (kind === "step" ? "ladder" : "wood")
      : material;
    this.playPool(directory, new RegExp("^" + soundMaterial + "\\d*\\.ogg$"), options);
  }

  door(blockKey: string, open: boolean, at?: Vec) {
    const key = blockKey.replace(/^minecraft:/, "");
    const directory = key.includes("iron_trapdoor") ? "block/iron_trapdoor"
      : key.includes("iron_door") ? "block/iron_door"
      : key.includes("copper_trapdoor") ? "block/copper_trapdoor"
      : key.includes("copper_door") ? "block/copper_door"
      : key.includes("fence_gate") ? "block/fence_gate"
      : key.includes("trapdoor") ? "block/wooden_trapdoor"
      : "block/wooden_door";
    const expression = directory.includes("copper") ? /^toggle/ : open ? /^open/ : /^close/;
    this.playPool(directory, expression, { at, volume: 0.85, pitch: randomBetween(0.95, 1.05), key: "door-" + directory, minGap: 0.25 });
  }

  mob(type: string, kind: MobSoundKind, at?: Vec) {
    const normalized = String(type ?? "").replace(/^minecraft:/, "");
    const compact = normalized.replace(/_/g, "");
    const candidates = [
      MOB_DIR[normalized], "mob/" + normalized, "mob/" + compact,
      "entity/" + normalized, "entity/" + compact,
    ].filter((value): value is string => !!value);
    const directory = candidates.find(candidate => this.pool(candidate, MOB_RE[kind]).length);
    if (!directory) return;
    this.playPool(directory, MOB_RE[kind], {
      at, volume: kind === "say" ? 0.65 : 0.9,
      range: kind === "say" ? 16 : 24,
      pitch: randomBetween(0.95, 1.05),
      key: "mob-" + kind + "-" + normalized, minGap: 0.12,
    });
  }
}

export const sound = new SoundEngine();
