export interface CommandTargetEntry<TSocket = unknown, TState = unknown> { ws: TSocket; st: TState; }
export declare function resolveCommandTargets<TSocket, TState extends { joined?: boolean; p?: readonly number[]; name?: string }>(
  who: string | undefined,
  candidates: readonly CommandTargetEntry<TSocket, TState>[],
  issuerSocket: TSocket,
  random?: () => number,
): CommandTargetEntry<TSocket, TState>[];
