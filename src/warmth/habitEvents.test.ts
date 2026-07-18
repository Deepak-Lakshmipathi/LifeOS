import { describe, it, expect } from 'vitest'
import { habitHitsToEvents } from './habitEvents'
import type { Habit, HabitHit } from '../vault/habits'

describe('habitHitsToEvents', () => {
  it('joins a hit to its habit domain', () => {
    const habits: Habit[] = [{ name: 'Gym session', domain: 'Body & Mind' }]
    const hits: HabitHit[] = [{ habit: 'Gym session', date: '2026-07-17', source: 'pwa' }]
    expect(habitHitsToEvents(hits, habits)).toEqual([
      { domain: 'Body & Mind', date: '2026-07-17' },
    ])
  })

  it('drops hits for a habit name with no matching Habit', () => {
    const habits: Habit[] = [{ name: 'Gym session', domain: 'Body & Mind' }]
    const hits: HabitHit[] = [{ habit: 'Unknown habit', date: '2026-07-17', source: 'pwa' }]
    expect(habitHitsToEvents(hits, habits)).toEqual([])
  })

  it('drops hits whose matched habit has no domain', () => {
    const habits: Habit[] = [{ name: 'No domain habit' }] // domain undefined
    const hits: HabitHit[] = [{ habit: 'No domain habit', date: '2026-07-17', source: 'pwa' }]
    expect(habitHitsToEvents(hits, habits)).toEqual([])
  })

  it('returns [] for empty input', () => {
    expect(habitHitsToEvents([], [])).toEqual([])
  })
})
