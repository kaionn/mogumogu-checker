interface Props {
  score: number
  summary: string
}

export function ScoreDisplay({ score, summary }: Props) {
  const degrees = Math.round((Math.min(Math.max(score, 0), 100) / 100) * 360)
  const color = score >= 80 ? '#4ade80' : score >= 60 ? '#fbbf24' : '#f87171'

  return (
    <div className="text-center mb-6">
      <div
        className="relative w-32 h-32 mx-auto rounded-full flex items-center justify-center"
        style={{
          background: `conic-gradient(${color} 0deg ${degrees}deg, #e5e7eb ${degrees}deg 360deg)`,
        }}
      >
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center">
          <span className="text-3xl font-bold text-gray-800">{score}</span>
        </div>
      </div>
      <p className="mt-3 text-sm text-gray-600">{summary}</p>
    </div>
  )
}
