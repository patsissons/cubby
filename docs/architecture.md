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

## Modules and load order

cubby ships as layers, so a page pays only for what it uses:

| bundle | gz | what it is |
|---|---|---|
| `/js/core.js` | 1.5KB | the `cubby` namespace, `CubbyError`, escaping, the widget lifecycle, design tokens. No PocketBase. |
| `/js/platform.js` | 14.2KB | PocketBase: `config`, `identity`, `db`, `fs`, `ai`, `rooms`. |
| `/js/markdown.js` | 6.0KB | `cubby.markdown.render()`. |
| `/js/foundation.js` | 15.4KB | **deprecated** all-in-one (core + platform). Still built; do not use it in new apps. |

Core comes first and the backend is optional, not the other way round —
widgets like a preview-only markdown editor need no PocketBase at all, so a
static content app can load `core.js` + `markdown.js` and never fetch the SDK.

**Tag order is the dependency declaration.** `defer` scripts execute in
document order and there is no ready event, so the order below is the whole
contract — no polling, no loader:

```html
<link rel="stylesheet" href="/css/tokens.css" data-cubby-tokens />
<script src="/js/core.js" defer></script>
<script src="/js/platform.js" defer></script>
<script src="/js/markdown.js" defer></script>
<script src="app.js" defer></script>
```

Core first; platform next if the app needs a backend; `markdown.js` before
anything that renders markdown; your `app.js` last. As ES modules:
`import cubby from '/js/platform.esm.js'` (which imports `core.esm.js`
itself).

A missing **hard** dependency logs one `console.error` naming the corrective
tag order and attaches nothing. A missing **platform** is silent — a page
deliberately serving markdown with no backend is a supported configuration,
not a failure.

`scripts/core-tests.mjs` loads every app's real tag list in a vm, so a
mis-ordered page fails the build rather than the browser.

## Boot and configuration

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
const meta = await cubby.fs.write('notes/note.txt', 'hello') // string | Blob | File
meta.url                                             // direct file URL (no extra call)
const text = await cubby.fs.read('notes/note.txt')   // utf-8 string
const blob = await cubby.fs.readBlob('notes/note.txt')
const url  = await cubby.fs.url('notes/note.txt')    // direct PB file URL
const list = await cubby.fs.list('notes/')           // [{ path, size, updated }]
await cubby.fs.remove('notes/note.txt')

// Cross-app reads are explicit:
const data = await cubby.fs.read('data.json', { app: 'otherapp' })
```

Paths are normalized (no leading slash, no `..`, no backslashes). String
writes get a content type from a small extension map. All fs calls disable
the PB SDK's request auto-cancellation so concurrent operations (e.g. two
images uploading at once) don't abort each other.

## Markdown: cubby.markdown (opt-in)

Markdown rendering and editing ship as a separate bundle so apps that
don't use it pay zero bytes. Apps opt in with one extra tag, after core
(both defer, so execution order is guaranteed):

```html
<script src="/js/core.js" defer></script>
<script src="/js/markdown.js" defer></script>
```

Note it needs **core**, not the platform — `render()` works with no backend
at all. Add `platform.js` between them only if the app also needs one (paste
image upload does; nothing else in the module does).

The source lives in `foundation/src/markdown/` and builds to
`pb_public/js/markdown.js` (attaches `cubby.markdown`) and
`markdown.esm.js` (exports `render` and `createMarkdown`; `render` is pure
and runs in Node — `scripts/markdown-tests.mjs` tests the shipped
artifact). Its gzip budget is 8KB (currently ~6KB).

```js
el.innerHTML = cubby.markdown.render('# hi **there**')
cubby.markdown.render(md, { linkTarget: '_blank' })  // adds rel="noopener noreferrer"
cubby.markdown.injectStyles()        // idempotent; the editor calls it itself
```

## Editor: cubby.editor (opt-in)

A markdown textarea with live preview and paste/drop image upload. Needs
`core.js` and `markdown.js` before it; the platform is optional.

```html
<script src="/js/core.js" defer></script>
<script src="/js/markdown.js" defer></script>
<script src="/js/editor.js" defer></script>
```

```js
const ed = cubby.editor(container, {          // container, or a selector string
  value: '',
  preview: true,                       // Write|Preview tabs; 'split' = live pane; false = none
  upload: { pathPrefix: 'uploads/' },  // or false to disable paste/drop upload
  onChange(value) {}, onUpload({ name, path, url }) {}, onError(err) {},
})
ed.value          // live accessor
ed.setValue(md)   // fires onChange and refreshes a visible preview
ed.images         // [{ name, path, url }] uploaded through this editor
ed.element        // the mounted root
ed.preview        // the preview element
ed.focus(); ed.refresh(); ed.destroy()
```

The preview renders through **the same renderer** the app uses for the saved
value — `cubby.markdown.render`, read off the namespace at call time rather
than bundled, so `editor.js` is 2KB and there is exactly one renderer on the
page. What you see while typing is not an approximation of what gets stored.

**With no platform loaded the editor is a plain composer**: the preview still
works, upload is simply not wired, and nothing is logged. A page deliberately
serving markdown with no backend is a supported configuration, not a failure.

`cubby.markdown.editor` and `cubby.markdown.attachImageUpload` still exist and
still work; they are the previous home of this module and will be removed a
release after apps have moved.

**Safety model: escaped by construction.** The renderer is a hand-rolled
GFM subset with no dependencies and no sanitizer, because none is needed:
every source character is escaped at emission, so raw HTML in markdown
input always renders as visible text, and URLs are vetted (http, https,
relative; mailto for links only — `javascript:` and friends become empty).
The returned string is safe for `innerHTML`; the contract breaks only if
an app concatenates raw user data around it. Subset cuts, documented and
deliberate: no raw HTML passthrough, no reference-style `[a][b]` links, no
setext headings, no indented code blocks, single-line list items.

**Paste-image upload** (GitHub PR editor behavior): pasting or dropping an
image inserts `![Uploading name…](cubby-upload:<token>)` at the cursor,
uploads to `uploads/<userId>/<token>.<ext>` via `cubby.fs.write`, then
swaps the placeholder for `![name](url)` — the unique token keeps
concurrent pastes distinguishable, and edits use `setRangeText` so the
undo stack survives. Failures remove the placeholder and call `onError`;
signed-out pastes error with `auth_required` and insert nothing. Image
types: png/jpeg/gif/webp (SVG is excluded: PocketBase serves files with
their declared content type, and SVG can script on the instance origin).

## Graph: cubby.graph (opt-in)

Node-and-edge diagrams in inline SVG. Core only, zero dependencies — no d3, no
mermaid, no canvas, because a static-files-only site cannot afford a renderer
script.

```html
<script src="/js/core.js" defer></script>
<script src="/js/graph.js" defer></script>
```

```js
cubby.graph('#diagram', {
  lanes: [{ id: 'browser', label: 'Browser' }],
  nodes: [{ id: 'app', lane: 'browser', column: 1, label: 'app.js', note: 'markdown **note**' }],
  edges: [{ id: 'e1', from: 'app', to: 'api', kind: 'http', label: 'REST' }],
  journeys: [{ id: 'load', label: 'Load a page', hue: 205, edges: ['e1'] }],
  kinds: { http: { hue: 205, dash: '' }, data: { hue: 145, dash: '7 4' } },
})
```

**Declarative data with no coordinates.** `lanes` give y, `column` gives x, and
one pass computes the rest. There is no force simulation: a diagram that
rearranges itself between visits cannot be referred to in prose. `column` is
1-based and unique within a lane — that is what makes layout a direct mapping
rather than a packing problem. Two nodes sharing a lane and column overlap,
which is reported rather than thrown, because half a diagram is more useful
than an exception.

**A journey is a list of edge ids, never node ids.** This is load-bearing: a
journey can only describe hops that were actually declared, and it lets "every
node no journey touches" be *derived* instead of maintained. Add an edge to a
journey and both update for free; the two cannot disagree. A node no journey
touches falls back to its own edges when highlighted — without that, hovering
it would dim the whole diagram and highlight nothing, which reads as a bug.

Other constraints worth knowing before editing it:

- **Plain wheel scrolls the page.** Only ⌘/Ctrl + wheel zooms, and with no
  modifier the listener does nothing at all — a canvas that swallows plain
  wheel traps a reader scrolling past it. Drag-to-pan and explicit zoom buttons
  carry the rest, with a visible hint, because a modifier key is not
  discoverable.
- **Everything reachable by hover is reachable by focus**, with an identical
  highlight state. No hover-only information, and every journey is rendered as
  prose beneath the canvas — the drawing is never the only copy. That text is
  what licenses hiding the popover on touch and below a narrow breakpoint.
- **No SVG `<title>` children.** It is SVG's accessible-name mechanism, but
  browsers also render it as a native tooltip after ~1s, on top of the designed
  popover, saying less, in a font you do not control. `role` + `aria-label`
  instead.
- **`pointer-events: none` on the popover**, or moving the cursor toward it
  hovers the popover, fires the edge's `mouseleave`, and it vanishes as you
  reach for it.
- Edge kinds differ by **dash pattern as well as hue** — six line colours on a
  dense diagram is more than colour alone can carry, and a dash survives
  greyscale printing and colour vision differences.
- Kinds, node types and journey hues are **config applied through custom
  properties** (`--cubby-graph-k-<kind>`, `--cubby-graph-d-<kind>`,
  `--cubby-graph-j-<journey>`), not enums duplicated in JS and CSS. A seventh
  kind is a data change, and a consumer with their own vocabulary can express
  it by redefining the property.
- Node and edge `note` fields are rendered through `cubby.markdown.render` when
  that module is loaded and as plain text when it is not. Callers never supply
  raw HTML: cubby already owns an escape-first renderer whose output is the one
  sanctioned `innerHTML` source.

`/docs/#flow` is the working example.

## Draw: cubby.draw (opt-in)

Ephemeral shared cursors and freehand marks. Needs core; uses `cubby.rooms`
when the platform is present and degrades to a private highlighter when it is
not.

```html
<script src="/js/core.js" defer></script>
<script src="/js/platform.js" defer></script>
<script src="/js/draw.js" defer></script>
```

```js
cubby.draw('main', {
  room: 'draw/page',     // default: one room per page, so pages do not share marks
  modifier: 'alt',       // alt | ctrl | meta | shift
  cursors: false,        // broadcast your pointer to peers (see below)
  segmentMs: 800,        // how often an in-progress stroke is flushed
  fadeMs: 5000, strokeWidth: 3, opacity: 0.42,
})
```

Hold the modifier and your pointer becomes a puck; hold and drag and you draw
a translucent line; release and the marks fade. **The local puck always shows**
— it costs nothing and works with no backend at all. **Broadcasting your cursor
to peers is off by default**, because every cursor sample is a presence write
and an SSE fan-out; marks are the feature, a live puck is the garnish.

### Whole paths, not point streams

A stroke is captured locally as a vector, simplified, and sent as **one event
per time-boxed segment** rather than as a stream of points. `cubby.rooms.emit()`
writes a database row per call, so the 50 ms point stream this feature is
usually built on would be ~20 rows/sec per drawer against a sweeper that clears
~16/sec. One path per ~800 ms is roughly 1/sec — about 16× less traffic, and it
is what makes the feature affordable on a durable event log at all.

Segments are flushed on a timer as well as on release, so a peer's latency is
bounded by `segmentMs` rather than by however long you keep drawing; each
carries its own duration so the receiver can replay it at the speed it was
drawn. Segments stitch by repeating their predecessor's last point.

Because a segment is self-contained there is **no stroke-end broadcast**, and
so none of the machinery one would need: no session ordinal to reconcile, no
retired set, no way for a point to arrive after its own end. A group's fade
timer is refreshed by activity rather than started by an end event, so a mark
cannot freeze on the page even if the last segment is lost.

### What is and is not persisted

`cubby.rooms` only ever subscribes to `create` and never reads event history,
so a late joiner sees nothing and a refresh clears the page. A row does exist
until the sweeper's `EVENTS_TTL_MS` (2 minutes) — the one place this departs
from "no persistence of any kind" — but it is never read after its realtime
moment.

Coordinates are anchor-relative: `x` as a fraction of the anchor's width, `y`
in document pixels from its top. Raw page coordinates misalign for the
commonest case there is — two people on wide monitors whose layout is identical
because the container is capped, differing only in left margin. What anchoring
cannot fix is reflow: below the cap, text wraps differently, so the same `y` is
a different line.

Marks render below a sticky nav and cursors above it. Sharing requires sign-in
(`emit` and `join` both do); signed-out visitors get a private highlighter and
the chip says so rather than claiming otherwise.

## Preview: cubby.preview (opt-in)

Hover a link, see the page. Core only — no backend.

```html
<script src="/js/core.js" defer></script>
<script src="/js/preview.js" defer></script>
```

```js
const pv = cubby.preview(document.body, {
  selector: 'a[href]',   // which links to delegate to
  delay: 900,            // dwell before opening; applies to focus too
  scripts: false,        // true relaxes sandbox to allow-scripts
  allow: ['.example.com'],  // defaults to cubby.config.preview.frameable
})
pv.attach(el)   // wire a link outside the root; returns a disposer
pv.popover      // the popover element (handle.element is the mount target)
pv.hide(); pv.destroy()
```

**The constraint everything follows from: a frame blocked by
`X-Frame-Options` or a `frame-ancestors` CSP cannot be detected from
JavaScript.** No error event fires, and `load` may still run on the blocked
shell — so "try the iframe and fall back if it fails" is not implementable.
The fallback would never trigger and the reader would sit looking at a blank
box.

So framing is an **allowlist of hosts whose headers were actually measured**,
in `cubby.config.json` under `preview.frameable`. It is a measurement, not a
preference. Adding a host means checking it first:

```sh
curl -sI https://example.com/ | grep -iE 'x-frame-options|frame-ancestors'
```

and following any 301/302, since a redirect tells you nothing about the page
you would land on. Record the date you checked; headers change.

- Same-origin is always frameable and never needs listing.
- A leading dot means "subdomain of, at any depth" (`.example.com` admits
  `example.com` and `a.b.example.com`); no dot is an exact host.
- Both forms are asserted against hostile controls — `evilexample.com` and
  `x.example.com.evil.com` — in `scripts/core-tests.mjs`. A suffix rule that
  admits either passes every positive test while being useless.

A refused host still gets a card: title, Open link, description, and a note
naming the host that refused. Rendering nothing reads as a broken feature
rather than as a page that will not embed.

Frames are `sandbox=""` by default, and `allow-same-origin` is never paired
with `allow-scripts` — together they let a same-origin framed document remove
its own sandbox. There is deliberately **no `error` listener** on the iframe;
the only failure path is a timeout that recolours the loading overlay.

## Nav: cubby.nav (opt-in)

A sticky two-row site bar. Core only — no backend.

```html
<script src="/js/core.js" defer></script>
<script src="/js/nav.js" defer></script>
```

```js
const bar = cubby.nav('#sitebar', {
  pages: [{ href: '/', label: 'Home' }, { href: '/docs/', label: 'Docs' }],
  sections: 'main',        // where to look for sections (default: main, then body)
  globalRules: true,       // false to own scroll-margin-top / scroll-behavior yourself
})
bar.current()   // { page, section, actions } -- actions is the pinned slot
bar.refresh()   // re-derive row two after rendering sections with JS
bar.destroy()
```

**Row two is derived from the DOM, not declared.** A section opts in by
carrying `aria-labelledby` pointing at its own heading id:

```html
<section aria-labelledby="usage" data-nav-label="Usage">
  <h2 id="usage">Using the thing</h2>
</section>
```

That single id is the accessible name, the jump target *and* the nav label, so
a nav entry pointing at a section that no longer exists is unrepresentable
rather than merely unlikely. `data-nav-label` overrides a heading too long for
a bar. Sections with `hidden` are skipped — an entry that scrolls nowhere and
never highlights reads as broken.

The active section comes from an IntersectionObserver with a band just under
the bar, and **nothing clears it**: mid-section on a tall block nothing is in
the band, and the last answer standing is the right one. The bar measures
itself once, publishes the height as `--cubby-nav-height`, and re-measures on
resize; the two global rules it leaks (`scroll-margin-top` on ids and
`:target`, and smooth scrolling under `prefers-reduced-motion: no-preference`)
read that property, so they cannot disagree with the bar's real height.

The bar is `position: fixed`, **not sticky**. Sticky only sticks while its
containing block is in view, and the mount point is a bare element exactly the
bar's height — so it scrolled out of view immediately and took the bar with it.
Being fixed means it occupies no space in normal flow, so the widget sets its
own mount element's height from the same measurement rather than pushing a body
padding rule onto the host; `destroy()` puts it back. The translucent
backdrop-blur background is applied only inside an `@supports` guard: a browser
without `backdrop-filter` rendering a see-through bar would have page content
legible straight through the labels, and an opaque bar is the correct
degradation.

`current().actions` is the pinned action area — other widgets mount their
triggers there without the bar having to know about them.

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

### Cost controls (per-app policy)

AI usage costs real money, so the proxy enforces each app's policy
server-side from the app's committed `cubby.json`:

```json
"ai": {
  "models": ["gemini-flash"],       // allowlist of registry aliases; DEFAULT []
  "allowAnonymous": false,          // default false: signed-in users only
  "rateLimitSeconds": 60,           // min seconds between prompts per caller; 0 disables
  "allowedUsers": ["*@corp.com"],   // email globs; default []: any signed-in user
  "maxChars": 4000,                 // total input length cap (default 4000; 0 disables)
  "maxMessages": 16,                // message count cap (default 16)
  "maxTokens": 1000,                // clamp on options.maxTokens (default 1000)
  "messagePatterns": {              // per-role content regexes (default: none)
    "system": "^You greet people warmly in one short sentence\\.$",
    "user": ["^Say hello to .{1,80}!$", "^Wish .{1,80} a happy birthday!$"]
  }
}
```

No `ai` block means no AI: the empty allowlist rejects every model with
`model_not_allowed` (403). Rate limiting is per app per caller (user id, or
client IP for anonymous-enabled apps), stamped before the provider call so
failures are not free retries; violations return `rate_limited` (429) with
a `retryAfter` seconds field that `cubby.ai.chat` surfaces on the thrown
CubbyError.

`messagePatterns` turns an AI feature into a parameterized template: when
declared, EVERY message's role must have an entry and its content must
match at least one of that role's patterns (a single regex or a list), so
the browser cannot inject arbitrary prompts (unlisted roles are rejected
too; the hello app's greeting demo works this way). `allowedUsers`
gates usage to matching signed-in emails (`user_not_allowed`), and the size
caps return `content_too_long` (413). Checks run before the rate stamp; the
app name in the request is the caller's claim, so a forged claim can only
ever reach policy combinations some committed manifest already allows.

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

`deploy.yml` runs on push to main: `npm ci`, rebuild the bundles +
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
  cache-busting query (`/js/core.js?v=anything`), which bypasses the
  cached key and hits the origin.
- Hooks run in a synchronous JSVM: no Node APIs, no fetch, no timers, no
  Promises. `$http.send` buffers whole responses.
