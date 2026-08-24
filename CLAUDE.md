# cubby

One repo, one PocketHost (PocketBase) instance, many tiny static web apps:
each lives in pb_public/<name>/, is served at /<name>/, and builds on the
global `cubby` object. cubby ships in layers, and tag order IS the dependency
declaration (defer, document order, no ready event): /js/core.js first (the
namespace, CubbyError, escaping, widget lifecycle, design tokens -- no
PocketBase), then /js/platform.js for database, file storage, OAuth identity,
AI chat and rooms, then any opt-in module such as /js/markdown.js, then the
app's own script. An app loads only what it uses; a page needing no backend
skips platform.js entirely. /js/foundation.js is the deprecated all-in-one and
must keep building. The forkability rule governs every
change: all deployment-specific state lives in cubby.config.json and app
directories (plus their app migrations); platform files are never edited in
deployment repos, so upstream merges stay clean.

To build a new app here, follow skills/new-app/SKILL.md (also exposed
as /cubby:new-app). To bootstrap a new deployment repo, follow
skills/init/SKILL.md (/cubby:init); to stand up or operate a
deployment, follow skills/deploy/SKILL.md; to pull upstream platform
updates into a deployment, follow skills/update/SKILL.md
(/cubby:update). The skills are the source of agent truth;
docs/ explains the architecture for humans. Verify work with `npm run dev`
plus scripts/smoke.mjs, and keep committed artifacts fresh with `npm run
build` before pushing (CI fails on drift).
