import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const main = readFileSync(new URL("../src/client/main.ts", import.meta.url), "utf8");
const controls = readFileSync(new URL("../src/client/mobile-controls.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../src/client/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/client/style.css", import.meta.url), "utf8");
test("mobile sensitivity and handedness settings are wired through UI, persistence, and controls", () => {
  for (const token of ["loadMobileControlPreferences", "normalizeMobileControlPreferences", "saveMobileControlPreferences", "this.mobilePreferences.lookSensitivity", "is-left-handed"]) assert.ok(main.includes(token), `main.ts missing ${token}`);
  for (const token of ["normalizeTouchLookSensitivity", "MOBILE_CONTROL_PREFERENCES_KEY", "koruva:mobile-controls"]) assert.ok(controls.includes(token), `mobile-controls.js missing ${token}`);
  for (const id of ["mobile-look-sensitivity", "mobile-look-sensitivity-value", "mobile-handedness"]) assert.ok(html.includes(`id="${id}"`), `index.html missing ${id}`);
  assert.ok(html.includes('value="left"') && html.includes('value="right"'), "handedness options missing");
  assert.ok(css.includes("#mobile-controls.is-left-handed #mobile-joystick") && css.includes("#mobile-controls.is-left-handed #mobile-actions"), "mirrored safe-area layout missing");
});
