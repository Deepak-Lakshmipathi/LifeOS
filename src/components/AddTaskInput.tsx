import { useState, type KeyboardEvent } from 'react'
import { PriorityControl, type Priority } from './PriorityControl'

interface AddTaskInputProps {
  onAdd: (input: { title: string; done_when?: string; priority?: 1 | 2 | 3; project?: string }) => Promise<void>
  projects: string[]
}

export function AddTaskInput({ onAdd, projects }: AddTaskInputProps) {
  const [value, setValue] = useState('')
  const [doneWhen, setDoneWhen] = useState('')
  const [priority, setPriority] = useState<Priority>(undefined)
  const [project, setProject] = useState('')
  const [shaking, setShaking] = useState(false)

  const commit = async () => {
    const trimmed = value.trim()
    if (!trimmed) {
      // Brief shake to signal rejection
      setShaking(true)
      setTimeout(() => setShaking(false), 400)
      return
    }
    // Normalize empty/whitespace done_when to undefined before hitting the seam.
    const trimmedDoneWhen = doneWhen.trim()
    // Normalize empty/whitespace project to undefined before hitting the seam.
    const trimmedProject = project.trim()
    await onAdd({
      title: trimmed,
      done_when: trimmedDoneWhen || undefined,
      priority,
      project: trimmedProject || undefined,
    })
    setValue('')
    setDoneWhen('')
    setPriority(undefined)
    setProject('')
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
        className={`flex items-start gap-3 bg-apple-gray-6 rounded-ios px-4 py-3 transition-all ${
          shaking ? 'animate-shake' : ''
        }`}
      >
        <svg
          className="w-5 h-5 text-apple-gray-1 flex-shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <div className="flex-1 flex flex-col gap-1">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="New task"
            className="bg-transparent text-apple-label placeholder-apple-gray-1 text-base outline-none"
            aria-label="New task title"
          />
          <input
            type="text"
            value={doneWhen}
            onChange={(e) => setDoneWhen(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Done when…"
            className="bg-transparent text-apple-gray-1 placeholder-apple-gray-2 text-sm outline-none"
            aria-label="Done when"
          />
          <input
            type="text"
            list="project-suggestions"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Project…"
            className="bg-transparent text-apple-gray-1 placeholder-apple-gray-2 text-sm outline-none"
            aria-label="Project"
          />
          <datalist id="project-suggestions">
            {projects.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <PriorityControl name="add-task-priority" value={priority} onChange={setPriority} />
        </div>
      </div>
    </div>
  )
}
