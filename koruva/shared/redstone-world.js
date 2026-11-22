import { computeRedstoneSignals, REDSTONE_DEFAULT_MAX_NODES, REDSTONE_DEFAULT_MAX_STEPS } from "./redstone.js";

const DIRECTIONS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const FACING = [[0,0,-1],[1,0,0],[0,0,1],[-1,0,0]]; // north/east/south/west
const keyOf = (x,y,z) => `${x},${y},${z}`;

/** Recalculate the connected redstone component. Connectivity is six-face adjacency, not full Java Edition dust geometry. */
export function nextRepeaterDelayBlockId(blockId, repeaterIds) {
  if (!Number.isSafeInteger(blockId)) throw new TypeError("repeater block id must be a safe integer");
  if (!Array.isArray(repeaterIds) || ![4, 16].includes(repeaterIds.length) || !repeaterIds.every(Number.isSafeInteger) || new Set(repeaterIds).size !== repeaterIds.length) {
    throw new TypeError("repeaterIds must contain four or sixteen distinct safe integer ids");
  }
  const index = repeaterIds.indexOf(blockId);
  if (index < 0) return undefined;
  const groups = repeaterIds.length / 4;
  const facing = index % 4;
  const nextGroup = (Math.floor(index / 4) + 1) % groups;
  return repeaterIds[nextGroup * 4 + facing];
}

export function evaluateRedstoneWorld({ x, y, z, blockAt, ids, maxNodes = REDSTONE_DEFAULT_MAX_NODES, maxSteps = REDSTONE_DEFAULT_MAX_STEPS, repeaterOutputAt }) {
  if (![x,y,z].every(Number.isSafeInteger)) throw new TypeError("redstone origin must use safe integer coordinates");
  if (typeof blockAt !== "function") throw new TypeError("blockAt must be a function");
  const repeaters = ids?.repeaters ?? [];
  const signalBlockIds = ids ? [ids.source,ids.wire,ids.lampOff,ids.lampOn,...(ids.leverOn === undefined ? [] : [ids.leverOn]),...repeaters] : [];
  if (!ids || !signalBlockIds.every(Number.isSafeInteger) || new Set(signalBlockIds).size !== signalBlockIds.length ||
      (ids.repeaters !== undefined && (!Array.isArray(ids.repeaters) || ![4, 16].includes(ids.repeaters.length)))) {
    throw new TypeError("redstone block ids must be distinct integers and repeaters must be ordered north/east/south/west");
  }
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1 || !Number.isSafeInteger(maxSteps) || maxSteps < 1) throw new RangeError("redstone limits must be positive safe integers");
  const repeaterFacing = new Map(repeaters.map((blockId, index) => [blockId, { facing: index % 4, delayTicks: Math.floor(index / 4) + 1 }]));
  const queue=[]; const queued=new Set(); const devices=new Map();
  const enqueue=(p)=>{const k=keyOf(...p);if(!queued.has(k)){queued.add(k);queue.push(p);}};
  enqueue([x,y,z]); for(const [dx,dy,dz] of DIRECTIONS) enqueue([x+dx,y+dy,z+dz]);
  for(let head=0;head<queue.length;head++){
    const [cx,cy,cz]=queue[head], k=keyOf(cx,cy,cz), block=blockAt(cx,cy,cz);
    const kind=(block===ids.source||block===ids.leverOn)?"source":block===ids.wire?"wire":(block===ids.lampOff||block===ids.lampOn)?"consumer":repeaterFacing.has(block)?"repeater":null;
    if(!kind||devices.has(k))continue;
    if(devices.size>=maxNodes)return {bounded:false,reason:"node-limit",nodeCount:devices.size};
    const repeater = repeaterFacing.get(block);
    devices.set(k,{id:k,x:cx,y:cy,z:cz,block,kind,facing:repeater?.facing,delayTicks:repeater?.delayTicks});
    for(const [dx,dy,dz] of DIRECTIONS)enqueue([cx+dx,cy+dy,cz+dz]);
  }

  const levels=new Map([...devices.values()].map(n=>[n.id,n.kind==="source"?15:0]));
  const repeaterInputs=new Map();
  for(const n of devices.values()) if(n.kind==="repeater"){
    const [fx,fy,fz]=FACING[n.facing], inputKey=keyOf(n.x-fx,n.y-fy,n.z-fz);
    if(!repeaterInputs.has(inputKey))repeaterInputs.set(inputKey,[]);
    repeaterInputs.get(inputKey).push(n);
  }
  let steps=0; const wireQueue=[]; let wireHead=0;
  const step=()=>{if(++steps>maxSteps)throw new RangeError("redstone propagation step limit exceeded");};
  const setWire=(id,signal)=>{
    const n=devices.get(id);
    if(n?.kind!=="wire"||signal<=levels.get(id))return;
    levels.set(id,signal);wireQueue.push({id,signal});
  };
  const activeRepeaters=new Set(), inputRepeaters=new Set();
  const activate=(n)=>{
    if(!n||n.kind!=="repeater")return;
    inputRepeaters.add(n.id);
    const outputPowered = typeof repeaterOutputAt === "function" ? repeaterOutputAt(n.x,n.y,n.z) === true : true;
    if(!outputPowered||activeRepeaters.has(n.id))return;
    step();activeRepeaters.add(n.id);levels.set(n.id,15);
    const [fx,fy,fz]=FACING[n.facing], ox=n.x+fx, oy=n.y+fy, oz=n.z+fz, target=devices.get(keyOf(ox,oy,oz));
    if(target?.kind==="wire")setWire(target.id,15);
    if(target?.kind==="repeater"){
      const [tx,ty,tz]=FACING[target.facing];
      if(target.x-tx===n.x&&target.y-ty===n.y&&target.z-tz===n.z)activate(target);
    }
  };
  // Direct power sources seed adjacent dust and only power a repeater from its rear input.
  for(const n of devices.values()) if(n.kind==="source"){
    for(const [dx,dy,dz] of DIRECTIONS){step();const target=devices.get(keyOf(n.x+dx,n.y+dy,n.z+dz));if(target?.kind==="wire")setWire(target.id,15);}
    for(const r of repeaterInputs.get(n.id)??[])activate(r);
  }
  while(wireHead<wireQueue.length){
    const {id,signal}=wireQueue[wireHead++], n=devices.get(id), next=signal-1;
    for(const [dx,dy,dz] of DIRECTIONS){
      step();const neighbor=devices.get(keyOf(n.x+dx,n.y+dy,n.z+dz));
      if(neighbor?.kind==="wire"&&next>0)setWire(neighbor.id,next);
    }
    if(signal>0)for(const r of repeaterInputs.get(id)??[])activate(r);
  }
  const signals=[...devices.values()].map(n=>{
    let signal=levels.get(n.id)??0;
    if(n.kind==="consumer"){
      signal=0;
      for(const [dx,dy,dz] of DIRECTIONS){
        step();const neighbor=devices.get(keyOf(n.x+dx,n.y+dy,n.z+dz));
        if(neighbor?.kind==="source")signal=Math.max(signal,15);
        else if(neighbor?.kind==="wire")signal=Math.max(signal,levels.get(neighbor.id)??0);
        else if(neighbor?.kind==="repeater"){
          const [fx,fy,fz]=FACING[neighbor.facing];
          if(neighbor.x+fx===n.x&&neighbor.y+fy===n.y&&neighbor.z+fz===n.z&&activeRepeaters.has(neighbor.id))signal=15;
        }
      }
    }
    return {x:n.x,y:n.y,z:n.z,signal};
  });
  const signalByKey=new Map(signals.map(c=>[keyOf(c.x,c.y,c.z),c.signal]));
  const lampChanges=[...devices.values()].filter(n=>n.kind==="consumer").flatMap(n=>{const signal=signalByKey.get(n.id)??0,to=signal>0?ids.lampOn:ids.lampOff;return n.block===to?[]:[{x:n.x,y:n.y,z:n.z,from:n.block,to,signal}];});
  const repeaterInputStates=[...devices.values()].filter(n=>n.kind==="repeater").map(n=>({x:n.x,y:n.y,z:n.z,powered:inputRepeaters.has(n.id),delayTicks:n.delayTicks}));
  return {bounded:true,nodeCount:devices.size,signals,lampChanges,repeaterInputs:repeaterInputStates};
}
