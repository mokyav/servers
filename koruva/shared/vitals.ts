import { FOOD_DEFS } from "./food";

export type VitalsGameMode = "survival" | "creative" | "adventure" | "spectator";
export type Difficulty = "easy" | "normal" | "hard";
export const MAX_HEALTH = 20;
export const MAX_FOOD = 20;
export const TICKS_PER_SECOND = 20;

export const EFFECT_DEFS = {
  speed: { name: "移動速度上昇", kind: "positive", color: "#7cafc6", icon: "EffectSprite_speed.webp", integration: "movement" },
  slowness: { name: "移動速度低下", kind: "negative", color: "#5a6c81", icon: "EffectSprite_slowness.png", integration: "movement" },
  haste: { name: "採掘速度上昇", kind: "positive", color: "#d9c043", icon: "EffectSprite_haste.webp", integration: "mining" },
  mining_fatigue: { name: "採掘速度低下", kind: "negative", color: "#4a4217", icon: "EffectSprite_mining-fatigue.webp", integration: "mining" },
  strength: { name: "攻撃力上昇", kind: "positive", color: "#932423", icon: "EffectSprite_strength.webp", integration: "combat" },
  instant_health: { name: "即時回復", kind: "positive", color: "#f82423", icon: "EffectSprite_instant-health.webp", integration: "instant" },
  instant_damage: { name: "即時ダメージ", kind: "negative", color: "#430a09", icon: "EffectSprite_instant-damage.webp", integration: "instant" },
  jump_boost: { name: "跳躍力上昇", kind: "positive", color: "#786297", icon: "EffectSprite_jump-boost.webp", integration: "movement" },
  nausea: { name: "吐き気", kind: "negative", color: "#551d4a", icon: "EffectSprite_nausea.webp", integration: "vision" },
  regeneration: { name: "再生能力", kind: "positive", color: "#cd5cab", icon: "EffectSprite_regeneration.webp", integration: "health" },
  resistance: { name: "耐性", kind: "positive", color: "#99453a", icon: "EffectSprite_resistance.webp", integration: "damage" },
  fire_resistance: { name: "火炎耐性", kind: "positive", color: "#e49a3a", icon: "EffectSprite_fire-resistance.webp", integration: "damage" },
  water_breathing: { name: "水中呼吸", kind: "positive", color: "#2e5299", icon: "EffectSprite_water-breathing.webp", integration: "environment" },
  invisibility: { name: "透明化", kind: "positive", color: "#7f8392", icon: "EffectSprite_invisibility.webp", integration: "render" },
  blindness: { name: "盲目", kind: "negative", color: "#1f1f23", icon: "EffectSprite_blindness.webp", integration: "vision" },
  night_vision: { name: "暗視", kind: "positive", color: "#1f1fa1", icon: "EffectSprite_night-vision.webp", integration: "vision" },
  hunger: { name: "空腹", kind: "negative", color: "#587653", icon: "EffectSprite_hunger.webp", integration: "food" },
  weakness: { name: "弱体化", kind: "negative", color: "#484d48", icon: "EffectSprite_weakness.webp", integration: "combat" },
  poison: { name: "毒", kind: "negative", color: "#4e9331", icon: "EffectSprite_poison.webp", integration: "health" },
  wither: { name: "衰弱", kind: "negative", color: "#352a27", icon: "EffectSprite_wither.webp", integration: "health" },
  health_boost: { name: "体力増強", kind: "positive", color: "#f87d23", icon: "EffectSprite_health-boost.webp", integration: "health" },
  absorption: { name: "衝撃吸収", kind: "positive", color: "#2552a5", icon: "EffectSprite_absorption.webp", integration: "damage" },
  saturation: { name: "満腹度回復", kind: "positive", color: "#f82423", icon: "EffectSprite_saturation.webp", integration: "instant" },
  glowing: { name: "発光", kind: "neutral", color: "#94a061", icon: "EffectSprite_glowing.webp", integration: "render" },
  levitation: { name: "浮遊", kind: "negative", color: "#ceffff", icon: "EffectSprite_levitation.webp", integration: "movement" },
  fatal_poison: { name: "致死毒", kind: "negative", color: "#4e9331", icon: "EffectSprite_fatal-poison.webp", integration: "health" },
  luck: { name: "幸運", kind: "positive", color: "#339900", icon: "EffectSprite_luck.webp", integration: "luck-event" },
  unluck: { name: "不運", kind: "negative", color: "#c0a44d", icon: "EffectSprite_bad-luck.webp", integration: "luck-event" },
  slow_falling: { name: "落下速度低下", kind: "positive", color: "#e3efef", icon: "EffectSprite_slow-falling.webp", integration: "movement" },
  conduit_power: { name: "コンジットパワー", kind: "positive", color: "#1dc2d1", icon: "EffectSprite_conduit-power.webp", integration: "environment" },
  dolphins_grace: { name: "イルカの好意", kind: "positive", color: "#2080c9", icon: "EffectSprite_dolphins-grace.webp", integration: "movement" },
  bad_omen: { name: "不吉な予感", kind: "negative", color: "#0b6138", icon: "EffectSprite_bad-omen.png", integration: "event" },
  hero_of_the_village: { name: "村の英雄", kind: "positive", color: "#44ff44", icon: "EffectSprite_hero-of-the-village.webp", integration: "village-event" },
  darkness: { name: "暗闇", kind: "negative", color: "#292929", icon: "EffectSprite_darkness.webp", integration: "vision" },
} as const;
export type EffectId = keyof typeof EFFECT_DEFS;
export type EffectKind = "positive" | "negative" | "neutral";
export interface EffectLayer { effectId: EffectId; durationTicks: number; amplifier: number; hiddenEffect?: EffectLayer; ageTicks: number }
export interface PlayerVitals {
  health: number; maxHealth: number; foodLevel: number; foodSaturationLevel: number;
  foodExhaustionLevel: number; foodTickTimer: number; activeEffects: EffectLayer[];
  absorptionAmount: number; gameMode: VitalsGameMode; dead: boolean; respawnTicks: number;
  eatingFoodId?: string; eatingTicksRemaining: number;
  naturalRegenTimer: number; starvationTimer: number; foodCounts: Record<string, number>;
}
export type DamageCause = "fall" | "mob" | "player" | "fire" | "lava" | "suffocation" | "drowning" | "starvation" | "poison" | "wither" | "fatal_poison" | "generic";
export interface TickResult { changed: boolean; event?: "death" | "respawn" }

export function createVitals(gameMode: VitalsGameMode = "survival"): PlayerVitals {
  return { health: 20, maxHealth: 20, foodLevel: 20, foodSaturationLevel: 5, foodExhaustionLevel: 0,
    foodTickTimer: 0, activeEffects: [], absorptionAmount: 0, gameMode, dead: false, respawnTicks: 0,
    naturalRegenTimer: 0, starvationTimer: 0, eatingTicksRemaining: 0, foodCounts: { apple: 3, bread: 2 } };
}

export function normalizeVitals(raw: unknown, mode: VitalsGameMode): PlayerVitals {
  const base = createVitals(mode); const x = raw && typeof raw === "object" ? raw as Partial<PlayerVitals> : {};
  const n = (v: unknown, lo: number, hi: number, d: number) => typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  base.health = n(x.health, 0, 256, 20); base.foodLevel = Math.round(n(x.foodLevel, 0, 20, 20));
  base.foodSaturationLevel = n(x.foodSaturationLevel, 0, base.foodLevel, 5);
  base.foodExhaustionLevel = n(x.foodExhaustionLevel, 0, 1000, 0);
  base.foodTickTimer = Math.floor(n(x.foodTickTimer, 0, 1e9, 0));
  base.absorptionAmount = n(x.absorptionAmount, 0, 1024, 0);
  base.dead = !!x.dead; base.respawnTicks = Math.floor(n(x.respawnTicks, 0, 1200, 0));
  base.naturalRegenTimer = Math.floor(n(x.naturalRegenTimer, 0, 1e9, 0));
  base.starvationTimer = Math.floor(n(x.starvationTimer, 0, 1e9, 0));
  const normalizeLayer = (raw: unknown, depth = 0): EffectLayer | undefined => {
    if (!raw || typeof raw !== "object" || depth > 8) return undefined;
    const e = raw as Partial<EffectLayer>;
    if (typeof e.effectId !== "string" || !Object.prototype.hasOwnProperty.call(EFFECT_DEFS, e.effectId)) return undefined;
    const layer: EffectLayer = {
      effectId: e.effectId as EffectId,
      amplifier: Math.floor(n(e.amplifier, 0, 255, 0)),
      durationTicks: Math.floor(n(e.durationTicks, 1, 20 * 86400, 1)),
      ageTicks: Math.floor(n(e.ageTicks, 0, 1e9, 0)),
    };
    const hidden = normalizeLayer(e.hiddenEffect, depth + 1);
    if (hidden && hidden.effectId === layer.effectId) layer.hiddenEffect = hidden;
    return layer;
  };
  base.activeEffects = [];
  for (const raw of Array.isArray(x.activeEffects) ? x.activeEffects.slice(0, 64) : []) {
    const layer = normalizeLayer(raw);
    if (layer) base.activeEffects.push(layer);
  }
  const counts: Record<string,number> = {}; for (const id of Object.keys(FOOD_DEFS)) counts[id]=Math.floor(n(x.foodCounts?.[id],0,999,base.foodCounts[id]??0)); base.foodCounts=counts;
  if (typeof x.eatingFoodId === "string" && Object.prototype.hasOwnProperty.call(FOOD_DEFS, x.eatingFoodId)) {
    const food = FOOD_DEFS[x.eatingFoodId];
    const remaining = Math.floor(n(x.eatingTicksRemaining, 0, food.eatTicks, 0));
    if (remaining > 0) { base.eatingFoodId = food.id; base.eatingTicksRemaining = remaining; }
  }
  base.gameMode=mode; recalcMaxHealth(base); return base;
}

export function addExhaustion(v: PlayerVitals, amount: number): void {
  if (Number.isFinite(amount) && amount > 0 && isSurvival(v)) v.foodExhaustionLevel = Math.min(10000, v.foodExhaustionLevel + amount);
}
export function isSurvival(v: PlayerVitals): boolean { return v.gameMode === "survival" || v.gameMode === "adventure"; }
export function canSprint(v: PlayerVitals): boolean { return !isSurvival(v) || v.foodLevel > 6; }
export const ADVENTURE_BREAK_ALLOWLIST: readonly number[] = [];
export const ADVENTURE_PLACE_ALLOWLIST: readonly number[] = [];
export function canAdventureEdit(placedBlock: number, existingBlock = 0): boolean {
  return placedBlock === 0 ? ADVENTURE_BREAK_ALLOWLIST.includes(existingBlock) : ADVENTURE_PLACE_ALLOWLIST.includes(placedBlock);
}
function recalcMaxHealth(v: PlayerVitals): void {
  const effect=v.activeEffects.find(e=>e.effectId==="health_boost");
  v.maxHealth=20+(effect ? 4*(effect.amplifier+1) : 0); v.health=Math.min(v.health,v.maxHealth);
}
function tickLayer(e: EffectLayer): EffectLayer | undefined {
  e.durationTicks--; e.ageTicks++;
  if(e.hiddenEffect) e.hiddenEffect=tickLayer(e.hiddenEffect);
  if(e.durationTicks<=0) return e.hiddenEffect;
  return e;
}
function mergeLayer(current: EffectLayer, incoming: EffectLayer): EffectLayer {
  if(incoming.amplifier>current.amplifier){
    if(current.durationTicks>incoming.durationTicks) incoming.hiddenEffect=current;
    else if(current.hiddenEffect) incoming.hiddenEffect=current.hiddenEffect;
    return incoming;
  }
  if(incoming.amplifier===current.amplifier){
    if(incoming.durationTicks>current.durationTicks){ incoming.hiddenEffect=current.hiddenEffect; return incoming; }
    return current;
  }
  if(!current.hiddenEffect) current.hiddenEffect=incoming; else current.hiddenEffect=mergeLayer(current.hiddenEffect,incoming);
  return current;
}
export function addEffect(v: PlayerVitals, id: string, durationTicks: number, amplifier: number): boolean {
  if(!Object.prototype.hasOwnProperty.call(EFFECT_DEFS, id) || !Number.isFinite(durationTicks) || durationTicks<=0 || !Number.isInteger(amplifier) || amplifier<0 || amplifier>255) return false;
  const effectId=id as EffectId; const duration=Math.min(20*86400,Math.max(1,Math.floor(durationTicks)));
  const incoming:EffectLayer={effectId,durationTicks:duration,amplifier,ageTicks:0};
  if(effectId==="instant_health"){ v.health=Math.min(v.maxHealth,v.health+4*(amplifier+1)); return true; }
  if(effectId==="instant_damage"){ applyDamage(v,4*(amplifier+1),"generic"); return true; }
  if(effectId==="saturation"){ const q=2*(amplifier+1); v.foodLevel=Math.min(20,v.foodLevel+q); v.foodSaturationLevel=Math.min(v.foodLevel,v.foodSaturationLevel+q); return true; }
  const idx=v.activeEffects.findIndex(e=>e.effectId===effectId);
  if(idx<0) v.activeEffects.push(incoming); else v.activeEffects[idx]=mergeLayer(v.activeEffects[idx],incoming);
  if(effectId==="absorption") v.absorptionAmount=Math.max(v.absorptionAmount,4*(amplifier+1));
  recalcMaxHealth(v); return true;
}
export function clearEffect(v: PlayerVitals, id?: string): void {
  v.activeEffects=id ? v.activeEffects.filter(e=>e.effectId!==id) : [];
  if(!v.activeEffects.some(e=>e.effectId==="absorption")) v.absorptionAmount=0;
  recalcMaxHealth(v);
}
export function applyDamage(v: PlayerVitals, raw: number, cause: DamageCause): number {
  if(!isSurvival(v)||v.dead||!Number.isFinite(raw)||raw<=0) return 0;
  if (cause === "fall" && v.activeEffects.some(e => e.effectId === "slow_falling")) return 0;
  if (cause === "drowning" && v.activeEffects.some(e => e.effectId === "water_breathing" || e.effectId === "conduit_power")) return 0;
  if((cause==="fire"||cause==="lava")&&v.activeEffects.some(e=>e.effectId==="fire_resistance")) return 0;
  const res=v.activeEffects.find(e=>e.effectId==="resistance"); const factor=res?Math.max(0,1-.2*(res.amplifier+1)):1;
  let damage=Math.max(0,raw*factor); const absorbed=Math.min(v.absorptionAmount,damage); v.absorptionAmount-=absorbed; damage-=absorbed;
  const old=v.health; v.health=Math.max(0,v.health-damage); if(v.health<=0){v.dead=true;v.respawnTicks=60;v.eatingFoodId=undefined;v.eatingTicksRemaining=0;clearEffect(v);v.absorptionAmount=0;}
  return old-v.health;
}
export function applyFood(v: PlayerVitals, foodId: string, random = Math.random): boolean {
  const food=FOOD_DEFS[foodId]; if(!food||!isSurvival(v)||(v.foodCounts[foodId]??0)<=0) return false;
  if(v.foodLevel>=20&&!food.canEatWhenFull) return false;
  v.foodCounts[foodId]--; v.foodLevel=Math.min(20,v.foodLevel+food.foodLevel);
  v.foodSaturationLevel=Math.min(v.foodLevel,v.foodSaturationLevel+food.saturation);
  for(const e of food.effects??[]) if(random()<e.chance) addEffect(v,e.effectId,e.durationTicks,e.amplifier);
  return true;
}
function effect(v:PlayerVitals,id:EffectId):EffectLayer|undefined{return v.activeEffects.find(e=>e.effectId===id);}
export function tickVitals(v: PlayerVitals, difficulty: Difficulty = "normal"): TickResult {
  if(v.dead){v.respawnTicks=Math.max(0,v.respawnTicks-1);if(v.respawnTicks===0){const foods={...v.foodCounts},mode=v.gameMode;Object.assign(v,createVitals(mode));v.foodCounts=foods;return{changed:true,event:"respawn"};}return{changed:true};}
  v.foodTickTimer++;
  if(isSurvival(v))for(const e of [...v.activeEffects]){
    if(e.effectId==="hunger")addExhaustion(v,.005*(e.amplifier+1));
    const period=e.effectId==="regeneration"?Math.max(1,Math.floor(50/(e.amplifier+1))):e.effectId==="poison"?Math.max(1,Math.floor(25/(e.amplifier+1))):e.effectId==="wither"?Math.max(1,Math.floor(40/(e.amplifier+1))):e.effectId==="fatal_poison"?Math.max(1,Math.floor(10/(e.amplifier+1))):0;
    if(period&&(e.ageTicks+1)%period===0){if(e.effectId==="regeneration")v.health=Math.min(v.maxHealth,v.health+1);else if(e.effectId==="poison"&&v.health>1)applyDamage(v,1,"poison");else if(e.effectId==="wither")applyDamage(v,1,"wither");else if(e.effectId==="fatal_poison")applyDamage(v,1,"fatal_poison");}
    if(v.dead)return{changed:true,event:"death"};
  }
  for(let i=v.activeEffects.length-1;i>=0;i--){const next=tickLayer(v.activeEffects[i]);if(next)v.activeEffects[i]=next;else v.activeEffects.splice(i,1);}
  if(!v.activeEffects.some(e=>e.effectId==="absorption"))v.absorptionAmount=0;recalcMaxHealth(v);
  if(isSurvival(v)){
    while(v.foodExhaustionLevel>=4){v.foodExhaustionLevel-=4;if(v.foodSaturationLevel>0)v.foodSaturationLevel=Math.max(0,v.foodSaturationLevel-1);else v.foodLevel=Math.max(0,v.foodLevel-1);}
    if(v.foodLevel===0){v.starvationTimer++;if(v.starvationTimer>=80){v.starvationTimer=0;const floor=difficulty==="easy"?10:difficulty==="normal"?1:0;if(v.health>floor)applyDamage(v,Math.min(1,v.health-floor),"starvation");}}else v.starvationTimer=0;
    if(v.health<v.maxHealth&&v.foodLevel>=18){v.naturalRegenTimer++;const interval=v.foodLevel===20&&v.foodSaturationLevel>0?10:80;if(v.naturalRegenTimer>=interval){v.naturalRegenTimer=0;const amount=v.foodLevel===20&&v.foodSaturationLevel>0?Math.min(1,v.foodSaturationLevel/6):1;const healed=Math.min(amount,v.maxHealth-v.health);v.health+=healed;addExhaustion(v,6*healed);}}else v.naturalRegenTimer=0;
  }
  if(v.dead)return{changed:true,event:"death"};return{changed:true};
}
