/** Pure helpers for touch-first game input. */
export function shouldUseTouchControls({ coarsePointer = false, maxTouchPoints = 0 } = {}) {
  return Boolean(coarsePointer) || Number(maxTouchPoints) > 0;
}

/** Radially clamp a pointer offset so diagonals cannot exceed the stick radius. */
export function clampJoystickDisplacement(dx, dy, radius) {
  const r = Number.isFinite(radius) && radius > 0 ? radius : 1;
  const toFinite = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  let x = toFinite(dx);
  let y = toFinite(dy);
  const length = Math.hypot(x, y);
  if (length > r) {
    const scale = r / length;
    x *= scale;
    y *= scale;
  }
  return { x, y };
}

/** Convert a normalized joystick displacement into the existing keyboard movement codes. */
export function joystickKeyCodes(dx, dy, radius, deadZone = 0.24) {
  const r = Number.isFinite(radius) && radius > 0 ? radius : 1;
  const x = Math.max(-1, Math.min(1, Number(dx) / r || 0));
  const y = Math.max(-1, Math.min(1, Number(dy) / r || 0));
  const zone = Math.max(0, Math.min(0.95, Number(deadZone) || 0));
  const keys = [];
  if (y < -zone) keys.push("KeyW");
  if (y > zone) keys.push("KeyS");
  if (x < -zone) keys.push("KeyA");
  if (x > zone) keys.push("KeyD");
  return keys;
}

export function wrapHotbarIndex(index, delta, slots = 9) {
  const count = Number.isInteger(slots) && slots > 0 ? slots : 9;
  const from = Number.isFinite(index) ? Math.trunc(index) : 0;
  const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  return ((from + step) % count + count) % count;
}


const MOBILE_CONTROL_PREFERENCES_KEY = "koruva:mobile-controls";
export const DEFAULT_MOBILE_CONTROL_PREFERENCES = Object.freeze({ lookSensitivity: 1, handedness: "right" });

/** Keep touch-look sensitivity predictable and resilient to malformed saved values. */
export function normalizeTouchLookSensitivity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_MOBILE_CONTROL_PREFERENCES.lookSensitivity;
  const bounded = Math.max(0.5, Math.min(2.5, numeric));
  return Math.round(bounded * 10) / 10;
}

export function normalizeMobileControlPreferences(value) {
  const preferences = value && typeof value === "object" ? value : {};
  return {
    lookSensitivity: normalizeTouchLookSensitivity(preferences.lookSensitivity),
    handedness: preferences.handedness === "left" ? "left" : "right",
  };
}

export function loadMobileControlPreferences(storage) {
  try {
    const store = storage ?? globalThis.localStorage;
    const raw = store?.getItem(MOBILE_CONTROL_PREFERENCES_KEY);
    return raw ? normalizeMobileControlPreferences(JSON.parse(raw)) : normalizeMobileControlPreferences(null);
  } catch {
    return normalizeMobileControlPreferences(null);
  }
}

export function saveMobileControlPreferences(value, storage) {
  try {
    const store = storage ?? globalThis.localStorage;
    if (!store) return false;
    store.setItem(MOBILE_CONTROL_PREFERENCES_KEY, JSON.stringify(normalizeMobileControlPreferences(value)));
    return true;
  } catch {
    return false;
  }
}
