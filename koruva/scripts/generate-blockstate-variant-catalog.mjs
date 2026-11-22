#!/usr/bin/env node
/** Generate additional state combinations for vanilla blockstates not covered by legacy shape-specific IDs. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MINECRAFT_BLOCK_IDS } from '../shared/minecraft-block-catalog.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'src/client/public/assets/minecraft/blockstates');
const specialKind = (t) => t.endsWith('_stairs') || t.endsWith('_slab') || t.endsWith('_fence_gate') || t.endsWith('_door') || t.endsWith('_trapdoor') || t.endsWith('_fence') || t.endsWith('_wall') || t.endsWith('_pane') || t === 'iron_bars';
const result = {};
function collectDomains(when, domains) {
  if (!when) return;
  if (Array.isArray(when.OR)) { for (const value of when.OR) collectDomains(value, domains); return; }
  if (Array.isArray(when.AND)) { for (const value of when.AND) collectDomains(value, domains); return; }
  for (const [key, value] of Object.entries(when)) {
    const values = String(value).split('|');
    if (!domains.has(key)) domains.set(key, new Set());
    for (const item of values) domains.get(key).add(item);
  }
}
function cartesian(domains) {
  let combinations = [{}];
  for (const [key, values] of domains) {
    combinations = combinations.flatMap((entry) => [...values].map((value) => ({ ...entry, [key]: value })));
    if (combinations.length > 4096) return [];
  }
  return combinations;
}
for (const identifier of MINECRAFT_BLOCK_IDS) {
  const token = identifier.slice('minecraft:'.length);
  if (specialKind(token)) continue;
  const file = path.join(dir, `${token}.json`);
  let blockstate;
  try { blockstate = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
  const states = new Map();
  for (const condition of Object.keys(blockstate.variants ?? {})) {
    const state = {};
    if (condition) for (const part of condition.split(',')) {
      const at = part.indexOf('=');
      if (at > 0) state[part.slice(0, at)] = part.slice(at + 1);
    }
    if (Object.keys(state).length) states.set(JSON.stringify(Object.fromEntries(Object.entries(state).sort())), state);
  }
  if (Array.isArray(blockstate.multipart)) {
    const domains = new Map();
    for (const part of blockstate.multipart) collectDomains(part.when, domains);
    for (const state of cartesian(domains)) if (Object.keys(state).length) states.set(JSON.stringify(Object.fromEntries(Object.entries(state).sort())), state);
  }
  // These blocks are rendered by block-entity models in Java and therefore do not
  // expose their facing in blockstates.json. Include directional Koruva states.
  if (token === 'chest' || token === 'trapped_chest' || token === 'ender_chest' || token.endsWith('_chest')) {
    for (const facing of ['north', 'east', 'south', 'west']) states.set(JSON.stringify({ facing }), { facing });
  }
  if (states.size) result[token] = [...states.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
const output = `// Generated from the bundled Minecraft Java 26.3 blockstates.\nexport const MINECRAFT_GENERIC_BLOCKSTATE_VARIANTS = ${JSON.stringify(result)};\n`;
fs.writeFileSync(path.join(root, 'shared/minecraft-blockstate-variant-catalog.js'), output);
fs.writeFileSync(path.join(root, 'shared/minecraft-blockstate-variant-catalog.d.ts'), 'export const MINECRAFT_GENERIC_BLOCKSTATE_VARIANTS: Record<string, Array<Record<string, string>>>;\n');
const count = Object.values(result).reduce((sum, values) => sum + values.length, 0);
console.log(`Generated ${Object.keys(result).length} generic blockstate catalogs / ${count} variants.`);
