import * as THREE from "three";
import { CHUNK_SIZE, WORLD_HEIGHT } from "../../shared/constants";
import { ATLAS_FRAME_EVENT, ATLAS_READY_EVENT, createAtlasCanvas, tileUV, updateAtlasAnimations } from "./atlas";
import { buildChunkMesh, type MeshData } from "./mesher";
import { chunkKey, type Chunk, type World } from "./world";

const VERT = /* glsl */ `
attribute vec4 color;
varying vec2 vUv;
varying vec4 vCol;
varying float vDist;
void main() {
  vUv = uv;
  vCol = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec3 uLight;
uniform vec3 uFog;
uniform float uNear;
uniform float uFar;
uniform float uOpacity;
varying vec2 vUv;
varying vec4 vCol;
varying float vDist;
void main() {
  vec4 t = texture2D(map, vUv);
  if (t.a < 0.5) discard;
  vec3 c = t.rgb * vCol.rgb * mix(uLight, vec3(1.0), vCol.a);
  float f = smoothstep(uNear, uFar, vDist);
  c = mix(c, uFog, f);
  gl_FragColor = vec4(c, t.a * uOpacity);
  #include <colorspace_fragment>
}`;

interface Entry {
  solid: THREE.Mesh | null;
  cutout: THREE.Mesh | null;
  translucent: THREE.Mesh | null;
  liquid: THREE.Mesh | null;
}

/** チャンクのロード/アンロード、メッシュ生成キュー、描画を管理 */
export class ChunkView {
  readonly group = new THREE.Group();
  readonly uniforms = {
    map: { value: null as THREE.Texture | null },
    uLight: { value: new THREE.Vector3(1, 1, 1) },
    uFog: { value: new THREE.Vector3(0.5, 0.7, 0.95) },
    uNear: { value: 40 },
    uFar: { value: 90 },
    uOpacity: { value: 1 },
  };
  private solidMat: THREE.ShaderMaterial;
  private cutoutMat: THREE.ShaderMaterial;
  private translucentMat: THREE.ShaderMaterial;
  private atlasCanvas: HTMLCanvasElement;
  private atlasTexture: THREE.CanvasTexture;
  private liquidMat: THREE.ShaderMaterial;
  private entries = new Map<number, Entry>();
  private urgent = new Set<Chunk>();
  private statsDirty = true;
  renderDistance = 6;
  stats = { chunks: 0, meshed: 0, triangles: 0 };

  constructor(private world: World) {
    this.atlasCanvas = createAtlasCanvas();
    const tex = new THREE.CanvasTexture(this.atlasCanvas);
    this.atlasTexture = tex;
    this.atlasCanvas.addEventListener(ATLAS_READY_EVENT, () => { tex.needsUpdate = true; }, { once: true });
    this.atlasCanvas.addEventListener(ATLAS_FRAME_EVENT, () => { tex.needsUpdate = true; });
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.uniforms.map.value = tex;
    // Minecraft blockstate rotations and model faces can produce mixed winding in a
    // merged chunk mesh. Keep exposed solid faces visible from either winding; the
    // mesher still removes shared faces that are fully hidden by neighbouring cubes.
    this.solidMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
      side: THREE.DoubleSide,
    });
    // Plants and other cutout models use alpha discard, not blended transparency.
    // DoubleSide is required for vanilla crossed quads to remain visible from every angle.
    this.cutoutMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
      side: THREE.DoubleSide,
    });
    const translucentU = { ...this.uniforms, uOpacity: { value: 0.42 } };
    this.translucentMat = new THREE.ShaderMaterial({
      uniforms: translucentU, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const liquidU = { ...this.uniforms, uOpacity: { value: 0.68 } };
    this.liquidMat = new THREE.ShaderMaterial({
      uniforms: liquidU, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    world.onChunkDirty = (c) => this.urgent.add(c);
  }

  setFog(near: number, far: number) {
    this.uniforms.uNear.value = near;
    this.uniforms.uFar.value = far;
  }

  /** 編集で変更されたチャンクは即時に再メッシュ(ちらつき防止) */
  markUrgent(c: Chunk) {
    this.urgent.add(c);
  }

  /** プレイヤー周辺のチャンクをロードし、メッシュ生成・不要チャンク破棄を行う */
  update(px: number, pz: number, genBudget = 2, meshBudget = 3) {
    if (updateAtlasAnimations(this.atlasCanvas, performance.now())) this.atlasTexture.needsUpdate = true;
    const pcx = Math.floor(px / CHUNK_SIZE), pcz = Math.floor(pz / CHUNK_SIZE);
    const rd = this.renderDistance;

    // 1) 生成: 近い順に、描画範囲+1 まで(メッシュ生成には隣接が必要なため)
    let gen = 0;
    for (const [dx, dz] of this.ring(rd + 1)) {
      if (gen >= genBudget) break;
      if (!this.world.getChunk(pcx + dx, pcz + dz)) {
        this.world.ensureChunk(pcx + dx, pcz + dz);
        gen++;
      }
    }

    // 2) 表示中の既存チャンクだけを緊急再メッシュ。
    // 新規チャンクは後段の距離順キューに任せる。範囲外の更新で描画予算を
    // 消費すると、画面内の未メッシュチャンクが長時間表示されないため。
    let meshed = 0;
    for (const c of this.urgent) {
      if (this.world.getChunk(c.cx, c.cz) !== c) {
        this.urgent.delete(c);
        continue;
      }
      const dx = c.cx - pcx, dz = c.cz - pcz;
      const key = chunkKey(c.cx, c.cz);
      const inVisibleRing = dx * dx + dz * dz <= rd * rd + rd;
      if (!inVisibleRing || !this.entries.has(key)) {
        // Dirty state remains on the Chunk; the normal near-to-far pass will
        // build it when it enters the visible ring.
        this.urgent.delete(c);
        continue;
      }
      if (meshed >= meshBudget) break;
      if (c.dirty) {
        this.mesh(c);
        meshed++;
      } else {
        this.urgent.delete(c);
      }
    }

    // 3) 未メッシュ/ダーティを近い順に処理(4近傍が揃っているもののみ)
    for (const [dx, dz] of this.ring(rd)) {
      if (meshed >= meshBudget) break;
      const c = this.world.getChunk(pcx + dx, pcz + dz);
      if (!c) continue;
      const has = this.entries.has(chunkKey(c.cx, c.cz));
      if (has && !c.dirty) continue;
      this.mesh(c);
      this.urgent.delete(c);
      meshed++;
    }

    // 4) 遠いチャンクを破棄(編集差分は World.edits に残る)
    for (const [key, c] of Array.from(this.world.chunks)) {
      if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > rd + 2) {
        this.dispose(key);
        this.world.unloadChunk(c.cx, c.cz);
      }
    }
    this.stats.chunks = this.world.chunks.size;
    if (this.statsDirty) {
      this.recount();
      this.statsDirty = false;
    }
  }

  /** 周囲 radius チャンクのうちメッシュ済みの割合(ロード画面用) */
  readyRatio(px: number, pz: number, radius: number): number {
    const pcx = Math.floor(px / CHUNK_SIZE), pcz = Math.floor(pz / CHUNK_SIZE);
    let total = 0, ready = 0;
    // Match the exact ring used by generation and meshing. A square check would
    // include corner chunks that the ring scheduler intentionally never requests.
    for (const [dx, dz] of this.ring(radius)) {
      total++;
      const c = this.world.getChunk(pcx + dx, pcz + dz);
      if (c && !c.dirty && this.entries.has(chunkKey(c.cx, c.cz))) ready++;
    }
    return total > 0 ? ready / total : 1;
  }

  private ringCache = new Map<number, [number, number][]>();
  private ring(r: number): [number, number][] {
    let v = this.ringCache.get(r);
    if (!v) {
      v = [];
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= r * r + r) v.push([dx, dz]);
      v.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));
      this.ringCache.set(r, v);
    }
    return v;
  }


  private mesh(c: Chunk) {
    const key = chunkKey(c.cx, c.cz);
    const res = buildChunkMesh(this.world, c, tileUV);
    c.dirty = false;
    let e = this.entries.get(key);
    if (!e) this.entries.set(key, (e = { solid: null, cutout: null, translucent: null, liquid: null }));
    e.solid = this.swap(e.solid, res.solid, this.solidMat, c, 0);
    e.cutout = this.swap(e.cutout, res.cutout, this.cutoutMat, c, 0);
    e.translucent = this.swap(e.translucent, res.translucent, this.translucentMat, c, 1);
    e.liquid = this.swap(e.liquid, res.liquid, this.liquidMat, c, 1);
    this.statsDirty = true;
    this.urgent.delete(c);
  }

  private swap(old: THREE.Mesh | null, data: MeshData | null, mat: THREE.Material, c: Chunk, order: number): THREE.Mesh | null {
    if (old) {
      this.group.remove(old);
      old.geometry.dispose();
    }
    if (!data) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(data.uvs, 2));
    g.setAttribute("color", new THREE.BufferAttribute(data.colors, 4));
    g.setIndex(new THREE.BufferAttribute(data.indices, 1));
    // Compute bounds from the actual emitted vertices. Some vanilla block models
    // extend beyond the nominal 0..16 block cube, so a fixed chunk-sized sphere
    // can incorrectly frustum-cull visible geometry at chunk edges.
    g.computeBoundingBox();
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.position.set(c.cx * CHUNK_SIZE, 0, c.cz * CHUNK_SIZE);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    m.renderOrder = order;
    this.group.add(m);
    return m;
  }

  private dispose(key: number) {
    const e = this.entries.get(key);
    if (!e) return;
    for (const m of [e.solid, e.cutout, e.translucent, e.liquid]) {
      if (m) {
        this.group.remove(m);
        m.geometry.dispose();
      }
    }
    this.entries.delete(key);
    this.statsDirty = true;
  }

  private recount() {
    let tris = 0;
    for (const e of this.entries.values()) {
      for (const m of [e.solid, e.cutout, e.translucent, e.liquid]) if (m) tris += (m.geometry.getIndex()?.count ?? 0) / 3;
    }
    this.stats.meshed = this.entries.size;
    this.stats.triangles = tris;
  }

  clear() {
    for (const key of Array.from(this.entries.keys())) this.dispose(key);
    this.urgent.clear();
    this.stats.chunks = this.world.chunks.size;
    this.recount();
    this.statsDirty = false;
  }
}
