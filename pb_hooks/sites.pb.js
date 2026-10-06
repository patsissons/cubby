/// <reference path="../.pb/pb_data/types.d.ts" />
// Identity-scoped discovery cards: GET /_cubby/sites/scoped returns, in the
// sites.json entry shape, the apps whose cubby.json says "hidden": "access"
// and whose access.allowedUsers admits the signed-in caller (an empty list
// admits anyone signed in). Signed out, the list is empty. The discovery
// site merges these into the public cards from sites.json.
//
// Manifests are read live, so cubby.json stays the one source of truth for
// who sees a card; the build's pb_hooks/scoped-sites.json only supplies the
// first-seen `added` date. Never public and never shared by a cache: the
// response depends on the caller, and a scoped app's name is the secret.
routerAdd('GET', '/_cubby/sites/scoped', (e) => {
  const { parseAccess, parseVisibility, userAllowed } = require(`${__hooks}/lib/config.js`)
  e.response.header().set('Cache-Control', 'private, no-store')

  const email = e.auth ? e.auth.getString('email') : ''
  if (!email) return e.json(200, { sites: [] })

  const added = {}
  try {
    for (const site of JSON.parse(toString($os.readFile(`${__hooks}/scoped-sites.json`)))) {
      added[site.name] = site.added
    }
  } catch (err) {
    // not built yet: cards just carry no date
  }

  const sites = []
  for (const entry of $os.readDir(`${__hooks}/../pb_public`)) {
    if (!entry.isDir()) continue
    const name = entry.name()
    if (!/^[a-z0-9-]+$/.test(name)) continue
    let manifest
    try {
      manifest = JSON.parse(toString($os.readFile(`${__hooks}/../pb_public/${name}/cubby.json`)))
    } catch (err) {
      continue
    }
    if (parseVisibility(manifest) !== 'access') continue
    if (!userAllowed(parseAccess(manifest), email)) continue
    sites.push({
      name,
      title: String(manifest.title || name),
      description: String(manifest.description || ''),
      icon: String(manifest.icon || '🕳️'),
      category: String(manifest.category || ''),
      tags: Array.isArray(manifest.tags) ? manifest.tags.map(String) : [],
      added: added[name] || '',
    })
  }
  sites.sort((a, b) => a.title.localeCompare(b.title))
  return e.json(200, { sites })
})
