import * as THREE from "three";
import { BLOCKS } from "../../shared/blocks";
import { MAX_EXPERIENCE } from "../../shared/experience";
import { itemDropTexturePath } from "../../shared/drop-item-texture.js";
import { ATLAS_READY_EVENT, tileUV } from "./atlas";
import type { World } from "./world";

export const DROP_TTL_MS = 5 * 60 * 1000;
const PICKUP_DELAY = 0.6; // 出現してから回収できるまで(秒)
const PICKUP_RANGE = 1.6; // プレイヤー中心からの距離
const SIZE = 0.3;
const GRAVITY = 22;

interface Drop {
  eid: string;
  itemId?: number;
  count: number;
  xp?: number;
  mesh: THREE.Object3D;
  x: number;
  y: number;
  z: number;
  vy: number;
  age: number;
  phase: number;
  landed: boolean;
  /** pickup を送信済み(サーバーの返事待ち) */
  claimedAt: number;
  born: number;
}

/** ブロック種別ごとの小さな立方体ジオメトリ(アトラスのタイルに UV を合わせる) */
function makeGeometry(id: number): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(SIZE, SIZE, SIZE);
  const def = BLOCKS[id];
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  // BoxGeometry の面順: +x, -x, +y, -y, +z, -z(各4頂点)
  const tiles = [def.tiles.side, def.tiles.side, def.tiles.top, def.tiles.bottom, def.tiles.side, def.tiles.side];
  for (let f = 0; f < 6; f++) {
    const [u0, v0, u1, v1] = tileUV(tiles[f]);
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0));
    }
  }
  uv.needsUpdate = true;
  return g;
}

/** ドロップアイテム(エンティティ)。落下・回転・上下に浮遊し、近づくと回収対象になる。 */
export class DropEntities {
  readonly group = new THREE.Group();
  private map = new Map<string, Drop>();
  private geos = new Map<number, THREE.BoxGeometry>();
  private mat: THREE.MeshBasicMaterial;
  private xpMat: THREE.MeshBasicMaterial;
  private xpGeo: THREE.SphereGeometry | null = null;
  private itemSpriteGeo: THREE.PlaneGeometry | null = null;
  private itemSpriteMaterials = new Map<number, THREE.MeshBasicMaterial>();
  private itemSpriteLoading = new Set<number>();
  private itemSpriteFailed = new Set<number>();

  constructor(atlas: HTMLCanvasElement) {
    const tex = new THREE.CanvasTexture(atlas);
    atlas.addEventListener(ATLAS_READY_EVENT, () => { tex.needsUpdate = true; }, { once: true });
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    this.mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 });
    this.xpMat = new THREE.MeshBasicMaterial({ color: 0x80ff52, toneMapped: false });
  }

  private createItemSprite(material: THREE.MeshBasicMaterial): THREE.Group {
    if (!this.itemSpriteGeo) this.itemSpriteGeo = new THREE.PlaneGeometry(SIZE * 0.86, SIZE * 0.86);
    const sprite = new THREE.Group();
    const front = new THREE.Mesh(this.itemSpriteGeo, material);
    const cross = new THREE.Mesh(this.itemSpriteGeo, material);
    cross.rotation.y = Math.PI / 2;
    sprite.add(front, cross);
    return sprite;
  }

  private replaceWithItemSprites(itemId: number, material: THREE.MeshBasicMaterial) {
    for (const drop of this.map.values()) {
      if (drop.itemId !== itemId || drop.xp !== undefined) continue;
      const previous = drop.mesh;
      const replacement = this.createItemSprite(material);
      replacement.position.copy(previous.position);
      replacement.rotation.copy(previous.rotation);
      replacement.scale.copy(previous.scale);
      this.group.remove(previous);
      this.group.add(replacement);
      drop.mesh = replacement;
    }
  }

  private itemSpriteMaterial(itemId: number): THREE.MeshBasicMaterial | null {
    const cached = this.itemSpriteMaterials.get(itemId);
    if (cached) return cached;
    if (this.itemSpriteLoading.has(itemId) || this.itemSpriteFailed.has(itemId)) return null;
    const texturePath = itemDropTexturePath(BLOCKS[itemId]);
    if (!texturePath) return null;
    this.itemSpriteLoading.add(itemId);
    try {
      new THREE.TextureLoader().load(
        `/assets/minecraft/textures/${texturePath}.png`,
        (texture) => {
          texture.magFilter = THREE.NearestFilter;
          texture.minFilter = THREE.NearestFilter;
          texture.generateMipmaps = false;
          const material = new THREE.MeshBasicMaterial({
            map: texture, transparent: true, alphaTest: 0.18, side: THREE.DoubleSide, toneMapped: false,
          });
          this.itemSpriteMaterials.set(itemId, material);
          this.itemSpriteLoading.delete(itemId);
          this.replaceWithItemSprites(itemId, material);
        },
        undefined,
        () => {
          this.itemSpriteLoading.delete(itemId);
          this.itemSpriteFailed.add(itemId);
        },
      );
    } catch {
      this.itemSpriteLoading.delete(itemId);
      this.itemSpriteFailed.add(itemId);
    }
    return null;
  }

  get size() { return this.map.size; }
  has(eid: string) { return this.map.has(eid); }
  blockOf(eid: string): number | null { return this.map.get(eid)?.itemId ?? null; }
  countOf(eid: string): number { return this.map.get(eid)?.count ?? 0; }
  setCount(eid: string, count: number) {
    const drop = this.map.get(eid);
    if (!drop || drop.itemId === undefined) return;
    const next = Number.isSafeInteger(count) ? Math.max(1, Math.min(64, count)) : 1;
    drop.count = next;
    drop.claimedAt = 0;
  }

  add(eid: string, x: number, y: number, z: number, itemId: number, count = 1) {
    const normalizedCount = Number.isSafeInteger(count) ? Math.max(1, Math.min(64, count)) : 1;
    const existing = this.map.get(eid);
    if (existing) { if (existing.itemId !== undefined) existing.count = normalizedCount; return; }
    if (!Number.isSafeInteger(itemId) || itemId < 1 || itemId >= BLOCKS.length || !BLOCKS[itemId]) return;
    const spriteMaterial = itemDropTexturePath(BLOCKS[itemId]) ? this.itemSpriteMaterial(itemId) : null;
    let mesh: THREE.Object3D;
    if (spriteMaterial) {
      mesh = this.createItemSprite(spriteMaterial);
    } else {
      let g = this.geos.get(itemId);
      if (!g) this.geos.set(itemId, (g = makeGeometry(itemId)));
      mesh = new THREE.Mesh(g, this.mat);
    }
    const d: Drop = {
      eid, itemId, count: normalizedCount, mesh, x: x + 0.5, y: y + SIZE / 2 + 0.05, z: z + 0.5, vy: 0, age: 0,
      phase: Math.random() * Math.PI * 2, landed: false, claimedAt: 0, born: performance.now(),
    };
    mesh.position.set(d.x, d.y, d.z);
    this.group.add(mesh);
    this.map.set(eid, d);
  }

  addExperience(eid: string, x: number, y: number, z: number, amount: number) {
    const xp = Number.isSafeInteger(amount) ? Math.max(1, Math.min(MAX_EXPERIENCE, amount)) : 0;
    if (!xp) return;
    const existing = this.map.get(eid);
    if (existing) { if (existing.xp !== undefined) existing.xp = xp; return; }
    if (!this.xpGeo) this.xpGeo = new THREE.SphereGeometry(SIZE * 0.42, 10, 8);
    const mesh = new THREE.Mesh(this.xpGeo, this.xpMat);
    const d: Drop = {
      eid, xp, count: 1, mesh, x: x + 0.5, y: y + SIZE / 2 + 0.05, z: z + 0.5, vy: 0, age: 0,
      phase: Math.random() * Math.PI * 2, landed: false, claimedAt: 0, born: performance.now(),
    };
    mesh.position.set(d.x, d.y, d.z);
    this.group.add(mesh);
    this.map.set(eid, d);
  }

  remove(eid: string) {
    const d = this.map.get(eid);
    if (!d) return;
    this.group.remove(d.mesh);
    this.map.delete(eid);
  }

  clear() {
    for (const id of Array.from(this.map.keys())) this.remove(id);
  }

  setLight(v: number) {
    this.mat.color.setScalar(v);
    this.xpMat.color.setScalar(v);
    for (const material of this.itemSpriteMaterials.values()) material.color.setScalar(v);
  }

  /**
   * 毎フレーム更新。プレイヤー(px,py,pz = 足元)に近く回収できるドロップの eid 一覧を返す(無ければ空)。
   * canPickup=false の間は回収しない(クリエイティブ・未接続など)。
   */
  update(dt: number, world: World, px: number, py: number, pz: number, canPickup: boolean): string[] {
    const out: string[] = [];
    const now = performance.now();
    const cy = py + 0.9;
    for (const d of Array.from(this.map.values())) {
      if (now - d.born > DROP_TTL_MS) { this.remove(d.eid); continue; }
      d.age += dt;

      // 落下(未ロードチャンクの上では止まる)
      if (!d.landed) {
        d.vy = Math.max(-30, d.vy - GRAVITY * dt);
        let ny = d.y + d.vy * dt;
        const bx = Math.floor(d.x), bz = Math.floor(d.z);
        const below = Math.floor(ny - SIZE / 2);
        const bid = world.get(bx, below, bz);
        if (bid === -1 || world.isSolid(bx, below, bz) || below < 0) {
          ny = below + 1 + SIZE / 2 + 0.02;
          d.vy = 0;
          d.landed = true;
        }
        d.y = ny;
      } else {
        // 下のブロックが壊されたら再び落ちる / 上にブロックを置かれて埋まったら押し上げる
        const bx = Math.floor(d.x), bz = Math.floor(d.z);
        if (!world.isSolid(bx, Math.floor(d.y - SIZE / 2 - 0.05), bz)) d.landed = false;
        else if (world.isSolid(bx, Math.floor(d.y), bz) && d.y < 62) d.y += 1;
      }

      const bob = d.landed ? Math.sin(d.age * 2.4 + d.phase) * 0.06 + 0.1 : 0;
      d.mesh.position.set(d.x, d.y + bob, d.z);
      d.mesh.rotation.y = d.age * 1.6 + d.phase;

      if (canPickup && d.age >= PICKUP_DELAY && (d.claimedAt === 0 || now - d.claimedAt > 1500)) {
        const dx = d.x - px, dy = d.y - cy, dz = d.z - pz;
        if (dx * dx + dy * dy + dz * dz <= PICKUP_RANGE * PICKUP_RANGE) {
          d.claimedAt = now;
          out.push(d.eid);
        }
      }
    }
    return out;
  }
}
