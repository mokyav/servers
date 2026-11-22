const TOOL_DURABILITY = Object.freeze({ wooden: 59, stone: 131, copper: 190, iron: 250, golden: 32, diamond: 1561, netherite: 2031 });
const ARMOR_DURABILITY = Object.freeze({
  leather: [55, 80, 75, 65], chainmail: [165, 240, 225, 195], iron: [165, 240, 225, 195],
  golden: [77, 112, 105, 91], diamond: [363, 528, 495, 429], netherite: [407, 592, 555, 481],
});
export function maxDurabilityForItemKey(rawKey) {
  const key=String(rawKey??"").replace(/^minecraft:/,"");
  if(key==="elytra") return 432;
  if(key==="bow") return 384;
  if(key==="crossbow") return 465;
  if(key==="trident") return 250;
  if(key==="shield") return 336;
  if(key==="fishing_rod") return 64;
  if(key==="flint_and_steel") return 64;
  if(key==="shears") return 238;
  if(key==="brush") return 64;
  if(key==="mace") return 500;
  if(key==="turtle_helmet") return 275;
  const armor=key.match(/^(leather|chainmail|iron|golden|diamond|netherite)_(helmet|chestplate|leggings|boots)$/);
  if(armor) return ARMOR_DURABILITY[armor[1]][({helmet:0,chestplate:1,leggings:2,boots:3})[armor[2]]];
  const tool=key.match(/^(wooden|stone|copper|iron|golden|diamond|netherite)_(?:sword|pickaxe|axe|shovel|hoe|spear)$/);
  if(tool) return TOOL_DURABILITY[tool[1]];
  if(key==="carrot_on_a_stick") return 25;
  if(key==="warped_fungus_on_a_stick") return 100;
  return 0;
}
export function shouldApplyDurabilityDamage(unbreakingLevel=0, random=Math.random) {
  const level=Math.max(0,Math.min(3,Math.floor(Number(unbreakingLevel)||0)));
  return random() < 1/(level+1);
}
export function damageStackRecord(record, amount=1, maxDamage=0) {
  if(!record || !maxDamage || amount<=0) return { record, broken:false };
  const damage=Math.max(0,Math.floor(Number(record.damage)||0)+Math.floor(amount));
  if(damage>=maxDamage) return { record:null, broken:true };
  return { record:{...record,damage},broken:false };
}
export function repairStackRecord(record, xpPoints=0) {
  if(!record) return {record:null,xpUsed:0,repaired:0};
  const damage=Math.max(0,Math.floor(Number(record.damage)||0));
  const repaired=Math.min(damage,Math.floor(Math.max(0,xpPoints)/2));
  return {record:{...record,damage:damage-repaired},xpUsed:repaired*2,repaired};
}
export function repairMaterialValue(itemKey, materialKey, maxDamage) {
  const item=String(itemKey??"").replace(/^minecraft:/,"");
  const material=String(materialKey??"").replace(/^minecraft:/,"");
  if(!maxDamage) return 0;
  let allowed=false;
  const armor=item.match(/^(leather|chainmail|iron|golden|diamond|netherite)_/);
  const tool=item.match(/^(wooden|stone|copper|iron|golden|diamond|netherite)_/);
  if(armor) {
    const expected={leather:"leather",chainmail:"iron_ingot",iron:"iron_ingot",golden:"gold_ingot",diamond:"diamond",netherite:"netherite_ingot"}[armor[1]];
    allowed=material===expected;
  } else if(tool) {
    const expected={wooden:"planks",stone:"cobblestone",copper:"copper_ingot",iron:"iron_ingot",golden:"gold_ingot",diamond:"diamond",netherite:"netherite_ingot"}[tool[1]];
    allowed=material===expected || (expected==="planks" && material.endsWith("_planks"));
  }
  if(item==="bow"||item==="crossbow") allowed=material==="string";
  return allowed?Math.max(1,Math.floor(maxDamage*0.25)):0;
}
