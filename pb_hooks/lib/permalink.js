// Permalink helpers: manifest loading, OG text derivation and the shell
// rewrite. Runs in the PocketBase JSVM (goja): synchronous, CommonJS, no Node
// APIs. Everything below loadAppPermalink/permalinkApps is pure, so
// scripts/permalink-tests.mjs runs it in Node.

/**
 * Load an app's permalink declaration from its committed manifest.
 * Returns null when the app has no manifest or no permalink block.
 *
 * Manifest shape (in pb_public/<app>/cubby.json), record mode:
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
 * or hook mode, for links whose content is computed rather than stored:
 *   "permalink": {
 *     "hook": true,                    pb_hooks/apps/<app>/permalink.js resolves slugs
 *     "home": "default"                optional, as above
 *   }
 *
 * A manifest declaring both is invalid (the build fails it); at runtime a
 * collection wins, so a half-migrated manifest keeps serving records.
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
  if (!pl || typeof pl !== 'object') return null
  const str = (value, fallback) => (typeof value === 'string' && value ? value : fallback)
  if ((typeof pl.collection !== 'string' || !pl.collection) && pl.hook === true) {
    return { hook: true, home: str(pl.home, '') }
  }
  if (typeof pl.collection !== 'string' || !pl.collection) {
    return null
  }
  return {
    hook: false,
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
    const pl = loadAppPermalink(name)
    if (!pl) continue
    if (pl.hook) {
      // The build fails this too; at boot, skip the app rather than register
      // a route that can only 500.
      try {
        $os.stat(`${__hooks}/apps/${name}/permalink.js`)
      } catch (err) {
        console.log(`[permalinks] ${name} declares "hook": true but has no pb_hooks/apps/${name}/permalink.js; not routing it`)
        continue
      }
    }
    apps.push(name)
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
  return clampText(text, max)
}

/**
 * Collapse whitespace and clamp on a word boundary with an ellipsis.
 * @param {string} text
 * @param {number} [max]
 */
function clampText(text, max = 150) {
  const flat = String(text).replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
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

/**
 * Normalize what an app's permalink.js resolve(ctx) returned into OG meta.
 * null/undefined (or anything not an object) means "no such slug". Text is
 * plain (never markdown, never HTML): whitespace collapsed, title clamped to
 * 120 characters and description to 150, empty values left to the shell's
 * static tags. image may be absolute http(s) or origin-relative ("/x.png");
 * anything else is dropped so the static og:image stands.
 * @param {any} out
 * @param {string} origin  e.g. "https://cubby.example"
 * @returns {{title?: string, description?: string, image?: string} | null}
 */
function hookMeta(out, origin) {
  if (!out || typeof out !== 'object') return null
  const meta = {}
  const text = (value, max) => (typeof value === 'string' ? clampText(value, max) : '')
  const title = text(out.title, 120)
  const description = text(out.description, 150)
  if (title) meta.title = title
  if (description) meta.description = description
  const image = typeof out.image === 'string' ? out.image.trim() : ''
  if (/^https?:\/\//i.test(image)) meta.image = image
  else if (image.startsWith('/') && !image.startsWith('//')) meta.image = `${origin}${image}`
  return meta
}

/**
 * Rewrite an app shell's <title> and static OG/meta tags in place. Values are
 * plain text and escaped here; absent ones keep the shell's static value.
 * Replacement goes through functions so "$&" or "$1" in user text is literal.
 * @param {string} shell
 * @param {{title?: string, description?: string, image?: string, url?: string}} meta
 */
function applyOg(shell, meta) {
  const setMeta = (html, attr, value) =>
    html.replace(new RegExp(`((?:property|name)="${attr}"\\s+content=")[^"]*`), (_, head) => head + escapeHtml(value))
  let html = shell
  if (meta.title != null) {
    html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(meta.title)}</title>`)
    html = setMeta(html, 'og:title', meta.title)
  }
  if (meta.description != null) {
    html = setMeta(html, 'og:description', meta.description)
    html = setMeta(html, 'description', meta.description)
  }
  if (meta.url != null) html = setMeta(html, 'og:url', meta.url)
  if (meta.image) html = setMeta(html, 'og:image', meta.image)
  return html
}

module.exports = { loadAppPermalink, permalinkApps, renderTemplate, stripMarkdown, clampText, escapeHtml, hookMeta, applyOg }
