interface Props {
  value: string
  onChange: (value: string) => void
}

const quickFoods = [
  '7倍粥 50g', 'うどん 45g', '食パン 20g',
  '豆腐 20g', 'ささみ 10g', '鮭 10g', 'しらす 5g',
  'にんじん 15g', 'ほうれん草 10g', 'かぼちゃ 15g', 'ブロッコリー 10g',
  'バナナ 15g', 'ヨーグルト 20g', '卵黄 1/2個',
]

export function ManualInput({ value, onChange }: Props) {
  const addFood = (food: string) => {
    const current = value.trim()
    onChange(current ? `${current}, ${food}` : food)
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
      <h3 className="font-bold text-gray-700 mb-3">今日の離乳食</h3>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="例: 7倍粥 50g, 鮭 10g, ほうれん草 10g"
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
      />
      <div className="mt-2">
        <p className="text-xs text-gray-400 mb-1.5">クイック追加:</p>
        <div className="flex flex-wrap gap-1.5">
          {quickFoods.map(food => (
            <button
              key={food}
              onClick={() => addFood(food)}
              className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full hover:bg-orange-200 transition-colors"
            >
              + {food}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
