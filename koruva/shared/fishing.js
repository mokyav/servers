/** Fishing timings and loot rules based on the 26.3 fishing loot-table structure. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Math.floor(Number(v)||0)));
const chooseEntry=(entries,random)=>{
  const total=entries.reduce((sum,item)=>sum+Math.max(0,item.weight),0);
  if(total<=0)return entries[0]??{key:"cod"};
  let roll=Math.max(0,Math.min(.999999,Number(random())||0))*total;
  for(const item of entries){roll-=Math.max(0,item.weight);if(roll<0)return item;}
  return entries.at(-1)??{key:"cod"};
};

export function fishingBiteDelay(lureLevel=0, random=Math.random) {
  const lure=clamp(lureLevel,0,3);
  const base=5000+Math.floor(Math.max(0,Math.min(.999999,Number(random())||0))*25001);
  return Math.max(1000,base-lure*5000);
}

/**
 * The hook must be in a 5x4x5 open-water volume for treasure loot to enter the pool.
 * getBlock returns 0 for air, one of waterIds for water, or another runtime block id.
 */
export function isFishingOpenWater(getBlock,x,y,z,waterIds=[8,9]) {
  if(typeof getBlock!=="function")return false;
  const water=new Set(waterIds.filter(Number.isSafeInteger));
  if(!water.has(getBlock(x,y,z)))return false;
  for(let dy=-1;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) for(let dz=-2;dz<=2;dz++){
    const id=getBlock(x+dx,y+dy,z+dz);
    if(id!==0&&!water.has(id))return false;
  }
  return true;
}

const FISH=[
  {key:"cod",weight:60},{key:"salmon",weight:25},{key:"tropical_fish",weight:2},{key:"pufferfish",weight:13},
];
const JUNK=[
  {key:"lily_pad",weight:17},{key:"leather_boots",weight:10},{key:"leather",weight:10},
  {key:"bone",weight:10},{key:"potion",weight:10},{key:"string",weight:5},
  {key:"fishing_rod",weight:2},{key:"bowl",weight:10},{key:"stick",weight:5},
  {key:"ink_sac",weight:1,count:10},{key:"tripwire_hook",weight:10},{key:"rotten_flesh",weight:10},
];
const TREASURE=[
  {key:"name_tag",weight:1},{key:"saddle",weight:1},{key:"bow",weight:1,enchanted:true},
  {key:"fishing_rod",weight:1,enchanted:true},{key:"enchanted_book",weight:1,enchanted:true},{key:"nautilus_shell",weight:1},
];

export function rollFishingLootEntry(luckLevel=0,random=Math.random,{openWater=true,biome=""}={}){
  const luck=clamp(luckLevel,0,3),rng=typeof random==="function"?random:Math.random;
  // 26.3 loot table: junk 10/-2, treasure 5/+2 (open water only), fish 85/-1.
  const categories=[
    {key:"junk",weight:Math.max(0,10-2*luck)},
    {key:"treasure",weight:openWater?5+2*luck:0},
    {key:"fish",weight:Math.max(1,85-luck)},
  ];
  const category=chooseEntry(categories,rng).key;
  if(category==="treasure"){
    const entry=chooseEntry(TREASURE,rng);
    return {itemKey:entry.key,count:1,category,enchanted:!!entry.enchanted,damage:entry.key==="bow"||entry.key==="fishing_rod"?Math.floor(rng()*.25*64):0};
  }
  if(category==="junk"){
    const pool=biome.includes("jungle")?[...JUNK,{key:"bamboo",weight:10}]:JUNK;
    const entry=chooseEntry(pool,rng);
    return {itemKey:entry.key,count:entry.count??1,category,damage:entry.key==="leather_boots"||entry.key==="fishing_rod"?Math.floor(rng()*.9*64):0};
  }
  const fish=chooseEntry(FISH,rng).key;
  return {itemKey:fish,count:1,category,damage:0};
}

export function rollFishingLoot(luckLevel=0,random=Math.random,options={}) {
  return rollFishingLootEntry(luckLevel,random,options).itemKey;
}
