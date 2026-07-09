# Fable 5 prompt — generate the LifeOS design-language doc

Paste everything in the fenced block below into **Fable 5**. It produces
`docs/DESIGN_LANGUAGE.md`, the single source of visual truth reused every session.

After Fable writes it, add one line to the repo `CLAUDE.md` so every Claude Code
session auto-loads it:

```
- **Design language** — all UI work MUST follow `docs/DESIGN_LANGUAGE.md` (Glass Cockpit). Read it before touching any component or style.
```

---

```prompt
You are Fable 5 writing the canonical design-language document for LifeOS — a
single-user "life cockpit" PWA. Output ONE file: `docs/DESIGN_LANGUAGE.md`.
This file is loaded into EVERY future coding session as the visual contract, so
it must be precise, self-contained, and unambiguous — a builder who has never
seen the mockup must reproduce the look from this doc alone.

The design is locked. It is the "Glass Cockpit" mockup here:
https://claude.ai/code/artifact/576a94b7-432a-4ae6-8170-376a343291c0
Fetch it and treat its CSS as ground truth. The extracted tokens below are
authoritative — copy them verbatim, do not re-invent values.

## Ground-truth tokens (verbatim from the mockup)
Surface:      --bg:#0b0f1e  --bg2:#10162b
Panels:       --panel:rgba(255,255,255,.055)  --panel-brd:rgba(255,255,255,.09)
Text:         --txt:#e8ecf6  --dim:#8b93ab  --faint:#5a6178
Domains:      build #f59e0b · career #38bdf8 · growth #a78bfa · admin #94a3b8 ·
              body #2dd4bf · finance #4ade80 · relationship #f472b6
Semantic:     good #4ade80 · warn #fbbf24 · bad #f87171
Radius:       card 18px · tiles 14px · chips/pills 999px
Blur:         seg/nav backdrop-filter blur(12–14px); cards blur(16px)
Type:         "SF Pro Display", -apple-system, "Segoe UI Variable Display",
              system-ui — H1 30/700 letter-spacing -.02em; section H2 12/600
              uppercase letter-spacing .12em color faint; tabular-nums on all metrics
Motion:       aurora canvas (drifting radial blobs, opacity .55, palette shifts
              by time-of-day); card radial spotlight follows cursor; count-up
              on metrics (cubic ease-out ~900ms); 6s text-shine on greeting;
              tab fade-in translateY(6px); ALL motion killed under
              prefers-reduced-motion.

## The doc MUST contain, in this order
1. **How to use this file** — one paragraph: this is the visual contract; every
   component and style change must conform; deviations need an explicit reason.
2. **Design tokens** — full table (color, type, space, radius, blur, z, motion
   durations/easings), each with the CSS custom-property name and value above,
   ready to drop into `:root`. Include a Tailwind `theme.extend` mapping.
3. **The Glass principle** — the translucent-layered-over-aurora philosophy in
   3-4 sentences: depth via blur + faint white borders, domain color bled
   through frosted panels, never flat fills.
4. **Component specs** — for each, the anatomy, exact styles, states, and a
   minimal markup skeleton: Card (with cursor spotlight), Vital tile, Chip
   (domain / priority-high / priority-med / rescue-dashed variants), Segmented
   control (time-of-day), Pill tab bar, Mission task row (accent bar in domain
   color, dot toggle, why + done-when lines), Attention row, Calendar slot +
   event chip + gap hint, Habit row (7-day grid, hit/today/broken states,
   streak), Fleet LED (ok/bad-blink/idle), Agent table row + infra badge
   (GHA/PC/VPS), Money widgets (big metric, sparkline, donut, bar, bills row),
   Kanban column + job card.
5. **Layout & IA** — max-width 1180px shell; header → vitals row → pill tabs →
   tab body; Home grid 1.5fr/1fr collapsing to 1col ≤840px; the six tabs
   (Home/Money/Career/Agents/Domains/Pulse).
6. **Time-of-day system** — how morning/midday/evening shift greeting, subtitle,
   aurora palette, and which cards surface (evening reveals Day Review).
7. **Motion & a11y** — every animation with its trigger + duration + easing, and
   the reduced-motion contract.
8. **Do / Don't** — 8-10 pairs that pin the taste (e.g. "DO bleed domain color
   through frosted panels; DON'T use opaque domain fills").

Rules: exact values only, no placeholders. Dark theme is the only theme.
Everything inline-reproducible. Keep it a spec, not an essay. Output only the
markdown file content.
```
