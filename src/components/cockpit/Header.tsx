import { useState } from 'react'
import { Segmented } from '../glass/Segmented'
import { useTimeOfDay } from '../../hooks/useTimeOfDay'
import type { CockpitMode } from '../../lib/timeOfDay'

/**
 * Header — cockpit greeting + date/mission-note + time-of-day seg control
 * (docs/DESIGN_LANGUAGE.md §5 header row, §6 time-of-day system, §7 shine).
 *
 * Self-contained: App.tsx mounts `<Header />` with no props and never edits
 * this file again (S24 contract). The Morning/Midday/Evening `Segmented`
 * control (S21) drives an `override` that `useTimeOfDay` (S23) feeds back as
 * the current `mode` — which toggles the `mid`/`pm` body class, so the CSS
 * mission-note `::after` append (§6) and the aurora palette both follow.
 *
 * Greeting text comes straight from `useTimeOfDay` (React-driven, changes with
 * mode); the mission-note append is pure CSS keyed off the body class per §6.
 */

/** Seg options: label per §6, id = the CockpitMode it forces. */
const OPTIONS: { id: CockpitMode; label: string }[] = [
  { id: 'am', label: 'Morning' },
  { id: 'mid', label: 'Midday' },
  { id: 'pm', label: 'Evening' },
]

/** Mission-note base (morning); §6 midday/evening text is appended in CSS. */
const MISSION_NOTE = 'Win these 3 and today counts'

/**
 * Scoped stylesheet for the two things Tailwind utilities can't express here:
 *  1. §7 greeting shine — a text-clipped moving gradient (6s linear infinite),
 *     switched off natively under reduced motion by the `@media` rule (§7's
 *     reduced-motion contract). The gradient CLIP stays on when static — only
 *     the motion stops. CSS handles it, so no framer-motion / JS gate needed.
 *  2. §6 mission-note append — CSS `::after` content keyed off the body class
 *     that `useTimeOfDay` toggles (`mid`/`pm`; morning has no class).
 * Every literal (100deg / #fff 20% / #a5b4fc 50% / #fff 80% / 200% / 6s /
 * −200%) and both append strings are copied verbatim from §6/§7.
 */
const HEADER_CSS = `
.s25-greeting{
  background:linear-gradient(100deg,#fff 20%,#a5b4fc 50%,#fff 80%);
  background-size:200% 100%;
  -webkit-background-clip:text;background-clip:text;
  color:transparent;-webkit-text-fill-color:transparent;
  animation:s25-greeting-shine 6s linear infinite;
}
@keyframes s25-greeting-shine{to{background-position:-200% 0}}
@media(prefers-reduced-motion:reduce){.s25-greeting{animation:none}}
body.mid .s25-note::after{content:" — midday check: 1 done, deep-work block starts in 40 min."}
body.pm .s25-note::after{content:" — 2 of 3 done. One rescue left before the day closes."}
`

export interface HeaderProps {
  /** Displayed date; injectable for deterministic tests. Defaults to now. */
  now?: Date
}

export function Header({ now }: HeaderProps = {}) {
  const [override, setOverride] = useState<CockpitMode | undefined>(undefined)
  const { mode, greeting } = useTimeOfDay(override)
  const dateLabel = (now ?? new Date()).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <header className="mb-[14px] flex flex-wrap items-start justify-between gap-4">
      <style>{HEADER_CSS}</style>

      <div>
        <h1 className="s25-greeting text-[30px] font-bold leading-[1.15] tracking-[-.02em]">
          {greeting}
        </h1>
        <p className="mt-1 text-[13px] text-dim">
          <span>{dateLabel}</span>
          <span aria-hidden="true"> · </span>
          <span className="s25-note">{MISSION_NOTE}</span>
        </p>
      </div>

      <Segmented
        options={OPTIONS}
        value={mode}
        onChange={(id) => setOverride(id as CockpitMode)}
        ariaLabel="Time of day"
        className="shrink-0"
      />
    </header>
  )
}
