import { Card } from '../glass/Card'

/**
 * VitalsRow — auto-fit grid of Life Vitals (Warmth · Net worth · Burn ·
 * Pipeline · Streak), §4.2 / §5.
 *
 * STUB (S24). This file is the head of the VitalsRow hotspot chain
 * (S26 → S41 → S45); S26 fills it with the real vitals grid. For now it
 * renders a placeholder Card so App.tsx never edits this mount point again.
 */
export function VitalsRow() {
  return (
    <Card heading="Life Vitals" className="mb-[14px]">
      <p className="text-sm text-dim">The vitals grid arrives in S26.</p>
    </Card>
  )
}
