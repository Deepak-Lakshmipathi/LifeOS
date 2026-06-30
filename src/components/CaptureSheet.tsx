/**
 * CaptureSheet — smart capture input with live parsed preview (S12).
 *
 * Renders a single text field that tokenises the user's shorthand in real-time
 * and displays the resolved fields (domain, priority, done_when, project, title)
 * before the user commits. On commit, calls onAdd() with the parsed TaskInput.
 *
 * Mini-syntax (all tokens optional, any order):
 *   #domain  !1/!2/!3  when <text>  ~ <text>  /project  (rest = title)
 *
 * Styling reuses glass tokens and Tailwind apple-* colours from S11.
 */

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { parseCapture } from '../capture/parseCapture'
import { DOMAIN_COLORS } from '../data/domains'

/** Mirrors SyncProvider.add() input — kept in sync via useTasks.addTask(). */
interface AddInput {
  title: string
  done_when?: string
  priority?: 1 | 2 | 3
  project?: string
  domain?: string
}

interface CaptureSheetProps {
  onAdd: (input: AddInput) => Promise<void>
}

const PRIORITY_LABEL: Record<1 | 2 | 3, string> = { 1: 'Low', 2: 'Med', 3: 'High' }

export function CaptureSheet({ onAdd }: CaptureSheetProps) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [shaking, setShaking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus when the sheet mounts.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const parsed = parseCapture(text)
  const hasTitle = parsed.title.trim().length > 0
  const isEmpty = text.trim().length === 0

  const commit = async () => {
    if (!hasTitle) {
      setShaking(true)
      setTimeout(() => setShaking(false), 400)
      return
    }
    setBusy(true)
    try {
      await onAdd(parsed)
      setText('')
    } finally {
      setBusy(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    }
  }

  return (
    <div className="px-4 py-3 flex flex-col gap-3">
      {/* ── Input field ── */}
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
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Call dentist #life !2 when booked"
          className="flex-1 bg-transparent text-apple-label placeholder-apple-gray-1 text-base outline-none"
          aria-label="Capture task"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
        />
      </div>

      {/* ── Live preview ── (shown when user has typed something) */}
      {!isEmpty && (
        <div
          className="glass-panel rounded-ios px-4 py-3 flex flex-col gap-2"
          aria-label="Parsed preview"
        >
          {/* Title row */}
          <p
            className={`text-base font-medium leading-snug ${
              hasTitle ? 'text-apple-label' : 'text-apple-gray-1 italic'
            }`}
          >
            {hasTitle ? parsed.title : 'Type a title…'}
          </p>

          {/* Metadata chips row */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Domain chip */}
            {parsed.domain ? (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: DOMAIN_COLORS[parsed.domain as keyof typeof DOMAIN_COLORS] }}
              >
                {parsed.domain}
              </span>
            ) : (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-apple-gray-5 text-apple-gray-1">
                Inbox
              </span>
            )}

            {/* Priority chip */}
            {parsed.priority !== undefined && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-apple-blue text-white">
                !{PRIORITY_LABEL[parsed.priority]}
              </span>
            )}

            {/* Project chip */}
            {parsed.project && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-apple-gray-5 text-apple-label">
                /{parsed.project}
              </span>
            )}
          </div>

          {/* Done-when row */}
          {parsed.done_when && (
            <p className="text-xs text-apple-gray-1">
              <span className="font-medium">Done when: </span>
              {parsed.done_when}
            </p>
          )}
        </div>
      )}

      {/* ── Add button ── */}
      <button
        type="button"
        onClick={commit}
        disabled={busy || !hasTitle}
        className="w-full py-3 rounded-ios text-base font-semibold transition-opacity focus:outline-none disabled:opacity-40"
        style={{ backgroundColor: '#007AFF', color: '#fff' }}
      >
        {busy ? 'Adding…' : 'Add Task'}
      </button>

      {/* ── Syntax hint ── */}
      <p className="text-center text-xs text-apple-gray-1 pb-1">
        #domain · !1/!2/!3 · /project · when&nbsp;done&nbsp;when
      </p>
    </div>
  )
}
