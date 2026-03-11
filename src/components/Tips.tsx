interface Props {
  tips: string[]
}

export function Tips({ tips }: Props) {
  return (
    <div className="mb-6">
      <h3 className="font-bold text-gray-700 mb-2">次の一手</h3>
      <div className="space-y-2">
        {tips.map((tip, i) => (
          <div key={i} className="bg-blue-50 rounded-lg p-3 text-sm text-gray-700">
            {tip}
          </div>
        ))}
      </div>
    </div>
  )
}
