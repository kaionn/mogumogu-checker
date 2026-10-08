import { useState, useCallback, useRef } from 'react'
import type { AnalysisResult, BabyProfile } from '../types'
import { analyzeMeal } from '../lib/analyze-meal'
import { localToday } from '../lib/meal-days'

type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: AnalysisResult }
  | { status: 'error'; message: string }

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({ status: 'idle' })
  const requestId = useRef(0)
  const reset = useCallback(() => {
    requestId.current++
    setState({ status: 'idle' })
  }, [])
  const analyze = useCallback(async (foodsText: string, profile: BabyProfile, date = localToday()) => {
    const id = ++requestId.current
    setState({ status: 'loading' })
    try {
      const result = await analyzeMeal(foodsText, profile, date)
      if (id === requestId.current) setState({ status: 'done', result })
    } catch (error) {
      if (id === requestId.current) setState({ status: 'error', message: error instanceof Error ? error.message : '解析に失敗しました' })
    }
  }, [])
  return { state, analyze, reset }
}
