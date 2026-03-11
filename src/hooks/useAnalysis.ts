import { useState, useCallback } from 'react'
import type { FoodItem, AnalysisResult, BabyProfile, NutrientKey } from '../types'
import { analyzeLocally } from '../lib/local-analyzer'
import { callAnalyzeApi } from '../lib/api-client'

type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: AnalysisResult }
  | { status: 'error'; message: string }

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

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({ status: 'idle' })

  const analyze = useCallback(async (foodsText: string, profile: BabyProfile) => {
    setState({ status: 'loading' })

    const foods = parseFoodsFromText(foodsText)
    if (foods.length === 0) {
      setState({ status: 'error', message: '食材を入力してください' })
      return
    }

    try {
      const geminiResult = await callAnalyzeApi(profile, foodsText)
      const nutrients = {} as Record<NutrientKey, { intake: number; target: number; unit: string; percentage: number }>
      for (const [key, value] of Object.entries(geminiResult.nutrients)) {
        nutrients[key as NutrientKey] = value
      }
      const result: AnalysisResult = {
        date: new Date().toISOString().split('T')[0],
        nutrients,
        score: geminiResult.score,
        summary: geminiResult.summary,
        deficiencies: geminiResult.deficiencies,
        tips: geminiResult.tips,
        source: 'gemini',
      }
      setState({ status: 'done', result })
    } catch {
      // Gemini API 失敗時はローカル解析にフォールバック
      try {
        const result = analyzeLocally(
          foods,
          profile.months,
          profile.weight,
          profile.milkPerDay,
          profile.mealsPerDay,
        )
        setState({ status: 'done', result })
      } catch {
        setState({ status: 'error', message: '解析に失敗しました' })
      }
    }
  }, [])

  return { state, analyze }
}
