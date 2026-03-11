export interface BabyProfile {
  months: number;
  weight: number;
  milkPerDay: number;
  mealsPerDay: number;
}

export interface MealEntry {
  id: string;
  date: string;
  time: string;
  foods: FoodItem[];
}

export interface FoodItem {
  name: string;
  grams: number;
  raw: string;
}

export type NutrientKey = 'energy' | 'protein' | 'iron' | 'calcium' | 'vitaminC' | 'vitaminD';

export interface NutrientStatus {
  intake: number;
  target: number;
  unit: string;
  percentage: number;
}

export interface Deficiency {
  nutrient: string;
  suggestions: string[];
  reason: string;
}

export interface AnalysisResult {
  date: string;
  nutrients: Record<NutrientKey, NutrientStatus>;
  score: number;
  summary: string;
  deficiencies: Deficiency[];
  tips: string[];
  source: 'gemini' | 'local';
}

export interface FoodDbEntry {
  energy: number;
  protein: number;
  iron: number;
  calcium: number;
  vitaminC: number;
  veggies: number;
  group: 'carb' | 'protein' | 'dairy' | 'veg' | 'fruit' | 'supplement';
}

export interface NutrientMeta {
  key: NutrientKey;
  label: string;
  unit: string;
}

export interface NutrientTargets {
  energy: number;
  protein: number;
  iron: number;
  calcium: number;
  vitaminC: number;
  veggies: number;
}

export interface AgeBand {
  min: number;
  max: number;
  targets: NutrientTargets;
}
