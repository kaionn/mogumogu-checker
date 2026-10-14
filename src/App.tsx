import { useState } from 'react'
import { ProfileForm } from './components/ProfileForm'
import { ManualInput } from './components/ManualInput'
import { FileUpload } from './components/FileUpload'
import { ScoreDisplay } from './components/ScoreDisplay'
import { NutrientBar } from './components/NutrientBar'
import { Suggestions } from './components/Suggestions'
import { Tips } from './components/Tips'
import { useProfile } from './hooks/useProfile'
import { useAnalysis } from './hooks/useAnalysis'
import { nutrientMeta } from './lib/nutrient-targets'
import { parsePiyologText } from './lib/piyolog-parser'
import { groupMealsByDate, localToday } from './lib/meal-days'

type InputMode = 'manual' | 'piyolog'

function App() {
  const { profile, setProfile } = useProfile()
  const { state, analyze, reset } = useAnalysis()
  const [manualFoods, setManualFoods] = useState('7倍粥 50g, 鮭 10g, ほうれん草 10g, バナナ 15g, ヨーグルト 20g')
  const [mealDays, setMealDays] = useState<Record<string, string>>({})
  const [selectedDate, setSelectedDate] = useState('')
  const [inputMode, setInputMode] = useState<InputMode>('manual')
  const [parseMessage, setParseMessage] = useState('')
  const dates = Object.keys(mealDays).sort()
  const analysisDate = inputMode === 'manual' ? localToday() : selectedDate
  const foodsText = inputMode === 'manual' ? manualFoods : (mealDays[selectedDate] ?? '')
  const setFoodsText = (value: string) => {
    reset()
    if (inputMode === 'manual') setManualFoods(value)
    else setMealDays(days => ({ ...days, [selectedDate]: value }))
  }
  const changeMode = (mode: InputMode) => {
    reset()
    setInputMode(mode)
  }

  const handleFileLoad = (content: string) => {
    const { entries, skipped } = parsePiyologText(content)
    if (entries.length === 0) {
      setParseMessage('離乳食の記録が見つかりませんでした。手動入力に切り替えてください。')
      return
    }

    const days = groupMealsByDate(entries)
    reset()
    setMealDays(days)
    setSelectedDate(Object.keys(days).sort().at(-1) ?? '')
    setInputMode('piyolog')

    const msg = skipped > 0
      ? `${entries.length}件の離乳食記録を取り込みました（${skipped}行スキップ）`
      : `${entries.length}件の離乳食記録を取り込みました`
    setParseMessage(`${msg}（${Object.keys(days).length}日分）`)
  }

  const handleAnalyze = () => {
    setParseMessage('')
    analyze(foodsText, profile, analysisDate)
  }

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-gradient-to-r from-orange-400 to-pink-400 text-white p-4 text-center shadow-md">
        <h1 className="text-xl font-bold">もぐもぐチェッカー</h1>
        <p className="text-sm opacity-90">離乳食の栄養バランスをチェック</p>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <ProfileForm profile={profile} onChange={value => { reset(); setProfile(value) }} />

        {/* 入力モード切り替え */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => changeMode('manual')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              inputMode === 'manual'
                ? 'bg-orange-400 text-white'
                : 'bg-white text-gray-600 border border-gray-300'
            }`}
          >
            手動入力
          </button>
          <button
            onClick={() => changeMode('piyolog')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              inputMode === 'piyolog'
                ? 'bg-orange-400 text-white'
                : 'bg-white text-gray-600 border border-gray-300'
            }`}
          >
            ぴよログ取り込み
          </button>
        </div>

        {inputMode === 'manual' ? (
          <ManualInput value={foodsText} onChange={setFoodsText} />
        ) : (
          <>
            <FileUpload onFileLoad={handleFileLoad} />
            {dates.length > 0 && (
              <div className="mb-4">
                <label htmlFor="meal-date" className="block text-sm font-medium mb-2">解析する日</label>
                <select id="meal-date" value={selectedDate} onChange={event => { reset(); setSelectedDate(event.target.value) }} className="w-full rounded-lg border border-gray-300 p-2 mb-3">
                  {dates.map(date => <option key={date} value={date}>{date}</option>)}
                </select>
                <ManualInput value={foodsText} onChange={setFoodsText} />
              </div>
            )}
          </>
        )}

        {parseMessage && (
          <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded-lg mb-4">{parseMessage}</div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={state.status === 'loading' || !foodsText.trim()}
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold text-lg shadow-md hover:bg-orange-600 active:bg-orange-700 transition-colors disabled:opacity-50 mb-6"
        >
          {state.status === 'loading' ? '解析中...' : '解析する'}
        </button>

        {state.status === 'error' && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{state.message}</div>
        )}

        {state.status === 'done' && state.result.date === analysisDate && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-600 text-center mb-3">解析対象日: {state.result.date}</p>
            {state.result.source === 'local' && (
              <p className="text-xs text-gray-400 text-center mb-3">ローカル計算の結果です</p>
            )}

            <ScoreDisplay score={state.result.score} summary={state.result.summary} />

            <div className="mb-6">
              <h3 className="font-bold text-gray-700 mb-3">栄養素別評価</h3>
              {nutrientMeta.map(meta => (
                <NutrientBar
                  key={meta.key}
                  label={meta.label}
                  unit={meta.unit}
                  status={state.result.nutrients[meta.key]}
                />
              ))}
            </div>

            <Suggestions deficiencies={state.result.deficiencies} />
            <Tips tips={state.result.tips} />
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-4">
        栄養計算は参考値です。医療判断には使用しないでください。
      </footer>
    </div>
  )
}

export default App
