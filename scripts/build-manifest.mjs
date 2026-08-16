// Generates pb_public/sites.json from every pb_public/*/cubby.json manifest,
// and copies the root cubby.config.json into pb_public/ so the foundation and
// server hooks read the same registry the repo declares.
import { readdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const publicDir = path.join(root, 'pb_public')

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
  })
}

sites.sort((a, b) => a.title.localeCompare(b.title))

writeFileSync(path.join(publicDir, 'sites.json'), JSON.stringify(sites, null, 2) + '\n')
copyFileSync(path.join(root, 'cubby.config.json'), path.join(publicDir, 'cubby.config.json'))

console.log(`sites.json: ${sites.length} app(s): ${sites.map((s) => s.name).join(', ') || '(none)'}`)
console.log('copied cubby.config.json into pb_public/')
