const DISTANCE_MIN = 2;
const DISTANCE_MAX = 12;
const LEVELS = [
  { level: 1, name: "Minimum", renderDistance: 2, chunkGenBudget: 1, chunkMeshBudget: 1, entityRenderDistance: 16 },
  { level: 2, name: "Very Low", renderDistance: 3, chunkGenBudget: 1, chunkMeshBudget: 1, entityRenderDistance: 24 },
  { level: 3, name: "Low", renderDistance: 4, chunkGenBudget: 1, chunkMeshBudget: 2, entityRenderDistance: 32 },
  { level: 4, name: "Low+", renderDistance: 5, chunkGenBudget: 1, chunkMeshBudget: 2, entityRenderDistance: 40 },
  { level: 5, name: "Normal", renderDistance: 6, chunkGenBudget: 2, chunkMeshBudget: 3, entityRenderDistance: 48 },
  { level: 6, name: "Normal+", renderDistance: 7, chunkGenBudget: 2, chunkMeshBudget: 3, entityRenderDistance: 56 },
  { level: 7, name: "High", renderDistance: 8, chunkGenBudget: 2, chunkMeshBudget: 3, entityRenderDistance: 64 },
  { level: 8, name: "Very High", renderDistance: 9, chunkGenBudget: 2, chunkMeshBudget: 3, entityRenderDistance: 72 },
  { level: 9, name: "Extreme", renderDistance: 10, chunkGenBudget: 2, chunkMeshBudget: 3, entityRenderDistance: 80 },
  { level: 10, name: "Ultra Extreme", renderDistance: 12, chunkGenBudget: 2, chunkMeshBudget: 3, entityRenderDistance: 96 },
].map((entry) => Object.freeze(entry));

export const PERFORMANCE_LEVELS = Object.freeze(LEVELS);
export const defaultPerformanceSettings = () => ({ rd: 6, sens: 5, profile: 5, autoOptimize: false, chunkGenBudget: 2, chunkMeshBudget: 3, entityRenderDistance: 48 });

function integerInRange(value, min, max, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function normalizePerformanceSettings(value) {
  const raw = value && typeof value === "object" ? value : {};
  const rd = integerInRange(raw.rd, DISTANCE_MIN, DISTANCE_MAX, 6);
  const sens = integerInRange(raw.sens, 1, 10, 5);
  const declared = Number.isInteger(raw.profile) && raw.profile >= 1 && raw.profile <= 10
    ? LEVELS[raw.profile - 1]
    : null;
  const distanceEntry = LEVELS.find((entry) => entry.renderDistance === rd);
  const nearestEntry = distanceEntry ?? LEVELS.reduce((best, entry) =>
    Math.abs(entry.renderDistance - rd) < Math.abs(best.renderDistance - rd) ? entry : best, LEVELS[4]);
  // Old saves contain no chunk budgets. Derive them from the matching named level;
  // custom distances use the nearest conservative profile as their fallback.
  const fallbackEntry = declared && declared.renderDistance === rd ? declared : nearestEntry;
  const chunkGenBudget = integerInRange(raw.chunkGenBudget, 1, 2, fallbackEntry.chunkGenBudget);
  const chunkMeshBudget = integerInRange(raw.chunkMeshBudget, 1, 3, fallbackEntry.chunkMeshBudget);
  const entityRenderDistance = integerInRange(raw.entityRenderDistance, 16, 96, fallbackEntry.entityRenderDistance);
  const matchesEntry = (entry) => entry.renderDistance === rd &&
    entry.chunkGenBudget === chunkGenBudget && entry.chunkMeshBudget === chunkMeshBudget &&
    entry.entityRenderDistance === entityRenderDistance &&
    (raw.chunkGenBudget == null || raw.chunkGenBudget === entry.chunkGenBudget) &&
    (raw.chunkMeshBudget == null || raw.chunkMeshBudget === entry.chunkMeshBudget) &&
    (raw.entityRenderDistance == null || raw.entityRenderDistance === entry.entityRenderDistance);
  let profile = "custom";
  if (raw.profile === "custom") profile = "custom";
  else if (declared && matchesEntry(declared)) profile = declared.level;
  else if (raw.profile == null) profile = LEVELS.find(matchesEntry)?.level ?? "custom";
  return { rd, sens, profile, autoOptimize: typeof raw.autoOptimize === "boolean" ? raw.autoOptimize : false, chunkGenBudget, chunkMeshBudget, entityRenderDistance };
}

export function applyPerformanceLevel(settings, level) {
  const current = normalizePerformanceSettings(settings);
  const entry = LEVELS.find((candidate) => candidate.level === level);
  if (!entry) return current;
  return {
    ...current,
    rd: entry.renderDistance,
    profile: entry.level,
    chunkGenBudget: entry.chunkGenBudget,
    chunkMeshBudget: entry.chunkMeshBudget,
    entityRenderDistance: entry.entityRenderDistance,
  };
}

/** Client presentation culling only; must never gate server simulation. */
export function isWithinEntityRenderDistance(px, py, pz, x, y, z, maxDistance) {
  if (![px, py, pz, x, y, z, maxDistance].every(Number.isFinite) || maxDistance < 0) return false;
  const dx = x - px, dy = y - py, dz = z - pz;
  return dx * dx + dy * dy + dz * dz <= maxDistance * maxDistance;
}

/** Conservative, opt-in FPS hysteresis; only proposes a client render-distance change. */
export class AdaptiveRenderDistanceTuner {
  lowSamples = 0;
  highSamples = 0;

  reset() { this.lowSamples = 0; this.highSamples = 0; }

  sample(currentDistance, fps) {
    if (!Number.isFinite(currentDistance) || !Number.isFinite(fps) || fps <= 0) {
      this.reset();
      return null;
    }
    const distance = integerInRange(currentDistance, DISTANCE_MIN, DISTANCE_MAX, 6);
    if (fps < 30) {
      this.lowSamples++;
      this.highSamples = 0;
      if (this.lowSamples >= 4) {
        this.lowSamples = 0;
        return distance > DISTANCE_MIN ? distance - 1 : null;
      }
    } else if (fps >= 55) {
      this.highSamples++;
      this.lowSamples = 0;
      if (this.highSamples >= 12) {
        this.highSamples = 0;
        return distance < DISTANCE_MAX ? distance + 1 : null;
      }
    } else {
      this.reset();
    }
    return null;
  }
}
