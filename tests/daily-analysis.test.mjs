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

function loadReact(path, hooks, extras = {}) {
  const { outputFiles } = buildSync({ entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/jsx-runtime'] })
  const module = { exports: {} }
  const jsx = (type, props) => ({ type, props })
  vm.runInNewContext(outputFiles[0].text, { module, exports: module.exports, require: name => name === 'react' ? hooks : { jsx, jsxs: jsx }, fetch: extras.fetch, Response, console, Date, ...extras })
  return module.exports
}

test('reset and newer analysis discard older asynchronous responses', async () => {
  let state
  const pending = []
  const hooks = { useState: () => [state, value => { state = value }], useRef: value => ({ current: value }), useCallback: callback => callback }
  const { useAnalysis } = loadReact('src/hooks/useAnalysis.ts', hooks, { fetch: () => new Promise(resolve => pending.push(resolve)) })
  const analysis = useAnalysis()
  const old = analysis.analyze('鮭 10g', profile, firstDate)
  analysis.reset()
  pending.shift()(Response.json({ nutrients: {}, score: 50, deficiencies: [], tips: [] }))
  await old
  assert.equal(state.status, 'idle')
  const first = analysis.analyze('鮭 10g', profile, firstDate)
  const second = analysis.analyze('バナナ 15g', profile, secondDate)
  pending[1](Response.json({ nutrients: {}, score: 70, deficiencies: [], tips: [] }))
  await second
  pending[0](Response.json({ nutrients: {}, score: 50, deficiencies: [], tips: [] }))
  await first
  assert.equal(state.result.date, secondDate)
})

test('latest file wins and unmounted upload cannot apply a late read', () => {
  let cleanup
  const readers = []
  class Reader {
    constructor() { readers.push(this) }
    readAsText() {}
    abort() { this.aborted = true }
    finish(text) { this.onload({ target: { result: text } }) }
  }
  const hooks = { useRef: value => ({ current: value }), useEffect: effect => { cleanup = effect() } }
  const loaded = []
  const { FileUpload } = loadReact('src/components/FileUpload.tsx', hooks, { FileReader: Reader })
  const tree = FileUpload({ onFileLoad: text => loaded.push(text) })
  const input = tree.props.children[1].props.children[1]
  input.props.onChange({ target: { files: [{}] } })
  input.props.onChange({ target: { files: [{}] } })
  assert.equal(readers[0].aborted, true)
  readers[1].finish('latest')
  readers[0].finish('old')
  assert.deepEqual(loaded, ['latest'])
  cleanup()
  readers[1].finish('unmounted')
  assert.deepEqual(loaded, ['latest'])
})

test('manual analysis date follows local date across UTC midnight', () => {
  const { localToday } = load('src/lib/meal-days.ts')
  assert.equal(localToday(new Date(2026, 9, 14, 0, 1)), '2026-10-14')
  assert.equal(localToday(new Date(2026, 9, 13, 23, 59)), '2026-10-13')
})
