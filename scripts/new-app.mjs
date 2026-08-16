// Scaffolds a new app: copies pb_public/_template to pb_public/<name>,
// personalizes its manifest, and regenerates sites.json.
// Usage: npm run new-app <name> [-- --title "My App" --description "..." --icon "🎯"]
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const config = JSON.parse(readFileSync(path.join(root, 'cubby.config.json'), 'utf8'))

const args = process.argv.slice(2)
const name = args[0]

function flag(label) {
  const i = args.indexOf(`--${label}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : undefined
}

if (!name) {
  console.error('usage: npm run new-app <name> [-- --title "My App" --description "..." --icon "🎯"]')
  process.exit(1)
}

if (!/^[a-z0-9-]+$/.test(name)) {
  console.error(`invalid app name "${name}": must match [a-z0-9-]+`)
  process.exit(1)
}

const reserved = config.reservedNames || []
if (reserved.includes(name)) {
  console.error(`"${name}" is a reserved name: ${reserved.join(', ')}`)
  process.exit(1)
}

const target = path.join(root, 'pb_public', name)
if (existsSync(target)) {
  console.error(`pb_public/${name}/ already exists`)
  process.exit(1)
}

cpSync(path.join(root, 'pb_public', '_template'), target, { recursive: true })

const title = flag('title') || name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const manifest = {
  name,
  title,
  description: flag('description') || `The ${title} app.`,
  icon: flag('icon') || '🕳️',
}
writeFileSync(path.join(target, 'cubby.json'), JSON.stringify(manifest, null, 2) + '\n')

const html = path.join(target, 'index.html')
writeFileSync(html, readFileSync(html, 'utf8').replaceAll('Template', title))

const { spawnSync } = await import('node:child_process')
spawnSync(process.execPath, [path.join(root, 'scripts', 'build-manifest.mjs')], { stdio: 'inherit' })

console.log(`created pb_public/${name}/ - serve it at /${name}/ with npm run dev`)
