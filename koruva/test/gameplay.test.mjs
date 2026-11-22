import test from "node:test";
import assert from "node:assert/strict";
import { createCraftRecipes, craftFromCounts, craftFromGrid, craftGridForRecipe, getBlockDrop, getBlockDropCount, miningTimeSeconds, resolveInitialInventory } from "../shared/gameplay.js";
const B = { AIR:0, GRASS:1, DIRT:2, STONE:3, SAND:4, LEAVES:6, WATER:12, BEDROCK:14, COBBLE:9, BRICK:10,
 OAK_PLANKS:21, SPRUCE_PLANKS:22, BIRCH_PLANKS:23, OAK_SLAB:24, STONE_SLAB:25, COBBLE_SLAB:26, BRICK_SLAB:27,
 SANDSTONE:28, OAK_STAIRS:32, STONE_STAIRS:36, COBBLE_STAIRS:40, BRICK_STAIRS:44, SANDSTONE_STAIRS:48, SPRUCE_STAIRS:52, BIRCH_STAIRS:56 };
const item = id => id;
const recipes=createCraftRecipes(B);
test("keeps the 11 legacy slab/stair recipes alongside 26.3 imports",()=>{const legacyRecipes=recipes.filter(r=>!r.id.startsWith("minecraft:"));assert.equal(legacyRecipes.length,11);assert.ok(legacyRecipes.every(r=>r.pattern.length===3&&r.grid==="3x3"));assert.ok(recipes.length>=400);});
test("survival craft consumes ingredients and grants output without mutating source",()=>{const c=Array(60).fill(0);c[B.OAK_PLANKS]=3;const r=craftFromCounts(c,"oak_slab",recipes);assert.equal(r.ok,true);assert.equal(r.counts[B.OAK_PLANKS],0);assert.equal(r.counts[B.OAK_SLAB],6);assert.equal(c[B.OAK_PLANKS],3);});
test("rejects shortages, unknown recipe, invalid inventory and stack overflow",()=>{const c=Array(60).fill(0);assert.equal(craftFromCounts(c,"oak_slab",recipes).reason,"missing_ingredients");assert.equal(craftFromCounts(c,"x",recipes).reason,"unknown_recipe");assert.equal(craftFromCounts(null,"oak_slab",recipes).reason,"invalid_inventory");c[B.OAK_PLANKS]=3;c[B.OAK_SLAB]=60;assert.equal(craftFromCounts(c,"oak_slab",recipes,{maxStack:64}).reason,"stack_limit");});
test("creative craft is free but still respects output capacity",()=>{const c=Array(60).fill(0);const r=craftFromCounts(c,"oak_slab",recipes,{creative:true,maxStack:64});assert.equal(r.ok,true);assert.equal(r.counts[B.OAK_SLAB],6);assert.equal(c[B.OAK_SLAB],0);});
test("default drops use block IDs and suppress known non-drops",()=>{assert.equal(getBlockDrop(B.GRASS,B,item),B.DIRT);assert.equal(getBlockDrop(B.STONE,B,item),B.COBBLE);for(const id of [B.AIR,B.LEAVES,B.BEDROCK,B.WATER])assert.equal(getBlockDrop(id,B,item),0);assert.equal(getBlockDrop(999,B,item),999);});


test("shaped crafting checks the 3x3 pattern and allows offset/mirror", () => {
 const counts=Array(60).fill(0); counts[B.OAK_PLANKS]=6;
 const recipe=recipes.find(r=>r.id==="oak_stairs");
 const valid=craftGridForRecipe(recipe,{rowOffset:0,colOffset:0});
 const crafted=craftFromGrid(counts,"oak_stairs",valid,recipes);
 assert.equal(crafted.ok,true); assert.equal(crafted.counts[B.OAK_PLANKS],0); assert.equal(crafted.counts[B.OAK_STAIRS],4);
 const mirrored=craftGridForRecipe(recipe,{rowOffset:0,colOffset:0,mirror:true});
 assert.equal(craftFromGrid(counts,"oak_stairs",mirrored,recipes).ok,true);
 const wrong=Array(9).fill(0); wrong[0]=B.OAK_PLANKS; wrong[1]=B.OAK_PLANKS; wrong[2]=B.OAK_PLANKS;
 assert.equal(craftFromGrid(counts,"oak_stairs",wrong,recipes).reason,"pattern_mismatch");
});

test("shaped craft rejects malformed grid and cannot overdraw duplicate ingredients", () => {
 const c=Array(60).fill(0); c[B.OAK_PLANKS]=3;
 const recipe=recipes.find(r=>r.id==="oak_slab");
 assert.equal(craftFromGrid(c,"oak_slab",[1,1],recipes).reason,"invalid_grid");
 const bad=craftFromCounts(c,"oak_slab",[{...recipe,ingredients:[{itemId:B.OAK_PLANKS,count:2},{itemId:B.OAK_PLANKS,count:2}]}]);
 assert.equal(bad.reason,"missing_ingredients");
 assert.equal(craftFromCounts([0, -1],"oak_slab",recipes).reason,"invalid_inventory");
});

test("server inventory initialization ignores untrusted non-host claims and prefers storage", () => {
 const claim=[0,0,8]; assert.deepEqual(resolveInitialInventory(undefined,claim,false),[]);
 assert.deepEqual(resolveInitialInventory(undefined,claim,true),claim);
 const stored=[0,0,2]; assert.deepEqual(resolveInitialInventory(stored,claim,false),stored);
});

test("server and client share mining timing with status effects", () => {
 assert.equal(miningTimeSeconds(B.STONE,B),1.8);
 assert.equal(miningTimeSeconds(B.BEDROCK,B),Infinity);
 assert.ok(miningTimeSeconds(B.STONE,B,[{effectId:"haste",durationTicks:20,amplifier:0}]) < 1.8);
 assert.ok(miningTimeSeconds(B.STONE,B,[{effectId:"mining_fatigue",durationTicks:20,amplifier:0}]) > 1.8);
 assert.equal(miningTimeSeconds(B.STONE,B,[],0,[],{},[],true),9);
});

test("failed multi-ingredient craft leaves inventory untouched", () => {
 const r={id:"two",name:"two",grid:"3x3",pattern:["AB"],keyedIngredients:{A:1,B:2},ingredients:[{itemId:1,count:1},{itemId:2,count:1}],output:{itemId:3,count:1}};
 const c=[0,1,0,0,0]; const failed=craftFromCounts(c,"two",[r]);
 assert.equal(failed.reason,"missing_ingredients"); assert.deepEqual(failed.counts,c); assert.deepEqual(c,[0,1,0,0,0]);
});


test("silk touch and fortune affect server-derived mining drops",()=>{
 const blocks=[]; blocks[100]={key:"minecraft:stone"}; blocks[101]={key:"minecraft:diamond_ore"}; blocks[102]={key:"minecraft:deepslate_redstone_ore"}; blocks[103]={key:"minecraft:oak_leaves"};
 const item=(id)=>id;
 assert.equal(getBlockDrop(100,B,item,{blocks,toolItemId:9,itemEnchantments:{"9":{silk_touch:1}}}),100);
 assert.equal(getBlockDrop(103,B,item,{blocks,toolItemId:9,itemEnchantments:{"9":{silk_touch:1}}}),103);
 assert.equal(getBlockDrop(103,B,item,{blocks}),0);
 assert.equal(getBlockDropCount(101,{blocks,toolItemId:9,itemEnchantments:{"9":{fortune:3}},random:()=>0.99}),3);
 assert.equal(getBlockDropCount(102,{blocks,toolItemId:9,itemEnchantments:{"9":{fortune:2}},random:()=>0.99}),6);
});

test("Efficiency is included in mining time calculation",()=>{
 const blocks=[]; blocks[B.STONE]={key:"minecraft:stone"}; blocks[90]={key:"minecraft:diamond_pickaxe"};
 const without=miningTimeSeconds(B.STONE,B,[],90,blocks,{});
 const withEfficiency=miningTimeSeconds(B.STONE,B,[],90,blocks,{"90":{efficiency:5}});
 assert.ok(withEfficiency<without);
});
