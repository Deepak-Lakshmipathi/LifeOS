# Balance brain: per-domain cap + cold-domain rescue in rankNow

**Status:** accepted  
**Slice:** S10  
**Extends:** ADR-0007 (dumb brain, pure `rankNow` seam)

## Context

ADR-0007 established `rankNow` as the pure ranking seam for the NOW view — a
flat, domain-blind priority sort. The balance brain (S10) upgrades it to
prevent any single domain flooding NOW and to ensure neglected domains surface
before they go invisible.

Two concrete failures motivate the change:
1. **Flood**: a user with 20 high-priority Career tasks sees *only* Career in
   NOW. Life balance disappears.
2. **Rot**: a domain with no recent activity silently falls off the radar
   entirely — it never surfaces in NOW even when tasks exist.

The warmth derivation (`computeWarmth`, S9) already classifies every domain as
`hot | warm | ok | stale | cold`. The balance brain exploits that signal.

## Decision

### Signature extension

```ts
rankNow(tasks: Task[], warmth: Record<Domain, WarmthState>, opts?: RankNowOpts): RankedTask[]
```

`warmth` is injected by the caller (`NowView` computes it via
`computeWarmth(tasks, Date.now())`). `rankNow` **never calls `Date.now()` or
`computeWarmth` itself** — it remains a pure, deterministic function over its
inputs. This upholds the principle from ADR-0007 that the ranking seam has no
side effects.

### Return type: `RankedTask[]`

```ts
interface RankedTask {
  task: Task
  rescue: boolean  // true for the single rescue slot, false for all others
}
```

A flat array keeps the view's slicing logic (LIVE_COUNT, UPNEXT_COUNT) unchanged.
The rescue task is appended as the last element, flagged `rescue: true`.

### Per-domain cap (step 2)

After sorting open tasks by priority desc → `created_at` asc (preserved from
S6), the algorithm walks the sorted list and admits each task only if its
domain's running count is below `domainCap` (default `DOMAIN_CAP_DEFAULT = 2`,
a named constant). Domain-less (inbox) tasks are never capped — they carry no
domain signal to balance.

The cap is per-domain, not global. A domain with only one task still contributes
that task; the cap merely prevents any single domain from occupying more than
`domainCap` slots in the admitted set.

### Rescue injection (step 3)

After the cap pass, the algorithm finds the domain with the coldest rescue-
eligible warmth state. Rescue-eligible states are **`cold`** and **`stale`**
(the two states indicating meaningful neglect). States `ok`, `warm`, and `hot`
do not trigger rescue — `ok` means the domain is fine; intervention is not
needed.

**Coldest domain selection:**
- Walk `DOMAINS` (canonical declaration order acts as tie-breaker).
- Among eligible domains pick the one with the lowest warmth rank (cold=0 <
  stale=1 < ok=2 < warm=3 < hot=4).
- If no domain is `cold` or `stale`, no rescue is injected.

**Rescue candidate selection:**
- From the already-sorted `open` array, pick the first task whose `domain`
  equals the coldest domain **and** whose `id` is not already in the admitted
  set.
- This gives the highest-priority (then oldest) task from that domain that
  the cap excluded — the most deserving task to rescue.
- If no such candidate exists (all tasks from the cold domain are already
  admitted, or the cold domain has no open tasks), no rescue is injected.

**No-duplicate guarantee:** the admitted-ids set is checked before nominating a
rescue candidate, ensuring the rescue task never appears twice in the result.

### Visual marker

The rescue `RankedTask` entry has `rescue: true`. `NowView` passes this flag
to `TaskItem` as `rescue?: boolean`. `TaskItem` renders a `❄ cold rescue` badge
on the card and a subtle blue tint to the card background — reusing the warmth
visual pattern established in `DomainsMap` (S9).

## Algorithm summary

```
open ← filter(!done) + sort(priority desc, created_at asc)

admitted ← []
domainCount ← {}
for task in open:
  if isDomain(task.domain):
    if domainCount[domain] >= cap: continue
    domainCount[domain]++
  admitted.push(task)

coldestDomain ← argmin(WARMTH_RANK, domains where state ∈ {cold,stale})
rescueTask ← first task in open where domain=coldestDomain AND id ∉ admittedIds

result ← admitted.map({task, rescue:false})
if rescueTask: result.push({task:rescueTask, rescue:true})
return result
```

## Consequences

- **NOW is balanced**: no domain floods the live set. Users with many tasks in
  one area still see cross-domain diversity.
- **Neglect is surfaced**: a cold domain always gets a card in NOW (if it has
  open tasks outside the cap), ensuring it doesn't rot silently.
- **Pure seam preserved**: `rankNow` is still a pure function. Tests inject
  warmth directly; no mocking of `Date.now` or `computeWarmth` is needed.
- **One rescue max**: exactly zero or one rescue task per call. The view renders
  it as a distinctly styled card.
- **Revisit when:** S11 (Glass pass) may reskin the rescue card. A future slice
  could expose `domainCap` as a user preference. The rescue threshold (currently
  `cold | stale`) could be made configurable.
