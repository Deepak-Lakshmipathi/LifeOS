# NOW view ranks open tasks by pure priority (the dumb brain)

Slice S6 adds the first command-center surface: a **NOW** view answering "what do I do now?". It is intentionally the *dumb* brain — a flat, cross-domain, priority-only ranking — so the surface exists and is trusted before the balance brain (S10) makes it smart (per-domain cap + coldest-domain injection + warmth). Three design calls were resolved up-front so the slice is Sonnet-implementable.

## Ranking is a pure function, domain-blind, priority-only

`src/now/rankNow.ts` exports `rankNow(tasks: Task[]): Task[]` — pure, no I/O, no store access. It:
- **Excludes done tasks** (`!t.done`).
- Sorts **priority descending**, treating absent `priority` as `0` so any prioritized task ranks above any unprioritized one (`3 → 2 → 1 → none`).
- Tie-breaks by **`created_at` ascending** (oldest first — it has waited longest).

It is **domain-blind by design** — no per-domain cap, no coldest-domain injection, no warmth. Those are S9/S10 and explicitly out of scope. The signature stays **single-argument** in v0; S10 will widen it (e.g. accept derived warmth) when that data exists — we do **not** add the parameter speculatively now. `rankNow` is the seam S10 replaces/extends, so the ranking logic lives here, never inside the view component. Fully unit-tested in `src/now/rankNow.test.ts` (Vitest): priority order, undefined-priority sinks, created_at tie-break, done excluded, empty input.

## NOW layout: top-3 live, the rest folded

`src/components/NowView.tsx` renders `rankNow(tasks)` as:
- The **top 3** ranked tasks as **live cards** (full `TaskItem`, reused — complete/edit/delete work).
- The **next 5** folded under a collapsible **"Up next (N)"** section.
- The **remainder** folded under a collapsible **"Later (N)"** section.
- Both folded sections are **collapsed by default**, expand via local `useState`, and show their counts. A section with zero tasks is not rendered.
- No open tasks → the calm empty state.

Constants are literal: `LIVE_COUNT = 3`, `UPNEXT_COUNT = 5` (acceptance allows "top 3–5 live"; 3 chosen). Completing a live task removes it from NOW and the next ranked task rises (reuses the existing `useTasks` refresh-after-mutation flow; no new reactivity).

## App integration: a throwaway Now/All toggle (S7 replaces it)

`src/App.tsx` gains a minimal segmented toggle in the header — **`Now | All`**, `useState<'now' | 'all'>('now')`, defaulting to **Now**. `now` renders `NowView`; `all` renders the existing nested `TaskList`. Both receive the same `tasks` + handlers (`toggleDone`, `deleteTask`, `updateTask`, `projects`). This toggle is **deliberate throwaway scaffolding** — the real navigation is the tab bar in S7, which will subsume it. Marked with a `ponytail:` comment so the next slice deletes rather than extends it.

## Data / model: none

S6 is pure selection/sort over existing tasks. No `Task` field added, no seam method added, no Dexie index, **no schema bump** (stays v2). Read-only via `list()`; the seam is untouched. PWA install/offline unaffected.

## Consequences

- The home surface now leads with a ranked NOW queue; the full nested list is one toggle away.
- **Revisit when:** S9 (warmth: `completed_at`) and S10 (balance brain) — `rankNow` widens to take warmth and apply the per-domain cap + coldest-domain injection; the `Now | All` toggle is deleted by S7's tab bar.
