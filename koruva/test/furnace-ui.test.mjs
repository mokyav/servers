import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const html = await readFile(new URL("../src/client/index.html", import.meta.url), "utf8");
const client = await readFile(new URL("../src/client/main.ts", import.meta.url), "utf8");
const css = await readFile(new URL("../src/client/style.css", import.meta.url), "utf8");
test("furnace interface exposes shared input, fuel, output, and mobile controls", () => {
  for (const id of ["furnace-overlay", "furnace-input-value", "furnace-fuel-value", "furnace-output-value", "furnace-insert-input", "furnace-insert-fuel", "furnace-close"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(client, /action: "insert"/); assert.match(client, /action: "take"/); assert.match(client, /message\.open/);
  assert.match(css, /@media \(max-width: 520px\)/); assert.match(css, /env\(safe-area-inset-bottom/);
});
