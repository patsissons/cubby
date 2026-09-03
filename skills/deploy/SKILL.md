---
name: deploy
description: Launch or operate your own cubby system on PocketHost. Use when setting up a new cubby deployment, configuring OAuth providers or AI keys, wiring deploy credentials and GitHub secrets, adding a custom domain, or troubleshooting deploys of a cubby repo.
---

# Launching your own cubby

**Fork cubby to develop and improve the foundation; create your own repo
from the template to launch your own micro-sites.** Contributions flow to
cubby; your apps live in your deployment repo. This skill is the deployment
path; the repo mechanics are in docs/forking.md.

## 1. Repos and instance

1. Create your deployment repo: the init skill
   (skills/init/SKILL.md) creates it, clones the platform repo with
   shared history, wires upstream/origin remotes, and pushes. (GitHub's
   "Use this template" button also works but yields unrelated history; see
   that skill for the tradeoff.)
2. Create a PocketHost instance at pockethost.io (any paid plan includes
   SFTP deploys and custom domains). Note the instance name and URL.
3. Verify `cubby.config.json` (the only platform file a deployment edits;
   everything else a deployment adds is app-owned: `pb_public/<name>/`, app
   migrations, `pb_hooks/apps/<name>/` hooks).
   The init skill normally fills it already; correct anything stale:
   - `name`, `title`: yours
   - `instanceUrl`: `https://<instance>.pockethost.io`
   - `domain`: your custom domain if any, else same as instanceUrl
   - `oauthProviders`: the providers you will actually configure
   - `ai.models`: keep or trim; aliases are what apps reference

   After edits: `npm run build`, commit, push.

## 2. First deploy

Local (fastest):

```
npm ci && npm run build
npx phio login          # PocketHost account email + password; registers a deploy key
npx phio link <instance>
npm run deploy          # syncs pb_public, pb_hooks, pb_migrations over SFTP
```

Then power the instance off and on in the PocketHost dashboard: the first
deploy needs a restart before PocketBase applies migrations and loads hooks.
Verify:

- `https://<instance>.pockethost.io/` shows the discovery site
- `/hello/` loads
- `/_cubby/cron/sweep` returns `{"ok":true,...}` (hooks live)
- `/api/collections/hello_guestbook/records` returns items (migrations ran)

CI deploys: add repo secrets `PHIO_USERNAME` (account email), `PHIO_PASSWORD`,
and `PHIO_INSTANCE_NAME`, and the bundled `.github/workflows/deploy.yml`
starts deploying on every push to main. Without those secrets it only
verifies the build.

## 3. AI provider keys

PocketHost dashboard > your instance > Secrets tab. Add any of
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, then power-cycle
the instance (secrets are injected at process start). Missing providers
return a clean `provider_unconfigured` error to apps. Check current model
ids in `cubby.config.json` against provider docs occasionally; they age.

## 4. OAuth providers

Register redirect URI `https://<HOST>/api/oauth2-redirect` with each
provider (use the custom domain if you have one; add the instance-URL
variant too while testing):

- Google: console.cloud.google.com > Credentials > OAuth client ID (Web)
- GitHub: Settings > Developer settings > OAuth Apps > New

Enter each client id/secret in the PocketBase admin UI:
`https://<HOST>/_/` > users collection > Edit collection (gear) > Options >
OAuth2. Keep `oauthProviders` in `cubby.config.json` in sync so apps render
the right login buttons. Password auth stays disabled; the platform is
OAuth2-only by design.

For admin UI access on PocketHost, enable Admin Sync on the instance (uses
your PocketHost login) or create a superuser from the dashboard's terminal.

## 5. Rooms sweeper webhook (recommended)

PocketHost hibernates idle instances, which makes in-process cron
unreliable. Dashboard > your instance > Webhooks: add a GET request to
`/_cubby/cron/sweep` on `@minutely`. Harmless if skipped: stale presence
also clears whenever the instance is awake.

## 6. Custom domain (optional)

DNS: CNAME your host to `<instance>.pockethost.io`. An apex domain needs
CNAME flattening (Cloudflare does this free). Then PocketHost dashboard >
instance > Settings > add the domain; verification is automatic. Update
`domain` in `cubby.config.json` and add the new redirect URI to your OAuth
providers.

## 7. Issue-to-app pipeline (optional)

The bundled `.github/workflows/claude.yml` turns GitHub issues labeled
`new-app` into PRs and answers `@claude` mentions on issues/PRs. Enable it:

1. Install the Claude GitHub App on the repo (github.com/apps/claude).
2. Add secret `ANTHROPIC_API_KEY`, or `CLAUDE_CODE_OAUTH_TOKEN` from a
   Claude subscription (`claude setup-token`).

Without either secret the workflow does nothing. Merging the PR deploys via
deploy.yml: idea on your phone to live app with no laptop involved.

## Troubleshooting

- Hooks 404 or collections missing after a deploy: the running process
  predates the upload. Either power-cycle from the PocketHost dashboard's
  power button (confirm it actually goes down first), or close every open
  tab of the site (realtime SSE connections keep it awake) and let the
  instance hibernate; the next request boots the new code. The mothership
  API's power field does NOT stop a running container, and the documented
  pb_hooks auto-restart does not fire for SFTP-written files.
- `provider_unconfigured`: the named env var is missing in instance Secrets
  (or the instance was not restarted after adding it).
- OAuth popup errors: redirect URI mismatch; it must be exactly
  `https://<HOST>/api/oauth2-redirect` for the origin being used.
- Deleted files still live after deploy: phio deploys are additive
  (verified: its "removing folder" output does not actually delete). Remove
  remote files manually over SFTP (`ftp.pockethost.io:2222`, account email,
  registered SSH key, path `<instance>/...`), and verify by content since
  missing static paths fall back to the discovery site with HTTP 200.
- Stale `sites.json` after deploy: PocketHost's CDN caches pb_public
  briefly (up to 4 hours; use a `?v=x` query to check origin).
- Rate limits: 1000 req/hr/IP. Every joined room tab heartbeats ~180/hr.
