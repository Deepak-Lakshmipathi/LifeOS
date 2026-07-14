# S46 — job-scout agent (GH Actions → Career/pipeline.md Found entries) [AGENT]

Phase 7 · Wave 4 · Deps: S43 (contract) · Blocks: —

## Context
GH Actions cron agent scanning job boards via API/RSS (start: RemoteOK API +
HN whoishiring RSS — both keyless; escalate to browser-session boards from the
PC later, out of scope). Scores matches against a committed profile file,
APPENDS `stage:: found` entries to `Career/pipeline.md` — never touches
owner-managed lines. Dedup by company+role.

## Write-set (new dir)
- NEW `agents/job-scout/scout.mjs` — fetch sources → normalize {company, role,
  url, tags} → score vs `agents/job-scout/profile.md` (keyword/weight list,
  owner-editable) → entries ≥ threshold appended as
  `- <company> — <role> (stage:: found) (match:: NN%) (source:: job-scout) (url:: …)`;
  dedup against existing pipeline lines (case-insensitive company+role);
  commit/push own PAT `AGENT_VAULT_PAT_CAREER`.
- NEW `agents/job-scout/profile.md` — seed keywords (React/TS/AI, remote,
  senior) + weights.
- NEW `agents/job-scout/scout.test.mjs` — fixture board JSON/RSS → expected
  appended lines (roundtrip via `src/vault/career.ts` parser); dedup test
  (existing file already contains one of the finds → not re-appended).
- NEW `.github/workflows/agent-job-scout.yml` — cron nightly + dispatch.
- NEW `agents/job-scout/README.md`.

## Subtasks
1. Source fetchers (mockable). 2. Scorer (pure, tested). 3. Append-with-dedup
(read existing file first; append only). 4. Workflow + README. 5. Tests.

## Definition of Done
1. Fixture sources → appended lines parse via S43 parser with stage found, match %, source job-scout (tested).
2. Dedup: a find already present (any stage) is skipped (tested) — owner's applied/interview lines NEVER modified or reordered (byte-assert untouched region).
3. Scorer pure + threshold configurable in profile.md.
4. Workflow valid; no secrets beyond the vault PAT.
5. Tests green; no live fetches in tests.

## Tests
Fixture → append; dedup; owner-lines untouched.

## Design refs
None. Provenance via source:: (§8 downstream).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Fully parallel-safe (own dir).
