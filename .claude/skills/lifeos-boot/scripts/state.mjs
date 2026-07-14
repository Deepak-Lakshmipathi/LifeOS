#!/usr/bin/env node
// LifeOS boot: derive project state from kanban.html #board-data + git + gh.
// Read-only. Prints one JSON object.
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const sh = (cmd) => {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
};

// --- board ---
const html = fs.readFileSync('kanban.html', 'utf8');
const i = html.lastIndexOf('<script id="board-data"');
const board = JSON.parse(html.slice(html.indexOf('>', i) + 1, html.indexOf('</script>', i)));
const cards = board.cards;
const byId = new Map(cards.map(c => [c.id, c]));
const doneIds = new Set(cards.filter(c => c.column === 'done').map(c => c.id));

const counts = {};
for (const col of board.columns) counts[col.id] = cards.filter(c => c.column === col.id).length;

const inProgress = cards.filter(c => c.column === 'progress')
  .map(c => ({ id: c.id, title: c.title, issue: c.issue, pr: c.pr }));

const waveOf = (c) => {
  const m = /Wave (\d+)/.exec(c.notes || '');
  return m ? +m[1] : 99;
};
const ticketOf = (c) => {
  const m = /ticket: (\S+\.md)/.exec(c.notes || '');
  return m ? m[1] : null;
};

const unblocked = cards
  .filter(c => (c.column === 'backlog' || c.column === 'ready'))
  .filter(c => (c.blockedBy || []).every(b => doneIds.has(b)))
  .sort((a, b) => waveOf(a) - waveOf(b))
  .map(c => ({ id: c.id, title: c.title, wave: waveOf(c), ticket: ticketOf(c), column: c.column }));

// hotspot conflict flags among currently-unblocked cards (from docs/slices/README chains)
const CHAINS = {
  'App.tsx': ['s24'],
  'HomeView.tsx': ['s27', 's28', 's29', 's32', 's34', 's37', 's48', 's50'],
  'VitalsRow.tsx': ['s26', 's41', 's45'],
  'AgentsView.tsx': ['s49', 's53', 's54'],
};
const unblockedIds = new Set(unblocked.map(u => u.id));
const hotspotConflicts = Object.entries(CHAINS)
  .map(([file, chain]) => ({ file, unblocked: chain.filter(id => unblockedIds.has(id)) }))
  .filter(x => x.unblocked.length > 1);

// --- git / gh (tolerant: nulls when offline) ---
const dirty = (sh('git status --porcelain') || '').split('\n').filter(Boolean);
const branch = sh('git branch --show-current');
const behind = sh('git rev-list --count HEAD..origin/master 2>nul') || sh('git rev-list --count HEAD..origin/master');
const prsRaw = sh('gh pr list --state open --json number,title,headRefName,statusCheckRollup --limit 20');
let openPRs = null;
if (prsRaw) {
  try {
    openPRs = JSON.parse(prsRaw).map(p => ({
      number: p.number, title: p.title, branch: p.headRefName,
      ci: (p.statusCheckRollup || []).some(s => (s.conclusion || s.state) === 'FAILURE') ? 'red'
        : (p.statusCheckRollup || []).every(s => ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(s.conclusion || s.state)) ? 'green' : 'pending',
    }));
  } catch { openPRs = null; }
}
const issuesRaw = sh('gh issue list --state open --json number,title,labels --limit 30');
let openIssues = null;
if (issuesRaw) {
  try { openIssues = JSON.parse(issuesRaw).map(x => ({ number: x.number, title: x.title, labels: x.labels.map(l => l.name) })); }
  catch { openIssues = null; }
}

console.log(JSON.stringify({
  meta: { updated: board.meta.updated, note: board.meta.note },
  board: counts,
  inProgress,
  unblocked: unblocked.slice(0, 8),
  unblockedTotal: unblocked.length,
  hotspotConflicts,
  git: { branch, dirtyFiles: dirty.length, dirty: dirty.slice(0, 10), behindOriginMaster: behind === null ? null : +behind },
  github: { openPRs, openIssues },
}, null, 2));
