import { useRef } from 'react'

interface Props {
  onFileLoad: (content: string) => void
}

export function FileUpload({ onFileLoad }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text === 'string') {
        onFileLoad(text)
      }
    }
    reader.readAsText(file)

    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
      <h3 className="font-bold text-gray-700 mb-3">ぴよログから取り込み</h3>
      <label className="block cursor-pointer">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-orange-300 transition-colors">
          <p className="text-sm text-gray-500">ぴよログの CSV / テキストファイルを選択</p>
          <p className="text-xs text-gray-400 mt-1">タップしてファイルを選ぶ</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,.text"
          onChange={handleFile}
          className="hidden"
        />
      </label>
    </div>
  )
}
