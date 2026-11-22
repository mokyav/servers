import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const client = readFileSync(new URL('../src/client/main.ts', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../src/worker/room.ts', import.meta.url), 'utf8');
const protocol = readFileSync(new URL('../shared/protocol.ts', import.meta.url), 'utf8');

test('client has concrete local/online interactions for doors, trapdoors and fence gates', () => {
  assert.match(client, /private toggleLocalBlock\(/);
  assert.match(client, /private placeDoor\(/);
  assert.match(client, /itemDef\.key\.includes\("_fence_gate"\)/);
  assert.match(client, /BLOCKS\[lower\]\?\.key\.includes\("_fence_gate"\)/);
  assert.match(client, /this\.net\.send\(\{ t: "place-door", x, y, z, blockId: lower \}\)/);
  assert.match(client, /this\.net\.send\(\{ t: "use", x, y, z \}\)/);
  assert.match(client, /blockStateVariantId\(upper, \{ open \}\)/);
});

test('room server validates and places both halves of a door atomically enough to reject invalid placement', () => {
  const handlerStart = worker.indexOf('case "place-door":');
  const handlerEnd = worker.indexOf('case "dig-start":', handlerStart);
  const handler = worker.slice(handlerStart, handlerEnd);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
  assert.match(protocol, /t: "place-door"; x: number; y: number; z: number; blockId: number/);
  assert.match(handler, /y \+ 1 >= WORLD_HEIGHT/);
  assert.match(handler, /BLOCKS\[this\.blockAt\(x, y - 1, z, me\.dimensionId\)\]\?\.solid/);
  assert.match(handler, /const lower = blockStateVariantId\(blockId, \{ half: "lower" \}\)/);
  assert.match(handler, /upper = blockStateVariantId\(blockId, \{ half: "upper" \}\)/);
  assert.match(handler, /broadcastDimension\(\{ t: "set", x, y: y \+ 1, z, b: upper/);
});

test('3x3 online crafting includes workbench coordinates and server checks actual table and reach', () => {
  assert.match(client, /this\.net\.send\(\{ t: "craft", recipeId: recipe\.id, grid, workbench: this\.workbenchPos \}\)/);
  assert.match(worker, /BLOCKS\[tableId\]\?\.key !== "minecraft:crafting_table"/);
  assert.match(worker, /craftRecipeFitsGrid\(recipe, 2, 2\)/);
});
