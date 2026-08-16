---
name: cubby-init
description: Bootstrap a new cubby deployment repo. Creates the GitHub repo if it does not exist, clones the cubby template with shared git history, wires upstream and origin remotes, and pushes. Use when starting a brand new cubby deployment or system, before any instance setup; hand off to cubby-deploy afterward.
---

# Initializing a cubby deployment repo

This skill takes someone from "I want my own cubby" to a pushed deployment
repo with correct remotes. It creates and wires repos only; instance setup
(PocketHost, config, OAuth, keys) is the cubby-deploy skill, which this
hands off to.

## Gather these first

Ask the user for anything not already stated:

- **Repo name**: naming it after the deployment's domain or instance works
  well (e.g. `example.com`, `my-cubby`).
- **Visibility**: private by default; public is fine too.
- **Upstream cubby repo**: the platform repo to build on. Default
  `patsissons/cubby`; a fork of it also works.

## Prerequisites

```
gh auth status        # GitHub CLI authenticated
git --version
```

No `gh`? Have the user create the empty repo in the GitHub web UI instead,
then skip the `gh repo create` step below and use the same git commands.

## Why a shared-history clone (not the template button)

GitHub's "Use this template" button creates a repo with a fresh, unrelated
history. That breaks the upstream update flow (`git merge upstream/main`
refuses to merge unrelated histories). A plain clone of the platform repo
shares its history, so upstream merges stay clean forever. The template
button remains fine for people who never intend to pull platform updates;
everyone else should clone.

## Steps

Substitute OWNER/NAME (the new repo) and UPSTREAM (e.g. patsissons/cubby).

1. **Check the target repo.** If it already exists AND has commits, STOP and
   ask the user how to proceed; never push into a non-empty repo.

   ```
   gh repo view OWNER/NAME --json name,isEmpty 2>/dev/null
   ```

2. **Create it if missing** (add `--public` if the user chose public):

   ```
   gh repo create OWNER/NAME --private
   ```

3. **Clone the platform repo with its history and wire the remotes:**

   ```
   git clone https://github.com/UPSTREAM.git NAME
   cd NAME
   git remote rename origin upstream
   git remote add origin git@github.com:OWNER/NAME.git   # or the https URL, matching how the user authenticates
   ```

4. **Push:**

   ```
   git push -u origin main
   ```

5. **Verify:** `git remote -v` shows origin = the new repo, upstream = the
   platform repo, and the new repo's main matches upstream's.

Never force-push in this flow, and do not configure secrets, instances, or
domains here.

## If the repo was already created from the template button

Recoverable: add the upstream remote and do the first merge with
`git merge upstream/main --allow-unrelated-histories` (subsequent merges
are normal). Expect conflicts only if platform files were edited, which the
forkability rule forbids anyway.

## Hand off

The repo is ready. Continue with the cubby-deploy skill
(skills/cubby-deploy/SKILL.md): edit cubby.config.json, link the PocketHost
instance, first deploy, OAuth, keys, and CI secrets. Later platform updates:

```
git fetch upstream && git merge upstream/main && npm run build
```
