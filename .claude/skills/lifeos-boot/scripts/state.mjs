#!/usr/bin/env node
// LifeOS boot: derive project state from GitHub issues + labels + git.
// Read-only. Prints one JSON object.
//
// GitHub is the single source of truth (2026-08-05). kanban.html and the hub
// were deleted; there is no local board file and no wave concept any more.
//
// State model — an issue's LABELS are its state:
//   status:in-progress  work started (an agent or a PR is live on it)
//   status:ready        unblocked, startable now
//   status:blocked      waiting on another issue (see "Blocked by: #N" in the body)
//   cold-storage        parked on purpose; CLOSED, not abandoned — reopen to revive
//   needs-triage        filed, not yet ruled on
//   closed, no cold-storage label  =  done
import { execSync } from 'node:child_process';

const sh = (cmd) => {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
};

const json = (cmd) => {
  const raw = sh(cmd);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

// --- issues (source of truth) ---
const open = json('gh issue list --state open --json number,title,labels,body --limit 100') || [];
const closed = json('gh issue list --state closed --json number,title,labels,closedAt --limit 100') || [];

const labelsOf = (i) => (i.labels || []).map((l) => l.name);
const has = (i, name) => labelsOf(i).includes(name);

// "Blocked by: #178" / "Blocked by #178, #180" anywhere in the body.
const blockedByOf = (i) => {
  const out = new Set();
  for (const m of (i.body || '').matchAll(/blocked\s*by:?\s*((?:#\d+[,\s]*)+)/gi)) {
    for (const n of m[1].matchAll(/#(\d+)/g)) out.add(+n[1]);
  }
  return [...out];
};

const openNumbers = new Set(open.map((i) => i.number));
const coldNumbers = new Set(closed.filter((i) => has(i, 'cold-storage')).map((i) => i.number));

const enrich = (i) => {
  const blockedBy = blockedByOf(i);
  // A dependency still counts as blocking only while it is open. A cold-stored
  // blocker is a REAL block — flagged, because reviving the blocker is a decision.
  const openBlockers = blockedBy.filter((n) => openNumbers.has(n));
  const coldBlockers = blockedBy.filter((n) => coldNumbers.has(n));
  return {
    number: i.number,
    title: i.title,
    labels: labelsOf(i),
    blockedBy,
    openBlockers,
    coldBlockers,
  };
};

const all = open.map(enrich);
const inProgress = all.filter((i) => i.labels.includes('status:in-progress'));
const ready = all
  .filter((i) => !i.labels.includes('status:in-progress'))
  .filter((i) => i.openBlockers.length === 0 && i.coldBlockers.length === 0)
  .filter((i) => !i.labels.includes('needs-triage'));
const blocked = all.filter((i) => i.openBlockers.length > 0 || i.coldBlockers.length > 0);
const needsTriage = all.filter((i) => i.labels.includes('needs-triage'));

// Label hygiene: a label that contradicts the computed frontier is a bug in the
// board, so surface it rather than silently trusting either side.
const labelDrift = [
  ...ready.filter((i) => i.labels.includes('status:blocked'))
    .map((i) => ({ number: i.number, problem: 'labelled status:blocked but nothing open blocks it' })),
  ...blocked.filter((i) => i.labels.includes('status:ready'))
    .map((i) => ({ number: i.number, problem: `labelled status:ready but blocked by ${[...i.openBlockers, ...i.coldBlockers].map((n) => '#' + n).join(', ')}` })),
  ...all.filter((i) => !i.labels.some((l) => l.startsWith('status:')) && !i.labels.includes('needs-triage'))
    .map((i) => ({ number: i.number, problem: 'no status: label and not needs-triage' })),
];

// --- git / gh (tolerant: nulls when offline) ---
sh('git fetch origin --quiet'); // ahead/behind is a lie against a stale remote ref
const dirty = (sh('git status --porcelain') || '').split('\n').filter(Boolean);
const branch = sh('git branch --show-current');
// left = ahead, right = behind. The ahead count is why a handoff can claim
// "pushed" while a commit sits stranded — it was missing before 2026-08-05.
const counts = (sh('git rev-list --left-right --count HEAD...origin/master') || '').split(/\s+/);
const ahead = counts[0] === undefined ? null : +counts[0];
const behind = counts[1] === undefined ? null : +counts[1];

const prs = json('gh pr list --state open --json number,title,headRefName,statusCheckRollup --limit 20');
const openPRs = prs && prs.map((p) => ({
  number: p.number,
  title: p.title,
  branch: p.headRefName,
  ci: (p.statusCheckRollup || []).some((s) => (s.conclusion || s.state) === 'FAILURE') ? 'red'
    : (p.statusCheckRollup || []).every((s) => ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(s.conclusion || s.state)) ? 'green'
      : 'pending',
}));

console.log(JSON.stringify({
  source: 'github-issues',
  counts: {
    open: open.length,
    inProgress: inProgress.length,
    ready: ready.length,
    blocked: blocked.length,
    needsTriage: needsTriage.length,
    coldStorage: coldNumbers.size,
    done: closed.length - coldNumbers.size,
  },
  inProgress,
  ready,
  blocked,
  needsTriage,
  labelDrift,
  coldStorage: closed.filter((i) => has(i, 'cold-storage')).map((i) => ({ number: i.number, title: i.title })),
  git: {
    branch,
    dirtyFiles: dirty.length,
    dirty: dirty.slice(0, 10),
    aheadOfOrigin: ahead,
    behindOrigin: behind,
  },
  github: { openPRs },
}, null, 2));
