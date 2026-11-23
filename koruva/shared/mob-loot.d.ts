export type MobFoodLoot = Record<string, number>;
export type MobMaterialLoot = Record<string, number>;

export const MOB_FOOD_LOOT: Readonly<Record<string, readonly { foodId: string; min: number; max: number }[]>>;
export function rollMobFoodLoot(type: string, random?: () => number, lootingLevel?: number): MobFoodLoot;
export function applyMobFoodLoot(foodCounts: Record<string, number>, loot: MobFoodLoot, maxCount?: number): { foodCounts: Record<string, number>; changed: boolean };

export const MOB_MATERIAL_NAMES: Readonly<Record<string, string>>;
export const MOB_MATERIAL_ITEM_IDS: readonly string[];
export const MOB_MATERIAL_LOOT: Readonly<Record<string, readonly { itemId: string; min: number; max: number; chance?: number; lootingChance?: number; lootingCount?: boolean; killedByPlayer?: boolean; choiceGroup?: string; weight?: number }[]>>;

export function rollMobMaterialLoot(type: string, random?: () => number, lootingLevel?: number, killedByPlayer?: boolean): MobMaterialLoot;
export function normalizeMobMaterialCounts(raw: unknown, maxCount?: number): Record<string, number>;
export function applyMobMaterialLoot(
  materialCounts: Record<string, number>,
  loot: MobMaterialLoot,
  maxCount?: number
): { materialCounts: Record<string, number>; changed: boolean };
