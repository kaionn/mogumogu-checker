# もぐもぐチェッカー 実装 Plan

## 技術選定

| レイヤー | 選定 | コスト | 理由 |
|----------|------|--------|------|
| フロントエンド | Vite + React + TypeScript | $0 | 軽量、高速ビルド |
| スタイリング | Tailwind CSS v4 | $0 | モバイルファースト、ユーティリティベース |
| API プロキシ | Cloudflare Pages Functions | $0 | 無料枠: 10万リクエスト/日 |
| AI 解析 | Gemini API（gemini-2.0-flash） | $0 | 無料枠: 15 RPM、100万トークン/日 |
| ホスティング | Cloudflare Pages | $0 | 帯域無制限、カスタムドメイン無料 |

## アーキテクチャ

```
[スマホブラウザ]
    ├── ぴよログ CSV アップロード → クライアントサイドでパース
    ├── プロフィール入力 → localStorage に保存
    └── 「解析する」ボタン
          ↓ POST /api/analyze
    [Cloudflare Pages Functions]
          ├── Gemini API キーは環境変数で管理
          ├── リクエストを Gemini API に中継
          └── JSON レスポンスを返却
          ↓
    [結果表示] スコア、栄養素バー、おすすめ食材、アドバイス
```

## ディレクトリ構成

```
mogumogu-checker/
├── src/
│   ├── components/
│   │   ├── ProfileForm.tsx        # プロフィール入力
│   │   ├── FileUpload.tsx         # ぴよログ CSV 取り込み
│   │   ├── ManualInput.tsx        # 手動入力（フォールバック）
│   │   ├── AnalyzeButton.tsx      # 解析実行ボタン
│   │   ├── ScoreDisplay.tsx       # 総合スコア円形メーター
│   │   ├── NutrientBar.tsx        # 栄養素プログレスバー
│   │   ├── Suggestions.tsx        # おすすめ食材
│   │   └── Tips.tsx               # 次の一手アドバイス
│   ├── lib/
│   │   ├── piyolog-parser.ts      # ぴよログ CSV パーサー
│   │   ├── api-client.ts          # /api/analyze 呼び出し
│   │   ├── local-analyzer.ts      # オフライン時フォールバック計算
│   │   ├── food-db.ts             # 食材データベース（モックアップから移植）
│   │   └── nutrient-targets.ts    # 月齢別推奨栄養量
│   ├── hooks/
│   │   ├── useProfile.ts          # プロフィール状態 + localStorage 永続化
│   │   └── useAnalysis.ts         # 解析状態管理（loading/result/error）
│   ├── types/
│   │   └── index.ts               # 型定義
│   ├── App.tsx
│   └── main.tsx
├── functions/
│   └── api/
│       └── analyze.ts             # Cloudflare Pages Function（Gemini プロキシ）
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── wrangler.toml                  # Cloudflare 設定
```

## 実装ステップ

### Step 1: プロジェクトセットアップ `cc:TODO`

- [ ] Vite + React + TypeScript プロジェクト作成
- [ ] Tailwind CSS v4 導入
- [ ] ディレクトリ構成作成
- [ ] 型定義（`types/index.ts`）

### Step 2: データ層 `cc:TODO`

- [ ] `food-db.ts` — モックアップの `foodDb`（90種類+）を TypeScript に移植
- [ ] `nutrient-targets.ts` — モックアップの `ageBasedTargets` を移植
- [ ] `local-analyzer.ts` — モックアップの計算ロジックを移植（フォールバック用）

### Step 3: UI コンポーネント（結果表示） `cc:TODO`

- [ ] `ScoreDisplay.tsx` — 円形メーター（CSS conic-gradient）
- [ ] `NutrientBar.tsx` — 栄養素プログレスバー（十分/あと少し/不足）
- [ ] `Suggestions.tsx` — おすすめ食材タグ
- [ ] `Tips.tsx` — 次の一手アドバイス

### Step 4: 入力系 UI `cc:TODO`

- [ ] `ProfileForm.tsx` — 月齢、体重、授乳回数、離乳食回数
- [ ] `ManualInput.tsx` — テキストエリア + クイック追加ボタン（モックアップ踏襲）
- [ ] `FileUpload.tsx` — ぴよログ CSV アップロード
- [ ] `useProfile.ts` — localStorage 永続化フック

### Step 5: ぴよログパーサー `cc:TODO`

- [ ] `piyolog-parser.ts` — CSV/テキスト形式のパース
- [ ] 日付、時刻、食材名、グラム数を抽出
- [ ] パース失敗行のスキップとエラー通知

### Step 6: Cloudflare Pages Function（Gemini API プロキシ） `cc:TODO`

- [ ] `functions/api/analyze.ts` — POST リクエストを受けて Gemini API に中継
- [ ] Gemini プロンプト構築（月齢、体重、食材リスト → JSON レスポンス）
- [ ] エラーハンドリング（タイムアウト、レート制限）
- [ ] `wrangler.toml` — 環境変数設定

### Step 7: 解析フロー結合 `cc:TODO`

- [ ] `useAnalysis.ts` — API 呼び出し + loading/result/error 状態管理
- [ ] `api-client.ts` — /api/analyze 呼び出しクライアント
- [ ] API エラー時に `local-analyzer.ts` へフォールバック
- [ ] `App.tsx` — 全コンポーネントの結合

### Step 8: PWA 対応 `cc:TODO`

- [ ] manifest.json
- [ ] Service Worker（Vite PWA Plugin）
- [ ] ホーム画面追加対応

## Cloudflare Pages Function の実装方針

```typescript
// functions/api/analyze.ts
export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();

  const prompt = buildPrompt(body.profile, body.foods);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    }
  );

  const data = await response.json();
  // パースしてクライアントに返却
}
```

## Gemini API キー設定手順

```bash
# ローカル開発
echo "GEMINI_API_KEY=your-key-here" > .dev.vars

# 本番（Cloudflare ダッシュボード or CLI）
npx wrangler pages secret put GEMINI_API_KEY
```

## フォールバック戦略

```
API 呼び出し
  ↓ 成功 → Gemini の解析結果を表示（source: 'gemini'）
  ↓ 失敗（タイムアウト / エラー / オフライン）
ローカル食材 DB で計算 → 簡易結果を表示（source: 'local'）
  ※「AI 解析ではなくローカル計算の結果です」と明示
```
