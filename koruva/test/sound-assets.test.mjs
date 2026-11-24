import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sourceScript = join(here, "..", "scripts", "copy-sounds.mjs");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "koruva-audio-test-"));
  const project = join(root, "project");
  const scriptDir = join(project, "scripts");
  const assetsDir = join(project, "src", "client", "public", "assets");
  mkdirSync(scriptDir, { recursive: true });
  mkdirSync(assetsDir, { recursive: true });
  const copiedScript = join(scriptDir, "copy-sounds.mjs");
  writeFileSync(copiedScript, readFileSync(sourceScript, "utf8"));
  return { root, project, assetsDir, copiedScript };
}

function makeOgg(root, relativePath) {
  const path = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "test audio bytes");
}

test("copies wanted sound categories and excludes music and unrelated mob sounds", t => {
  const f = fixture();
  t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const source = join(f.root, "MinecraftSounds");
  for (const path of [
    "dig/stone1.ogg",
    "step/wood1.ogg",
    "liquid/splash.ogg",
    "random/click1.ogg",
    "block/wooden_door/open1.ogg",
    "entity/player/attack/crit1.ogg",
    "entity/zombie/ambient1.ogg",
    "entity/zombie/death.ogg",
    "entity/zombie/step1.ogg",
    "mob/creeper/say1.ogg",
    "music/menu.ogg",
  ]) makeOgg(source, path);

  execFileSync(process.execPath, [f.copiedScript, source], { stdio: "pipe" });
  const output = join(f.assetsDir, "sounds");
  const manifest = JSON.parse(readFileSync(join(output, "manifest.json"), "utf8"));
  assert.deepEqual(manifest, [...manifest].sort());
  assert.ok(manifest.includes("dig/stone1.ogg"));
  assert.ok(manifest.includes("step/wood1.ogg"));
  assert.ok(manifest.includes("entity/zombie/ambient1.ogg"));
  assert.ok(manifest.includes("entity/zombie/death.ogg"));
  assert.ok(manifest.includes("mob/creeper/say1.ogg"));
  assert.ok(!manifest.includes("entity/zombie/step1.ogg"));
  assert.ok(!manifest.some(path => path.startsWith("music/")));
  for (const path of manifest) assert.ok(existsSync(join(output, path)), "missing copied file: " + path);
});

test("leaves the previous sound bundle untouched when no OGG files match", t => {
  const f = fixture();
  t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const output = join(f.assetsDir, "sounds");
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, "manifest.json"), JSON.stringify(["old.ogg"]));
  writeFileSync(join(output, "old.ogg"), "previous bundle");
  const source = join(f.root, "empty-sounds");
  mkdirSync(join(source, "dig"), { recursive: true });

  let failure;
  try {
    execFileSync(process.execPath, [f.copiedScript, source], { stdio: "pipe" });
  } catch (error) { failure = error; }
  assert.ok(failure, "expected the script to fail on an empty sound source");
  assert.equal(readFileSync(join(output, "manifest.json"), "utf8"), '["old.ogg"]');
  assert.equal(readFileSync(join(output, "old.ogg"), "utf8"), "previous bundle");
});
