import type { MealEntry } from '../types'

export function groupMealsByDate(entries: MealEntry[]): Record<string, string> {
  const days: Record<string, string[]> = {}
  for (const entry of entries) {
    (days[entry.date] ??= []).push(...entry.foods.map(f => `${f.name} ${f.grams}g`))
  }
  return Object.fromEntries(Object.entries(days).map(([date, foods]) => [date, foods.join(', ')]))
}

export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
