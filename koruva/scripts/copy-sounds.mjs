#!/usr/bin/env node
// Copy the complete Minecraft OGG sound set into Koruva's local Vite assets.
// Accepts an extracted resource pack directory or a MinecraftSounds ZIP archive:
//   node scripts/copy-sounds.mjs ~/Downloads/MinecraftSounds.zip
// Use --no-music to exclude music/ and records/ for a smaller local build.
import { spawnSync } from "node:child_process";
import {
  cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync,
  renameSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const sourceArg = process.argv[2];
const noMusic = process.argv.includes("--no-music");
const MAX_ASSET_BYTES = 25 * 1024 * 1024;

function resolvePath(value) {
  return value.startsWith("/") ? value : join(process.cwd(), value);
}
function isDirectory(path) {
  try { return lstatSync(path).isDirectory(); } catch { return false; }
}
function isSoundRoot(path) {
  return ["dig", "step", "mob", "block", "entity", "music"].some(name => isDirectory(join(path, name)));
}
function findSoundRoot(root, maxDepth = 6) {
  const queue = [{ path: root, depth: 0 }];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current.path)) continue;
    visited.add(current.path);
    if (isSoundRoot(current.path)) return current.path;
    if (current.depth >= maxDepth) continue;
    let entries = [];
    try { entries = readdirSync(current.path, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        queue.push({ path: join(current.path, entry.name), depth: current.depth + 1 });
      }
    }
  }
  return null;
}
function walk(directory, root, result) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) walk(path, root, result);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".ogg")) {
      result.push(relative(root, path).split("\\").join("/"));
    }
  }
}

if (!sourceArg) {
  console.error("Usage: node scripts/copy-sounds.mjs <MinecraftSounds directory|zip> [--no-music]");
  process.exit(1);
}

const requestedSource = resolvePath(sourceArg);
if (!existsSync(requestedSource)) {
  console.error("Sound source does not exist: " + requestedSource);
  process.exit(1);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const publicAssets = join(scriptDir, "..", "src", "client", "public", "assets");
const outputDir = join(publicAssets, "sounds");
const stagingDir = join(publicAssets, ".sounds-staging");
const backupDir = join(publicAssets, ".sounds-backup");
let extractionDir = null;

try {
  let sourceRoot = null;
  if (isDirectory(requestedSource)) {
    sourceRoot = findSoundRoot(requestedSource);
  } else if (lstatSync(requestedSource).isFile() && requestedSource.toLowerCase().endsWith(".zip")) {
    extractionDir = mkdtempSync(join(tmpdir(), "koruva-minecraft-sounds-"));
    const listing = spawnSync("unzip", ["-Z1", requestedSource], { encoding: "utf8", maxBuffer: 100 * 1024 * 1024 });
    if (listing.error || listing.status !== 0) throw new Error("Could not list ZIP entries. Make sure 'unzip' is installed.");
    const entries = String(listing.stdout ?? "").split(/\r?\n/).filter(Boolean);
    const unsafe = entries.find(entry => entry.startsWith("/") || entry.includes("\\\\") || entry.split("/").some(part => part === ".."));
    if (unsafe) throw new Error("ZIP contains an unsafe path: " + unsafe);
    const extracted = spawnSync("unzip", ["-q", "-o", requestedSource, "-d", extractionDir], { stdio: "inherit" });
    if (extracted.error || extracted.status !== 0) throw new Error("Could not extract ZIP. Check that it is a valid archive.");
    sourceRoot = findSoundRoot(extractionDir);
  } else {
    throw new Error("Source must be an extracted directory or a .zip archive.");
  }
  if (!sourceRoot) throw new Error("Could not find a Minecraft sounds directory (block/, entity/, dig/, step/ or mob/).");

  const allFiles = [];
  walk(sourceRoot, sourceRoot, allFiles);
  const selected = allFiles
    .filter(file => !noMusic || !(file.startsWith("music/") || file.startsWith("records/")))
    .sort();
  if (!selected.length) throw new Error("No matching OGG files found. Existing output was left untouched.");

  const oversized = [];
  let totalBytes = 0;
  for (const file of selected) {
    const size = statSync(join(sourceRoot, file)).size;
    totalBytes += size;
    if (size > MAX_ASSET_BYTES) oversized.push(file + " (" + (size / 1024 / 1024).toFixed(1) + " MiB)");
  }
  if (oversized.length) {
    throw new Error("Sounds exceed Cloudflare's 25 MiB per-asset limit: " + oversized.join(", "));
  }

  mkdirSync(publicAssets, { recursive: true });
  rmSync(stagingDir, { recursive: true, force: true });
  rmSync(backupDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });
  const copied = [];
  try {
    for (const file of selected) {
      const from = join(sourceRoot, file);
      const to = join(stagingDir, file);
      mkdirSync(dirname(to), { recursive: true });
      cpSync(from, to);
      copied.push(file);
    }
    writeFileSync(join(stagingDir, "manifest.json"), JSON.stringify(copied, null, 2) + "\\n", "utf8");
    if (existsSync(outputDir)) renameSync(outputDir, backupDir);
    try {
      renameSync(stagingDir, outputDir);
      rmSync(backupDir, { recursive: true, force: true });
    } catch (error) {
      if (!existsSync(outputDir) && existsSync(backupDir)) renameSync(backupDir, outputDir);
      throw error;
    }
  } catch (error) {
    rmSync(stagingDir, { recursive: true, force: true });
    throw error;
  }

  console.log("Copied " + copied.length + " OGG files (" + (totalBytes / 1024 / 1024).toFixed(1) + " MiB).");
  console.log("Output: " + outputDir);
  console.log("Music and records: " + (noMusic ? "excluded" : "included") + ".");
} finally {
  if (extractionDir) rmSync(extractionDir, { recursive: true, force: true });
}
