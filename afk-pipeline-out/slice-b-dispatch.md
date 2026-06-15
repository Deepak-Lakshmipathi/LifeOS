# Dispatch — Issue #3 (Slice B: PWA shell — installable + offline)

Model: Sonnet. Batch-2 — BLOCKED BY #2, dispatch only after #2's PR is
merged. Pair with a CI Build Supervisor. Includes a HITL device checklist
(human-only). Agent prompt below is self-contained — paste as-is.

---

You are implementing GitHub issue #3 on Deepak-Lakshmipathi/LifeOS. Work
autonomously, open a PR, do not merge.

# Precondition (hard)
This slice is BLOCKED BY #2. Start only after #2's PR is merged. Branch
off the merged base (the branch containing the Slice A task loop), not off
an empty repo. If #2 is not merged yet, stop and report.

# Task
Turn the working Slice A task-loop app into an installable PWA that runs
fully offline on Windows and Android. Code only — do not change task-loop
logic.

# Context (decided — do not re-litigate)
Read CONTEXT.md and docs/adr/0001-pwa-over-native.md. Stack is Vite +
React + TS (already scaffolded by #2). This slice adds the PWA shell on
top.

# Build
1. Add `vite-plugin-pwa`; configure it in vite.config.ts.
2. Web app manifest: name "LifeOS", short_name "LifeOS", start_url "/",
   display "standalone", theme + background colors matching the app,
   icons 192px + 512px + a maskable icon.
3. Service worker via the plugin (Workbox): precache the app shell so a
   cold start works with no network.
4. Provide the icon assets under public/icons/.
5. Wire manifest + theme-color tags into index.html.

# Write-set (only these)
vite.config.ts (PWA plugin config block only — do NOT alter Slice A's
build/test config), public/manifest.webmanifest, public/icons/**,
index.html (manifest/theme tags), test files.

Note: vite.config.ts is shared with #2 — that is why this slice runs
AFTER #2 (serialized to avoid conflict). Touch only the PWA additions.

# Do NOT touch
src/** task-loop logic, the SyncProvider seam, the Task entity. No real
sync / backend, no push notifications, no background sync.

# Acceptance criteria
- TEST: `npm run build` emits a service worker file and a web app
  manifest into dist/ (assert both exist).
- TEST: manifest has name, start_url, display "standalone", and both
  192px and 512px icons.
- `npm run build` succeeds, zero type errors, Slice A's tests still pass.
- HITL (human, cannot run in CI — flag in PR, do not self-close on it):
    * App installs to home screen on Android (Chrome) AND to desktop on
      Windows (Edge/Chrome).
    * With network disabled, a cold start loads the app and existing
      tasks are readable.
  Document these as a manual checklist in the PR body for the user to run
  on their real phone + laptop.

# Done
Open a PR titled "Slice B — PWA shell: installable + offline" against the
base, body "Closes #3" plus the manual install/offline checklist. Do not
merge — CI green + human runs the device checklist + reviews. Report the
PR URL.
