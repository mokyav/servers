export type PerformanceProfile = Readonly<{
  level: number;
  name: string;
  renderDistance: number;
  chunkGenBudget: number;
  chunkMeshBudget: number;
  entityRenderDistance: number;
}>;

export type PerformanceSettings = {
  rd: number;
  sens: number;
  profile: number | "custom";
  autoOptimize: boolean;
  chunkGenBudget: number;
  chunkMeshBudget: number;
  entityRenderDistance: number;
};

export const PERFORMANCE_LEVELS: readonly PerformanceProfile[];
export function defaultPerformanceSettings(): PerformanceSettings;
export function normalizePerformanceSettings(value: unknown): PerformanceSettings;
export function applyPerformanceLevel(settings: unknown, level: number): PerformanceSettings;
export function isWithinEntityRenderDistance(px: number, py: number, pz: number, x: number, y: number, z: number, maxDistance: number): boolean;

export class AdaptiveRenderDistanceTuner {
  lowSamples: number;
  highSamples: number;
  reset(): void;
  sample(currentDistance: number, fps: number): number | null;
}
