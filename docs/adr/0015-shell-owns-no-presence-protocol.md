# The shell hosts no presence-acknowledgement protocol

Slice S63 (closes #173) removed the `AnimatePresence mode="wait"` wrapper that surrounded `src/App.tsx`'s tab sections. The symptom was the highest-severity find of the 2026-07-31 live-testing session: activate the Domains sub-tab inside Tasks, click any main tab, and the app blanks. The nav pill highlights and `aria-current="page"` moves, but the incoming panel never mounts and the outgoing panel stays in the DOM at `opacity: 0` — `main.innerText` still returns the Domains content and `document.elementFromPoint()` still resolves into the invisible tiles. Invisible-but-clickable, not a cosmetic blank. Only a reload recovers.

This ADR records the mechanism, because it constrains every future panel and every future motion slice.

## The protocol, and how a component joins it without meaning to

Established from the installed `framer-motion@11.18.2` source, not from memory.

`AnimatePresence` tracks exit completion through an **acknowledgement protocol**. `PresenceChild` holds a `Map` of registered descendant ids; `memoizedOnExitComplete(childId)` sets that id to `true` and then **returns early unless every entry in the map is `true`**. The auto-complete escape hatch — the `useEffect` that fires `onExitComplete()` immediately — only runs when the registration map is **empty**.

There are **two ways a descendant registers, both implicit**:

1. **Declaring `exit`.** `features/animation/exit.mjs` → `ExitAnimationFeature.mount()` calls `register`.
2. **Declaring `layout` or `layoutId`.** `features/layout/MeasureLayout.mjs` calls `usePresence()`, which calls `register(id)` on the nearest `PresenceContext` and thereby owes a `safeToRemove()`.

Neither is an opt-in and neither carries a type-level signal. Any descendant of any depth, in any file, can silently take on the obligation.

Three further properties make a missed acknowledgement unrecoverable:

- **It is edge-triggered and one-shot.** `ExitAnimationFeature.update()` bails on `isPresent === prevIsPresent`. Miss the edge and there is no retry.
- **There is no timeout, watchdog, or fallback anywhere in this path.** A lost acknowledgement is permanent for the lifetime of the page.
- **`PresenceChild` rebuilds its context on every render.** `presenceAffectsLayout` defaults to `true`, which puts `Math.random()` in the `useMemo` deps, forcing every descendant motion node to re-render and re-enter `animateChanges()`. That is the churn that loses the edge.

## Blast radius differs per mode — `wait` is a blackout, `sync` is a ghost layer

Under **`mode="wait"`**, `nextChildren = exitingChildren`: the incoming child is **not rendered at all** until every acknowledgement lands. One missing ack is a total blackout of the subtree.

Under **`mode="sync"`** (the default), the incoming child mounts immediately and the worst case is a stuck ghost layer stacked with the live content.

This distinction is why `HomeView.tsx`'s CaptureSheet block (#181/S71) is *not* the same defect: it is a well-formed, default-`sync` `AnimatePresence` with a properly nested exit pair, and an unfulfilled ack there cannot blank the app.

## The decision

**`src/App.tsx` wraps its tab sections in no presence component.** Tabs swap on the `key` change of `<motion.section key={tab}>`: React unmounts the outgoing section synchronously and the incoming one fades in. `TAB_FADE` declares no leaving state.

The reasoning is architectural, not incidental. The shell is a microkernel and the tab panels are plugins. Hosting this protocol made **the shell's correctness a function of the internal animation details of arbitrary descendants of arbitrary panels**, through an untimed, edge-triggered, implicitly-joined channel — i.e. it let a plugin hang the core. Deleting the individual orphaned `exit` props (the fix #173 itself suggested) would have cleared the current fuse and left the powder dry for the next panel that declares `exit`, `layout`, or `layoutId`.

Corroborating evidence that the orphaned `exit` was the fuse rather than the cause: measured on real Chromium against pre-fix `master`, `PulseView` had the *identical* orphaned-`exit` shape and did **not** trap under any condition tried, and `DomainsMap` trapped **only** with the 107-task seed present — with `?noseed` it unmounted cleanly. The trigger was seed-driven render churn inside the 300 ms exit window; the defect was the protocol.

Note also that `TAB_STATIC`, the reduced-motion branch, has never declared a leaving state and has never trapped. This decision makes the motion branch match the branch already proven correct, and collapses an asymmetry between the two that was itself the hazard.

### What this also closes, that nobody had named

`NowView.tsx`'s `motion.div layout` and `TaskItem.tsx`'s `layout` register via `MeasureLayout`'s `usePresence()` — obligation class (2) above. Before this change their nearest presence ancestor was App's `mode="wait"` child. After it there is **no `PresenceContext` above `NowView` at all**, so the obligation simply does not exist. No code changed for this; it fell out of removing the wrapper.

## Consequences

- **The outgoing tab fade is lost — the exit is now a cut.** `docs/DESIGN_LANGUAGE.md` §2.3 specifies `Tab fade | .3s ease, opacity + 6px rise | continuity between tabs`: a duration, two properties and an intent. It does not mandate a leaving animation or sequential choreography, so an enter-only fade satisfies the contract as written. The enter fade, its duration and its 6px rise are unchanged. This is a real visual change and was accepted deliberately.
- **Enter-only is now the rule for panel roots.** `DomainsMap`, `PulseView` and `NowView`'s empty state each lost a root `exit` (and its vestigial `key`) that could never have run as intended — nothing wrapped them in a presence component. Do not restore them for symmetry.
- **A structural test guards the shell.** `src/test/shellNavigation.test.tsx` asserts `src/App.tsx` contains no `AnimatePresence` reference, so a future slice cannot silently re-arm the hazard with one auto-import. Its companion mounts a panel that never discharges its presence obligation and requires the shell to navigate away from it anyway — the invariant is *the shell's correctness does not depend on any panel's animation behaviour*.
- **Nested `AnimatePresence` inside a panel remains fine and is not deprecated.** `NowView`'s three blocks, `UndoToast`, `TaskItem` and `HomeView` all keep theirs: each is a legitimate `exit` under a real presence ancestor that is not `mode="wait"`. The rule is about the **shell**, which is the one place a stall has no containment.
- **Revisit when:** anyone proposes cross-tab motion choreography, `mode="wait"`, or a shared `<TabPanel>` motion wrapper. Any of those re-introduces the acknowledgement channel. Also revisit if framer-motion ships a timeout or an explicit opt-in for presence registration — the two implicit registration classes are the actual defect, and this decision is a workaround for their absence.
