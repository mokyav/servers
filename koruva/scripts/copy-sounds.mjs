#!/usr/bin/env node
// Copy the gameplay OGG files used by Koruva into Vite's public assets.
// Usage: node scripts/copy-sounds.mjs <extracted-MinecraftSounds-directory>
// Supports a directory containing sounds/, minecraft/sounds/, or assets/minecraft/sounds/.
// Music is excluded. Generated audio files remain local and are not committed to Git.
import {
  cpSync, existsSync, lstatSync, mkdirSync, readdirSync,
  renameSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceArg = process.argv[2];
if (!sourceArg) {
  console.error("Usage: node scripts/copy-sounds.mjs <extracted-MinecraftSounds-directory>");
  process.exit(1);
}
const requestedSource = resolve(sourceArg);
if (!existsSync(requestedSource) || !lstatSync(requestedSource).isDirectory()) {
  console.error("Source must be an extracted directory (not a ZIP file): " + requestedSource);
  process.exit(1);
}

const MOB_ENTITY_DIRS = new Set([
  "allay", "armadillo", "axolotl", "bat", "bee", "blaze", "bogged", "breeze", "camel",
  "camel_husk", "cat", "cave_spider", "chicken", "cod", "copper_golem", "cow", "creaking", "creeper",
  "dolphin", "donkey", "drowned", "elder_guardian", "ender_dragon", "enderman", "endermite",
  "evoker", "fox", "frog", "ghast", "glow_squid", "goat", "guardian", "hoglin", "horse",
  "husk", "iron_golem", "llama", "magma_cube", "mooshroom", "mule", "ocelot", "panda",
  "parrot", "phantom", "pig", "piglin", "piglin_brute", "pillager", "polar_bear", "pufferfish",
  "rabbit", "ravager", "salmon", "sheep", "shulker", "silverfish", "skeleton", "slime", "sulfur_cube",
  "happy_ghast", "nautilus", "parched", "sniffer", "snow_golem", "spider", "squid", "stray", "strider", "tadpole", "trader_llama",
  "tropical_fish", "turtle", "vex", "villager", "vindicator", "wandering_trader", "warden",
  "witch", "wither", "wither_skeleton", "wolf", "zoglin", "zombie", "zombie_horse",
  "zombie_nautilus", "zombie_villager", "zombified_piglin",
]);
const mobNames = /^(say|idle|ambient|breathe|moan|growl|moody|meow|bark|cackle|hurt|hit|hitt|damage|death|elder_)/i;
const specs = [
  { dir: "dig" }, { dir: "step" }, { dir: "damage" }, { dir: "fire" },
  { dir: "portal" }, { dir: "fireworks" },
  { dir: "liquid", test: (_rel, name) => /^(splash|splash2|heavy_splash|swim\d*|water)\.ogg$/i.test(name) },
  { dir: "random", test: (_rel, name) => /^(click|pop|orb|levelup|eat\d*|burp|drink|splash|glass\d*|explode\d*|fuse|bow|bowhit\d*|anvil_\w+|break|classic_hurt|successful_hit|fizz)\.ogg$/i.test(name) },
  { dir: "ui/button" },
  { dir: "entity/player/attack" }, { dir: "entity/player/hurt" },
  { dir: "entity/bobber" }, { dir: "entity/fish" },
  { dir: "entity/shulker" }, { dir: "entity/witch" }, { dir: "entity/snowman" },
  { dir: "entity/experience_orb" },
  { dir: "entity", test: rel => MOB_ENTITY_DIRS.has(rel.split("/")[0]) && mobNames.test(rel.slice(rel.lastIndexOf("/") + 1)) },
  { dir: "item/bucket" }, { dir: "item/bottle" }, { dir: "item/totem" },
  { dir: "item/armor", test: (_rel, name) => /^equip_/i.test(name) },
  { dir: "block/wooden_door" }, { dir: "block/iron_door" }, { dir: "block/fence_gate" },
  { dir: "block/wooden_trapdoor" }, { dir: "block/iron_trapdoor" },
  { dir: "block/copper_door" }, { dir: "block/copper_trapdoor" },
  { dir: "block/chest" }, { dir: "block/furnace" },
  { dir: "ambient/cave" }, { dir: "ambient/underwater" },
  { dir: "mob", test: (_rel, name) => mobNames.test(name) },
];

const isDirectory = path => {
  try { return lstatSync(path).isDirectory(); } catch { return false; }
};
const roots = [
  requestedSource,
  join(requestedSource, "assets", "minecraft", "sounds"),
  join(requestedSource, "minecraft", "sounds"),
  join(requestedSource, "sounds"),
  join(requestedSource, "assets", "sounds"),
];
const sourceRoot = roots.find(root => isDirectory(root) && specs.some(spec => isDirectory(join(root, spec.dir))));
if (!sourceRoot) {
  console.error("Could not locate sound folders. Pass the extracted folder containing dig/, step/, mob/, or assets/minecraft/sounds/.");
  process.exit(1);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const publicAssets = join(scriptDir, "..", "src", "client", "public", "assets");
const outputDir = join(publicAssets, "sounds");
const stagingDir = join(publicAssets, ".sounds-staging");
const backupDir = join(publicAssets, ".sounds-backup");

function walk(directory, root, result) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path, root, result);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".ogg")) {
      result.push(relative(root, path).split("\\").join("/"));
    }
  }
}

const selected = new Set();
for (const spec of specs) {
  const directory = join(sourceRoot, spec.dir);
  if (!isDirectory(directory)) continue;
  const candidates = [];
  walk(directory, sourceRoot, candidates);
  for (const file of candidates) {
    const inside = file.slice(spec.dir.length + 1);
    const basename = inside.slice(inside.lastIndexOf("/") + 1);
    if (!spec.test || spec.test(inside, basename)) selected.add(file);
  }
}
const files = [...selected].sort();
if (!files.length) {
  console.error("No matching OGG files found. Existing output was left untouched.");
  process.exit(1);
}

mkdirSync(publicAssets, { recursive: true });
if (!existsSync(outputDir) && existsSync(backupDir)) renameSync(backupDir, outputDir);
rmSync(stagingDir, { recursive: true, force: true });
rmSync(backupDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });

const copied = [];
let totalBytes = 0;
try {
  for (const file of files) {
    const source = join(sourceRoot, file);
    if (!existsSync(source) || !lstatSync(source).isFile()) continue;
    const destination = join(stagingDir, file);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination);
    copied.push(file);
    totalBytes += statSync(destination).size;
  }
  if (!copied.length) throw new Error("No audio files could be copied.");
  writeFileSync(join(stagingDir, "manifest.json"), JSON.stringify(copied, null, 2) + "\n", "utf8");
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

console.log("Copied " + copied.length + " OGG files (" + (totalBytes / 1024 / 1024).toFixed(2) + " MiB).");
console.log("Output: " + outputDir);
console.log("manifest.json created. Music folders were excluded.");
