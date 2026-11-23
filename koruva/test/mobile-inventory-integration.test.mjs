import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const main = readFileSync(new URL("../src/client/main.ts", import.meta.url), "utf8");
const room = readFileSync(new URL("../src/worker/room.ts", import.meta.url), "utf8");
const html = readFileSync(new URL("../src/client/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/client/style.css", import.meta.url), "utf8");
test("mobile controls, performance settings, inventory, and server persistence coexist", () => {
  for (const s of ["AdaptiveRenderDistanceTuner", "clampJoystickDisplacement", "MinecraftInventoryUI", "renderCreativeCatalog", "mainInventoryAmounts", "this.resetMobileInputState"]) assert.ok(main.includes(s), `main.ts missing ${s}`);
  for (const s of ["loadPlayerSave(this.ctx.storage, me.cid)", "writePlayerSave(this.ctx.storage, st.cid, snapshot)", "armorSlots"]) assert.ok(room.includes(s), `room.ts missing ${s}`);
  for (const id of ["quality-level", "auto-optimize", "entity-distance", "creative-inventory", "crafting-preview-result", "player-main-inventory"]) assert.ok(html.includes(`id="${id}"`) || html.includes(`id='${id}'`), `index.html missing ${id}`);
  for (const s of ["#mobile-joystick", ".mobile-action", "#mc-inventory-window", "#invgrid"]) assert.ok(css.includes(s), `style.css missing ${s}`);
});


test("mobile inventory has an explicit touch-safe close path and pointerup activation", () => {
  assert.ok(html.includes('id="inventory-close"'), "inventory close button must exist in the overlay");
  assert.ok(html.includes('id="inventory-mobile-toolbar"'), "mobile inventory toolbar must exist");
  assert.ok(main.includes('button.addEventListener("pointerup"'), "mobile tap actions must not depend only on synthesized click");
  assert.ok(main.includes('closeButton.addEventListener("click"'), "close button must close the inventory");
  assert.ok(main.includes('event.target === overlay'), "tapping the overlay backdrop must close the inventory");
  assert.ok(css.includes("@media (orientation: landscape) and (max-height: 540px) and (pointer: coarse)"), "short landscape screens need a dedicated layout");
});


test("mobile inventory remains within narrow portrait viewports without invalid scale math", () => {
  assert.ok(css.includes("#mc-inventory-window { transform: scale(.88);"), "mobile inventory must use a valid numeric scale");
  assert.ok(css.includes("@media (max-width: 380px) and (pointer: coarse)"), "narrow phones need a smaller inventory layout");
  assert.ok(!css.includes("calc((100vw - 16px) / 352)"), "scale() must not receive a length-valued calc expression");
});


test("mobile players can open in-game chat and summon the software keyboard", () => {
  assert.ok(main.includes('const chat = makeButton("チャット", "ゲーム内チャットを開く", "chat")'), "mobile controls need a chat button");
  assert.ok(main.includes('bindTap(chat, () => this.openChat())'), "chat button must open the shared chat UI");
  assert.ok(main.includes("ci.focus();"), "chat input must receive focus synchronously for mobile keyboard activation");
  assert.ok(!main.includes("setTimeout(() => ci.focus()"), "delayed focus can lose mobile user activation");
  assert.ok(html.includes('enterkeyhint="send"'), "mobile keyboard should show a send action");
  assert.ok(css.includes("#mobile-actions .chat"), "chat button should be visually distinguishable");
});
