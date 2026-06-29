import { useEffect } from 'react'
import { motion } from 'framer-motion'

/** How long the undo window stays open (ms). */
const DISMISS_MS = 3000

interface UndoToastProps {
  taskTitle: string
  /** Called when the user taps Undo. Parent is responsible for re-issuing toggleDone. */
  onUndo: () => void
  /** Called after DISMISS_MS or immediately after undo. */
  onDismiss: () => void
  /** Skip enter/exit animations (prefers-reduced-motion). */
  reducedMotion?: boolean
}

/**
 * UndoToast — a fixed-position pill that appears after a task is completed.
 *
 * Rendered by NowView (for the NOW tab) or via a portal from TaskItem
 * (for the Domains tab).  The 3-second dismiss timer starts on mount and
 * restarts whenever `onDismiss` changes reference, so callers should wrap
 * it in useCallback.
 */
export function UndoToast({ taskTitle, onUndo, onDismiss, reducedMotion = false }: UndoToastProps) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, DISMISS_MS)
    return () => window.clearTimeout(id)
  }, [onDismiss])

  const handleUndo = () => {
    onUndo()
    onDismiss()
  }

  return (
    <div
      className="fixed left-0 right-0 flex justify-center pointer-events-none z-50"
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <motion.div
        role="status"
        aria-live="polite"
        data-testid="undo-toast"
        initial={reducedMotion ? false : { y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { y: 16, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className="flex items-center gap-3 px-5 py-3 rounded-full shadow-lg pointer-events-auto"
        style={{ backgroundColor: '#1C1C1E', maxWidth: '90vw' }}
      >
        <span className="text-sm text-white truncate" style={{ maxWidth: '160px' }}>
          "{taskTitle}" completed
        </span>
        <button
          type="button"
          onClick={handleUndo}
          aria-label="Undo task completion"
          className="text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded px-1 flex-shrink-0"
          style={{ color: '#64D2FF' }}
        >
          Undo
        </button>
      </motion.div>
    </div>
  )
}
