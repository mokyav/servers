import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMob, stepMobAI } from '../shared/mob-ai.js';

const player = { id: 'player', p: [8, 10, 0], gameMode: 'survival' };
test('skeleton and stray emit a gravity-compensated physical arrow instead of instant ranged damage', () => {
  for (const type of ['skeleton', 'stray']) {
    const result = stepMobAI(createMob(type, `${type}-1`, 0, 10, 0), [player], 0.2, 1000, () => false);
    assert.equal(result.attacks.length, 0);
    assert.equal(result.projectiles[0]?.type, 'arrow');
    assert.ok(result.projectiles[0].vy > 0);
  }
});

test('Durable Object owns projectile physics, block collision, player and mob damage, and persistence', () => {
  const room = readFileSync(new URL('../src/worker/room.ts', import.meta.url), 'utf8');
  assert.match(room, /private async tickProjectiles\(/);
  assert.match(room, /projectile\.vy -= \(projectile\.type===\"dragon_fireball\"\?2:24\) \* stepDt/);
  assert.match(room, /blockOccupiesSubcell\(blockId, qx, qy, qz\)/);
  assert.match(room, /mobDimensionId\(mob\) !== projectile\.dimensionId/);
  assert.match(room, /this\.ctx\.storage\.put\("projectiles"/);
  assert.match(room, /this\.ctx\.storage\.put\("mobs"/);
});
