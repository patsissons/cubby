# Adding an app

The short version: `npm run new-app <name>`, edit, `npm run dev`, ship.

## Checklist

1. **Scaffold**: `npm run new-app my-app` (optionally
   `-- --title "My App" --description "..." --icon "🎯"`).
   Names must match `[a-z0-9-]+` and avoid the reserved list in
   `cubby.config.json`. Directories starting with `_` are hidden from the
   discovery site; `"hidden": true` in `cubby.json` does the same, and
   `"hidden": "access"` shows the card only to signed-in users the app's
   `access` block admits. `"hidden": { "except": ["my.domain"] }` (or
   `"on"`) hides it per deployment domain, with `*` wildcards.
2. **Build the app** in `pb_public/my-app/`: plain html/js/css, no build
   step. Load cubby with `<script src="/js/core.js" defer>` then
   `<script src="/js/platform.js" defer>` (core first; skip platform if the
   app needs no backend)
   and wait for `await cubby.ready`. Copy working patterns from
   `pb_public/hello/` (it exercises every subsystem).
3. **HASH ROUTING IS MANDATORY.** Unknown server paths fall back to the
   discovery site, so `/my-app/settings` never reaches your app. Use
   `#/settings` and listen to `hashchange`. The template ships a tiny router.
4. **Collections** (only if the app needs its own): add a migration
   `pb_migrations/<timestamp>_app_my_app_<what>.js` creating collections
   prefixed `my_app_` (hyphens become underscores in collection names).
   Default rules: read everyone (`listRule/viewRule: ""`), write
   authenticated (`"@request.auth.id != ''"`). See
   `pb_migrations/*_app_hello_guestbook.js` for the shape.
5. **Sharing (optional)**: add OpenGraph tags to your index.html (copy the
   block from `pb_public/hello/index.html`). The shared platform assets
   `/icon.svg`, `/og.png`, and `/apple-touch-icon.png` are there to use,
   and the manifest build rewrites `og:url`/`og:image` origins to the
   deployment's domain automatically. If individual records deserve their
   own unfurling share links (`/my-app/<slug>` with per-record OG tags),
   declare a `permalink` block in `cubby.json` — see "Permalinks" in
   `docs/architecture.md`.
6. **Manifest**: `cubby.json` needs name, title, description, icon;
   category and tags are optional but power the discovery site's search
   and chips. Then `npm run build:manifest` regenerates `sites.json`
   (new-app already does; it stamps each app's `added` date once). The same
   build generates the app's `llms.txt` and a JSON-LD block in its
   index.html from `cubby.json` — commit them all; to hand-write the
   llms.txt instead, delete its trailing marker comment.
7. **Verify**: `npm run dev`, open `http://localhost:8090/my-app/`, exercise
   the app, check the discovery site lists it.

## App hooks

An app that needs server-side behavior (secret API keys, server-only writes)
ships hooks at `pb_hooks/apps/my-app/*.pb.js`; the platform shim
(`pb_hooks/apps.pb.js`) loads them at boot, since PocketBase does not
auto-load nested hook files. Namespace routes as `/_cubby/apps/my-app/...`,
read secrets from instance env vars with `$os.getenv` (named with the app's
slug as prefix, `MY_APP_*` for `my-app`), and remember the JSVM is
synchronous (`$http.send`, no fetch/Promises). Hooks bypass collection
rules, so a hook-written collection can set its client write rules to `null`.
See the worked example in `skills/new-app/SKILL.md` ("App hooks").

An app can also expose tools to agent sessions over MCP: declare
`"mcp": { "enabled": true }` in `cubby.json` and ship
`pb_hooks/apps/my-app/mcp.js` (tools + `call`), served at
`/_cubby/mcp/my-app` behind `MY_APP_MCP_TOKEN`. See "MCP tools" in
`skills/new-app/SKILL.md` and docs/architecture.md.

Agents that only curl see what `GET /_cubby/content/my-app` renders: the
static index.html as markdown. If the page fills containers from data, ship
`pb_hooks/apps/my-app/content.js` so the snapshot shows that data too. If it
has hash routes, export `route(ctx)` there as well, so the deep link
`/my-app/#/x` reads at `/_cubby/content/my-app/x`. If the
app sits behind sign-in, declare `"access": { "allowedUsers": [...] }` in
`cubby.json` and no snapshot is served. Add `"hidden": "access"` to show
its discovery card to those users only. See "Agent-readable content" in
`skills/new-app/SKILL.md`.

## What not to touch

The foundation (`foundation/`, `pb_public/js/`), server hooks (`pb_hooks/`
outside your own `pb_hooks/apps/my-app/`), platform migrations
(`pb_migrations/*_platform_*`), other apps' directories,
and `cubby.config.json` (unless the change is the point). If an app seems to
need a platform change, that change belongs upstream in cubby: see
`docs/forking.md`.

## PR shape

One app directory (`pb_public/my-app/`), optional app migrations
(`pb_migrations/*_app_my_app_*.js`), optional app hooks
(`pb_hooks/apps/my-app/`), and the regenerated build artifacts:
`sites.json` (or `pb_hooks/scoped-sites.json` for `"hidden": "access"`),
the llms.txt files (root and the app's own), and the root
`pb_public/index.html` (its JSON-LD app list grows). Nothing else.
