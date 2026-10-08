import type { MealEntry, FoodItem } from '../types'

function parseFoodLine(line: string): FoodItem[] {
  // "7倍粥 50g, 鮭 10g, ほうれん草 10g" のようなカンマ区切り
  return line
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(raw => {
      const gramMatch = raw.match(/(\d+(?:\.\d+)?)\s*g/i)
      const name = raw.replace(/\s*\d+(?:\.\d+)?\s*g\s*/i, '').trim()
      return { name: name || raw, grams: gramMatch ? Number(gramMatch[1]) : 10, raw }
    })
}

/**
 * ぴよログのテキスト形式をパースする
 *
 * パターン A: テキスト形式
 * 2026/03/10
 * 07:30 離乳食
 *   7倍粥 50g
 *   鮭 10g
 *
 * パターン B: CSV 形式
 * 日時,カテゴリ,メモ
 * 2026/03/10 07:30,離乳食,"7倍粥 50g, 鮭 10g"
 */
export function parsePiyologText(text: string): { entries: MealEntry[]; skipped: number } {
  const lines = text.split('\n').map(l => l.trimEnd())
  const entries: MealEntry[] = []
  let skipped = 0

  // CSV 形式の検出
  if (lines[0]?.includes(',') && (lines[0].includes('日時') || lines[0].includes('カテゴリ'))) {
    return parseCsvFormat(lines)
  }

  // テキスト形式のパース
  let currentDate = ''
  let currentTime = ''
  let currentFoods: FoodItem[] = []
  let entryId = 0

  const flushEntry = () => {
    if (currentDate && currentTime && currentFoods.length > 0) {
      entries.push({
        id: String(++entryId),
        date: currentDate,
        time: currentTime,
        foods: [...currentFoods],
      })
    }
    currentFoods = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 日付行: 2026/03/10 or 2026-03-10
    const dateMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
    if (dateMatch) {
      flushEntry()
      const [, y, m, d] = dateMatch
      currentDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      currentTime = ''
      continue
    }

    // 時刻 + 離乳食行: 07:30 離乳食
    const timeMatch = trimmed.match(/^(\d{1,2}:\d{2})\s+離乳食/)
    if (timeMatch) {
      flushEntry()
      currentTime = timeMatch[1]
      continue
    }

    // インデントされた食材行
    if (line.startsWith('  ') || line.startsWith('\t')) {
      const foodMatch = trimmed.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*g\s*$/)
      if (foodMatch) {
        currentFoods.push({
          name: foodMatch[1].trim(),
          grams: Number(foodMatch[2]),
          raw: trimmed,
        })
      } else {
        skipped++
      }
      continue
    }

    // マッチしない行はスキップ
    skipped++
  }

  flushEntry()
  return { entries, skipped }
}

function parseCsvFormat(lines: string[]): { entries: MealEntry[]; skipped: number } {
  const entries: MealEntry[] = []
  let skipped = 0
  let entryId = 0

  // ヘッダー行をスキップ
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // CSV パース（簡易版: ダブルクォートに対応）
    const parts = parseCsvLine(line)
    if (parts.length < 3) {
      skipped++
      continue
    }

    const [datetime, category, memo] = parts

    if (!category.includes('離乳食')) {
      continue
    }

    const dateTimeMatch = datetime.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}:\d{2})/)
    if (!dateTimeMatch) {
      skipped++
      continue
    }

    const [, y, m, d, time] = dateTimeMatch
    const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    const foods = parseFoodLine(memo.replace(/^"|"$/g, ''))

    if (foods.length > 0) {
      entries.push({ id: String(++entryId), date, time, foods })
    }
  }

  return { entries, skipped }
}

function parseCsvLine(line: string): string[] {
  const parts: string[] = []
  let current = ''
  let inQuotes = false

  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      parts.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  parts.push(current.trim())
  return parts
}
