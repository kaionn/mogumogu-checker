import type { FoodItem, AnalysisResult, BabyProfile, NutrientKey } from '../types'
import { analyzeLocally } from './local-analyzer'
import { callAnalyzeApi } from './api-client'

function parseFoodsFromText(text: string): FoodItem[] {
  return text
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(raw => {
      const gramMatch = raw.match(/(\d+(?:\.\d+)?)\s*g/i)
      const name = raw.replace(/\s*\d+(?:\.\d+)?\s*g\s*/i, '').trim()
      return {
        name: name || raw,
        grams: gramMatch ? Number(gramMatch[1]) : 10,
        raw,
      }
    })
}


export async function analyzeMeal(foodsText: string, profile: BabyProfile, date: string): Promise<AnalysisResult> {
  const foods = parseFoodsFromText(foodsText)
  if (foods.length === 0) throw new Error('食材を入力してください')
  try {
    const geminiResult = await callAnalyzeApi(profile, foodsText, date)
    const nutrients = {} as AnalysisResult['nutrients']
    for (const [key, value] of Object.entries(geminiResult.nutrients)) {
      nutrients[key as NutrientKey] = value
    }
    return { date, nutrients, score: geminiResult.score, summary: geminiResult.summary, deficiencies: geminiResult.deficiencies, tips: geminiResult.tips, source: 'gemini' }
  } catch {
    return analyzeLocally(foods, profile.months, profile.weight, profile.milkPerDay, profile.mealsPerDay, date)
  }
}
