import { B, BLOCK_COUNT, BLOCKS } from "../../shared/blocks";
import { CHUNK_SIZE, CHUNK_VOLUME, WORLD_HEIGHT } from "../../shared/constants";
import { localCoord, localIndex, chunkCoord } from "../../shared/coords";
import { generateChunk, generateDimensionChunk, normalizeWorldgenVersion, WORLDGEN_VERSION } from "./worldgen";
import { DIMENSION_IDS, DIMENSIONS, normalizeDimensionId } from "../../shared/dimensions.js";
import { normalizeSavedDimensionState, normalizeDimensionEditRecord } from "../../shared/dimension-state.js";

export interface Chunk {
  cx: number;
  cz: number;
  data: Uint16Array;
  dirty: boolean;
  /** 空でない最大Y(メッシュ生成の走査範囲を狭める) */
  maxY: number;
}

export const chunkKey = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);

export class World {
  seed: number;
  worldgenVersion: number;
  dimensionId: string;
  chunks = new Map<number, Chunk>();
  /** 編集差分: chunkKey -> (localIndex -> blockId) */
  edits = new Map<number, Map<number, number>>();
  /** 編集差分をディメンション別に退避し、切替後も混在させない */
  private dimensionEdits = new Map<string, Map<number, Map<number, number>>>();
  /** 変更があったチャンク(再メッシュ対象) */
  onChunkDirty: ((c: Chunk) => void) | null = null;

  constructor(seed: number, worldgenVersion = WORLDGEN_VERSION, dimensionId: string = DIMENSION_IDS.OVERWORLD) {
    this.seed = seed;
    this.worldgenVersion = normalizeWorldgenVersion(worldgenVersion);
    this.dimensionId = normalizeDimensionId(dimensionId);
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cz));
  }

  ensureChunk(cx: number, cz: number): Chunk {
    const key = chunkKey(cx, cz);
    let c = this.chunks.get(key);
    if (c) return c;
    const data = this.dimensionId === DIMENSION_IDS.OVERWORLD
      ? generateChunk(this.seed, cx, cz, this.worldgenVersion)
      : generateDimensionChunk(this.seed, cx, cz, this.dimensionId);
    const ed = this.edits.get(key);
    if (ed) for (const [i, b] of ed) data[i] = b;
    c = { cx, cz, data, dirty: true, maxY: 0 };
    c.maxY = computeMaxY(data);
    this.chunks.set(key, c);
    // A neighbour that was meshed before this chunk existed omitted its boundary
    // faces against the unloaded (-1) region. Rebuild those neighbours now.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const neighbor = this.chunks.get(chunkKey(cx + dx, cz + dz));
      if (!neighbor) continue;
      neighbor.dirty = true;
      this.onChunkDirty?.(neighbor);
    }
    return c;
  }

  unloadChunk(cx: number, cz: number) {
    const removed = this.chunks.delete(chunkKey(cx, cz));
    if (!removed) return;

    // A retained neighbour may have culled faces against this chunk.
    // Mark it dirty so the newly exposed boundary is rendered.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const neighbor = this.chunks.get(chunkKey(cx + dx, cz + dz));
      if (!neighbor) continue;
      neighbor.dirty = true;
      this.onChunkDirty?.(neighbor);
    }
  }

  /** 範囲外Yは岩盤/空気、未ロードチャンクは -1 */
  get(x: number, y: number, z: number): number {
    if (y < 0) return B.BEDROCK;
    if (y >= WORLD_HEIGHT) return B.AIR;
    const c = this.chunks.get(chunkKey(chunkCoord(x), chunkCoord(z)));
    if (!c) return -1;
    return c.data[localIndex(x, y, z)];
  }

  isSolid(x: number, y: number, z: number): boolean {
    const b = this.get(x, y, z);
    return b === -1 ? true : BLOCKS[b].solid;
  }

  hasChunkAt(x: number, z: number): boolean {
    return this.chunks.has(chunkKey(chunkCoord(x), chunkCoord(z)));
  }

  /** ブロックを変更し差分を記録。変更があれば true */
  setBlock(x: number, y: number, z: number, b: number): boolean {
    if (y < 1 || y >= WORLD_HEIGHT) return false;
    const cx = chunkCoord(x), cz = chunkCoord(z);
    const key = chunkKey(cx, cz);
    const i = localIndex(x, y, z);
    let ed = this.edits.get(key);
    if (!ed) this.edits.set(key, (ed = new Map()));
    const c = this.chunks.get(key);
    if (c && c.data[i] === b) {
      ed.set(i, b);
      return false;
    }
    ed.set(i, b);
    if (!c) return true;

    c.data[i] = b;
    if (b !== 0 && y > c.maxY) {
      c.maxY = y;
    } else if (b === 0 && y === c.maxY) {
      // Keep the mesher's vertical scan bound tight after removing the highest block.
      c.maxY = computeMaxY(c.data);
    }

    // Always invalidate the edited chunk itself. Only face-adjacent chunks need
    // invalidation at a boundary; a diagonal chunk shares no rendered face.
    c.dirty = true;
    this.onChunkDirty?.(c);
    const lx = localCoord(x), lz = localCoord(z);
    const neighbors: Array<[number, number]> = [];
    if (lx === 0) neighbors.push([-1, 0]);
    if (lx === CHUNK_SIZE - 1) neighbors.push([1, 0]);
    if (lz === 0) neighbors.push([0, -1]);
    if (lz === CHUNK_SIZE - 1) neighbors.push([0, 1]);
    for (const [dx, dz] of neighbors) {
      const neighbor = this.chunks.get(chunkKey(cx + dx, cz + dz));
      if (!neighbor) continue;
      neighbor.dirty = true;
      this.onChunkDirty?.(neighbor);
    }
    return true;
  }

  /** 保存用: [x,y,z,b,...]。既存v1セーブとの互換用に現在のディメンションだけ返す */
  exportEdits(): number[] { return this.exportEditMap(this.edits); }

  /** 各ディメンションの編集差分を独立した座標空間で保存する */
  exportDimensionEdits(): Record<string, number[]> {
    const raw: Record<string, number[]> = Object.create(null);
    for (const id of Object.keys(DIMENSIONS)) {
      const map = id === this.dimensionId ? this.edits : this.dimensionEdits.get(id);
      raw[id] = map ? this.exportEditMap(map) : [];
    }
    return normalizeDimensionEditRecord(raw, { worldHeight: WORLD_HEIGHT, maxBlockId: BLOCK_COUNT });
  }

  /**
   * ディメンションを切り替え、現在の編集差分を退避して対象ディメンションの差分を復元する。
   * 呼出側はビュー/チャンクメッシュをクリアし、プレイヤー移動先を別途設定すること。
   */
  switchDimension(dimensionId: string): boolean {
    const next = normalizeDimensionId(dimensionId);
    if (next === this.dimensionId) return false;
    this.dimensionEdits.set(this.dimensionId, this.edits);
    this.dimensionId = next;
    this.edits = this.dimensionEdits.get(next) ?? new Map<number, Map<number, number>>();
    this.dimensionEdits.set(next, this.edits);
    this.chunks.clear();
    return true;
  }

  /** 新形式を読み込み、古い `edits` しかないv1セーブも移行する */
  importDimensionEdits(record: unknown, legacyCurrentEdits?: ArrayLike<number>) {
    const legacy = legacyCurrentEdits ? Array.from(legacyCurrentEdits) : [];
    const state = normalizeSavedDimensionState(record, this.dimensionId, legacy, {
      worldHeight: WORLD_HEIGHT, maxBlockId: BLOCK_COUNT,
    });
    this.dimensionEdits.clear();
    for (const id of Object.keys(DIMENSIONS)) {
      const map = new Map<number, Map<number, number>>();
      const list = state.edits[id] ?? [];
      for (let i = 0; i + 3 < list.length; i += 4) {
        const x = list[i], y = list[i + 1], z = list[i + 2], b = list[i + 3];
        const key = chunkKey(chunkCoord(x), chunkCoord(z));
        let chunk = map.get(key);
        if (!chunk) map.set(key, (chunk = new Map()));
        chunk.set(localIndex(x, y, z), b);
      }
      this.dimensionEdits.set(id, map);
    }
    this.edits = this.dimensionEdits.get(this.dimensionId) ?? new Map<number, Map<number, number>>();
    this.dimensionEdits.set(this.dimensionId, this.edits);
    this.chunks.clear();
  }

  importEdits(list: ArrayLike<number>) {
    for (let i = 0; i + 3 < list.length; i += 4) {
      this.setBlock(list[i], list[i + 1], list[i + 2], list[i + 3]);
    }
  }

  private exportEditMap(edits: Map<number, Map<number, number>>): number[] {
    const out: number[] = [];
    for (const [key, ed] of edits) {
      const cx = Math.floor(key / 65536) - 32768;
      const cz = (key % 65536) - 32768;
      for (const [i, b] of ed) out.push(cx * CHUNK_SIZE + (i & 15), i >> 8, cz * CHUNK_SIZE + ((i >> 4) & 15), b);
    }
    return out;
  }

  /** 全チャンクを破棄して差分も消す(ロード時のリセット用) */
  reset(seed: number, worldgenVersion: number = WORLDGEN_VERSION, dimensionId: string = this.dimensionId) {
    this.seed = seed;
    this.worldgenVersion = normalizeWorldgenVersion(worldgenVersion);
    this.dimensionId = normalizeDimensionId(dimensionId);
    this.chunks.clear();
    this.edits = new Map();
    this.dimensionEdits.clear();
  }
}

function computeMaxY(data: Uint16Array): number {
  for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
    const base = y * CHUNK_SIZE * CHUNK_SIZE;
    for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) if (data[base + i] !== 0) return y;
  }
  return 0;
}

export { CHUNK_VOLUME };
