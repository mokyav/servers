import { BLOCKS, blockHasPartialModelShape, blockOccupiesSubcell } from "../../shared/blocks";
import { getModelCollisionMask, MODEL_COLLISION_RESOLUTION, modelCollisionCellIsSolid } from "./model-collision";
import type { World } from "./world";

export const PLAYER_W = 0.6;
export const PLAYER_H = 1.8;
export const EYE_H = 1.62;
const HW = PLAYER_W / 2;
const EPS = 1e-4;

export interface Body {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  onGround: boolean;
}

export function collides(world: World, x: number, y: number, z: number): boolean {
  const x0 = Math.floor(x - HW), x1 = Math.floor(x + HW);
  const y0 = Math.floor(y), y1 = Math.floor(y + PLAYER_H);
  const z0 = Math.floor(z - HW), z1 = Math.floor(z + HW);
  for (let by = y0; by <= y1; by++) for (let bz = z0; bz <= z1; bz++) for (let bx = x0; bx <= x1; bx++) {
    const id = world.get(bx, by, bz);
    if (id === -1) return true;
    if (id <= 0 || !BLOCKS[id]?.solid) continue;

    const modelMask = getModelCollisionMask(id);
    if (modelMask) {
      if (modelMask.empty) continue;
      if (BLOCKS[id].shape === "cube" && modelMask.full) {
        if (x + HW > bx && x - HW < bx + 1 && y + PLAYER_H > by && y < by + 1 && z + HW > bz && z - HW < bz + 1) return true;
        continue;
      }

      // Model-based blocks use the renderer's exact element transforms at 1/16-block resolution.
      const resolution = MODEL_COLLISION_RESOLUTION;
      const qx0 = Math.max(0, Math.floor((x - HW - bx) * resolution));
      const qx1 = Math.min(resolution - 1, Math.floor((x + HW - bx - EPS) * resolution));
      const qy0 = Math.max(0, Math.floor((y - by) * resolution));
      const qy1 = Math.min(resolution - 1, Math.floor((y + PLAYER_H - by - EPS) * resolution));
      const qz0 = Math.max(0, Math.floor((z - HW - bz) * resolution));
      const qz1 = Math.min(resolution - 1, Math.floor((z + HW - bz - EPS) * resolution));
      for (let qy = qy0; qy <= qy1; qy++) for (let qz = qz0; qz <= qz1; qz++) for (let qx = qx0; qx <= qx1; qx++) {
        if (!modelCollisionCellIsSolid(modelMask, qx, qy, qz)) continue;
        const cell = 1 / resolution;
        const sx = bx + qx * cell, sy = by + qy * cell, sz = bz + qz * cell;
        if (x + HW > sx && x - HW < sx + cell && y + PLAYER_H > sy && y < sy + cell && z + HW > sz && z - HW < sz + cell) return true;
      }
      continue;
    }

    if (BLOCKS[id].shape === "cube" && !blockHasPartialModelShape(id)) {
      if (x + HW > bx && x - HW < bx + 1 && y + PLAYER_H > by && y < by + 1 && z + HW > bz && z - HW < bz + 1) return true;
      continue;
    }
    for (let qy = 0; qy < 4; qy++) for (let qz = 0; qz < 4; qz++) for (let qx = 0; qx < 4; qx++) {
      if (!blockOccupiesSubcell(id, qx, qy, qz)) continue;
      const cell = 0.25;
      const sx = bx + qx * cell, sy = by + qy * cell, sz = bz + qz * cell;
      if (x + HW > sx && x - HW < sx + cell && y + PLAYER_H > sy && y < sy + cell && z + HW > sz && z - HW < sz + cell) return true;
    }
  }
  return false;
}

/** 軸ごとに分割して移動。ブロックにめり込んだら押し戻す。 */
export function moveBody(world: World, b: Body, dt: number, sneak = false) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy), Math.abs(b.vz)) * dt / 0.3));
  const sdt = dt / steps;
  for (let s = 0; s < steps; s++) {
    // スニーク中は足元に床がない方向への水平移動を抑制する。
    const wasOnGround = b.onGround;
    const dx = b.vx * sdt;
    const dz = b.vz * sdt;
    moveAxis(world, b, 0, sneak && b.onGround && b.vy <= 0 ? edgeClamp(world, b, 0, dx) : dx);
    moveAxis(world, b, 2, sneak && b.onGround && b.vy <= 0 ? edgeClamp(world, b, 2, dz) : dz);
    b.onGround = false;
    moveAxis(world, b, 1, b.vy * sdt);
    // 垂直速度が0のときは moveAxis が早期 return するため、支持面上の接地状態を維持する。
    if (!b.onGround && wasOnGround && b.vy === 0 && hasSupport(world, b.x, b.y, b.z)) b.onGround = true;
  }
}

/** プレイヤーの足元に、実際に接している支持面があるか調べる。 */
function hasSupport(world: World, x: number, y: number, z: number): boolean {
  return collides(world, x, y - EPS * 2, z);
}

/** 支持面が残る範囲にスニーク中の水平移動量を制限する。 */
function edgeClamp(world: World, b: Body, axis: 0 | 2, d: number): number {
  let nd = d;
  // 移動ステップは最大0.3ブロックなので反復回数は小さく、端での振動も起こりにくい。
  while (nd !== 0 && !hasSupport(world, axis === 0 ? b.x + nd : b.x, b.y, axis === 2 ? b.z + nd : b.z)) {
    nd = Math.abs(nd) <= 0.05 ? 0 : nd - Math.sign(nd) * 0.05;
  }
  return nd;
}

function moveAxis(world: World, b: Body, axis: 0 | 1 | 2, d: number) {
  if (d === 0) return;
  const start = axis === 0 ? b.x : axis === 1 ? b.y : b.z;
  const target = start + d;
  const setAxisPosition = (value: number) => {
    if (axis === 0) b.x = value;
    else if (axis === 1) b.y = value;
    else b.z = value;
  };

  setAxisPosition(target);
  if (!collides(world, b.x, b.y, b.z)) return;

  // 接地中は半ブロックだけ乗り越え、階段・ハーフブロックを歩いて上れるようにする。
  if (axis !== 1 && b.onGround) {
    const originalY = b.y;
    b.y += 0.5;
    if (!collides(world, b.x, b.y, b.z)) return;
    b.y = originalY;
  }

  // 部分ブロックでもブロック全体の面へ押し戻さず、実際の形状境界を二分探索する。
  setAxisPosition(start);
  let safeStart = start;
  if (collides(world, b.x, b.y, b.z)) {
    // 通常は直前位置が安全。ワールド読込直後などで埋まっていた場合だけ、移動と逆方向へ抜ける。
    const direction = Math.sign(d);
    let foundSafeStart = false;
    for (let i = 1; i <= 20; i++) {
      const candidate = start - direction * i * 0.05;
      setAxisPosition(candidate);
      if (!collides(world, b.x, b.y, b.z)) {
        safeStart = candidate;
        foundSafeStart = true;
        break;
      }
    }
    if (!foundSafeStart) {
      setAxisPosition(start);
      if (axis === 0) b.vx = 0;
      else if (axis === 1) { b.vy = 0; if (d < 0) b.onGround = true; }
      else b.vz = 0;
      return;
    }
  }

  let safe = 0;
  let blocked = target - safeStart;
  for (let i = 0; i < 12; i++) {
    const middle = (safe + blocked) / 2;
    setAxisPosition(safeStart + middle);
    if (collides(world, b.x, b.y, b.z)) blocked = middle;
    else safe = middle;
  }
  setAxisPosition(safeStart + safe - Math.sign(d) * EPS);

  if (axis === 0) b.vx = 0;
  else if (axis === 1) {
    b.vy = 0;
    if (d < 0) b.onGround = true;
  } else b.vz = 0;
}

export function inLiquid(world: World, x: number, y: number, z: number): boolean {
  const id = world.get(Math.floor(x), Math.floor(y), Math.floor(z));
  return id > 0 && BLOCKS[id].render === "liquid";
}

export interface RayHit {
  x: number; y: number; z: number;
  nx: number; ny: number; nz: number;
}

/**
 * Shape-aware raycast. Model-backed blocks use the same 1/16-block model-element
 * mask as collision; legacy shapes use the shared 4x4x4 mask. Liquids are untargetable.
 */
export function raycast(
  world: World, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number,
): RayHit | null {
  const len = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(len) || len < 1e-8 || !Number.isFinite(maxDist) || maxDist <= 0) return null;
  dx /= len; dy /= len; dz /= len;
  const step = 1 / 32;
  let previousX = Math.floor(ox), previousY = Math.floor(oy), previousZ = Math.floor(oz);
  let lastEmptyX = previousX, lastEmptyY = previousY, lastEmptyZ = previousZ;
  const steps = Math.ceil(maxDist / step);
  for (let i = 0; i <= steps; i++) {
    const distance = Math.min(maxDist, i * step);
    const px = ox + dx * distance, py = oy + dy * distance, pz = oz + dz * distance;
    const x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz);
    if (x !== previousX || y !== previousY || z !== previousZ) {
      lastEmptyX = previousX; lastEmptyY = previousY; lastEmptyZ = previousZ;
      previousX = x; previousY = y; previousZ = z;
    }
    const id = world.get(x, y, z);
    if (id === -1) return null;
    if (id <= 0 || !BLOCKS[id] || !BLOCKS[id].solid || BLOCKS[id].render === "liquid") continue;
    const modelMask = getModelCollisionMask(id);
    if (modelMask) {
      const resolution = MODEL_COLLISION_RESOLUTION;
      const qx = Math.max(0, Math.min(resolution - 1, Math.floor((px - x) * resolution)));
      const qy = Math.max(0, Math.min(resolution - 1, Math.floor((py - y) * resolution)));
      const qz = Math.max(0, Math.min(resolution - 1, Math.floor((pz - z) * resolution)));
      if (!modelCollisionCellIsSolid(modelMask, qx, qy, qz)) continue;
    } else {
      const qx = Math.max(0, Math.min(3, Math.floor((px - x) * 4)));
      const qy = Math.max(0, Math.min(3, Math.floor((py - y) * 4)));
      const qz = Math.max(0, Math.min(3, Math.floor((pz - z) * 4)));
      if (!blockOccupiesSubcell(id, qx, qy, qz)) continue;
    }
    let nx = 0, ny = 0, nz = 0;
    if (lastEmptyX !== x) nx = -Math.sign(dx);
    else if (lastEmptyY !== y) ny = -Math.sign(dy);
    else if (lastEmptyZ !== z) nz = -Math.sign(dz);
    else {
      // Partial shape entered inside its parent voxel; use the dominant ray axis.
      const ax = Math.abs(dx), ay = Math.abs(dy), az = Math.abs(dz);
      if (ax >= ay && ax >= az) nx = -Math.sign(dx);
      else if (ay >= az) ny = -Math.sign(dy);
      else nz = -Math.sign(dz);
    }
    return { x, y, z, nx, ny, nz };
  }
  return null;
}
