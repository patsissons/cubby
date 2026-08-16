---
name: update
argument-hint: "[--upstream owner/repo]"
description: Pull the latest cubby platform updates from upstream into a deployment repo and roll them out to the deployed instance. Use when asked to update or upgrade a cubby deployment, adopt foundation/platform changes from upstream, sync a deployment with the template repo, or when upstream has features or fixes a deployed app needs.
---

# Updating a deployment from upstream

Merges upstream platform changes (foundation, hooks, platform migrations,
discovery site, skills, docs) into a deployment repo, rebuilds artifacts
against the deployment's own config, and ships them to the instance.

## Preconditions

- Working from the deployment repo root with a clean tree (commit or stash
  first; never merge onto uncommitted work).
- The upstream remote exists (`git remote -v`). If missing:
  `git remote add upstream https://github.com/patsissons/cubby.git`
  (or the fork this deployment builds on).
- Know how this deployment ships: CI deploy on push (PHIO_* secrets set) or
  local `npm run deploy`.

## Steps

1. **Preview what is coming:**

   ```
   git fetch upstream
   git log --oneline main..upstream/main
   git diff main...upstream/main -- docs/decisions.md docs/architecture.md
   ```

   The decisions/architecture diffs are where breaking changes, renames,
   and new conventions are announced; read them before merging. Nothing to
   merge? Stop here and say so.

2. **Merge:**

   ```
   git merge upstream/main
   ```

   Repo created with GitHub's template button instead of a shared-history
   clone? The first merge (only) needs `--allow-unrelated-histories`; see
   the init skill.

3. **Resolve conflicts by ownership.** Conflicts should be rare and almost
   always mean one of these three cases:

   | Path | Resolution |
   |---|---|
   | `cubby.config.json` (repo root) | Keep the deployment's identity values (name, title, domain, instanceUrl, oauthProviders) AND its model selection: entries the deployment removed stay removed, entries it added stay. From upstream adopt structure only: new config keys, refreshed ids for `ai.models` entries the deployment kept, additions to reservedNames. |
   | `pb_public/js/*`, `pb_public/sites.json`, `pb_public/cubby.config.json` | Build artifacts (the root `cubby.config.json` is NOT one; see the row above): take either side, step 4 regenerates them. |
   | `pb_public/<your apps>/`, `pb_migrations/*_app_*` | Keep the deployment's; upstream never touches them. |
   | Any other platform file | Take upstream. A genuine conflict here means platform edits leaked into the deployment (forkability violation): adopt upstream now, port the local change to a cubby PR later. |

   `git add` each resolved file; the merge concludes with the single commit
   in step 4, which also carries the rebuilt artifacts.

4. **Rebuild and verify locally:**

   ```
   npm ci
   npm run build
   ```

   `npm run build` regenerates the foundation bundle, `sites.json`, and the
   pb_public config copy from the deployment's own `cubby.config.json`.
   Spot-check with `npm run dev` (discovery site + one app), and for
   foundation-heavy updates run `node scripts/smoke.mjs` against the dev
   server. If the preview showed API changes, sweep the deployment's apps
   for affected `cubby.*` calls before shipping.

   Commit the merge with the rebuilt artifacts included (CI fails on
   artifact drift).

5. **Ship:** `git push origin main` (CI deploys), or `npm run deploy` for a
   direct local deploy.

6. **Verify live** (matters most when pb_hooks or pb_migrations changed):

   ```
   curl https://<instance>/_cubby/cron/sweep        # hooks loaded
   curl "https://<instance>/js/foundation.js?v=check" | head -c 80   # fresh bundle
   ```

   Use a cache-busting query when checking static files: the CDN caches
   pb_public for up to 4 hours, so the bare URL may serve the previous
   deploy (users may see it that long too; API routes and hooks are not
   cached).

   Plus migration effects: a new collection responds at
   `/api/collections/<name>/records` instead of 404, and a field added to
   an existing collection shows up as a key in record JSON
   (`/api/collections/<name>/records?perPage=1`; if the collection is
   empty, check the schema in the admin UI). If hook or migration changes
   are not visible, power the instance off and on in the PocketHost
   dashboard; deploys do not always trigger the restart.

## Notes

- Upstream platform migrations are additive and apply automatically when
  the instance restarts; deploys never touch pb_data.
- Do not update by cherry-picking or copying files from upstream; always
  merge, so the next update stays clean.
