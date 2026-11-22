import { MINECRAFT_ITEM_TO_RUNTIME_ID } from "./minecraft-item-runtime.js";
import { miningSpeedMultiplier } from "./item-mechanics.js";
import { getItemEnchantment } from "./enchantments.js";
import { MINECRAFT_26_3_CRAFTING_SHAPED_SOURCE } from "./minecraft-26.3-crafting-shaped-source.js";
import { MINECRAFT_26_3_CRAFTING_SHAPELESS_SOURCE } from "./minecraft-26.3-crafting-shapeless-source.js";
import { MINECRAFT_26_3_CRAFTING_RECIPES } from "./minecraft-26.3-recipe-catalog.js";
/** Koruva recipes backed by the Minecraft Java 26.3 item registry and current grid-crafting rules. */
export function createCraftRecipes(B) {
  const specs = [
    ["oak_slab", "オークのハーフブロック", B.OAK_PLANKS, 3, B.OAK_SLAB, 6, ["###", "   ", "   "]],
    ["stone_slab", "石のハーフブロック", B.STONE, 3, B.STONE_SLAB, 6, ["###", "   ", "   "]],
    ["cobble_slab", "丸石のハーフブロック", B.COBBLE, 3, B.COBBLE_SLAB, 6, ["###", "   ", "   "]],
    ["brick_slab", "レンガのハーフブロック", B.BRICK, 3, B.BRICK_SLAB, 6, ["###", "   ", "   "]],
    ["oak_stairs", "オークの階段", B.OAK_PLANKS, 6, B.OAK_STAIRS, 4, ["#  ", "## ", "###"]],
    ["stone_stairs", "石の階段", B.STONE, 6, B.STONE_STAIRS, 4, ["#  ", "## ", "###"]],
    ["cobble_stairs", "丸石の階段", B.COBBLE, 6, B.COBBLE_STAIRS, 4, ["#  ", "## ", "###"]],
    ["brick_stairs", "レンガの階段", B.BRICK, 6, B.BRICK_STAIRS, 4, ["#  ", "## ", "###"]],
    ["sandstone_stairs", "砂岩の階段", B.SANDSTONE, 6, B.SANDSTONE_STAIRS, 4, ["#  ", "## ", "###"]],
    ["spruce_stairs", "トウヒの階段", B.SPRUCE_PLANKS, 6, B.SPRUCE_STAIRS, 4, ["#  ", "## ", "###"]],
    ["birch_stairs", "シラカバの階段", B.BIRCH_PLANKS, 6, B.BIRCH_STAIRS, 4, ["#  ", "## ", "###"]],
  ];
  const recipes = specs.filter(([, , inputId, , outputId]) => Number.isInteger(inputId) && inputId > 0 && Number.isInteger(outputId) && outputId > 0)
    .map(([id, name, inputId, inputCount, outputId, outputCount, pattern]) => ({
      id, name, grid: "3x3", pattern: [...pattern], keyedIngredients: { "#": inputId },
      ingredients: [{ itemId: inputId, count: inputCount }], output: { itemId: outputId, count: outputCount },
    }));
  // The 26.3 extracted recipe list omits the basic crafting-table conversion; add the vanilla
  // 2×2 recipe for every plank family so the player inventory crafting grid can make one.
  const craftingTableId = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:crafting_table"];
  if (Number.isSafeInteger(craftingTableId) && craftingTableId > 0) {
    for (const [key, itemId] of Object.entries(MINECRAFT_ITEM_TO_RUNTIME_ID)) {
      if (!key.endsWith("_planks") || !Number.isSafeInteger(itemId) || itemId <= 0) continue;
      const variant = key.slice("minecraft:".length, -"_planks".length);
      recipes.push({ id: `minecraft:crafting_table_from_${variant}_planks`, name: "作業台", grid: "2x2",
        pattern: ["##", "##"], keyedIngredients: { "#": itemId },
        ingredients: [{ itemId, count: 4 }], output: { itemId: craftingTableId, count: 1 } });
    }
  }
  // Exact shaped recipes are supported for all catalogued items. Ingredients that use tags or
  // alternatives are excluded at extraction time because the current grid matcher is exact-ID based.
  for (const source of MINECRAFT_26_3_CRAFTING_SHAPED_SOURCE) {
    const outputId = MINECRAFT_ITEM_TO_RUNTIME_ID[source.result?.id];
    if (!Number.isSafeInteger(outputId) || outputId <= 0) continue;
    const keyedIngredients = Object.create(null);
    let valid = true;
    for (const [symbol, sourceId] of Object.entries(source.key || {})) {
      const itemId = MINECRAFT_ITEM_TO_RUNTIME_ID[sourceId];
      if (!Number.isSafeInteger(itemId) || itemId <= 0) { valid = false; break; }
      keyedIngredients[symbol] = itemId;
    }
    if (!valid) continue;
    const required = new Map();
    for (const row of source.pattern) for (const symbol of row) {
      if (symbol === " ") continue;
      const itemId = keyedIngredients[symbol];
      if (!Number.isSafeInteger(itemId) || itemId <= 0) { valid = false; break; }
      required.set(itemId, (required.get(itemId) || 0) + 1);
    }
    const resultCount = source.result.count;
    if (!valid || !required.size || !Number.isSafeInteger(resultCount) || resultCount <= 0) continue;
    recipes.push({ id: source.id, name: source.name, grid: "3x3", pattern: [...source.pattern], keyedIngredients,
      ingredients: [...required].map(([itemId, count]) => ({ itemId, count })), output: { itemId: outputId, count: resultCount } });
  }
  for (const source of MINECRAFT_26_3_CRAFTING_SHAPELESS_SOURCE) {
    const outputId = MINECRAFT_ITEM_TO_RUNTIME_ID[source.result?.id];
    if (!Number.isSafeInteger(outputId) || outputId <= 0) continue;
    const required = new Map();
    let valid = true;
    for (const sourceId of source.ingredients || []) {
      const itemId = MINECRAFT_ITEM_TO_RUNTIME_ID[sourceId];
      if (!Number.isSafeInteger(itemId) || itemId <= 0) { valid = false; break; }
      required.set(itemId, (required.get(itemId) || 0) + 1);
    }
    const resultCount = source.result.count;
    if (!valid || !required.size || [...required.values()].reduce((a, b) => a + b, 0) > 9 || !Number.isSafeInteger(resultCount) || resultCount <= 0) continue;
    recipes.push({ id: source.id, name: source.name, grid: "3x3", shapeless: true,
      ingredients: [...required].map(([itemId, count]) => ({ itemId, count })),
      output: { itemId: outputId, count: resultCount } });
  }
  // Data-driven Java 26.3 recipe catalog includes item-tag alternatives resolved from the supplied client data.
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  for (const source of MINECRAFT_26_3_CRAFTING_RECIPES) {
    const ingredientCounts = new Map();
    const bump = (id) => { if (Number.isInteger(id) && id > 0) ingredientCounts.set(id, (ingredientCounts.get(id) || 0) + 1); };
    for (const choices of source.ingredientChoices || []) bump(choices[0]);
    const keyedIngredients = Object.fromEntries(Object.entries(source.keyedChoices || {}).map(([symbol, ids]) => [symbol, ids[0]]));
    if (source.pattern) for (const row of source.pattern) for (const symbol of row) if (symbol !== " ") bump(keyedIngredients[symbol]);
    const recipe = { ...source, keyedIngredients,
      ingredients: [...ingredientCounts].map(([itemId, count]) => ({ itemId, count })) };
    if (recipe.ingredients.length && recipe.ingredients.every((entry) => entry.itemId > 0 && entry.count > 0)) byId.set(recipe.id, recipe);
  }
  return [...byId.values()];
}



function normalizedBlockKey(blockId, blocks) {
  return String(blocks?.[blockId]?.key ?? "").replace(/^minecraft:/, "");
}

function pickaxeHarvestLevel(itemId, blocks) {
  const key = String(blocks?.[itemId]?.key ?? "").replace(/^minecraft:/, "");
  const match = key.match(/^(wooden|golden|stone|iron|diamond|netherite)_pickaxe$/);
  if (!match) return -1;
  return { wooden: 0, golden: 0, stone: 1, iron: 2, diamond: 3, netherite: 4 }[match[1]];
}

function minimumHarvestLevel(blockId, B, blocks) {
  const key = normalizedBlockKey(blockId, blocks);
  if (blockId === B.ORE || key === "ore") return 2;
  if (/(?:^|_)(?:coal|nether_gold|nether_quartz)_ore$/.test(key)) return 0;
  if (/(?:^|_)(?:iron|copper)_ore$/.test(key)) return 1;
  if (/(?:^|_)(?:gold|redstone|lapis|diamond|emerald)_ore$/.test(key)) return 2;
  if (/(?:ancient_debris|obsidian)/.test(key)) return 3;
  const pickaxeBlocks = new Set([B.STONE, B.COBBLE, B.BRICK, B.SANDSTONE, B.STONE_SLAB, B.COBBLE_SLAB, B.BRICK_SLAB, B.NETHERRACK, B.BASALT, B.BLACKSTONE, B.END_STONE, B.GLOWSTONE]);
  if (pickaxeBlocks.has(blockId) || /^(?:stone|cobble|brick|sandstone|netherrack|basalt|blackstone|end_stone|glowstone)(?:_|$)/.test(key)) return 0;
  return null;
}

/** True when the held pickaxe meets the block's minimum harvest tier. */
export function canHarvestBlock(blockId, heldItemId, B, blocks) {
  if (!Number.isInteger(blockId) || blockId <= 0) return false;
  const required = minimumHarvestLevel(blockId, B, blocks);
  if (required === null) return true;
  return pickaxeHarvestLevel(heldItemId, blocks) >= required;
}

/** Whether a recipe's actual ingredient footprint fits the requested crafting grid. */
export function craftRecipeFitsGrid(recipe, width = 3, height = 3) {
  if (!recipe || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 3 || height > 3) return false;
  if (recipe.shapeless === true) {
    const count = Array.isArray(recipe.ingredientChoices)
      ? recipe.ingredientChoices.length
      : (recipe.ingredients || []).reduce((sum, entry) => sum + (Number.isSafeInteger(entry?.count) && entry.count > 0 ? entry.count : 0), 0);
    return count > 0 && count <= width * height;
  }
  if (!Array.isArray(recipe.pattern) || recipe.pattern.length < 1) return false;
  let bottom = -1, right = -1;
  for (let y = 0; y < recipe.pattern.length; y++) {
    const row = recipe.pattern[y];
    if (typeof row !== "string") return false;
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== " ") { bottom = Math.max(bottom, y); right = Math.max(right, x); }
    }
  }
  return bottom >= 0 && right >= 0 && bottom + 1 <= height && right + 1 <= width;
}

export function getBlockDrop(blockId, B, blockItemId, options = {}, legacyBlocks, legacyRandom = Math.random) {
  if (!Number.isInteger(blockId) || blockId <= 0) return 0;
  // Original Cycle28 API: (blockId, B, blockItemId, heldItemId, blocks, random).
  if (typeof options === "number") {
    const heldItemId = options;
    const blocks = Array.isArray(legacyBlocks) ? legacyBlocks : undefined;
    const key = normalizedBlockKey(blockId, blocks);
    const item = (name, fallback) => MINECRAFT_ITEM_TO_RUNTIME_ID[`minecraft:${name}`] || fallback;
    if ([B.BEDROCK, B.WATER, B.LAVA, B.LEAVES].includes(blockId) || /^(?:bedrock|water|lava|leaves|nether_portal|end_portal|end_gateway|fire|soul_fire)$/.test(key)) return 0;
    if (blocks && !canHarvestBlock(blockId, heldItemId, B, blocks)) return 0;
    if (blockId === B.GRASS || key === "grass_block") return blockItemId(B.DIRT);
    if (blockId === B.STONE || key === "stone") return blockItemId(B.COBBLE);
    if (blockId === B.GRAVEL || key === "gravel") {
      const roll = typeof legacyRandom === "function" ? Number(legacyRandom()) : 1;
      return roll >= 0 && roll < 0.1 ? item("flint", blockItemId(blockId)) : blockItemId(blockId);
    }
    let resource = "";
    if (key === "ore") resource = "raw_gold";
    else {
      const match = key.match(/^(?:deepslate_)?(coal|iron|gold|copper|diamond|emerald|lapis|redstone|nether_gold|nether_quartz)_ore$/);
      if (match) resource = ({ coal: "coal", iron: "raw_iron", gold: "raw_gold", copper: "raw_copper", diamond: "diamond", emerald: "emerald", lapis: "lapis_lazuli", redstone: "redstone", nether_gold: "gold_nugget", nether_quartz: "quartz" })[match[1]];
    }
    return resource ? item(resource, blockItemId(blockId)) : blockItemId(blockId);
  }
  const blocks = Array.isArray(options.blocks) ? options.blocks : [];
  const key = normalizedBlockKey(blockId, blocks);
  const silkTouch = getToolEnchantment(options.itemEnchantments, options.toolItemId, "silk_touch") > 0;
  if (blockId === B.BEDROCK || blockId === B.WATER || blockId === B.LAVA) return 0;
  if (blockId === B.LEAVES || key.endsWith("_leaves") || key === "leaves") return silkTouch ? blockItemId(blockId) : 0;
  if (silkTouch) return blockItemId(blockId);
  if (blockId === B.GRASS || key === "grass_block") return blockItemId(B.DIRT);
  if (blockId === B.STONE || key === "stone") return blockItemId(B.COBBLE);
  const oreDrops = {
    coal_ore: "coal", deepslate_coal_ore: "coal", diamond_ore: "diamond", deepslate_diamond_ore: "diamond",
    emerald_ore: "emerald", deepslate_emerald_ore: "emerald", lapis_ore: "lapis_lazuli", deepslate_lapis_ore: "lapis_lazuli",
    redstone_ore: "redstone", deepslate_redstone_ore: "redstone", nether_quartz_ore: "quartz",
    copper_ore: "raw_copper", deepslate_copper_ore: "raw_copper", iron_ore: "raw_iron", deepslate_iron_ore: "raw_iron",
    gold_ore: "raw_gold", deepslate_gold_ore: "raw_gold",
  };
  const mapped = oreDrops[key];
  if (mapped) return MINECRAFT_ITEM_TO_RUNTIME_ID[`minecraft:${mapped}`] ?? blockItemId(blockId);
  if (key === "nether_gold_ore") return MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:gold_nugget"] ?? blockItemId(blockId);
  return blockItemId(blockId);
}


export function getBlockDrops(blockId, B, blockItemId, options = {}) {
  if (!Number.isInteger(blockId) || blockId <= 0) return [];
  const blocks = options.blocks || [];
  const stateMeta = options.stateMeta || null;
  const key = String(stateMeta?.[blockId]?.token || blocks[blockId]?.key || "").replace(/^minecraft:/, "");
  const toolId = Number.isInteger(options.toolItemId) ? options.toolItemId : 0;
  const toolKey = String(blocks[toolId]?.key || "").replace(/^minecraft:/, "");
  const isPickaxe = /_(?:wooden|stone|iron|golden|diamond|netherite)_pickaxe$/.test(`_${toolKey}`) || /^(?:wooden|stone|iron|golden|diamond|netherite)_pickaxe$/.test(toolKey);
  const tier = toolKey.startsWith("netherite_") ? 4 : toolKey.startsWith("diamond_") ? 3 : toolKey.startsWith("iron_") ? 2 : toolKey.startsWith("stone_") ? 1 : toolKey.startsWith("golden_") || toolKey.startsWith("wooden_") ? 0 : -1;
  const enchantments = options.enchantments || {};
  const silk = (Number(enchantments.silk_touch) || 0) > 0;
  const fortune = silk ? 0 : Math.max(0, Math.min(3, Math.floor(Number(enchantments.fortune) || 0)));
  const random = typeof options.random === "function" ? options.random : Math.random;
  const itemId = token => MINECRAFT_ITEM_TO_RUNTIME_ID[`minecraft:${token}`] || 0;
  const block = (id) => blockItemId(id);
  const roll = (min, max) => min + Math.floor(Math.max(0, Math.min(0.999999, Number(random()) || 0)) * (max - min + 1));
  const fortuneCount = (base = 1) => base * (fortune ? roll(1, fortune + 1) : 1);
  const result = (id, count = 1) => id > 0 && count > 0 ? [{ itemId: id, count }] : [];

  if (blockId === B.BEDROCK || blockId === B.WATER || blockId === B.LAVA || key === "bedrock" || key.endsWith("_air")) return [];
  if (blockId === B.GRASS || key === "grass_block") return result(block(B.DIRT));
  if (blockId === B.STONE || key === "stone") {
    if (!isPickaxe || tier < 0) return [];
    return result(silk ? block(blockId) : block(B.COBBLE));
  }
  if (blockId === B.LEAVES || /(?:^|_)leaves$/.test(key)) {
    const shears = /(?:^|_)shears$/.test(toolKey);
    return silk || shears ? result(block(blockId)) : [];
  }
  if (key === "glass" || key.endsWith("_glass") || key === "ice" || key === "packed_ice" || key === "blue_ice") return silk ? result(block(blockId)) : [];

  const ore = /(?:^|_)(?:coal|iron|gold|copper|diamond|emerald|lapis|redstone|nether_quartz|nether_gold)_ore$/.test(key);
  if (ore) {
    if (!isPickaxe) return [];
    const requiredTier = /(?:gold|diamond|emerald|lapis|redstone)_ore$/.test(key) ? 2
      : /(?:iron|copper)_ore$/.test(key) ? 1 : 0;
    if (tier < requiredTier) return [];
    if (silk) return result(block(blockId));
    if (key.includes("coal_ore")) return result(itemId("coal"), fortuneCount());
    if (key.includes("diamond_ore")) return result(itemId("diamond"), fortuneCount());
    if (key.includes("emerald_ore")) return result(itemId("emerald"), fortuneCount());
    if (key.includes("lapis_ore")) return result(itemId("lapis_lazuli"), fortuneCount(roll(4, 9)));
    if (key.includes("redstone_ore")) return result(itemId("redstone"), fortuneCount(roll(4, 5)));
    if (key.includes("nether_quartz_ore")) return result(itemId("quartz"), fortuneCount());
    if (key.includes("nether_gold_ore")) return result(itemId("gold_nugget"), fortuneCount(roll(2, 6)));
    if (key.includes("copper_ore")) return result(itemId("raw_copper"), fortuneCount(roll(2, 5)));
    if (key.includes("iron_ore")) return result(itemId("raw_iron"), fortuneCount());
    if (key.includes("gold_ore")) return result(itemId("raw_gold"), fortuneCount());
  }
  if (key === "deepslate") {
    if (!isPickaxe) return [];
    if (silk) return result(block(blockId));
    return result(itemId("cobbled_deepslate") || block(blockId));
  }
  if (key === "cobbled_deepslate") return isPickaxe ? result(block(blockId)) : [];
  if (/^(?:clay)$/.test(key)) return result(itemId("clay_ball"), 4);
  if (key === "glowstone") return result(silk ? block(blockId) : itemId("glowstone_dust"), silk ? 1 : fortuneCount(roll(2, 4)));
  if (key === "gravel") return result(silk || roll(1, 10) !== 1 ? block(blockId) : itemId("flint"));
  if (key === "grass" || key === "fern" || key === "dead_bush") return [];
  if (key === "spawner" || key === "trial_spawner" || key === "reinforced_deepslate") return [];
  const direct = block(blockId);
  return result(direct || blockId);
}

function getToolEnchantment(enchantments, toolItemId, enchantmentId) {
  const value = enchantments?.[String(toolItemId)]?.[enchantmentId];
  return Number.isInteger(value) && value > 0 ? value : 0;
}

/** Fortune drop count for vanilla ore families. random is injectable for deterministic tests. */
export function getBlockDropCount(blockId, options = {}) {
  const blocks = Array.isArray(options.blocks) ? options.blocks : [];
  const key = String(blocks[blockId]?.key ?? "").replace(/^minecraft:/, "");
  const level = getToolEnchantment(options.itemEnchantments, options.toolItemId, "fortune");
  if (level <= 0) return 1;
  const random = typeof options.random === "function" ? options.random : Math.random;
  const roll = Math.max(0, Math.min(0.999999, Number(random()) || 0));
  if (/(?:^|_)(?:coal|diamond|emerald)_ore$/.test(key) || key === "coal_ore" || key === "iron_ore" || key === "gold_ore" || key === "copper_ore" || /deepslate_(?:coal|diamond|emerald|iron|gold|copper)_ore$/.test(key)) {
    return 1 + Math.floor(roll * level);
  }
  if (key === "redstone_ore" || key === "deepslate_redstone_ore") return 4 + Math.floor(roll * (level + 1));
  if (key === "lapis_ore" || key === "deepslate_lapis_ore") return 4 + Math.floor(roll * (level + 1));
  if (key === "nether_gold_ore") return 2 + Math.floor(roll * (level + 2));
  return 1;
}
/** Build a deterministic 3x3 placement for the quick-craft UI. */
export function craftGridForRecipe(recipe, options = {}) {
  if (recipe?.shapeless === true) {
    const items = [], available = options.counts || {}, used = new Map();
    if (Array.isArray(recipe.ingredientChoices)) {
      for (const alternatives of recipe.ingredientChoices) {
        const id = alternatives.find((candidate) => (available[candidate] || 0) > (used.get(candidate) || 0)) ?? alternatives[0];
        if (!Number.isInteger(id) || id <= 0) return [];
        items.push(id); used.set(id, (used.get(id) || 0) + 1);
      }
    } else for (const ingredient of recipe.ingredients || []) {
      if (!Number.isInteger(ingredient.itemId) || ingredient.itemId <= 0 || !Number.isInteger(ingredient.count) || ingredient.count <= 0) return [];
      for (let i = 0; i < ingredient.count; i++) items.push(ingredient.itemId);
    }
    const gridWidth = options.gridWidth === 2 ? 2 : 3;
    const slots = gridWidth === 2 ? [0, 1, 3, 4] : Array.from({ length: 9 }, (_, i) => i);
    if (items.length > slots.length) return [];
    const grid = Array(9).fill(0);
    items.forEach((itemId, index) => { grid[slots[index]] = itemId; });
    return items.length ? grid : [];
  }
  if (!recipe || !Array.isArray(recipe.pattern) || recipe.pattern.length < 1 || recipe.pattern.length > 3) return [];
  const height = recipe.pattern.length;
  const width = Math.max(0, ...recipe.pattern.map((row) => typeof row === "string" ? row.length : 0));
  if (width < 1 || width > 3) return [];
  const rowOffset = Number.isInteger(options.rowOffset) ? options.rowOffset : Math.floor((3 - height) / 2);
  const colOffset = Number.isInteger(options.colOffset) ? options.colOffset : Math.floor((3 - width) / 2);
  const mirror = options.mirror === true;
  if (rowOffset < 0 || colOffset < 0 || rowOffset + height > 3 || colOffset + width > 3) return [];
  const keys = recipe.keyedIngredients || (recipe.ingredients?.length === 1 ? { "#": recipe.ingredients[0].itemId } : {});
  const counts = options.counts || {}, used = new Map();
  const grid = Array(9).fill(0);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const ch = recipe.pattern[y][x] || " ";
    if (ch === " ") continue;
    const alternatives = recipe.keyedChoices?.[ch] || [keys[ch]];
    const itemId = alternatives.find((id) => (counts[id] || 0) > (used.get(id) || 0)) ?? alternatives[0];
    if (!Number.isInteger(itemId) || itemId <= 0) return [];
    used.set(itemId, (used.get(itemId) || 0) + 1);
    const gx = mirror ? width - 1 - x : x;
    grid[(rowOffset + y) * 3 + colOffset + gx] = itemId;
  }
  return grid;
}

function validCounts(counts) {
  return Array.isArray(counts) && counts.length >= 2 && counts.every((n) => Number.isInteger(n) && n >= 0);
}
function aggregateIngredients(recipe) {
  const required = new Map();
  for (const ing of recipe.ingredients || []) {
    if (!Number.isInteger(ing.itemId) || ing.itemId <= 0 || !Number.isInteger(ing.count) || ing.count <= 0) return null;
    required.set(ing.itemId, (required.get(ing.itemId) || 0) + ing.count);
  }
  return required.size ? required : null;
}
function applyRecipe(counts, recipe, options = {}) {
  const creative = options.creative === true;
  const maxStack = Number.isInteger(options.maxStack) && options.maxStack > 0 ? options.maxStack : 64;
  const next = counts.slice();
  const required = Array.isArray(options.consumeGrid)
    ? new Map(options.consumeGrid.filter((id) => Number.isInteger(id) && id > 0).reduce((map, id) => map.set(id, (map.get(id) || 0) + 1), new Map()))
    : aggregateIngredients(recipe);
  const outputId = recipe.output?.itemId, outputCount = recipe.output?.count;
  if (!required || !Number.isInteger(outputId) || outputId <= 0 || outputId >= next.length ||
      !Number.isInteger(outputCount) || outputCount <= 0) return { ok: false, reason: "invalid_recipe", counts: next };
  if (!creative) for (const [id, count] of required) {
    if (id >= next.length || next[id] < count) return { ok: false, reason: "missing_ingredients", counts: counts.slice() };
  }
  if (!creative) for (const [id, count] of required) next[id] -= count;
  if ((next[outputId] || 0) + outputCount > maxStack) return { ok: false, reason: "stack_limit", counts: counts.slice() };
  next[outputId] = (next[outputId] || 0) + outputCount;
  return { ok: true, counts: next, recipe };
}
function recipeGridMatches(grid, recipe) {
  if (recipe?.shapeless === true) {
    if (!Array.isArray(grid) || grid.length !== 9 || !grid.every((id) => Number.isInteger(id) && id >= 0)) return false;
    const supplied = grid.filter((id) => id !== 0);
    const choices = Array.isArray(recipe.ingredientChoices)
      ? recipe.ingredientChoices.map((items) => Array.isArray(items) ? items.filter((id) => Number.isInteger(id) && id > 0) : [])
      : (recipe.ingredients || []).flatMap((entry) => Array.from({ length: entry.count }, () => [entry.itemId]));
    if (!choices.length || choices.length !== supplied.length || choices.some((items) => !items.length)) return false;
    const ordered = choices.slice().sort((a, b) => a.length - b.length);
    const used = new Array(supplied.length).fill(false);
    const assign = (at) => {
      if (at >= ordered.length) return true;
      for (let i = 0; i < supplied.length; i++) {
        if (used[i] || !ordered[at].includes(supplied[i])) continue;
        used[i] = true;
        if (assign(at + 1)) return true;
        used[i] = false;
      }
      return false;
    };
    return assign(0);
  }
  if (!Array.isArray(recipe.pattern) || recipe.pattern.length < 1 || recipe.pattern.length > 3) return false;
  const h = recipe.pattern.length, w = Math.max(0, ...recipe.pattern.map((row) => typeof row === "string" ? row.length : 0));
  if (w < 1 || w > 3 || recipe.pattern.some((row) => typeof row !== "string" || row.length > 3)) return false;
  const keys = recipe.keyedIngredients || (recipe.ingredients?.length === 1 ? { "#": recipe.ingredients[0].itemId } : {});
  const choices = recipe.keyedChoices || Object.fromEntries(Object.entries(keys).map(([key, id]) => [key, [id]]));
  for (const row of recipe.pattern) for (const ch of row.padEnd(w, " ")) {
    if (ch !== " " && (!Array.isArray(choices[ch]) || !choices[ch].length)) return false;
  }
  for (const mirror of [false, true]) for (let oy = 0; oy <= 3 - h; oy++) for (let ox = 0; ox <= 3 - w; ox++) {
    const expected = Array(9).fill(0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = recipe.pattern[y][x] || " "; if (ch === " ") continue;
      const gx = mirror ? w - 1 - x : x;
      expected[(oy + y) * 3 + ox + gx] = ch;
    }
    if (expected.every((symbol, i) => symbol === 0 ? grid[i] === 0 : choices[symbol]?.includes(grid[i]))) return true;
  }
  return false;
}

/** Slot-grid crafting: checks exact 3x3 pattern (with Java-style offset/mirroring) and authoritative inventory. */
export function craftFromGrid(counts, recipeId, grid, recipes, options = {}) {
  if (!validCounts(counts)) return { ok: false, reason: "invalid_inventory", counts: [] };
  const recipe = recipes.find((item) => item.id === recipeId);
  if (!recipe) return { ok: false, reason: "unknown_recipe", counts: counts.slice() };
  if (!Array.isArray(grid) || grid.length !== 9 || !grid.every((id) => Number.isInteger(id) && id >= 0 && id < counts.length))
    return { ok: false, reason: "invalid_grid", counts: counts.slice() };
  if (!recipeGridMatches(grid, recipe)) return { ok: false, reason: "pattern_mismatch", counts: counts.slice() };
  return applyRecipe(counts, recipe, { ...options, consumeGrid: grid });
}

/** Backward-compatible recipe-button craft; new callers should submit a slot grid. */
export function craftFromCounts(counts, recipeId, recipes, options = {}) {
  if (!validCounts(counts)) return { ok: false, reason: "invalid_inventory", counts: [] };
  const recipe = recipes.find((item) => item.id === recipeId);
  if (!recipe) return { ok: false, reason: "unknown_recipe", counts: counts.slice() };
  return applyRecipe(counts, recipe, options);
}

/** On first online join, only the authenticated host may migrate a client-provided inventory; server storage always wins. */
export function resolveInitialInventory(storedCounts, claimedCounts, isHost) {
  if (storedCounts !== undefined) return storedCounts;
  return isHost && Array.isArray(claimedCounts) ? claimedCounts : [];
}

export function miningTimeSeconds(blockId, B, effects = [], toolItemId = 0, blocks = [], itemEnchantments = {}, armorSlots = [], underwater = false) {
  if (!Number.isInteger(blockId) || blockId <= 0) return 0;
  if (blockId === B.BEDROCK || blockId === MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:bedrock"]) return Infinity;
  const hardness = {
    [B.LEAVES]: 0.25, [B.GLASS]: 0.35, [B.SNOW]: 0.3,
    [B.DIRT]: 0.55, [B.GRASS]: 0.6, [B.SAND]: 0.5, [B.GRAVEL]: 0.6,
    [B.LOG]: 1.1, [B.PLANKS]: 1.0, [B.STONE]: 1.8, [B.COBBLE]: 1.8,
    [B.BRICK]: 1.8, [B.ORE]: 2.4, [B.LAMP]: 0.5,
    [B.RED]: 0.8, [B.BLUE]: 0.8, [B.YELLOW]: 0.8, [B.WHITE]: 0.8,
  };
  let need = hardness[blockId] ?? 1;
  const amp = (id) => {
    const e = effects.find((v) => v.effectId === id && v.durationTicks > 0);
    return e ? Math.max(0, Number.isInteger(e.amplifier) ? e.amplifier : 0) : -1;
  };
  const haste = amp("haste"), fatigue = amp("mining_fatigue");
  if (haste >= 0) need /= 1 + 0.2 * (haste + 1);
  if (fatigue >= 0) need *= 1 + 0.3 * (fatigue + 1);
  const toolSpeed = miningSpeedMultiplier(blockId, toolItemId, blocks, itemEnchantments);
  if (toolSpeed > 1) need /= toolSpeed;
  const hasAquaAffinity = Array.isArray(armorSlots) && armorSlots.some((itemId) => getItemEnchantment(itemEnchantments, itemId, "aqua_affinity") > 0);
  if (underwater && !hasAquaAffinity) need *= 5;
  return need;
}
