/**
 * Aurora — living canvas ground for Glass Cockpit (S22).
 *
 * A fixed, full-viewport canvas painting 4 drifting radial-gradient blobs
 * behind the frosted glass shell (docs/DESIGN_LANGUAGE.md §2.3 Z, §7 row 1).
 * Blob base positions/radii/phase are taken verbatim from the ground-truth
 * mockup (docs/mockups/cockpit-glass.html, `aurora background` script).
 *
 * Palette is swapped by time-of-day (S23) via the `palette` prop — this
 * component never hardcodes which mode is active.
 *
 * Reduced-motion contract (§7, non-negotiable): under
 * `prefers-reduced-motion: reduce`, paint exactly ONE static frame and never
 * schedule `requestAnimationFrame`.
 *
 * S60 (owner feedback items 3+4): Warmth's vital tile is gone — warmth now
 * tints THIS background instead, so the whole app is colored by how hot the
 * owner's domains are. #186: Aurora used to self-load the list through the
 * memoized `selfLoadTasks` module, which had no production invalidation
 * path — so the tint froze at the first read and no write through
 * `useTasks` could reach it. The list now has ONE owner (`useTasks` in
 * `App.tsx`) and arrives as a required prop. Aurora runs `computeWarmth`
 * over those tasks
 * and derives `{ color, alpha }` via the pure `warmthTint` module. The tint
 * renders as one extra `fixed inset-0` layer, static — no new
 * `requestAnimationFrame` scheduling, no reduced-motion branch needed (§7):
 * it never animates in the first place.
 */
import { useEffect, useRef } from 'react'
import type { Task } from '../../types'
import { computeWarmth } from '../../warmth/computeWarmth'
import { warmthTint } from '../../lib/warmthTint'

export type AuroraPalette = [string, string, string, string]

/** Morning palette (§6 default) — indigo/teal night. */
export const MORNING_PALETTE: AuroraPalette = ['#312e81', '#155e75', '#4c1d95', '#134e4a']

interface AuroraProps {
  /** 4 blob colors, fixed anatomical order: top-left, top-right, bottom-center, bottom-left. */
  palette?: AuroraPalette
  /** Loaded task list, for the warmth tint — owned by `useTasks` in App.tsx (#186). */
  tasks: Task[]
  /** Current time in ms, for the warmth tint — inject for deterministic tests. */
  now?: number
}

/** Base position (fraction of viewport) + radius per blob — from the mockup's `blobs` literal. */
const BLOB_LAYOUT: ReadonlyArray<{ x: number; y: number; r: number }> = [
  { x: 0.2, y: 0.15, r: 340 },
  { x: 0.85, y: 0.2, r: 300 },
  { x: 0.5, y: 0.9, r: 380 },
  { x: 0.1, y: 0.8, r: 280 },
]

export function Aurora({ palette = MORNING_PALETTE, tasks, now }: AuroraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const warmth = computeWarmth(tasks, now ?? Date.now())
  const tint = warmthTint(warmth)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    const resize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const blobs = BLOB_LAYOUT.map((b, i) => ({ ...b, p: i * 1.7 }))
    let tick = 0

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height)
      blobs.forEach((b, i) => {
        const bx = (b.x + Math.sin(tick + b.p) * 0.05) * width
        const by = (b.y + Math.cos(tick * 0.8 + b.p) * 0.05) * height
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, b.r)
        g.addColorStop(0, palette[i] + 'cc')
        g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(bx, by, b.r, 0, 7)
        ctx.fill()
      })
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reducedMotion) {
      // One static frame, painted directly — requestAnimationFrame is never
      // scheduled under reduced motion (§7 contract).
      drawFrame()
      return () => {
        window.removeEventListener('resize', resize)
      }
    }

    let rafId = 0
    const loop = () => {
      tick += 0.004
      drawFrame()
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [palette])

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          opacity: 0.55,
          pointerEvents: 'none',
        }}
      />
      {/* Warmth tint (S60): static, one solid fill — no rAF, no reduced-
          motion branch needed. Same z-index as the canvas but painted after
          it in DOM order, so it stacks above the aurora and below `.shell`
          (z-index 1, §2.3 Z) without inventing a fractional z-index. */}
      <div
        aria-hidden="true"
        data-testid="warmth-tint"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          backgroundColor: tint.color,
          opacity: tint.alpha,
          pointerEvents: 'none',
        }}
      />
    </>
  )
}
