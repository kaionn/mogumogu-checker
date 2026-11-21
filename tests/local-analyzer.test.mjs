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

const { calculateTargets, getBaseTargets } = load('src/lib/nutrient-targets.ts')
const { analyzeLocally } = load('src/lib/local-analyzer.ts')

const keys = ['energy', 'protein', 'iron', 'calcium', 'vitaminC', 'veggies']
const plain = obj => JSON.parse(JSON.stringify(obj))
const food = (name, grams) => ({ name, grams, raw: `${name} ${grams}g` })
// 補正が掛からない条件（体重 < 9.5、授乳 < 6、食事 < 3）
const neutral = [8, 5, 2]

function assertScoreInRange(result) {
  assert.equal(typeof result.score, 'number')
  assert.ok(Number.isFinite(result.score), `score is not finite: ${result.score}`)
  assert.ok(result.score >= 0 && result.score <= 100, `score out of range: ${result.score}`)
}

test('targets are the same within each age band', () => {
  assert.deepEqual(plain(calculateTargets(5, ...neutral)), plain(calculateTargets(6, ...neutral)))
  assert.deepEqual(plain(calculateTargets(7, ...neutral)), plain(calculateTargets(8, ...neutral)))
  assert.deepEqual(plain(calculateTargets(9, ...neutral)), plain(calculateTargets(11, ...neutral)))
  assert.deepEqual(plain(calculateTargets(12, ...neutral)), plain(calculateTargets(18, ...neutral)))
})

test('targets switch to a different band at 6/7, 8/9 and 11/12 months', () => {
  for (const [before, after] of [[6, 7], [8, 9], [11, 12]]) {
    assert.notDeepEqual(plain(calculateTargets(before, ...neutral)), plain(calculateTargets(after, ...neutral)), `${before}/${after}`)
  }
  // エネルギーは月齢が上がるほど増える
  const energies = [5, 7, 9, 12].map(m => calculateTargets(m, ...neutral).energy)
  for (let i = 1; i < energies.length; i++) assert.ok(energies[i] > energies[i - 1], `energies: ${energies}`)
})

test('neutral profile returns the base targets of the band unchanged', () => {
  for (const m of [5, 7, 9, 12]) {
    assert.deepEqual(plain(calculateTargets(m, ...neutral)), plain(getBaseTargets(m)))
  }
  // 帯の代表値を 1 つ固定
  assert.equal(getBaseTargets(5).energy, 140)
})

test('months outside the bands (4, 0, negative, NaN) still give complete positive targets', () => {
  // 4/5 の境目: 5 か月は 5〜6 の帯、4 か月はその帯ではない
  assert.notDeepEqual(plain(getBaseTargets(4)), plain(getBaseTargets(5)))
  for (const m of [4, 0, -1, Number.NaN, 100]) {
    const targets = calculateTargets(m, ...neutral)
    for (const key of keys) {
      assert.ok(Number.isFinite(targets[key]) && targets[key] > 0, `months=${m} ${key}=${targets[key]}`)
    }
    assertScoreInRange(analyzeLocally([food('鮭', 10)], m, ...neutral, '2026-10-05'))
  }
})

test('weight >= 9.5 kg raises energy only', () => {
  const light = calculateTargets(9, 9.4, 5, 2)
  const heavy = calculateTargets(9, 9.5, 5, 2)
  assert.ok(heavy.energy > light.energy)
  for (const key of keys.filter(k => k !== 'energy')) assert.equal(heavy[key], light[key], key)
})

test('milk >= 6 times lowers energy and protein only', () => {
  const few = calculateTargets(9, 8, 5, 2)
  const many = calculateTargets(9, 8, 6, 2)
  assert.ok(many.energy < few.energy)
  assert.ok(many.protein < few.protein)
  for (const key of ['iron', 'calcium', 'vitaminC', 'veggies']) assert.equal(many[key], few[key], key)
})

test('meals >= 3 times raises energy and veggies only', () => {
  const two = calculateTargets(9, 8, 5, 2)
  const three = calculateTargets(9, 8, 5, 3)
  assert.ok(three.energy > two.energy)
  assert.ok(three.veggies > two.veggies)
  for (const key of ['protein', 'iron', 'calcium', 'vitaminC']) assert.equal(three[key], two[key], key)
})

test('corrections do not leak into later calls', () => {
  const before = plain(calculateTargets(9, ...neutral))
  calculateTargets(9, 10, 8, 3)
  calculateTargets(9, 10, 8, 3)
  assert.deepEqual(plain(calculateTargets(9, ...neutral)), before)
})

test('analysis reports the targets of the profile', () => {
  const result = analyzeLocally([food('鮭', 10)], 12, 10, 6, 3, '2026-10-05')
  const targets = calculateTargets(12, 10, 6, 3)
  for (const key of ['energy', 'protein', 'iron', 'calcium', 'vitaminC']) {
    assert.equal(result.nutrients[key].target, Math.round(targets[key] * 10) / 10, key)
  }
  assert.notEqual(result.nutrients.energy.target, analyzeLocally([food('鮭', 10)], 11, 10, 6, 3).nutrients.energy.target)
})

test('foods missing from food-db count as zero', () => {
  const unknownOnly = analyzeLocally([food('ドラゴンフルーツ', 100)], 9, ...neutral, '2026-10-05')
  for (const key of ['energy', 'protein', 'iron', 'calcium', 'vitaminC']) {
    assert.equal(unknownOnly.nutrients[key].intake, 0, key)
    assert.equal(unknownOnly.nutrients[key].percentage, 0, key)
  }
  assert.equal(unknownOnly.score, 0)

  const known = [food('鮭', 15), food('にんじん', 20)]
  const withUnknown = [...known, food('ドラゴンフルーツ', 100)]
  assert.deepEqual(plain(analyzeLocally(withUnknown, 9, ...neutral, '2026-10-05')), plain(analyzeLocally(known, 9, ...neutral, '2026-10-05')))
})

test('known foods add intake and more grams give more intake', () => {
  const small = analyzeLocally([food('鮭', 10)], 9, ...neutral, '2026-10-05')
  const large = analyzeLocally([food('鮭', 30)], 9, ...neutral, '2026-10-05')
  assert.ok(small.nutrients.protein.intake > 0)
  assert.ok(large.nutrients.protein.intake > small.nutrients.protein.intake)
  assert.ok(large.score >= small.score)
})

test('empty input gives score 0 and lists deficiencies', () => {
  const result = analyzeLocally([], 9, ...neutral, '2026-10-05')
  assert.equal(result.score, 0)
  assert.equal(result.source, 'local')
  assert.ok(result.deficiencies.length > 0)
  assert.ok(result.tips.length > 0)
})

test('score stays within 0..100 for large amounts', () => {
  const lots = ['ごはん', '鮭', 'ほうれん草', 'ヨーグルト', 'いちご', 'にんじん'].map(name => food(name, 1000))
  for (const m of [5, 7, 9, 12]) assertScoreInRange(analyzeLocally(lots, m, ...neutral, '2026-10-05'))
})

test('score stays within 0..100 for zero and negative grams', () => {
  assertScoreInRange(analyzeLocally([food('鮭', 0)], 9, ...neutral, '2026-10-05'))
  assertScoreInRange(analyzeLocally([food('鮭', -50)], 9, ...neutral, '2026-10-05'))
})

test('date is kept in the result', () => {
  assert.equal(analyzeLocally([food('鮭', 10)], 9, ...neutral, '2026-01-31').date, '2026-01-31')
  assert.equal(analyzeLocally([], 9, ...neutral, '2026-12-01').date, '2026-12-01')
  assert.match(analyzeLocally([], 9, ...neutral).date, /^\d{4}-\d{2}-\d{2}$/)
})
