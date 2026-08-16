# cubby

A shelf of tiny web apps, each in its own cubby. One repo deploys to one
PocketHost (PocketBase) instance and hosts many static micro-apps: plain
html/js/css, no build step, served at `/<name>/`, with a shared foundation
providing database, file storage, OAuth login, AI chat, and multi-user rooms
through a single script tag.

```html
<script src="/js/foundation.js" defer></script>
<script>
  await cubby.ready
  await cubby.db.collection('scores').create({ points: 3 })
  await cubby.fs.write('save.json', JSON.stringify(state))
  await cubby.identity.login('github')
  const res = await cubby.ai.chat({ messages: [{ role: 'user', content: 'hi' }] })
  await cubby.rooms.room('lobby').join()
</script>
```

This repo doubles as the live demo: it deploys to
[cubby.pockethost.io](https://cubby.pockethost.io), where the root is a
discovery site listing its apps; try
[/hello/](https://cubby.pockethost.io/hello/) for every subsystem on one page.

## The two repos

**Fork cubby to develop and improve the foundation; create your own repo
from the template to launch your own micro-sites.** Contributions flow to
cubby; your apps live in your deployment repo. See
[docs/forking.md](docs/forking.md).

## Quickstart (local)

```
npm ci
npm run dev        # http://localhost:8090 (hello at /hello/, admin at /_/)
npm run seed       # optional demo data
npm run new-app foo
```

## Launch your own

1. Create an instance at [pockethost.io](https://pockethost.io) (any paid
   plan includes SFTP deploys and custom domains) and note its name:
   `<instance>.pockethost.io`.
2. In Claude Code, install the cubby plugin:

   ```
   /plugin marketplace add patsissons/cubby
   /plugin install cubby@cubby
   ```

3. Run `/cubby:init <you>/<repo>`. It creates the repo if needed, clones
   the platform with shared history (so upstream merges stay clean), fills
   `cubby.config.json` with your name, domain, and instance URL (inferring
   defaults from the repo name), and pushes.
4. In the new repo, run `/cubby:deploy`. It links the instance via phio,
   runs the first deploy (including the required instance power cycle),
   and verifies the discovery site, hooks, and collections.
5. Finish in the dashboards as the skill directs: AI provider keys, OAuth
   apps, GitHub secrets for CI deploys, and optionally a custom domain and
   the issue-to-PR pipeline. `/cubby:new-app` builds apps;
   `/cubby:update` pulls in platform updates later.

Prefer doing it by hand? The same steps live in
[skills/init/SKILL.md](skills/init/SKILL.md) and
[skills/deploy/SKILL.md](skills/deploy/SKILL.md).

## Layout

```
cubby.config.json       the one file a deployment edits
foundation/src/         cubby client source (esbuild -> pb_public/js/)
pb_public/<app>/        one directory per app (html/js/css + cubby.json)
pb_public/index.html    discovery site
pb_hooks/               AI proxy + rooms sweeper (PocketBase JSVM)
pb_migrations/          platform + app collections
scripts/                dev server, scaffolder, manifest, smoke test
skills/                 agent skills (init, deploy, new-app, update)
docs/                   architecture, new-app, forking, decisions
```

## Docs

- [docs/architecture.md](docs/architecture.md): how everything works, full
  API examples
- [docs/new-app.md](docs/new-app.md): the add-an-app checklist
- [docs/forking.md](docs/forking.md): template workflow and upstream merges
- [docs/decisions.md](docs/decisions.md): why things are the way they are

MIT licensed.
