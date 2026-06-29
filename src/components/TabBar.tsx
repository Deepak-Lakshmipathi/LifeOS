/**
 * TabBar — bottom navigation bar with 4 tabs: Now, Domains, Pulse, +
 *
 * Fixed at the bottom of the viewport, safe-area aware.
 * Now/Domains/Pulse are view tabs; + fires onAdd (opens the add sheet in App).
 */

export type ViewTab = 'now' | 'domains' | 'pulse'

interface TabBarProps {
  active: ViewTab
  onTabChange: (tab: ViewTab) => void
  onAdd: () => void
}

// --- Icons ---

function NowIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  )
}

function DomainsIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="3.5" cy="6" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="18" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

function PulseIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function AddIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="16" fill="#007AFF" />
      <line x1="16" y1="9" x2="16" y2="23" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="9" y1="16" x2="23" y2="16" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

// --- Component ---

export function TabBar({ active, onTabChange, onAdd }: TabBarProps) {
  const viewTabs: { id: ViewTab; label: string; Icon: typeof NowIcon }[] = [
    { id: 'now', label: 'Now', Icon: NowIcon },
    { id: 'domains', label: 'Domains', Icon: DomainsIcon },
    { id: 'pulse', label: 'Pulse', Icon: PulseIcon },
  ]

  return (
    <nav
      data-testid="tab-bar"
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-20 bg-white/90 backdrop-blur-md border-t"
      style={{
        borderColor: 'rgba(60,60,67,0.12)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-stretch justify-around max-w-xl mx-auto h-16">
        {viewTabs.map(({ id, label, Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors focus:outline-none"
              style={{ color: isActive ? '#007AFF' : '#8E8E93' }}
            >
              <Icon active={isActive} />
              <span
                className="text-xs font-medium leading-none"
                style={{ fontWeight: isActive ? 600 : 500 }}
              >
                {label}
              </span>
            </button>
          )
        })}

        {/* + tab — opens add sheet, no view-tab active state */}
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add task"
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors focus:outline-none"
        >
          <AddIcon />
        </button>
      </div>
    </nav>
  )
}
