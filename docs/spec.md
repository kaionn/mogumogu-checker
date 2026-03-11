# もぐもぐチェッカー 仕様書

## 1. プロダクト概要

ぴよログからエクスポートされた離乳食記録を取り込み、Gemini AI が赤ちゃんの月齢・体重に応じた1日の必要栄養素と照合して過不足を解析し、結果を画面に表示するアプリ。

### 1.1 解決する課題

- ぴよログは離乳食の記録はできるが、栄養バランスの評価機能がない
- 保護者は「今日の食事で栄養が足りているのか」を判断する手段がない
- 月齢ごとの推奨栄養量を自分で調べて計算するのは現実的でない

### 1.2 ターゲットユーザー

- ぴよログで離乳食記録をつけている保護者
- 離乳食期（5〜18ヶ月）の赤ちゃんを育てている人
- 栄養バランスをざっくり確認したい人（厳密な医療判断ではない）

### 1.3 価値提案

- ぴよログのエクスポートデータをそのまま使えるため、二重入力が不要
- Gemini AI が食材名から栄養素を推定し、月齢に応じた基準と比較する
- 不足栄養素に対して具体的な食材提案を受けられる

---

## 2. プラットフォーム戦略

Web アプリ（PWA）を主軸とし、iOS アプリは WKWebView ラッパーで提供する。

| プラットフォーム | 方式 | 理由 |
|------------------|------|------|
| Web（主軸） | Next.js or Vite SPA | クロスプラットフォーム、即時デプロイ可能 |
| iOS | WKWebView ラッパー | Web アプリをそのまま表示。ファイル選択に対応 |

### 2.1 技術スタック

| レイヤー | 技術 | 備考 |
|----------|------|------|
| フロントエンド | TypeScript + React（Vite） | 型安全、コンポーネント分割 |
| スタイリング | Tailwind CSS | モバイルファースト、ユーティリティベース |
| AI 解析 | Google Gemini API（gemini-2.0-flash） | 食材→栄養素の推定、アドバイス生成 |
| API ルート | Vercel Serverless Functions or Cloudflare Workers | Gemini API キーをサーバーサイドで保持 |
| ホスティング | Vercel or Cloudflare Pages | 静的 + API ルートの統合デプロイ |
| iOS ラッパー | SwiftUI + WKWebView | 既存モックアップの方式を踏襲 |

---

## 3. 機能要件

### 3.1 ぴよログデータ取り込み

ぴよログのエクスポート形式に対応し、離乳食記録を自動的にパースする。

#### 受け入れ基準

1. ぴよログからエクスポートされた CSV/テキストファイルをアップロードできる
2. ファイル内の離乳食記録（日付、食材名、量）を自動的に抽出する
3. 複数日のデータが含まれる場合、日別に分割して表示する
4. パース結果をユーザーに確認画面で提示し、修正できるようにする
5. パースできない行はスキップし、スキップした旨を通知する

#### ぴよログエクスポート形式（想定）

ぴよログの正確なエクスポート形式は実データで検証が必要。以下は想定フォーマット:

```
# パターン A: テキスト形式
2026/03/10
07:30 離乳食
  7倍粥 50g
  鮭 10g
  ほうれん草 10g
12:00 離乳食
  うどん 45g
  豆腐 20g
  にんじん 15g

# パターン B: CSV 形式
日時,カテゴリ,メモ
2026/03/10 07:30,離乳食,"7倍粥 50g, 鮭 10g, ほうれん草 10g"
2026/03/10 12:00,離乳食,"うどん 45g, 豆腐 20g, にんじん 15g"
```

実装時に実際のエクスポートデータで形式を確認し、パーサーを調整する。

### 3.2 赤ちゃんプロフィール入力

月齢と体重に基づいて推奨栄養量の基準を決定する。

#### 受け入れ基準

1. 月齢（5〜18ヶ月）を選択できる
2. 体重（kg）を入力できる（任意、未入力時はデフォルト係数を使用）
3. 授乳/ミルク回数を入力できる（栄養補正に使用）
4. プロフィールはローカルストレージに保存し、再訪時に復元する
5. 入力値が範囲外の場合は警告を表示する

### 3.3 Gemini AI による栄養解析

ぴよログから取り込んだ食事記録を Gemini API に送信し、栄養素の推定と評価を行う。

#### 受け入れ基準

1. ぴよログの食材リストと量を Gemini API に送信し、各食材の栄養素（エネルギー、たんぱく質、鉄、カルシウム、ビタミン C、ビタミン D）を推定させる
2. 月齢に応じた1日の推奨栄養量と比較し、各栄養素の達成率(%)を返す
3. 達成率が80%未満の栄養素について、不足を補う食材を提案する
4. 解析結果に総合コメント（所感）を含める
5. API エラー時はフォールバックとしてローカルの食材 DB（既存モックアップの `foodDb`）で簡易計算する

#### Gemini API プロンプト設計

```
あなたは離乳食の栄養アドバイザーです。

以下の条件の赤ちゃんが今日食べた離乳食の栄養バランスを評価してください。

赤ちゃんの情報:
- 月齢: {months}ヶ月
- 体重: {weight}kg
- 授乳/ミルク回数: {milk}回/日

今日の離乳食:
{food_list}

以下の JSON 形式で回答してください:
{
  "nutrients": {
    "energy": { "intake": number, "target": number, "unit": "kcal", "percentage": number },
    "protein": { "intake": number, "target": number, "unit": "g", "percentage": number },
    "iron": { "intake": number, "target": number, "unit": "mg", "percentage": number },
    "calcium": { "intake": number, "target": number, "unit": "mg", "percentage": number },
    "vitaminC": { "intake": number, "target": number, "unit": "mg", "percentage": number },
    "vitaminD": { "intake": number, "target": number, "unit": "μg", "percentage": number }
  },
  "score": number,
  "summary": "string",
  "deficiencies": [
    {
      "nutrient": "string",
      "suggestions": ["食材1", "食材2"],
      "reason": "string"
    }
  ],
  "tips": ["string"]
}
```

#### API アーキテクチャ

```
[ブラウザ] → [API Route /api/analyze] → [Gemini API]
                  ↓
            API キーはサーバーサイドで管理
            レスポンスをそのままクライアントに返却
```

### 3.4 結果表示

解析結果をわかりやすく1画面に表示する。

#### 受け入れ基準

1. 総合スコア（100点満点）を円形メーターで表示する
2. 全体の所感コメントを表示する
3. 各栄養素の達成率をプログレスバーで表示する（十分/あと少し/不足の3段階）
4. 不足栄養素に対するおすすめ食材をタグ形式で表示する
5. 次の食事へのアドバイス（次の一手）を文章で表示する
6. 日付ごとに結果を切り替えて表示できる（複数日データの場合）

### 3.5 手動入力モード（フォールバック）

ぴよログを使っていないユーザー向けに、既存モックアップの手動入力機能も維持する。

#### 受け入れ基準

1. ぴよログ取り込みと手動入力を切り替えられるタブ UI を用意する
2. 手動入力は既存モックアップのクイック追加ボタン + テキストエリア方式
3. 手動入力時も「AI で解析」ボタンで Gemini 解析を呼び出せる
4. オフライン時はローカルの食材 DB で簡易計算を行う

---

## 4. 画面構成

### 4.1 画面遷移

```
[トップ画面]
  ├── [プロフィール入力]（初回のみ、以降はヘッダーから編集可能）
  ├── [データ取り込み画面]
  │     ├── ぴよログ CSV アップロード
  │     └── 手動入力タブ
  └── [解析結果画面]
        ├── 総合スコア
        ├── 栄養素別評価
        ├── おすすめ食材
        └── 次の一手アドバイス
```

### 4.2 レイアウト

モバイルファーストの1カラムレイアウト。デスクトップでは2カラム（入力 | 結果）。

| ブレークポイント | レイアウト |
|------------------|-----------|
| 〜640px | 1カラム（モバイル） |
| 641px〜 | 2カラム（デスクトップ） |

---

## 5. データモデル

### 5.1 ドメインモデル

```typescript
// 赤ちゃんプロフィール
interface BabyProfile {
  months: number;       // 月齢 (5-18)
  weight: number;       // 体重 kg
  milkPerDay: number;   // 授乳/ミルク回数
  mealsPerDay: number;  // 離乳食回数
}

// 食事記録（ぴよログから取り込み or 手動入力）
interface MealEntry {
  id: string;
  date: string;         // ISO 日付 "2026-03-10"
  time: string;         // "07:30"
  foods: FoodItem[];
}

// 食材
interface FoodItem {
  name: string;         // 食材名
  grams: number;        // グラム数
  raw: string;          // 元のテキスト（パース前）
}

// Gemini 解析結果
interface AnalysisResult {
  date: string;
  nutrients: Record<NutrientKey, NutrientStatus>;
  score: number;
  summary: string;
  deficiencies: Deficiency[];
  tips: string[];
  source: 'gemini' | 'local'; // どちらで解析したか
}

// 栄養素ステータス
interface NutrientStatus {
  intake: number;       // 摂取量
  target: number;       // 推奨量
  unit: string;         // 単位
  percentage: number;   // 達成率
}

// 不足栄養素
interface Deficiency {
  nutrient: string;
  suggestions: string[];
  reason: string;
}

type NutrientKey = 'energy' | 'protein' | 'iron' | 'calcium' | 'vitaminC' | 'vitaminD';
```

### 5.2 ローカルストレージ構造

```typescript
// キー: "mogumogu-checker:profile"
// 値: BabyProfile の JSON

// キー: "mogumogu-checker:history:{date}"
// 値: AnalysisResult の JSON

// キー: "mogumogu-checker:meals:{date}"
// 値: MealEntry[] の JSON
```

---

## 6. 非機能要件

### 6.1 パフォーマンス

- ぴよログファイルのパースは100ms以内に完了する
- Gemini API 呼び出しは3秒以内にレスポンスを返す（タイムアウト: 10秒）
- 初回ロード: 1.5秒以内（Lighthouse Performance 90+）

### 6.2 セキュリティ

- Gemini API キーはサーバーサイド（API Route）で管理し、クライアントに露出させない
- ユーザーの食事データは Gemini API への送信時のみ外部に送られ、サーバーには保存しない
- 個人を特定できる情報（氏名、住所等）は取り扱わない

### 6.3 プライバシー

- 解析に使用するデータ: 月齢、体重、食事記録のみ
- データはブラウザのローカルストレージにのみ保存
- Gemini API への送信データに個人識別情報を含めない

### 6.4 エラーハンドリング

| エラー種別 | 対応 |
|------------|------|
| ぴよログファイル形式不正 | パースできない行をスキップし、通知表示 |
| Gemini API エラー / タイムアウト | ローカル食材 DB でフォールバック計算 |
| Gemini API レスポンス JSON パース失敗 | リトライ1回、それでも失敗ならフォールバック |
| ネットワークオフライン | ローカル計算のみ使用し、オフライン表示 |
| ストレージ容量超過 | 古い履歴から削除し、警告表示 |

### 6.5 アクセシビリティ

- 主要テキストは日本語で提供
- プログレスバーに aria-label を付与
- フォーム要素に適切な label を設定
- 色だけでなくテキストでも状態を伝える（十分/あと少し/不足）

---

## 7. ディレクトリ構成

```
mogumogu-checker/
├── src/
│   ├── app/                    # ページ・ルーティング
│   │   ├── page.tsx            # トップ画面
│   │   └── api/
│   │       └── analyze/
│   │           └── route.ts    # Gemini API プロキシ
│   ├── components/
│   │   ├── ProfileForm.tsx     # プロフィール入力
│   │   ├── FileUpload.tsx      # ぴよログファイル取り込み
│   │   ├── ManualInput.tsx     # 手動入力
│   │   ├── ScoreDisplay.tsx    # 総合スコア円形メーター
│   │   ├── NutrientBar.tsx     # 栄養素プログレスバー
│   │   ├── Suggestions.tsx     # おすすめ食材
│   │   └── Tips.tsx            # 次の一手
│   ├── lib/
│   │   ├── piyolog-parser.ts   # ぴよログ CSV パーサー
│   │   ├── gemini-client.ts    # Gemini API クライアント
│   │   ├── local-analyzer.ts   # ローカルフォールバック計算
│   │   ├── food-db.ts          # 食材データベース（ローカル）
│   │   └── nutrient-targets.ts # 月齢別推奨栄養量
│   ├── hooks/
│   │   ├── useProfile.ts       # プロフィール状態管理
│   │   └── useAnalysis.ts      # 解析状態管理
│   └── types/
│       └── index.ts            # 型定義
├── ios/                        # iOS ラッパー（WKWebView）
│   ├── BabyFoodMVP.xcodeproj/
│   └── BabyFoodMVP/
│       ├── BabyFoodMVPApp.swift
│       ├── ContentView.swift
│       └── WebAppView.swift
├── public/
├── docs/
│   └── spec.md                 # この仕様書
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── vite.config.ts
```

---

## 8. 開発フェーズ

### Phase 1: コア機能（MVP）

- プロフィール入力
- 手動入力モード（テキストエリア + クイック追加）
- ローカル食材 DB による簡易計算
- 結果表示（スコア、栄養素バー、おすすめ食材、次の一手）
- ローカルストレージ保存

### Phase 2: Gemini AI 統合

- API Route 構築（Gemini API プロキシ）
- Gemini プロンプト設計と JSON レスポンスパース
- フォールバック処理（API エラー時にローカル計算）
- AI 生成コメントの表示

### Phase 3: ぴよログ連携

- ぴよログエクスポート形式の調査と確認
- CSV/テキストパーサーの実装
- ファイルアップロード UI
- 日別データの分割表示

### Phase 4: iOS アプリ化

- WKWebView ラッパーの更新
- ファイル選択の iOS 対応（UIDocumentPickerViewController）
- PWA マニフェスト対応

### Phase 5: 拡張機能（将来）

- 履歴管理（過去の解析結果を閲覧）
- 週間/月間の栄養トレンドグラフ
- アレルゲン管理
- 栄養士監修データへの置き換え
- 家族共有機能

---

## 9. 制約事項

- 栄養ロジックは「日本人の食事摂取基準」を参考にした簡易版であり、医療判断には使用しない
- Gemini AI の栄養推定は参考値であり、正確性を保証しない
- ぴよログのエクスポート形式が変更された場合、パーサーの更新が必要
- オフライン時は Gemini 解析が利用できないため、ローカル計算のみ提供

---

## 10. 既存モックアップからの引き継ぎ

zip ファイル内のモックアップから以下を引き継ぐ:

| 引き継ぎ対象 | 内容 |
|------------|------|
| 食材データベース（`foodDb`） | 90種類以上の離乳食食材と栄養データ。ローカルフォールバック用 |
| 月齢別推奨量（`ageBasedTargets`） | 4段階の月齢帯別ターゲット値 |
| 結果表示 UI | スコア円形メーター、栄養素プログレスバー、おすすめ食材タグ |
| iOS WKWebView ラッパー | `WebAppView.swift` のアーキテクチャ |
| レスポンシブレイアウト | 2カラム→1カラムの切り替え |
