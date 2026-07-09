# LifeOS Design Language — "Glass Cockpit"

**Status: LOCKED · 2026-07-08 · dark-only · single source of visual truth**
Ground truth: the Glass Cockpit mockup (`cockpit-glass.html`, artifact `576a94b7-432a-4ae6-8170-376a343291c0`). Where this doc and the mockup disagree, the mockup's CSS wins; fix this doc.

---

## 1. How to use this file

This is the visual contract for every LifeOS surface. Every new component, screen, or style change must conform to the tokens, component specs, and Do/Don't rules below — a builder who has never seen the mockup must be able to reproduce the look from this document alone. Deviations require an explicit written reason in the PR description (one line: what deviates, why the token/spec could not serve). Never introduce a new color, radius, blur, font size, or duration without adding it here first, in the same PR.

## 2. Design tokens

Drop into `:root` verbatim. Dark is the only theme (`html { color-scheme: dark }`).

### 2.1 Color

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0b0f1e` | page ground (deep navy-indigo night) |
| `--bg2` | `#10162b` | secondary ground (raised base, rarely used directly) |
| `--panel` | `rgba(255,255,255,.055)` | frosted panel fill |
| `--panel-brd` | `rgba(255,255,255,.09)` | panel hairline border |
| `--txt` | `#e8ecf6` | primary text |
| `--dim` | `#8b93ab` | secondary text |
| `--faint` | `#5a6178` | tertiary text, labels, disabled |
| `--d-build` | `#f59e0b` | domain: Building Things |
| `--d-career` | `#38bdf8` | domain: Career |
| `--d-growth` | `#a78bfa` | domain: Growth |
| `--d-admin` | `#94a3b8` | domain: Life Admin |
| `--d-body` | `#2dd4bf` | domain: Body & Mind |
| `--d-fin` | `#4ade80` | domain: Finance |
| `--d-rel` | `#f472b6` | domain: Relationship |
| `--good` | `#4ade80` | semantic: ok / gain / up |
| `--warn` | `#fbbf24` | semantic: caution / due soon |
| `--bad` | `#f87171` | semantic: failure / loss / overdue |

Domain-tinted fills are always the domain color at low alpha via `color-mix(in srgb, var(--dc) 18%, transparent)` (chips) or hand-tuned rgba at `.11–.18` alpha (calendar chips, icon wells). Accent text-on-tint pairs (lighter shades of the same hue, used for legible text on tinted grounds): career `#bae6fd`, build `#fde68a`, body `#99f6e4`, growth/indigo actions `#a5b4fc` on `rgba(165,180,252,.12)`, warn text `#fcd34d`, bad text `#fca5a5`, good text `#86efac`, growth badge `#c4b5fd`.

Semantic ≠ accent: `--good/--warn/--bad` mark state only; `--d-fin` happens to share `#4ade80` with `--good` but is referenced by its own token.

### 2.2 Type

Font stack (only stack in the app):

```css
font-family: "SF Pro Display", -apple-system, "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif;
```

| Role | Size/weight | Extras |
|---|---|---|
| H1 greeting | 30px / 700 | `letter-spacing:-.02em`; shine gradient (see §7) |
| Big metric (`.big`) | 38px / 800 | `letter-spacing:-.02em; font-variant-numeric:tabular-nums` |
| Vital value (`.v`) | 22px / 700 | tabular-nums |
| Card heading (`h2`) | 12px / 600 | `text-transform:uppercase; letter-spacing:.12em; color:var(--faint)` |
| Vital label (`.k`) | 11px / 400 | uppercase, `letter-spacing:.09em`, `--faint` |
| Task title | 15.5px / 600 | |
| Body/row text | 13–13.5px / 400 | |
| Sub/meta lines | 11.5–12.5px | `--dim` or `--faint` |
| Chips/badges | 10.5–11px / 600 | `letter-spacing:.03–.08em` |

All numerals that align in columns get `font-variant-numeric: tabular-nums`. `-webkit-font-smoothing: antialiased` on body.

### 2.3 Space, radius, blur, z, motion

| Token group | Values |
|---|---|
| Shell | `max-width:1180px; padding:28px 24px 90px; margin:0 auto` |
| Grid gaps | cards `14px`; vitals `10px`; inner lists `8–10px`; pipeline `10px` |
| Card padding | `18px 20px`; tiles `12px 14px`; rows `9–13px` vertical |
| Radius | card `--r:18px` · vital tile/mission task/pipeline col `14px` · attention row `12px` · job card `10px` · calendar chip `9px` · icon well `9px` · habit dot `4px` · chips/pills/segments `999px` |
| Blur | segmented control `backdrop-filter: blur(12px)` · vitals + tab bar `blur(14px)` · cards `blur(16px)` |
| Z | aurora canvas `position:fixed; inset:0; z-index:0; opacity:.55; pointer-events:none` · `.shell` `position:relative; z-index:1`. Nothing else stacks. |
| Motion | hover/utility transitions `.2s` · tab switch `fade .3s ease` (opacity 0→1 + translateY(6px)→0) · count-up ~`900ms` cubic ease-out (`1-(1-p)^3`) · greeting shine `6s linear infinite` · LED failure blink `1.2s infinite` (50% opacity .35) · aurora drift: rAF, `tick += .004`, blob offset `sin/cos × .05` of viewport |

### 2.4 Tailwind mapping

```js
// tailwind.config.js — theme.extend
extend: {
  colors: {
    bg: '#0b0f1e', bg2: '#10162b',
    txt: '#e8ecf6', dim: '#8b93ab', faint: '#5a6178',
    good: '#4ade80', warn: '#fbbf24', bad: '#f87171',
    domain: {
      build: '#f59e0b', career: '#38bdf8', growth: '#a78bfa',
      admin: '#94a3b8', body: '#2dd4bf', fin: '#4ade80', rel: '#f472b6',
    },
    panel: 'rgba(255,255,255,.055)',
    'panel-brd': 'rgba(255,255,255,.09)',
  },
  borderRadius: { card: '18px', tile: '14px', row: '12px', chip: '9px' },
  backdropBlur: { seg: '12px', tile: '14px', card: '16px' },
  fontFamily: {
    sans: ['"SF Pro Display"', '-apple-system', '"Segoe UI Variable Display"', '"Segoe UI"', 'system-ui', 'sans-serif'],
  },
  maxWidth: { shell: '1180px' },
  transitionDuration: { DEFAULT: '200ms', tab: '300ms' },
}
```

## 3. The Glass principle

Depth comes from light, not lines: every surface is a translucent white film (`--panel`) over a living aurora, edged with a faint white hairline (`--panel-brd`) and backdrop blur — never a flat opaque fill. Domain color is *bled through* the frost at low alpha (tints, glows, thin stripes), never painted on as a solid block. Hierarchy = blur radius + white alpha: the deeper the layer, the darker and blurrier. The background is alive (drifting aurora blobs) but everything readable sits on frosted glass above it.

## 4. Component specs

Shared card base — everything below sits in or on this:

```css
.card{position:relative;background:var(--panel);border:1px solid var(--panel-brd);
  border-radius:18px;padding:18px 20px;backdrop-filter:blur(16px);overflow:hidden}
/* cursor spotlight — required on every card */
.card::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  background:radial-gradient(420px circle at var(--mx,50%) var(--my,-40%),rgba(255,255,255,.08),transparent 60%)}
```

```js
// spotlight driver (mousemove per card)
card.addEventListener('mousemove', e => {
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
  card.style.setProperty('--my', (e.clientY - r.top) + 'px');
});
```

Card heading: `<h2>` per §2.2, `margin-bottom:14px`. Counts append after a `·` (e.g. `Needs you · 4`).

### 4.1 Segmented pill control (time-of-day) & tab bar

Same anatomy at two sizes: frosted pill track, borderless buttons, active = brighter white fill.

```css
.seg{display:flex;background:var(--panel);border:1px solid var(--panel-brd);
  border-radius:999px;padding:3px;backdrop-filter:blur(12px)}
.seg button{background:none;border:0;color:var(--dim);font-size:13px;padding:7px 16px;border-radius:999px;cursor:pointer}
.seg button.on{background:rgba(255,255,255,.12);color:var(--txt)}

nav.tabs{/* same, but */ padding:4px; blur(14px); margin:0 auto 24px; width:max-content}
nav.tabs button{font-size:14px;padding:9px 20px;transition:.2s}
nav.tabs button.on{background:rgba(255,255,255,.13);color:var(--txt);box-shadow:0 1px 8px rgba(0,0,0,.3)}
```

Tab panels: `.tab{display:none}` / `.tab.on{display:block;animation:fade .3s ease}` with `@keyframes fade{from{opacity:0;transform:translateY(6px)}}`.

### 4.2 Vital tile

```html
<div class="vital">
  <div class="k">Net worth</div>          <!-- 11px uppercase label -->
  <div class="v">₹18.4L</div>             <!-- 22/700 tabular; count-up on load -->
  <div class="s up">▲ 2.1% this month</div><!-- 12px sub; .up=--good .dn=--bad -->
</div>
```

Tile: panel fill, `border-radius:14px`, `padding:12px 14px`, `blur(14px)`. Vitals row: `display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px`.

Warmth strip variant (first vital): 7 flex bars `height:6px; border-radius:3px; gap:4px`, one per domain in canonical order (Building · Career · Growth · Life Admin · Body & Mind · Finance · Relationship), each `background:` its domain token with `opacity` = warmth (hot ≈ .9 → cold ≈ .2).

### 4.3 Mission task

Anatomy: dot toggle → title → chips, then `why` line, then `done_when` line. Domain color arrives via `--dc` set inline on the task.

```html
<div class="mtask" style="--dc:var(--d-build)">
  <div class="t"><span class="dot"></span>Send invoice + handoff doc to NorthStar
    <span class="chip dom">Building Things</span><span class="chip p3">High</span></div>
  <div class="why">Closes Milestone 2 — unblocks final payment.</div>
  <div class="dw"><b>Done when</b>Invoice emailed and repo access transferred.</div>
</div>
```

```css
.mtask{position:relative;border-radius:14px;padding:13px 15px 13px 18px;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);transition:.2s}
.mtask:hover{background:rgba(255,255,255,.07);transform:translateY(-1px)}
.mtask::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:2px;background:var(--dc)}
.dot{width:18px;height:18px;border-radius:50%;border:2px solid var(--dc);cursor:pointer;transition:.2s}
.dot:hover{background:var(--dc);box-shadow:0 0 12px var(--dc)}   /* glow = pre-complete affordance */
.why{font-size:12.5px;color:var(--dim);margin:5px 0 0 26px}
.dw{font-size:12.5px;margin:3px 0 0 26px;color:var(--txt)}
.dw b{color:var(--faint);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-right:5px}
```

Chips (`999px`, `10.5px/600`): `.dom` = `background:color-mix(in srgb,var(--dc) 18%,transparent); color:var(--dc)` · `.p3` High = `rgba(248,113,113,.15)/#fca5a5` · `.p2` Med = `rgba(251,191,36,.14)/#fcd34d` · `.rescue` = `rgba(45,212,191,.15)/#5eead4` + `border:1px dashed rgba(94,234,212,.4)`, text `❄ coldest-domain rescue`. Why + done_when are always visible — never behind a hover or expander.

### 4.4 Attention row

```html
<div class="arow"><span class="ico i-mail">✉️</span>
  <span class="m">Meera (NorthStar) asked for a revised quote
    <small>waiting 26h · email-triage flagged as client / money</small></span>
  <button class="act">Draft ready →</button></div>
```

Row: `flex; gap:10px; padding:10px 12px; border-radius:12px; background:rgba(255,255,255,.035); font-size:13.5px`. Icon well `28×28, radius 9px`, tinted by source: mail `rgba(56,189,248,.15)` · bill `rgba(251,191,36,.15)` · agent-failure `rgba(248,113,113,.15)` · job `rgba(167,139,250,.16)`. `small` sub-line names *which agent flagged it and why*. Action button: `11.5px/600; color:#a5b4fc; background:rgba(165,180,252,.12); border:1px solid rgba(165,180,252,.25); radius 999px; padding:4px 10px`.

### 4.5 Calendar slot, event chip, gap hint

```html
<div class="slot"><time>10:00</time><div class="blk b-call">Client call — NorthStar handoff</div></div>
<div class="gap">90-min gap — fits the Module 4 quiz (~45 min)</div>
```

Slot: flex, `time` = 52px column, `--faint`, 12.5px tabular; divider `border-bottom:1px solid rgba(255,255,255,.05)` (none on last). Event chip = GCal-style tinted fill + matching light text, **no accent bar**: call `rgba(56,189,248,.13)/#bae6fd` · deep-work `rgba(245,158,11,.11)/#fde68a` · gym/run `rgba(45,212,191,.12)/#99f6e4`; `padding:6px 10px; radius 9px; weight 500`. Gap hint: italic, 12px, `--faint`, indented `padding-left:64px`, and always *suggests a fitting task* — a gap is an opportunity, not whitespace.

### 4.6 Habit row

```html
<div class="hrow" style="--hc:var(--d-growth)">
  <span class="n">Course study block<small>45 min minimum</small></span>
  <span class="week"><i class="hit"></i><i class="hit"></i><i class="hit"></i><i></i><i class="hit"></i><i class="hit"></i><i class="today"></i></span>
  <span class="streak hot">🔥 6d</span>
</div>
```

Grid `1fr auto auto; gap:12px`. Week = 7 squares `11×11, radius 4px, gap 4px`: miss = `rgba(255,255,255,.08)` · `.hit` = `var(--hc)` (the habit's domain color — habits feed domain warmth) · `.today` = transparent with `1px dashed var(--hc)`, clickable; click swaps `today→hit`. Streak column 52px right-aligned tabular: `.hot` = `#fcd34d` with 🔥 · `.broken` = `#fca5a5` with ✕ (e.g. `✕ 9d`) · neutral fraction (`3/7`) = `--dim`. Sub-line ties habit to its domain when relevant ("heats Body & Mind").

### 4.7 Fleet LED

```css
.led{width:8px;height:8px;border-radius:50%}
.led.ok{background:var(--good);box-shadow:0 0 8px var(--good)}
.led.bad{background:var(--bad);box-shadow:0 0 8px var(--bad);animation:blink 1.2s infinite}
.led.idle{background:var(--faint)}          /* no glow */
@keyframes blink{50%{opacity:.35}}
```

Only failures animate. Mini pill (Home strip): LED + `agent-name last-run` in a `999px` pill, `rgba(255,255,255,.04)` fill, 12.5px `--dim`.

### 4.8 Agent table row + infra badge

Grid `14px 1.4fr 1fr 1fr 1.6fr; gap:12px; padding:12px 6px`, hairline dividers. Columns: LED · name (600) + one-line purpose sub · infra badge · last run (tabular, `--dim`) · log-tail note (12.5px `--dim`; error notes `#fca5a5`).

Infra badges (`10.5px/600, letter-spacing:.05em, 999px, padding:3px 9px`):
`GH ACTIONS` = `rgba(167,139,250,.15)/#c4b5fd` · `THIS PC` = `rgba(251,191,36,.13)/#fcd34d` · `VPS` = `rgba(74,222,128,.13)/#86efac`. Badge text includes cadence when scheduled (`GH ACTIONS · nightly`).

Supervisor report card: a `.card` with `border-color:rgba(167,139,250,.35); background:rgba(167,139,250,.06)`; prose 13.5px/1.55; metrics inline as `#c4b5fd` 600.

### 4.9 Money widgets

- **Big metric**: `.big` 38/800 tabular + one-line delta sub (`.up`/`.dn`, 13px). Count-up on load.
- **Sparkline** (canvas, ~110px tall): faint gridlines `rgba(255,255,255,.06)`, 2.5px round-joined line in `--good`, area fill = vertical gradient `rgba(74,222,128,.35)→transparent`, endpoint dot r=4 solid `--good`. Emphasize the endpoint, always.
- **Donut** (canvas 120×120): stroked arcs r=48, `lineWidth:16`, gap `.04rad` between segments; slice colors `#38bdf8 #a78bfa #f59e0b #4ade80 #64748b`; legend = 9×9 radius-3 swatches + 12px `--dim` labels.
- **Bar meter**: track `height:10px; radius 5px; rgba(255,255,255,.07)`; fill gradients — income/positive `linear-gradient(90deg,#4ade80,#22d3ee)`, spend/pressure `linear-gradient(90deg,#fbbf24,#f87171)`, growth-course `(90deg,#a78bfa,#38bdf8)`, body-course `(90deg,#2dd4bf,#4ade80)`.
- **Bills row**: `.row` flex space-between, hairline dividers, name + `small` provenance sub (`--faint`, e.g. "auto-detected from Gmail"), right-aligned tabular value + due sub (`.dn` when ≤ 7 days, `--dim` otherwise, `--faint` + ✓ when paid).

### 4.10 Kanban column + job card

Pipeline: `grid-template-columns:repeat(4,1fr); gap:10px` (→ 2 cols ≤840px). Column: `rgba(255,255,255,.03)` fill, `rgba(255,255,255,.06)` border, radius 14px, `padding:12px`; header 11px uppercase `.1em` `--faint` with right-aligned count. Job card: `rgba(255,255,255,.05)`, radius 10px, `padding:9px 11px`, 13px title + 11.5px `--dim` sub (source/match %, age, next step). Urgent card `.hot`: `border:1px solid rgba(56,189,248,.4)` + ⚡ in sub. Closed/rejected: `opacity:.55`. Course block: title+% row (14/600), bar meter, then next-lesson line 12.5px `--dim` with the pointer in `#a5b4fc` 600.

## 5. Layout & IA

```
<canvas aurora (fixed, z0)>
<div .shell (1180px, z1)>
  header            greeting (H1 shine) + date/mission-note | seg control (Morning/Midday/Evening)
  .vitals           auto-fit grid ≥150px: Warmth · Net worth · Burn/income · Pipeline · Streak
  nav.tabs          Home · Money · Career · Agents · Domains · Pulse   (centered pill)
  section.tab       one per tab
  footer            12px --faint, centered
```

- Home body: `grid-template-columns:1.5fr 1fr; gap:14px` → 1 column ≤840px. Left stack: Today's Mission, Needs You. Right stack: Today (calendar), Habits, Fleet mini-strip. Evening prepends full-width Day Review.
- Money: `1.2fr 1fr` top row (Net worth · Burn), then `1fr 1fr` (Portfolio · Bills radar); both → 1 col ≤840px.
- Career: full-width pipeline card, then Courses card.
- Agents: fleet table card, then supervisor report card.
- Domains and Pulse embed the already-shipped warmth map and trends views unchanged.
- Six tabs, no more; new surfaces earn a tab only by demoting nothing.

## 6. Time-of-day system

One page, three emphases. The seg control (and, in product, the clock) sets a body class: none = morning, `mid`, `pm`.

| | Morning | Midday (`body.mid`) | Evening (`body.pm`) |
|---|---|---|---|
| Greeting | "Good morning, Deepak" | "Back at it, Deepak" | "Winding down, Deepak" |
| Mission note (subtitle) | "Win these 3 and today counts" | appends "— midday check: 1 done, deep-work block starts in 40 min." | appends "— 2 of 3 done. One rescue left before the day closes." |
| Aurora palette | `#312e81 #155e75 #4c1d95 #134e4a` (indigo/teal night) | `#1e3a8a #0e7490 #3730a3 #065f46` (bluer, cooler) | `#4c1d95 #831843 #312e81 #7c2d12` (violet/magenta/ember dusk) |
| Day Review card | hidden | hidden | shown, first on Home (`body.pm .review{display:block}`) |

Mission-note append pattern: CSS `::after` content keyed off the body class. Day Review = purple-tinted card (`border rgba(167,139,250,.35)`, `bg rgba(167,139,250,.07)`) with a flex row of stat pairs (19px value / 13.5px label): mission done, tasks completed, domains warmed, debts owed, tomorrow's seed. Layout otherwise never moves between modes.

## 7. Motion & a11y

| Animation | Spec | Purpose |
|---|---|---|
| Aurora drift | 4 radial-gradient blobs (r 280–380) on fixed canvas, rAF, `tick+=.004`, pos `±.05×viewport` sin/cos, color-stop `blob+'cc'→transparent`, canvas `opacity:.55` | living ground |
| Cursor spotlight | 420px radial `rgba(255,255,255,.08)` follows mouse via `--mx/--my` | glass catches light |
| Greeting shine | `background:linear-gradient(100deg,#fff 20%,#a5b4fc 50%,#fff 80%); background-size:200% 100%;` clipped to text; `background-position` 0→−200% over 6s linear infinite | signature flourish, greeting only |
| Count-up | numbers ease `1-(1-p)^3` over 900ms on load | vitals feel live |
| Tab fade | `.3s ease`, opacity + 6px rise | continuity between tabs |
| Hover lifts | `.2s`; mission task −1px translateY + fill brighten; dot fills + glows | affordance |
| LED blink | failures only, `1.2s`, 50%→opacity .35 | draw the eye to what's broken |

Reduced-motion contract — non-negotiable:

```css
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
```

plus the aurora rAF loop checks `matchMedia('(prefers-reduced-motion: reduce)')` and stops scheduling frames. A11y floor: every interactive element is a real `<button>`/`<a>`/`<input>` with visible focus (`outline` or brightened fill); seg/tab groups carry `role="tablist"`/`aria-label`; icon wells are decorative (text carries meaning); contrast — `--txt` and `--dim` on `--bg` pass AA, `--faint` is for non-essential labels only, never body copy.

## 8. Do / Don't

| DO | DON'T |
|---|---|
| Bleed domain color through frost: low-alpha tints, thin 3px stripes, glows via `box-shadow: 0 0 Npx var(--dc)` | Paint opaque domain-color fills or solid colored buttons |
| Build every surface as `--panel` + `--panel-brd` hairline + backdrop blur over the aurora | Use flat `#`-hex card backgrounds, drop shadows for depth, or visible 1px+ solid borders in color |
| Keep why + done_when visible on every mission task | Hide task context behind hover, tooltip, or expander |
| Show provenance on machine-produced rows ("email-triage flagged…", "auto-detected from Gmail") | Present agent output as anonymous facts |
| Reserve animation for meaning: failures blink, numbers count up once, greeting shines | Animate decoration — no pulsing cards, no looping icons, nothing else moves |
| Use `tabular-nums` wherever digits align; right-align money | Let proportional digits wiggle columns |
| Encode state in form + color (LED, chip, dashed rescue border) so it reads colorblind | Rely on hue alone to signal ok/fail |
| Tint calendar chips GCal-style (fill + matching light text) | Add accent side-bars to chips/cards — the mockup deliberately has none except the 3px mission stripe |
| Suggest a use for every calendar gap | Render empty time as blank space |
| Keep the 7-domain order fixed everywhere: Building · Career · Growth · Life Admin · Body & Mind · Finance · Relationship | Re-sort domains per view |
| Let cold domains look cold (low warmth opacity, ❄ rescue chip) — the design tells on imbalance | Dress every domain equally "healthy" |

---

*End of contract. Change process: edit this file + the change itself in one PR, with the one-line reason.*
