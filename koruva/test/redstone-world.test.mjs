import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateRedstoneWorld, nextRepeaterDelayBlockId } from "../shared/redstone-world.js";
const ids={source:70,wire:71,lampOff:72,lampOn:73};
const key=(x,y,z)=>`${x},${y},${z}`;
function world(entries){const map=new Map(entries.map(([x,y,z,b])=>[key(x,y,z),b]));return(x,y,z)=>map.get(key(x,y,z))??0;}
test("redstone block powers a lamp through attenuating dust and source removal turns it off",()=>{
 const powered=world([[0,5,0,ids.source],[1,5,0,ids.wire],[2,5,0,ids.wire],[3,5,0,ids.lampOff]]);
 const on=evaluateRedstoneWorld({x:0,y:5,z:0,blockAt:powered,ids});
 assert.equal(on.bounded,true);assert.deepEqual(on.lampChanges,[{x:3,y:5,z:0,from:ids.lampOff,to:ids.lampOn,signal:14}]);
 const unpowered=world([[1,5,0,ids.wire],[2,5,0,ids.wire],[3,5,0,ids.lampOn]]);
 const off=evaluateRedstoneWorld({x:0,y:5,z:0,blockAt:unpowered,ids});
 assert.deepEqual(off.lampChanges,[{x:3,y:5,z:0,from:ids.lampOn,to:ids.lampOff,signal:0}]);
});
test("redstone world walk is bounded and never returns partial lamp changes",()=>{
 const line=world([[0,2,0,ids.source],[1,2,0,ids.wire],[2,2,0,ids.wire],[3,2,0,ids.lampOff]]);
 assert.deepEqual(evaluateRedstoneWorld({x:0,y:2,z:0,blockAt:line,ids,maxNodes:2}),{bounded:false,reason:"node-limit",nodeCount:2});
});
test("Worker recalculates after edits, persists derived lamp state, and broadcasts it",()=>{
 const room=readFileSync(new URL("../src/worker/room.ts",import.meta.url),"utf8"), blocks=readFileSync(new URL("../shared/blocks.ts",import.meta.url),"utf8");
 assert.match(room,/import \{[^}]*\bevaluateRedstoneWorld\b[^}]*\} from "\.\.\/\.\.\/shared\/redstone-world\.js"/);
  assert.match(room,/await this\.updateRedstoneAt\(x, y, z, me\.dimensionId\)/);
  assert.match(room,/this\.applyEdit\(change\.x, change\.y, change\.z, change\.to, id\)/);
  assert.match(room,/this\.broadcastDimension\(\{ t: "set", x: change\.x, y: change\.y, z: change\.z, b: change\.to \}, id\)/);
 assert.match(blocks,/REDSTONE_BLOCK: 70, REDSTONE_DUST: 71, REDSTONE_LAMP_OFF: 72, REDSTONE_LAMP_ON: 73/);
});

test("an enabled lever is a full-strength source for the connected circuit",()=>{
 const leverIds={...ids,leverOn:75};
 const map=world([[0,4,0,leverIds.leverOn],[1,4,0,ids.wire],[2,4,0,ids.lampOff]]);
 const result=evaluateRedstoneWorld({x:0,y:4,z:0,blockAt:map,ids:leverIds});
 assert.equal(result.bounded,true);
 assert.deepEqual(result.lampChanges,[{x:2,y:4,z:0,from:ids.lampOff,to:ids.lampOn,signal:15}]);
});


test("directional repeater powers only its forward output and restores signal to 15",()=>{
 const repeaterIds={...ids,repeaters:[76,77,78,79]};
 // North-facing repeater: source at rear (south), lamp at front (north), side lamp remains off.
 const map=world([[0,4,1,ids.source],[0,4,0,76],[0,4,-1,ids.lampOff],[1,4,0,ids.lampOff]]);
 const result=evaluateRedstoneWorld({x:0,y:4, z:0,blockAt:map,ids:repeaterIds});
 assert.equal(result.bounded,true);
 assert.deepEqual(result.lampChanges,[{x:0,y:4,z:-1,from:ids.lampOff,to:ids.lampOn,signal:15}]);
 assert.equal(result.signals.find(c=>c.x===0&&c.y===4&&c.z===0).signal,15);
});

test("repeater output can activate a correctly aligned repeater chain",()=>{
 const repeaterIds={...ids,repeaters:[76,77,78,79]};
 const map=world([[0,4,2,ids.source],[0,4,1,76],[0,4,0,76],[0,4,-1,ids.lampOff]]);
 const result=evaluateRedstoneWorld({x:0,y:4,z:1,blockAt:map,ids:repeaterIds});
 assert.equal(result.bounded,true);
 assert.deepEqual(result.lampChanges,[{x:0,y:4,z:-1,from:ids.lampOff,to:ids.lampOn,signal:15}]);
});

test("a repeater is not powered from its output/front side",()=>{
 const repeaterIds={...ids,repeaters:[76,77,78,79]};
 const map=world([[0,4,-1,ids.source],[0,4,0,76],[0,4,1,ids.lampOff]]);
 const result=evaluateRedstoneWorld({x:0,y:4,z:0,blockAt:map,ids:repeaterIds});
 assert.equal(result.bounded,true);
 assert.equal(result.signals.find(c=>c.x===0&&c.y===4&&c.z===0).signal,0);
});

test("stateful repeater output waits for transition and then powers lamp",()=>{
 const repeaterIds={...ids,repeaters:[76,77,78,79]}, map=world([[0,4,1,ids.source],[0,4,0,76],[0,4,-1,ids.lampOff]]);
 const waiting=evaluateRedstoneWorld({x:0,y:4,z:0,blockAt:map,ids:repeaterIds,repeaterOutputAt:()=>false});
 assert.deepEqual(waiting.lampChanges,[]); assert.deepEqual(waiting.repeaterInputs,[{x:0,y:4,z:0,powered:true,delayTicks:1}]);
 const applied=evaluateRedstoneWorld({x:0,y:4,z:0,blockAt:map,ids:repeaterIds,repeaterOutputAt:()=>true});
 assert.deepEqual(applied.lampChanges,[{x:0,y:4,z:-1,from:ids.lampOff,to:ids.lampOn,signal:15}]);
});

test("repeater delay variants report 1-4 ticks and cycle without changing facing",()=>{
 const repeaterIds=Array.from({length:16},(_,i)=>76+i);
 const map=world([[0,4,1,ids.source],[0,4,0,88],[0,4,-1,ids.lampOff]]);
 const result=evaluateRedstoneWorld({x:0,y:4,z:0,blockAt:map,ids:{...ids,repeaters:repeaterIds},repeaterOutputAt:()=>false});
 assert.deepEqual(result.repeaterInputs,[{x:0,y:4,z:0,powered:true,delayTicks:4}]);
 assert.equal(nextRepeaterDelayBlockId(79,repeaterIds),83);
 assert.equal(nextRepeaterDelayBlockId(83,repeaterIds),87);
 assert.equal(nextRepeaterDelayBlockId(87,repeaterIds),91);
 assert.equal(nextRepeaterDelayBlockId(91,repeaterIds),79);
 assert.equal(nextRepeaterDelayBlockId(99,repeaterIds),undefined);
});

test("Worker advances and persists repeaters from Durable Object alarm",()=>{
 const room=readFileSync(new URL("../src/worker/room.ts",import.meta.url),"utf8");
  assert.match(room,/createRepeaterDelayController/); assert.match(room,/delay\.advance\(delay\.tick \+ 1\)/);
  assert.match(room,/repeaterOutputAt:/); assert.match(room,/delay\.schedule\(/); assert.match(room,/redstone-states/);
  assert.match(room,/if \(online\.length \|\| this\.hasPendingRepeaterTicks\(\) \|\| this\.frostedBlocks\.size\)/);
});


test("online repeater queues and lamp updates are isolated by dimension",() => {
  const room=readFileSync(new URL("../src/worker/room.ts",import.meta.url),"utf8");
  assert.match(room,/private repeaterDelays = new Map/);
  assert.match(room,/private repeaterDelayForDimension\(dimensionId: string\)/);
  assert.match(room,/this\.blockAt\(bx, by, bz, id\)/);
  assert.match(room,/updateRedstoneAt\(coords\[0\], coords\[1\], coords\[2\], dimensionId\)/);
  assert.match(room,/broadcastDimension\(\{ t: "set", x: change\.x, y: change\.y, z: change\.z, b: change\.to \}, id\)/);
  assert.match(room,/legacyRedstoneSnapshot/);
});
