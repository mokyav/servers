import * as THREE from "three";
import type { PlayerInfo, Rot, Skin, Vec3 } from "../../shared/protocol";
import { MINECRAFT_ITEM_TO_RUNTIME_ID } from "../../shared/blocks";
import { DEFAULT_SKIN_IMAGE } from "./default-skin";
import { RIGHT_SIDE, skinFaces, type SkinFace } from "./skin-uv";

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
function tex(draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 16;
  const ctx = cv.getContext("2d")!;
  draw(ctx);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}
const mat = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t });

type SkinPartTextures = { base: THREE.MeshBasicMaterial[]; outer: THREE.MeshBasicMaterial[] };
function minecraftPart(imageData: string, baseFaces: SkinFace[], outerFaces: SkinFace[]): SkinPartTextures & { textures: THREE.Texture[] } {
  const make = (faces: SkinFace[], outer: boolean) => faces.map((r) => {
    const cv = document.createElement("canvas"); cv.width = r.w; cv.height = r.h;
    const ctx = cv.getContext("2d")!; ctx.imageSmoothingEnabled = false;
    if (!outer) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cv.width, cv.height); }
    const texture = new THREE.CanvasTexture(cv);
    texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: outer, alphaTest: outer ? 0.01 : 0, depthWrite: !outer, toneMapped: false });
    return { cv, texture, material, rect: r };
  });
  const base = make(baseFaces, false), outer = make(outerFaces, true);
  const image = new Image();
  image.onload = () => {
    for (const item of base) {
      const c = item.cv.getContext("2d")!;
      c.fillStyle = "#000"; c.fillRect(0, 0, item.cv.width, item.cv.height);
      c.drawImage(image, item.rect.x, item.rect.y, item.rect.w, item.rect.h, 0, 0, item.cv.width, item.cv.height);
      item.texture.needsUpdate = true;
    }
    for (const item of outer) {
      const c = item.cv.getContext("2d")!;
      c.drawImage(image, item.rect.x, item.rect.y, item.rect.w, item.rect.h, 0, 0, item.cv.width, item.cv.height);
      item.texture.needsUpdate = true;
    }
  };
  image.src = imageData;
  return { base: base.map(x => x.material), outer: outer.map(x => x.material), textures: [...base, ...outer].map(x => x.texture) };
}

/** Minecraft 64x64 UV skin. Face order matches BoxGeometry (+X,-X,+Y,-Y,+Z,-Z); tables live in skin-uv.ts. */
function makeMinecraftSkinMaterials(image: string, model: "classic" | "slim" = "classic") {
  const f = skinFaces(model);
  const part = (p: { base: SkinFace[]; outer: SkinFace[] }) => minecraftPart(image, p.base, p.outer);
  const head = part(f.head), body = part(f.body);
  const armR = part(f.armR), armL = part(f.armL), legR = part(f.legR), legL = part(f.legL);
  const allParts = [head, body, armR, armL, legR, legL];
  return { head, body, armR, armL, legR, legL,
    materials: allParts.flatMap(p => [...p.base, ...p.outer]),
    all: allParts.flatMap(p => p.textures) };
}

/** スキン(4色)から、手続き生成のテクスチャ付きマテリアルを作る */
export function makeSkinMaterials(s: Skin) {
  const noise = (ctx: CanvasRenderingContext2D, base: string, amt = 0.08) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(ctx, x, y, 1, 1, shade(base, 1 + (Math.random() - 0.5) * amt * 2));
  };
  const hairTop = tex((c) => noise(c, s.hair));
  const skinPlain = tex((c) => noise(c, s.skin));
  const face = tex((c) => {
    noise(c, s.skin);
    px(c, 0, 0, 16, 5, shade(s.hair, 1));
    px(c, 0, 5, 2, 3, shade(s.hair, 1)); px(c, 14, 5, 2, 3, shade(s.hair, 1));
    px(c, 3, 8, 3, 2, "#ffffff"); px(c, 10, 8, 3, 2, "#ffffff");
    px(c, 4, 8, 2, 2, "#2a3550"); px(c, 10, 8, 2, 2, "#2a3550");
    px(c, 6, 12, 4, 1, shade(s.skin, 0.65));
  });
  const side = tex((c) => { noise(c, s.skin); px(c, 0, 0, 16, 5, shade(s.hair, 1)); });
  const back = tex((c) => { noise(c, s.hair); });
  const shirt = tex((c) => noise(c, s.shirt, 0.1));
  const arm = tex((c) => { noise(c, s.shirt, 0.1); px(c, 0, 11, 16, 5, shade(s.skin, 1)); });
  const leg = tex((c) => { noise(c, s.pants, 0.1); px(c, 0, 13, 16, 3, "#2b2b30"); });
  return {
    head: [mat(side), mat(side), mat(hairTop), mat(skinPlain), mat(face), mat(back)],
    body: mat(shirt), arm: mat(arm), leg: mat(leg),
    all: [hairTop, skinPlain, face, side, back, shirt, arm, leg],
  };
}

function nameSprite(name: string): THREE.Sprite {
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 48;
  const ctx = cv.getContext("2d")!;
  ctx.font = "bold 26px system-ui, sans-serif";
  const w = Math.min(244, ctx.measureText(name).width + 20);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(128 - w / 2, 6, w, 36);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, 128, 25, 232);
  const t = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  sp.scale.set(1.5, 0.28, 1);
  sp.position.y = 2.25;
  return sp;
}

/** 人型モデル(頭・胴・両腕・両脚)。足元が原点、+Z前方ではなく yaw で向きを制御 */
export class PlayerModel {
  readonly root = new THREE.Group();
  private armL: THREE.Group; private armR: THREE.Group;
  private legL: THREE.Group; private legR: THREE.Group;
  private disposables: THREE.Texture[];
  private mats: THREE.MeshBasicMaterial[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private phase = 0;
  private tag: THREE.Sprite | null = null;
  /** 腰を支点に前傾する上半身(頭・胴・腕)。スニーク表示用 */
  private upper = new THREE.Group();
  private sneak = false;
  private lean = 0;
  private wingL: THREE.Group | null = null;
  private wingR: THREE.Group | null = null;
  private hasElytra = false;
  private fallFlying = false;
  private wingSpread = 0;

  constructor(skin: Skin, name: string | null) {
    const box = (w: number, h: number, d: number, mt: THREE.Material | THREE.Material[]) => {
      const g = new THREE.BoxGeometry(w, h, d);
      this.geos.push(g);
      return new THREE.Mesh(g, mt);
    };
    this.root.add(this.upper);
    if (skin.image || DEFAULT_SKIN_IMAGE) {
      const m = makeMinecraftSkinMaterials(skin.image || DEFAULT_SKIN_IMAGE, skin.model ?? "classic");
      this.disposables = m.all;
      this.mats = m.materials;
      const U = 0.05625; // 1 skin pixel in blocks (32px = 1.8 blocks)
      const CT = 0.035;  // overlay layer inflation
      const head = box(8 * U, 8 * U, 8 * U, m.head.base); head.position.y = 16 * U;
      const headOuter = box(8 * U + CT, 8 * U + CT, 8 * U + CT, m.head.outer); headOuter.position.y = 16 * U; headOuter.renderOrder = 1;
      const torso = box(8 * U, 12 * U, 4 * U, m.body.base); torso.position.y = 6 * U;
      const torsoOuter = box(8 * U + CT, 12 * U + CT, 4 * U + CT, m.body.outer); torsoOuter.position.y = 6 * U; torsoOuter.renderOrder = 1;
      this.upper.position.y = 12 * U;
      this.upper.add(head, headOuter, torso, torsoOuter);
      const limb = (x: number, y: number, w: number, h: number, base: THREE.Material[], outer: THREE.Material[], depth = w, parent: THREE.Object3D = this.root) => {
        const grp = new THREE.Group(); grp.position.set(x, y, 0);
        const mesh = box(w, h, depth, base); mesh.position.y = -h / 2; grp.add(mesh);
        const coat = box(w + CT, h + CT, depth + CT, outer); coat.position.y = -(h + CT) / 2; coat.renderOrder = 1; grp.add(coat);
        parent.add(grp); return grp;
      };
      const slim = skin.model === "slim";
      const armWidth = (slim ? 3 : 4) * U;
      const armX = 4 * U + armWidth / 2;
      // Front faces +Z, so the character's right-hand side is RIGHT_SIDE (-X): right limbs use the R textures.
      this.armR = limb(RIGHT_SIDE * armX, 12 * U, armWidth, 12 * U, m.armR.base, m.armR.outer, 4 * U, this.upper);
      this.armL = limb(-RIGHT_SIDE * armX, 12 * U, armWidth, 12 * U, m.armL.base, m.armL.outer, 4 * U, this.upper);
      this.legR = limb(RIGHT_SIDE * 2 * U, 12 * U, 4 * U, 12 * U, m.legR.base, m.legR.outer);
      this.legL = limb(-RIGHT_SIDE * 2 * U, 12 * U, 4 * U, 12 * U, m.legL.base, m.legL.outer);
    } else {
      const m = makeSkinMaterials(skin);
      this.disposables = m.all;
      this.mats = [...(m.head as THREE.MeshBasicMaterial[]), m.body, m.arm, m.leg];
      const limb = (x: number, y: number, mt: THREE.Material, w: number, h: number) => {
        const grp = new THREE.Group(); grp.position.set(x, y, 0);
        const mesh = box(w, h, w, mt); mesh.position.y = -h / 2; grp.add(mesh);
        this.root.add(grp); return grp;
      };
      const head = box(0.42, 0.42, 0.42, m.head); head.position.y = 1.6;
      const torso = box(0.55, 0.7, 0.28, m.body); torso.position.y = 1.05;
      this.root.add(head, torso);
      this.armL = limb(-0.4, 1.4, m.arm, 0.24, 0.7);
      this.armR = limb(0.4, 1.4, m.arm, 0.24, 0.7);
      this.legL = limb(-0.14, 0.7, m.leg, 0.26, 0.7);
      this.legR = limb(0.14, 0.7, m.leg, 0.26, 0.7);
    }
    // The source pack includes the official Java elytra equipment texture.
    const wingTexture = new THREE.TextureLoader().load("/assets/minecraft/textures/entity/equipment/wings/elytra.png");
    wingTexture.magFilter = THREE.NearestFilter; wingTexture.minFilter = THREE.NearestFilter;
    wingTexture.colorSpace = THREE.SRGBColorSpace;
    this.disposables.push(wingTexture);
    const wingMaterial = new THREE.MeshBasicMaterial({ map: wingTexture, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, depthWrite: true });
    this.mats.push(wingMaterial);
    const addWing = (side: -1 | 1) => {
      const hinge = new THREE.Group();
      hinge.position.set(side * 0.12, 0.1, -0.15);
      const geometry = new THREE.PlaneGeometry(0.46, 0.64);
      this.geos.push(geometry);
      const mesh = new THREE.Mesh(geometry, wingMaterial);
      mesh.position.set(side * 0.22, -0.23, 0);
      mesh.rotation.y = side * 0.08;
      hinge.add(mesh); this.upper.add(hinge); return hinge;
    };
    this.wingL = addWing(-1); this.wingR = addWing(1);
    this.setArmorSlots([]);
    if (name) {
      this.tag = nameSprite(name);
      this.root.add(this.tag);
    }
  }

  /** speed: 水平速度(m/s) */
  animate(dt: number, speed: number) {
    const moving = Math.min(1, speed / 3);
    this.phase += dt * (4 + speed * 1.6);
    const s = Math.sin(this.phase) * 0.9 * moving;
    this.armL.rotation.x = s; this.armR.rotation.x = -s;
    this.legL.rotation.x = -s; this.legR.rotation.x = s;
    this.lean += ((this.sneak ? 0.5 : 0) - this.lean) * Math.min(1, dt * 14);
    this.upper.rotation.x = this.lean;
    const targetSpread = this.fallFlying ? 1.15 : 0.25;
    this.wingSpread += (targetSpread - this.wingSpread) * Math.min(1, dt * 9);
    if (this.wingL) this.wingL.rotation.z = this.wingSpread;
    if (this.wingR) this.wingR.rotation.z = -this.wingSpread;
    if (this.tag) this.tag.position.y = 2.25 - this.lean * 0.5;
  }

  setSneak(on: boolean) { this.sneak = on; }
  setFallFlying(on: boolean) { this.fallFlying = on; }
  setArmorSlots(slots: number[]) {
    const elytraId = MINECRAFT_ITEM_TO_RUNTIME_ID["minecraft:elytra"] ?? -1;
    this.hasElytra = Array.isArray(slots) && slots[1] === elytraId;
    if (this.wingL) this.wingL.visible = this.hasElytra;
    if (this.wingR) this.wingR.visible = this.hasElytra;
  }

  setLight(v: number) {
    for (const m of this.mats) m.color.setScalar(v);
  }

  dispose() {
    for (const t of this.disposables) t.dispose();
    for (const m of this.mats) m.dispose();
    for (const g of this.geos) g.dispose();
    if (this.tag) { this.tag.material.map?.dispose(); this.tag.material.dispose(); }
  }
}

interface Remote {
  info: PlayerInfo;
  ms?: number;
  model: PlayerModel;
  target: Vec3;
  yawT: number;
  yaw: number;
  last: Vec3;
  speed: number;
}

export class RemotePlayers {
  readonly group = new THREE.Group();
  private map = new Map<string, Remote>();

  add(info: PlayerInfo) {
    this.remove(info.id);
    const model = new PlayerModel(info.skin, info.name);
    model.root.position.set(...info.p);
    model.root.userData.playerId = info.id;
    model.setSneak(!!info.sneak);
    model.setFallFlying(!!info.fallFlying);
    model.setArmorSlots(info.armorSlots ?? []);
    this.group.add(model.root);
    this.map.set(info.id, { ms: info.ms, info, model, target: [...info.p], yawT: info.r[0], yaw: info.r[0], last: [...info.p], speed: 0 });
  }
  remove(id: string) {
    const r = this.map.get(id);
    if (!r) return;
    this.group.remove(r.model.root);
    r.model.dispose();
    this.map.delete(id);
  }
  move(id: string, p: Vec3, rot: Rot, fallFlying = false) {
    const r = this.map.get(id);
    if (!r) return;
    r.target = p;
    r.yawT = rot[0];
    r.info.fallFlying = fallFlying;
    r.model.setFallFlying(fallFlying);
  }
  setSneak(id: string, on: boolean) { this.map.get(id)?.model.setSneak(on); }
  setArmorSlots(id: string, slots: number[]) { const r = this.map.get(id); if (!r) return; r.info.armorSlots = [...slots]; r.model.setArmorSlots(slots); }
  setMs(id: string, ms: number) { const r = this.map.get(id); if (r) r.ms = ms; }
  count() { return this.map.size; }
  names(): { id: string; name: string; host: boolean; ms?: number }[] { return Array.from(this.map.values(), (r) => ({ id: r.info.id, name: r.info.name, host: !!r.info.host, ms: r.ms })); }
  /** 画面中央のレイが最初に当たるプレイヤーのid(PvP用。名札は無視) */
  target(camera: THREE.Camera, max = 3.2): string | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hit = ray.intersectObject(this.group, true).find((h) => !(h.object as THREE.Sprite).isSprite && h.distance <= max);
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && o !== this.group) { const id = o.userData.playerId; if (typeof id === "string") return id; o = o.parent; }
    return null;
  }
  clear() { for (const id of Array.from(this.map.keys())) this.remove(id); }

  update(dt: number, light: number) {
    const k = 1 - Math.exp(-dt * 14);
    for (const r of this.map.values()) {
      const p = r.model.root.position;
      p.x += (r.target[0] - p.x) * k;
      p.y += (r.target[1] - p.y) * k;
      p.z += (r.target[2] - p.z) * k;
      let d = r.yawT - r.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      r.yaw += d * k;
      r.model.root.rotation.y = r.yaw + Math.PI; // 顔が前を向くよう補正
      const sp = Math.hypot(r.target[0] - r.last[0], r.target[2] - r.last[2]) / Math.max(dt, 0.001);
      r.speed += (Math.min(sp, 8) - r.speed) * Math.min(1, dt * 6);
      r.last = [r.target[0], r.target[1], r.target[2]];
      r.model.animate(dt, r.speed);
      r.model.setLight(light);
    }
  }
}
