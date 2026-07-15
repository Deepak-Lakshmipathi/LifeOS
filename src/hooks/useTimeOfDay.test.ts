/**
 * Unit tests for the useTimeOfDay hook (S23).
 *
 * Covers: the 3 §6 greetings/palettes verbatim, body-class lifecycle
 * (none/mid/pm, override wins, cleanup on unmount).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTimeOfDay } from './useTimeOfDay'
import type { UseTimeOfDayResult } from './useTimeOfDay'
import type { CockpitMode } from '../lib/timeOfDay'

function setClockHour(hour: number) {
  const d = new Date(2024, 0, 15)
  d.setHours(hour, 0, 0, 0)
  vi.setSystemTime(d)
}

beforeEach(() => {
  vi.useFakeTimers()
  document.body.classList.remove('mid', 'pm')
})

afterEach(() => {
  vi.useRealTimers()
  document.body.classList.remove('mid', 'pm')
})

describe('useTimeOfDay — greeting/palette table (§6, verbatim)', () => {
  it('am: greeting + palette', () => {
    setClockHour(8)
    const { result } = renderHook(() => useTimeOfDay())
    expect(result.current.mode).toBe('am')
    expect(result.current.greeting).toBe('Good morning, Deepak')
    expect(result.current.palette).toEqual(['#312e81', '#155e75', '#4c1d95', '#134e4a'])
  })

  it('mid: greeting + palette', () => {
    setClockHour(14)
    const { result } = renderHook(() => useTimeOfDay())
    expect(result.current.mode).toBe('mid')
    expect(result.current.greeting).toBe('Back at it, Deepak')
    expect(result.current.palette).toEqual(['#1e3a8a', '#0e7490', '#3730a3', '#065f46'])
  })

  it('pm: greeting + palette', () => {
    setClockHour(20)
    const { result } = renderHook(() => useTimeOfDay())
    expect(result.current.mode).toBe('pm')
    expect(result.current.greeting).toBe('Winding down, Deepak')
    expect(result.current.palette).toEqual(['#4c1d95', '#831843', '#312e81', '#7c2d12'])
  })
})

describe('useTimeOfDay — body class lifecycle', () => {
  it('applies no mid/pm class for am', () => {
    setClockHour(8)
    renderHook(() => useTimeOfDay())
    expect(document.body.classList.contains('mid')).toBe(false)
    expect(document.body.classList.contains('pm')).toBe(false)
  })

  it('applies "mid" class for mid', () => {
    setClockHour(14)
    renderHook(() => useTimeOfDay())
    expect(document.body.classList.contains('mid')).toBe(true)
    expect(document.body.classList.contains('pm')).toBe(false)
  })

  it('applies "pm" class for pm', () => {
    setClockHour(20)
    renderHook(() => useTimeOfDay())
    expect(document.body.classList.contains('pm')).toBe(true)
    expect(document.body.classList.contains('mid')).toBe(false)
  })

  it('override wins over the clock', () => {
    setClockHour(8) // clock says "am"
    renderHook(() => useTimeOfDay('pm'))
    expect(document.body.classList.contains('pm')).toBe(true)
    expect(document.body.classList.contains('mid')).toBe(false)
  })

  it('cleans up the body class on unmount', () => {
    setClockHour(14)
    const { unmount } = renderHook(() => useTimeOfDay())
    expect(document.body.classList.contains('mid')).toBe(true)
    unmount()
    expect(document.body.classList.contains('mid')).toBe(false)
    expect(document.body.classList.contains('pm')).toBe(false)
  })

  it('switches class when the override changes across a re-render', () => {
    setClockHour(8)
    const { rerender } = renderHook<UseTimeOfDayResult, { override: CockpitMode }>(
      ({ override }) => useTimeOfDay(override),
      { initialProps: { override: 'mid' } }
    )
    expect(document.body.classList.contains('mid')).toBe(true)

    rerender({ override: 'pm' })
    expect(document.body.classList.contains('mid')).toBe(false)
    expect(document.body.classList.contains('pm')).toBe(true)
  })
})

describe('useTimeOfDay — mode result matches cockpitMode at the clock boundaries', () => {
  it('11:59 -> am, 12:00 -> mid, 17:59 -> mid, 18:00 -> pm', () => {
    const d = new Date(2024, 0, 15)

    d.setHours(11, 59, 0, 0)
    vi.setSystemTime(d)
    expect(renderHook(() => useTimeOfDay()).result.current.mode).toBe('am')

    d.setHours(12, 0, 0, 0)
    vi.setSystemTime(d)
    expect(renderHook(() => useTimeOfDay()).result.current.mode).toBe('mid')

    d.setHours(17, 59, 0, 0)
    vi.setSystemTime(d)
    expect(renderHook(() => useTimeOfDay()).result.current.mode).toBe('mid')

    d.setHours(18, 0, 0, 0)
    vi.setSystemTime(d)
    expect(renderHook(() => useTimeOfDay()).result.current.mode).toBe('pm')
  })
})

describe('useTimeOfDay — clock polling (no override)', () => {
  it('re-derives mode as the wall clock crosses a boundary', () => {
    setClockHour(11)
    const { result } = renderHook(() => useTimeOfDay())
    expect(result.current.mode).toBe('am')

    act(() => {
      setClockHour(12)
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current.mode).toBe('mid')
  })

  it('does not poll the clock when an override is supplied', () => {
    setClockHour(8)
    const { result } = renderHook(() => useTimeOfDay('pm'))
    expect(result.current.mode).toBe('pm')

    act(() => {
      setClockHour(20) // clock now also says "pm" — irrelevant, override still wins
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current.mode).toBe('pm')
  })
})
