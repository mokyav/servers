const MOB_PROFILE_TABLE={
  "allay": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:0.7, visual:"chicken"}),
  "armadillo": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:0.7, visual:"chicken"}),
  "axolotl": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:0.7, visual:"chicken"}),
  "bat": Object.freeze({maxHealth:10, speed:1.25, kind:"passive", height:0.7, visual:"chicken"}),
  "bee": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:0.7, visual:"chicken"}),
  "blaze": Object.freeze({maxHealth:20, speed:1.0, kind:"ranged", height:1.8, visual:"skeleton", damage:4, attackRange:12}),
  "bogged": Object.freeze({maxHealth:20, speed:1.0, kind:"ranged", height:1.2, visual:"skeleton", damage:4, attackRange:12}),
  "breeze": Object.freeze({maxHealth:20, speed:1.0, kind:"ranged", height:1.2, visual:"skeleton", damage:4, attackRange:12}),
  "camel": Object.freeze({maxHealth:10, speed:0.85, kind:"passive", height:2.4, visual:"cow"}),
  "camel_husk": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:2.4, visual:"cow"}),
  "cat": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "cave_spider": Object.freeze({maxHealth:12, speed:1.2, kind:"melee", height:0.5, visual:"zombie", damage:2, attackRange:1.6}),
  "chicken": Object.freeze({maxHealth:4, speed:1.15, kind:"passive", height:0.7, visual:"chicken"}),
  "cod": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:0.7, visual:"chicken"}),
  "copper_golem": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "cow": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.4, visual:"cow"}),
  "creaking": Object.freeze({maxHealth:1, speed:1.0, kind:"melee", height:1.2, visual:"zombie", damage:4, attackRange:1.6}),
  "creeper": Object.freeze({maxHealth:20, speed:1.15, kind:"fuse", height:1.7, visual:"creeper", damage:12, attackRange:2.8}),
  "dolphin": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:2.4, visual:"cow"}),
  "donkey": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:2.4, visual:"cow"}),
  "drowned": Object.freeze({maxHealth:20, speed:1.0, kind:"melee", height:1.2, visual:"zombie", damage:4, attackRange:1.6}),
  "elder_guardian": Object.freeze({maxHealth:80, speed:1.0, kind:"ranged", height:2.4, visual:"skeleton", damage:8, attackRange:12}),
  "ender_dragon": Object.freeze({maxHealth:200, speed:1.8, kind:"dragon", height:4, visual:"cow", damage:10, attackRange:4}),
  "enderman": Object.freeze({maxHealth:40, speed:1.15, kind:"melee", height:2.9, visual:"zombie", damage:7, attackRange:2.2}),
  "endermite": Object.freeze({maxHealth:8, speed:1.0, kind:"melee", height:0.4, visual:"zombie", damage:2, attackRange:1.2}),
  "evoker": Object.freeze({maxHealth:20, speed:1.0, kind:"ranged", height:1.2, visual:"skeleton", damage:4, attackRange:12}),
  "fox": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "frog": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:0.7, visual:"chicken"}),
  "ghast": Object.freeze({maxHealth:10, speed:1.0, kind:"ranged", height:4, visual:"skeleton", damage:4, attackRange:12}),
  "glow_squid": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:0.7, visual:"chicken"}),
  "goat": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "guardian": Object.freeze({maxHealth:20, speed:1.0, kind:"ranged", height:1.2, visual:"skeleton", damage:4, attackRange:12}),
  "happy_ghast": Object.freeze({maxHealth:20, speed:0.7, kind:"passive", height:2.4, visual:"cow"}),
  "hoglin": Object.freeze({maxHealth:20, speed:1.0, kind:"melee", height:2.4, visual:"zombie", damage:4, attackRange:1.6}),
  "horse": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:2.4, visual:"cow"}),
  "husk": Object.freeze({maxHealth:20, speed:1.0, kind:"melee", height:1.2, visual:"zombie", damage:4, attackRange:1.6}),
  "iron_golem": Object.freeze({maxHealth:100, speed:0.9, kind:"passive", height:2.4, visual:"cow"}),
  "llama": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "magma_cube": Object.freeze({maxHealth:16, speed:1.0, kind:"melee", height:1, visual:"zombie", damage:4, attackRange:1.6}),
  "mooshroom": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:2.4, visual:"cow"}),
  "mule": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "nautilus": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "ocelot": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "panda": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "parched": Object.freeze({maxHealth:20, speed:1.0, kind:"ranged", height:1.2, visual:"skeleton", damage:4, attackRange:12}),
  "parrot": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:0.7, visual:"chicken"}),
  "phantom": Object.freeze({maxHealth:20, speed:1.25, kind:"melee", height:1.2, visual:"zombie", damage:4, attackRange:1.6}),
  "pig": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:0.9, visual:"pig"}),
  "piglin": Object.freeze({maxHealth:20, speed:1.0, kind:"melee", height:1.2, visual:"zombie", damage:4, attackRange:1.6}),
  "piglin_brute": Object.freeze({maxHealth:20, speed:1.0, kind:"melee", height:1.2, visual:"zombie", damage:4, attackRange:1.6}),
  "pillager": Object.freeze({maxHealth:20, speed:1.0, kind:"ranged", height:1.2, visual:"skeleton", damage:4, attackRange:12}),
  "polar_bear": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:2.4, visual:"cow"}),
  "pufferfish": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:0.7, visual:"chicken"}),
  "rabbit": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:0.7, visual:"chicken"}),
  "ravager": Object.freeze({maxHealth:100, speed:1.0, kind:"melee", height:2.4, visual:"zombie", damage:8, attackRange:1.6}),
  "salmon": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:0.7, visual:"chicken"}),
  "sheep": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "shulker": Object.freeze({maxHealth:20, speed:1.0, kind:"ranged", height:1.2, visual:"skeleton", damage:4, attackRange:12}),
  "silverfish": Object.freeze({maxHealth:8, speed:1.0, kind:"melee", height:0.4, visual:"zombie", damage:2, attackRange:1.2}),
  "skeleton": Object.freeze({maxHealth:20, speed:1.0, kind:"ranged", height:1.8, visual:"skeleton", damage:4, attackRange:12}),
  "skeleton_horse": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "slime": Object.freeze({maxHealth:16, speed:1.0, kind:"melee", height:1, visual:"zombie", damage:4, attackRange:1.6}),
  "sniffer": Object.freeze({maxHealth:10, speed:0.65, kind:"passive", height:1.2, visual:"pig"}),
  "snow_golem": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "spider": Object.freeze({maxHealth:16, speed:1.15, kind:"melee", height:0.9, visual:"zombie", damage:3, attackRange:1.6}),
  "squid": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "stray": Object.freeze({maxHealth:20, speed:1.0, kind:"ranged", height:1.2, visual:"skeleton", damage:4, attackRange:12}),
  "strider": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:2.4, visual:"cow"}),
  "sulfur_cube": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "tadpole": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:0.7, visual:"chicken"}),
  "trader_llama": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "tropical_fish": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:0.7, visual:"chicken"}),
  "turtle": Object.freeze({maxHealth:10, speed:0.55, kind:"passive", height:1.2, visual:"pig"}),
  "vex": Object.freeze({maxHealth:20, speed:1.0, kind:"melee", height:0.7, visual:"zombie", damage:4, attackRange:1.6}),
  "villager": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "vindicator": Object.freeze({maxHealth:20, speed:1.0, kind:"melee", height:1.2, visual:"zombie", damage:4, attackRange:1.6}),
  "wandering_trader": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "warden": Object.freeze({maxHealth:500, speed:1.0, kind:"melee", height:2.4, visual:"zombie", damage:8, attackRange:1.6}),
  "witch": Object.freeze({maxHealth:20, speed:1.0, kind:"ranged", height:1.2, visual:"skeleton", damage:4, attackRange:12}),
  "wither": Object.freeze({maxHealth:300, speed:1.0, kind:"ranged", height:2.4, visual:"skeleton", damage:8, attackRange:12}),
  "wither_skeleton": Object.freeze({maxHealth:20, speed:1.0, kind:"melee", height:1.2, visual:"zombie", damage:4, attackRange:1.6}),
  "wolf": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
  "zoglin": Object.freeze({maxHealth:20, speed:1.0, kind:"melee", height:1.2, visual:"zombie", damage:4, attackRange:1.6}),
  "zombie": Object.freeze({maxHealth:20, speed:1.05, kind:"melee", height:1.8, visual:"zombie", damage:4, attackRange:1.6}),
  "zombie_horse": Object.freeze({maxHealth:20, speed:1.0, kind:"melee", height:1.2, visual:"zombie", damage:4, attackRange:1.6}),
  "zombie_nautilus": Object.freeze({maxHealth:20, speed:1.0, kind:"melee", height:1.2, visual:"zombie", damage:4, attackRange:1.6}),
  "zombie_villager": Object.freeze({maxHealth:20, speed:1.0, kind:"melee", height:1.2, visual:"zombie", damage:4, attackRange:1.6}),
  "zombified_piglin": Object.freeze({maxHealth:10, speed:0.9, kind:"passive", height:1.2, visual:"pig"}),
};
const END_CRYSTAL_PROFILE=Object.freeze({maxHealth:5,speed:0,kind:"passive",height:2.2,visual:"cow"});
Object.defineProperty(MOB_PROFILE_TABLE,"end_crystal",{value:END_CRYSTAL_PROFILE,enumerable:false});
export const MOB_PROFILES=Object.freeze(MOB_PROFILE_TABLE);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),finite=(v,d=0)=>Number.isFinite(v)?v:d;
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function dist2(m,p){const x=p.p[0]-m.x,z=p.p[2]-m.z;return x*x+z*z;}
export function createMob(type,id,x,y,z,yaw=0){const d=type==="end_crystal"?END_CRYSTAL_PROFILE:MOB_PROFILES[type];if(!d)throw new TypeError("unknown mob type");return{id:String(id).slice(0,64),type,x:finite(x),y:finite(y,1),z:finite(z),yaw:finite(yaw),health:d.maxHealth,maxHealth:d.maxHealth,state:"idle",attackAt:0,wanderYaw:finite(yaw),nextThinkAt:0,fuse:0};}
function validPlayers(ps){return ps.filter(p=>p&&typeof p.id==="string"&&Array.isArray(p.p)&&p.p.length>=3&&p.p.every(Number.isFinite)&&!p.dead&&p.gameMode!=="creative"&&p.gameMode!=="spectator");}
const solid=(fn,x,y,z)=>typeof fn==="function"&&!!fn(Math.floor(x),Math.floor(y),Math.floor(z));
function canOccupy(fn,x,y,z,h){return!solid(fn,x,y+.05,z)&&!solid(fn,x,y+Math.max(.2,h-.15),z);}
function move(m,yaw,distance,height,solidAt){if(distance<=0)return;const dx=Math.sin(yaw)*distance,dz=Math.cos(yaw)*distance,nx=m.x+dx,nz=m.z+dz;if(canOccupy(solidAt,nx,m.y,nz,height)){m.x=nx;m.z=nz;return;}const up=Math.floor(m.y+.05)+1;if(canOccupy(solidAt,nx,up,nz,height)&&solid(solidAt,nx,up-.05,nz)){m.x=nx;m.z=nz;m.y=up;return;}if(canOccupy(solidAt,nx,m.y,m.z,height))m.x=nx;if(canOccupy(solidAt,m.x,m.y,nz,height))m.z=nz;}
function settle(m,dt,solidAt){if(m.y<=1){m.y=1;return;}if(!solid(solidAt,m.x,Math.floor(m.y-.03),m.z))m.y=Math.max(1,m.y-3.8*dt);}
function nearest(m,players,range){let best=null,bestD=range*range;for(const p of players){const d=dist2(m,p);if(d<bestD){best=p;bestD=d;}}return best;}
export function hasClearLine(from, to, solidAt) {
  if (!Array.isArray(from) || !Array.isArray(to) || from.length < 3 || to.length < 3 || typeof solidAt !== "function") return false;
  const [x0, y0, z0] = from, [x1, y1, z1] = to;
  if (![x0, y0, z0, x1, y1, z1].every(Number.isFinite)) return false;
  const span = Math.max(Math.abs(x1-x0), Math.abs(y1-y0), Math.abs(z1-z0));
  const steps = Math.ceil(span * 4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (solid(solidAt, x0+(x1-x0)*t, y0+(y1-y0)*t, z0+(z1-z0)*t)) return false;
  }
  return true;
}
function hasLineOfSight(m, target, mobHeight, solidAt) {
  return hasClearLine(
    [m.x, m.y + Math.max(.3, mobHeight*.75), m.z],
    [target.p[0], target.p[1] + 1, target.p[2]],
    solidAt,
  );
}
/** Server-authoritative coarse AI; caller applies emitted damage and persists state. */
export function stepMobAI(input,players,dtSeconds,nowMs,solidAt=()=>false){const d=input?.type==="end_crystal"?END_CRYSTAL_PROFILE:MOB_PROFILES[input?.type];if(!d)return{mob:input,attacks:[],projectiles:[],remove:false,changed:false};
 const m={...input,x:finite(input.x),y:finite(input.y,1),z:finite(input.z),yaw:finite(input.yaw),health:clamp(finite(input.health,d.maxHealth),0,d.maxHealth),maxHealth:d.maxHealth,state:input.state||"idle",attackAt:finite(input.attackAt),wanderYaw:finite(input.wanderYaw,input.yaw||0),nextThinkAt:finite(input.nextThinkAt),fuse:clamp(finite(input.fuse),0,1.5)};
 const before=[m.x,m.y,m.z,m.yaw,m.state,m.attackAt,m.wanderYaw,m.nextThinkAt,m.fuse,m.targetId,m.dragonPhase,m.dragonOrbit],dt=clamp(finite(dtSeconds),0,.25),now=finite(nowMs),actors=validPlayers(Array.isArray(players)?players:[]),attacks=[],projectiles=[];let remove=false;
 const target=d.kind==="passive"?null:nearest(m,actors,m.type==="ender_dragon"?128:24);m.targetId=target?.id;
 const fleeing=d.kind==="passive"&&m.fleeUntil>now;
 if(d.kind==="passive"&&m.fleeUntil>0&&!fleeing){m.fleeUntil=0;m.state="idle";m.nextThinkAt=now;}
 if(fleeing){m.state="flee";m.yaw=m.fleeYaw;move(m,m.yaw,d.speed*1.6*dt,d.height,solidAt);}
 else if(d.kind==="passive"||!target){if(now>=m.nextThinkAt){const roll=hash(`${m.id}:${Math.floor(now/2400)}`)/4294967296;m.wanderYaw=roll*Math.PI*2;m.state=roll<.28?"idle":"wander";m.nextThinkAt=now+1200+Math.floor(roll*2200);}if(m.state==="wander"){m.yaw=m.wanderYaw;move(m,m.yaw,d.speed*dt,d.height,solidAt);}}
 else{const dx=target.p[0]-m.x,dz=target.p[2]-m.z,dist=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz),visible=hasLineOfSight(m,target,d.height,solidAt);m.yaw=yaw;
  if(m.type==="ender_dragon"){
    // Aerial End boss controller: orbit, strafe with dragon fireballs, then swoop through the target.
    const phase=m.dragonPhase||"circle";
    if(now>=m.nextThinkAt){
      const roll=hash(`${m.id}:${Math.floor(now/5000)}`)/4294967296;
      m.dragonPhase=phase==="circle"?(roll<.34?"strafe":roll<.58?"swoop":"circle"):roll<.28?"swoop":roll<.58?"strafe":"circle";
      m.nextThinkAt=now+3500+Math.floor(roll*2500);
    }
    const angle=finite(m.dragonOrbit,hash(m.id)%6283/1000)+(dt*0.28);
    m.dragonOrbit=angle;
    const desiredY=Math.max(24,Math.min(92,target.p[1]+(m.dragonPhase==="swoop"?4:14)));
    let tx,tz,ty;
    if(m.dragonPhase==="swoop") { tx=target.p[0]; tz=target.p[2]; ty=target.p[1]+1.2; m.state="swoop"; }
    else { const radius=m.dragonPhase==="strafe"?25:18; tx=target.p[0]+Math.cos(angle)*radius; tz=target.p[2]+Math.sin(angle)*radius; ty=desiredY; m.state=m.dragonPhase==="strafe"?"strafe":"circle"; }
    const fx=tx-m.x,fy=ty-m.y,fz=tz-m.z,flen=Math.hypot(fx,fy,fz)||1;
    const step=Math.min(flen,7.2*dt*(m.dragonPhase==="swoop"?1.25:1));
    m.x+=fx/flen*step; m.y+=fy/flen*step; m.z+=fz/flen*step;
    m.yaw=Math.atan2(fx,fz);
    if(m.dragonPhase==="swoop" && dist<4.5 && Math.abs(target.p[1]-m.y)<6 && now>=m.attackAt){
      attacks.push({targetId:target.id,damage:d.damage,kind:"melee"}); m.attackAt=now+1400; m.dragonPhase="circle"; m.nextThinkAt=now+1800;
    }
    if((m.dragonPhase==="strafe"||m.dragonPhase==="circle")&&visible&&dist<48&&now>=m.attackAt){
      const sx=m.x,sy=m.y-1.5,sz=m.z,txp=target.p[0],typ=target.p[1]+1,tzp=target.p[2];
      const vx=txp-sx,vy=typ-sy,vz=tzp-sz,len=Math.hypot(vx,vy,vz)||1,speed=15;
      projectiles.push({type:"dragon_fireball",ownerId:m.id,x:sx,y:sy,z:sz,vx:vx/len*speed,vy:vy/len*speed,vz:vz/len*speed,damage:8});
      m.attackAt=now+4200;
    }
  }
  else if(d.kind==="melee"){const inRange=dist<=d.attackRange&&visible;m.state=inRange?"attack":"chase";if(inRange){if(now>=m.attackAt){attacks.push({targetId:target.id,damage:d.damage,kind:"melee"});m.attackAt=now+1200;}}else move(m,yaw,d.speed*dt,d.height,solidAt);}
  else if(d.kind==="ranged"){if(dist>12||!visible){m.state="chase";move(m,yaw,d.speed*dt,d.height,solidAt);}else if(dist<4){m.state="retreat";move(m,yaw+Math.PI,d.speed*dt,d.height,solidAt);}else{m.state="attack";if(now>=m.attackAt){
    if(m.type==="skeleton"||m.type==="stray"){
      const sx=m.x, sy=m.y+Math.max(.45,d.height*.78), sz=m.z;
      const tx=target.p[0], ty=target.p[1]+1.05, tz=target.p[2];
      const vx=tx-sx, vz=tz-sz, speed=22;
      // Compensate for gravity so the arrow follows an arc toward the target instead of
      // being a hitscan-like straight line. Gravity in the projectile step is 24 blocks/s².
      const horizontalDistance=Math.hypot(vx,vz);
      const flightTime=Math.min(0.8,horizontalDistance/speed);
      const aimY=ty+12*flightTime*flightTime;
      const vy=aimY-sy, length=Math.hypot(vx,vy,vz)||1;
      projectiles.push({type:"arrow",ownerId:m.id,targetId:target.id,x:sx,y:sy,z:sz,vx:vx/length*speed,vy:vy/length*speed,vz:vz/length*speed,damage:d.damage});
    } else attacks.push({targetId:target.id,damage:d.damage,kind:"ranged"});
    m.attackAt=now+(m.type==="skeleton"||m.type==="stray"?1700:1800);
  }}}
  else if(dist<=d.attackRange&&visible){m.state="fuse";if(m.fuse<=0)m.fuse=1.5;else m.fuse=Math.max(0,m.fuse-dt);if(m.fuse===0){for(const p of actors){const r=Math.hypot(p.p[0]-m.x,p.p[2]-m.z);if(r<4.5&&hasLineOfSight(m,p,d.height,solidAt))attacks.push({targetId:p.id,damage:Math.max(0,Math.ceil(d.damage*(1-r/4.5))),kind:"explosion"});}remove=true;}}
  else{m.state="chase";m.fuse=0;move(m,yaw,d.speed*dt,d.height,solidAt);}}
 if(m.type!=="ender_dragon") settle(m,dt,solidAt);const after=[m.x,m.y,m.z,m.yaw,m.state,m.attackAt,m.wanderYaw,m.nextThinkAt,m.fuse,m.targetId,m.dragonPhase,m.dragonOrbit];return{mob:m,attacks,projectiles,remove,changed:before.some((v,i)=>v!==after[i])};}
