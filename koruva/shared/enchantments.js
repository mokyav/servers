/**
 * Runtime enchantment rules for the Minecraft Java 26.3 source pack.
 * The complete source definitions are bundled under data/minecraft/enchantment/.
 * Koruva's current aggregate inventory stores these by item type, not unique stack.
 */
export const ENCHANTMENT_MAX_LEVEL = Object.freeze({
  aqua_affinity:1,bane_of_arthropods:5,binding_curse:1,blast_protection:4,breach:4,
  channeling:1,density:5,depth_strider:3,efficiency:5,feather_falling:4,fire_aspect:2,
  fire_protection:4,flame:1,fortune:3,frost_walker:2,impaling:5,infinity:1,knockback:2,
  looting:3,loyalty:3,luck_of_the_sea:3,lure:3,mending:1,multishot:1,piercing:4,
  power:5,projectile_protection:4,protection:4,punch:2,quick_charge:3,respiration:3,
  riptide:3,sharpness:5,silk_touch:1,smite:5,soul_speed:3,swift_sneak:3,sweeping_edge:3,
  thorns:3,unbreaking:3,vanishing_curse:1,wind_burst:3,lunge:3,
});
export const ENCHANTMENT_IDS = Object.freeze(Object.keys(ENCHANTMENT_MAX_LEVEL));
export const ENCHANTMENT_LABELS = Object.freeze({
  aqua_affinity:"水中採掘",bane_of_arthropods:"虫殺し",binding_curse:"束縛の呪い",blast_protection:"爆発耐性",breach:"防具貫通",
  channeling:"召雷",density:"重撃",depth_strider:"水中歩行",efficiency:"効率強化",feather_falling:"落下耐性",fire_aspect:"火属性",
  fire_protection:"火炎耐性",flame:"フレイム",fortune:"幸運",frost_walker:"氷渡り",impaling:"水生特効",infinity:"無限",knockback:"ノックバック",
  looting:"ドロップ増加",loyalty:"忠誠",luck_of_the_sea:"宝釣り",lure:"入れ食い",mending:"修繕",multishot:"マルチショット",piercing:"貫通",
  power:"射撃ダメージ増加",projectile_protection:"飛び道具耐性",protection:"ダメージ軽減",punch:"パンチ",quick_charge:"高速装填",respiration:"水中呼吸",
  riptide:"激流",sharpness:"ダメージ増加",silk_touch:"シルクタッチ",smite:"アンデッド特効",soul_speed:"ソウルスピード",swift_sneak:"スニーク速度上昇",sweeping_edge:"範囲ダメージ増加",
  thorns:"棘の鎧",unbreaking:"耐久力",vanishing_curse:"消滅の呪い",wind_burst:"ウィンドバースト",lunge:"突進",
});
const idOf=(key)=>String(key??"").replace(/^minecraft:/,"").toLowerCase();
const itemKey=(itemId,blocks)=>idOf(blocks?.[itemId]?.key);
const has=(key,re)=>re.test(key);

export function normalizeItemEnchantments(raw, blocks, maxItems=blocks?.length??10000) {
  const out={};
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) return out;
  for(const [rawId,entries] of Object.entries(raw)) {
    const id=Number(rawId);
    if(!Number.isInteger(id)||id<=0||id>=maxItems||!entries||typeof entries!=="object"||Array.isArray(entries)) continue;
    const normalized={};
    for(const [rawName,rawLevel] of Object.entries(entries)) {
      const name=idOf(rawName), max=ENCHANTMENT_MAX_LEVEL[name];
      const level=Number(rawLevel);
      if(max && Number.isInteger(level)&&level>=1&&level<=max && isEnchantmentCompatible(name,id,blocks)) normalized[name]=level;
    }
    const names=Object.keys(normalized);
    for(let i=0;i<names.length;i++) for(let j=i+1;j<names.length;j++) if(!areEnchantmentsCompatible(names[i],names[j])) { delete normalized[names[j]]; }
    if(Object.keys(normalized).length) out[String(id)]=normalized;
  }
  return out;
}

export function isEnchantmentCompatible(enchantId,itemId,blocks) {
  const e=idOf(enchantId), k=itemKey(itemId,blocks);
  if(!ENCHANTMENT_MAX_LEVEL[e]||!k) return false;
  const enchantedBook=k.endsWith(":enchanted_book")||k==="enchanted_book";
  if(enchantedBook) return true;
  const sword=has(k,/(?:^|_)(?:wooden|stone|copper|iron|golden|diamond|netherite)_sword$/);
  const axe=has(k,/(?:^|_)(?:wooden|stone|copper|iron|golden|diamond|netherite)_axe$/);
  const spear=has(k,/(?:^|_)(?:wooden|stone|copper|iron|golden|diamond|netherite)_spear$/);
  const melee=sword||axe||spear||k==="minecraft:mace"||k==="mace"||k==="minecraft:trident"||k==="trident";
  const bow=k.endsWith("bow")&&!k.endsWith("crossbow"), crossbow=k.endsWith("crossbow");
  const tool=/(?:pickaxe|shovel|hoe|axe)$/.test(k);
  const armor=/(?:helmet|chestplate|leggings|boots)$/.test(k)||k.endsWith("elytra")||k==="turtle_helmet";
  const boots=k.endsWith("boots"), helmet=k.endsWith("helmet")||k==="turtle_helmet", leggings=k.endsWith("leggings");
  const trident=k.endsWith("trident"), mace=k.endsWith("mace");
  if(["unbreaking","mending","vanishing_curse"].includes(e)) return armor||tool||melee||bow||crossbow||k.endsWith("fishing_rod")||k.endsWith("shield")||["flint_and_steel","shears","brush","carrot_on_a_stick","warped_fungus_on_a_stick"].some((v)=>k.endsWith(v));
  if(e==="binding_curse") return armor;
  if(["sharpness","smite","bane_of_arthropods","fire_aspect","knockback","looting"].includes(e)) return melee;
  if(e==="sweeping_edge") return sword;
  if(e==="lunge") return spear;
  if(["efficiency","fortune","silk_touch"].includes(e)) return tool;
  if(["protection","blast_protection","fire_protection","projectile_protection","thorns"].includes(e)) return armor;
  if(e==="feather_falling"||e==="depth_strider"||e==="frost_walker"||e==="soul_speed") return boots;
  if(e==="respiration"||e==="aqua_affinity") return helmet;
  if(e==="swift_sneak") return leggings;
  if(["power","punch","flame","infinity"].includes(e)) return bow;
  if(["quick_charge","multishot","piercing"].includes(e)) return crossbow;
  if(["loyalty","channeling","riptide","impaling"].includes(e)) return trident;
  if(["density","breach","wind_burst"].includes(e)) return mace;
  if(["luck_of_the_sea","lure"].includes(e)) return k.endsWith("fishing_rod");
  return false;
}

const EXCLUSIVE_GROUPS=[
  new Set(["sharpness","smite","bane_of_arthropods"]),
  new Set(["protection","blast_protection","fire_protection","projectile_protection"]),
  new Set(["depth_strider","frost_walker"]),
  new Set(["infinity","mending"]),
  new Set(["loyalty","riptide"]),
  new Set(["multishot","piercing"]),
];
export function areEnchantmentsCompatible(a,b) {
  const x=idOf(a),y=idOf(b);
  return !EXCLUSIVE_GROUPS.some(group=>group.has(x)&&group.has(y));
}
export function availableEnchantmentsForItemId(itemId,blocks) {
  return ENCHANTMENT_IDS.filter(id=>isEnchantmentCompatible(id,itemId,blocks));
}
export function getItemEnchantment(itemEnchantments,itemId,enchantId) {
  return Math.max(0,Math.floor(Number(itemEnchantments?.[String(itemId)]?.[idOf(enchantId)])||0));
}
export function setItemEnchantment(itemEnchantments,itemId,enchantId,level,blocks) {
  const e=idOf(enchantId), n=Math.floor(Number(level));
  if(!isEnchantmentCompatible(e,itemId,blocks)||!Number.isInteger(n)||n<1||n>ENCHANTMENT_MAX_LEVEL[e]) return null;
  const current={...(itemEnchantments?.[String(itemId)]??{})};
  if(Object.entries(current).some(([other])=>other!==e&&!areEnchantmentsCompatible(other,e))) return null;
  current[e]=n;
  return {...(itemEnchantments??{}),[String(itemId)]:current};
}
export function enchantmentDamageBonus(itemEnchantments,itemId,targetType="generic",fallDistance=0) {
  const level=e=>getItemEnchantment(itemEnchantments,itemId,e);
  let bonus=0;
  const sharp=level("sharpness"); if(sharp) bonus+=1+0.5*(sharp-1);
  const undead=["zombie","zombie_villager","husk","drowned","skeleton","stray","bogged","wither_skeleton","zombified_piglin","phantom","skeleton_horse","zombie_horse","zombie_nautilus"].includes(targetType);
  const arthropod=["spider","cave_spider","silverfish","endermite","bee"].includes(targetType);
  const aquatic=["guardian","elder_guardian","squid","glow_squid","dolphin","axolotl","cod","salmon","pufferfish","tropical_fish","tadpole"].includes(targetType);
  if(undead) bonus+=2.5*level("smite");
  if(arthropod) bonus+=2.5*level("bane_of_arthropods");
  if(aquatic) bonus+=2.5*level("impaling");
  const density=level("density"); if(density>0) bonus+=Math.max(0,fallDistance)*0.5*density;
  return bonus;
}
export function enchantmentDamageProtection(itemEnchantments,armorSlots,blocks,cause="generic") {
  let points=0;
  const matching={fall:"feather_falling",fire:"fire_protection",lava:"fire_protection",explosion:"blast_protection",projectile:"projectile_protection"};
  for(const id of Array.isArray(armorSlots)?armorSlots:[]) {
    points+=getItemEnchantment(itemEnchantments,id,"protection");
    const spec=matching[cause]; if(spec) points+=2*getItemEnchantment(itemEnchantments,id,spec);
  }
  return Math.min(20,points);
}
export function elytraWearChance(itemEnchantments,elytraItemId) {
  const unbreaking=getItemEnchantment(itemEnchantments,elytraItemId,"unbreaking");
  return 1/(unbreaking+1);
}
