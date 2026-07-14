# S27 — Today's Mission card [UI] — HomeView chain head

Phase 2 · Wave 4 · Deps: S24 · Blocks: S28; HomeView chain (S29→S32→S34→S37→S48→S50 serialize after this)

## Context
The cockpit's heart: 1–3 balance-brain picks with **why + done_when always
visible** (`docs/DESIGN_LANGUAGE.md` §4.3, §8). Reuses the shipped ranking:
`src/now/rankNow.ts` (priority queue) + `src/warmth/computeWarmth.ts`
(coldest-domain rescue). No new ranking logic — compose the existing seams.

## Write-set
- NEW `src/components/home/MissionCard.tsx` — glass Card titled "Today's
  Mission"; top 1–3 from rankNow + coldest-domain rescue inject (if the
  coldest domain has an open task not already picked, inject it with the
  `rescue` chip §4.3); mission task anatomy per §4.3 (dot, title, dom chip,
  priority chip, why line, done_when line, 3px domain stripe via `--dc`);
  veto affordance (dismiss a pick → next-ranked replaces it, session-only).
- NEW `src/lib/missionPicks.ts` — pure function `missionPicks(tasks, warmth) →
  {picks, rescue}` (testable without DOM).
- MODIFY `src/components/home/HomeView.tsx` — mount MissionCard (replace the
  v1 NOW list top section; keep capture flow).
- NEW tests for missionPicks + MissionCard.

## Subtasks
1. missionPicks pure fn (top-3 + rescue inject + veto exclusion list).
2. MissionCard render per §4.3. 3. HomeView mount. 4. Tests.

## Definition of Done
1. `missionPicks` returns ≤3 picks; when the coldest domain is unrepresented and has an open task, exactly one rescue pick is injected and flagged (unit-tested).
2. Veto removes a pick and pulls the next-ranked (tested).
3. Every rendered task shows why + done_when without hover/expander (§8).
4. Rescue task renders the ❄ dashed chip §4.3.
5. rankNow/computeWarmth files NOT modified.
6. Tests green.

## Tests
Vitest: missionPicks (rescue inject, veto), MissionCard render fixture.

## Design refs
§4.3 (full anatomy), §8 (why/done_when visible, cold looks cold).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. HOTSPOT: edits HomeView.tsx — serialize with other HomeView slices.
