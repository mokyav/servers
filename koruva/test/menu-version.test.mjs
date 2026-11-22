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

  assert.equal(pkg.version, "1.0.0");
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
  assert.equal(pkg.version.replace(/\\.0$/, ""), "1.0");
  assert.match(html, /id="game-version" class="game-version">Version 1\\.0<\\/p>/);
  assert.match(css, /#game-version\\.game-version\\s*\\{/);
  assert.match(vite, /__KORUVA_VERSION__: JSON\\.stringify\\(displayVersion\\)/);
  assert.match(vite, /packageJson\\.version\\.replace\\(\\/\\\\\\.0\\$\\/, ""\\)/);
  assert.match(main, /declare const __KORUVA_VERSION__: string;/);
  assert.match(main, /\\$\\("game-version"\\)\\.textContent = `Version \\\\${__KORUVA_VERSION__\\}`;/);
});
