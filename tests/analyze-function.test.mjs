import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const quietConsole = { log() {}, warn() {}, error() {}, info() {}, debug() {} }

function load(path, fetchImpl = () => { throw Error('No external fetch allowed') }) {
  const { outputFiles } = buildSync({ entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'cjs' })
  const module = { exports: {} }
  vm.runInNewContext(outputFiles[0].text, { module, exports: module.exports,
    require: createRequire(import.meta.url), fetch: fetchImpl, Response, console: quietConsole, Date })
  return module.exports
}

const profile = { months: 8, weight: 8, milkPerDay: 5, mealsPerDay: 2 }
const date = '2026-10-05'
const env = { GEMINI_API_KEY: 'test-key' }
const geminiResult = { score: 72, summary: 'ok', nutrients: {}, deficiencies: [], tips: [] }

function postRequest(body) {
  return new Request('https://example.test/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function geminiReply(text) {
  return Response.json({ candidates: [{ content: { parts: [{ text }] } }] })
}

const mustNotCallGemini = () => { throw Error('Gemini must not be called') }

async function call(body, fetchImpl = mustNotCallGemini, callEnv = env) {
  const { onRequestPost } = load('functions/api/analyze.ts', fetchImpl)
  const response = await onRequestPost({ request: postRequest(body), env: callEnv })
  return { status: response.status, json: await response.json() }
}

test('valid input sends date and foods to Gemini and returns its JSON with date', async () => {
  let prompt
  const result = await call({ profile, foods: '粥 50g, 鮭 10g', date }, async (_url, options) => {
    prompt = JSON.parse(options.body).contents[0].parts[0].text
    return geminiReply(JSON.stringify(geminiResult))
  })
  assert.equal(result.status, 200)
  assert.deepEqual(result.json, { ...geminiResult, date })
  assert.ok(prompt.includes(date))
  assert.ok(prompt.includes('粥 50g, 鮭 10g'))
})

test('valid input without date returns a YYYY-MM-DD date', async () => {
  const result = await call({ profile, foods: '鮭 10g' }, async () => geminiReply(JSON.stringify(geminiResult)))
  assert.equal(result.status, 200)
  assert.match(result.json.date, /^\d{4}-\d{2}-\d{2}$/)
})

test('missing API key returns 500 before reading the body', async () => {
  const result = await call('not json', mustNotCallGemini, {})
  assert.deepEqual(result, { status: 500, json: { error: 'API key not configured' } })
})

test('body that is not JSON returns 400', async () => {
  assert.deepEqual(await call('{oops'), { status: 400, json: { error: 'Invalid request body' } })
})

for (const [name, raw] of [['null', 'null'], ['array', '[]'], ['number', '42'], ['string', '"text"']]) {
  test(`JSON body that is ${name} returns 400 without calling Gemini`, async () => {
    assert.deepEqual(await call(raw), { status: 400, json: { error: 'Invalid request body' } })
  })
}

const badProfiles = [
  ['missing profile', undefined],
  ['profile null', null],
  ['profile array', []],
  ['months missing', { weight: 8, milkPerDay: 5, mealsPerDay: 2 }],
  ['months as string', { ...profile, months: '8' }],
  ['weight null', { ...profile, weight: null }],
  ['milkPerDay as string', { ...profile, milkPerDay: 'five' }],
  ['mealsPerDay as boolean', { ...profile, mealsPerDay: true }],
]
for (const [name, badProfile] of badProfiles) {
  test(`${name} returns 400 without calling Gemini`, async () => {
    assert.deepEqual(await call({ profile: badProfile, foods: '鮭 10g', date }), { status: 400, json: { error: 'Invalid request body' } })
  })
}

test('non-finite profile number returns 400 without calling Gemini', async () => {
  // JSON cannot carry Infinity/NaN, so pass a request whose json() yields them.
  const { onRequestPost } = load('functions/api/analyze.ts', mustNotCallGemini)
  for (const value of [Infinity, NaN]) {
    const response = await onRequestPost({ request: { json: async () => ({ profile: { ...profile, weight: value }, foods: '鮭 10g' }) }, env })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'Invalid request body' })
  }
})

for (const [name, foods] of [['missing', undefined], ['empty', ''], ['whitespace only', ' \n\t '], ['a number', 10], ['an array', ['鮭']]]) {
  test(`foods ${name} returns 400 without calling Gemini`, async () => {
    assert.deepEqual(await call({ profile, foods, date }), { status: 400, json: { error: 'Invalid request body' } })
  })
}

for (const badDate of ['2026/10/05', 20261005, '']) {
  test(`malformed date ${JSON.stringify(badDate)} returns 400`, async () => {
    assert.deepEqual(await call({ profile, foods: '鮭 10g', date: badDate }), { status: 400, json: { error: 'Invalid analysis date' } })
  })
}

test('Gemini error status returns 502', async () => {
  const result = await call({ profile, foods: '鮭 10g', date }, async () => new Response('quota', { status: 429 }))
  assert.deepEqual(result, { status: 502, json: { error: 'AI analysis failed' } })
})

test('Gemini reply without text returns 502', async () => {
  const result = await call({ profile, foods: '鮭 10g', date }, async () => Response.json({ candidates: [] }))
  assert.deepEqual(result, { status: 502, json: { error: 'Empty response from AI' } })
})

test('Gemini text that is not JSON returns 502', async () => {
  const result = await call({ profile, foods: '鮭 10g', date }, async () => geminiReply('Sorry, here is the analysis: score 70'))
  assert.deepEqual(result, { status: 502, json: { error: 'Invalid response from AI' } })
})

test('fetch that throws returns 500', async () => {
  const result = await call({ profile, foods: '鮭 10g', date }, async () => { throw new TypeError('network down') })
  assert.deepEqual(result, { status: 500, json: { error: 'Analysis failed' } })
})
