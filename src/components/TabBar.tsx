/**
 * TabBar — centered pill tab bar for the Glass Cockpit shell (§4.1 nav.tabs).
 *
 * Five tabs in fixed IA order: Home · Tasks · Money · Career · Agents (§5).
 * S58 folded the old Domains/Pulse top-level tabs into the new Tasks tab as
 * `Segmented` sub-nav segments (see `src/components/tasks/TasksView.tsx`) —
 * they no longer appear here. Frosted pill track, borderless buttons, active =
 * brighter white fill + soft shadow. This replaces the v1 bottom icon bar;
 * App mounts it once between the vitals row and the tab sections.
 *
 * S59: at 5 tabs the old fixed `px-5 py-[9px] text-[14px]` buttons on a
 * `w-max` track overflowed the shell's `px-4` gutter on a phone — tabs ran
 * off-screen with no way to reach the last ones. Horizontal padding and font
 * size are now `clamp()`-driven so they shrink fluidly down to a 320px
 * viewport instead; vertical padding, the pill anatomy, and the active-fill
 * treatment are untouched (§4.1). The clamp() slopes (2.5vw / 1.75vw) are
 * chosen so both metrics already saturate at their S58 fixed values by
 * ~800px — comfortably inside the shell's own 841px breakpoint (DoD #2) —
 * while shrinking to 8px padding / 11px font at a 320px viewport, which
 * fits all five labels with room to spare (DoD #1; TabBar.test.tsx models the
 * arithmetic, e2e/pwa.spec.ts measures the real rendered layout). The fit is
 * delivered by the clamps alone — `max-w-full` only caps the frosted track
 * box, it does NOT constrain the button row, which would still overflow if a
 * future label set outgrew the clamp floor.
 */

export type ViewTab = 'home' | 'tasks' | 'money' | 'career' | 'agents'

/** Tab IA order — §5 "Five tabs, no more." */
export const TABS: { id: ViewTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'money', label: 'Money' },
  { id: 'career', label: 'Career' },
  { id: 'agents', label: 'Agents' },
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
      className="mx-auto mb-6 flex w-max max-w-full rounded-[999px] border border-panel-brd bg-panel p-1 backdrop-blur-tile"
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
              'rounded-[999px] px-[clamp(6px,2.5vw,20px)] py-[9px] text-[clamp(11px,1.75vw,14px)] transition',
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
