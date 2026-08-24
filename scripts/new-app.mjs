// Scaffolds a new app: copies pb_public/_template to pb_public/<name>,
// personalizes its manifest, and regenerates sites.json.
// Usage: npm run new-app <name> [-- --title "My App" --description "..." --icon "🎯"
//                                  --modules markdown,editor,nav]
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const config = JSON.parse(readFileSync(path.join(root, 'cubby.config.json'), 'utf8'))

const args = process.argv.slice(2)
const name = args[0]

// Opt-in widget bundles, in the order their tags must appear. This array is
// the dependency declaration: defer scripts run in document order and there is
// no ready event, so editor must follow markdown. core.js and platform.js are
// always emitted first, so they are not listed.
//
// Which of these are actually offered comes from what is built on disk, not
// from this list, so the flag can never advertise a bundle that does not exist
// yet -- scaffolding a tag with no file behind it now fails the manifest build.
const MODULE_ORDER = ['markdown', 'editor', 'nav', 'preview', 'graph']
const OPTIONAL_MODULES = MODULE_ORDER.filter((m) =>
  existsSync(path.join(root, 'pb_public/js', `${m}.js`))
)

function flag(label) {
  const i = args.indexOf(`--${label}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : undefined
}

if (!name) {
  console.error(
    'usage: npm run new-app <name> [-- --title "My App" --description "..." --icon "🎯"' +
      ` --modules ${OPTIONAL_MODULES.join(',')}]`
  )
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
  category: flag('category') || '',
  tags: (flag('tags') || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean),
}
writeFileSync(path.join(target, 'cubby.json'), JSON.stringify(manifest, null, 2) + '\n')

const modules = (flag('modules') || '')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean)

const unknown = modules.filter((m) => !OPTIONAL_MODULES.includes(m))
if (unknown.length) {
  console.error(`unknown module(s): ${unknown.join(', ')}. Available: ${OPTIONAL_MODULES.join(', ')}`)
  process.exit(1)
}
if (modules.includes('editor') && !modules.includes('markdown')) {
  console.error('the editor module needs markdown too: --modules markdown,editor')
  process.exit(1)
}

const html = path.join(target, 'index.html')
let markup = readFileSync(html, 'utf8').replaceAll('Template', title)

if (modules.length) {
  // Sort into canonical order rather than trusting the order typed, then splice
  // the tags in after platform.js and before the app's own script.
  const ordered = MODULE_ORDER.filter((m) => modules.includes(m))
  const tags = ordered.map((m) => `    <script src="/js/${m}.js" defer></script>\n`).join('')
  // The template's tags already carry ?v= stamps from the last build, so the
  // pattern has to tolerate a query string.
  const after = /( *<script src="\/js\/platform\.js(?:\?[^"]*)?"[^>]*><\/script>\n)/
  if (!after.test(markup)) {
    console.error('could not find the platform.js tag in the template; add module tags by hand')
    process.exit(1)
  }
  markup = markup.replace(after, (match) => match + tags)
}

writeFileSync(html, markup)

const { spawnSync } = await import('node:child_process')
spawnSync(process.execPath, [path.join(root, 'scripts', 'build-manifest.mjs')], { stdio: 'inherit' })

console.log(`created pb_public/${name}/ - serve it at /${name}/ with npm run dev`)
