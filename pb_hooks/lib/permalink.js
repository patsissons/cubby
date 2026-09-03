// Permalink helpers: manifest loading and OG text derivation.
// Runs in the PocketBase JSVM (goja): synchronous, CommonJS, no Node APIs.

/**
 * Load an app's permalink declaration from its committed manifest.
 * Returns null when the app has no manifest or no permalink block.
 *
 * Manifest shape (in pb_public/<app>/cubby.json):
 *   "permalink": {
 *     "collection": "hang_events",     required: full collection name
 *     "param": "slug",                 record field matched to the path segment (default "slug")
 *     "filter": "published = true",    optional; ANDed with the param match
 *     "title": "{title}",              template: {field} -> record field value
 *     "description": "{body}",         template; markdown-stripped, clamped ~150 chars
 *     "image": "og_image",             optional file field name
 *     "imageThumb": "1200x630",        optional ?thumb= variant for the file URL
 *     "home": "balanced"               optional: GET /<app>/ serves this slug's OG
 *   }
 *
 * @param {string} app
 */
function loadAppPermalink(app) {
  let manifest = {}
  try {
    manifest = JSON.parse(toString($os.readFile(`${__hooks}/../pb_public/${app}/cubby.json`)))
  } catch (err) {
    return null
  }
  const pl = manifest.permalink
  if (!pl || typeof pl !== 'object' || typeof pl.collection !== 'string' || !pl.collection) {
    return null
  }
  const str = (value, fallback) => (typeof value === 'string' && value ? value : fallback)
  return {
    collection: pl.collection,
    param: str(pl.param, 'slug'),
    filter: str(pl.filter, ''),
    title: str(pl.title, ''),
    description: str(pl.description, ''),
    image: str(pl.image, ''),
    imageThumb: str(pl.imageThumb, ''),
    home: str(pl.home, ''),
  }
}

/**
 * List the app directories under pb_public that declare a permalink.
 * Called once at boot to register routes; adding a permalink to a new app
 * needs a server restart (PocketHost: power cycle), like any hook change.
 */
function permalinkApps() {
  const apps = []
  for (const entry of $os.readDir(`${__hooks}/../pb_public`)) {
    if (!entry.isDir()) continue
    const name = entry.name()
    if (!/^[a-z0-9-]+$/.test(name)) continue
    if (loadAppPermalink(name)) apps.push(name)
  }
  return apps
}

/**
 * Fill a "{field}" template from a record.
 * @param {string} template
 * @param {any} record
 */
function renderTemplate(template, record) {
  return String(template).replace(/\{([A-Za-z0-9_]+)\}/g, (_, field) => record.getString(field))
}

/**
 * Reduce markdown to a plain-text summary for og:description. Best-effort
 * and synchronous: strips the common constructs the cubby markdown module
 * supports, collapses whitespace, and clamps on a word boundary.
 * @param {string} md
 * @param {number} [max]
 */
function stripMarkdown(md, max = 150) {
  let text = String(md)
    .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
    .replace(/`([^`]*)`/g, '$1') // inline code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images -> alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> label
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
    .replace(/^\s{0,3}>\s?/gm, '') // blockquotes
    .replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/gm, '') // list/task markers
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, ' ') // horizontal rules
    .replace(/(\*\*|__|\*|_|~~)/g, '') // emphasis markers
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const boundary = cut.lastIndexOf(' ')
  return `${(boundary > max / 2 ? cut.slice(0, boundary) : cut).trim()}…`
}

/**
 * Escape a string for use inside an HTML attribute or text node.
 * @param {string} value
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

module.exports = { loadAppPermalink, permalinkApps, renderTemplate, stripMarkdown, escapeHtml }
