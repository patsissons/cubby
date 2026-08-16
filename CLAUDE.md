# cubby

One repo, one PocketHost (PocketBase) instance, many tiny static web apps:
each lives in pb_public/<name>/, is served at /<name>/, and gets database,
file storage, OAuth identity, AI chat, and rooms from the global `cubby`
object loaded via /js/foundation.js. The forkability rule governs every
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
