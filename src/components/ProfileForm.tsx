import type { BabyProfile } from '../types'

interface Props {
  profile: BabyProfile
  onChange: (profile: BabyProfile) => void
}

export function ProfileForm({ profile, onChange }: Props) {
  const update = (field: keyof BabyProfile, value: string) => {
    onChange({ ...profile, [field]: Number(value) || 0 })
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
      <h3 className="font-bold text-gray-700 mb-3">赤ちゃんの情報</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-gray-500">月齢</span>
          <select
            value={profile.months}
            onChange={e => update('months', e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            {Array.from({ length: 14 }, (_, i) => i + 5).map(m => (
              <option key={m} value={m}>{m}ヶ月</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">体重 (kg)</span>
          <input
            type="number"
            step="0.1"
            min="2"
            max="15"
            value={profile.weight}
            onChange={e => update('weight', e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">授乳/ミルク回数</span>
          <input
            type="number"
            min="0"
            max="12"
            value={profile.milkPerDay}
            onChange={e => update('milkPerDay', e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">離乳食回数</span>
          <input
            type="number"
            min="1"
            max="5"
            value={profile.mealsPerDay}
            onChange={e => update('mealsPerDay', e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </label>
      </div>
    </div>
  )
}
