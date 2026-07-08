// Self-check for the proxy's security guards (the branches that reject BEFORE
// any upstream fetch — no network needed). Run: node cors-proxy/worker.test.mjs
import assert from 'node:assert'
import worker from './worker.js'

const GOOD = 'https://deepak-lakshmipathi.github.io'
const call = (url, opts = {}) => worker.fetch(new Request(url, opts))
const base = 'https://proxy.example'

// preflight: bad origin rejected, good origin gets CORS
assert.equal(
  (await call(`${base}/github.com/o/r.git/info/refs`, { method: 'OPTIONS', headers: { Origin: 'https://evil.com' } })).status,
  403, 'preflight bad origin -> 403')
{
  const res = await call(`${base}/github.com/o/r.git/info/refs`, { method: 'OPTIONS', headers: { Origin: GOOD } })
  assert.equal(res.status, 204, 'preflight good origin -> 204')
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), GOOD, 'preflight echoes origin')
}

// real request: bad origin, bad host, bad path all rejected before upstream
assert.equal(
  (await call(`${base}/github.com/o/r.git/info/refs`, { headers: { Origin: 'https://evil.com' } })).status,
  403, 'GET bad origin -> 403')
assert.equal(
  (await call(`${base}/gitlab.com/o/r.git/info/refs`, { headers: { Origin: GOOD } })).status,
  403, 'GET non-github host -> 403')
assert.equal(
  (await call(`${base}/github.com/o/r.git/secrets`, { headers: { Origin: GOOD } })).status,
  403, 'GET non-git path -> 403')

console.log('ok — all proxy guard checks passed')
