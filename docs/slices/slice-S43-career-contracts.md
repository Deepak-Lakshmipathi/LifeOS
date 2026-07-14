# S43 — Career vault contracts + parsers [UI]

Phase 7 · Wave 3 · Deps: S24 (soft) · Blocks: S44, S45, S46

## Context
Career tab = job-pipeline kanban + course progress, both vault files. Pipeline
entries come from the owner AND the job-scout agent (S46) — same file, append
by stage. Contracts + parsers + fixtures only.

## Contracts — `Career/`
```markdown
# Career/pipeline.md
- InstaCo — Senior Frontend (stage:: applied) (age:: 6d) (match:: 82%) (next:: follow up with recruiter)
- NorthStar — Founding Eng (stage:: interview) (age:: 2d) (hot:: true) (next:: prep system design)
- Acme — SWE II (stage:: found) (match:: 71%) (source:: job-scout)
- OldCorp — Staff (stage:: closed) (outcome:: rejected)

# Career/courses.md
- LLM Engineering Cert (progress:: 62) (next:: Module 4 quiz ~45min) (domain:: Growth)
- Kubernetes Deep Dive (progress:: 15) (next:: Lab 2)
```
Stages: `found | applied | interview | closed` (kanban columns, §4.10).
`hot:: true` → urgent card. `source::` = provenance (§8).

## Write-set
- NEW `src/vault/career.ts` — `JobEntry {company, role, stage, age?, match?,
  hot, next?, source?, outcome?}`, `Course {name, progress, next?, domain?}`;
  `parsePipeline(md)`, `parseCourses(md)`, `groupByStage(entries)` (fixed
  4-column order).
- NEW fixtures `src/vault/__fixtures__/career-{pipeline,courses}.md`.
- NEW `src/vault/career.test.ts`.

## Subtasks
1. Parsers. 2. groupByStage (fixed order, empty stages present). 3. Fixtures
covering all 4 stages + hot + scout-sourced. 4. Tests.

## Definition of Done
1. Pipeline fixture parses: all fields incl. hot/source/outcome (tested per stage).
2. groupByStage returns 4 keys in canonical order even when a stage is empty.
3. Courses: progress clamped 0–100; missing next tolerated.
4. Malformed lines skipped; unknown stage → `found` (with source preserved).
5. NO changes outside `src/vault/`. Tests green.

## Tests
Vitest: fixtures, grouping, clamping, malformed.

## Design refs
§4.10 shapes; no UI here.

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Fully parallel-safe (own file).
