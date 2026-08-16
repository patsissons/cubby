---
name: init
argument-hint: <owner/name> [--public] [--upstream owner/repo]
description: Bootstrap a new cubby deployment repo. Creates the GitHub repo if it does not exist, clones the cubby template with shared git history, wires upstream and origin remotes, configures cubby.config.json for the deployment (name, domain, instance URL), and pushes. Use when starting a brand new cubby deployment or system, before any instance setup; hand off to the deploy skill afterward.
---

# Initializing a cubby deployment repo

This skill takes someone from "I want my own cubby" to a pushed deployment
repo with correct remotes and a cubby.config.json that already describes
their deployment. Instance-side setup (PocketHost secrets, OAuth, first
deploy) is the deploy skill, which this hands off to.

## Gather these first

Infer defaults from the repo/directory name NAME, present them to the user
for confirmation in one shot, and only ask about the ones they want to
change. SLUG below means NAME lowercased with every character outside
[a-z0-9-] replaced by "-" (so `example.com` becomes `example-com`).

- **Repo name (NAME)**: naming it after the deployment's domain or instance
  works well (e.g. `example.com`, `my-cubby`). No default; required.
- **Visibility**: private by default; public is fine too.
- **Upstream cubby repo**: the platform repo to build on. Default
  `patsissons/cubby`; a fork of it also works.
- **Deployment name**: config `name`. Default SLUG.
- **Title**: config `title`. Domain-like NAME (the same contains-a-dot
  test as Domain below) stays as-is (`example.com`); otherwise hyphens
  become spaces, title cased (`my-cubby` -> `My Cubby`).
- **PocketHost instance name**: default SLUG. If phio is authenticated,
  check `npx phio list`: an instance named exactly SLUG confirms the
  default; no such instance means ask the user which listed instance to
  use (or whether one still needs creating) instead of guessing. The
  instance URL is `https://<instance>.pockethost.io`.
- **Domain**: config `domain`. If NAME looks like a domain (contains a
  dot), default `https://NAME`; otherwise default to the instance URL (the
  convention for no custom domain).

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
| exists, has commits sharing history with UPSTREAM | already pushed: ensure a local clone and both remotes exist; if cubby.config.json is not configured, run steps 3 and 4 (the configure commit must be pushed too); then step 5 and hand off. No local repo yet? Clone the new repo itself, add the upstream remote, fetch, then run the shared-history test |
| exists, has unrelated commits | STOP and ask; never push into it |

| Local NAME directory | Action |
|---|---|
| missing | step 2 (clone) |
| exists, empty or only local dotfiles (.claude/, .DS_Store) | step 2b (init in place) |
| exists, git repo whose main shares history with UPSTREAM | keep it: add any missing remote, then step 3 |
| exists, anything else (unrelated content, uncommitted work, non-cubby repo) | STOP and ask |

To test shared history: `git merge-base main upstream/main` succeeds (after
`git fetch upstream`). When both tables apply, run only what is still
missing: skip step 3 when cubby.config.json already holds the deployment's
values (not the upstream template's), and skip step 4's push when
origin/main already matches local main.

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

   SSH vs https for origin (applies to 2b as well): match how the user's
   other GitHub clones authenticate
   (`git -C <some existing repo> remote get-url origin`); if there is
   nothing to match, ask.

   **2b. Directory already exists (empty or dotfiles only):** clone refuses
   a non-empty directory, so init in place. `git reset --hard` silently
   overwrites untracked files at paths upstream tracks, so confirm the
   collision set is empty first: `git ls-tree upstream/main .claude
   .DS_Store` (after the fetch) must print nothing.

   ```
   cd NAME
   git init -b main
   git remote add upstream https://github.com/UPSTREAM.git
   git fetch upstream
   git reset --hard upstream/main
   git remote add origin git@github.com:OWNER/NAME.git
   ```

3. **Configure the deployment.** Edit `cubby.config.json` (repo root) with
   the confirmed values: `name`, `title`, `domain`, `instanceUrl`. Leave
   `oauthProviders`, `ai`, and `reservedNames` as upstream ships them
   unless the user asked otherwise. Then rebuild so the served copy and
   manifest match, and commit:

   ```
   npm ci
   npm run build
   git add -A && git commit -m "Configure deployment: <config name value>"
   ```

4. **Push** (safe to re-run; also the resume point when only the push is
   missing):

   ```
   git push -u origin main
   ```

5. **Verify:** `git remote -v` shows origin = the new repo, upstream = the
   platform repo; `git status` is clean; origin/main matches local main;
   and `cubby.config.json` plus its `pb_public/` copy both show the
   deployment's instanceUrl, not the upstream template's.

Never force-push in this flow, and do not configure secrets or provision
instances here (DNS and dashboards belong to the deploy skill).

## If the repo was already created from the template button

Recoverable: add the upstream remote and do the first merge with
`git merge upstream/main --allow-unrelated-histories` (subsequent merges
are normal). Expect conflicts only if platform files were edited, which the
forkability rule forbids anyway.

## Hand off

The repo is ready and configured. Continue with the deploy skill
(skills/deploy/SKILL.md): link the PocketHost instance, first deploy,
OAuth, keys, and CI secrets. Later platform updates:

```
git fetch upstream && git merge upstream/main && npm run build
```
