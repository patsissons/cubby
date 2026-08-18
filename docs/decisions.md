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

## AI cost controls are server-enforced and deny-by-default

Because AI calls cost money per use, policy lives where clients cannot
bypass it: the proxy hook reads the calling app's committed cubby.json.
Defaults are maximally conservative (empty model allowlist blocks AI
entirely, signed-in users only, one prompt per 60s per caller), and apps
opt in explicitly via an "ai" block. Rate stamps are recorded before the
provider call so failed calls are not free retries, and live in the
hook-only ai_rate collection. The app name in the request is a claim, not
proof: a forged claim can only reach model/rate combinations some
committed manifest already grants, which is the platform's single-operator
trust model working as intended. Client-side "instantiation options" were
rejected: any browser can craft raw requests, so advisory JS settings
would protect nothing.

Extended with content controls after the first key went live: allowedUsers
email globs (ACL, user_not_allowed), input size caps (content_too_long),
an options.maxTokens clamp, and messagePatterns, which are per-role regexes
that turn an app's prompts into fixed templates. Patterns are exhaustive by
design: once declared, a message whose role has no entry is rejected,
otherwise attackers would smuggle content through an unconstrained role.
The hello demo uses them so the browser can only vary the greeted name.

## phio deploys are additive: deletions do not propagate

Verified live: deleting a directory locally made phio print "removing
folder" on deploy, but the remote file was still there over SFTP (and
still served). Treat phio deploys as add/replace only. Uploads can also
phantom: phio has twice reported uploading a NEW file that never landed
(its sync state then believes the file exists, so later deploys skip it).
After deploying anything critical, verify over SFTP or by content probe;
re-upload by changing the file's content, or use sftp put directly. When removing an
app (or any file) from a deployment, delete the remote copy manually over
SFTP (ftp.pockethost.io:2222, account email + registered SSH key, paths
under `<instance>/`). Missing static paths fall back to the discovery
site with HTTP 200, so verify deletions by content, not status code.

## Local dev binary pinned to PocketHost's line

scripts/dev.mjs pins PocketBase 0.39.x (PB_VERSION env to override) to match
what PocketHost currently runs, so migrations and hook APIs behave the same
locally and deployed.

## Markdown is a hand-rolled escaped-by-construction subset in an opt-in bundle

The repo vendors zero third-party libraries and apps avoid innerHTML for
user data, so a markdown capability had two honest options: vendor
marked + DOMPurify (~45KB gz, the first dependencies, and a sanitizer
allowlist to maintain) or write a small GFM subset that escapes every
source character at emission and vets URL schemes. The subset won: safety
comes from construction rather than filtering, the whole module is ~6KB
gz, and the deliberate cuts (no raw HTML passthrough, no reference-style
links, no setext headings) are features for user-generated content, not
gaps. render() returns an HTML string — not an element — because the
renderer must run DOM-free in Node for scripts/markdown-tests.mjs, and an
element return would add no safety (it would be built via innerHTML
internally anyway). The string is documented as the one sanctioned
innerHTML source.

Delivery is a separate /js/markdown.js bundle rather than growing
foundation.js: editor UI is a per-app choice, and apps that never render
markdown shouldn't fund it on every page load. Both scripts use defer, so
"foundation first, markdown second" is guaranteed by document order — no
polling. The editor defaults to GitHub-style Write/Preview tabs (one
column, works on mobile with no resize logic) with preview: 'split' for a
live side-by-side pane; its CSS is injected by JS, themed via the app
token vocabulary (--border, --muted, --accent, --code-bg) with fallbacks,
and defends against app-global element resets (hello resets ul and input,
which clipped task checkboxes until the module owned its list layout).
Pasted images upload as png/jpeg/gif/webp only — SVG is excluded because
PocketBase serves stored files with their declared content type, and SVG
scripts on the instance origin. The paste flow also surfaced a latent fs
bug: the PB SDK auto-cancels same-collection concurrent requests, which
lost one of two parallel uploads; all fs calls now pass requestKey: null.
