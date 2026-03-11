import type { FoodItem, AnalysisResult, NutrientKey, NutrientStatus, Deficiency, NutrientTargets } from '../types'
import { foodDb } from './food-db'
import { calculateTargets, nutrientMeta } from './nutrient-targets'

interface FoodContribution {
  energy: number
  protein: number
  iron: number
  calcium: number
  vitaminC: number
  veggies: number
}

function calculateFoodContribution(name: string, grams: number): FoodContribution {
  const data = foodDb[name]
  if (!data) return { energy: 0, protein: 0, iron: 0, calcium: 0, vitaminC: 0, veggies: 0 }

  const factor = grams / 10
  return {
    energy: data.energy * factor,
    protein: (data.protein / 10) * factor,
    iron: (data.iron / 10) * factor,
    calcium: (data.calcium / 2) * factor,
    vitaminC: (data.vitaminC / 5) * factor,
    veggies: data.group === 'veg' || data.group === 'fruit' ? grams : 0,
  }
}

function matchFoodName(raw: string): string | null {
  return Object.keys(foodDb).find(name => raw.includes(name)) ?? null
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getStatus(percent: number): '十分' | 'あと少し' | '不足' {
  if (percent >= 90) return '十分'
  if (percent >= 70) return 'あと少し'
  return '不足'
}

export function analyzeLocally(
  foods: FoodItem[],
  months: number,
  weight: number,
  milk: number,
  meals: number,
): AnalysisResult {
  const totals: FoodContribution = { energy: 0, protein: 0, iron: 0, calcium: 0, vitaminC: 0, veggies: 0 }
  let carbCount = 0
  let proteinCount = 0
  let vegCount = 0

  for (const food of foods) {
    const name = matchFoodName(food.name) ?? food.name
    const data = foodDb[name]
    if (!data) continue

    const contribution = calculateFoodContribution(name, food.grams)
    totals.energy += contribution.energy
    totals.protein += contribution.protein
    totals.iron += contribution.iron
    totals.calcium += contribution.calcium
    totals.vitaminC += contribution.vitaminC
    totals.veggies += contribution.veggies

    if (data.group === 'carb') carbCount++
    if (data.group === 'protein' || data.group === 'dairy') proteinCount++
    if (data.group === 'veg' || data.group === 'fruit') vegCount++
  }

  const targets = calculateTargets(months, weight, milk, meals)

  const percents: Record<string, number> = {}
  const nutrientKeys: (keyof FoodContribution)[] = ['energy', 'protein', 'iron', 'calcium', 'vitaminC', 'veggies']
  for (const key of nutrientKeys) {
    const targetVal = targets[key as keyof NutrientTargets]
    percents[key] = targetVal > 0 ? Math.round((totals[key] / targetVal) * 100) : 0
  }

  const normalized = nutrientKeys.map(key => clamp(percents[key], 0, 120))
  const score = Math.round(normalized.reduce((a, b) => a + b, 0) / normalized.length)

  const nutrients: Record<NutrientKey, NutrientStatus> = {} as Record<NutrientKey, NutrientStatus>
  const units: Record<NutrientKey, string> = {
    energy: 'kcal', protein: 'g', iron: 'mg', calcium: 'mg', vitaminC: 'mg', vitaminD: 'μg',
  }
  for (const meta of nutrientMeta) {
    const key = meta.key
    nutrients[key] = {
      intake: Math.round(totals[key as keyof FoodContribution] * 10) / 10,
      target: Math.round(targets[key as keyof NutrientTargets] * 10) / 10,
      unit: units[key],
      percentage: percents[key] ?? 0,
    }
  }

  const deficiencies: Deficiency[] = []
  const recommendMap: Record<string, { suggestions: string[]; reason: string }> = {
    iron: { suggestions: ['レバー', '小松菜', 'きなこ'], reason: '鉄分が不足しています' },
    vitaminC: { suggestions: ['いちご', 'ブロッコリー', 'かぼちゃ'], reason: 'ビタミンCが不足しています' },
    calcium: { suggestions: ['ヨーグルト', '豆腐', 'しらす'], reason: 'カルシウムが不足しています' },
    protein: { suggestions: ['豆腐', '鮭', 'ささみ'], reason: 'たんぱく質が不足しています' },
    energy: { suggestions: ['おかゆ', 'うどん', 'パンがゆ'], reason: 'エネルギーが不足しています' },
  }

  for (const [key, rec] of Object.entries(recommendMap)) {
    if ((percents[key] ?? 0) < 70) {
      deficiencies.push({ nutrient: key, suggestions: rec.suggestions, reason: rec.reason })
    }
  }

  let headline = '全体としてはまずまずです。'
  if (score >= 90) headline = 'かなりバランスよく食べられています！'
  if (score < 60) headline = '不足気味の栄養がいくつかあります。'

  const tips: string[] = []
  if (carbCount === 0) tips.push('主食が見当たらないため、おかゆ・うどん・パンがゆのどれかを1品入れると全体が安定しやすいです。')
  if (proteinCount === 0) tips.push('たんぱく源が少ないので、豆腐・白身魚・ささみなど消化しやすいものを少量追加候補に。')
  if (vegCount === 0) tips.push('野菜や果物が少ないため、色のある食材を1つ足すとビタミン面の見栄えが良くなります。')
  if ((percents['iron'] ?? 0) < 70 && months >= 7) tips.push('7ヶ月以降は鉄不足が目立ちやすいので、鉄を含む食材を意識してローテーションすると安心です。')
  if (meals <= 2 && months >= 9) tips.push('月齢的には3回食への移行を少しずつ検討してもよい時期です。')
  if (milk >= 7) tips.push('授乳・ミルク回数が多めなので、離乳食は「量を無理に増やす」より「食べられる食材の幅を増やす」発想でもOKです。')
  if (tips.length === 0) tips.push('今の構成でもかなり整っています。次は食材の種類を少しずつ増やしていくといいですね。')

  return {
    date: new Date().toISOString().split('T')[0],
    nutrients,
    score,
    summary: headline,
    deficiencies,
    tips,
    source: 'local',
  }
}
