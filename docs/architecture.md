# Architecture

One repo deploys to one PocketHost (PocketBase) instance and hosts many tiny
static apps. This page covers how each piece works and shows a usage example
for every public foundation method.

## Routing (there is none)

PocketBase serves `pb_public/` statically. `/<name>/` resolves to
`pb_public/<name>/index.html` natively; zero hook code. Missing paths fall
back to the root `index.html` (the discovery site), which means:

**Apps must use hash routing (`#/page`) for internal navigation.** A deep
link like `/myapp/settings` does not reach your app; `/myapp/#/settings`
does. The `_template` app ships a minimal hash router.

Reserved top-level names (see `cubby.config.json` reservedNames): `api`, `_`,
`js`, `_template`, `index.html`, `sites.json`, `cubby.config.json`. The
`/_cubby/*` route prefix is used by server hooks.

## Boot and configuration

Every app loads one script:

```html
<script src="/js/foundation.js" defer></script>
```

or as a module: `import cubby from '/js/foundation.esm.js'`.

- The app name is the first path segment (`_root` on `/`).
- One shared PocketBase SDK client, base URL = `location.origin` (everything
  is same-origin; `cubby.config.json`'s instanceUrl is only a fallback for
  non-browser contexts).
- `cubby.ready` resolves after the config fetch and auth restore. Boot is
  lazy: it starts on the first `cubby.ready` access, so tests and local dev
  can call `cubby.configure({ app, instanceUrl })` first.

```js
await cubby.ready
console.log(cubby.app)     // { name: 'hello', base: '/hello/' }
console.log(cubby.config)  // parsed cubby.config.json
```

`cubby.config.json` lives at the repo root (the single file a deployment
edits) and is copied into `pb_public/` by `npm run build:manifest` so the
foundation and the server hooks read the same registry.

## Errors

Every foundation method throws `CubbyError` with a `code`:
`auth_required`, `not_found`, `bad_path`, `bad_request`, `model_unknown`,
`provider_unconfigured`, `provider_error`, `config_unavailable`.

```js
try {
  await cubby.fs.read('missing.txt')
} catch (err) {
  if (err.code === 'not_found') console.log('no such file')
}
```

## Database: cubby.db

Collections are namespaced `<app>_<name>` by convention (hyphens in app names
become underscores). Write your own prefix, read anything: isolation between
apps is convention, not enforcement.

```js
const items = cubby.db.collection('items')        // -> '<app>_items'
const other = cubby.db.collection('hello/guestbook') // cross-app read

await items.create({ title: 'hi' })
const page = await items.getList(1, 20, { sort: '-created' })
await items.subscribe('*', (e) => console.log(e.action, e.record))
cubby.db.raw                                       // the PocketBase SDK client
```

The returned object is the PB SDK RecordService: the full PocketBase API
(getList, getFullList, getOne, create, update, delete, subscribe) works
as documented at pocketbase.io.

App collections are created by real migrations in `pb_migrations/`, named
`<timestamp>_app_<app>_<what>.js`. Default rules for app collections: read
everyone (`""`), write authenticated (`"@request.auth.id != ''"`).

## File storage: cubby.fs

Backed by the root-level `files` collection: one record per (app, path),
10MB per file, read public, write authenticated. Paths are always relative
to the current app; writes upsert.

```js
await cubby.fs.write('notes/note.txt', 'hello')      // string | Blob | File
const text = await cubby.fs.read('notes/note.txt')   // utf-8 string
const blob = await cubby.fs.readBlob('notes/note.txt')
const url  = await cubby.fs.url('notes/note.txt')    // direct PB file URL
const list = await cubby.fs.list('notes/')           // [{ path, size, updated }]
await cubby.fs.remove('notes/note.txt')

// Cross-app reads are explicit:
const data = await cubby.fs.read('data.json', { app: 'otherapp' })
```

Paths are normalized (no leading slash, no `..`, no backslashes). String
writes get a content type from a small extension map.

## Identity: cubby.identity

OAuth2 only; password auth is disabled platform-wide. One `users` auth
collection serves every app, and the SDK's localStorage auth store makes
login state shared across all apps on the origin automatically.

```js
cubby.identityChanged((user) => {
  console.log(user ? `hi ${user.name}` : 'signed out')
})                                    // fires immediately; returns unsubscribe

await cubby.identity.login('google')  // PB authWithOAuth2 popup flow
cubby.identity.user                   // user record | null
await cubby.identity.logout()
```

Identity changes propagate live: the foundation rebinds the shared realtime
connection so existing subscriptions keep working under the new identity,
and logout() lets subsystems clean up (rooms depart presence) before the
token is cleared. Apps only need `identityChanged` to re-render.

### OAuth provider setup

Register one redirect URI per provider:
`https://<HOST>/api/oauth2-redirect` (add both the custom domain and the
`<instance>.pockethost.io` variant if you use both).

- **Google**: console.cloud.google.com > APIs & Services > Credentials >
  Create OAuth client ID (Web application). Add the redirect URI. Copy client
  ID and secret.
- **GitHub**: github.com/settings/developers > New OAuth App. Homepage is
  your host; authorization callback is the redirect URI. Copy client ID and
  secret.

Enter both into the PocketBase admin UI (`https://<HOST>/_/` > users
collection > Edit collection > Options > OAuth2), and list the enabled
providers in `cubby.config.json` `oauthProviders` so login buttons render.

## AI: cubby.ai

Non-streaming chat through a server-side proxy (`POST /_cubby/ai/chat` in
`pb_hooks/ai.pb.js`). The JSVM cannot stream, so there is no streaming API in
v1 (see decisions.md). Anonymous calls are rejected; provider keys live in
PocketHost instance secrets and never reach the client.

```js
const res = await cubby.ai.chat({
  messages: [
    { role: 'system', content: 'you are an assistant' },
    { role: 'user', content: 'add 2 + 2' },
  ],
  model: 'claude-haiku',              // registry alias; omit for the default
  options: { maxTokens: 500, temperature: 0.3 },
})
console.log(res.text, res.usage, res.model, res.provider)
```

Models are aliases in `cubby.config.json` `ai.models`; unknown aliases throw
`model_unknown` before any request. The hook resolves the alias, calls the
provider (Anthropic messages, OpenAI responses, Gemini generateContent) with
a 60s timeout, and normalizes to `{ text, usage: { input, output }, model,
provider }`. A missing key returns `provider_unconfigured` naming the env var.

Keys: set `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` in the
PocketHost dashboard (instance > Secrets), then power the instance off and on.

## Rooms: cubby.rooms

Presence and events over PocketBase realtime, which is SSE (not WebSocket).
Expect 100-500ms latency: fine for chat, presence, and casual multiplayer.

```js
const room = cubby.rooms.room('lobby')            // namespaced '<app>/lobby'

room.on('user.join',  (user) => {})
room.on('user.leave', (user) => {})
room.on('user.state', (prev, next, user) => {})
room.on('room.sync',  () => {})                   // roster rebuilt (load, rejoin, identity change)
room.on('announce',   (payload, user) => {})      // custom events

await room.watch()                                // observe only; works signed out
await room.join()                                 // requires auth; 20s heartbeat
room.users                                        // [{ user, state }]
await room.updateUserState({ score: 3 })
await room.emit('announce', { msg: 'here!' })
await room.leave()

cubby.rooms.room('otherapp/lobby')                // cross-app room, explicit
```

Custom event names must not start with `user.` or `room.` (reserved for
built-ins). User names in presence and events resolve only for signed-in
subscribers (user profiles are auth-gated); the client rebuilds its
subscriptions and roster on identity changes and fires `room.sync` so UIs
can re-render.

Implementation: `rooms_presence` holds one row per (room, user) with a
`seen` heartbeat; `rooms_events` holds fire-and-forget event rows. Realtime
subscriptions filter on the namespaced room id; creates/updates/deletes map
to join/state/leave. A sweeper (`pb_hooks/rooms.pb.js`) deletes presence
older than 60s (emitting user.leave for crashed clients via the delete
event) and events older than 10 minutes. On PocketHost, add a dashboard
webhook hitting `GET /_cubby/cron/sweep` on `@minutely` since `cronAdd` is
unreliable under hibernation (see decisions.md).

## Usage stats and the discovery site

`POST /_cubby/stats/visit` (pb_hooks/stats.pb.js) bumps an anonymous
per-app counter in the `app_usage` collection: one row per app with visits
and lastVisit, public read, hook-only writes (clients cannot forge values),
unknown apps rejected against sites.json. The foundation fires the beacon
automatically when an app boots in a browser; no user data is attached.

The discovery site builds its cards from sites.json (title, description,
icon, category, tags, and an `added` date stamped once per app by the
manifest build), offers search across all of those fields, and sorts by
name, newest, most visited, or recently used using the app_usage rows.

## Local development

```
npm run dev     # downloads/caches PocketBase into .pb/, serves on :8090
npm run seed    # demo data for hello (local only)
node scripts/smoke.mjs   # runs the bundle against the local server
```

Path routing means no DNS tricks: `http://localhost:8090/hello/`. The local
superuser is `local@cubby.test` / `cubby-local-dev` (admin UI at `/_/`).
Set `PB_HTTP=127.0.0.1:8091` to use another port.

## Deployment

`deploy.yml` runs on push to main: `npm ci`, rebuild `foundation.js` +
`sites.json` + the config copy, fail if committed artifacts drifted, then
sync via PocketHost's phio CLI (SFTP, port 2222, Ed25519 deploy key).
Secrets: `PHIO_USERNAME`, `PHIO_PASSWORD`, `PHIO_INSTANCE_NAME`. The deploy
step is skipped when secrets are absent, so the template ships inert.

Manual deploys: `npx phio login`, `npx phio link <instance>`, `npm run deploy`.
phio syncs `pb_public/`, `pb_hooks/`, and `pb_migrations/` and never touches
`pb_data`. PocketBase applies pending migrations automatically on restart;
power-cycle the instance after the first deploy (see decisions.md).

Fallback without phio: any SFTP mirror against `ftp.pockethost.io:2222`
(username = PocketHost account email, auth via an SSH key registered in the
dashboard under Account > Keys) into the `<instance>/` directory.

## Platform limits worth knowing (PocketHost)

- Instances hibernate when idle; the first request after wake is slow.
- Rate limits: 1000 req/hr/IP, 15 concurrent/IP, 250 concurrent/instance.
  The 20s presence heartbeat spends ~180 req/hr per joined tab.
- `pb_public` is CDN-cached at the edge with `max-age=14400`: deployed
  changes to static files (including the foundation bundle and app HTML)
  can serve stale for up to 4 hours. Verify a fresh deploy with a
  cache-busting query (`/js/foundation.js?v=anything`), which bypasses the
  cached key and hits the origin.
- Hooks run in a synchronous JSVM: no Node APIs, no fetch, no timers, no
  Promises. `$http.send` buffers whole responses.
