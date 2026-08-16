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

## Step 0: assess state, then resume at the right step

The flow is resumable: any part may already be done (repo pre-created in the
web UI, a directory made for the session, a previous partial run).
Substitute OWNER/NAME (the new repo) and UPSTREAM (e.g. patsissons/cubby),
then check both sides:

```
gh repo view OWNER/NAME --json name,isEmpty 2>/dev/null   # remote state
ls -A NAME 2>/dev/null; git -C NAME remote -v 2>/dev/null # local state
```

Resume rules:

| Remote | Action |
|---|---|
| missing | do step 1 |
| exists, empty | skip step 1 |
| exists, has commits sharing history with UPSTREAM | already pushed: ensure a local clone and both remotes exist, then hand off. No local repo yet? Clone the new repo itself, add the upstream remote, fetch, then run the shared-history test |
| exists, has unrelated commits | STOP and ask; never push into it |

| Local NAME directory | Action |
|---|---|
| missing | step 2 (clone) |
| exists, empty or only local dotfiles (.claude/, .DS_Store) | step 2b (init in place) |
| exists, git repo whose main shares history with UPSTREAM | keep it: add any missing remote, then step 3 |
| exists, anything else (unrelated content, uncommitted work, non-cubby repo) | STOP and ask |

To test shared history: `git merge-base main upstream/main` succeeds (after
`git fetch upstream`). When both tables apply, run only what is still
missing; step 3's push is a no-op to skip when origin/main already matches
local main, in which case go straight to step 4 and hand off.

## Steps

1. **Create the repo if missing** (add `--public` if the user chose public):

   ```
   gh repo create OWNER/NAME --private
   ```

2. **Clone the platform repo with its history and wire the remotes:**

   ```
   git clone https://github.com/UPSTREAM.git NAME
   cd NAME
   git remote rename origin upstream
   git remote add origin git@github.com:OWNER/NAME.git
   ```

   SSH vs https for origin: match how the user's other GitHub clones
   authenticate (`git -C <some existing repo> remote get-url origin`);
   if there is nothing to match, ask.

   **2b. Directory already exists (empty or dotfiles only):** clone refuses
   a non-empty directory, so init in place. Untracked files survive the
   reset as long as the platform repo tracks no colliding paths, which
   holds for the dotfiles this row allows (.claude/, .DS_Store):

   ```
   cd NAME
   git init -b main
   git remote add upstream https://github.com/UPSTREAM.git
   git fetch upstream
   git reset --hard upstream/main
   git remote add origin git@github.com:OWNER/NAME.git
   ```

3. **Push** (safe to re-run; also the resume point when only the push is
   missing):

   ```
   git push -u origin main
   ```

4. **Verify:** `git remote -v` shows origin = the new repo, upstream = the
   platform repo; `git status` is clean; `git log origin/main -1` matches
   upstream's main.

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
