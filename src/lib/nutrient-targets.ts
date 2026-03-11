import type { AgeBand, NutrientTargets, NutrientMeta, NutrientKey } from '../types'

export const ageBands: AgeBand[] = [
  { min: 5, max: 6, targets: { energy: 140, protein: 5, iron: 3, calcium: 120, vitaminC: 20, veggies: 30 } },
  { min: 7, max: 8, targets: { energy: 220, protein: 8, iron: 4.5, calcium: 180, vitaminC: 25, veggies: 50 } },
  { min: 9, max: 11, targets: { energy: 300, protein: 10, iron: 5, calcium: 220, vitaminC: 35, veggies: 80 } },
  { min: 12, max: 99, targets: { energy: 360, protein: 13, iron: 4.5, calcium: 250, vitaminC: 40, veggies: 100 } },
]

export const nutrientMeta: NutrientMeta[] = [
  { key: 'energy', label: 'エネルギー', unit: 'kcal' },
  { key: 'protein', label: 'たんぱく質', unit: 'g' },
  { key: 'iron', label: '鉄', unit: 'mg' },
  { key: 'calcium', label: 'カルシウム', unit: 'mg' },
  { key: 'vitaminC', label: 'ビタミンC', unit: 'mg' },
]

export const nutrientMetaWithVeggies: (NutrientMeta | { key: 'veggies'; label: string; unit: string })[] = [
  ...nutrientMeta,
  { key: 'veggies', label: '野菜・果物量', unit: 'g' },
]

export function getBaseTargets(age: number): NutrientTargets {
  return ageBands.find(band => age >= band.min && age <= band.max)?.targets ?? ageBands[1].targets
}

export function calculateTargets(age: number, weight: number, milk: number, meals: number): NutrientTargets {
  const base = { ...getBaseTargets(age) }

  if (weight >= 9.5) {
    base.energy *= 1.08
  }
  if (milk >= 6) {
    base.energy *= 0.92
    base.protein *= 0.95
  }
  if (meals >= 3) {
    base.energy *= 1.1
    base.veggies *= 1.15
  }

  return base
}
