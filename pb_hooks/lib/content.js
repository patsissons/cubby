// Agent-readable page content: a markdown snapshot of what an app's page
// shows, for agents that fetch with curl and cannot run JavaScript. Served
// publicly at GET /_cubby/content[/<app>[/<route>]] (pb_hooks/content.pb.js)
// and to operators through the platform MCP tool read_app.
//
// A snapshot has two layers. The first is the app's static index.html
// converted to markdown, with scripts, hidden elements and form controls
// dropped. The second is optional: the app ships
// pb_hooks/apps/<app>/content.js, and the sections it returns fill the
// containers its JavaScript would fill in a browser. An app whose cubby.json
// declares an "access" block sits behind identity, and it gets nothing here.
//
// A route is whatever follows /<app>/ in a page URL, usually a hash route
// (/recipes/#/r/x is /_cubby/content/recipes/r/x). The server never sees
// a fragment, so the agent spells the route as a path. Only an app whose
// content.js exports route(ctx) answers routes. Every other route is an
// explicit 404, never the shell dressed up as success.
//
// The core (htmlToMarkdown, renderAppContent, renderRootContent) is pure, so
// scripts/content-tests.mjs runs it under Node. Everything after the JSVM
// marker runs in the PocketBase JSVM (goja): it is synchronous, CommonJS, and
// has no Node APIs.

const MAX_TEXT = 200000
const MAX_ROUTE = 500
const SLUG_RE = /^[a-z0-9-]{1,100}$/

// --- HTML -> markdown (pure) ---

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
])
// Dropped with everything inside them: not content, or content only a
// browser can use.
const SKIP = new Set([
  'head', 'script', 'style', 'template', 'svg', 'math', 'noscript', 'iframe', 'canvas', 'object', 'embed',
  'audio', 'video', 'button', 'input', 'select', 'option', 'textarea', 'dialog',
])
// Raw-text elements whose bodies the tokenizer must not parse as tags.
const RAW = ['script', 'style', 'textarea', 'template']
const BLOCK = new Set([
  'address', 'article', 'aside', 'body', 'details', 'div', 'dl', 'dd', 'dt', 'fieldset', 'figcaption', 'figure',
  'footer', 'form', 'header', 'hgroup', 'html', 'main', 'nav', 'p', 'section', 'summary', 'caption',
])
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…',
  copy: '©', reg: '®', trade: '™', rarr: '→', larr: '←', uarr: '↑', darr: '↓', middot: '·', bull: '•',
  laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', times: '×',
}

function decodeEntities(text) {
  return String(text).replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, ref) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10)
      try {
        return String.fromCodePoint(code)
      } catch (err) {
        return match
      }
    }
    const named = ENTITIES[ref.toLowerCase()]
    return named === undefined ? match : named
  })
}

function parseAttrs(source) {
  const attrs = {}
  const re = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
  let m
  while ((m = re.exec(source))) {
    const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : ''
    attrs[m[1].toLowerCase()] = decodeEntities(value)
  }
  return attrs
}

/**
 * A forgiving tree builder, not a spec parser. Unmatched close tags are
 * ignored. Open p and li elements close implicitly, the way browsers close
 * them.
 */
function parseHtml(html) {
  const root = { tag: '#root', attrs: {}, children: [] }
  const stack = [root]
  const top = () => stack[stack.length - 1]
  const source = String(html).replace(/<!--[\s\S]*?-->/g, '').replace(/<!doctype[^>]*>/gi, '')
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>|([^<]+)|</g
  let m
  while ((m = re.exec(source))) {
    if (m[5] !== undefined || !m[2]) {
      const text = m[5] !== undefined ? m[5] : '<'
      const parent = top()
      const last = parent.children[parent.children.length - 1]
      if (last && last.text !== undefined) last.text += text
      else parent.children.push({ text })
      continue
    }
    const tag = m[2].toLowerCase()
    if (m[1]) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i
          break
        }
      }
      continue
    }
    if (tag === 'p' && top().tag === 'p') stack.pop()
    if (tag === 'li') {
      for (let i = stack.length - 1; i > 0; i--) {
        const open = stack[i].tag
        if (open === 'li') {
          stack.length = i
          break
        }
        if (open === 'ul' || open === 'ol' || open === 'menu') break
      }
    }
    const node = { tag, attrs: parseAttrs(m[3] || ''), children: [] }
    top().children.push(node)
    if (RAW.includes(tag)) {
      const close = source.toLowerCase().indexOf(`</${tag}`, re.lastIndex)
      const end = close === -1 ? source.length : close
      node.children.push({ text: source.slice(re.lastIndex, end) })
      const after = source.indexOf('>', end)
      re.lastIndex = close === -1 ? source.length : after === -1 ? source.length : after + 1
      continue
    }
    if (!VOID.has(tag) && !m[4]) stack.push(node)
  }
  return root
}

function findById(node, id) {
  if (node.attrs && node.attrs.id === id) return node
  for (const child of node.children || []) {
    if (child.text !== undefined) continue
    const found = findById(child, id)
    if (found) return found
  }
  return null
}

function textOf(node) {
  if (node.text !== undefined) return decodeEntities(node.text)
  return (node.children || []).map(textOf).join('')
}

function isHidden(node) {
  const a = node.attrs || {}
  return 'hidden' in a || a['aria-hidden'] === 'true' || /(?:^|;)\s*display\s*:\s*none/i.test(a.style || '')
}

/**
 * Make a link absolute against base. With routeHref, links to the app's
 * own hash routes (#/x, or /<app>/#/x spelled out) become route snapshot
 * links. Without it they become plain text, because a fragment is
 * meaningless to an agent.
 */
function resolveHref(href, base, routeHref) {
  const value = String(href || '').trim()
  if (routeHref && value.startsWith('#/')) return routeHref(value.slice(1))
  if (!value || value[0] === '#' || /^javascript:/i.test(value)) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) return value
  const origin = (/^[a-z]+:\/\/[^/]+/i.exec(base) || [''])[0]
  const abs = value[0] === '/' ? origin + value : (base.endsWith('/') ? base : base.replace(/[^/]*$/, '')) + value.replace(/^\.\//, '')
  if (routeHref && abs.startsWith(`${base}#/`)) return routeHref(abs.slice(base.length + 1))
  return abs
}

const squash = (text) => text.replace(/\s+/g, ' ').trim()

/**
 * Convert an HTML document (or fragment) to markdown.
 * @param {string} html
 * @param {{ base?: string, fills?: Record<string, string>, routeHref?: (route: string) => string }} [opts]
 *   base: the URL that relative links resolve against
 *   fills: element id -> markdown that replaces that element's contents
 *   (how an app's content.js fills the containers its JS would fill)
 *   routeHref: maps a hash route ("/r/x") to its snapshot URL
 * @returns {{ markdown: string, filled: string[] }} filled lists the ids it found
 */
function htmlToMarkdown(html, opts) {
  const base = (opts && opts.base) || ''
  const fills = (opts && opts.fills) || {}
  const routeHref = opts && opts.routeHref
  const raws = []
  const raw = (markdown) => {
    raws.push(markdown)
    return `\n\n\u0000${raws.length - 1}\u0000\n\n`
  }

  const tree = parseHtml(html)
  const filled = []
  for (const id of Object.keys(fills)) {
    const node = findById(tree, id)
    if (!node) continue
    node.children = [{ fill: fills[id] }]
    filled.push(id)
  }

  const join = (parts) => {
    let out = ''
    for (const part of parts) {
      if (!part) continue
      out += !out || out.endsWith('\n') ? part.replace(/^[ \t]+/, '') : part
    }
    return out
  }
  const children = (node, pre) => join((node.children || []).map((child) => render(child, pre)))
  const block = (text) => (text.trim() ? `\n\n${text.trim()}\n\n` : '')

  function list(node, ordered) {
    let n = 0
    const items = []
    for (const child of node.children || []) {
      if (child.text !== undefined) {
        if (child.text.trim()) items.push(squash(decodeEntities(child.text)))
        continue
      }
      if (child.tag !== 'li') {
        const other = render(child).trim()
        if (other) items.push(other)
        continue
      }
      if (isHidden(child)) continue
      const body = children(child).trim().replace(/\n{2,}/g, '\n')
      if (!body) continue
      n++
      const marker = ordered ? `${n}. ` : '- '
      const pad = ' '.repeat(marker.length)
      items.push(body.split('\n').map((line, i) => (i === 0 ? marker + line : line ? pad + line : line)).join('\n'))
    }
    return block(items.join('\n'))
  }

  function table(node) {
    const rows = []
    const walk = (n) => {
      for (const child of n.children || []) {
        if (child.text !== undefined || isHidden(child)) continue
        if (child.tag === 'tr') {
          rows.push(
            (child.children || [])
              .filter((c) => c.tag === 'td' || c.tag === 'th')
              .map((c) => squash(children(c)).replace(/\|/g, '\\|'))
          )
        } else if (child.tag !== 'table') walk(child)
      }
    }
    walk(node)
    if (!rows.length) return ''
    const width = Math.max(...rows.map((r) => r.length))
    const line = (cells) => `| ${Array.from({ length: width }, (_, i) => cells[i] || '').join(' | ')} |`
    const out = [line(rows[0]), `| ${Array.from({ length: width }, () => '---').join(' | ')} |`]
    for (const row of rows.slice(1)) out.push(line(row))
    return block(out.join('\n'))
  }

  function render(node, pre) {
    if (node.fill !== undefined) return raw(String(node.fill).trim())
    if (node.text !== undefined) {
      const text = decodeEntities(node.text)
      return pre ? text : text.replace(/\s+/g, ' ')
    }
    const tag = node.tag
    if (SKIP.has(tag) && !(tag === 'dialog' && 'open' in node.attrs)) return ''
    if (isHidden(node)) return ''
    if (/^h[1-6]$/.test(tag)) {
      const text = squash(children(node))
      return text ? block(`${'#'.repeat(Number(tag[1]))} ${text}`) : ''
    }
    switch (tag) {
      case 'br':
        return '\n'
      case 'hr':
        return '\n\n---\n\n'
      case 'pre': {
        const code = (node.children || []).find((c) => c.tag === 'code')
        const lang = code ? (/(?:^|\s)language-([\w-]+)/.exec(code.attrs.class || '') || [])[1] || '' : ''
        const body = textOf(node).replace(/^\n/, '').replace(/\s+$/, '')
        if (!body) return ''
        const fence = body.includes('```') ? '~~~~' : '```'
        return raw(`${fence}${lang}\n${body}\n${fence}`)
      }
      case 'code':
      case 'kbd':
      case 'samp': {
        if (pre) return textOf(node)
        const text = squash(textOf(node))
        if (!text) return ''
        const tick = text.includes('`') ? '``' : '`'
        return `${tick}${text}${tick}`
      }
      case 'strong':
      case 'b': {
        const text = squash(children(node))
        return text ? `**${text}**` : ''
      }
      case 'em':
      case 'i': {
        const text = squash(children(node))
        return text ? `*${text}*` : ''
      }
      case 'a': {
        const text = squash(children(node))
        const href = resolveHref(node.attrs.href, base, routeHref)
        if (!text) return ''
        return href ? `[${text}](${href})` : text
      }
      case 'img': {
        const alt = squash(node.attrs.alt || '')
        return alt ? `![${alt}](${resolveHref(node.attrs.src, base)})` : ''
      }
      case 'ul':
      case 'menu':
        return list(node, false)
      case 'ol':
        return list(node, true)
      case 'table':
        return table(node)
      case 'blockquote': {
        const body = children(node).trim().replace(/\n{3,}/g, '\n\n')
        return body ? block(body.split('\n').map((line) => (line ? `> ${line}` : '>')).join('\n')) : ''
      }
      case 'dt':
        return block(`**${squash(children(node))}**`)
      default:
        return BLOCK.has(tag) || tag === '#root' || tag === 'li' ? block(children(node)) : children(node)
    }
  }

  let markdown = render(tree)
    .split('\n')
    .map((line) => (line.trim() ? line.replace(/\s+$/, '') : ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  markdown = markdown.replace(/\u0000(\d+)\u0000/g, (_, i) => raws[Number(i)])
  return { markdown, filled }
}

// --- snapshot assembly (pure) ---

function cap(markdown) {
  if (markdown.length <= MAX_TEXT) return markdown
  return `${markdown.slice(0, MAX_TEXT)}\n\n[truncated at ${MAX_TEXT} characters]`
}

/**
 * One app's snapshot: the static page, the hook's sections filled into the
 * page by target id or appended under their own heading, and a header that
 * says what this is.
 * @param {{ slug: string, manifest: object, html: string, origin?: string,
 *   sections?: Array<{ title?: string, markdown: string, target?: string }>,
 *   routes?: boolean }} input  routes: the app answers per-route snapshots,
 *   so its own hash links point at them
 */
function renderAppContent(input) {
  const { slug, manifest = {}, html = '', origin = '', sections = [], routes = false } = input
  const url = `${origin}/${slug}/`
  const title = String(manifest.title || slug)
  const fills = {}
  for (const section of sections) {
    if (section.target) fills[section.target] = section.markdown
  }
  const routeHref = routes ? (route) => contentUrl(origin, slug, route) : undefined
  const { markdown, filled } = htmlToMarkdown(html, { base: url, fills, routeHref })

  // The snapshot opens with the page's own h1 when it has one, so the
  // header lines sit right under the title the app chose.
  let h1 = `# ${manifest.icon ? `${manifest.icon} ` : ''}${title}`
  let body = markdown
  if (/^# /.test(markdown)) {
    const end = markdown.indexOf('\n')
    h1 = end === -1 ? markdown : markdown.slice(0, end)
    body = end === -1 ? '' : markdown.slice(end + 1).trim()
  }
  const parts = [h1]
  if (manifest.description) parts.push(`> ${squash(String(manifest.description))}`)
  parts.push(
    [
      `- App: ${url}`,
      '- This is a server-rendered text snapshot. The live page renders in the browser, and its',
      '  interactive parts (sign-in, realtime updates, AI) need one.',
    ].join('\n')
  )
  if (body) parts.push(body)
  // Sections that found no target, or never named one, go after the page.
  for (const section of sections) {
    if (section.target && filled.includes(section.target)) continue
    const text = String(section.markdown || '').trim()
    if (!text) continue
    parts.push(section.title ? `## ${squash(String(section.title))}\n\n${text}` : text)
  }
  return cap(parts.join('\n\n') + '\n')
}

/**
 * Normalize the part of a page URL after /<app>/ into a route: "#/r/x",
 * "r/x/" and "/r/x" all become "/r/x". The root is "". Returns null for
 * a route nobody should be asking for.
 * @param {string} raw
 * @returns {string|null}
 */
function normalizeRoute(raw) {
  const value = String(raw || '')
  if (value.length > MAX_ROUTE || /[\u0000-\u001f\u007f]/.test(value)) return null
  const trimmed = value.replace(/^[#/]+/, '').replace(/\/+$/, '')
  return trimmed ? `/${trimmed}` : ''
}

/** Absolute URL of a snapshot: the app's, or one of its routes. */
function contentUrl(origin, slug, route) {
  const normalized = normalizeRoute(route) || ''
  return `${origin}/_cubby/content/${slug}${normalized.split('/').map(encodeURIComponent).join('/')}`
}

/**
 * One route's snapshot: what the app's route(ctx) returned, under a header
 * that ties it back to the page and the app snapshot. There is no static
 * shell: the page around a deep link is the same for every route.
 * @param {{ slug: string, manifest: object, origin?: string, route: string,
 *   result: { title?: string, markdown: string, pageUrl?: string } }} input
 */
function renderRouteContent(input) {
  const { slug, manifest = {}, origin = '', route, result } = input
  const appTitle = String(manifest.title || slug)
  const title = squash(String(result.title || '')) || `${appTitle} ${route}`
  const parts = [`# ${title}`]
  const desc = manifest.description ? `: ${squash(String(manifest.description))}` : ''
  parts.push(`> ${appTitle}${desc}`)
  parts.push(
    [
      `- Page: ${result.pageUrl || `${origin}/${slug}/#${route}`}`,
      `- App snapshot: ${contentUrl(origin, slug, '')}`,
      '- This is a server-rendered text snapshot of one view of an app that renders in the browser.',
    ].join('\n')
  )
  const body = String(result.markdown || '').trim()
  if (body) parts.push(body)
  return cap(parts.join('\n\n') + '\n')
}

/** What route(ctx) returned: null (no such route) or { markdown, title?, pageUrl? }. */
function validateRouteResult(result) {
  if (result === null || result === undefined) return []
  if (typeof result !== 'object' || Array.isArray(result)) return ['route() must return an object or null']
  const problems = []
  if (typeof result.markdown !== 'string') problems.push('markdown must be a string')
  if (result.title !== undefined && typeof result.title !== 'string') problems.push('title must be a string')
  if (result.pageUrl !== undefined && typeof result.pageUrl !== 'string') problems.push('pageUrl must be a string')
  return problems
}

/**
 * The discovery site's snapshot. A browser fills the root grid from
 * sites.json, so a curl of / sees an empty grid.
 * @param {{ siteName: string, origin?: string,
 *   sites: Array<{ name: string, title: string, description?: string, icon?: string, category?: string, tags?: string[], gated?: boolean }> }} input
 */
function renderRootContent(input) {
  const { siteName, origin = '', sites = [] } = input
  const lines = [
    `# ${siteName}`,
    '',
    '> A shelf of tiny static web apps on one PocketBase instance.',
    '',
    `- Discovery site: ${origin}/`,
    `- Agent index: ${origin}/llms.txt`,
    '- Pages render in the browser, so their HTML is mostly an empty shell. Each app below',
    `  links a markdown snapshot of what it shows (${origin}/_cubby/content/<app>).`,
    '',
    '## Apps',
    '',
  ]
  if (!sites.length) lines.push('No apps yet.')
  for (const site of sites) {
    const label = `${site.icon ? `${site.icon} ` : ''}${site.title || site.name}`
    const desc = site.description ? `: ${squash(String(site.description))}` : ''
    const content = site.gated
      ? ' (sign-in required; no agent content)'
      : ` ([content](${origin}/_cubby/content/${site.name}))`
    lines.push(`- [${label}](${origin}/${site.name}/)${desc}${content}`)
  }
  return cap(lines.join('\n') + '\n')
}

/**
 * Check what an app's content.js returned: an array of { markdown, title?,
 * target? }. Returns a list of problems. An empty list means it is valid.
 */
function validateSections(sections) {
  if (!Array.isArray(sections)) return ['sections() must return an array']
  const problems = []
  sections.forEach((s, i) => {
    if (!s || typeof s !== 'object') return problems.push(`section ${i} is not an object`)
    if (typeof s.markdown !== 'string') problems.push(`section ${i}: markdown must be a string`)
    if (s.title !== undefined && typeof s.title !== 'string') problems.push(`section ${i}: title must be a string`)
    if (s.target !== undefined && (typeof s.target !== 'string' || !s.target)) {
      problems.push(`section ${i}: target must be an element id`)
    }
  })
  return problems
}

// --- JSVM helpers (globals used only inside these bodies) ---

function readJson(path) {
  try {
    return JSON.parse(toString($os.readFile(path)))
  } catch (err) {
    return null
  }
}

function readText(path) {
  try {
    return toString($os.readFile(path))
  } catch (err) {
    return ''
  }
}

function originOf(config) {
  return String((config && (config.domain || config.instanceUrl)) || '').replace(/\/+$/, '')
}

/**
 * Records from a collection anyone may list (listRule ""). This is the only
 * data a content hook can reach, so a snapshot can never show more than an
 * anonymous browser could already fetch.
 */
function publicRecords(app, name, opts) {
  const o = opts || {}
  if (typeof name !== 'string' || !/^[a-z][a-z0-9_]*$/.test(name)) throw new Error(`invalid collection "${name}"`)
  const collection = app.findCollectionByNameOrId(name)
  const json = JSON.parse(JSON.stringify(collection))
  if (collection.system || json.listRule !== '') {
    throw new Error(`collection "${name}" is not publicly listable (listRule must be "")`)
  }
  const limit = Number.isInteger(o.limit) ? Math.min(Math.max(o.limit, 1), 200) : 20
  const rows = app.findRecordsByFilter(
    name,
    typeof o.filter === 'string' && o.filter ? o.filter : "id != ''",
    typeof o.sort === 'string' ? o.sort : '',
    limit,
    0,
    o.params && typeof o.params === 'object' ? o.params : {}
  )
  const out = []
  for (const row of rows) out.push(row.publicExport())
  return out
}

/** require() an app's optional content.js; null when it has none. Throws when it is broken. */
function loadContentModule(slug) {
  const file = `${__hooks}/apps/${slug}/content.js`
  try {
    $os.stat(file)
  } catch (err) {
    return null
  }
  const module = require(file)
  if (!module || (typeof module.sections !== 'function' && typeof module.route !== 'function')) {
    throw new Error('content.js must export sections(ctx) and/or route(ctx)')
  }
  return module
}

function hookCtx(app, slug, manifest, origin, route) {
  return {
    app,
    slug,
    manifest,
    route,
    origin,
    log: (msg) => console.log(`[content:${slug}] ${msg}`),
    publicRecords: (name, opts) => publicRecords(app, name, opts),
    contentUrl: (r) => contentUrl(origin, slug, r),
  }
}

/** Run sections(ctx). A broken hook costs its sections, never the page. */
function loadSections(module, ctx) {
  if (!module || typeof module.sections !== 'function') return []
  try {
    const sections = module.sections(ctx)
    const problems = validateSections(sections)
    if (problems.length) throw new Error(problems.join('; '))
    return sections
  } catch (err) {
    ctx.log(`sections failed: ${err && err.message ? err.message : err}`)
    return []
  }
}

/**
 * The snapshot for the root (''), an app, or one of the app's routes. This
 * is shared by the public endpoint and the MCP read_app tool. A route that
 * the app does not answer is a 404, never the page shell.
 * @param {string} [rawRoute] what followed /<app>/ in the page URL
 * @returns {{ status: number, markdown?: string, code?: string, message?: string }}
 */
function renderContent(app, slug, rawRoute) {
  const { loadCubbyConfig, parseAccess } = require(`${__hooks}/lib/config.js`)
  const publicDir = `${__hooks}/../pb_public`
  let config = {}
  try {
    config = loadCubbyConfig()
  } catch (err) {
    config = {}
  }
  const origin = originOf(config)

  if (!slug) {
    const sites = readJson(`${publicDir}/sites.json`) || []
    for (const site of sites) site.gated = !!parseAccess(readJson(`${publicDir}/${site.name}/cubby.json`))
    const siteName = String(config.title || config.name || 'Cubby')
    return { status: 200, markdown: renderRootContent({ siteName, origin, sites }) }
  }

  if (!SLUG_RE.test(slug)) return { status: 400, code: 'bad_request', message: 'invalid app slug' }
  const manifest = readJson(`${publicDir}/${slug}/cubby.json`)
  if (!manifest || typeof manifest !== 'object') return { status: 404, code: 'not_found', message: `no app "${slug}"` }
  if (parseAccess(manifest)) {
    return {
      status: 403,
      code: 'identity_required',
      message: `app "${slug}" requires sign-in; its content is not available to agents`,
    }
  }
  const route = normalizeRoute(rawRoute)
  if (route === null) return { status: 400, code: 'bad_request', message: 'invalid route' }
  const log = (msg) => console.log(`[content:${slug}] ${msg}`)
  let module = null
  try {
    module = loadContentModule(slug)
  } catch (err) {
    log(`content.js failed to load: ${err && err.message ? err.message : err}`)
    if (route) return { status: 500, code: 'content_hook_failed', message: `app "${slug}" content hook failed` }
  }
  const routes = !!(module && typeof module.route === 'function')
  const ctx = hookCtx(app, slug, manifest, origin, route)

  if (!route) {
    const html = readText(`${publicDir}/${slug}/index.html`)
    const sections = loadSections(module, ctx)
    return { status: 200, markdown: renderAppContent({ slug, manifest, html, origin, sections, routes }) }
  }

  const notFound = { status: 404, code: 'route_not_found', message: `app "${slug}" has no content for route "${route}"` }
  if (!routes) return notFound
  let result
  try {
    result = module.route(ctx)
    const problems = validateRouteResult(result)
    if (problems.length) throw new Error(problems.join('; '))
  } catch (err) {
    log(`route ${route} failed: ${err && err.message ? err.message : err}`)
    return { status: 500, code: 'content_hook_failed', message: `app "${slug}" content hook failed for route "${route}"` }
  }
  if (result === null || result === undefined) return notFound
  return { status: 200, markdown: renderRouteContent({ slug, manifest, origin, route, result }) }
}

/** GET /_cubby/content[/{app}[/{route...}]]. */
function serve(e, slug, route) {
  const started = Date.now()
  const out = renderContent(e.app, slug, route)
  const shown = route ? `/${encodeURI(String(route)).slice(0, 200)}` : ''
  console.log(`[content] /${slug || ''}${shown} ${Date.now() - started}ms ${out.code ? `err:${out.code}` : 'ok'}`)
  if (out.code) {
    e.response.header().set('Cache-Control', 'no-store')
    return e.json(out.status, { code: out.code, message: out.message })
  }
  e.response.header().set('Cache-Control', 'public, max-age=60')
  return e.blob(200, 'text/markdown; charset=utf-8', out.markdown)
}

module.exports = {
  MAX_TEXT,
  decodeEntities,
  htmlToMarkdown,
  renderAppContent,
  renderRootContent,
  renderRouteContent,
  normalizeRoute,
  contentUrl,
  validateSections,
  validateRouteResult,
  publicRecords,
  loadContentModule,
  loadSections,
  renderContent,
  serve,
}
