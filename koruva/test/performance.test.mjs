import assert from "node:assert/strict";
import { test } from "node:test";
import { AdaptiveRenderDistanceTuner, PERFORMANCE_LEVELS, applyPerformanceLevel, defaultPerformanceSettings, isWithinEntityRenderDistance, normalizePerformanceSettings } from "../src/client/performance.js";

test("10 quality levels are ordered, distinct in range, and have bounded client chunk/entity budgets", () => {
  assert.equal(PERFORMANCE_LEVELS.length, 10);
  assert.deepEqual(PERFORMANCE_LEVELS.map((x) => x.level), [1,2,3,4,5,6,7,8,9,10]);
  const distances = PERFORMANCE_LEVELS.map((x) => x.renderDistance);
  assert.equal(distances[0], 2); assert.equal(distances.at(-1), 12);
  assert.ok(distances.every((x, i) => i === 0 || x > distances[i - 1]));
  assert.ok(PERFORMANCE_LEVELS.every((x) => Number.isInteger(x.chunkGenBudget) && x.chunkGenBudget >= 1 && x.chunkGenBudget <= 2));
  assert.ok(PERFORMANCE_LEVELS.every((x) => Number.isInteger(x.chunkMeshBudget) && x.chunkMeshBudget >= 1 && x.chunkMeshBudget <= 3));
  assert.deepEqual(PERFORMANCE_LEVELS.map((x) => [x.chunkGenBudget,x.chunkMeshBudget]), [[1,1],[1,1],[1,2],[1,2],[2,3],[2,3],[2,3],[2,3],[2,3],[2,3]]);
  assert.deepEqual(PERFORMANCE_LEVELS.map((x) => x.entityRenderDistance), [16,24,32,40,48,56,64,72,80,96]);
  assert.ok(PERFORMANCE_LEVELS.every((x) => x.entityRenderDistance >= 16 && x.entityRenderDistance <= 96));
});

test("defaults and legacy local settings migrate without changing their chosen level", () => {
  assert.deepEqual(defaultPerformanceSettings(), { rd: 6, sens: 5, profile: 5, autoOptimize: false, chunkGenBudget: 2, chunkMeshBudget: 3, entityRenderDistance: 48 });
  assert.deepEqual(normalizePerformanceSettings({ rd: 6, sens: 7 }), { rd: 6, sens: 7, profile: 5, autoOptimize: false, chunkGenBudget: 2, chunkMeshBudget: 3, entityRenderDistance: 48 });
  assert.deepEqual(normalizePerformanceSettings(null), defaultPerformanceSettings());
});

test("malformed settings are clamped and mismatched profiles become Custom", () => {
  assert.deepEqual(normalizePerformanceSettings({ rd: 99, sens: -4, profile: 5, autoOptimize: "yes" }), { rd: 12, sens: 1, profile: "custom", autoOptimize: false, chunkGenBudget: 2, chunkMeshBudget: 3, entityRenderDistance: 96 });
  assert.deepEqual(normalizePerformanceSettings({ rd: 6, profile: 5, chunkGenBudget: 99, chunkMeshBudget: 0 }), { rd: 6, sens: 5, profile: "custom", autoOptimize: false, chunkGenBudget: 2, chunkMeshBudget: 1, entityRenderDistance: 48 });
  assert.equal(normalizePerformanceSettings({ entityRenderDistance: 500 }).entityRenderDistance, 96);
  assert.equal(normalizePerformanceSettings({ entityRenderDistance: 1 }).entityRenderDistance, 16);
});

test("selecting a preset applies its render and chunk/entity budgets while preserving unrelated preferences", () => {
  const result = applyPerformanceLevel({ rd: 6, sens: 9, profile: 5, autoOptimize: true }, 8);
  assert.deepEqual(result, { rd: 9, sens: 9, profile: 8, autoOptimize: true, chunkGenBudget: 2, chunkMeshBudget: 3, entityRenderDistance: 72 });
  assert.deepEqual(applyPerformanceLevel(result, 4), { rd: 5, sens: 9, profile: 4, autoOptimize: true, chunkGenBudget: 1, chunkMeshBudget: 2, entityRenderDistance: 40 });
});

test("custom settings retain explicit client budgets and invalid levels are a no-op", () => {
  const custom = normalizePerformanceSettings({ rd: 7, profile: "custom", chunkGenBudget: 1, chunkMeshBudget: 2, entityRenderDistance: 60 });
  assert.equal(custom.profile, "custom");
  assert.equal(custom.chunkGenBudget, 1); assert.equal(custom.chunkMeshBudget, 2); assert.equal(custom.entityRenderDistance, 60);
  assert.deepEqual(applyPerformanceLevel(custom, 0), custom);
});

test("FPS tuner uses hysteresis and clamps at supported render-distance limits", () => {
  const tuner = new AdaptiveRenderDistanceTuner();
  for (let i=0;i<3;i++) assert.equal(tuner.sample(6, 20), null);
  assert.equal(tuner.sample(6, 20), 5);
  assert.equal(tuner.sample(6, 40), null);
  for (let i=0;i<11;i++) assert.equal(tuner.sample(6, 60), null);
  assert.equal(tuner.sample(6, 60), 7);
  for (let i=0;i<4;i++) assert.equal(tuner.sample(2, 20), null);
  for (let i=0;i<12;i++) assert.equal(tuner.sample(12, 60), null);
});

test("entity culling uses a 3D radius, includes boundary and rejects invalid inputs", () => {
  assert.equal(isWithinEntityRenderDistance(0,0,0,3,4,0,5), true);
  assert.equal(isWithinEntityRenderDistance(0,0,0,3,4,1,5), false);
  assert.equal(isWithinEntityRenderDistance(0,0,0,1,0,0,-1), false);
  assert.equal(isWithinEntityRenderDistance(Number.NaN,0,0,0,0,0,10), false);
});
