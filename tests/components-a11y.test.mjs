import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function load(path, fetchImpl = () => { throw Error('No external fetch allowed') }) {
  const { outputFiles } = buildSync({
    entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'cjs',
    jsx: 'automatic', external: ['react', 'react-dom'],
  })
  const module = { exports: {} }
  vm.runInNewContext(outputFiles[0].text, { module, exports: module.exports,
    require, fetch: fetchImpl, Response, console, Date })
  return module.exports
}

function render(path, name, props) {
  return renderToStaticMarkup(React.createElement(load(path)[name], props))
}

// 開始タグの属性を { 名前: 値 } にする
function attrs(tag) {
  const out = {}
  for (const m of tag.matchAll(/([a-zA-Z_:][-\w:.]*)(?:="([^"]*)")?/g)) {
    if (m.index === 0) continue
    out[m[1]] = m[2] ?? ''
  }
  return out
}

// 条件に合う開始タグを全部返す
function findTags(html, pred) {
  return [...html.matchAll(/<([a-zA-Z][\w-]*)(?:\s[^>]*)?>/g)]
    .map(m => ({ name: m[1], attrs: attrs(m[0]) }))
    .filter(pred)
}

const classes = t => (t.attrs.class ?? '').split(/\s+/)
const unescape = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

// ---- NutrientBar ----
function bar(percentage, label = '鉄') {
  const html = render('src/components/NutrientBar.tsx', 'NutrientBar', {
    label, unit: 'mg', status: { intake: 3, target: 5, unit: 'mg', percentage },
  })
  const bars = findTags(html, t => t.attrs.role === 'progressbar')
  assert.equal(bars.length, 1, html)
  return bars[0].attrs
}

test('NutrientBar は栄養素名つきの progressbar を描く', () => {
  const a = bar(60, '鉄')
  assert.equal(a['aria-label'], '鉄')
  assert.equal(a['aria-valuemin'], '0')
  assert.equal(a['aria-valuemax'], '100')
  assert.equal(a['aria-valuenow'], '60')
})

test('NutrientBar は 100% 超えでは valuenow を 100 に留め、実際の割合を valuetext で伝える', () => {
  const a = bar(135)
  assert.equal(a['aria-valuemax'], '100')
  assert.equal(a['aria-valuenow'], '100')
  assert.match(a['aria-valuetext'], /135%/)
})

test('NutrientBar は負の値や数でない値で範囲を外れない', () => {
  assert.equal(bar(-5)['aria-valuenow'], '0')
  assert.equal(bar(Number.NaN)['aria-valuenow'], '0')
})

test('NutrientBar の valuetext は割合と評価を含む', () => {
  assert.equal(bar(60)['aria-valuetext'], '60% 不足')
  assert.equal(bar(95)['aria-valuetext'], '95% 十分')
})

// ---- ScoreDisplay ----
test('ScoreDisplay は点数を読み上げられる名前を持ち、数字を二重に読ませない', () => {
  const html = render('src/components/ScoreDisplay.tsx', 'ScoreDisplay', { score: 72, summary: 'よくできています' })
  const imgs = findTags(html, t => t.attrs.role === 'img')
  assert.equal(imgs.length, 1, html)
  assert.equal(imgs[0].attrs['aria-label'], '総合スコア 72 点')
  // 見えている数字は aria-hidden の中にある
  const hidden = html.match(/<span[^>]*aria-hidden="true"[^>]*>(\d+)<\/span>/)
  assert.ok(hidden, html)
  assert.equal(hidden[1], '72')
  assert.match(html, /よくできています/)
})

// ---- FileUpload ----
test('FileUpload の input は見た目だけ隠し、Tab で届き、名前を持つ', () => {
  const html = render('src/components/FileUpload.tsx', 'FileUpload', { onFileLoad: () => {} })
  const inputs = findTags(html, t => t.name === 'input' && t.attrs.type === 'file')
  assert.equal(inputs.length, 1, html)
  const input = inputs[0]
  assert.ok(!classes(input).includes('hidden'), 'display:none の hidden を使わない')
  assert.ok(classes(input).includes('sr-only'))
  assert.ok(!('tabindex' in input.attrs) || Number(input.attrs.tabindex) >= 0)
  assert.ok(!('disabled' in input.attrs))
  assert.equal(unescape(input.attrs['aria-label'] ?? ''), 'ぴよログの CSV / テキストファイルを選択')
  assert.equal(input.attrs.accept, '.csv,.txt,.text')
  // input にフォーカスがあるとき、見える枠を出す要素がある（label を group にして has-focus-visible で枠を出す）
  const ringed = findTags(html, t => classes(t).some(c => /focus-visible:ring-2$/.test(c)))
  assert.ok(ringed.length >= 1, html)
  const label = findTags(html, t => t.name === 'label')
  assert.equal(label.length, 1)
  assert.ok(classes(label[0]).includes('group'))
  assert.match(html, /<label[^>]*>[\s\S]*<input[^>]*>[\s\S]*<\/label>/, 'input は label の中にある')
})

// ---- Suggestions ----
test('Suggestions は不足ごとに ul > li で並べ、食材も ul > li にする', () => {
  const html = render('src/components/Suggestions.tsx', 'Suggestions', {
    deficiencies: [
      { nutrient: 'iron', reason: '鉄が足りません', suggestions: ['赤身魚', 'レバー'] },
      { nutrient: 'protein', reason: 'たんぱく質が足りません', suggestions: ['豆腐'] },
    ],
  })
  const outer = html.match(/<ul class="space-y-2">([\s\S]*)<\/ul><\/div>$/)
  assert.ok(outer, html)
  const items = findTags(html, t => t.name === 'li' && classes(t).includes('bg-orange-50'))
  assert.equal(items.length, 2)
  const chips = findTags(html, t => t.name === 'li' && classes(t).includes('bg-orange-200'))
  assert.equal(chips.length, 3)
  assert.equal(findTags(html, t => t.name === 'ul').length, 3)
  assert.match(html, /鉄が足りません/)
  assert.match(html, /<li[^>]*>赤身魚<\/li>/)
})

test('Suggestions は不足が無ければ空のリストを描かない', () => {
  const html = render('src/components/Suggestions.tsx', 'Suggestions', { deficiencies: [] })
  assert.equal(findTags(html, t => t.name === 'ul' || t.name === 'li').length, 0)
  assert.match(html, /大きな不足は少なめ/)
})

// ---- Tips ----
test('Tips は ul > li で並べ、見た目の class を保つ', () => {
  const html = render('src/components/Tips.tsx', 'Tips', { tips: ['一口目は少量から', '鉄を意識して'] })
  const lists = findTags(html, t => t.name === 'ul')
  assert.equal(lists.length, 1, html)
  assert.ok(classes(lists[0]).includes('space-y-2'))
  const items = [...html.matchAll(/<li class="([^"]*)">([^<]*)<\/li>/g)]
  assert.deepEqual(items.map(m => m[2]), ['一口目は少量から', '鉄を意識して'])
  for (const m of items) assert.ok(m[1].split(' ').includes('bg-blue-50'))
})
