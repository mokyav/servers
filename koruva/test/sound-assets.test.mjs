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
  return { root, assetsDir, copiedScript };
}
function makeFile(root, relativePath, content = "test audio bytes") {
  const path = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

test("copies every OGG from the MinecraftSounds ZIP, including per-block, entity, music and records", t => {
  const f = fixture();
  t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const source = join(f.root, "MinecraftSounds");
  makeFile(source, "assets/minecraft/sounds/block/stone/break1.ogg");
  makeFile(source, "assets/minecraft/sounds/dig/stone1.ogg");
  makeFile(source, "assets/minecraft/sounds/step/wood1.ogg");
  makeFile(source, "assets/minecraft/sounds/entity/zombie/ambient1.ogg");
  makeFile(source, "assets/minecraft/sounds/entity/wolf/step1.ogg");
  makeFile(source, "assets/minecraft/sounds/music/game/overworld1.ogg");
  makeFile(source, "assets/minecraft/sounds/records/13.ogg");
  makeFile(source, "assets/minecraft/sounds/music/ignored.mp3");
  const archive = join(f.root, "MinecraftSounds.zip");
  execFileSync("zip", ["-qr", archive, "."], { cwd: source });
  execFileSync(process.execPath, [f.copiedScript, archive], { stdio: "pipe" });

  const output = join(f.assetsDir, "sounds");
  const manifest = JSON.parse(readFileSync(join(output, "manifest.json"), "utf8"));
  assert.deepEqual(manifest, [...manifest].sort());
  for (const file of [
    "block/stone/break1.ogg", "dig/stone1.ogg", "step/wood1.ogg",
    "entity/zombie/ambient1.ogg", "entity/wolf/step1.ogg",
    "music/game/overworld1.ogg", "records/13.ogg",
  ]) {
    assert.ok(manifest.includes(file), "manifest is missing " + file);
    assert.ok(existsSync(join(output, file)), "copied file is missing " + file);
  }
  assert.ok(!manifest.some(file => file.endsWith(".mp3")));
});

test("--no-music excludes music and records but retains gameplay sound files", t => {
  const f = fixture();
  t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const source = join(f.root, "MinecraftSounds", "sounds");
  makeFile(source, "block/stone/break1.ogg");
  makeFile(source, "music/game/track.ogg");
  makeFile(source, "records/13.ogg");
  execFileSync(process.execPath, [f.copiedScript, source, "--no-music"], { stdio: "pipe" });
  const manifest = JSON.parse(readFileSync(join(f.assetsDir, "sounds", "manifest.json"), "utf8"));
  assert.deepEqual(manifest, ["block/stone/break1.ogg"]);
});

test("leaves the previous sound bundle untouched when no OGG files match", t => {
  const f = fixture();
  t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const output = join(f.assetsDir, "sounds");
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, "manifest.json"), JSON.stringify(["old.ogg"]));
  writeFileSync(join(output, "old.ogg"), "previous bundle");
  const source = join(f.root, "empty-sounds");
  mkdirSync(join(source, "block"), { recursive: true });

  let failure;
  try { execFileSync(process.execPath, [f.copiedScript, source], { stdio: "pipe" }); }
  catch (error) { failure = error; }
  assert.ok(failure, "expected the script to fail on an empty sound source");
  assert.equal(readFileSync(join(output, "manifest.json"), "utf8"), '["old.ogg"]');
  assert.equal(readFileSync(join(output, "old.ogg"), "utf8"), "previous bundle");
});
