# S58 — Tasks tab: slim Home, fold Up next/Later + Domains + Pulse [UI]

Post-v2 · Wave 12 · Deps: — · Blocks: S59 (TabBar hotspot)

Source: owner feedback item 1, `Post V2 User FeedBack, Features, Updates, Fixes.md`.

## Context
Home is doing too much. Owner wants Home to be ONLY the check-in surface —
Today's Mission, Today (calendar), Habits, Needs You (+ the am brief / pm Day
Review that already gate themselves). Everything list-shaped moves out: the
`NowView` Up next / Later folds, plus the whole Domains and Pulse tabs, land in
one new **Tasks** tab.

Tab IA goes 6 → 5: **Home · Tasks · Money · Career · Agents**. Domains and Pulse
stop being top-level tabs and become segments INSIDE Tasks, using the shipped
`src/components/glass/Segmented.tsx` (§4.1) as sub-nav: `Tasks · Domains · Pulse`.
Reuse `DomainsMap` and `PulseView` verbatim — this is a re-parenting slice, not
a rewrite. `NowView` also renders verbatim, but with `hideLive` OFF (MissionCard
no longer sits above it in the same view, so the top 3 must not be hidden).

This slice is the sole post-v2 `App.tsx` toucher (v2's rule was "only S24 ever
edits App.tsx"; that rule now transfers to S58 — no other post-v2 card may edit
it). It also owns `TabBar.tsx` ahead of S59, which rebases on this merge.

**Design doc is LOCKED but owner feedback overrides it** — §5 currently says
"nav.tabs Home · Money · Career · Agents · Domains · Pulse" and "Six tabs, no
more". Update those two lines in `docs/DESIGN_LANGUAGE.md` §5 in this PR (five
tabs; Domains/Pulse embedded in Tasks) or the eval's design-conformance check
correctly fails you.

## Write-set
- NEW `src/components/tasks/TasksView.tsx` — Segmented sub-nav (`tasks` default
  · `domains` · `pulse`) + the matching child. Props are pass-through only
  (`tasks`, `onToggle`, `onDelete`, `onUpdate`, `projects`); no data logic here.
- NEW `src/components/tasks/TasksView.test.tsx`.
- MODIFY `src/components/TabBar.tsx` — `ViewTab` union + `TABS` array: drop
  `domains`/`pulse`, insert `tasks` after `home`. Keep `data-testid="tab-bar"`.
- MODIFY `src/App.tsx` — mount `<TasksView …/>` for `tab === 'tasks'`; delete the
  `domains`/`pulse` branches (their imports move to TasksView).
- MODIFY `src/components/home/HomeView.tsx` — drop `<NowView/>` + its import.
  Keep `+ New task`, MissionCard, AttentionCard and the whole right stack.
  Update the file's header comment (it currently claims NowView owns the folds).
- MODIFY `docs/DESIGN_LANGUAGE.md` §5 — five-tab IA line + Home body line.
- MODIFY tests that assert 6 tabs / Domains / Pulse tab presence (grep
  `cockpitShell.test`, `TabBar.test`, `HomeView.test`, e2e specs for `Pulse`).

## Subtasks
1. TabBar tab list → 5. 2. TasksView shell + Segmented sub-nav. 3. App mount
swap. 4. HomeView slim-down. 5. Fix the fallout tests + e2e. 6. Design-doc §5 edit.

## Definition of Done
1. TabBar renders exactly 5 tabs in order Home · Tasks · Money · Career · Agents; `data-testid="tab-bar"` intact (tested).
2. Tasks tab renders NowView's Up next / Later folds with the top-ranked tasks VISIBLE (no `hideLive`) — the same task is never rendered twice anywhere in the app (tested).
3. Tasks tab's Segmented sub-nav switches between Tasks / Domains / Pulse; `DomainsMap` and `PulseView` render unchanged behavior; default segment is `tasks` (tested).
4. HomeView renders Mission, Needs You, Today, Habits, Fleet strip and NO Up next / Later section (tested).
5. `docs/DESIGN_LANGUAGE.md` §5 updated to the 5-tab IA; no other design-doc section touched.
6. `npm run build` (tsc) + `npm test` green, incl. pwa-e2e.

## Tests
5-tab assertion; no-duplicate-task assertion across Home+Tasks; sub-nav switch;
Home no longer shows "Up next"; reduced-motion path unaffected.

## Design refs
§4.1 (pill tab bar + seg control anatomy — sub-nav is the small `.seg` size),
§5 (IA; being edited by this slice), §7 (tab fade unchanged).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. ALONE on `src/App.tsx` +
`src/components/TabBar.tsx` — S59 rebases onto this merge. Disjoint from S60/S61.
