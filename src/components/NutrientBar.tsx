import type { NutrientStatus } from '../types'

interface Props {
  label: string
  unit: string
  status: NutrientStatus
}

function getStatusInfo(percentage: number) {
  if (percentage >= 90) return { label: '十分', color: 'bg-green-400', text: 'text-green-700' }
  if (percentage >= 70) return { label: 'あと少し', color: 'bg-yellow-400', text: 'text-yellow-700' }
  return { label: '不足', color: 'bg-red-400', text: 'text-red-700' }
}

export function NutrientBar({ label, unit, status }: Props) {
  const info = getStatusInfo(status.percentage)
  const width = Math.min(status.percentage, 100)
  // 読み上げ用: バーは 0〜100% の範囲で満ちるので valuenow はその範囲に収め、
  // 100% を超えた実際の割合は valuetext で伝える
  const valueNow = Number.isFinite(status.percentage)
    ? Math.min(Math.max(status.percentage, 0), 100)
    : 0

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">{status.percentage}%</span>
      </div>
      <div className="text-xs text-gray-400 mb-1">
        {status.intake}{unit} / {status.target}{unit}
      </div>
      <div
        className="w-full h-3 bg-gray-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={valueNow}
        aria-valuetext={`${status.percentage}% ${info.label}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${info.color}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className={`text-xs mt-0.5 ${info.text}`}>{info.label}</div>
    </div>
  )
}
