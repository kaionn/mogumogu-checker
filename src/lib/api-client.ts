import type { BabyProfile } from '../types'

interface GeminiResponse {
  nutrients: Record<string, { intake: number; target: number; unit: string; percentage: number }>
  score: number
  summary: string
  deficiencies: Array<{ nutrient: string; suggestions: string[]; reason: string }>
  tips: string[]
}

export async function callAnalyzeApi(
  profile: BabyProfile,
  foods: string,
  date?: string,
): Promise<GeminiResponse> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, foods, date }),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  return response.json()
}
