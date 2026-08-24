---
name: new-app
argument-hint: "<name>: <description>"
description: Create a micro-site (app) in an existing cubby deployment. Use when asked to add, build, or scaffold a new app, page, tool, game, or site in a cubby repo, or to modify an existing cubby app. Covers app anatomy, the full cubby foundation API (db, fs, identity, ai, rooms, markdown rendering/editing), collections/migrations, naming rules, and the required PR shape.
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
├── index.html    loads /css/tokens.css + the cubby tags + app.js (all defer)
├── app.js        the app; await cubby.ready before using cubby.*
├── style.css     consumes the shared tokens (/css/tokens.css); do not
                  redefine --bg/--fg/--accent unless the app really means to
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

### Loading it: tag order IS the dependency declaration

`defer` scripts run in document order and there is no ready event, so the
order of these tags is the whole contract. Core first, the app's own script
last:

```html
<link rel="stylesheet" href="/css/tokens.css" data-cubby-tokens />
<link rel="stylesheet" href="style.css" />
<script src="/js/core.js" defer></script>       <!-- always, first -->
<script src="/js/platform.js" defer></script>   <!-- only if the app needs a backend -->
<script src="/js/markdown.js" defer></script>   <!-- opt-in modules, in this order -->
<script src="app.js" defer></script>            <!-- always, last -->
```

`npm run new-app <name> -- --modules markdown` writes these for you and puts
them in the right order; it only offers modules that are actually built.

Load ONLY what the app uses. `core.js` is 1.5KB and carries no PocketBase;
`platform.js` is 14.2KB and is where db/fs/ai/rooms/identity live. An app that
just renders content needs `core.js` + `markdown.js` and nothing else.

`/js/foundation.js` is the DEPRECATED all-in-one. Never use it in a new app.

Then in app code:

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
const meta = await cubby.fs.write('notes/note.txt', text) // upserts; string|Blob|File
meta.url                                              // direct file URL, no extra call
const text = await cubby.fs.read('notes/note.txt')
const url = await cubby.fs.url('image.png')           // for <img src>
const files = await cubby.fs.list('notes/')           // [{ path, size, updated }]
await cubby.fs.remove('notes/note.txt')
await cubby.fs.read('data.json', { app: 'otherapp' }) // cross-app read
```

Reads are public; writes need a signed-in user. Files are shared per
(app, path): for per-user data, put the user id in the path
(`notes/${cubby.identity.user.id}.txt`).

### Markdown: cubby.markdown (opt-in script)

When an app needs markdown — rendering user text, notes, comments, an
editor — use this module. NEVER hand-roll a markdown renderer, sanitizer,
or paste-upload handler. Load it with one extra tag, after core.js
(both defer; order matters):

```html
<script src="/js/core.js" defer></script>
<script src="/js/markdown.js" defer></script>
<script src="/js/editor.js" defer></script>   <!-- only if you need the editor -->
<script src="/js/nav.js" defer></script>      <!-- sticky site bar; core only -->
```

It needs **core**, not the platform: `render()` works with no backend at all.
Add `platform.js` between them only if the app needs one anyway (paste image
upload does; nothing else in the module does). With no platform the editor is
a plain composer with a working preview and upload silently off.

```js
el.innerHTML = cubby.markdown.render(mdText)   // safe by construction
cubby.markdown.render(md, { linkTarget: '_blank' })  // adds rel="noopener noreferrer"
```

`render()` returns an HTML string in which every source character is
escaped and URLs are vetted (http/https/mailto/relative only) — raw HTML
in the markdown renders as visible text. It is the ONLY sanctioned
innerHTML source; never concatenate raw user data around it. Style the
container yourself or call `cubby.markdown.injectStyles()` and add class
`cubby-markdown`. Supported: GFM subset (headings, emphasis, links,
images, code, nested lists, task lists, tables, blockquotes); not
supported: raw HTML passthrough, reference-style `[a][b]` links, setext
headings.

```js
const ed = cubby.editor($('editor'), {   // needs /js/editor.js after markdown.js
  value: '',                      // initial markdown
  preview: true,                  // Write|Preview tabs; 'split' = live side-by-side; false = none
  rows: 8,
  upload: { pathPrefix: 'uploads/' },  // or false; paste/drop images upload to cubby.fs
  onChange(value) {},
  onUpload({ name, path, url }) {},
  onError(err) {},                // err.code: auth_required (signed-out upload), file_too_large
})
ed.value                          // get/set the markdown
ed.refresh(); ed.focus(); ed.destroy()
```

Pasting or dropping an image inserts an `![Uploading name…](…)`
placeholder that is swapped for the real file URL when the upload lands
(GitHub PR editor behavior). Uploads go to
`uploads/<userId>/<token>.<ext>` via cubby.fs and require sign-in —
surface `auth_required` from onError. png/jpeg/gif/webp only.
`cubby.editor` lives in its own bundle so apps that only render markdown
don't pay for it. `cubby.markdown.attachImageUpload(textarea, opts)` wires the same
paste/drop flow onto your own textarea and returns a detach function.
See the "Markdown" section of `pb_public/hello/` for a working example.

### Identity: cubby.identity

```js
cubby.identityChanged((user) => render(user))  // fires immediately; returns unsubscribe
await cubby.identity.login('google')           // providers from cubby.config.oauthProviders
cubby.identity.user                            // record | null
await cubby.identity.logout()
```

### AI: cubby.ai (non-streaming, blocked until the app opts in)

AI costs real money, so apps declare their policy in cubby.json; without an
`ai` block every model is rejected with `model_not_allowed`:

```json
"ai": { "models": ["gemini-flash"] }
```

Optional keys: `"allowAnonymous": true` (default false: signed-in users
only), `"rateLimitSeconds": 30` (default 60 between prompts per caller; 0
disables), `"allowedUsers": ["*@corp.com"]` (email globs restricting who
may call), `"maxChars"` / `"maxMessages"` / `"maxTokens"` size caps
(defaults 4000/16/1000), and `"messagePatterns"` (role -> regex, or a list
of regexes where matching any one passes). Prefer messagePatterns whenever
the app's prompts are templates: with patterns declared, every message's
role needs an entry and its content must match,
so browsers cannot send arbitrary prompts on the deployment's API key (see
hello's cubby.json for the shape). Declare only the models the app needs.

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

Handle these errors gracefully: `provider_unconfigured` (deployment has no
key for that provider), `model_not_allowed` (not in the app's allowlist),
and `rate_limited` (err.retryAfter says how many seconds to wait).

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

- `foundation/`, `pb_public/js/`, `pb_public/css/` (built artifacts)
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
