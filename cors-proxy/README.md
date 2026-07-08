# LifeOS git CORS proxy (Cloudflare Worker)

Self-hosted replacement for the public `cors.isomorphic-git.org`, so the vault
PAT and git traffic transit only your Cloudflare account. Locked to the LifeOS
PWA origins and to github.com git endpoints — not an open relay.

## Deploy (one-time)

You need a free Cloudflare account. From this directory:

```bash
cd cors-proxy
npx wrangler login        # opens a browser to authorize your Cloudflare account
npx wrangler deploy       # publishes the Worker
```

`deploy` prints the URL, e.g. `https://lifeos-git-proxy.<your-subdomain>.workers.dev`.

## Point the app at it

**Hosted (Pages):** set a repo variable so the build picks it up — no secret,
so a plain variable (not a secret) is fine:

```bash
gh variable set VAULT_CORS_PROXY \
  --body "https://lifeos-git-proxy.<your-subdomain>.workers.dev"
# then redeploy:
gh workflow run deploy-pages.yml
```

**Local dev:** put the same URL in `.env`:

```
VITE_VAULT_CORS_PROXY=https://lifeos-git-proxy.<your-subdomain>.workers.dev
```

## Verify

```bash
node worker.test.mjs   # guard checks (origin/host/path allowlists)
```

After deploy, load the PWA and add/complete a task — the commit should push
through your Worker (check the Worker's request log in the Cloudflare dashboard).

## Notes

- Add more origins (e.g. a custom domain) to `ALLOWED_ORIGINS` in `worker.js`.
- The Worker forwards `x-authorization` → `authorization` (isomorphic-git
  renames the PAT header when a corsProxy is set).
