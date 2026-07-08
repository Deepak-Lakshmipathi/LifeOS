/**
 * LifeOS git CORS proxy — Cloudflare Worker.
 *
 * Replaces the public cors.isomorphic-git.org so the vault PAT + git traffic
 * transit only YOUR infra. Locked down two ways so it is not an open relay:
 *   1. Origin allowlist — only the LifeOS PWA origins get CORS access.
 *   2. Host + path allowlist — only github.com git smart-HTTP endpoints.
 *
 * URL shape (isomorphic-git corsProxy convention):
 *   <worker>/github.com/<owner>/<repo>.git/info/refs?service=git-upload-pack
 *   <worker>/github.com/<owner>/<repo>.git/git-upload-pack
 *   <worker>/github.com/<owner>/<repo>.git/git-receive-pack
 *
 * isomorphic-git renames the request's `authorization` header to
 * `x-authorization` when a corsProxy is set; we map it back here.
 */

const ALLOWED_ORIGINS = new Set([
  'https://deepak-lakshmipathi.github.io', // GitHub Pages (prod)
  'http://localhost:5173', // vite dev
  'http://localhost:4173', // vite preview
])

const ALLOWED_HOSTS = new Set(['github.com'])

// Git smart-HTTP endpoints only — blocks arbitrary SSRF through the proxy.
const OK_PATH = /(?:\/info\/refs|\/git-upload-pack|\/git-receive-pack)$/

// Request headers forwarded upstream (x-authorization is mapped to authorization).
const FWD_REQ = [
  'accept-encoding', 'accept-language', 'accept', 'content-type',
  'content-length', 'git-protocol', 'pragma', 'range', 'user-agent',
]

// Response headers the browser git client is allowed to read.
const EXPOSE = [
  'accept-ranges', 'content-encoding', 'content-length',
  'content-range', 'content-type',
]

function corsHeaders(origin) {
  const h = new Headers()
  h.set('Access-Control-Allow-Origin', origin)
  h.set('Vary', 'Origin')
  return h
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || ''
    const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : null

    // Preflight
    if (request.method === 'OPTIONS') {
      if (!allowOrigin) return new Response(null, { status: 403 })
      const h = corsHeaders(allowOrigin)
      h.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
      h.set(
        'Access-Control-Allow-Headers',
        request.headers.get('Access-Control-Request-Headers') || '*',
      )
      h.set('Access-Control-Max-Age', '86400')
      return new Response(null, { status: 204, headers: h })
    }

    if (!allowOrigin) return new Response('Forbidden origin', { status: 403 })

    const url = new URL(request.url)
    const rest = url.pathname.replace(/^\/+/, '') // github.com/owner/repo.git/...
    const targetHost = rest.split('/')[0]
    if (!ALLOWED_HOSTS.has(targetHost)) {
      return new Response('Forbidden host', { status: 403 })
    }
    if (!OK_PATH.test(url.pathname)) {
      return new Response('Forbidden path', { status: 403 })
    }

    const target = 'https://' + rest + url.search

    const headers = new Headers()
    for (const name of FWD_REQ) {
      const v = request.headers.get(name)
      if (v) headers.set(name, v)
    }
    // isomorphic-git ships the PAT as x-authorization when proxied; some paths
    // send plain authorization. Forward whichever is present.
    const auth = request.headers.get('x-authorization') || request.headers.get('authorization')
    if (auth) headers.set('authorization', auth)

    // ponytail: buffer the whole request body — git packs for a personal task
    // vault are small; switch to a streamed body (duplex:'half') only if you
    // ever push very large blobs through here.
    const body = request.method === 'POST' ? await request.arrayBuffer() : undefined

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: 'follow',
    })

    const out = new Headers(upstream.headers)
    out.set('Access-Control-Allow-Origin', allowOrigin)
    out.set('Access-Control-Expose-Headers', EXPOSE.join(','))
    out.set('Vary', 'Origin')
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: out,
    })
  },
}
