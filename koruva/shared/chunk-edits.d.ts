export type ChunkRecord = Uint8Array | Uint16Array;
export interface PersistentChunkEditsOptions { prefix: string; volume: number; maxRecords: number; noEdit?: number }
export type PersistChunkRecord = (key: string, value: Uint16Array) => Promise<unknown>;
export const MAX_BLOCK_ID: 65534;
export const NO_EDIT_U16: 65535;
export function normalizeChunkRecord(record: ChunkRecord, volume: number, noEdit?: number): Uint16Array | null;
export class PersistentChunkEdits {
  constructor(chunks: Map<string, ChunkRecord>, persist: PersistChunkRecord, options: PersistentChunkEditsOptions);
  apply(key: string, index: number, value: number): Promise<boolean>;
}
