import { useState } from 'react'
import type { Task } from '../../types'
import { NowView } from '../NowView'
import { DomainsMap } from '../DomainsMap'
import { PulseView } from '../PulseView'
import { Segmented } from '../glass/Segmented'

/**
 * TasksView — the Tasks tab (Slice S58).
 *
 * Home used to own the NowView task list plus two whole top-level tabs
 * (Domains, Pulse). Owner feedback: Home should be ONLY the check-in surface;
 * everything list-shaped re-parents here behind a `Segmented` sub-nav
 * (§4.1's small `.seg` size) — `Tasks · Domains · Pulse`, default `Tasks`.
 *
 * This is a re-parenting slice, not a rewrite: `NowView`, `DomainsMap` and
 * `PulseView` render verbatim, unchanged. NowView renders with `hideLive`
 * OFF here (the default) — MissionCard no longer sits above it in this view,
 * so the top-ranked tasks must be visible, not hidden. Props are pass-through
 * only; this file owns no data/ranking logic of its own.
 */

type SegmentId = 'tasks' | 'domains' | 'pulse'

const SEGMENTS: { id: SegmentId; label: string }[] = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'domains', label: 'Domains' },
  { id: 'pulse', label: 'Pulse' },
]

interface TasksViewProps {
  tasks: Task[]
  onToggle: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdate: (
    id: string,
    patch: Partial<Pick<Task, 'title' | 'done_when' | 'priority' | 'project' | 'domain'>>
  ) => Promise<void>
  projects: string[]
}

export function TasksView({ tasks, onToggle, onDelete, onUpdate, projects }: TasksViewProps) {
  const [segment, setSegment] = useState<SegmentId>('tasks')

  return (
    <div>
      <div className="mb-3 flex justify-center">
        <Segmented
          options={SEGMENTS}
          value={segment}
          onChange={(id) => setSegment(id as SegmentId)}
          ariaLabel="Tasks sub-navigation"
        />
      </div>

      {segment === 'tasks' && (
        <NowView
          tasks={tasks}
          onToggle={onToggle}
          onDelete={onDelete}
          onUpdate={onUpdate}
          projects={projects}
        />
      )}
      {segment === 'domains' && <DomainsMap tasks={tasks} />}
      {segment === 'pulse' && <PulseView tasks={tasks} />}
    </div>
  )
}
