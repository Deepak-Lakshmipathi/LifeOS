import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { BarMeter, type BarMeterVariant } from '../money/BarMeter'
import type { Course } from '../../vault/career'

/**
 * CoursesCard — course-progress block (DESIGN_LANGUAGE §4.10 course block,
 * §4.9 bar-meter gradients).
 *
 * Each row is a title + % header (14px/600), then the shared S40 BarMeter
 * (reused, never duplicated — DoD #3 asserts this import path), then a
 * next-lesson line (12.5px `--dim`) whose pointer is the §2.1 indigo-action
 * accent `#a5b4fc` at 600. Growth-domain courses take the §4.9 growth-course
 * gradient; Body & Mind courses take the body-course gradient.
 *
 * The percentage counts up once on load (§7) and is gated by framer-motion's
 * `useReducedMotion()` — the app's established pattern (MoneyView, TaskItem):
 * under reduced motion it jumps straight to the target, scheduling no timers.
 */

const COUNT_UP_MS = 900

/** §7 count-up `1-(1-p)^3` over 900ms; no-ops (jumps to target) when skipped. */
function useCountUp(target: number, skip: boolean, duration = COUNT_UP_MS): number {
  const [display, setDisplay] = useState(() => (skip ? target : 0))

  useEffect(() => {
    if (skip) {
      setDisplay(target)
      return
    }

    let timer: ReturnType<typeof setTimeout>
    const start = Date.now()

    const step = () => {
      const elapsed = Date.now() - start
      const p = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(target * eased)
      if (p < 1) {
        timer = setTimeout(step, 16)
      }
    }

    step()
    return () => clearTimeout(timer)
  }, [target, skip, duration])

  return display
}

/**
 * §4.9 gives course bars two gradients: growth-course and body-course. Map a
 * course's free-form domain tag onto the matching BarMeter variant; anything
 * that isn't a Body & Mind course reads as growth (the default course track).
 */
function courseVariant(domain?: string): BarMeterVariant {
  return domain?.toLowerCase().includes('body') ? 'body' : 'growth'
}

function CourseRow({ course, skipMotion }: { course: Course; skipMotion: boolean }) {
  const value = useCountUp(course.progress, skipMotion)
  const pct = Math.round(value)
  const variant = courseVariant(course.domain)

  return (
    <div data-testid="course-row" data-domain={course.domain ?? ''}>
      <div className="flex items-baseline justify-between text-[14px] font-semibold text-txt">
        <span>{course.name}</span>
        <span data-testid="course-pct" className="tabular-nums">
          {pct}%
        </span>
      </div>
      <div className="mt-1.5">
        <BarMeter variant={variant} pct={pct} ariaLabel={`${course.name} progress`} />
      </div>
      {course.next ? (
        <div data-testid="course-next" className="mt-1.5 text-[12.5px] text-dim">
          Next: <span className="font-semibold text-[#a5b4fc]">{course.next}</span>
        </div>
      ) : null}
    </div>
  )
}

export interface CoursesCardProps {
  /** Parsed courses (`parseCourses` output); empty renders the honest empty state. */
  courses?: Course[]
}

export function CoursesCard({ courses = [] }: CoursesCardProps) {
  const prefersReducedMotion = useReducedMotion() ?? false

  if (courses.length === 0) {
    return <p className="text-sm text-dim">No course progress yet.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {courses.map((course, i) => (
        <CourseRow key={`${course.name}-${i}`} course={course} skipMotion={prefersReducedMotion} />
      ))}
    </div>
  )
}
