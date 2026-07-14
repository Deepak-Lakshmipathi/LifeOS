# S38 — email-triage agent (GH Actions → Mail/attention.md + drafts) [AGENT]

Phase 5 · Wave 4 · Deps: S36 (contract) · Blocks: —

## Context
GH Actions cron agent: reads recent unread/starred Gmail via API, classifies
each thread with Claude (`claude-sonnet-5` structured output — same pattern as
`services/bot/nlu.ts`), writes `Mail/attention.md` (S36 contract) and draft
replies to `Mail/drafts/*.md` for items worth a canned response. Owns `Mail/**`
only. Tests: fixture emails in → classification prompt mocked → exact files out.

## Write-set (new dir)
- NEW `agents/email-triage/triage.mjs` — Gmail API (refresh-token OAuth, scope
  `gmail.readonly`) → thread summaries → Claude classify {label, urgent,
  needsDraft, draftBody?} (structured output, temperature 0) → render S36
  lines sorted urgent-first → write attention + drafts → commit/push (own PAT
  `AGENT_VAULT_PAT_MAIL`).
- NEW `agents/email-triage/triage.test.mjs` — fixture thread JSON + mocked
  Claude responses → assert attention.md roundtrips through `src/vault/mail.ts`
  parser; draft file naming `Mail/drafts/<date>-<slug>.md`.
- NEW `.github/workflows/agent-email-triage.yml` — cron hourly + dispatch.
- NEW `agents/email-triage/README.md` — secrets (GMAIL_*, ANTHROPIC_API_KEY,
  AGENT_VAULT_PAT_MAIL), scopes, prompt-change policy (supervisor proposals
  later, S55).

## Subtasks
1. Classifier call (mockable seam). 2. Renderer → contract lines. 3. Draft
writer. 4. Workflow + README. 5. Tests.

## Definition of Done
1. Fixture → attention.md that S36 `parseAttention` reads back losslessly (labels, waiting, draft pointers) — tested through the real parser.
2. Claude call isolated behind a mockable function; tests never hit network.
3. Writes ONLY under `Mail/`; commit author `lifeos-email-triage`.
4. Draft files created only when classifier says needsDraft; body non-empty.
5. Workflow YAML valid; secrets referenced, never inlined.
6. Tests green.

## Tests
Mocked classify → files; parser roundtrip.

## Design refs
None. Label vocabulary = S36 contract.

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Fully parallel-safe (own dir).
