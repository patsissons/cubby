# Forking and deploying your own cubby

**Fork cubby to develop and improve the foundation; create your own repo
from the template to launch your own micro-sites.** Contributions flow to
cubby; your apps live in your deployment repo.

## The two repos

- **cubby** (this repo, public, a GitHub template): the platform skeleton.
  Foundation, hooks, platform migrations, discovery site, `_template`, the
  hello example, scripts, deploy workflow, agent skills, docs. It also
  deploys itself to cubby.pockethost.io as the live demo of the example apps.
- **your deployment repo** (usually private): your real cubby system,
  created from the template. Adds your apps (`pb_public/<name>/`) and app
  migrations, and sets `cubby.config.json` to your instance. Everything else
  stays untouched.

The forkability rule that makes upstream merges painless: all
deployment-specific state lives in exactly two places, `cubby.config.json`
and app directories (plus their app migrations). Platform files are never
edited downstream. If something forces you to edit a platform file, that is
an upstream bug: fix it in cubby and merge it down.

## Creating your deployment

1. Create your deployment repo (private is fine; naming it after your
   domain or instance works well). Prefer a shared-history clone over
   GitHub's "Use this template" button so `git merge upstream/main` works
   without `--allow-unrelated-histories`; the cubby-init skill
   (skills/cubby-init/SKILL.md, also `/cubby:init`) automates the whole
   thing: create if missing, clone, wire remotes, push.
2. Create a PocketHost instance (pockethost.io).
3. Edit `cubby.config.json`: name, title, instanceUrl (and domain if you
   have one; otherwise leave it equal to instanceUrl).
4. Follow the cubby-deploy skill (`skills/cubby-deploy/SKILL.md`) for
   OAuth consoles, AI keys, deploy secrets, and first-deploy verification.

## Tracking upstream

```
git remote add upstream https://github.com/patsissons/cubby.git
git fetch upstream
git merge upstream/main     # platform updates; conflicts should be rare
npm run build               # rebuild artifacts after merges
```

Because downstream repos only add files (apps, app migrations) and edit
`cubby.config.json`, merges are usually clean. If a merge conflicts anywhere
else, treat it as a signal that deployment state leaked into a platform file.
The cubby-update skill (skills/cubby-update/SKILL.md, also `/cubby:update`)
automates the full flow: preview, merge, conflict ownership rules, rebuild,
ship, and live verification.

## Contributing back

Foundation improvements, hook fixes, doc corrections: PR them to cubby from
a fork. Keep app-specific code out; the hello app is the only app that lives
upstream (it doubles as the integration test).
