import test from "node:test";
import assert from "node:assert/strict";
import {
  ENCHANTMENT_IDS, ENCHANTMENT_MAX_LEVEL, normalizeItemEnchantments,
  isEnchantmentCompatible, areEnchantmentsCompatible, availableEnchantmentsForItemId,
  setItemEnchantment, getItemEnchantment, enchantmentDamageBonus,
  enchantmentDamageProtection, elytraWearChance,
} from "../shared/enchantments.js";
import { armorSlotForItemId, weaponReachForItemId, applyArmorReduction } from "../shared/item-mechanics.js";

const blocks = [undefined,
  {key:"minecraft:diamond_sword"}, {key:"minecraft:wooden_spear"}, {key:"minecraft:mace"},
  {key:"minecraft:elytra"}, {key:"minecraft:diamond_chestplate"}, {key:"minecraft:bow"},
  {key:"minecraft:trident"}, {key:"minecraft:diamond_pickaxe"}, {key:"minecraft:diamond_boots"},
  {key:"minecraft:crossbow"}, {key:"minecraft:diamond_leggings"}, {key:"minecraft:fishing_rod"},
];

test("ships every one of the 43 Minecraft 26.3 enchantment definitions",()=>{
  assert.equal(ENCHANTMENT_IDS.length,43);
  assert.equal(ENCHANTMENT_MAX_LEVEL.lunge,3);
  assert.equal(ENCHANTMENT_MAX_LEVEL.wind_burst,3);
  assert.equal(ENCHANTMENT_MAX_LEVEL.sharpness,5);
});

test("enchantment compatibility includes the 26.3 spear and armor slots include elytra",()=>{
  assert.equal(isEnchantmentCompatible("lunge",2,blocks),true);
  assert.equal(isEnchantmentCompatible("sharpness",2,blocks),true);
  assert.equal(isEnchantmentCompatible("power",2,blocks),false);
  assert.equal(isEnchantmentCompatible("protection",4,blocks),true);
  assert.equal(isEnchantmentCompatible("feather_falling",9,blocks),true);
  assert.equal(armorSlotForItemId(4,blocks),1);
  assert.ok(availableEnchantmentsForItemId(2,blocks).includes("lunge"));
});

test("exclusive enchantments and level bounds are enforced",()=>{
  assert.equal(areEnchantmentsCompatible("sharpness","smite"),false);
  assert.equal(areEnchantmentsCompatible("protection","fire_protection"),false);
  assert.equal(areEnchantmentsCompatible("sharpness","unbreaking"),true);
  const sharp=setItemEnchantment({},1,"sharpness",5,blocks);
  assert.ok(sharp);
  assert.equal(setItemEnchantment(sharp,1,"smite",2,blocks),null);
  assert.equal(setItemEnchantment(sharp,1,"sharpness",6,blocks),null);
  assert.equal(getItemEnchantment(sharp,1,"sharpness"),5);
});

test("saved enchantment records are sanitized to known, compatible entries",()=>{
  const clean=normalizeItemEnchantments({"1":{sharpness:3,smite:4,unknown:1},"2":{lunge:2,power:5},"99999":{sharpness:1}},blocks);
  assert.deepEqual(clean,{"1":{sharpness:3},"2":{lunge:2}});
});

test("damage and protection enchantments change combat math",()=>{
  assert.equal(enchantmentDamageBonus({"1":{sharpness:3}},1,"pig"),2);
  assert.equal(enchantmentDamageBonus({"1":{smite:2}},1,"zombie"),5);
  assert.equal(enchantmentDamageBonus({"1":{smite:2}},1,"pig"),0);
  assert.equal(enchantmentDamageProtection({"5":{protection:3}},[5],blocks,"generic"),3);
  assert.equal(enchantmentDamageProtection({"5":{blast_protection:3}},[5],blocks,"explosion"),6);
  assert.equal(enchantmentDamageProtection({"5":{projectile_protection:2}},[5],blocks,"projectile"),4);
  assert.ok(applyArmorReduction(10,[5],blocks,{"5":{protection:3}},"generic") < applyArmorReduction(10,[5],blocks));
  assert.ok(applyArmorReduction(10,[],blocks,{"9":{feather_falling:4}},"fall",[0,0,0,9]) < 10);
});

test("Unbreaking reduces the elytra's per-second wear chance",()=>{
  assert.equal(elytraWearChance({},4),1);
  assert.equal(elytraWearChance({"4":{unbreaking:2}},4),1/3);
});

test("spears have more reach than ordinary swords",()=>{
  assert.equal(weaponReachForItemId(2,blocks),4.5);
  assert.equal(weaponReachForItemId(1,blocks),3.2);
});
