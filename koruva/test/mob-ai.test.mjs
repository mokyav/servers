import test from "node:test";import assert from "node:assert/strict";import{createMob,MOB_PROFILES,stepMobAI}from"../shared/mob-ai.js";
const ground=(x,y,z)=>y<10;const player=(id,x,y=10,z=0,gameMode="survival")=>({id,p:[x,y,z],gameMode});
test("data-driven defaults and unknown type rejection",()=>{assert.equal(createMob("pig","p",1,10,2).health,MOB_PROFILES.pig.maxHealth);assert.throws(()=>createMob("dragon","x",0,1,0),/unknown mob/);});
test("zombie targets nearest survival player, moves, then attacks with cooldown",()=>{const m=createMob("zombie","z",0,10,0),ps=[player("far",9),player("near",4)];const chase=stepMobAI(m,ps,.2,1000,ground);assert.equal(chase.mob.targetId,"near");assert.equal(chase.mob.state,"chase");assert.ok(chase.mob.x>0);const hit=stepMobAI({...chase.mob,x:0,z:0},[player("near",1)],.2,2000,ground);assert.equal(hit.attacks[0]?.targetId,"near");assert.equal(stepMobAI(hit.mob,[player("near",1)],.2,2500,ground).attacks.length,0);});
test("hostile AI ignores creative, spectator, and dead players",()=>{const r=stepMobAI(createMob("zombie","z",0,10,0),[{...player("c",1,10,0,"creative")},{...player("s",2),dead:true}],.2,1000,ground);assert.equal(r.mob.targetId,undefined);assert.notEqual(r.mob.state,"chase");});
test("skeleton maintains range and emits a physical arrow projectile with cooldown",()=>{const r=stepMobAI(createMob("skeleton","s",0,10,0),[player("p",8)],.2,1000,ground);assert.equal(r.mob.state,"attack");assert.equal(r.attacks.length,0);assert.equal(r.projectiles[0]?.type,"arrow");assert.ok(r.projectiles[0].vx>0);assert.ok(r.projectiles[0].vy>0,"same-height target gets an upward ballistic arc");assert.ok(Math.hypot(r.projectiles[0].vx,r.projectiles[0].vy,r.projectiles[0].vz)>20);assert.equal(stepMobAI(r.mob,[player("p",8)],.2,1500,ground).projectiles.length,0);});
test("creeper fuse starts, cancels after escape, and explodes once",()=>{const m=createMob("creeper","c",0,10,0),near=player("p",2),a=stepMobAI(m,[near],.2,1000,ground);assert.equal(a.mob.state,"fuse");assert.ok(a.mob.fuse>1.2);assert.equal(stepMobAI(a.mob,[player("p",10)],.2,1200,ground).mob.fuse,0);const boom=stepMobAI({...m,fuse:.1},[near],.2,2000,ground);assert.equal(boom.remove,true);assert.ok(boom.attacks.some(x=>x.targetId==="p"&&x.kind==="explosion"));});
test("block collision stops movement and oversized timestep is clamped",()=>{const blocked=(x,y,z)=>y<10||x>=1;const r=stepMobAI({...createMob("zombie","z",.9,10,0)},[player("p",10)],5,1000,blocked);assert.ok(r.mob.x<1);assert.ok(Number.isFinite(r.mob.y));});
test("passive wandering is deterministic for the same saved state and time",()=>{const m=createMob("pig","p",0,10,0),a=stepMobAI(m,[],.2,5000,ground),b=stepMobAI(m,[],.2,5000,ground);assert.deepEqual(a.mob,b.mob);});

test("melee mobs cannot hit through a solid block",()=>{const wall=(x,y,z)=>x===1&&y>=10;const r=stepMobAI(createMob("zombie","z",0,10,0),[player("p",1.4)],.2,1000,wall);assert.deepEqual(r.attacks,[]);assert.equal(r.mob.state,"chase");});
test("skeleton arrows are not spawned through a solid block",()=>{const wall=(x,y,z)=>x===1&&y>=10;const r=stepMobAI(createMob("skeleton","s",0,10,0),[player("p",8)],.2,1000,wall);assert.deepEqual(r.attacks,[]);assert.deepEqual(r.projectiles,[]);assert.equal(r.mob.state,"chase");});
test("creeper fuse cancels when a block occludes its target",()=>{const wall=(x,y,z)=>x===1&&y>=10;const m={...createMob("creeper","c",0,10,0),fuse:.5};const r=stepMobAI(m,[player("p",2)],.2,1000,wall);assert.equal(r.mob.fuse,0);assert.equal(r.mob.state,"chase");assert.deepEqual(r.attacks,[]);});
test("creeper blast damages only players with a clear ray",()=>{const wall=(x,y,z)=>x===1&&y>=10;const m={...createMob("creeper","c",0,10,0),fuse:.1};const ps=[player("blocked",2),player("clear",0,10,1.5)];const r=stepMobAI(m,ps,.2,1000,wall);assert.equal(r.remove,true);assert.deepEqual(r.attacks.map(a=>a.targetId),["clear"]);});

test("passive mobs flee away from the hit direction for a short duration", () => {
  const m = { ...createMob("pig", "pig-flee", 0, 10, 0), state: "flee", fleeYaw: Math.PI / 2, fleeUntil: 5000 };
  const r = stepMobAI(m, [], 0.2, 1000, ground);
  assert.equal(r.mob.state, "flee");
  assert.ok(r.mob.x > m.x);
  assert.equal(r.mob.fleeUntil, 5000);
  assert.deepEqual(r.attacks, []);
});

test("passive flee expires and returns to idle or wandering", () => {
  const m = { ...createMob("pig", "pig-flee-expired", 0, 10, 0), state: "flee", fleeYaw: Math.PI / 2, fleeUntil: 5000 };
  const r = stepMobAI(m, [], 0.2, 5000, ground);
  assert.equal(r.mob.fleeUntil, 0);
  assert.notEqual(r.mob.state, "flee");
});


test("Ender Dragon circles in the air and launches a server projectile",()=>{
  const dragon={...createMob("ender_dragon","dragon-test",0,58,0),dragonPhase:"strafe",nextThinkAt:999999,attackAt:0};
  const result=stepMobAI(dragon,[player("target",8,10,0)],.2,2000,()=>false);
  assert.ok(result.mob.y>20,"dragon remains airborne instead of settling onto the ground");
  assert.equal(result.projectiles[0]?.type,"dragon_fireball");
  assert.equal(result.attacks.length,0);
  assert.ok(Math.hypot(result.projectiles[0].vx,result.projectiles[0].vy,result.projectiles[0].vz)>14);
});

test("Ender Dragon swoop emits melee damage only when it reaches the player",()=>{
  const dragon={...createMob("ender_dragon","dragon-swoop",0,12,0),dragonPhase:"swoop",nextThinkAt:999999,attackAt:0};
  const result=stepMobAI(dragon,[player("target",2,10,0)],.2,2000,()=>false);
  assert.ok(result.attacks.some(a=>a.targetId==="target"&&a.kind==="melee"));
  assert.equal(result.mob.dragonPhase,"circle");
});
