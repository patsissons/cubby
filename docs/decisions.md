# Decisions

Choices made while scaffolding, with the reasoning. Newest last.

## API naming: cubby.ai and cubby.rooms (spec override)

The original spec defined a `new cubby.AI()` class and a `cubby.socket`
namespace. Both were renamed for consistency with `cubby.db`, `cubby.fs`, and
`cubby.identity`: all AI access is `cubby.ai.chat(...)` and all rooms access
is `cubby.rooms.room(...)`. The spec's note to "keep the name socket" was
explicitly overridden by the operator. The transport is still PocketBase
realtime over SSE; see architecture.md for latency expectations.

## Rooms sweeper: cronAdd plus a webhook endpoint

PocketHost documents `cronAdd` as unreliable on their platform because idle
instances hibernate and missed ticks are not replayed. The sweep therefore
runs two ways, sharing one implementation (pb_hooks/lib/sweep.js):

1. `cronAdd` every minute: always works locally, and works on PocketHost
   while the instance is awake. A hibernating instance has no connected room
   clients, so missed sweeps are harmless.
2. `GET /_cubby/cron/sweep`: idempotent, cheap, unauthenticated, so a
   PocketHost dashboard webhook (e.g. @minutely) can drive it.

## Model registry IDs (verified 2026-08-16)

Aliases map to the current GA model per provider tier:

- gemini-flash -> gemini-3.7-flash (newest GA flash)
- gemini-pro -> gemini-2.5-pro (newest GA pro; gemini-3.1-pro is preview-only)
- claude-haiku -> claude-haiku-4-5 (dateless Anthropic IDs are pinned snapshots)
- claude-sonnet -> claude-sonnet-5
- gpt-mini -> gpt-5.6-luna (OpenAI dropped the "-mini" naming; Luna is the
  cost tier, Sol the flagship)
- gpt -> gpt-5.6-sol

Provider surfaces: Anthropic /v1/messages; OpenAI /v1/responses (the current
recommended API; chat completions compatibility with gpt-5.6 models was not
verified); Gemini generateContent (labeled legacy in favor of the Interactions
API but stable, simpler, and sufficient for non-streaming chat).

## No streaming in v1

The PocketHost JSVM ($http.send) buffers whole responses; SSE passthrough is
impossible in a hook. If streaming is ever wanted, it requires an external
proxy (for example a Cloudflare Worker) that holds the provider keys and
validates PB auth tokens. Out of scope for v1.

## fs cross-app reads use an { app } option, not path prefixes

The spec sketched `cubby.fs.read('otherapp/data.json')` for cross-app reads,
but that shape is ambiguous: `notes/note.txt` is a same-app path with the
same syntax. Cross-app reads are explicit instead:
`cubby.fs.read('data.json', { app: 'otherapp' })`. Writes are always same-app.

## Collection prefixes replace hyphens with underscores

App directory names allow hyphens (`my-app`) but PocketBase collection names
do not. `cubby.db.collection('items')` in app `my-app` resolves to
`my_app_items`. Migrations for hyphenated apps must use the underscore form.

## .phioconfig is gitignored in the template

All deployment-specific state lives in cubby.config.json and app directories
(the forkability rule). `.phioconfig` names a specific PocketHost instance, so
the template ignores it; a deployment repo may commit its own. CI does not
need it: deploy.yml passes PHIO_INSTANCE_NAME, which takes precedence.

## Deploys with new hooks or migrations require a real dashboard power cycle

Uploading pb_hooks and pb_migrations does not trigger PocketBase's
documented pb_hooks auto-restart (SFTP writes appear not to fire the
watcher across PocketHost's mounts). Worse, "power cycling" through the
mothership API (PUT instance {power:false/true}) returns 200 but does not
stop a running container: the instance served requests and ran crons
straight through a one-minute "off" window. Two levers actually work: the
dashboard's power button, or closing every live connection (an open tab's
realtime SSE keeps the instance awake) and letting it hibernate; the next
request boots the new code. Verified: after closing the last tab, the
instance recycled within minutes and loaded the pending hook and
migration. Static pb_public changes need no restart (but see the CDN
cache note).

## Superuser impersonation powers local testing

Password auth is disabled and OAuth needs provider consoles, so scripts/smoke.mjs
creates test users with the local superuser and mints tokens via PocketBase's
impersonate endpoint. This exercises the real rule chain (create rules,
owner checks) without any OAuth setup. The same trick works against
production if you ever need it, using a superuser you control.

## The template repo is also the live demo

This public repo deploys itself to cubby.pockethost.io so the example apps
can be explored without setting anything up. Deployments created from the
template point at their own instances (and domains) via cubby.config.json;
nothing in the platform references the demo instance except the config file
and README links.

## Realtime auth rebinding is the foundation's job

The PB JS SDK never rebinds its SSE connection when the auth store changes;
any subscription submitted afterward is rejected with "authorization don't
match" as long as some other subscription keeps the connection alive. The
foundation cycles the realtime connection on identity changes
(realtime.disconnect() + connect(), stable-but-undocumented SDK internals;
the SDK version is pinned by the committed bundle), which resubmits every
topic under the current identity. Relatedly, identity.logout() runs
registered beforeLogout hooks before clearing the token so subsystems can
clean up while still authorized: rooms uses this to delete its presence row,
giving other clients an instant user.leave instead of a 60s sweeper wait.

## App metadata lives in cubby.json, not a second file

When richer app metadata was wanted (tags, category) the options were a new
metadata.json or extending the existing manifest. cubby.json IS the app
manifest, so it grew the fields; the manifest build flows them into
sites.json and also stamps a stable `added` date by carrying forward values
from the committed sites.json (new apps get stamped once).

## Usage counters are hook-mediated

Popularity/recency sorting needs anonymous per-app counters. Letting
clients write a counters collection invites forgery and racy increments, so
app_usage is writable only by the /_cubby/stats/visit hook (system
context), which validates the app against sites.json. The foundation fires
the visit beacon on app boot: anonymous by design, no user linkage.

## Local dev binary pinned to PocketHost's line

scripts/dev.mjs pins PocketBase 0.39.x (PB_VERSION env to override) to match
what PocketHost currently runs, so migrations and hook APIs behave the same
locally and deployed.
