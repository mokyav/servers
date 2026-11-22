export interface PotionVariant {
  token: string; name: string; effectId: string | null; durationTicks: number; amplifier: number; delivery?: "splash";
}
export const POTION_VARIANTS: readonly PotionVariant[];
export function potionSpecForItemId(itemId: number, blocks: readonly unknown[]): PotionVariant | { token: string; name: string; effectId: null; durationTicks: number; amplifier: number } | null;
export function isDrinkablePotionItemId(itemId: number, blocks: readonly unknown[]): boolean;
export function potionSplashLanding(origin: number[], direction: number[], isSolid: (x: number, y: number, z: number) => boolean): number[];
