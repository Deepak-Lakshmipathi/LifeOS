import { useState, type KeyboardEvent } from 'react'

interface AddTaskInputProps {
  onAdd: (title: string) => Promise<void>
}

export function AddTaskInput({ onAdd }: AddTaskInputProps) {
  const [value, setValue] = useState('')
  const [shaking, setShaking] = useState(false)

  const commit = async () => {
    const trimmed = value.trim()
    if (!trimmed) {
      // Brief shake to signal rejection
      setShaking(true)
      setTimeout(() => setShaking(false), 400)
      return
    }
    await onAdd(trimmed)
    setValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    }
  }

  return (
    <div className="px-4 py-3">
      <div
        className={`flex items-center gap-3 bg-apple-gray-6 rounded-ios px-4 py-3 transition-all ${
          shaking ? 'animate-shake' : ''
        }`}
      >
        <svg
          className="w-5 h-5 text-apple-gray-1 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New task"
          className="flex-1 bg-transparent text-apple-label placeholder-apple-gray-1 text-base outline-none"
          aria-label="New task title"
        />
      </div>
    </div>
  )
}
