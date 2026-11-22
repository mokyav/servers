import { MINECRAFT_BLOCK_IDS } from "./minecraft-block-catalog.js";
import { MINECRAFT_BLOCK_TEXTURE_MAP } from "./minecraft-block-texture-map.js";
import { MINECRAFT_BLOCK_RUNTIME_ID_END, MINECRAFT_BLOCK_STATE_RUNTIME_ID_END, MINECRAFT_BLOCK_RUNTIME_ID_START, MINECRAFT_BLOCK_TO_RUNTIME_ID, MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID, minecraftBlockVariantId } from "./minecraft-block-runtime.js";
import { MINECRAFT_ITEM_IDS } from "./minecraft-item-catalog.js";
import { MINECRAFT_ITEM_TEXTURE_MAP } from "./minecraft-item-texture-map.js";
import { MINECRAFT_ITEM_NAMES } from "./minecraft-item-name-map.js";
import { MINECRAFT_ITEM_RUNTIME_IDS, MINECRAFT_ITEM_TO_RUNTIME_ID } from "./minecraft-item-runtime.js";
import { POTION_VARIANTS } from "./potions.js";
import { MINECRAFT_BLOCK_OCCUPANCY } from "./minecraft-block-occupancy.js";

export type RenderKind = "opaque" | "cutout" | "liquid";
export type BlockShape = "cube" | "slab" | "stairs" | "thin" | "carpet" | "trapdoor" | "door" | "pane" | "fence";

export interface BlockDef {
  id: number;
  key: string;
  name: string;
  solid: boolean;
  render: RenderKind;
  /** 同じブロック同士の接触面を描画しない */
  cullSame: boolean;
  emissive: boolean;
  shape: BlockShape;
  /** 向き違いのブロックが戻るインベントリ項目ID */
  itemId: number;
  /** 通常ブロックとしてワールドに設置できるか */
  placeable: boolean;
  /** ブロックではなく、インベントリ専用のアイテム定義 */
  itemOnly?: boolean;
  /** アイテム専用の公式アイコンテクスチャ */
  iconTexture?: string;
  /** stairs: north/east/south/west = 0/1/2/3 */
  facing: number;
  /** Vanilla-like blockstate properties (half/open/hinge/shape/connections). */
  state?: Readonly<Record<string, string | number | boolean>>;
  tiles: { top: string; side: string; bottom: string };
}

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6, PLANKS: 7,
  GLASS: 8, COBBLE: 9, BRICK: 10, SNOW: 11, WATER: 12, LAMP: 13, BEDROCK: 14,
  GRAVEL: 15, ORE: 16, RED: 17, BLUE: 18, YELLOW: 19, WHITE: 20,
  OAK_PLANKS: 21, SPRUCE_PLANKS: 22, BIRCH_PLANKS: 23,
  OAK_SLAB: 24, STONE_SLAB: 25, COBBLE_SLAB: 26, BRICK_SLAB: 27,
  SANDSTONE: 28, COAL_ORE: 29, IRON_ORE: 30, GOLD_ORE: 31,
  OAK_STAIRS: 32, STONE_STAIRS: 36, COBBLE_STAIRS: 40, BRICK_STAIRS: 44,
  SANDSTONE_STAIRS: 48, SPRUCE_STAIRS: 52, BIRCH_STAIRS: 56,
  NETHERRACK: 60, SOUL_SAND: 61, BASALT: 62, BLACKSTONE: 63, END_STONE: 64,
  GLOWSTONE: 65, CRIMSON_NYLIUM: 66, WARPED_NYLIUM: 67, MAGMA_BLOCK: 68, LAVA: 69,
  REDSTONE_BLOCK: 70, REDSTONE_DUST: 71, REDSTONE_LAMP_OFF: 72, REDSTONE_LAMP_ON: 73,
  REDSTONE_LEVER_OFF: 74, REDSTONE_LEVER_ON: 75,
  REDSTONE_REPEATER: 76, REDSTONE_REPEATER_EAST: 77, REDSTONE_REPEATER_SOUTH: 78, REDSTONE_REPEATER_WEST: 79,
  REDSTONE_REPEATER_DELAY_2_NORTH: 80, REDSTONE_REPEATER_DELAY_2_EAST: 81, REDSTONE_REPEATER_DELAY_2_SOUTH: 82, REDSTONE_REPEATER_DELAY_2_WEST: 83,
  REDSTONE_REPEATER_DELAY_3_NORTH: 84, REDSTONE_REPEATER_DELAY_3_EAST: 85, REDSTONE_REPEATER_DELAY_3_SOUTH: 86, REDSTONE_REPEATER_DELAY_3_WEST: 87,
  REDSTONE_REPEATER_DELAY_4_NORTH: 88, REDSTONE_REPEATER_DELAY_4_EAST: 89, REDSTONE_REPEATER_DELAY_4_SOUTH: 90, REDSTONE_REPEATER_DELAY_4_WEST: 91,
} as const;

function def(
  id: number, key: string, name: string,
  top: string, side = top, bottom = top,
  o: Partial<Pick<BlockDef, "solid" | "render" | "cullSame" | "emissive" | "shape" | "itemId" | "facing" | "placeable" | "itemOnly" | "iconTexture" | "state">> = {},
): BlockDef {
  return {
    id, key, name,
    solid: o.solid ?? true,
    render: o.render ?? "opaque",
    cullSame: o.cullSame ?? true,
    emissive: o.emissive ?? false,
    shape: o.shape ?? "cube",
    itemId: o.itemId ?? id,
    placeable: o.placeable ?? true,
    itemOnly: o.itemOnly ?? false,
    iconTexture: o.iconTexture,
    facing: o.facing ?? 0,
    state: o.state,
    tiles: { top, side, bottom },
  };
}

export const BLOCKS: BlockDef[] = [
  def(0, "air", "空気", "none", "none", "none", { solid: false, render: "cutout" }),
  def(1, "grass", "草ブロック", "grass_top", "grass_side", "dirt"),
  def(2, "dirt", "土", "dirt"),
  def(3, "stone", "石", "stone"),
  def(4, "sand", "砂", "sand"),
  def(5, "log", "原木", "log_top", "log_side", "log_top"),
  def(6, "leaves", "葉", "leaves", "leaves", "leaves", { render: "cutout", cullSame: false }),
  def(7, "planks", "板材", "planks"),
  def(8, "glass", "ガラス", "glass", "glass", "glass", { render: "cutout" }),
  def(9, "cobble", "丸石", "cobble"),
  def(10, "brick", "レンガ", "brick"),
  def(11, "snow", "雪", "snow"),
  def(12, "water", "水", "water", "water", "water", { solid: false, render: "liquid" }),
  def(13, "lamp", "ランプ", "lamp", "lamp", "lamp", { emissive: true }),
  def(14, "bedrock", "岩盤", "bedrock"),
  def(15, "gravel", "砂利", "gravel"),
  def(16, "ore", "鉱石", "ore"),
  def(17, "red", "赤ブロック", "red"),
  def(18, "blue", "青ブロック", "blue"),
  def(19, "yellow", "黄ブロック", "yellow"),
  def(20, "white", "白ブロック", "white"),
  def(21, "oak_planks", "オークの板材", "oak_planks"),
  def(22, "spruce_planks", "トウヒの板材", "spruce_planks"),
  def(23, "birch_planks", "シラカバの板材", "birch_planks"),
  def(24, "oak_slab", "オークのハーフブロック", "oak_planks", "oak_planks", "oak_planks", { shape: "slab" }),
  def(25, "stone_slab", "石のハーフブロック", "stone", "stone", "stone", { shape: "slab" }),
  def(26, "cobble_slab", "丸石のハーフブロック", "cobble", "cobble", "cobble", { shape: "slab" }),
  def(27, "brick_slab", "レンガのハーフブロック", "brick", "brick", "brick", { shape: "slab" }),
  def(28, "sandstone", "砂岩", "sandstone"),
  def(29, "coal_ore", "石炭鉱石", "coal_ore"),
  def(30, "iron_ore", "鉄鉱石", "iron_ore"),
  def(31, "gold_ore", "金鉱石", "gold_ore"),
];

const STAIR_GROUPS = [
  { base: B.OAK_STAIRS, key: "oak_stairs", name: "オークの階段", tile: "oak_planks" },
  { base: B.STONE_STAIRS, key: "stone_stairs", name: "石の階段", tile: "stone" },
  { base: B.COBBLE_STAIRS, key: "cobble_stairs", name: "丸石の階段", tile: "cobble" },
  { base: B.BRICK_STAIRS, key: "brick_stairs", name: "レンガの階段", tile: "brick" },
  { base: B.SANDSTONE_STAIRS, key: "sandstone_stairs", name: "砂岩の階段", tile: "sandstone" },
  { base: B.SPRUCE_STAIRS, key: "spruce_stairs", name: "トウヒの階段", tile: "spruce_planks" },
  { base: B.BIRCH_STAIRS, key: "birch_stairs", name: "シラカバの階段", tile: "birch_planks" },
];
const FACING_KEYS = ["north", "east", "south", "west"];
for (const g of STAIR_GROUPS) {
  for (let facing = 0; facing < 4; facing++) {
    BLOCKS.push(def(g.base + facing, `${g.key}_${FACING_KEYS[facing]}`, g.name, g.tile, g.tile, g.tile,
      { shape: "stairs", itemId: g.base, facing }));
  }
}

// Round-5 dimension terrain blocks; IDs are append-only and legacy IDs stay stable.
BLOCKS.push(
  def(B.NETHERRACK, "netherrack", "ネザーラック", "brick"),
  def(B.SOUL_SAND, "soul_sand", "ソウルサンド", "sand"),
  def(B.BASALT, "basalt", "玄武岩", "stone"),
  def(B.BLACKSTONE, "blackstone", "ブラックストーン", "cobble"),
  def(B.END_STONE, "end_stone", "エンドストーン", "sandstone"),
  def(B.GLOWSTONE, "glowstone", "グロウストーン", "lamp", "lamp", "lamp", { emissive: true }),
  def(B.CRIMSON_NYLIUM, "crimson_nylium", "真紅のナイリウム", "red", "red", "dirt"),
  def(B.WARPED_NYLIUM, "warped_nylium", "歪んだナイリウム", "blue", "blue", "dirt"),
  def(B.MAGMA_BLOCK, "magma_block", "マグマブロック", "red"),
  def(B.LAVA, "lava", "溶岩", "water", "water", "water", { solid: false, render: "liquid" }),
  // First playable redstone vertical slice. IDs are append-only.
  def(B.REDSTONE_BLOCK, "redstone_block", "レッドストーンブロック", "red"),
  def(B.REDSTONE_DUST, "redstone_dust", "レッドストーンダスト", "red", "red", "red", { solid: false, render: "cutout", cullSame: false }),
  def(B.REDSTONE_LAMP_OFF, "redstone_lamp_off", "レッドストーンランプ", "cobble", "cobble", "cobble"),
  def(B.REDSTONE_LAMP_ON, "redstone_lamp_on", "点灯したレッドストーンランプ", "lamp", "lamp", "lamp", { emissive: true, itemId: B.REDSTONE_LAMP_OFF }),
  def(B.REDSTONE_LEVER_OFF, "redstone_lever_off", "レバー", "red", "red", "red", { solid: false, render: "cutout", cullSame: false }),
  def(B.REDSTONE_LEVER_ON, "redstone_lever_on", "オンのレバー", "red", "red", "red", { solid: false, render: "cutout", cullSame: false, itemId: B.REDSTONE_LEVER_OFF }),
  // Simplified, directional repeater device; orientation is encoded in append-only IDs.
  ...["north", "east", "south", "west"].map((facing, i) => def(
    B.REDSTONE_REPEATER + i, `redstone_repeater_${facing}`, "レッドストーンリピーター（1tick）", "red", "red", "red",
    { solid: false, render: "cutout", cullSame: false, itemId: B.REDSTONE_REPEATER, facing: i },
  )),
  ...[2, 3, 4].flatMap((delay) => ["north", "east", "south", "west"].map((facing, i) => def(
    B.REDSTONE_REPEATER + (delay - 1) * 4 + i, `redstone_repeater_${facing}_delay_${delay}`, `レッドストーンリピーター（${delay}tick）`, "red", "red", "red",
    { solid: false, render: "cutout", cullSame: false, itemId: B.REDSTONE_REPEATER, facing: i },
  ))),
);


/** Minecraft catalog fallback. Official model/state geometry and textures are not included in this mapping. */
function minecraftFallback(token: string): { top: string; side: string; bottom: string; solid: boolean; render: RenderKind; cullSame: boolean; emissive: boolean; shape: BlockShape; placeable: boolean } {
  const low = token.toLowerCase();
  let top = "stone", side = "stone", bottom = "stone";
  if (low === "grass_block") { top = "grass_top"; side = "grass_side"; bottom = "dirt"; }
  else if (low === "bedrock") top = side = bottom = "bedrock";
  else if (low === "barrier" || low === "structure_void" || low === "light") top = side = bottom = "none";
  else if (low.includes("leaves")) top = side = bottom = "leaves";
  else if (low.endsWith("_log") || low.endsWith("_wood") || low.endsWith("_stem") || low.endsWith("_hyphae")) { top = bottom = "log_top"; side = "log_side"; }
  else if (low.endsWith("_planks")) { top = side = bottom = low.includes("spruce") ? "spruce_planks" : low.includes("birch") ? "birch_planks" : low.includes("oak") ? "oak_planks" : "planks"; }
  else if (low.includes("glass") || low.includes("ice")) top = side = bottom = "glass";
  else if (low.includes("water")) top = side = bottom = "water";
  else if (low.includes("lava")) top = side = bottom = "lava";
  else if (low.includes("sandstone")) top = side = bottom = "sandstone";
  else if (low.includes("sand")) top = side = bottom = "sand";
  else if (low.includes("gravel")) top = side = bottom = "gravel";
  else if (low.includes("ore")) top = side = bottom = "ore";
  else if (low.includes("brick")) top = side = bottom = "brick";
  else if (low.includes("netherrack")) top = side = bottom = "netherrack";
  else if (low.includes("soul_sand")) top = side = bottom = "soul_sand";
  else if (low.includes("basalt")) top = side = bottom = "basalt";
  else if (low.includes("blackstone")) top = side = bottom = "blackstone";
  else if (low.includes("end_stone")) top = side = bottom = "end_stone";
  else if (low.includes("glowstone") || low.includes("sea_lantern")) top = side = bottom = "glowstone";
  else if (low.includes("snow")) top = side = bottom = "snow";
  else if (low.includes("redstone")) top = side = bottom = "red";
  else if (/(?:^|_)(?:dirt|mud|clay|mycelium|moss)(?:_|$)/.test(low)) top = side = bottom = "dirt";
  else if (/(?:wool|concrete|terracotta|coral)/.test(low)) { const color = ["red", "blue", "yellow", "white"].find(c => low.includes(c)); top = side = bottom = color || "white"; }
  const resourceTexture = MINECRAFT_BLOCK_TEXTURE_MAP[low];
  if (resourceTexture) { top = resourceTexture.top; side = resourceTexture.side; bottom = resourceTexture.bottom; }
  const liquid = low === "water" || low === "lava" || low === "bubble_column";
  const partialKind = low.endsWith("_door") || low.endsWith("_fence_gate") ? "door"
    : low.endsWith("_trapdoor") ? "trapdoor"
      : low.endsWith("_pane") || low === "iron_bars" ? "pane"
        : low.endsWith("_fence") || low.endsWith("_wall") ? "fence"
          : low.endsWith("_carpet") ? "carpet"
            : low.endsWith("_pressure_plate") || low.endsWith("_button") || low.endsWith("_rail") || low.endsWith("_redstone_wire") || low.endsWith("_tripwire") ? "thin" : "cube";
  const fragile = /(?:_sapling|_flower|_tulip|_orchid|_daisy|_allium|_bush|_fern|_roots|_vine|_torch|_rail|_sign|_lever|_button|_redstone_wire|_repeater|_comparator|_coral(?:_fan)?|_seagrass|_kelp|_banner|_head|_skull|_ladder|_chain|_tripwire|_tripwire_hook|_candle|_portal|end_gateway)$/.test(low);
  const hidden = low === "barrier" || low === "structure_void" || low === "light";
  const leaves = low.includes("leaves");
  const transparent = liquid || leaves || low.includes("glass") || low.includes("ice") || fragile || hidden || partialKind === "pane";
  const shape = low.endsWith("_slab") ? "slab" as const : low.endsWith("_stairs") ? "stairs" as const : partialKind;
  const solid = !liquid && low !== "light" && low !== "structure_void" && !fragile && low !== "fire";
  return { top, side, bottom, solid,
    render: liquid ? "liquid" as const : transparent ? "cutout" as const : "opaque" as const, cullSame: !leaves && partialKind !== "pane",
    emissive: /glowstone|sea_lantern|shroomlight|torch|lantern|magma|lava|redstone_lamp/.test(low),
    shape,
    placeable: !liquid && low !== "bedrock" && !hidden && low !== "fire" && !low.endsWith("_air") };
}

if (BLOCKS.length !== MINECRAFT_BLOCK_RUNTIME_ID_START) throw new Error(`Minecraft runtime ID base mismatch: ${BLOCKS.length}`);

const statesByToken = new Map<string, Array<[string, any]>>();
for (const [idText, meta] of Object.entries(MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID)) {
  const group = statesByToken.get(meta.token) ?? [];
  group.push([idText, meta]);
  statesByToken.set(meta.token, group);
}

for (const identifier of MINECRAFT_BLOCK_IDS) {
  const runtimeId = MINECRAFT_BLOCK_TO_RUNTIME_ID[identifier];
  if (runtimeId === undefined || runtimeId === 0) continue;
  const token = identifier.slice("minecraft:".length);
  const visual = minecraftFallback(token);
  const name = `Minecraft: ${token.replaceAll("_", " ")}`;
  const states = statesByToken.get(token) ?? [];
  if (!states.length) {
    BLOCKS[runtimeId] = def(runtimeId, identifier, name, visual.top, visual.side, visual.bottom, { solid: visual.solid, render: visual.render, cullSame: visual.cullSame, emissive: visual.emissive, shape: visual.shape, itemId: visual.placeable ? runtimeId : 0, placeable: visual.placeable });
  } else for (const [idText, meta] of states) {
    const id = Number(idText);
    const state = meta.state;
    const facingKey = typeof state.facing === "string" ? state.facing : "north";
    const facing = ["north", "east", "south", "west"].indexOf(facingKey);
    const suffix = meta.kind === "stairs" ? `_${facingKey}_${state.half}_${state.shape}`
      : meta.kind === "slab" ? `_${state.type}`
        : meta.kind === "door" ? `_${state.half}_${facingKey}_${state.hinge}_${state.open ? "open" : "closed"}`
          : meta.kind === "gate" ? `_${facingKey}_${state.open ? "open" : "closed"}_${state.in_wall ? "wall" : "free"}`
            : meta.kind === "trapdoor" ? `_${state.half}_${facingKey}_${state.open ? "open" : "closed"}`
            : meta.kind === "fence" || meta.kind === "pane" ? `_connections_${state.connections}` : "";
    BLOCKS[id] = def(id, `${identifier}${suffix}`, name, visual.top, visual.side, visual.bottom, {
      solid: visual.solid, render: visual.render, cullSame: visual.cullSame, emissive: visual.emissive,
      shape: visual.shape, facing: facing < 0 ? 0 : facing, state,
      itemId: visual.placeable ? runtimeId : 0, placeable: visual.placeable,
    });
  }
}
export const MINECRAFT_BLOCK_TO_ID: Readonly<Record<string, number>> = MINECRAFT_BLOCK_TO_RUNTIME_ID;
export { MINECRAFT_ITEM_TO_RUNTIME_ID };

// World block IDs end here. Inventory-only item IDs are appended below and are never accepted as world blocks.
export const BLOCK_COUNT = MINECRAFT_BLOCK_STATE_RUNTIME_ID_END; // 有効なワールドブロックID: 1..BLOCK_COUNT

// Minecraftの非ブロックアイテムもインベントリで一意に扱えるよう、ブロックIDの後ろに連続IDを割り当てる。
for (const identifier of MINECRAFT_ITEM_IDS) {
  const id = MINECRAFT_ITEM_TO_RUNTIME_ID[identifier];
  if (id <= MINECRAFT_BLOCK_RUNTIME_ID_END) continue; // 既存のブロックアイテムはそのブロックIDを共有する。
  const texture = MINECRAFT_ITEM_TEXTURE_MAP[identifier] ?? "minecraft:item/barrier";
  const token = identifier.slice("minecraft:".length);
  const name = MINECRAFT_ITEM_NAMES[identifier] ?? token.replaceAll("_", " ");
  BLOCKS[id] = def(id, identifier, name, "stone", "stone", "stone", {
    solid: false, render: "cutout", cullSame: false, itemId: id, placeable: false, itemOnly: true, iconTexture: texture,
  });
}

// The current inventory protocol cannot attach minecraft:potion_contents to an
// otherwise-identical potion stack, so expose common potion contents as dedicated IDs.
export const POTION_VARIANT_ITEM_IDS: Readonly<Record<string, number>> = Object.freeze(Object.fromEntries(
  POTION_VARIANTS.map((potion) => {
    const id = BLOCKS.length;
    const iconTexture = MINECRAFT_ITEM_TEXTURE_MAP["minecraft:potion"] ?? "minecraft:item/potion_overlay";
    BLOCKS.push(def(id, `koruva:${potion.token}`, potion.name, "stone", "stone", "stone", {
      solid: false, render: "cutout", cullSame: false, itemId: id, placeable: false, itemOnly: true, iconTexture,
    }));
    return [potion.token, id];
  }),
));

/** インベントリに並ぶ代表的な設置ブロック。向き違いの内部IDは1項目に集約。 */
export const PLACEABLE: number[] = BLOCKS.filter((b) => !!b && b.id !== 0 && b.id <= BLOCK_COUNT && b.placeable && b.id !== B.BEDROCK && b.id !== B.WATER && b.id !== B.LAVA && b.itemId === b.id).map((b) => b.id);
/** クリエイティブ/サバイバルの所持品カタログ。非ブロックアイテムも含む。 */
export const INVENTORY_ITEMS: number[] = Array.from(new Set([...PLACEABLE, ...MINECRAFT_ITEM_RUNTIME_IDS, ...Object.values(POTION_VARIANT_ITEM_IDS)]));
/** アイテム専用エントリはブロックアトラスに入れず、公式アイコンを個別に読み込む。 */
export const TILE_KEYS: string[] = Array.from(new Set(BLOCKS.slice(1, BLOCK_COUNT + 1).flatMap((b) => [b.tiles.top, b.tiles.side, b.tiles.bottom])));

export function blockItemId(id: number): number {
  return Number.isInteger(id) && id > 0 && id <= BLOCK_COUNT && !BLOCKS[id]?.itemOnly ? BLOCKS[id].itemId : 0;
}

/** yawから階段/デバイスの向きを決める。0ラジアンでは南向き。 */
export function blockPlacementId(id: number, yaw: number, half: "top" | "bottom" = "bottom"): number {
  if (!Number.isInteger(id) || id <= 0 || id > BLOCK_COUNT || !BLOCKS[id]?.placeable || BLOCKS[id]?.itemOnly) return 0;
  const item = blockItemId(id);
  const d = BLOCKS[item];
  const facing = ((Math.round(yaw / (Math.PI / 2)) + 2) % 4 + 4) % 4;
  if (d?.shape === "stairs" || d?.shape === "door" || d?.shape === "trapdoor" || d?.shape === "slab") {
    if (!d.key.startsWith("minecraft:")) {
      if (d.shape === "stairs") return item + facing;
      return item;
    }
    const key = MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID[item]?.token ?? d.key.slice("minecraft:".length);
    if (d.shape === "stairs") return minecraftBlockVariantId(key, { facing: ["north", "east", "south", "west"][facing], half, shape: "straight" }) ?? item;
    if (d.shape === "door") return minecraftBlockVariantId(key, { facing: ["north", "east", "south", "west"][facing], half: "lower", hinge: "left", open: false }) ?? item;
    if (d.shape === "trapdoor") return minecraftBlockVariantId(key, { facing: ["north", "east", "south", "west"][facing], half, open: false }) ?? item;
    return minecraftBlockVariantId(key, { type: half }) ?? item;
  }
  if (item === B.REDSTONE_REPEATER) return item + facing;
  if (d?.key.startsWith("minecraft:")) {
    const token = MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID[item]?.token;
    if (token) {
      const facingName = ["north", "east", "south", "west"][facing];
      if (token.endsWith("_bed")) return minecraftBlockVariantId(token, { facing: facingName, part: "foot" }) ?? item;
      if (token === "chest" || token === "trapped_chest" || token === "ender_chest" || token.endsWith("_chest")) return minecraftBlockVariantId(token, { facing: facingName }) ?? item;
      if (token.endsWith("_log") || token.endsWith("_wood") || token.endsWith("_stem") || token === "bamboo_block") return minecraftBlockVariantId(token, { axis: "y" }) ?? item;
      if (token.endsWith("_sign") || token.endsWith("_hanging_sign")) {
        const rotation = Math.round((((yaw / (Math.PI * 2)) % 1) + 1) % 1 * 16) % 16;
        return minecraftBlockVariantId(token, token.endsWith("_wall_sign") ? { facing: facingName } : { rotation }) ?? item;
      }
      if (token.endsWith("_button") || token === "lever") return minecraftBlockVariantId(token, { facing: facingName, face: "floor", powered: "false" }) ?? item;
      if (token.endsWith("_torch") || token === "redstone_torch") return minecraftBlockVariantId(token, { facing: facingName }) ?? item;
      if (["furnace", "blast_furnace", "smoker", "dispenser", "dropper", "observer", "piston", "sticky_piston", "command_block", "end_rod"].includes(token)) return minecraftBlockVariantId(token, { facing: facingName }) ?? item;
    }
  }
  return item;
}

/** Recompute stair corner and pane/fence connections around an edited cell. */
export function resolveBlockStateChanges(get: (x: number, y: number, z: number) => number, x: number, y: number, z: number): Array<{ x: number; y: number; z: number; id: number }> {
  const changes: Array<{ x: number; y: number; z: number; id: number }> = [];
  const dirs = [{ bit: 1, dx: 0, dz: -1 }, { bit: 2, dx: 1, dz: 0 }, { bit: 4, dx: 0, dz: 1 }, { bit: 8, dx: -1, dz: 0 }];
  const positions = [{ x, y, z }, ...dirs.map(d => ({ x: x + d.dx, y, z: z + d.dz }))];
  for (const pos of positions) {
    const id = get(pos.x, pos.y, pos.z), defn = BLOCKS[id];
    if (!defn?.key.startsWith("minecraft:")) continue;
    const token = MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID[id]?.token;
    if (!token) continue;
    if (defn.shape === "fence" || defn.shape === "pane") {
      let mask = 0;
      for (const d of dirs) {
        const neighborId = get(pos.x + d.dx, pos.y, pos.z + d.dz), neighbor = BLOCKS[neighborId];
        if (!neighbor) continue;
        const joins = defn.shape === "pane"
          ? neighbor.shape === "pane" || neighbor.shape === "fence" || (neighbor.solid && neighbor.shape === "cube")
          : neighbor.shape === "fence" || neighbor.shape === "door" || (neighbor.solid && neighbor.shape === "cube");
        if (joins) mask |= d.bit;
      }
      const next = minecraftBlockVariantId(token, { connections: mask });
      if (next !== undefined && next !== id) changes.push({ ...pos, id: next });
    } else if (defn.shape === "door" && defn.key.includes("_fence_gate")) {
      const facing = defn.facing;
      const sideDirs = facing % 2 === 0 ? [{ dx: -1, dz: 0 }, { dx: 1, dz: 0 }] : [{ dx: 0, dz: -1 }, { dx: 0, dz: 1 }];
      const inWall = sideDirs.some(dir => {
        const neighbor = BLOCKS[get(pos.x + dir.dx, pos.y, pos.z + dir.dz)];
        return neighbor?.key.endsWith("_wall");
      });
      const next = blockStateVariantId(id, { in_wall: inWall });
      if (next !== id) changes.push({ ...pos, id: next });
    } else if (defn.shape === "stairs") {
      const state = defn.state ?? {}, facing = defn.facing, half = state.half ?? "bottom";
      const vec = facing === 1 ? [1, 0] : facing === 2 ? [0, 1] : facing === 3 ? [-1, 0] : [0, -1];
      const leftFacing = (facing + 3) % 4, rightFacing = (facing + 1) % 4;
      const candidate = (dx: number, dz: number, targetFacing: number) => {
        const otherId = get(pos.x + dx, pos.y, pos.z + dz), other = BLOCKS[otherId];
        return other?.shape === "stairs" && (other.state?.half ?? "bottom") === half && other.facing === targetFacing;
      };
      let shape: StairShape = "straight";
      const frontX = vec[0], frontZ = vec[1], backX = -frontX, backZ = -frontZ;
      if (candidate(frontX, frontZ, leftFacing) && !candidate(backX, backZ, leftFacing)) shape = "outer_left";
      else if (candidate(frontX, frontZ, rightFacing) && !candidate(backX, backZ, rightFacing)) shape = "outer_right";
      else if (candidate(backX, backZ, leftFacing)) shape = "inner_left";
      else if (candidate(backX, backZ, rightFacing)) shape = "inner_right";
      const next = minecraftBlockVariantId(token, { facing: ["north", "east", "south", "west"][facing], half, shape });
      if (next !== undefined && next !== id) changes.push({ ...pos, id: next });
    }
  }
  return changes;
}

/** メッシュ・衝突判定で共有する部分ブロック形状の分解解像度。 */
export const BLOCK_SHAPE_RESOLUTION = 4;
export type StairShape = "straight" | "inner_left" | "inner_right" | "outer_left" | "outer_right";
export function getBlockState(id: number) { return BLOCKS[id]?.state ?? {}; }

function facingVector(facing: number): [number, number] {
  return facing === 1 ? [1, 0] : facing === 2 ? [0, 1] : facing === 3 ? [-1, 0] : [0, -1];
}

/** Pre-decoded occupancy masks generated from the official vanilla block model elements. */
const MODEL_OCCUPANCY_MASKS: Array<bigint | null> = MINECRAFT_BLOCK_OCCUPANCY.map((mask) => mask ? BigInt(`0x${mask}`) : null);

/** Collision/meshing occupancy on the shared 4×4×4 grid. */
export function blockOccupiesSubcell(id: number, qx: number, qy: number, qz: number): boolean {
  const d = BLOCKS[id];
  if (!d || !d.solid || qx < 0 || qy < 0 || qz < 0 || qx >= 4 || qy >= 4 || qz >= 4) return false;
  const modelMask = MODEL_OCCUPANCY_MASKS[id];
  if (modelMask !== undefined && modelMask !== null && modelMask !== 0n) {
    return ((modelMask >> BigInt(qy * 16 + qz * 4 + qx)) & 1n) === 1n;
  }
  const state = d.state ?? {};
  if (d.shape === "slab") {
    if (state.type === "double") return true;
    return state.type === "top" ? qy >= 2 : qy < 2;
  }
  if (d.shape === "stairs") {
    const top = state.half === "top";
    const inStepHalf = top ? qy < 2 : qy >= 2;
    if (!inStepHalf) return true;
    const [fx, fz] = facingVector(d.facing);
    const [rx, rz] = [-fz, fx];
    const cx = (qx + 0.5) / 4 - 0.5, cz = (qz + 0.5) / 4 - 0.5;
    const forward = cx * fx + cz * fz;
    const side = cx * rx + cz * rz;
    const shape = String(state.shape ?? "straight");
    if (shape === "outer_left") return forward < 0 && side < 0;
    if (shape === "outer_right") return forward < 0 && side > 0;
    if (shape === "inner_left") return forward < 0 || (forward >= 0 && side < 0);
    if (shape === "inner_right") return forward < 0 || (forward >= 0 && side > 0);
    return forward < 0;
  }
  if (d.shape === "thin" || d.shape === "carpet") return qy === 0;
  if (d.shape === "trapdoor") {
    const open = state.open === true;
    if (!open) return state.half === "top" ? qy === 3 : qy === 0;
    return d.facing % 2 === 0 ? (state.open === true ? (state.facing === "north" ? qz === 0 : qz === 3) : qz === 1) : (state.open === true ? (state.facing === "east" ? qx === 3 : qx === 0) : qx === 1);
  }
  if (d.shape === "door") {
    if (d.key.includes("_fence_gate")) return state.open === true ? false : (d.facing % 2 === 0 ? qz === 1 : qx === 1) && (state.in_wall === true ? qy < 3 : qy < 4);
    if (state.open === true) return d.facing === 0 ? qx === 1 : d.facing === 1 ? qz === 1 : d.facing === 2 ? qx === 2 : qz === 2;
    return d.facing % 2 === 0 ? qz === 1 : qx === 1;
  }
  if (d.shape === "pane") {
    const c = Number(state.connections ?? 0);
    return ((qx === 1 || qx === 2) && (qz === 1 || qz === 2)) ||
      ((c & 1) !== 0 && qz === 0 && (qx === 1 || qx === 2)) ||
      ((c & 2) !== 0 && qx === 3 && (qz === 1 || qz === 2)) ||
      ((c & 4) !== 0 && qz === 3 && (qx === 1 || qx === 2)) ||
      ((c & 8) !== 0 && qx === 0 && (qz === 1 || qz === 2));
  }
  if (d.shape === "fence") {
    const c = Number(state.connections ?? 0);
    const core = (qx === 1 || qx === 2) && (qz === 1 || qz === 2);
    const ns = ((c & 1) !== 0 && qz === 0 || (c & 4) !== 0 && qz === 3) && (qx === 1 || qx === 2);
    const ew = ((c & 2) !== 0 && qx === 3 || (c & 8) !== 0 && qx === 0) && (qz === 1 || qz === 2);
    return core || ns || ew;
  }
  return true;
}

export function blockStateVariantId(id: number, patch: Record<string, string | number | boolean>): number {
  const d = BLOCKS[id];
  if (!d || !d.key.startsWith("minecraft:")) return id;
  const token = MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID[id]?.token ?? d.key.slice("minecraft:".length).replace(/_(north|east|south|west|bottom|top|double|lower|upper|left|right|closed|open|straight|inner_left|inner_right|outer_left|outer_right|connections_\d+)$/g, "");
  return minecraftBlockVariantId(token, { ...(d.state ?? {}), ...patch }) ?? id;
}
