import test from "node:test";
import assert from "node:assert/strict";
import { createCraftRecipes, craftFromGrid, craftGridForRecipe } from "../shared/gameplay.js";
import { MINECRAFT_BLOCK_TO_RUNTIME_ID } from "../shared/minecraft-block-runtime.js";
import { MINECRAFT_ITEM_RUNTIME_ID_END, MINECRAFT_ITEM_TO_RUNTIME_ID } from "../shared/minecraft-item-runtime.js";
import { MINECRAFT_26_3_CRAFTING_SHAPED_SOURCE } from "../shared/minecraft-26.3-crafting-shaped-source.js";
import { MINECRAFT_26_3_CRAFTING_RECIPES } from "../shared/minecraft-26.3-recipe-catalog.js";
const recipes=createCraftRecipes({}); const imported=recipes.filter(r=>r.id.startsWith("minecraft:")&&r.shapeless!==true); const byId=new Map(recipes.map(r=>[r.id,r]));
test("imports supported Java 26.3 shaped item recipes",()=>{
 assert.ok(imported.length>=400); assert.equal(imported.length,MINECRAFT_26_3_CRAFTING_RECIPES.filter(r=>r.shapeless!==true).length + Object.keys(MINECRAFT_ITEM_TO_RUNTIME_ID).filter(key=>key.endsWith("_planks")).length); assert.equal(byId.size,recipes.length);
 for(const r of imported){assert.ok(r.ingredients.length>0,r.id);assert.ok(Number.isInteger(r.output.itemId)&&r.output.itemId>0&&r.output.itemId<=MINECRAFT_ITEM_RUNTIME_ID_END,r.id);assert.ok(r.ingredients.every(x=>Number.isInteger(x.itemId)&&x.itemId>0&&x.itemId<=MINECRAFT_ITEM_RUNTIME_ID_END&&x.count>0),r.id);assert.equal(craftGridForRecipe(r).length,9,r.id);}
});
test("includes all 64 wool/concrete stair and slab recipes",()=>{
 const colors=["white","orange","magenta","light_blue","yellow","lime","pink","gray","light_gray","cyan","purple","blue","brown","green","red","black"];let count=0;
 for(const c of colors)for(const m of ["wool","concrete"])for(const shape of ["stairs","slab"]){const id=`minecraft:${c}_${m}_${shape}`;const r=byId.get(id);assert.ok(r,id);assert.equal(r.output.itemId,MINECRAFT_BLOCK_TO_RUNTIME_ID[id]);assert.equal(r.output.count,shape==="stairs"?4:6);assert.deepEqual(r.pattern,shape==="stairs"?["#  ","## ","###"]:["###"]);assert.deepEqual(r.ingredients,[{itemId:MINECRAFT_BLOCK_TO_RUNTIME_ID[`minecraft:${c}_${m}`],count:shape==="stairs"?6:3}]);count++;}
 assert.equal(count,64);
});
test("wool stair crafting consumes six wool blocks and grants four stairs",()=>{
 const r=byId.get("minecraft:white_wool_stairs");const input=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:white_wool"];const output=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:white_wool_stairs"];const counts=Array(MINECRAFT_ITEM_RUNTIME_ID_END+1).fill(0);counts[input]=6;
 const made=craftFromGrid(counts,r.id,craftGridForRecipe(r),recipes);assert.equal(made.ok,true);assert.equal(made.counts[input],0);assert.equal(made.counts[output],4);
});
test("poplar slab and straw bed recipes are included from the attached data",()=>{assert.ok(byId.has("minecraft:poplar_slab"));assert.ok(byId.has("minecraft:straw_bed"));});
