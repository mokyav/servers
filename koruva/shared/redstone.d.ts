export type RedstoneNodeKind = "source" | "repeater" | "wire" | "consumer";
export interface RedstoneNode { id: string; kind: RedstoneNodeKind; power?: number; connections?: string[] }
export interface RedstoneSchedulerEntry { id: string; signal: number; dueTick: number }
export interface RedstoneScheduler {
  readonly size: number;
  schedule(id: string, signal: number, dueTick: number): boolean;
  popDue(tick: number, limit?: number): RedstoneSchedulerEntry[];
  cancel(id: string): boolean;
  clear(): void;
}
export const REDSTONE_MAX_SIGNAL: 15;
export const REDSTONE_DEFAULT_MAX_NODES: 4096;
export const REDSTONE_DEFAULT_MAX_STEPS: 65536;
export function normalizeRedstoneSignal(value: number): number;
export function computeRedstoneSignals(nodes: RedstoneNode[], options?: { maxNodes?: number; maxSteps?: number }): Map<string, number>;
export function createRedstoneScheduler(options?: { maxPending?: number }): RedstoneScheduler;
