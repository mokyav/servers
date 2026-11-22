import test from "node:test";
import assert from "node:assert/strict";
import { PORTAL_BLOCK_IDS as B, buildPortalEdits, findNearestPortal, findPortalBuildSite, findPortalInterior, pickPortalY, portalCollapseEdits, scaleToDimension, tryLightPortal } from "../shared/portal.js";

function frame(width=2,height=3,axis="x") {
  const cells=new Map(); const key=(x,y,z)=>`${x},${y},${z}`;
  const get=(x,y,z)=>cells.get(key(x,y,z))??B.air;
  const set=(x,y,z,b)=>cells.set(key(x,y,z),b);
  const pos=(a,y)=>axis==="x"?[a,y,0]:[0,y,a];
  for(let a=-1;a<=width;a++)for(let y=0;y<=height+1;y++)if(a===-1||a===width||y===0||y===height+1){const [x,yy,z]=pos(a,y);set(x,yy,z,B.obsidian);}
  return {get,set};
}

test("detects valid minimum and larger Nether portal frames in either horizontal axis",()=>{
  const f=frame(); assert.equal(findPortalInterior(f.get,0,1,0).length,6);
  const z=frame(2,3,"z"); assert.equal(findPortalInterior(z.get,0,1,0).length,6);
  const large=frame(3,4); assert.equal(findPortalInterior(large.get,0,1,0).length,12);
});
test("flint-and-steel lights only a valid obsidian frame from its clicked face",()=>{
  const f=frame();
  const edits=tryLightPortal(f.get,{x:-1,y:1,z:0,nx:1,ny:0,nz:0});
  assert.equal(edits.length,6); for(const [x,y,z,b] of edits)f.set(x,y,z,b);
  assert.ok(edits.every(([x,y,z])=>f.get(x,y,z)===B.netherPortal));
  assert.equal(findPortalInterior(f.get,0,1,0),null,"lit interior cannot be lit twice");
  assert.equal(tryLightPortal(f.get,{x:40,y:1,z:0,nx:1,ny:0,nz:0}),null);
});
test("rejects undersized, obstructed, and incomplete frames",()=>{
  assert.equal(findPortalInterior(frame(1,3).get,0,1,0),null);
  assert.equal(findPortalInterior(frame(2,2).get,0,1,0),null);
  const f=frame();f.set(0,2,0,B.obsidian);assert.equal(findPortalInterior(f.get,0,1,0),null);
  const broken=frame();broken.set(-1,2,0,B.air);assert.equal(findPortalInterior(broken.get,0,1,0),null);
});
test("breaking frame obsidian removes the connected portal plane only",()=>{
  const f=frame();for(const [x,y,z,b] of tryLightPortal(f.get,{x:-1,y:1,z:0,nx:1,ny:0,nz:0}))f.set(x,y,z,b);
  f.set(-1,2,0,B.air);
  const edits=portalCollapseEdits(f.get,-1,2,0);assert.equal(edits.length,6);
  for(const [x,y,z,b]of edits)f.set(x,y,z,b);
  assert.ok(edits.every(([x,y,z])=>f.get(x,y,z)===B.air));
});
test("build and coordinate helpers return bounded portal geometry and links",()=>{
  const {edits,spawn}=buildPortalEdits(10,20,30);assert.deepEqual(spawn,[11,20,30]);assert.equal(edits.length,6*5*3+4*5+8);
  assert.deepEqual(scaleToDimension(0,80,-17),[10,-3]);assert.deepEqual(scaleToDimension(1,10,-3),[80,-24]);
  const f=frame();for(const [x,y,z,b]of tryLightPortal(f.get,{x:-1,y:1,z:0,nx:1,ny:0,nz:0}))f.set(x,y,z,b);
  assert.deepEqual(findNearestPortal(f.get,0,0,2),[0,1,0]);
  assert.equal(pickPortalY(()=>B.air,0,0,0),30);
});

test("fallback portal sites preserve existing terrain and choose clear height",()=>{
  const get=(x,y,z)=>y===10?B.obsidian:B.air;
  assert.deepEqual(findPortalBuildSite(get,0,0,{radius:0,yMin:2,yMax:20}),{x:0,y:12,z:0});
  assert.equal(findPortalBuildSite(()=>B.obsidian,0,0,{radius:1,yMin:2,yMax:20}),null);
});
