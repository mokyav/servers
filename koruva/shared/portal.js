import { MINECRAFT_BLOCK_TO_RUNTIME_ID } from "./minecraft-block-runtime.js";

export const PORTAL_BLOCK_IDS = Object.freeze({
  air: 0,
  water: MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:water"],
  leaves: MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:oak_leaves"],
  netherrack: MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:netherrack"],
  obsidian: MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:obsidian"],
  netherPortal: MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:nether_portal"],
});
const MIN_W=2, MAX_W=21, MIN_H=3, MAX_H=21;
// Keep in sync with WORLD_HEIGHT in constants.ts (runtime world slice is 128 blocks).
const PORTAL_WORLD_HEIGHT = 128;

/** Find the air interior of a complete obsidian frame containing the supplied cell. */
export function findPortalInterior(get,x,y,z,ids=PORTAL_BLOCK_IDS) {
  if (typeof get!=="function" || get(x,y,z)!==ids.air) return null;
  for (const axis of [0,2]) {
    const at=(a,yy)=>axis===0?[a,yy,z]:[x,yy,a];
    const pos=axis===0?x:z, g=(a,yy)=>get(...at(a,yy));
    let by=y;
    while(by>1 && g(pos,by-1)===ids.air && y-by<MAX_H) by--;
    if(g(pos,by-1)!==ids.obsidian) continue;
    let lo=pos; while(g(lo-1,by)===ids.air && pos-lo<MAX_W) lo--;
    if(g(lo-1,by)!==ids.obsidian) continue;
    let hi=pos; while(g(hi+1,by)===ids.air && hi-pos<MAX_W) hi++;
    if(g(hi+1,by)!==ids.obsidian) continue;
    const w=hi-lo+1; if(w<MIN_W||w>MAX_W) continue;
    let h=0; while(h<=MAX_H && g(lo,by+h)===ids.air) h++;
    if(h<MIN_H||h>MAX_H) continue;
    let ok=true; const cells=[];
    for(let a=lo;a<=hi&&ok;a++) {
      if(g(a,by-1)!==ids.obsidian||g(a,by+h)!==ids.obsidian){ok=false;break;}
      for(let yy=by;yy<by+h;yy++){if(g(a,yy)!==ids.air){ok=false;break;}cells.push(at(a,yy));}
    }
    for(let yy=by;yy<by+h&&ok;yy++) if(g(lo-1,yy)!==ids.obsidian||g(hi+1,yy)!==ids.obsidian) ok=false;
    if(ok)return cells;
  }
  return null;
}

/** Ignite a valid portal when flint-and-steel is used on an obsidian face. */
export function tryLightPortal(get,hit,ids=PORTAL_BLOCK_IDS) {
  if(get(hit.x,hit.y,hit.z)!==ids.obsidian)return null;
  const cells=findPortalInterior(get,hit.x+hit.nx,hit.y+hit.ny,hit.z+hit.nz,ids);
  return cells?cells.map(([x,y,z])=>[x,y,z,ids.netherPortal]):null;
}

/** Return connected portal blocks adjacent to a broken frame or portal cell. */
export function portalCollapseEdits(get,x,y,z,ids=PORTAL_BLOCK_IDS) {
  const seen=new Set(),out=[],stack=[];
  const push=(a,b,c)=>{if(get(a,b,c)===ids.netherPortal&&!seen.has(`${a},${b},${c}`)){seen.add(`${a},${b},${c}`);stack.push([a,b,c]);}};
  for(const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])push(x+dx,y+dy,z+dz);
  while(stack.length&&out.length<600){const [a,b,c]=stack.pop();out.push([a,b,c,ids.air]);for(const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])push(a+dx,b+dy,c+dz);}
  return out;
}

/** Build a safe 4×5 obsidian/nether-portal frame and adjacent footing. */
export function buildPortalEdits(x,y,z,ids=PORTAL_BLOCK_IDS) {
  const edits=[];
  for(let dx=-2;dx<=3;dx++)for(let dy=0;dy<=4;dy++)for(let dz=-1;dz<=1;dz++)edits.push([x+dx,y+dy,z+dz,ids.air]);
  for(let dx=-1;dx<=2;dx++)for(let dy=-1;dy<=3;dy++){const edge=dx===-1||dx===2||dy===-1||dy===3;edits.push([x+dx,y+dy,z,edge?ids.obsidian:ids.netherPortal]);}
  for(let dx=-1;dx<=2;dx++)for(const dz of [-1,1])edits.push([x+dx,y-1,z+dz,ids.obsidian]);
  return {edits,spawn:[x+1,y,z]};
}
export function scaleToDimension(from,x,z){return from===0?[Math.floor(x/8),Math.floor(z/8)]:[Math.floor(x*8),Math.floor(z*8)];}

/** Search for a portal's bottom interior cell in a square around the target. */
export function findNearestPortal(get,cx,cz,r,yMin=1,yMax=PORTAL_WORLD_HEIGHT-2,ids=PORTAL_BLOCK_IDS){
  let best=null,bd=Infinity;
  for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){const d=dx*dx+dz*dz;if(d>=bd)continue;for(let y=yMin;y<=yMax;y++)if(get(cx+dx,y,cz+dz)===ids.netherPortal&&get(cx+dx,y-1,cz+dz)!==ids.netherPortal){best=[cx+dx,y,cz+dz];bd=d;break;}}
  return best;
}
export function pickPortalY(get,x,z,dim,ids=PORTAL_BLOCK_IDS){
  if(dim===0){for(let y=62;y>2;y--)if(get(x,y,z)!==ids.air&&get(x,y,z)!==ids.water&&get(x,y,z)!==ids.leaves)return Math.min(y+1,56);return 30;}
  for(let y=31;y>8;y--)if(get(x,y,z)===ids.netherrack&&get(x,y+1,z)===ids.air)return y+1;
  return 31;
}

/** Find a clear fallback frame footprint, nearest-first and bounded to a small area. */
export function findPortalBuildSite(get,cx,cz,{radius=4,yMin=2,yMax=PORTAL_WORLD_HEIGHT-6,ids=PORTAL_BLOCK_IDS}={}){
  if(typeof get!=="function"||![cx,cz,radius,yMin,yMax].every(Number.isSafeInteger)||radius<0||yMin<2||yMax>PORTAL_WORLD_HEIGHT-6||yMin>yMax)return null;
  const candidates=[];
  for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++)candidates.push({x:cx+dx,z:cz+dz,d:dx*dx+dz*dz});
  candidates.sort((a,b)=>a.d-b.d||a.z-b.z||a.x-b.x);
  for(const {x,z} of candidates){
    let highest=-1;
    for(let dx=-2;dx<=3;dx++)for(let dz=-1;dz<=1;dz++)for(let y=yMin-1;y<=yMax+4;y++)if(get(x+dx,y,z+dz)!==ids.air)highest=Math.max(highest,y);
    const y=Math.max(yMin,highest+2);
    if(y<=yMax)return{x,y,z};
  }
  return null;
}
export const PORTAL_DELAY_SURVIVAL_MS=4000;
export const PORTAL_DELAY_CREATIVE_MS=500;
