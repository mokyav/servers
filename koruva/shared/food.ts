export interface FoodDef {
  id: string;
  name: string;
  foodLevel: number;
  saturation: number;
  eatTicks: number;
  canEatWhenFull: boolean;
  effects?: { effectId: string; chance: number; durationTicks: number; amplifier: number }[];
}

export const FOOD_DEFS: Record<string, FoodDef> = {
  apple: { id: "apple", name: "りんご", foodLevel: 4, saturation: 2.4, eatTicks: 32, canEatWhenFull: false },
  bread: { id: "bread", name: "パン", foodLevel: 5, saturation: 6, eatTicks: 32, canEatWhenFull: false },
  cooked_beef: { id: "cooked_beef", name: "焼き牛肉", foodLevel: 8, saturation: 12.8, eatTicks: 32, canEatWhenFull: false },
  pufferfish: { id: "pufferfish", name: "フグ", foodLevel: 1, saturation: 0.2, eatTicks: 32, canEatWhenFull: true,
    effects: [{ effectId: "hunger", chance: 0.3, durationTicks: 300, amplifier: 2 }] },
  raw_chicken: { id: "raw_chicken", name: "生の鶏肉", foodLevel: 2, saturation: 1.2, eatTicks: 32, canEatWhenFull: false,
    effects: [{ effectId: "hunger", chance: 0.3, durationTicks: 600, amplifier: 0 }] },
  rotten_flesh: { id: "rotten_flesh", name: "腐った肉", foodLevel: 4, saturation: 0.8, eatTicks: 32, canEatWhenFull: false,
    effects: [{ effectId: "hunger", chance: 0.8, durationTicks: 600, amplifier: 0 }] },
};
