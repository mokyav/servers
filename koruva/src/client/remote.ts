import * as THREE from "three";
import type { PlayerInfo, Rot, Skin, Vec3 } from "../../shared/protocol";

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

type SkinFace = { x: number; y: number; w: number; h: number };
type SkinPartTextures = { base: THREE.MeshBasicMaterial[]; outer: THREE.MeshBasicMaterial[] };
function minecraftPart(imageData: string, baseFaces: SkinFace[], outerFaces: SkinFace[]): SkinPartTextures & { textures: THREE.Texture[] } {
  const make = (faces: SkinFace[], outer: boolean) => faces.map((r) => {
    const cv = document.createElement("canvas"); cv.width = r.w; cv.height = r.h;
    const ctx = cv.getContext("2d")!; ctx.imageSmoothingEnabled = false;
    if (!outer) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cv.width, cv.height); }
    const texture = new THREE.CanvasTexture(cv);
    texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: outer, alphaTest: outer ? 0.01 : 0, depthWrite: !outer });
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

/** Minecraft 64x64 UV skin: face order matches BoxGeometry (+X,-X,+Y,-Y,+Z,-Z). */
function makeMinecraftSkinMaterials(image: string) {
  const part = (base: SkinFace[], outer: SkinFace[]) => minecraftPart(image, base, outer);
  const headBase = [
    {x:16,y:8,w:8,h:8},{x:0,y:8,w:8,h:8},{x:8,y:0,w:8,h:8},{x:16,y:0,w:8,h:8},{x:8,y:8,w:8,h:8},{x:24,y:8,w:8,h:8},
  ];
  const headOuter = headBase.map(r => ({...r, x:r.x+32}));
  const bodyBase = [
    {x:28,y:20,w:4,h:12},{x:16,y:20,w:4,h:12},{x:20,y:16,w:8,h:4},{x:28,y:16,w:8,h:4},{x:20,y:20,w:8,h:12},{x:32,y:20,w:8,h:12},
  ];
  const bodyOuter = bodyBase.map(r => ({...r, y:r.y+16}));
  const limbFaces = (right: boolean, arm: boolean): SkinFace[] => {
    const baseX = arm ? (right ? 40 : 32) : (right ? 0 : 16);
    const baseY = arm ? (right ? 20 : 52) : (right ? 20 : 52);
    const topX = arm ? (right ? 44 : 36) : (right ? 4 : 20);
    const sideW = 4;
    return [
      {x:baseX+8,y:baseY,w:sideW,h:12},{x:baseX,y:baseY,w:sideW,h:12},
      {x:topX,y:baseY-4,w:4,h:4},{x:topX+4,y:baseY-4,w:4,h:4},
      {x:topX,y:baseY,w:4,h:12},{x:topX+8,y:baseY,w:4,h:12},
    ];
  };
  const outerLimbFaces = (right: boolean, arm: boolean): SkinFace[] => {
    if (arm && !right) return [
      {x:56,y:52,w:4,h:12},{x:48,y:52,w:4,h:12},{x:52,y:48,w:4,h:4},{x:56,y:48,w:4,h:4},{x:52,y:52,w:4,h:12},{x:60,y:52,w:4,h:12},
    ];
    if (!arm && !right) return [
      {x:8,y:52,w:4,h:12},{x:0,y:52,w:4,h:12},{x:4,y:48,w:4,h:4},{x:8,y:48,w:4,h:4},{x:4,y:52,w:4,h:12},{x:12,y:52,w:4,h:12},
    ];
    const base = limbFaces(right, arm);
    return base.map(r => ({...r, y:r.y+16}));
  };
  const head = part(headBase, headOuter), body = part(bodyBase, bodyOuter);
  const armR = part(limbFaces(true,true), outerLimbFaces(true,true));
  const armL = part(limbFaces(false,true), outerLimbFaces(false,true));
  const legR = part(limbFaces(true,false), outerLimbFaces(true,false));
  const legL = part(limbFaces(false,false), outerLimbFaces(false,false));
  const allParts = [head,body,armR,armL,legR,legL];
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

  constructor(skin: Skin, name: string | null) {
    const box = (w: number, h: number, d: number, mt: THREE.Material | THREE.Material[]) => {
      const g = new THREE.BoxGeometry(w, h, d);
      this.geos.push(g);
      return new THREE.Mesh(g, mt);
    };
    if (skin.image) {
      const m = makeMinecraftSkinMaterials(skin.image);
      this.disposables = m.all;
      this.mats = m.materials;
      const head = box(0.42, 0.42, 0.42, m.head.base); head.position.y = 1.6;
      const headOuter = box(0.455, 0.455, 0.455, m.head.outer); headOuter.position.y = 1.6; headOuter.renderOrder = 1;
      const torso = box(0.55, 0.7, 0.28, m.body.base); torso.position.y = 1.05;
      const torsoOuter = box(0.59, 0.74, 0.32, m.body.outer); torsoOuter.position.y = 1.05; torsoOuter.renderOrder = 1;
      this.root.add(head, headOuter, torso, torsoOuter);
      const limb = (x: number, y: number, w: number, h: number, base: THREE.Material[], outer: THREE.Material[]) => {
        const grp = new THREE.Group(); grp.position.set(x, y, 0);
        const mesh = box(w, h, w, base); mesh.position.y = -h / 2; grp.add(mesh);
        const coat = box(w + 0.035, h + 0.035, w + 0.035, outer); coat.position.y = -(h + 0.035) / 2; coat.renderOrder = 1; grp.add(coat);
        this.root.add(grp); return grp;
      };
      this.armL = limb(-0.4, 1.4, 0.24, 0.7, m.armL.base, m.armL.outer);
      this.armR = limb(0.4, 1.4, 0.24, 0.7, m.armR.base, m.armR.outer);
      this.legL = limb(-0.14, 0.7, 0.26, 0.7, m.legL.base, m.legL.outer);
      this.legR = limb(0.14, 0.7, 0.26, 0.7, m.legR.base, m.legR.outer);
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
    this.group.add(model.root);
    this.map.set(info.id, { info, model, target: [...info.p], yawT: info.r[0], yaw: info.r[0], last: [...info.p], speed: 0 });
  }
  remove(id: string) {
    const r = this.map.get(id);
    if (!r) return;
    this.group.remove(r.model.root);
    r.model.dispose();
    this.map.delete(id);
  }
  move(id: string, p: Vec3, rot: Rot) {
    const r = this.map.get(id);
    if (!r) return;
    r.target = p;
    r.yawT = rot[0];
  }
  count() { return this.map.size; }
  names(): { id: string; name: string; host: boolean }[] { return Array.from(this.map.values(), (r) => ({ id: r.info.id, name: r.info.name, host: !!r.info.host })); }
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
