import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("title menu shows the build's Koruva version", async () => {
  const [pkgText, lockText, html, css, main, vite] = await Promise.all([
    read("../package.json"),
    read("../package-lock.json"),
    read("../src/client/index.html"),
    read("../src/client/style.css"),
    read("../src/client/main.ts"),
    read("../vite.config.ts"),
  ]);
  const pkg = JSON.parse(pkgText);
  const lock = JSON.parse(lockText);

  assert.equal(pkg.version, "1.1.0");
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
  assert.equal(pkg.version.split(".").slice(0, 2).join("."), "1.1");
  assert.ok(html.includes('id="game-version" class="game-version">Version 1.0</p>'));
  assert.ok(css.includes("#game-version.game-version {"));
  assert.ok(vite.includes('define: { __KORUVA_VERSION__: JSON.stringify(displayVersion) }'));
  assert.ok(vite.includes('packageJson.version.replace(/\\.0$/, "")'));
  assert.ok(main.includes("declare const __KORUVA_VERSION__: string;"));
  assert.ok(main.includes('$("game-version").textContent = `Version ${__KORUVA_VERSION__}`;'));
});
