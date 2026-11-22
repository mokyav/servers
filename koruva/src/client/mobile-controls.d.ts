export function shouldUseTouchControls(options?: { coarsePointer?: boolean; maxTouchPoints?: number }): boolean;
export declare function clampJoystickDisplacement(dx: number, dy: number, radius: number): { x: number; y: number };
export function joystickKeyCodes(dx: number, dy: number, radius: number, deadZone?: number): string[];
export function wrapHotbarIndex(index: number, delta: number, slots?: number): number;


export interface MobileControlPreferences {
  lookSensitivity: number;
  handedness: "left" | "right";
}

export const DEFAULT_MOBILE_CONTROL_PREFERENCES: Readonly<MobileControlPreferences>;
export function normalizeTouchLookSensitivity(value: unknown): number;
export function normalizeMobileControlPreferences(value: unknown): MobileControlPreferences;
export function loadMobileControlPreferences(storage?: Pick<Storage, "getItem">): MobileControlPreferences;
export function saveMobileControlPreferences(value: unknown, storage?: Pick<Storage, "setItem">): boolean;
