import { useEffect, useState } from 'react'
import { cockpitMode } from '../lib/timeOfDay'
import type { CockpitMode } from '../lib/timeOfDay'

/**
 * Aurora palette: 4 hex colors, drift-blob order (docs/DESIGN_LANGUAGE.md §6).
 */
export type AuroraPalette = readonly [string, string, string, string]

/** Greetings verbatim from docs/DESIGN_LANGUAGE.md §6. */
const GREETINGS: Record<CockpitMode, string> = {
  am: 'Good morning, Deepak',
  mid: 'Back at it, Deepak',
  pm: 'Winding down, Deepak',
}

/** Aurora palettes verbatim from docs/DESIGN_LANGUAGE.md §6. */
const PALETTES: Record<CockpitMode, AuroraPalette> = {
  am: ['#312e81', '#155e75', '#4c1d95', '#134e4a'],
  mid: ['#1e3a8a', '#0e7490', '#3730a3', '#065f46'],
  pm: ['#4c1d95', '#831843', '#312e81', '#7c2d12'],
}

/**
 * `document.body` classes toggled per mode. `am` is the default look and
 * carries no class (docs/DESIGN_LANGUAGE.md §6: "none = morning").
 */
const BODY_CLASSES_BY_MODE: Record<CockpitMode, string | null> = {
  am: null,
  mid: 'mid',
  pm: 'pm',
}

const ALL_BODY_CLASSES = ['mid', 'pm'] as const

export interface UseTimeOfDayResult {
  mode: CockpitMode
  greeting: string
  palette: AuroraPalette
}

/** How often the wall clock is re-checked when no override is supplied. */
const CLOCK_POLL_MS = 60_000

/**
 * Cockpit time-of-day: derives `mode` from the wall clock (or an explicit
 * `override`, which the in-product seg control uses to force a mode
 * regardless of the clock), and returns the matching greeting + aurora
 * palette verbatim from docs/DESIGN_LANGUAGE.md §6.
 *
 * Side effect: toggles `mid`/`pm` on `document.body` so global CSS can key
 * off it (am has no class — it's the default look); the class is removed
 * on unmount.
 */
export function useTimeOfDay(override?: CockpitMode): UseTimeOfDayResult {
  const [clockMode, setClockMode] = useState<CockpitMode>(() => cockpitMode(Date.now()))

  // Re-poll the wall clock while no override is forcing a mode. Skipped
  // entirely when overridden — the seg control alone decides.
  useEffect(() => {
    if (override) return
    const id = setInterval(() => {
      setClockMode(cockpitMode(Date.now()))
    }, CLOCK_POLL_MS)
    return () => clearInterval(id)
  }, [override])

  const mode = override ?? clockMode

  useEffect(() => {
    const body = document.body
    const activeClass = BODY_CLASSES_BY_MODE[mode]
    for (const cls of ALL_BODY_CLASSES) {
      body.classList.toggle(cls, cls === activeClass)
    }
    return () => {
      for (const cls of ALL_BODY_CLASSES) {
        body.classList.remove(cls)
      }
    }
  }, [mode])

  return {
    mode,
    greeting: GREETINGS[mode],
    palette: PALETTES[mode],
  }
}
