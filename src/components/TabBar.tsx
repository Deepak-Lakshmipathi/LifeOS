/**
 * TabBar — centered pill tab bar for the Glass Cockpit shell (§4.1 nav.tabs).
 *
 * Six tabs in fixed IA order: Home · Money · Career · Agents · Domains · Pulse
 * (§5). Frosted pill track, borderless buttons, active = brighter white fill +
 * soft shadow. This replaces the v1 bottom icon bar; App mounts it once between
 * the vitals row and the tab sections.
 */

export type ViewTab = 'home' | 'money' | 'career' | 'agents' | 'domains' | 'pulse'

/** Tab IA order — §5 "Six tabs, no more." */
export const TABS: { id: ViewTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'money', label: 'Money' },
  { id: 'career', label: 'Career' },
  { id: 'agents', label: 'Agents' },
  { id: 'domains', label: 'Domains' },
  { id: 'pulse', label: 'Pulse' },
]

interface TabBarProps {
  active: ViewTab
  onTabChange: (tab: ViewTab) => void
}

export function TabBar({ active, onTabChange }: TabBarProps) {
  return (
    <nav
      data-testid="tab-bar"
      aria-label="Main navigation"
      className="mx-auto mb-6 flex w-max rounded-[999px] border border-panel-brd bg-panel p-1 backdrop-blur-tile"
    >
      {TABS.map(({ id, label }) => {
        const on = id === active
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            aria-current={on ? 'page' : undefined}
            className={[
              'rounded-[999px] px-5 py-[9px] text-[14px] transition',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-txt',
              on
                ? 'on bg-white/[0.13] text-txt shadow-[0_1px_8px_rgba(0,0,0,.3)]'
                : 'bg-transparent text-dim',
            ].join(' ')}
          >
            {label}
          </button>
        )
      })}
    </nav>
  )
}
