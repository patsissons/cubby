// Generates pb_public/sites.json from every pb_public/*/cubby.json manifest,
// and copies the root cubby.config.json into pb_public/ so the foundation and
// server hooks read the same registry the repo declares.
import { readdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const publicDir = path.join(root, 'pb_public')

// Carry forward first-seen dates from the committed manifest so `added`
// stays stable across rebuilds (new apps get stamped once).
let previous = {}
try {
  for (const site of JSON.parse(readFileSync(path.join(publicDir, 'sites.json'), 'utf8'))) {
    previous[site.name] = site
  }
} catch {
  previous = {}
}

const today = new Date().toISOString().slice(0, 10)

const sites = []
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
  if (manifest.hidden === true) continue

  sites.push({
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

writeFileSync(path.join(publicDir, 'sites.json'), JSON.stringify(sites, null, 2) + '\n')
copyFileSync(path.join(root, 'cubby.config.json'), path.join(publicDir, 'cubby.config.json'))

// OpenGraph tags need absolute URLs, so rewrite their origin from the
// deployment's domain. This is what keeps og:url/og:image correct in forks
// without anyone hand-editing platform files: the build they already run
// does it.
const config = JSON.parse(readFileSync(path.join(root, 'cubby.config.json'), 'utf8'))
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
    lines.push(
      `${site.title} is an app on ${siteName}, a shelf of tiny static web apps`,
      'served by one PocketBase instance. It is plain HTML/JS/CSS with',
      'hash routing (internal pages live at #/..., not real subpaths).' +
        (mods.length ? ` It loads the cubby modules: ${mods.join(', ')}.` : ''),
      '',
      '## Links',
      '',
      `- [Open the app](${base}/${site.name}/): ${site.description || site.title}`,
      `- [All apps on this instance](${base}/llms.txt): the site-wide index`
    )
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
console.log('copied cubby.config.json into pb_public/')
