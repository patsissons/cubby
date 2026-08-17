// Generates pb_public/sites.json from every pb_public/*/cubby.json manifest,
// and copies the root cubby.config.json into pb_public/ so the foundation and
// server hooks read the same registry the repo declares.
import { readdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
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
if (origin) {
  const pages = [path.join(publicDir, 'index.html')]
  for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(path.join(publicDir, entry.name, 'index.html'))) {
      pages.push(path.join(publicDir, entry.name, 'index.html'))
    }
  }
  const siteName = String(config.title || config.name || 'Cubby')
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

console.log(`sites.json: ${sites.length} app(s): ${sites.map((s) => s.name).join(', ') || '(none)'}`)
console.log('copied cubby.config.json into pb_public/')
