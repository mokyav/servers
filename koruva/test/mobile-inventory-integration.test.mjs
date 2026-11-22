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
