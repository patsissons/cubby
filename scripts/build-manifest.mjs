// Generates pb_public/sites.json from every pb_public/*/cubby.json manifest,
// and copies the root cubby.config.json into pb_public/ so the foundation and
// server hooks read the same registry the repo declares.
import { readdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const publicDir = path.join(root, 'pb_public')
// Cards shown only to identities passing the app's access block
// ("hidden": "access"). Under pb_hooks/ so it deploys but is never served:
// sites.json is public, and these names must not leak through it.
const scopedPath = path.join(root, 'pb_hooks', 'scoped-sites.json')
const { parseVisibility, deploymentHosts, domainRuleProblems } = createRequire(import.meta.url)(
  '../pb_hooks/lib/config.js'
)
const config = JSON.parse(readFileSync(path.join(root, 'cubby.config.json'), 'utf8'))
// Domain-scoped "hidden" rules match these: the hosts the deployment is
// configured to answer on, so every built artifact agrees on them.
const hosts = deploymentHosts(config)

// Carry forward first-seen dates from the committed manifests so `added`
// stays stable across rebuilds (new apps get stamped once), including when
// an app moves between the public and scoped lists.
const previous = {}
for (const file of [path.join(publicDir, 'sites.json'), scopedPath]) {
  try {
    for (const site of JSON.parse(readFileSync(file, 'utf8'))) previous[site.name] = site
  } catch {
    // first build, or the file is missing: new apps get stamped today
  }
}

const today = new Date().toISOString().slice(0, 10)

// Hidden declarations (cubby.json "hidden"): absent/false is a public card,
// true is no card, "access" is a card only for identities passing the app's
// access block, and { on, except } decides by the deployment's domain. The
// server treats anything else as hidden, so a typo would
// quietly drop a card; name it here instead. Checked before sites.json is
// written so a failed build cannot drop an app's carried-forward `added`.
{
  const problems = []
  for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const manifestPath = path.join(publicDir, entry.name, 'cubby.json')
    if (!existsSync(manifestPath)) continue
    let manifest = {}
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    } catch {
      continue // reported below by the manifest pass
    }
    const hidden = manifest.hidden
    if (hidden === undefined || hidden === null || typeof hidden === 'boolean') continue
    if (typeof hidden === 'object' && !Array.isArray(hidden)) {
      for (const problem of domainRuleProblems(hidden)) problems.push(`${entry.name}: "hidden" ${problem}`)
    } else if (hidden !== 'access') {
      problems.push(
        `${entry.name}: "hidden" must be true, false, "access" or { "on", "except" } (got ${JSON.stringify(hidden)})`
      )
    } else if (manifest.access === undefined || manifest.access === null) {
      problems.push(`${entry.name}: "hidden": "access" needs an "access" block naming who sees the card`)
    }
  }
  if (problems.length) {
    console.error(`invalid "hidden" flag:\n  ${problems.join('\n  ')}`)
    process.exit(1)
  }
}

const sites = []
const scoped = []
const hiddenByDomain = []
for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  // Underscore-prefixed directories are hidden from the manifest by convention.
  if (entry.name.startsWith('_')) continue
  const manifestPath = path.join(publicDir, entry.name, 'cubby.json')
  if (!existsSync(manifestPath)) continue

  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    console.error(`invalid JSON in ${manifestPath}: ${err.message}`)
    process.exit(1)
  }
  const visibility = parseVisibility(manifest, hosts)
  if (visibility === 'hidden') {
    if (manifest.hidden && typeof manifest.hidden === 'object') hiddenByDomain.push(entry.name)
    continue
  }

  const list = visibility === 'access' ? scoped : sites
  list.push({
    name: entry.name,
    title: manifest.title || entry.name,
    description: manifest.description || '',
    icon: manifest.icon || '🕳️',
    category: manifest.category || '',
    tags: Array.isArray(manifest.tags) ? manifest.tags.map(String) : [],
    added: previous[entry.name]?.added || today,
  })
}

sites.sort((a, b) => a.title.localeCompare(b.title))
scoped.sort((a, b) => a.title.localeCompare(b.title))

writeFileSync(path.join(publicDir, 'sites.json'), JSON.stringify(sites, null, 2) + '\n')
writeFileSync(scopedPath, JSON.stringify(scoped, null, 2) + '\n')
copyFileSync(path.join(root, 'cubby.config.json'), path.join(publicDir, 'cubby.config.json'))

// OpenGraph tags need absolute URLs, so rewrite their origin from the
// deployment's domain. This is what keeps og:url/og:image correct in forks
// without anyone hand-editing platform files: the build they already run
// does it.
const origin = String(config.domain || config.instanceUrl || '').replace(/\/+$/, '')
const siteName = String(config.title || config.name || 'Cubby')
if (origin) {
  const pages = [path.join(publicDir, 'index.html')]
  for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(path.join(publicDir, entry.name, 'index.html'))) {
      pages.push(path.join(publicDir, entry.name, 'index.html'))
    }
  }
  let rewritten = 0
  for (const page of pages) {
    const html = readFileSync(page, 'utf8')
    const updated = html
      .replace(/(property="og:(?:url|image)"\s+content=")https?:\/\/[^/"]+/g, `$1${origin}`)
      .replace(/(property="og:site_name"\s+content=")[^"]*/g, `$1${siteName}`)
    if (updated !== html) {
      writeFileSync(page, updated)
      rewritten++
    }
  }
  if (rewritten) console.log(`rewrote og origins/site_name for ${rewritten} page(s)`)
}

// Permalink declarations (cubby.json "permalink") make the server rewrite
// the app's OG tags in place per record, so the tags must exist to rewrite.
// Fail the build naming the app rather than shipping pages that silently
// unfurl with nothing.
{
  const requiredTags = [
    ['<title>', /<title>[^<]*<\/title>/],
    ['og:title', /property="og:title"\s+content="/],
    ['og:description', /property="og:description"\s+content="/],
    ['og:url', /property="og:url"\s+content="/],
    ['og:image', /property="og:image"\s+content="/],
    ['meta description', /name="description"\s+content="/],
  ]
  const problems = []
  for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const manifestPath = path.join(publicDir, entry.name, 'cubby.json')
    if (!existsSync(manifestPath)) continue
    let manifest = {}
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    } catch {
      continue // already reported above for visible apps
    }
    if (!manifest.permalink?.collection) continue
    const page = path.join(publicDir, entry.name, 'index.html')
    const html = existsSync(page) ? readFileSync(page, 'utf8') : ''
    for (const [label, re] of requiredTags) {
      if (!re.test(html)) problems.push(`${entry.name}: missing ${label}`)
    }
  }
  if (problems.length) {
    console.error(
      `apps declaring a permalink must ship the full OG tag block in index.html ` +
        `(copy it from pb_public/hello/index.html):\n  ${problems.join('\n  ')}`
    )
    process.exit(1)
  }
}

// MCP declarations (cubby.json "mcp": { "enabled": true }) are served by
// pb_hooks/mcp.pb.js from pb_hooks/apps/<slug>/mcp.js. Tools live in code
// so schema and handler cannot drift; an enabled app without the module
// would 500 on every call, so fail the build naming the app instead.
{
  const missing = []
  for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const manifestPath = path.join(publicDir, entry.name, 'cubby.json')
    if (!existsSync(manifestPath)) continue
    let manifest = {}
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    } catch {
      continue // already reported above for visible apps
    }
    if (manifest.mcp?.enabled !== true) continue
    const module = path.join(root, 'pb_hooks', 'apps', entry.name, 'mcp.js')
    if (!existsSync(module)) missing.push(`${entry.name}: pb_hooks/apps/${entry.name}/mcp.js`)
  }
  if (missing.length) {
    console.error(
      `apps declaring "mcp": { "enabled": true } must ship a tool module ` +
        `(see pb_hooks/apps/hello/mcp.js):\n  ${missing.join('\n  ')}`
    )
    process.exit(1)
  }
}

// Access declarations (cubby.json "access": { "allowedUsers": [globs] })
// put an app behind identity: the agent-readable content endpoint and the
// MCP read_app tool withhold it entirely. The server fails closed on a
// malformed block, so reject one here and name the app rather than ship a
// typo that gates (or looks like it should gate) the wrong way.
const gated = new Set()
{
  const problems = []
  for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const manifestPath = path.join(publicDir, entry.name, 'cubby.json')
    if (!existsSync(manifestPath)) continue
    let manifest = {}
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    } catch {
      continue // already reported above for visible apps
    }
    const access = manifest.access
    if (access === undefined || access === null) continue
    gated.add(entry.name)
    if (typeof access !== 'object' || Array.isArray(access)) {
      problems.push(`${entry.name}: "access" must be an object`)
      continue
    }
    for (const key of Object.keys(access)) {
      if (key !== 'allowedUsers') problems.push(`${entry.name}: unknown access key "${key}"`)
    }
    const users = access.allowedUsers
    if (users !== undefined && !(Array.isArray(users) && users.every((u) => typeof u === 'string' && u))) {
      problems.push(`${entry.name}: access.allowedUsers must be an array of email globs`)
    }
  }
  if (problems.length) {
    console.error(
      `invalid "access" block (expected { "allowedUsers": ["me@x.com", "*@corp.com"] }):\n  ${problems.join('\n  ')}`
    )
    process.exit(1)
  }
}

// Agent-readable content: pages render in the browser, so an agent that
// curls one gets an empty shell. Every open page carries two build-owned
// pointers at its server-rendered snapshot (pb_hooks/content.pb.js), both
// tagged data-cubby-content:
//   - <link rel="alternate" type="text/markdown"> before </head>, for
//     clients that read link relations;
//   - <noscript> right after <body>, for fetchers that turn HTML into text
//     and drop <head>. Fetchers run no JS, so they treat noscript as
//     content, and browsers hide it. It also spells out the deep-link rule
//     (/<app>/#/<route> -> /_cubby/content/<app>/<route>), since a fragment
//     never reaches the server.
// Both are stripped and re-inserted every run, so they stay byte-stable and
// disappear from apps behind identity. Relative hrefs, so this runs without
// a domain. The snapshot converter drops noscript, so the hint never shows
// up inside a snapshot.
{
  const linkRe = /\n?[ \t]*<link rel="alternate" type="text\/markdown" href="[^"]*" data-cubby-content \/>/g
  const noscriptRe = /\n?[ \t]*<noscript data-cubby-content>[\s\S]*?<\/noscript>/g
  /** slug: an app, '' for the root page, null to strip (gated) */
  const apply = (page, slug) => {
    const html = readFileSync(page, 'utf8')
    let updated = html.replace(linkRe, '').replace(noscriptRe, '')
    if (slug !== null) {
      const href = slug ? `/_cubby/content/${slug}` : '/_cubby/content'
      const link = `<link rel="alternate" type="text/markdown" href="${href}" data-cubby-content />`
      const hint = slug
        ? `This page renders with JavaScript. Read it as markdown at <a href="${href}">${href}</a>. ` +
          `For a deep link /${slug}/#/&lt;route&gt;, fetch ${href}/&lt;route&gt;.`
        : `This page renders with JavaScript. Read the app list as markdown at <a href="${href}">${href}</a>. ` +
          `Any app reads the same way at /_cubby/content/&lt;app&gt;, and its deep link ` +
          `/&lt;app&gt;/#/&lt;route&gt; at /_cubby/content/&lt;app&gt;/&lt;route&gt;.`
      updated = updated
        .replace(/\n?( *)<\/head>/, `\n$1  ${link}\n$1</head>`)
        .replace(/( *)(<body\b[^>]*>)/, `$1$2\n$1  <noscript data-cubby-content><p>${hint}</p></noscript>`)
    }
    if (updated === html) return false
    writeFileSync(page, updated)
    return true
  }
  let linked = 0
  if (apply(path.join(publicDir, 'index.html'), '')) linked++
  for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-z0-9-]+$/.test(entry.name)) continue
    const page = path.join(publicDir, entry.name, 'index.html')
    if (!existsSync(page) || !existsSync(path.join(publicDir, entry.name, 'cubby.json'))) continue
    if (apply(page, gated.has(entry.name) ? null : entry.name)) linked++
  }
  if (linked) console.log(`updated content links in ${linked} page(s)`)
}

// JSON-LD (schema.org): the discovery site advertises a WebSite plus an
// ItemList of visible apps; each visible app advertises a WebApplication
// built from its cubby.json. The build owns exactly one block per page,
// tagged data-cubby-jsonld -- replaced in place every run, appended before
// </head> when absent -- so hand-written JSON-LD without the attribute is
// never touched. Gated on origin like the og rewrite: structured data with
// relative URLs helps nobody.
if (origin) {
  const blockRe = /<script type="application\/ld\+json" data-cubby-jsonld>[\s\S]*?<\/script>/
  // Single-line JSON with </ escaped so a description containing </script>
  // cannot terminate the tag early.
  const serialize = (obj) =>
    `<script type="application/ld+json" data-cubby-jsonld>${JSON.stringify(obj).replace(/<\//g, '<\\/')}</script>`

  const inject = (page, obj) => {
    const html = readFileSync(page, 'utf8')
    const tag = serialize(obj)
    const updated = blockRe.test(html)
      ? html.replace(blockRe, tag)
      : html.replace(/\n?( *)<\/head>/, `\n$1  ${tag}\n$1</head>`)
    if (updated === html) return false
    writeFileSync(page, updated)
    return true
  }

  let injected = 0
  const rootJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: siteName, url: `${origin}/` },
      {
        '@type': 'ItemList',
        itemListElement: sites.map((site, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'WebApplication',
            name: site.title,
            description: site.description,
            url: `${origin}/${site.name}/`,
          },
        })),
      },
    ],
  }
  if (inject(path.join(publicDir, 'index.html'), rootJsonLd)) injected++

  for (const site of sites) {
    const page = path.join(publicDir, site.name, 'index.html')
    if (!existsSync(page)) continue
    const obj = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: site.title,
      description: site.description,
      url: `${origin}/${site.name}/`,
    }
    if (site.category) obj.applicationCategory = site.category
    if (site.tags.length) obj.keywords = site.tags.join(', ')
    obj.isPartOf = { '@type': 'WebSite', name: siteName, url: `${origin}/` }
    if (inject(page, obj)) injected++
  }
  if (injected) console.log(`injected JSON-LD into ${injected} page(s)`)
}

// llms.txt (llmstxt.org): a markdown index for LLM crawlers. The root file
// lists every visible app plus the platform; each visible app gets one
// generated from its cubby.json. Generated files end with a marker comment;
// a file without the marker is hand-written and never touched, so an app
// opts out by deleting the marker (or committing its own file first). Pure
// function of cubby.json + config, so rebuilds are byte-stable.
{
  const marker =
    '<!-- generated by cubby (npm run build): edit cubby.json and rebuild, or delete this comment to hand-maintain this file -->'
  // Unlike JSON-LD, llms.txt degrades gracefully without a domain: relative
  // links are still valid markdown for whoever fetched the file.
  const base = origin

  const writeLlms = (file, content) => {
    const body = `${content}\n\n${marker}\n`
    if (existsSync(file)) {
      const current = readFileSync(file, 'utf8')
      if (!current.includes('<!-- generated by cubby')) return 'kept'
      if (current === body) return 'unchanged'
    }
    writeFileSync(file, body)
    return 'written'
  }

  // Which cubby bundles the app loads, read from its script tags with any
  // ?v= stamp stripped so stamping never changes llms.txt output.
  const modulesOf = (name) => {
    const page = path.join(publicDir, name, 'index.html')
    if (!existsSync(page)) return []
    const mods = []
    for (const match of readFileSync(page, 'utf8').matchAll(
      /<script\b[^>]*\bsrc="\/js\/([a-z]+)\.js(?:\?[^"]*)?"/g
    )) {
      mods.push(match[1])
    }
    return mods
  }

  let written = 0
  let kept = 0
  for (const site of sites) {
    const mods = modulesOf(site.name)
    const lines = [`# ${site.title}`, '', `> ${site.description || site.title}`, '']
    if (site.category) lines.push(`- Category: ${site.category}`)
    if (site.tags.length) lines.push(`- Tags: ${site.tags.join(', ')}`)
    if (site.category || site.tags.length) lines.push('')
    const isGated = gated.has(site.name)
    lines.push(
      `${site.title} is an app on ${siteName}, a shelf of tiny static web apps`,
      'served by one PocketBase instance. It is plain HTML/JS/CSS with',
      'hash routing (internal pages live at #/..., not real subpaths).' +
        (mods.length ? ` It loads the cubby modules: ${mods.join(', ')}.` : ''),
      '',
      isGated
        ? 'This app requires sign-in; its content is not available to agents.'
        : 'Parts of the page may render in the browser, so its HTML can be an empty shell. The markdown snapshot below is what it shows, readable without running JavaScript.',
      '',
      '## Links',
      '',
      `- [Open the app](${base}/${site.name}/): ${site.description || site.title}`
    )
    if (!isGated) {
      lines.push(
        `- [Page content as markdown](${base}/_cubby/content/${site.name}): what the page renders, for agents that cannot run JavaScript`,
        `- Deep links: for a page URL ${base}/${site.name}/#/<route>, fetch ${base}/_cubby/content/${site.name}/<route> (404 route_not_found when the app has no content for that view)`
      )
    }
    lines.push(`- [All apps on this instance](${base}/llms.txt): the site-wide index`)
    const result = writeLlms(path.join(publicDir, site.name, 'llms.txt'), lines.join('\n'))
    if (result === 'written') written++
    if (result === 'kept') kept++
  }

  const summary = String(
    config.description ||
      `${siteName} hosts a shelf of tiny static web apps on one PocketBase instance; each app is a directory of plain HTML/JS/CSS served at its own path.`
  )
  const rootLines = [
    `# ${siteName}`,
    '',
    `> ${summary}`,
    '',
    'Every app is a single page with hash routing: deep links look like',
    '/name/#/page. Unknown paths fall back to the discovery site at /.',
    '',
    'Pages render in the browser, so fetching an app\'s HTML returns little more',
    `than its shell. Fetch ${base}/_cubby/content/<app> instead for a markdown`,
    'snapshot of what the page shows (apps that require sign-in return 403).',
    'A deep link /<app>/#/<route> is one view of an app: the fragment never',
    `reaches a server, so fetch ${base}/_cubby/content/<app>/<route> instead`,
    '(404 route_not_found when the app has no content for that view).',
    '',
    '## Apps',
    '',
    ...sites.map(
      (site) =>
        `- [${site.title}](${base}/${site.name}/): ${site.description || site.title} ([details](${base}/${site.name}/llms.txt))`
    ),
    '',
    '## Platform',
    '',
    `- [Discovery site](${base}/): searchable index of every app`,
    `- [App registry](${base}/sites.json): machine-readable manifest (name, title, description, category, tags)`,
    `- [Site content as markdown](${base}/_cubby/content): the discovery site's app list, rendered server-side`,
    `- MCP: POST ${base}/_cubby/mcp (Streamable HTTP, operator bearer token): read-only tools including read_app, which returns the same markdown snapshots`,
    '',
    'Apps are built on the cubby foundation, layered browser bundles: /js/core.js',
    '(namespace, errors, design tokens; no backend), /js/platform.js (PocketBase',
    'db/fs/identity/ai/rooms), and opt-in widgets (markdown, editor, nav,',
    'preview, draw, graph). cubby is an open template; deployments fork it and',
    'add apps without touching platform code.',
  ]
  const rootResult = writeLlms(path.join(publicDir, 'llms.txt'), rootLines.join('\n'))
  if (rootResult === 'written') written++
  if (rootResult === 'kept') kept++
  console.log(`llms.txt: ${written} generated, ${kept} hand-written kept`)
}

// Stamp js/css references with a content hash (?v=xxxxxxxx). The PocketHost
// CDN caches pb_public ~4h per URL, and index.html and its assets expire
// independently — without stamps a fresh page can load stale scripts (or
// vice versa) and appear broken for hours after a deploy. With stamps,
// changed assets get new URLs immediately; a stale page keeps referencing
// the old URLs, so viewers see a coherent previous version at worst.
// Idempotent: existing ?v= stamps are replaced, so rebuilds don't drift.
{
  const pages = [path.join(publicDir, 'index.html')]
  for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(path.join(publicDir, entry.name, 'index.html'))) {
      pages.push(path.join(publicDir, entry.name, 'index.html'))
    }
  }
  let stamped = 0
  /** @type {string[]} same-origin refs pointing at files that do not exist */
  const missing = []
  for (const page of pages) {
    const dir = path.dirname(page)
    const html = readFileSync(page, 'utf8')
    // Anchored to real <script>/<link> tags so escaped examples inside
    // <pre><code> blocks (&lt;script src="..."&gt;) are left alone.
    const updated = html.replace(
      /(<(?:script|link)\b[^>]*?(?:src|href)=")([^"?#]+?\.(?:js|css))(?:\?v=[0-9a-f]+)?(")/g,
      (match, pre, ref, post) => {
        if (/^(?:https?:)?\/\//.test(ref)) return match
        const file = ref.startsWith('/') ? path.join(publicDir, ref) : path.join(dir, ref)
        // A same-origin ref with no file behind it is a 404 in production and
        // used to pass silently. With one bundle that was a typo you would
        // notice; with a bundle per feature it is a tag pointing at a module
        // nobody built, so fail the build and name it.
        if (!existsSync(file)) {
          missing.push(`${path.relative(publicDir, page)} -> ${ref}`)
          return match
        }
        const hash = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8)
        return `${pre}${ref}?v=${hash}${post}`
      }
    )
    if (updated !== html) {
      writeFileSync(page, updated)
      stamped++
    }
  }
  if (missing.length) {
    console.error(`missing asset(s) referenced by a <script>/<link> tag:\n  ${missing.join('\n  ')}`)
    process.exit(1)
  }
  if (stamped) console.log(`stamped asset versions in ${stamped} page(s)`)
}

console.log(`sites.json: ${sites.length} app(s): ${sites.map((s) => s.name).join(', ') || '(none)'}`)
if (scoped.length) console.log(`scoped-sites.json: ${scoped.length} identity-scoped app(s)`)
if (hiddenByDomain.length) {
  console.log(`hidden on ${hosts.join(', ') || '(no configured domain)'}: ${hiddenByDomain.join(', ')}`)
}
console.log('copied cubby.config.json into pb_public/')
