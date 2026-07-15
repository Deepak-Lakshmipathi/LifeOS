import { Card } from '../glass/Card'

/**
 * Header — cockpit greeting + date/mission-note + time-of-day seg control.
 *
 * STUB (S24). S25 fills this with the shining greeting (§7), the mission-note
 * subtitle (§6), and the Morning/Midday/Evening `Segmented` control that drives
 * the aurora palette. For now it renders a placeholder Card so App.tsx has a
 * stable mount point it never has to edit again.
 */
export function Header() {
  return (
    <Card heading="Header" className="mb-[14px]">
      <p className="text-sm text-dim">Greeting, date &amp; time-of-day control arrive in S25.</p>
    </Card>
  )
}
