---
name: new-app
argument-hint: "<name>: <description>"
description: Create a micro-site (app) in an existing cubby deployment. Use when asked to add, build, or scaffold a new app, page, tool, game, or site in a cubby repo, or to modify an existing cubby app. Covers app anatomy, the full cubby foundation API (db, fs, identity, ai, rooms), collections/migrations, naming rules, and the required PR shape.
---

# Building a cubby app

A cubby app is a directory of plain html/js/css served statically at
`/<name>/`. No build step, no framework, no server code. Everything dynamic
comes from the `cubby` global.

## Scaffold

```
npm ci             # once, if node_modules is missing
npm run new-app <name> -- --title "My App" --description "One line" --icon "🎯"
```

- Names: `[a-z0-9-]+` only. Rejected if in `cubby.config.json` reservedNames
  (`api`, `_`, `js`, `_template`, `index.html`, `sites.json`,
  `cubby.config.json`).
- A `_` prefix hides a directory from the discovery site; so does
  `"hidden": true` in `cubby.json`.
- The scaffolder copies `pb_public/_template/` and regenerates `sites.json`.

## App anatomy

```
pb_public/<name>/
├── index.html    loads /js/foundation.js + app.js (both defer)
├── app.js        the app; await cubby.ready before using cubby.*
├── style.css     dark-mode aware (see template's prefers-color-scheme vars)
└── cubby.json    manifest: { name, title, description, icon, hidden?,
                              category?, tags? }
```

The discovery site's search box matches name, title, description, category,
and tags, so fill category (one word) and a few tags; the scaffolder
accepts `--category` and `--tags "a,b,c"`. Visits are counted automatically
(the foundation pings an anonymous per-app counter on boot) and power the
dashboard's "most visited" and "recently used" sorting; apps do nothing.

## HASH ROUTING IS MANDATORY

Unknown server paths fall back to the discovery site: `/<name>/settings`
never reaches the app. Internal navigation must use `location.hash`
(`#/settings`) with a `hashchange` listener. Keep the template's hash-based
routing mechanism; its demo nav and pages are placeholders to replace.
Query strings on the intact path (`/<name>/?x=y`) do reach the app, but the
hash is the conservative home for shareable URL state since it also
composes with hash routes.

## The cubby API

Load `<script src="/js/foundation.js" defer></script>`, then in app code:

```js
await cubby.ready              // config fetched, auth restored
cubby.app                      // { name: 'myapp', base: '/myapp/' }
cubby.config                   // parsed cubby.config.json (oauthProviders, ai.models)
```

All errors are `cubby.CubbyError` with `.code` (auth_required, not_found,
bad_path, bad_request, model_unknown, provider_unconfigured, provider_error).

### Database: cubby.db

```js
const items = cubby.db.collection('items')   // PB collection '<app>_items'
await items.create({ title: 'hi' })          // full PocketBase SDK API
const page = await items.getList(1, 20, { sort: '-created', expand: 'user' })
await items.subscribe('*', (e) => { /* e.action, e.record */ })
cubby.db.collection('hello/guestbook')       // cross-app read (convention: never write)
```

### File storage: cubby.fs

```js
await cubby.fs.write('notes/note.txt', text)          // upserts; string|Blob|File
const text = await cubby.fs.read('notes/note.txt')
const url = await cubby.fs.url('image.png')           // for <img src>
const files = await cubby.fs.list('notes/')           // [{ path, size, updated }]
await cubby.fs.remove('notes/note.txt')
await cubby.fs.read('data.json', { app: 'otherapp' }) // cross-app read
```

Reads are public; writes need a signed-in user. Files are shared per
(app, path): for per-user data, put the user id in the path
(`notes/${cubby.identity.user.id}.txt`).

### Identity: cubby.identity

```js
cubby.identityChanged((user) => render(user))  // fires immediately; returns unsubscribe
await cubby.identity.login('google')           // providers from cubby.config.oauthProviders
cubby.identity.user                            // record | null
await cubby.identity.logout()
```

### AI: cubby.ai (non-streaming, signed-in users only)

```js
const res = await cubby.ai.chat({
  messages: [
    { role: 'system', content: 'answer briefly' },
    { role: 'user', content: 'hi' },
  ],
  model: 'gemini-flash',                 // optional alias from cubby.config.ai.models
  options: { maxTokens: 500 },
})
res.text                                 // also: res.usage, res.model, res.provider
```

Handle `provider_unconfigured` gracefully: not every deployment sets every
provider key.

### Rooms: cubby.rooms

```js
const room = cubby.rooms.room('lobby')   // namespaced '<app>/lobby'
room.on('user.join', (user) => {})
room.on('user.leave', (user) => {})
room.on('user.state', (prev, next, user) => {})
room.on('room.sync', () => {})           // roster rebuilt; re-render your user list here
room.on('wave', (payload, user) => {})   // custom events
await room.watch()                       // observe only; works signed out
await room.join()                        // requires auth; heartbeats automatically
room.users                               // [{ user, state }]
await room.updateUserState({ x: 1 })
await room.emit('wave', { emoji: '👋' })
await room.leave()
```

SSE transport: expect 100-500ms latency. Custom event names must not start
with `user.` or `room.`. User names resolve only for signed-in viewers
(profiles are auth-gated): render `user.name || 'someone'` and re-render on
`room.sync`.

`pb_public/hello/app.js` is the working reference for every one of these.

## Collections (only when the app needs its own)

Add one migration file: `pb_migrations/<unix-ts>_app_<name>_<what>.js`.
Collections are prefixed `<name>_` with hyphens as underscores (app `my-app`
uses `my_app_items`). Copy the shape from
`pb_migrations/*_app_hello_guestbook.js`. Default rules:

- `listRule`/`viewRule`: `""` (everyone)
- `createRule`: `"@request.auth.id != ''"` (add
  `&& @request.body.user = @request.auth.id` when tracking authorship)
- `updateRule`/`deleteRule`: owner (`"user = @request.auth.id"`) or `null`

Migrations run automatically when the local dev server (or the deployed
instance) restarts.

## What NOT to touch

- `foundation/`, `pb_public/js/` (built artifacts)
- `pb_hooks/`
- `pb_migrations/*_platform_*`
- other apps' directories
- `cubby.config.json` (unless the change is explicitly requested)

If the app seems to need any of those changed, stop: that is a platform
change and belongs upstream (docs/forking.md).

## Verify

1. `npm run dev` serves on `http://127.0.0.1:8090` (set
   `PB_HTTP=127.0.0.1:<port>` if 8090 is busy, and use that host:port in
   every URL below). Open `/<name>/` and exercise every feature.
2. If the app has migrations, confirm the collections exist (admin UI at
   `/_/`, superuser local@cubby.test / cubby-local-dev).
3. `npm run build` so `sites.json` and artifacts are fresh (CI fails on
   drift), and confirm the app card shows on the discovery site at `/`.

`scripts/smoke.mjs` tests the foundation itself, not apps; running it is
not part of adding an app.

## PR shape

One app directory + optional `_app_<name>_` migrations + regenerated
`sites.json`. `pb_public/cubby.config.json` is a build-time copy of the
root config: include it if `npm run build` refreshed it, never edit it by
hand. Nothing else. Commit messages describe the app, not the scaffolding.
