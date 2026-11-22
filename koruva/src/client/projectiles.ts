import * as THREE from "three";
import type { ProjectileInfo } from "../../shared/entities";

type Entry = { root: THREE.Group; shaft: THREE.Mesh; info: ProjectileInfo };
type BobberEntry = { root: THREE.Group; x: number; y: number; z: number; state: "waiting" | "bite" };

/** Lightweight client renderer for server-simulated arrows. */
export class ProjectileEntities {
  readonly group = new THREE.Group();
  private entries = new Map<string, Entry>();
  private bobbers = new Map<string, BobberEntry>();
  private bobberGeometry = new THREE.SphereGeometry(0.105, 8, 6);
  private bobberWhite = new THREE.MeshBasicMaterial({ color: 0xf3f4f6 });
  private bobberRed = new THREE.MeshBasicMaterial({ color: 0xd62828 });
  private shaftGeometry = new THREE.CylinderGeometry(0.012, 0.012, 0.42, 5);
  private tipGeometry = new THREE.ConeGeometry(0.035, 0.12, 5);
  private shaftMaterial = new THREE.MeshBasicMaterial({ color: 0x8b6845 });
  private tipMaterial = new THREE.MeshBasicMaterial({ color: 0x777777 });
  add(info: ProjectileInfo) {
    const old = this.entries.get(info.eid);
    if (old) { old.info = { ...info }; this.place(old); return; }
    const root = new THREE.Group();
    const shaft = new THREE.Mesh(this.shaftGeometry, this.shaftMaterial);
    shaft.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(this.tipGeometry, this.tipMaterial);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.26;
    root.add(shaft, tip);
    const entry = { root, shaft, info: { ...info } };
    this.entries.set(info.eid, entry);
    this.group.add(root);
    this.place(entry);
  }
  private place(entry: Entry) {
    const p = entry.info;
    entry.root.position.set(p.x, p.y, p.z);
    const direction = new THREE.Vector3(p.vx, p.vy, p.vz);
    if (direction.lengthSq() > 1e-8) {
      direction.normalize();
      entry.root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    }
  }
  addBobber(id: string, x: number, y: number, z: number, state: "waiting" | "bite") {
    const existing = this.bobbers.get(id);
    if (existing) { existing.x=x; existing.y=y; existing.z=z; existing.state=state; return; }
    const root = new THREE.Group();
    const white = new THREE.Mesh(this.bobberGeometry, this.bobberWhite); white.scale.set(1, 0.62, 1); white.position.y=-0.025;
    const red = new THREE.Mesh(this.bobberGeometry, this.bobberRed); red.scale.set(0.72, 0.42, 0.72); red.position.y=0.055;
    root.add(white, red);
    const entry={root,x,y,z,state}; this.bobbers.set(id,entry); this.group.add(root);
  }
  removeBobber(id: string) { const entry=this.bobbers.get(id); if(!entry)return; this.group.remove(entry.root); this.bobbers.delete(id); }
  update() {
    for (const entry of this.entries.values()) this.place(entry);
    const t=performance.now()/1000;
    for(const bobber of this.bobbers.values()) {
      const dip=bobber.state==="bite" ? Math.abs(Math.sin(t*15))*0.11 : Math.sin(t*2.4)*0.025;
      bobber.root.position.set(bobber.x,bobber.y-dip,bobber.z);
      bobber.root.rotation.y=t*0.5;
    }
  }
  remove(eid: string) {
    const entry = this.entries.get(eid);
    if (!entry) return;
    this.group.remove(entry.root);
    this.entries.delete(eid);
  }
  clear() { for (const id of [...this.entries.keys()]) this.remove(id); for (const id of [...this.bobbers.keys()]) this.removeBobber(id); }
  dispose() {
    this.clear();
    this.shaftGeometry.dispose(); this.tipGeometry.dispose(); this.bobberGeometry.dispose();
    this.shaftMaterial.dispose(); this.tipMaterial.dispose(); this.bobberWhite.dispose(); this.bobberRed.dispose();
  }
}
