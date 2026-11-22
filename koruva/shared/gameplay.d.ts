export interface CraftIngredient { itemId: number; count: number }

export interface CraftRecipe {
  id: string;
  name: string;
  grid: "3x3";
  pattern?: string[];
  shapeless?: boolean;
  keyedIngredients?: Record<string, number>;
  ingredientChoices?: number[][];
  ingredients: CraftIngredient[];
  output: CraftIngredient;
}

export type CraftResult =
  | { ok: true; counts: number[]; recipe: CraftRecipe }
  | { ok: false; reason: string; counts: number[] };

export interface BlockDrop { itemId: number; count: number }

export function createCraftRecipes(blockIds: typeof import("./blocks").B): CraftRecipe[];

export function craftRecipeFitsGrid(recipe: CraftRecipe | undefined, width?: number, height?: number): boolean;

export function getBlockDrop(
  blockId: number,
  blockIds: typeof import("./blocks").B,
  blockItemId: typeof import("./blocks").blockItemId,
  options?: {
    blocks?: typeof import("./blocks").BLOCKS;
    toolItemId?: number;
    itemEnchantments?: Record<string, Record<string, number>>;
  }
): number;

export function getBlockDrops(
  blockId: number,
  blockIds: typeof import("./blocks").B,
  blockItemId: typeof import("./blocks").blockItemId,
  options?: {
    blocks?: typeof import("./blocks").BLOCKS;
    stateMeta?: Record<number, { token?: string }> | null;
    toolItemId?: number;
    enchantments?: Record<string, number>;
    random?: () => number;
  }
): BlockDrop[];

export function getBlockDropCount(
  blockId: number,
  options?: {
    blocks?: typeof import("./blocks").BLOCKS;
    toolItemId?: number;
    itemEnchantments?: Record<string, Record<string, number>>;
    random?: () => number;
  }
): number;

export function craftFromCounts(counts: number[], recipeId: string, recipes: CraftRecipe[], options?: { creative?: boolean; maxStack?: number }): CraftResult;

export function craftGridForRecipe(
  recipe: CraftRecipe | undefined,
  options?: {
    rowOffset?: number;
    colOffset?: number;
    mirror?: boolean;
    counts?: number[] | Record<number, number>;
    gridWidth?: number;
  }
): number[];

export function craftFromGrid(counts: number[], recipeId: string, grid: number[], recipes: CraftRecipe[], options?: { creative?: boolean; maxStack?: number }): CraftResult;

export function resolveInitialInventory(storedCounts: unknown, claimedCounts: unknown, isHost: boolean): unknown;

export function miningTimeSeconds(
  blockId: number,
  blockIds: typeof import("./blocks").B,
  effects?: { effectId: string; durationTicks: number; amplifier?: number }[],
  toolItemId?: number,
  blocks?: typeof import("./blocks").BLOCKS,
  itemEnchantments?: Record<string, Record<string, number>>,
  armorSlots?: number[],
  underwater?: boolean
): number;
