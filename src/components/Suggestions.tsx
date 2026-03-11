import type { Deficiency } from '../types'

interface Props {
  deficiencies: Deficiency[]
}

export function Suggestions({ deficiencies }: Props) {
  if (deficiencies.length === 0) {
    return (
      <div className="mb-6">
        <h3 className="font-bold text-gray-700 mb-2">おすすめ食材</h3>
        <div className="bg-green-50 rounded-lg p-3 text-sm text-green-700">
          大きな不足は少なめ。いつもの定番食材で続けてOK
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <h3 className="font-bold text-gray-700 mb-2">おすすめ食材</h3>
      <div className="space-y-2">
        {deficiencies.map(d => (
          <div key={d.nutrient} className="bg-orange-50 rounded-lg p-3">
            <p className="text-sm text-gray-600 mb-1">{d.reason}</p>
            <div className="flex flex-wrap gap-1.5">
              {d.suggestions.map(s => (
                <span key={s} className="bg-orange-200 text-orange-800 text-xs px-2 py-1 rounded-full">
                  {s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
