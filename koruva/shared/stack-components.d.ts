export interface StackRecord {
  itemId: number;
  count: number;
  stackId?: string;
  enchantments?: Record<string, number>;
  damage?: number;
  repairCost?: number;
  customName?: string;
  chargedProjectiles?: number[];
}

export type StackData = Record<string, StackRecord>;

export function normalizeStackComponents(
  raw: unknown,
  slotItems?: Record<string, { itemId: number; count: number }>,
  blocks?: typeof import("./blocks").BLOCKS
): StackData;

export function makeStackRecord(
  itemId: number,
  count: number,
  components?: Partial<StackRecord>,
  stackId?: string | null
): StackRecord;

export function stackDataForSlot(stackData: StackData, slot: string, itemId: number, count: number): StackRecord | null;

export function withStackEnchantments(
  legacy: Record<string, Record<string, number>>,
  stackData: StackData,
  slot: string,
  itemId: number
): Record<string, Record<string, number>>;

export function setStackEnchantment(
  stackData: StackData,
  slot: string,
  itemId: number,
  count: number,
  enchantmentId: string,
  level: number,
  blocks: typeof import("./blocks").BLOCKS
): StackData | null;

export function moveStackData(
  stackData: StackData,
  from: string,
  to: string,
  itemId: number,
  count: number,
  options?: { split?: boolean }
): StackData;

export type StackCombineResult =
  | { ok: true; result: StackRecord; cost: number }
  | { ok: false; reason: string; cost?: number };

export function combineAnvilStacks(
  first: StackRecord | null | undefined,
  second: StackRecord | null | undefined,
  options?: { blocks?: typeof import("./blocks").BLOCKS; maxDamage?: number; rename?: string }
): StackCombineResult;

export type GrindstoneResult =
  | { ok: true; result: StackRecord; experience: number; removed: number }
  | { ok: false; reason: string };

export function grindstoneStack(
  first: StackRecord | null | undefined,
  second?: StackRecord | null,
  maxDamage?: number
): GrindstoneResult;

export function slotKey(type: string, index?: number): string | null;

export function validateStackComponents(
  raw: unknown,
  blocks: typeof import("./blocks").BLOCKS,
  counts: number[]
): StackData;

export function migrateLegacyEnchantments(
  legacy: Record<string, Record<string, number>>,
  slotItems: Record<string, { itemId: number; count: number }>,
  blocks: typeof import("./blocks").BLOCKS
): StackData;
