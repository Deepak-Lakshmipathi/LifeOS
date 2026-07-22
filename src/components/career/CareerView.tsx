import { Card } from '../glass/Card'
import { PipelineBoard } from './PipelineBoard'
import { CoursesCard } from './CoursesCard'
import type { JobEntry, Course } from '../../vault/career'

/**
 * CareerView — Career tab: full-width job pipeline, then Courses (§5).
 *
 * S24 mounted this as a stub; S44 fills it. Purely presentational over
 * already-parsed S43 shapes (`parsePipeline` / `parseCourses`). App.tsx mounts
 * `<CareerView />` with no props today — every prop defaults to an empty array
 * so it honestly renders empty columns / "no data yet" rather than fetching or
 * fabricating entries, matching the MoneyView (S40) stub-fill precedent, until
 * S46's job-scout agent wires real props through. This file never re-imports
 * App.tsx and touches nothing outside `src/components/career/`.
 */

export interface CareerViewProps {
  /** Parsed pipeline entries (`parsePipeline` output). */
  jobs?: JobEntry[]
  /** Parsed course-progress rows (`parseCourses` output). */
  courses?: Course[]
}

export function CareerView({ jobs = [], courses = [] }: CareerViewProps) {
  return (
    <div className="flex flex-col gap-3.5">
      {/* §5: full-width pipeline card, then Courses card. */}
      <Card heading="Pipeline" count={jobs.length} data-testid="career-pipeline-card">
        <PipelineBoard jobs={jobs} />
      </Card>

      <Card heading="Courses" data-testid="career-courses-card">
        <CoursesCard courses={courses} />
      </Card>
    </div>
  )
}
