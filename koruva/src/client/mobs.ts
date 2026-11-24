import * as THREE from "three";
import { MOB_PROFILES } from "../../shared/mob-ai.js";
import { MOB_RENDER_TEXTURES, MOB_RENDER_TEXTURE_SIZES, MOB_RENDER_HEIGHTS, MOB_RENDER_OVERLAYS, SKELETON_RIG_TYPES, HUMANOID_RIG_TYPES, VILLAGER_RIG_TYPES, PIGLIN_RIG_TYPES, MOB_MODEL_BASE_HEIGHTS, atlasBoxFaceRects, mapAtlasFaceUV, mapAtlasPlaneUV } from "../../shared/mob-render-assets.js";
import type { MobInfo, MobType } from "../../shared/entities";
interface Part{size:[number,number,number];pos:[number,number,number];uv:[number,number];leg?:boolean;rotationX?:number;rotationY?:number;rotationZ?:number;mirrorX?:boolean;inflate?:number;pivot?:[number,number,number];local?:[number,number,number]}
type CoreMobType = "pig" | "cow" | "chicken" | "creeper" | "zombie" | "skeleton" | "villager" | "piglin" | "enderman" | "spider" | "blaze" | "ghast" | "slime" | "magma_cube" | "silverfish" | "endermite";
const DIMS:Record<CoreMobType,[number,number]>={pig:[64,64],cow:[64,64],chicken:[64,32],creeper:[64,32],zombie:[64,64],skeleton:[64,32],villager:[64,64],piglin:[64,64],enderman:[64,32],spider:[64,32],blaze:[64,32],ghast:[64,32],slime:[64,32],magma_cube:[64,64],silverfish:[64,32],endermite:[64,32]};
// Core rigs below use the supplied 26.3 client model cuboids and UV offsets.
// pos is the world-space cuboid centre in sixteenths above the entity feet;
// rotations are applied after UV generation so each atlas face stays aligned.
const MODELS:Partial<Record<CoreMobType,Part[]>>={
 pig:[
  {size:[8,8,8],pos:[0,12,10],uv:[0,0]},
  {size:[4,3,1],pos:[0,10.5,14.5],uv:[16,16]},
  {size:[10,16,8],pos:[0,10,0],uv:[28,8],rotationX:Math.PI/2},
  {size:[4,6,4],pos:[-3,3,-7],uv:[0,16],leg:true},
  {size:[4,6,4],pos:[3,3,-7],uv:[0,16],leg:true,mirrorX:true},
  {size:[4,6,4],pos:[-3,3,5],uv:[0,16],leg:true},
  {size:[4,6,4],pos:[3,3,5],uv:[0,16],leg:true,mirrorX:true},
 ],
 cow:[
  {size:[8,8,6],pos:[0,20,11],uv:[0,0]},
  {size:[6,3,1],pos:[0,17.5,14.5],uv:[1,33]},
  {size:[1,3,1],pos:[-4.5,23.5,12.5],uv:[22,0]},
  {size:[1,3,1],pos:[4.5,23.5,12.5],uv:[22,0],mirrorX:true},
  {size:[12,18,10],pos:[0,17,-1],uv:[18,4],rotationX:Math.PI/2},
  {size:[4,6,1],pos:[0,11.5,-7],uv:[52,0],rotationX:Math.PI/2},
  {size:[4,12,4],pos:[-2,6,-4],uv:[0,16],leg:true,mirrorX:true},
  {size:[4,12,4],pos:[2,6,-4],uv:[0,16],leg:true},
  {size:[4,12,4],pos:[-2,6,4],uv:[0,16],leg:true,mirrorX:true},
  {size:[4,12,4],pos:[2,6,4],uv:[0,16],leg:true},
 ],
 chicken:[
  {size:[4,6,3],pos:[0,12,4.5],uv:[0,0]},
  {size:[4,2,2],pos:[0,12,7],uv:[14,0]},
  {size:[2,2,2],pos:[0,10,6],uv:[14,4]},
  {size:[6,8,6],pos:[0,8,0],uv:[0,9],rotationX:Math.PI/2},
  {size:[3,5,3],pos:[-1.5,2.5,-1],uv:[26,0],leg:true},
  {size:[3,5,3],pos:[1.5,2.5,-1],uv:[26,0],leg:true},
  {size:[1,4,6],pos:[-3.5,9,0],uv:[24,13]},
  {size:[1,4,6],pos:[3.5,9,0],uv:[24,13]},
 ],
 creeper:[
  {size:[8,8,8],pos:[0,22,0],uv:[0,0]},
  {size:[8,12,4],pos:[0,12,0],uv:[16,16]},
  {size:[4,6,4],pos:[-2,3,-4],uv:[0,16],leg:true},
  {size:[4,6,4],pos:[2,3,-4],uv:[0,16],leg:true},
  {size:[4,6,4],pos:[-2,3,4],uv:[0,16],leg:true},
  {size:[4,6,4],pos:[2,3,4],uv:[0,16],leg:true},
 ],
 zombie:[
  {size:[8,8,8],pos:[0,28,0],uv:[0,0]},
  {size:[8,12,4],pos:[0,18,0],uv:[16,16]},
  {size:[4,12,4],pos:[-5,18,0],uv:[40,16],leg:true},
  {size:[4,12,4],pos:[5,18,0],uv:[40,16],leg:true,mirrorX:true},
  {size:[4,12,4],pos:[-1.9,6,0],uv:[0,16],leg:true},
  {size:[4,12,4],pos:[1.9,6,0],uv:[0,16],leg:true,mirrorX:true},
 ],
 skeleton:[
  {size:[8,8,8],pos:[0,28,0],uv:[0,0]},
  {size:[8,12,4],pos:[0,18,0],uv:[16,16]},
  {size:[2,12,2],pos:[-5,18,0],uv:[40,16],leg:true},
  {size:[2,12,2],pos:[5,18,0],uv:[40,16],leg:true,mirrorX:true},
  {size:[2,12,2],pos:[-1.9,6,0],uv:[0,16],leg:true},
  {size:[2,12,2],pos:[1.9,6,0],uv:[0,16],leg:true,mirrorX:true},
 ],
 // VillagerModel 26.3: folded arms, robe, long head and separate hat/nose UV regions.
 villager:[
  {size:[8,10,8],pos:[0,29,0],uv:[0,0]},
  {size:[8,10,8],pos:[0,29,0],uv:[32,0],inflate:.51},
  {size:[2,4,2],pos:[0,25,5],uv:[24,0]},
  {size:[8,12,6],pos:[0,18,0],uv:[16,20]},
  {size:[8,12,6],pos:[0,18,0],uv:[0,38],inflate:.5},
  {size:[4,8,4],pos:[-6,19,1],uv:[44,22]},
  {size:[4,8,4],pos:[6,19,1],uv:[44,22],mirrorX:true},
  {size:[8,4,4],pos:[0,17,1],uv:[40,38]},
  {size:[4,12,4],pos:[-2,6,0],uv:[0,22],leg:true},
  {size:[4,12,4],pos:[2,6,0],uv:[0,22],leg:true,mirrorX:true},
 ],
 // Java 26.3 AdultPiglinModel: wider head, dedicated snout and two separately mapped ears.
 piglin:[
  {size:[10,8,8],pos:[0,28,0],uv:[0,0]},
  {size:[4,4,1],pos:[0,30,4.5],uv:[31,1]},
  {size:[1,2,1],pos:[2.5,31,4.5],uv:[2,4]},
  {size:[1,2,1],pos:[-2.5,31,4.5],uv:[2,0]},
  {size:[1,5,4],pos:[5,35.5,0],uv:[51,6],rotationZ:-Math.PI/6},
  {size:[1,5,4],pos:[-5,35.5,0],uv:[39,6],rotationZ:Math.PI/6},
  {size:[8,12,4],pos:[0,18,0],uv:[16,16]},
  {size:[4,12,4],pos:[-5,18,0],uv:[40,16],leg:true},
  {size:[4,12,4],pos:[5,18,0],uv:[40,16],leg:true,mirrorX:true},
  {size:[4,12,4],pos:[-1.9,6,0],uv:[0,16],leg:true},
  {size:[4,12,4],pos:[1.9,6,0],uv:[0,16],leg:true,mirrorX:true},
 ],

};

// Dedicated 26.3 models added from the corresponding Java model-layer bytecode.
// Pivoted parts keep their vanilla hinge points; local is the mesh-center offset from that pivot.
const BLAZE_RODS:Part[]=Array.from({length:12},(_,i):Part=>{
 const ring=i<4?0:i<8?1:2,slot=i%4;
 const angle=ring===0?slot*Math.PI/2:ring===1?Math.PI/4+slot*Math.PI/2:.47123894+slot*Math.PI/2;
 const radius=ring===0?9:ring===1?7:5;
 const javaY=ring===0?-2+Math.cos(i*.5):ring===1?2+Math.cos(i*.5):11+Math.cos(i*.75);
 const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,y=24-javaY;
 return {size:[2,8,2],pos:[x,y-4,z],uv:[0,16],pivot:[x,y,z],local:[0,-4,0],leg:true};
});
const GHAST_TENTACLE_LENGTHS=[8,13,9,11,11,10,12,9,12];
const GHAST_TENTACLE_POSITIONS:[number,number][]=[[-3.75,-5],[1.25,-5],[6.25,-5],[-6.25,0],[-1.25,0],[3.75,0],[-3.75,5],[1.25,5],[6.25,5]];
const GHAST_TENTACLES:Part[]=GHAST_TENTACLE_LENGTHS.map((length,i):Part=>{
 const [x,z]=GHAST_TENTACLE_POSITIONS[i]!,pivotY=17.4;
 return {size:[2,length,2],pos:[x,pivotY-length/2,z],uv:[0,0],pivot:[x,pivotY,z],local:[0,-length/2,0],leg:true};
});
const MAGMA_CUBE_SLICES:Part[]=Array.from({length:8},(_,i):Part=>{
 const uvX=i<4?0:32,uvY=(i%4)*9;
 return {size:[8,1,8],pos:[0,7.5-i,0],uv:[uvX,uvY]};
});
const SILVERFISH_SIZES:[number,number,number][]=[[3,2,2],[4,3,2],[6,4,3],[3,3,3],[2,2,3],[2,1,2],[1,1,2]];
const SILVERFISH_UVS:[number,number][]=[[0,0],[0,4],[0,9],[0,16],[0,22],[11,0],[13,4]];
const SILVERFISH_SEGMENTS:Part[]=(()=>{let z=-3.5;return SILVERFISH_SIZES.map((size,i)=>{
 const [w,h,d]=size,part:Part={size,pos:[0,h/2,z],uv:SILVERFISH_UVS[i]};
 if(i<SILVERFISH_SIZES.length-1)z+=(d+SILVERFISH_SIZES[i+1][2])/2;
 return part;
});})();
const ENDERMITE_SIZES:[number,number,number][]=[[4,3,2],[6,4,5],[3,3,1],[1,2,1]];
const ENDERMITE_UVS:[number,number][]=[[0,0],[0,5],[0,14],[0,18]];
const ENDERMITE_SEGMENTS:Part[]=(()=>{let z=-3.5;return ENDERMITE_SIZES.map((size,i)=>{
 const [w,h,d]=size,part:Part={size,pos:[0,h/2,z],uv:ENDERMITE_UVS[i]};
 if(i<ENDERMITE_SIZES.length-1)z+=(d+ENDERMITE_SIZES[i+1][2])/2;
 return part;
});})();
const SPECIAL_MODELS:Partial<Record<CoreMobType,Part[]>>={
 enderman:[
  // EndermanModel.createBodyLayer: base 64x32 atlas, 30px arms/legs, and shrinking hat layer.
  {size:[8,8,8],pos:[0,42,0],uv:[0,0]},
  {size:[8,8,8],pos:[0,42,0],uv:[0,16],inflate:-.5},
  {size:[8,12,4],pos:[0,33,0],uv:[32,16]},
  {size:[2,30,2],pos:[-5,24,0],uv:[56,0]},
  {size:[2,30,2],pos:[5,24,0],uv:[56,0],mirrorX:true},
  {size:[2,30,2],pos:[-2,15,0],uv:[56,0],leg:true},
  {size:[2,30,2],pos:[2,15,0],uv:[56,0],mirrorX:true,leg:true},
 ],
 spider:[
  // SpiderModel.createSpiderBodyLayer: base 64x32 UV map and eight hinged legs.
  {size:[8,8,8],pos:[0,8,-7],uv:[32,4]},
  {size:[6,6,6],pos:[0,8,0],uv:[0,0]},
  {size:[10,8,12],pos:[0,8,9],uv:[0,12]},
  {size:[16,2,2],pos:[-11,8,2],uv:[18,0],pivot:[-4,8,2],local:[-7,0,0],rotationY:Math.PI/4,rotationZ:-Math.PI/4,leg:true},
  {size:[16,2,2],pos:[11,8,2],uv:[18,0],pivot:[4,8,2],local:[7,0,0],rotationY:-Math.PI/4,rotationZ:Math.PI/4,mirrorX:true,leg:true},
  {size:[16,2,2],pos:[-11,8,1],uv:[18,0],pivot:[-4,8,1],local:[-7,0,0],rotationY:Math.PI/8,rotationZ:-.58119464,leg:true},
  {size:[16,2,2],pos:[11,8,1],uv:[18,0],pivot:[4,8,1],local:[7,0,0],rotationY:-Math.PI/8,rotationZ:.58119464,mirrorX:true,leg:true},
  {size:[16,2,2],pos:[-11,8,0],uv:[18,0],pivot:[-4,8,0],local:[-7,0,0],rotationY:-Math.PI/8,rotationZ:-.58119464,leg:true},
  {size:[16,2,2],pos:[11,8,0],uv:[18,0],pivot:[4,8,0],local:[7,0,0],rotationY:Math.PI/8,rotationZ:.58119464,mirrorX:true,leg:true},
  {size:[16,2,2],pos:[-11,8,-1],uv:[18,0],pivot:[-4,8,-1],local:[-7,0,0],rotationY:-Math.PI/4,rotationZ:-Math.PI/4,leg:true},
  {size:[16,2,2],pos:[11,8,-1],uv:[18,0],pivot:[4,8,-1],local:[7,0,0],rotationY:Math.PI/4,rotationZ:Math.PI/4,mirrorX:true,leg:true},
 ],
 blaze:[
  // BlazeModel.createBodyLayer: cube head and twelve individual rod pivots.
  {size:[8,8,8],pos:[0,24,0],uv:[0,0]},
  ...BLAZE_RODS,
 ],
 ghast:[
  // GhastModel.createBodyLayer: 16px body and nine deterministic tentacle lengths.
  {size:[16,16,16],pos:[0,24.4,0],uv:[0,0]},
  ...GHAST_TENTACLES,
 ],
 slime:[
  // SlimeModel.createOuterBodyLayer / createInnerBodyLayer, including eye and mouth UV rectangles.
  {size:[8,8,8],pos:[0,4,0],uv:[0,0]},
  {size:[6,6,6],pos:[0,4,0],uv:[0,16]},
  {size:[2,2,2],pos:[-2.25,5,-2.5],uv:[32,0]},
  {size:[2,2,2],pos:[2.25,5,-2.5],uv:[32,4]},
  {size:[1,1,1],pos:[.5,2.5,-3],uv:[32,8]},
 ],
 magma_cube:[
  // MagmaCubeModel.createBodyLayer: eight 8x1x8 sections plus its 4px core.
  ...MAGMA_CUBE_SLICES,
  {size:[4,4,4],pos:[0,3,0],uv:[24,40]},
 ],
 silverfish:[
  // SilverfishModel.createBodyLayer: seven segments, BODY_SIZES and BODY_TEXS.
  ...SILVERFISH_SEGMENTS,
 ],
 endermite:[
  // EndermiteModel.createBodyLayer: four segments and Java 26.3 UV offsets.
  ...ENDERMITE_SEGMENTS,
 ],
};
function applyBoxAtlasUV(g:THREE.BufferGeometry,size:[number,number,number],offset:[number,number],textureSize:[number,number],mirrorX=false) {
 const rects=atlasBoxFaceRects(size,offset,textureSize),uv=g.getAttribute("uv") as THREE.BufferAttribute;
 // BoxGeometry already stores a different orientation for each face. Preserve those
 // coordinates and remap them into the matching Minecraft atlas rectangle.
 for(let face=0;face<6;face++){
  const rect=rects[face];
  for(let vertex=face*4;vertex<face*4+4;vertex++){
   const baseU=uv.getX(vertex);
   const mapped=mapAtlasFaceUV(mirrorX?1-baseU:baseU,uv.getY(vertex),rect,textureSize);
   uv.setXY(vertex,mapped[0],mapped[1]);
  }
 }
 uv.needsUpdate=true;
}
function applyUV(g:THREE.BufferGeometry,t:CoreMobType,p:Part,type:MobType){
 const sourceSize=DIMS[t];
 const registeredSize=(MOB_RENDER_TEXTURE_SIZES as Record<string,number[]>)[type];
 const textureSize:[number,number]=registeredSize&&registeredSize.length===2?[registeredSize[0],registeredSize[1]]:sourceSize;
 const sourceRects=atlasBoxFaceRects(p.size,p.uv,sourceSize),uv=g.getAttribute("uv") as THREE.BufferAttribute;
 const scaleU=textureSize[0]/sourceSize[0],scaleV=textureSize[1]/sourceSize[1];
 // Preserve vanilla pixel-space UV rectangles while adapting to the exact resolution
 // of each entity atlas (including 16x16 and 32x32 textures).
 for(let face=0;face<6;face++){
  const [x,y,w,h]=sourceRects[face],rect:[number,number,number,number]=[x*scaleU,y*scaleV,w*scaleU,h*scaleV];
  for(let vertex=face*4;vertex<face*4+4;vertex++){
   const baseU=uv.getX(vertex);
   const mapped=mapAtlasFaceUV(p.mirrorX?1-baseU:baseU,uv.getY(vertex),rect,textureSize);
   uv.setXY(vertex,mapped[0],mapped[1]);
  }
 }
 uv.needsUpdate=true;
}
function modelType(type:MobType):CoreMobType {
 if(type==="enderman")return "enderman";
 if(type==="spider"||type==="cave_spider")return "spider";
 if(type==="blaze")return "blaze";
 if(type==="ghast")return "ghast";
 if(type==="slime")return "slime";
 if(type==="magma_cube")return "magma_cube";
 if(type==="silverfish")return "silverfish";
 if(type==="endermite")return "endermite";
 if(SKELETON_RIG_TYPES.includes(type as string))return "skeleton";
 if(VILLAGER_RIG_TYPES.includes(type as string))return "villager";
 if(PIGLIN_RIG_TYPES.includes(type as string))return "piglin";
 if(HUMANOID_RIG_TYPES.includes(type as string))return "zombie";
 return MOB_PROFILES[type]?.visual ?? "pig";
}
function applyDragonBoxUV(g:THREE.BufferGeometry,size:[number,number,number],offset:[number,number],textureSize:[number,number]=[256,256]) {
 applyBoxAtlasUV(g,size,offset,textureSize);
}
function applyPlaneAtlasUV(g:THREE.BufferGeometry,rect:[number,number,number,number],textureSize:[number,number]=[256,256],mirrorX=false) {
 const uv=g.getAttribute("uv") as THREE.BufferAttribute;
 for(let i=0;i<uv.count;i++){
  const mapped=mapAtlasPlaneUV(uv.getX(i),uv.getY(i),rect,textureSize,mirrorX);
  uv.setXY(i,mapped[0],mapped[1]);
 }
 uv.needsUpdate=true;
}

interface DragonRig { head:THREE.Group; jaw:THREE.Group; wings:THREE.Group[]; wingTips:THREE.Group[]; neck:THREE.Group[]; tail:THREE.Group[]; legs:THREE.Group[]; legBaseX:number[] }
interface WitherRig { heads:THREE.Group[]; ribcage:THREE.Group; tail:THREE.Group }
interface WardenRig { head:THREE.Group; tendrils:THREE.Group[]; arms:THREE.Mesh[]; legs:THREE.Mesh[]; ribs:THREE.Group[] }
interface MobEntry { root:THREE.Group; info:MobInfo; legs:THREE.Object3D[]; wings?:THREE.Group[]; crystal?:THREE.Mesh; beam?:THREE.Mesh; dragon?:DragonRig; wither?:WitherRig; warden?:WardenRig }

export class MobModels {
 readonly group=new THREE.Group();
 private entries=new Map<string,MobEntry>();
 private dragonMat:THREE.MeshBasicMaterial;
 private dragonEyesMat:THREE.MeshBasicMaterial;
 private crystalMat:THREE.MeshBasicMaterial;
 private beamMat:THREE.MeshBasicMaterial;
 private entityMaterials=new Map<string,THREE.MeshBasicMaterial>();
 private entityTextures=new Map<string,THREE.Texture>();
 private witherMaterial:THREE.MeshBasicMaterial;
 private wardenMaterial:THREE.MeshBasicMaterial;
 private wardenGlowMaterial:THREE.MeshBasicMaterial;
 constructor(){
  const l=new THREE.TextureLoader();
  const loadTexture=(path:string)=>{
   let texture=this.entityTextures.get(path);
   if(!texture){
    texture=l.load(path);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
    this.entityTextures.set(path,texture);
   }
   return texture;
  };
  this.dragonMat=new THREE.MeshBasicMaterial({map:loadTexture("/assets/minecraft/textures/entity/enderdragon/dragon.png"),transparent:true,alphaTest:0.02,side:THREE.DoubleSide});
  this.dragonEyesMat=new THREE.MeshBasicMaterial({map:loadTexture("/assets/minecraft/textures/entity/enderdragon/dragon_eyes.png"),transparent:true,alphaTest:0.02,side:THREE.DoubleSide,depthWrite:false});
  this.crystalMat=new THREE.MeshBasicMaterial({map:loadTexture("/assets/minecraft/textures/entity/end_crystal/end_crystal.png"),color:0xffffff,transparent:true,opacity:.9,alphaTest:.04,side:THREE.DoubleSide});
  this.beamMat=new THREE.MeshBasicMaterial({map:loadTexture("/assets/minecraft/textures/entity/end_crystal/end_crystal_beam.png"),color:0xffffff,transparent:true,opacity:.52,side:THREE.DoubleSide,depthWrite:false});
  this.witherMaterial=new THREE.MeshBasicMaterial({map:loadTexture("/assets/minecraft/textures/entity/wither/wither.png"),transparent:true,alphaTest:.04,side:THREE.DoubleSide});
  this.wardenMaterial=new THREE.MeshBasicMaterial({map:loadTexture("/assets/minecraft/textures/entity/warden/warden.png"),transparent:true,alphaTest:.04,side:THREE.DoubleSide});
  this.wardenGlowMaterial=new THREE.MeshBasicMaterial({map:loadTexture("/assets/minecraft/textures/entity/warden/warden_bioluminescent_layer.png"),transparent:true,alphaTest:.02,side:THREE.DoubleSide,depthWrite:false});
 }
 private materialFor(type:MobType):THREE.MeshBasicMaterial {
  const resource=(MOB_RENDER_TEXTURES as Record<string,string>)[type];
  if(!resource)throw new Error(`Missing Java 26.3 mob texture mapping for "${type}"`);
  const path=`/assets/minecraft/textures/entity/${resource}.png`;
  let material=this.entityMaterials.get(path);
  if(!material){
   let texture=this.entityTextures.get(path);
   if(!texture){texture=new THREE.TextureLoader().load(path);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;this.entityTextures.set(path,texture);}
   material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.06,side:THREE.DoubleSide});
   this.entityMaterials.set(path,material);
  }
  return material;
 }
 private materialForResource(resource:string,glow=false):THREE.MeshBasicMaterial {
  const path=`/assets/minecraft/textures/entity/${resource}.png`;
  let material=this.entityMaterials.get(path);
  if(!material){
   let texture=this.entityTextures.get(path);
   if(!texture){texture=new THREE.TextureLoader().load(path);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;this.entityTextures.set(path,texture);}
   material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:glow?.02:.04,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
   this.entityMaterials.set(path,material);
  }
  return material;
 }
 private addAtlasBox(parent:THREE.Object3D,size:[number,number,number],pos:[number,number,number],uv:[number,number],material:THREE.Material,textureSize:[number,number],mirrorX=false) {
  const geo=new THREE.BoxGeometry(size[0]/16,size[1]/16,size[2]/16);
  applyBoxAtlasUV(geo,size,uv,textureSize,mirrorX);
  const mesh=new THREE.Mesh(geo,material);mesh.position.set(pos[0]/16,pos[1]/16,pos[2]/16);parent.add(mesh);return mesh;
 }
 private addWitherModel(root:THREE.Group):WitherRig {
  const part=(at:[number,number,number])=>{const g=new THREE.Group();g.position.set(at[0]/16,-at[1]/16,at[2]/16);root.add(g);return g;};
  const box=(parent:THREE.Object3D,size:[number,number,number],origin:[number,number,number],uv:[number,number])=>{
   const center:[number,number,number]=[origin[0]+size[0]/2,-(origin[1]+size[1]/2),origin[2]+size[2]/2];
   return this.addAtlasBox(parent,size,center,uv,this.witherMaterial,[64,64]);
  };
  // Positions and UV offsets below are taken from WitherBossModel.createBodyLayer in the supplied 26.3 client.
  const shoulders=part([0,0,0]);box(shoulders,[20,3,3],[-10,3.9,-.5],[0,16]);
  const ribcage=part([-2,6.9,-.5]);ribcage.rotation.x=-.20420352;
  box(ribcage,[3,10,3],[0,0,0],[0,22]);
  for(const y of [1.5,4,6.5])box(ribcage,[11,2,2],[-4,y,.5],[24,22]);
  const tail=part([-2,16.69,1.53]);tail.rotation.x=-.83252203;box(tail,[3,6,3],[0,0,0],[12,22]);
  const center=part([0,0,0]);box(center,[8,8,8],[-4,-4,-4],[0,0]);
  const right=part([-8,4,0]);box(right,[6,6,6],[-4,-4,-4],[32,0]);
  const left=part([10,4,0]);box(left,[6,6,6],[-4,-4,-4],[32,0]);
  // Java model Y grows downward; this rig flips that axis so the heads sit above the ribcage.
  return {heads:[center,right,left],ribcage,tail};
 }
 private addWardenModel(root:THREE.Group):WardenRig {
  const part=(parent:THREE.Object3D,at:[number,number,number])=>{const g=new THREE.Group();g.position.set(at[0]/16,-at[1]/16,at[2]/16);parent.add(g);return g;};
  const box=(parent:THREE.Object3D,size:[number,number,number],origin:[number,number,number],uv:[number,number],mirrored=false)=>{
   const center:[number,number,number]=[origin[0]+size[0]/2,-(origin[1]+size[1]/2),origin[2]+size[2]/2];
   const mesh=this.addAtlasBox(parent,size,center,uv,this.wardenMaterial,[128,128],mirrored);
   const glow=new THREE.Mesh(mesh.geometry.clone(),this.wardenGlowMaterial);glow.position.copy(mesh.position);glow.rotation.copy(mesh.rotation);glow.scale.copy(mesh.scale);parent.add(glow);
   return mesh;
  };
  // Coordinate and atlas layout follow WardenModel.createBodyLayer in the supplied 26.3 client.
  const bone=part(root,[0,0,0]);
  const body=part(bone,[0,-21,0]);
  box(body,[18,21,11],[-9,-13,-4],[0,0]);
  const rightRib=part(body,[-7,-2,-4]);box(rightRib,[9,21,1],[-2,-11,-.1],[90,11]);
  const leftRib=part(body,[7,-2,-4]);box(leftRib,[9,21,1],[-7,-11,-.1],[90,11],true);
  const head=part(body,[0,-13,0]);box(head,[16,16,10],[-8,-16,-5],[0,32]);
  const rightTendril=part(head,[-8,-12,0]);box(rightTendril,[16,16,1],[-16,-13,0],[52,32]);
  const leftTendril=part(head,[8,-12,0]);box(leftTendril,[16,16,1],[0,-13,0],[58,0]);
  const rightArm=part(body,[-13,-13,1]);const rightArmMesh=box(rightArm,[8,28,8],[-4,0,-4],[44,50]);
  const leftArm=part(body,[13,-13,1]);const leftArmMesh=box(leftArm,[8,28,8],[-4,0,-4],[0,58]);
  const rightLeg=part(bone,[-5.9,-13,0]);const rightLegMesh=box(rightLeg,[6,13,6],[-3.1,0,-3],[76,48]);
  const leftLeg=part(bone,[5.9,-13,0]);const leftLegMesh=box(leftLeg,[6,13,6],[-2.9,0,-3],[76,76]);
  return {head,tendrils:[rightTendril,leftTendril],arms:[rightArmMesh,leftArmMesh],legs:[rightLegMesh,leftLegMesh],ribs:[rightRib,leftRib]};
 }
 private addDragonBox(parent:THREE.Object3D,size:[number,number,number],pos:[number,number,number],uv:[number,number],mirrorX=false) {
  const geo=new THREE.BoxGeometry(size[0]/16,size[1]/16,size[2]/16);applyBoxAtlasUV(geo,size,uv,[256,256],mirrorX);
  const mesh=new THREE.Mesh(geo,this.dragonMat);mesh.position.set(pos[0]/16,pos[1]/16,pos[2]/16);parent.add(mesh);return mesh;
 }
 private addDragonMembrane(parent:THREE.Object3D,uv:[number,number],tip=false) {
  const shape=new THREE.Shape();
  if(!tip){shape.moveTo(0,0);shape.lineTo(56,7);shape.lineTo(54,43);shape.lineTo(17,56);shape.lineTo(3,34);shape.closePath();}
  else {shape.moveTo(0,0);shape.lineTo(56,12);shape.lineTo(48,50);shape.lineTo(8,56);shape.closePath();}
  const geo=new THREE.ShapeGeometry(shape);geo.scale(1/16,1/16,1/16);applyPlaneAtlasUV(geo,[uv[0],uv[1],56,56]);
  const mesh=new THREE.Mesh(geo,this.dragonMat);mesh.material.side=THREE.DoubleSide;parent.add(mesh);return mesh;
 }
 add(info:MobInfo){
  const existing=this.entries.get(info.id);if(existing){existing.info={...info};return;}
  const key=info.type==="ender_dragon"||info.type==="end_crystal"?"cow":modelType(info.type),root=new THREE.Group(),legs:THREE.Object3D[]=[];
  let crystal:THREE.Mesh|undefined,beam:THREE.Mesh|undefined,dragon:DragonRig|undefined,wither:WitherRig|undefined,warden:WardenRig|undefined;
  if(info.type==="end_crystal"){
   const base=new THREE.Mesh(new THREE.BoxGeometry(1.4,.32,1.4),new THREE.MeshBasicMaterial({color:0x292530}));base.position.y=-.8;root.add(base);
   crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.78,0),this.crystalMat);crystal.position.y=.1;root.add(crystal);
   const glass=new THREE.Mesh(new THREE.OctahedronGeometry(.95,0),new THREE.MeshBasicMaterial({color:0xb9a0ff,transparent:true,opacity:.18,wireframe:true,depthWrite:false}));glass.position.y=.1;root.add(glass);
   beam=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,1,8,1,true),this.beamMat);root.add(beam);
  }else if(info.type==="wither") {
   wither=this.addWitherModel(root);
  }else if(info.type==="warden") {
   warden=this.addWardenModel(root);
  }else if(info.type==="ender_dragon"){
   // Rebuilt from EnderDragonModel.class in the supplied 26.3 client.
   // Minecraft's dragon atlas is 256x256; every cube uses its own vanilla UV rectangle.
   const neck:THREE.Group[]=[],tail:THREE.Group[]=[],legs:THREE.Group[]=[],legBaseX:number[]=[],wings:THREE.Group[]=[],wingTips:THREE.Group[]=[];
   const makePart=(parent:THREE.Object3D,at:[number,number,number])=>{const g=new THREE.Group();g.position.set(at[0]/16,at[1]/16,at[2]/16);parent.add(g);return g;};
   // Head + jaw hierarchy and the separate eye/emissive atlas layer.
   const head=makePart(root,[0,20,-62]);
   const headMesh=this.addDragonBox(head,[16,16,16],[0,0,-2],[112,30]);
   const eyeOverlay=new THREE.Mesh(headMesh.geometry.clone(),this.dragonEyesMat);head.add(eyeOverlay);
   this.addDragonBox(head,[12,5,16],[0,1.5,-16],[176,44]);
   this.addDragonBox(head,[2,4,6],[-4,-10,-1],[0,0],true);
   this.addDragonBox(head,[2,4,6],[4,-10,-1],[0,0]);
   this.addDragonBox(head,[2,2,4],[-4,-2,-20],[112,0],true);
   this.addDragonBox(head,[2,2,4],[4,-2,-20],[112,0]);
   const jaw=makePart(head,[0,4,-8]);
   this.addDragonBox(jaw,[12,4,16],[0,2,-8],[176,65]);
   // Five independent neck segments and twelve tail segments match the source model.
   for(let i=0;i<5;i++){
    const part=makePart(root,[0,20,-12-i*10]);
    this.addDragonBox(part,[10,10,10],[0,0,0],[192,104]);
    this.addDragonBox(part,[2,4,6],[0,-7,0],[48,0]);neck.push(part);
   }
   for(let i=0;i<12;i++){
    const part=makePart(root,[0,10,60+i*10]);
    this.addDragonBox(part,[10,10,10],[0,0,0],[192,104]);
    this.addDragonBox(part,[2,4,6],[0,-7,0],[48,0]);tail.push(part);
   }
   // Main torso and its three atlas-mapped dorsal scales.
   const body=makePart(root,[0,20,8]);
   this.addDragonBox(body,[24,24,64],[0,-4,16],[0,0]);
   for(const z of [-4,16,36])this.addDragonBox(body,[2,6,12],[0,-19,z],[220,53]);
   // Both wings use the original flat XZ membrane UV tiles, with hinged tips.
   for(const side of [-1,1]){
    // Vanilla left-wing cubes are mirrored in the atlas; the right wing is not.
    const wing=makePart(body,[side*12,-15,-6]);wing.scale.x=side;
    this.addDragonBox(wing,[56,8,8],[28,0,0],[112,88],side===1);
    const membrane=new THREE.PlaneGeometry(56/16,56/16);
    membrane.rotateX(Math.PI/2);membrane.translate(28/16,0,30/16);
    applyPlaneAtlasUV(membrane,[56,88,56,56],[256,256],true);
    wing.add(new THREE.Mesh(membrane,this.dragonMat));
    const tip=makePart(wing,[56,0,0]);
    this.addDragonBox(tip,[56,4,4],[28,0,0],[112,136],side===1);
    const tipMembrane=new THREE.PlaneGeometry(56/16,56/16);
    tipMembrane.rotateX(Math.PI/2);tipMembrane.translate(28/16,0,30/16);
    applyPlaneAtlasUV(tipMembrane,[56,144,56,56],[256,256],true);
    tip.add(new THREE.Mesh(tipMembrane,this.dragonMat));
    wings.push(wing);wingTips.push(tip);
   }
   // Front and hind legs are articulated as thigh, shin, and foot groups.
   for(const side of [-1,1]){
    const front=makePart(body,[side*12,0,-6]);front.rotation.y=1.3;
    this.addDragonBox(front,[8,24,8],[0,8,0],[112,104]);
    const frontTip=makePart(front,[0,20,-1]);frontTip.rotation.z=-.5;
    this.addDragonBox(frontTip,[6,24,6],[0,11,0],[226,138]);
    const frontFoot=makePart(frontTip,[0,23,0]);frontFoot.rotation.x=.75;
    this.addDragonBox(frontFoot,[8,4,16],[0,2,-4],[144,104]);
    legs.push(front,frontTip,frontFoot);legBaseX.push(0,0,.75);
    const hind=makePart(body,[side*16,-4,34]);hind.rotation.x=1;
    this.addDragonBox(hind,[16,32,16],[0,12,0],[0,0]);
    const hindTip=makePart(hind,[0,32,-4]);hindTip.rotation.x=.5;
    this.addDragonBox(hindTip,[12,32,12],[0,14,6],[196,0]);
    const hindFoot=makePart(hindTip,[0,31,4]);hindFoot.rotation.x=.75;
    this.addDragonBox(hindFoot,[18,6,24],[0,3,-8],[112,0]);
    legs.push(hind,hindTip,hindFoot);legBaseX.push(1,.5,.75);
   }
   dragon={head,jaw,wings,wingTips,neck,tail,legs,legBaseX};
  }else{
   const mat=this.materialFor(info.type),overlayResources=(MOB_RENDER_OVERLAYS as Record<string,string[]>)[info.type]??[];
   const overlayMaterials=overlayResources.map(path=>this.materialForResource(path));
   for(const p of (MODELS[key]??SPECIAL_MODELS[key]??[])){
    const inflate=p.inflate??0;
    const g=new THREE.BoxGeometry((p.size[0]+inflate*2)/16,(p.size[1]+inflate*2)/16,(p.size[2]+inflate*2)/16);applyUV(g,key,p,info.type);
    const parent:THREE.Object3D=p.pivot?new THREE.Group():root;
    if(p.pivot){
     parent.position.set(p.pivot[0]/16,p.pivot[1]/16,p.pivot[2]/16);
     parent.rotation.set(p.rotationX??0,p.rotationY??0,p.rotationZ??0);
     parent.userData.baseRotationY=p.rotationY??0;
     parent.userData.baseRotationZ=p.rotationZ??0;
     root.add(parent);
    }
    const m=new THREE.Mesh(g,mat);
    if(p.pivot){const local=p.local??[0,0,0];m.position.set(local[0]/16,local[1]/16,local[2]/16);}
    else{m.position.set(p.pos[0]/16,p.pos[1]/16,p.pos[2]/16);m.rotation.set(p.rotationX??0,p.rotationY??0,p.rotationZ??0);}
    parent.add(m);if(p.leg)legs.push(p.pivot?parent:m);
    for(const overlayMaterial of overlayMaterials){const overlay=new THREE.Mesh(g.clone(),overlayMaterial);overlay.position.copy(m.position);overlay.rotation.copy(m.rotation);overlay.scale.copy(m.scale);overlay.renderOrder=1;parent.add(overlay);}
   }
   if(VILLAGER_RIG_TYPES.includes(info.type as string)){
    const brimGeometry=new THREE.PlaneGeometry(1,1);
    brimGeometry.rotateX(-Math.PI/2);
    applyPlaneAtlasUV(brimGeometry,[30,47,16,1],[64,64]);
    const brim=new THREE.Mesh(brimGeometry,mat);
    brim.position.set(0,24/16,0);root.add(brim);
   }
  }
  const profile=MOB_PROFILES[info.type];
  if(info.type!=="ender_dragon"&&info.type!=="end_crystal"){
   const baseHeight=info.type==="wither"?26.7/16:info.type==="warden"?3.7:(MOB_MODEL_BASE_HEIGHTS as Record<string,number>)[key]??28/16;
   const desiredHeight=(MOB_RENDER_HEIGHTS as Record<string,number>)[info.type]??profile?.height??baseHeight;
   const scale=Math.max(.35,Math.min(2.8,desiredHeight/baseHeight));
   root.scale.setScalar(scale);
   if(info.type==="wither")root.userData.yOffset=22.7/16*scale;
   else if(info.type==="warden")root.userData.yOffset=0;
   else if(info.type==="ghast")root.userData.yOffset=-(4.4/16)*scale;
  }
  root.position.x=info.x;root.position.z=info.z;root.position.y=info.y+(Number(root.userData.yOffset)||0);
  root.userData.mobId=info.id;this.group.add(root);this.entries.set(info.id,{root,info:{...info},legs,crystal,beam,dragon,wither,warden,wings:dragon?.wings});
 }
 private disposeEntry(entry:MobEntry){
  const sharedMaterials=new Set<THREE.Material>([
   ...this.entityMaterials.values(),this.dragonMat,this.dragonEyesMat,this.crystalMat,this.beamMat,
   this.witherMaterial,this.wardenMaterial,this.wardenGlowMaterial,
  ]);
  entry.root.traverse((object)=>{
   const mesh=object as THREE.Mesh;
   if(!mesh.isMesh)return;
   mesh.geometry.dispose();
   const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
   for(const material of materials)if(material&&!sharedMaterials.has(material))material.dispose();
  });
 }
 remove(id:string){const e=this.entries.get(id);if(e){this.group.remove(e.root);this.disposeEntry(e);this.entries.delete(id);}}
 clear(){for(const id of [...this.entries.keys()])this.remove(id);}
 setRenderDistance(x:number,y:number,z:number,maxDistance:number){
  const limit=Number.isFinite(maxDistance)?Math.max(0,maxDistance):48,limitSq=limit*limit;
  for(const entry of this.entries.values()){
   const dx=entry.info.x-x,dy=entry.info.y-y,dz=entry.info.z-z;
   entry.root.visible=dx*dx+dy*dy+dz*dz<=limitSq;
  }
 }
 update(t:number){
  for(const e of this.entries.values()){
   e.root.position.x+=(e.info.x-e.root.position.x)*.32;e.root.position.y+=(e.info.y+(Number(e.root.userData.yOffset)||0)-e.root.position.y)*.32;e.root.position.z+=(e.info.z-e.root.position.z)*.32;e.root.rotation.y=e.info.yaw;
   const isWalking=e.info.state==="wander"||e.info.state==="chase"||e.info.state==="flee";
   if(e.info.type==="spider"||e.info.type==="cave_spider"){
    // SpiderModel.setupAnim: four paired gait phases, yaw swing and outward roll.
    const walkPos=t*20,phase=walkPos*.6662,speed=isWalking?1:0;
    const phaseOffsets=[0,Math.PI,Math.PI/2,Math.PI*1.5];
    for(let pair=0;pair<4;pair++){
     const right=e.legs[pair*2],left=e.legs[pair*2+1];
     if(!right||!left)continue;
     const yaw=-Math.cos(phase*2+phaseOffsets[pair])*.4*speed;
     const roll=Math.abs(Math.sin(phase+phaseOffsets[pair])*.4)*speed;
     right.rotation.y=Number(right.userData.baseRotationY||0)+yaw;
     left.rotation.y=Number(left.userData.baseRotationY||0)-yaw;
     right.rotation.z=Number(right.userData.baseRotationZ||0)+roll;
     left.rotation.z=Number(left.userData.baseRotationZ||0)-roll;
    }
   }else if(e.info.type==="ghast"){
    // GhastModel.animateTentacles: xRot = 0.2*sin(ageInTicks*0.3 + index) + 0.4.
    const ageInTicks=t*20;
    e.legs.forEach((m,i)=>{m.rotation.x=.2*Math.sin(ageInTicks*.3+i)+.4;});
   }else if(e.info.type==="blaze"){
    // BlazeModel.setupAnim moves three rings of rods around the head with distinct angular speeds.
    const ageInTicks=t*20;
    e.legs.forEach((m,i)=>{
     const ring=i<4?0:i<8?1:2,slot=i%4;
     const initial=ring===2?.47123894:Math.PI/4;
     const angularVelocity=ring===0?-.1*Math.PI:ring===1?.03*Math.PI:-.05*Math.PI;
     const angle=initial+angularVelocity*ageInTicks+slot*Math.PI/2;
     const radius=ring===0?9:ring===1?7:5;
     const modelY=ring===0?-2+Math.cos((i*2+ageInTicks)*.25)
       :ring===1?2+Math.cos((i*2+ageInTicks)*.25)
       :11+Math.cos((i*1.5+ageInTicks)*.5);
     m.position.set(Math.cos(angle)*radius/16,(24-modelY)/16,Math.sin(angle)*radius/16);
    });
   }else{
    e.legs.forEach((m,i)=>m.rotation.x=Math.sin(t*2.2+(i%2)*Math.PI)*.08);
   }
   if(e.dragon){e.dragon.wings.forEach((wing,i)=>{const flap=Math.sin(t*2.7+(i*Math.PI))*.48;wing.rotation.z=flap*(i===0?1:-1);wing.rotation.y=Math.sin(t*1.1)*.06*(i===0?1:-1);});e.dragon.wingTips.forEach((tip,i)=>{tip.rotation.z=Math.sin(t*2.7+i*Math.PI)*.32*(i===0?1:-1);});e.dragon.jaw.rotation.x=.04+Math.max(0,Math.sin(t*2.1))*.2;e.dragon.head.rotation.y=Math.sin(t*.7)*.12;e.dragon.neck.forEach((m,i)=>{m.rotation.x=Math.sin(t*.8-i*.18)*.035;});e.dragon.tail.forEach((m,i)=>{m.rotation.y=Math.sin(t*.9-i*.12)*.06;});e.dragon.legs.forEach((m,i)=>{m.rotation.x=e.dragon!.legBaseX[i]+Math.sin(t*1.8+(i%3)*Math.PI)*.035;});}
   if(e.wither){e.wither.heads[0].rotation.y=Math.sin(t*.55)*.06;e.wither.heads[1].rotation.y=Math.sin(t*.8+1.4)*.16;e.wither.heads[2].rotation.y=Math.sin(t*.8-1.4)*.16;e.wither.ribcage.rotation.z=Math.sin(t*.35)*.025;e.wither.tail.rotation.y=Math.sin(t*.45)*.04;}
   if(e.warden){e.warden.head.rotation.y=Math.sin(t*.38)*.045;e.warden.tendrils.forEach((g,i)=>{g.rotation.z=Math.sin(t*.6+i*Math.PI)*.05;});e.warden.arms.forEach((m,i)=>{m.rotation.x=Math.sin(t*.75+i*Math.PI)*.035;});e.warden.ribs.forEach((g,i)=>{g.rotation.z=Math.sin(t*.5+i*Math.PI)*.025;});}
   if(e.crystal){e.crystal.rotation.y=t*.9;e.crystal.rotation.z=Math.sin(t*1.5)*.08;e.crystal.position.y=.1+Math.sin(t*2)*.12;}
   if(e.beam){const origin=new THREE.Vector3(0,.12,0);const target=e.info.beamTarget?new THREE.Vector3(e.info.beamTarget[0]-e.info.x,e.info.beamTarget[1]-e.info.y,e.info.beamTarget[2]-e.info.z):new THREE.Vector3(0,36,0);const delta=target.sub(origin);const length=Math.max(.5,delta.length());e.beam.visible=true;e.beam.position.copy(origin).addScaledVector(delta,.5);e.beam.scale.y=length;e.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());}
  }
 }
 target(camera:THREE.Camera,max=3.2):string|null{const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);const hit=ray.intersectObject(this.group,true).find(x=>x.distance<=max);let o:THREE.Object3D|null=hit?.object??null;while(o&&o!==this.group){const id=o.userData.mobId;if(typeof id==="string")return id;o=o.parent;}return null;}
}
