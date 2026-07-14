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
 */
import { useEffect, useRef } from 'react'

export type AuroraPalette = [string, string, string, string]

/** Morning palette (§6 default) — indigo/teal night. */
export const MORNING_PALETTE: AuroraPalette = ['#312e81', '#155e75', '#4c1d95', '#134e4a']

interface AuroraProps {
  /** 4 blob colors, fixed anatomical order: top-left, top-right, bottom-center, bottom-left. */
  palette?: AuroraPalette
}

/** Base position (fraction of viewport) + radius per blob — from the mockup's `blobs` literal. */
const BLOB_LAYOUT: ReadonlyArray<{ x: number; y: number; r: number }> = [
  { x: 0.2, y: 0.15, r: 340 },
  { x: 0.85, y: 0.2, r: 300 },
  { x: 0.5, y: 0.9, r: 380 },
  { x: 0.1, y: 0.8, r: 280 },
]

export function Aurora({ palette = MORNING_PALETTE }: AuroraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
  )
}
