import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('..', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');

test('online join and dimension snapshots preserve item-drop stack counts', () => {
  const room = read('src/worker/room.ts');
  const client = read('src/client/main.ts');
  assert.match(room, /liveDrops\(me\.dimensionId\)[\s\S]{0,160}count/);
  assert.match(room, /drops: \(await this\.liveDrops\(target\)\)\.map\(d => \(\{[\s\S]{0,360}d\.count/);
  assert.match(client, /if \(d\.xp !== undefined\) this\.drops\.addExperience\([\s\S]{0,180}d\.itemId \?\? d\.b \?\? 0, d\.count \?\? 1/);
  assert.match(client, /if \(drop\.xp !== undefined\) this\.drops\.addExperience\([\s\S]{0,180}drop\.itemId \?\? drop\.b \?\? 0, drop\.count \?\? 1/);
});

test('server persists and broadcasts drop stacks with a bounded count', () => {
  const room = read('src/worker/room.ts');
  assert.match(room, /const stackCount = Number\.isSafeInteger\(count\) \? Math\.max\(1, Math\.min\(64, count\)\) : 1/);
  assert.match(room, /t:\s*"drop"[\s\S]{0,150}count:\s*stackCount/);
  assert.match(room, /drop\.itemId, me\.dimensionId, drop\.count/);
});

test('solo pickup restores the full item-only stack count', () => {
  const client = read('src/client/main.ts');
  assert.match(client, /const itemId = this\.drops\.blockOf\(eid\), count = this\.drops\.countOf\(eid\);[\s\S]{0,220}this\.giveItem\(itemId, count\)/);
});

test('neighbor updates maintain stairs, fence/pane connections, support, and gravity in solo and room modes', () => {
  const client = read('src/client/main.ts');
  const room = read('src/worker/room.ts');
  const blocks = read('shared/blocks.ts');
  assert.match(blocks, /resolveBlockStateChanges/);
  assert.match(blocks, /shape === "stairs"[\s\S]{0,900}outer_left/);
  assert.match(blocks, /shape === "fence" \|\| defn\.shape === "pane"/);
  assert.match(client, /resolveBlockStateChanges\(get, cell\.x, cell\.y, cell\.z\)/);
  assert.match(room, /resolveBlockStateChanges\(get, cell\.x, cell\.y, cell\.z\)/);
  assert.match(client, /isFallingBlock\(id, BLOCKS\)/);
  assert.match(room, /isFallingBlock\(fallingId, BLOCKS\)/);
});
