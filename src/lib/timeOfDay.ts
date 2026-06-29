/**
 * Time-of-day bucket helper.
 *
 * The clock is injected via the `nowMs` parameter so the function is pure
 * and unit-testable without mocking Date.  Do NOT call Date.now() here.
 *
 * Buckets
 * ───────
 *  morning   05:00–08:59  warm sunrise
 *  day       09:00–17:59  sky-blue daytime
 *  evening   18:00–20:59  amber / purple sunset
 *  night     21:00–04:59  deep-sky
 */

export type TimeOfDayBucket = 'morning' | 'day' | 'evening' | 'night'

/**
 * Maps an epoch timestamp to a time-of-day bucket.
 * @param nowMs - epoch milliseconds (injected; never reads Date.now())
 */
export function getTimeOfDay(nowMs: number): TimeOfDayBucket {
  const hour = new Date(nowMs).getHours()
  if (hour >= 5 && hour < 9) return 'morning'
  if (hour >= 9 && hour < 18) return 'day'
  if (hour >= 18 && hour < 21) return 'evening'
  return 'night'
}

/**
 * Full-page CSS background gradients, one per bucket.
 * Applied to the app root so they show behind frosted-glass panels.
 */
export const TIME_GRADIENTS: Record<TimeOfDayBucket, string> = {
  morning: 'linear-gradient(150deg, #FFECD2 0%, #FFD6A5 45%, #FDBA74 100%)',
  day:     'linear-gradient(150deg, #E0F2FE 0%, #BAE6FD 45%, #C7F2FA 100%)',
  evening: 'linear-gradient(150deg, #FED7AA 0%, #FCA5A5 40%, #C4B5FD 100%)',
  night:   'linear-gradient(150deg, #0F172A 0%, #1E1B4B 45%, #0C1445 100%)',
}

/**
 * Solid fallback color per bucket (used when prefers-reduced-transparency is set).
 */
export const TIME_SOLID_BG: Record<TimeOfDayBucket, string> = {
  morning: '#FFF1E0',
  day:     '#EBF6FE',
  evening: '#FDECD8',
  night:   '#161625',
}
