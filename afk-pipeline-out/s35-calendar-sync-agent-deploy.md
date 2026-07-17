# Deploy table — S35 calendar-sync agent

Pre-sliced tracer-bullet ticket (already carried a PRD-lite header + DoD in
`docs/slices/slice-S35-calendar-sync-agent.md`); P0/P1/P2/P3 skipped per the
light-path rule (see `afk-pipeline-out/LESSONS.md`, 2026-07-14 S20 lesson).
Ran P0 -> publish issue -> implement -> triple-green directly.

## AFK-deployable table

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| [#122 — S35 — calendar-sync agent (GH Actions → Calendar/today.md) \[AGENT\]](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/122) | Ship a GitHub Actions cron agent that maps today's Google Calendar events to the S33 `Calendar/today.md` contract and pushes it to `LiveOS-VaultRepo`. | files: `agents/calendar-sync/sync.mjs`, `agents/calendar-sync/sync.test.mjs`, `agents/calendar-sync/record-status.mjs`, `agents/calendar-sync/README.md`, `.github/workflows/agent-calendar-sync.yml`; contract: `src/vault/calendar.ts` (S33, read-only reference — not in this slice's write-set); blocked by: S33 (merged, PR #113); do NOT touch: any file outside `agents/calendar-sync/` and the one new workflow file; test: `agents/calendar-sync/sync.test.mjs` (mocked-API mapper roundtrip through the real `parseCalendar`) | Sonnet | batch-1 (status:ready, own dir — fully disjoint from every other v2 slice per `docs/agents/afk-pipeline.md` known-hotspots) |

## HITL-flagged section

None. The ticket carried zero open design questions; the four minor gaps
(secret names, commit author string, event-type keyword map, S47 wiring)
were resolvable as documented assumptions (recorded in issue #122 and the
PR body) rather than genuine business/product unknowns — none rose to the
HITL bar.

| Issue | Why HITL | What the human must decide | Assumption made (auto mode) |
|-------|----------|----------------------------|------------------------------|
| — | — | — | — |

## Run summary

- Issue: [#122](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/122)
- PR: [#125](https://github.com/Deepak-Lakshmipathi/LifeOS/pull/125)
- Branch: `slice/s35-calendar-sync-agent`
- Dispatch: orchestrator-implemented inline (no subagent dispatch — single
  pre-resolved slice, implemented directly to keep exact control over
  secret-naming and commit-author conventions already fixed by prior
  slices S33/S47/S57).
- Attempts: 1 (no rejects, no flake reruns needed at implementation time).
