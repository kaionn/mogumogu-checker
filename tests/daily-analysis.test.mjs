import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
import vm from 'node:vm'

function load(path, fetchImpl = () => { throw Error('No external fetch allowed') }) {
  const { outputFiles } = buildSync({ entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'cjs' })
  const module = { exports: {} }
  vm.runInNewContext(outputFiles[0].text, { module, exports: module.exports,
    require: createRequire(import.meta.url), fetch: fetchImpl, Response, console, Date })
  return module.exports
}

const profile = { months: 8, weight: 8, milkPerDay: 5, mealsPerDay: 2 }
const firstDate = '2026-10-05'
const secondDate = '2026-10-06'
const fixture = '2026/10/05\n07:30 離乳食\n  粥 50g\n18:30 離乳食\n  鮭 10g\n2026/10/06\n07:30 離乳食\n  バナナ 15g\n'

test('two days remain separate, including meals on the same day', () => {
  const { entries } = load('src/lib/piyolog-parser.ts').parsePiyologText(fixture)
  const { groupMealsByDate } = load('src/lib/meal-days.ts')
  const days = groupMealsByDate(entries)
  assert.equal(days[firstDate], '粥 50g, 鮭 10g')
  assert.equal(days[secondDate], 'バナナ 15g')
  assert.equal(Object.keys(days).length, 2)
})

test('single-day CSV import preserves its date and foods', () => {
  const { entries } = load('src/lib/piyolog-parser.ts').parsePiyologText('日時,カテゴリ,メモ\n2026/10/05 07:30,離乳食,"粥 50g, 鮭 10g"')
  const days = load('src/lib/meal-days.ts').groupMealsByDate(entries)
  assert.deepEqual(Object.keys(days), [firstDate])
  assert.equal(days[firstDate], '粥 50g, 鮭 10g')
})

test('API request carries selected date and only selected foods', async () => {
  let request
  const client = load('src/lib/api-client.ts', async (_url, options) => {
    request = JSON.parse(options.body)
    return Response.json({})
  })
  await client.callAnalyzeApi(profile, '粥 50g, 鮭 10g', firstDate)
  assert.equal(request.date, firstDate)
  assert.equal(request.foods, '粥 50g, 鮭 10g')
  assert.ok(!request.foods.includes('バナナ'))
})

test('local fallback retains selected date; manual default still works', () => {
  const { analyzeLocally } = load('src/lib/local-analyzer.ts')
  const foods = [{ name: '鮭', grams: 10, raw: '鮭 10g' }]
  assert.equal(analyzeLocally(foods, 8, 8, 5, 2, firstDate).date, firstDate)
  assert.match(analyzeLocally(foods, 8, 8, 5, 2).date, /^\d{4}-\d{2}-\d{2}$/)
})

test('server prompt and result retain requested date', async () => {
  let prompt
  const { onRequestPost } = load('functions/api/analyze.ts', async (_url, options) => {
    prompt = JSON.parse(options.body).contents[0].parts[0].text
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"score":50}' }] } }] })
  })
  const response = await onRequestPost({ env: { GEMINI_API_KEY: 'dummy' }, request: { json: async () => ({ profile, foods: '鮭 10g', date: firstDate }) } })
  assert.equal(response.status, 200)
  assert.ok(prompt.includes(firstDate))
  assert.ok(!prompt.includes('今日の離乳食'))
  assert.equal((await response.json()).date, firstDate)
})

test('analysis pipeline retains selected date for API and fallback results', async () => {
  const api = load('src/lib/analyze-meal.ts', async () => Response.json({ nutrients: {}, score: 50, summary: 'dummy', deficiencies: [], tips: [] }))
  assert.equal((await api.analyzeMeal('鮭 10g', profile, firstDate)).date, firstDate)
  const fallback = load('src/lib/analyze-meal.ts')
  const result = await fallback.analyzeMeal('鮭 10g', profile, secondDate)
  assert.equal(result.date, secondDate)
  assert.equal(result.source, 'local')
})
