import { useState, type KeyboardEvent } from 'react'
import { PriorityControl, type Priority } from './PriorityControl'
import { DOMAINS } from '../data/domains'
import { domainForProject } from '../lib/groupByDomain'
import type { Task } from '../types'

interface AddTaskInputProps {
  onAdd: (input: { title: string; done_when?: string; priority?: 1 | 2 | 3; project?: string; domain?: string }) => Promise<void>
  projects: string[]
  tasks: Task[]
}

export function AddTaskInput({ onAdd, projects, tasks }: AddTaskInputProps) {
  const [value, setValue] = useState('')
  const [doneWhen, setDoneWhen] = useState('')
  const [priority, setPriority] = useState<Priority>(undefined)
  const [project, setProject] = useState('')
  const [domain, setDomain] = useState('')
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
    // Normalize empty/whitespace domain to undefined before hitting the seam.
    const trimmedDomain = domain.trim()
    await onAdd({
      title: trimmed,
      done_when: trimmedDoneWhen || undefined,
      priority,
      project: trimmedProject || undefined,
      domain: trimmedDomain || undefined,
    })
    setValue('')
    setDoneWhen('')
    setPriority(undefined)
    setProject('')
    setDomain('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    }
  }

  // When project changes and domain is unset, prefill from existing tasks.
  const handleProjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProject = e.target.value
    setProject(newProject)
    if (!domain) {
      const inferred = domainForProject(tasks, newProject)
      if (inferred) setDomain(inferred)
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
            onChange={handleProjectChange}
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
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="bg-transparent text-apple-gray-1 text-sm outline-none border-b border-apple-gray-3 focus:border-apple-blue"
            aria-label="Domain"
          >
            <option value="">Domain…</option>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <PriorityControl name="add-task-priority" value={priority} onChange={setPriority} />
        </div>
      </div>
    </div>
  )
}
