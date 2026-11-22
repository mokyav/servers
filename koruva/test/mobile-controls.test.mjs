import test from "node:test";
import assert from "node:assert/strict";
import { shouldUseTouchControls, joystickKeyCodes, clampJoystickDisplacement, wrapHotbarIndex, normalizeTouchLookSensitivity, normalizeMobileControlPreferences, loadMobileControlPreferences, saveMobileControlPreferences } from "../src/client/mobile-controls.js";

test("touch controls activate for coarse pointers or reported touch points", () => {
  assert.equal(shouldUseTouchControls({ coarsePointer: true, maxTouchPoints: 0 }), true);
  assert.equal(shouldUseTouchControls({ coarsePointer: false, maxTouchPoints: 2 }), true);
  assert.equal(shouldUseTouchControls({ coarsePointer: false, maxTouchPoints: 0 }), false);
});

test("joystick maps cardinal movement and has a dead zone", () => {
  assert.deepEqual(joystickKeyCodes(0, -40, 100), ["KeyW"]);
  assert.deepEqual(joystickKeyCodes(0, 40, 100), ["KeyS"]);
  assert.deepEqual(joystickKeyCodes(-40, 0, 100), ["KeyA"]);
  assert.deepEqual(joystickKeyCodes(40, 0, 100), ["KeyD"]);
  assert.deepEqual(joystickKeyCodes(10, 10, 100), []);
});

test("joystick supports diagonal input and clamps displacement", () => {
  assert.deepEqual(joystickKeyCodes(40, -40, 100), ["KeyW", "KeyD"]);
  assert.deepEqual(joystickKeyCodes(-200, 200, 100), ["KeyS", "KeyA"]);
});

test("hotbar index wraps in both directions and tolerates invalid slot counts", () => {
  assert.equal(wrapHotbarIndex(0, -1), 8);
  assert.equal(wrapHotbarIndex(8, 1), 0);
  assert.equal(wrapHotbarIndex(4, -2, 5), 2);
  assert.equal(wrapHotbarIndex(0, -1, 0), 8);
});


test("joystick radial clamp preserves direction and caps diagonal reach", () => {
  const diagonal = clampJoystickDisplacement(30, 40, 50);
  assert.deepEqual(diagonal, { x: 30, y: 40 });
  const outside = clampJoystickDisplacement(100, 100, 50);
  assert.ok(Math.abs(Math.hypot(outside.x, outside.y) - 50) < 1e-9);
  assert.ok(Math.abs(outside.x - outside.y) < 1e-9);
});

test("joystick radial clamp safely handles invalid coordinates and radius", () => {
  assert.deepEqual(clampJoystickDisplacement(Infinity, NaN, 0), { x: 0, y: 0 });
  const fallbackRadius = clampJoystickDisplacement(3, 4, -1);
  assert.ok(Math.abs(Math.hypot(fallbackRadius.x, fallbackRadius.y) - 1) < 1e-9);
});


test("touch-look sensitivity clamps to 0.5–2.5 and rounds to tenths", () => {
  assert.equal(normalizeTouchLookSensitivity(0), 0.5);
  assert.equal(normalizeTouchLookSensitivity(1.26), 1.3);
  assert.equal(normalizeTouchLookSensitivity(99), 2.5);
  assert.equal(normalizeTouchLookSensitivity(Number.NaN), 1);
});

test("mobile preferences persist, normalize invalid values, and fall back safely", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  assert.deepEqual(loadMobileControlPreferences(storage), { lookSensitivity: 1, handedness: "right" });
  assert.equal(saveMobileControlPreferences({ lookSensitivity: 2.16, handedness: "left" }, storage), true);
  assert.deepEqual(loadMobileControlPreferences(storage), { lookSensitivity: 2.2, handedness: "left" });
  values.set("koruva:mobile-controls", JSON.stringify({ lookSensitivity: 8, handedness: "unknown" }));
  assert.deepEqual(loadMobileControlPreferences(storage), { lookSensitivity: 2.5, handedness: "right" });
  values.set("koruva:mobile-controls", "{");
  assert.deepEqual(loadMobileControlPreferences(storage), { lookSensitivity: 1, handedness: "right" });
  assert.equal(normalizeMobileControlPreferences(null).handedness, "right");
});
