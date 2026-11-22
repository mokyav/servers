export const MIN_REPEATER_DELAY_TICKS: 1;
export const MAX_REPEATER_DELAY_TICKS: 4;
export const DEFAULT_MAX_PENDING_REPEATERS: 4096;
export interface RepeaterTransition { id: string; powered: boolean; dueTick: number }
export interface RepeaterDelaySnapshot { tick: number; outputs: Array<[string, boolean]>; pending: RepeaterTransition[] }
export interface RepeaterDelayController {
  readonly size: number; readonly tick: number;
  getOutput(id: string): boolean; initialize(id: string, powered: boolean): void;
  schedule(id: string, inputPowered: boolean, delayTicks: number, currentTick: number): boolean;
  advance(tick: number, limit?: number): RepeaterTransition[]; cancel(id: string): boolean; remove(id: string): boolean;
  snapshot(): RepeaterDelaySnapshot; restore(snapshot: unknown): void; clear(): void;
}
export function createRepeaterDelayController(options?: { maxPending?: number }): RepeaterDelayController;
