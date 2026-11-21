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

const { parsePiyologText } = load('src/lib/piyolog-parser.ts')

// vm の中で作られた配列やオブジェクトを、この realm の普通の値にそろえて比べる
const plain = value => JSON.parse(JSON.stringify(value))

const textFixture = [
  '2026/10/05',
  '07:30 離乳食',
  '  7倍粥 50g',
  '  鮭 10g',
  '18:30 離乳食',
  '  ほうれん草 5.5g',
  '2026-10-6',
  '07:30 離乳食',
  '\tバナナ 15g',
  '',
].join('\n')

test('text format: entries are split by date line and by meal time', () => {
  const result = plain(parsePiyologText(textFixture))
  assert.deepEqual(result, {
    entries: [
      { id: '1', date: '2026-10-05', time: '07:30', foods: [
        { name: '7倍粥', grams: 50, raw: '7倍粥 50g' },
        { name: '鮭', grams: 10, raw: '鮭 10g' },
      ] },
      { id: '2', date: '2026-10-05', time: '18:30', foods: [
        { name: 'ほうれん草', grams: 5.5, raw: 'ほうれん草 5.5g' },
      ] },
      { id: '3', date: '2026-10-06', time: '07:30', foods: [
        { name: 'バナナ', grams: 15, raw: 'バナナ 15g' },
      ] },
    ],
    skipped: 0,
  })
})

test('text format: a meal with no food lines produces no entry', () => {
  const { entries, skipped } = parsePiyologText('2026/10/05\n07:30 離乳食\n12:00 離乳食\n  粥 30g\n')
  assert.equal(entries.length, 1)
  assert.equal(entries[0].time, '12:00')
  assert.equal(skipped, 0)
})

test('text format: non-weaning-food lines and food lines without grams are counted as skipped', () => {
  const text = [
    '2026/10/05',
    '06:00 ミルク 200ml',
    '07:30 離乳食',
    '  粥',
    '  鮭 10g',
    'メモ: よく食べた',
    '',
  ].join('\n')
  const result = plain(parsePiyologText(text))
  // テキスト形式では、グラム表記の無い食材行は 10g にはならず、skipped に数えられる
  assert.deepEqual(result.entries, [
    { id: '1', date: '2026-10-05', time: '07:30', foods: [{ name: '鮭', grams: 10, raw: '鮭 10g' }] },
  ])
  assert.equal(result.skipped, 3)
})

test('CSV format is detected from the header and parses date, time and foods', () => {
  const csv = [
    '日時,カテゴリ,メモ',
    '2026/10/05 07:30,離乳食,"7倍粥 50g, 鮭 10g"',
    '2026/10/5 18:30,離乳食,"ほうれん草 5g"',
    '2026-10-06 07:30,離乳食,"バナナ 15g"',
  ].join('\n')
  const result = plain(parsePiyologText(csv))
  assert.deepEqual(result, {
    entries: [
      { id: '1', date: '2026-10-05', time: '07:30', foods: [
        { name: '7倍粥', grams: 50, raw: '7倍粥 50g' },
        { name: '鮭', grams: 10, raw: '鮭 10g' },
      ] },
      { id: '2', date: '2026-10-05', time: '18:30', foods: [
        { name: 'ほうれん草', grams: 5, raw: 'ほうれん草 5g' },
      ] },
      { id: '3', date: '2026-10-06', time: '07:30', foods: [
        { name: 'バナナ', grams: 15, raw: 'バナナ 15g' },
      ] },
    ],
    skipped: 0,
  })
})

test('CSV format: a food without a gram amount is treated as 10g', () => {
  const { entries } = parsePiyologText('日時,カテゴリ,メモ\n2026/10/05 07:30,離乳食,"粥 50g, 鮭, にんじん"')
  assert.deepEqual(plain(entries[0].foods), [
    { name: '粥', grams: 50, raw: '粥 50g' },
    { name: '鮭', grams: 10, raw: '鮭' },
    { name: 'にんじん', grams: 10, raw: 'にんじん' },
  ])
})

test('CSV format: other categories are left out without counting as skipped; malformed rows are skipped', () => {
  const csv = [
    '日時,カテゴリ,メモ',
    '2026/10/05 06:00,ミルク,200ml',
    '2026/10/05 07:30,離乳食,"粥 50g"',
    '2026/10/05 09:00,おしっこ,',
    'not a date,離乳食,"鮭 10g"',
    'only,two',
  ].join('\n')
  const result = plain(parsePiyologText(csv))
  assert.deepEqual(result.entries.map(e => [e.date, e.time, e.foods.map(f => f.name)]), [
    ['2026-10-05', '07:30', ['粥']],
  ])
  assert.equal(result.skipped, 2)
})

test('text without a CSV header is parsed as text format even if it contains commas', () => {
  const { entries, skipped } = parsePiyologText('2026/10/05,メモ\n2026/10/05\n07:30 離乳食\n  粥 50g\n')
  assert.equal(entries.length, 1)
  assert.equal(entries[0].date, '2026-10-05')
  assert.equal(skipped, 1)
})

test('CRLF line endings give the same result as LF (text and CSV)', () => {
  assert.deepEqual(plain(parsePiyologText(textFixture.replaceAll('\n', '\r\n'))), plain(parsePiyologText(textFixture)))
  const csv = '日時,カテゴリ,メモ\n2026/10/05 07:30,離乳食,"粥 50g, 鮭"\n2026/10/05 08:00,ミルク,200ml\n'
  const crlf = plain(parsePiyologText(csv.replaceAll('\n', '\r\n')))
  assert.deepEqual(crlf, plain(parsePiyologText(csv)))
  assert.deepEqual(crlf.entries[0].foods.map(f => [f.name, f.grams]), [['粥', 50], ['鮭', 10]])
})

test('empty or blank input returns no entries and nothing skipped', () => {
  for (const input of ['', '\n', '\r\n\r\n', '   \n\t\n']) {
    assert.deepEqual(plain(parsePiyologText(input)), { entries: [], skipped: 0 }, JSON.stringify(input))
  }
  assert.deepEqual(plain(parsePiyologText('日時,カテゴリ,メモ\r\n')), { entries: [], skipped: 0 })
})
