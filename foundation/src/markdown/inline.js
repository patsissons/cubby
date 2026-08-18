import { escapeHtml, sanitizeUrl } from './sanitize.js'

/**
 * Inline markdown: a single left-to-right scanner producing a node list,
 * then a serializer that escapes at emission. No regex-replace chains —
 * ordering bugs in those are the classic markdown XSS vector.
 *
 * Precedence: backslash escapes, code spans, autolinks, images, links,
 * emphasis. Reference-style links ([text][ref]) are out of scope and
 * render as literal text.
 */

const MAX_DEPTH = 16
const PUNCT = /[!-/:-@[-`{-~]/
const WORD = /[A-Za-z0-9_]/

/** @param {string} src @param {number} i @param {string} ch @returns {number} run length of ch at i */
function runLength(src, i, ch) {
  let n = 0
  while (src[i + n] === ch) n++
  return n
}

/** Find a closing backtick run of exactly len, or -1. */
function findCodeClose(src, from, len) {
  let i = from
  while (i < src.length) {
    if (src[i] === '`') {
      const run = runLength(src, i, '`')
      if (run === len) return i
      i += run
    } else {
      i++
    }
  }
  return -1
}

/** Trim trailing punctuation (and unbalanced ')') from a bare autolink. */
function trimAutolink(url) {
  while (url.length) {
    const last = url[url.length - 1]
    if ('.,;:!?\'"'.includes(last)) {
      url = url.slice(0, -1)
      continue
    }
    if (last === ')') {
      const opens = (url.match(/\(/g) || []).length
      const closes = (url.match(/\)/g) || []).length
      if (closes > opens) {
        url = url.slice(0, -1)
        continue
      }
    }
    break
  }
  return url
}

/**
 * Find the ']' matching the '[' at from, honoring nesting, backslash
 * escapes, and code spans. Returns -1 when unbalanced.
 */
function matchBracket(src, from) {
  let level = 0
  let i = from
  while (i < src.length) {
    const c = src[i]
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === '`') {
      const run = runLength(src, i, '`')
      const close = findCodeClose(src, i + run, run)
      i = close === -1 ? i + run : close + run
      continue
    }
    if (c === '[') level++
    else if (c === ']') {
      level--
      if (level === 0) return i
    }
    i++
  }
  return -1
}

/**
 * Parse "(dest)" / "(dest \"title\")" / "(<dest>)" starting at the '('.
 * Destinations use a balanced-paren scan; titles accept ' or ".
 * @returns {{href: string, title: string, end: number} | null}
 */
function parseTarget(src, i) {
  if (src[i] !== '(') return null
  let j = i + 1
  while (src[j] === ' ' || src[j] === '\n') j++
  let href = ''
  if (src[j] === '<') {
    const end = src.indexOf('>', j + 1)
    if (end === -1) return null
    href = src.slice(j + 1, end)
    if (href.includes('\n')) return null
    j = end + 1
  } else {
    let depth = 0
    const start = j
    while (j < src.length) {
      const c = src[j]
      if (c === '\\' && src[j + 1]) {
        j += 2
        continue
      }
      if (/\s/.test(c)) break
      if (c === '(') depth++
      else if (c === ')') {
        if (depth === 0) break
        depth--
      }
      j++
    }
    href = src.slice(start, j).replace(/\\([!-/:-@[-`{-~])/g, '$1')
  }
  while (src[j] === ' ' || src[j] === '\n') j++
  let title = ''
  if (src[j] === '"' || src[j] === "'") {
    const quote = src[j]
    let k = j + 1
    while (k < src.length && src[k] !== quote) {
      if (src[k] === '\\' && src[k + 1]) {
        title += src[k + 1]
        k += 2
      } else {
        title += src[k]
        k++
      }
    }
    if (k >= src.length) return null
    j = k + 1
    while (src[j] === ' ' || src[j] === '\n') j++
  }
  if (src[j] !== ')') return null
  return { href, title, end: j + 1 }
}

/** Flatten nodes to their plain-text content (used for image alt). */
function textOf(nodes) {
  let out = ''
  for (const n of nodes) {
    if (n.type === 'text' || n.type === 'code') out += n.text
    else if (n.type === 'image') out += n.alt
    else if (n.children) out += textOf(n.children)
  }
  return out
}

/** @returns {{node: object, end: number} | null} link or image at '[' */
function parseLinkLike(src, i, depth, isImage) {
  const close = matchBracket(src, i)
  if (close === -1) return null
  const target = parseTarget(src, close + 1)
  if (!target) return null
  const inner = src.slice(i + 1, close)
  if (isImage) {
    const alt = textOf(parseInline(inner, depth + 1, true))
    return { node: { type: 'image', src: target.href, alt, title: target.title }, end: target.end }
  }
  const children = parseInline(inner, depth + 1, true)
  return { node: { type: 'link', href: target.href, title: target.title, children }, end: target.end }
}

/** Left-flanking check for an emphasis opener ('_' also needs a non-word left neighbor). */
function canOpen(src, i, len, c) {
  const after = src[i + len]
  if (!after || /\s/.test(after)) return false
  if (c === '_') {
    const before = src[i - 1]
    if (before && WORD.test(before)) return false
  }
  return true
}

/**
 * Find a valid closing delimiter, honoring escapes and skipping code
 * spans. Closers need a non-whitespace left neighbor; '_' closers also
 * need a non-word right neighbor so snake_case survives.
 */
function findEmphasisClose(src, from, delim, c) {
  let i = from
  while (i < src.length) {
    const ch = src[i]
    if (ch === '\\') {
      i += 2
      continue
    }
    if (ch === '`') {
      const run = runLength(src, i, '`')
      const close = findCodeClose(src, i + run, run)
      i = close === -1 ? i + run : close + run
      continue
    }
    if (ch === c && src.startsWith(delim, i)) {
      const before = src[i - 1]
      const run = runLength(src, i, c)
      const after = src[i + run]
      const okBefore = Boolean(before) && !/\s/.test(before)
      const okAfter = c !== '_' || !after || !WORD.test(after)
      if (okBefore && okAfter) return i
      i += run
      continue
    }
    i++
  }
  return -1
}

/** @returns {{node: object, end: number} | null} em/strong/del at a delimiter run */
function parseEmphasis(src, i, c, depth, inLink) {
  const run = runLength(src, i, c)
  if (c === '~') {
    if (run < 2 || !canOpen(src, i, 2, c)) return null
    const close = findEmphasisClose(src, i + 2, '~~', c)
    if (close === -1 || close <= i + 2) return null
    const children = parseInline(src.slice(i + 2, close), depth + 1, inLink)
    return { node: { type: 'del', children }, end: close + 2 }
  }
  if (run >= 3 && canOpen(src, i, 3, c)) {
    const close = findEmphasisClose(src, i + 3, c + c + c, c)
    if (close !== -1 && close > i + 3) {
      const children = parseInline(src.slice(i + 3, close), depth + 1, inLink)
      return { node: { type: 'em', children: [{ type: 'strong', children }] }, end: close + 3 }
    }
  }
  if (run >= 2 && canOpen(src, i, 2, c)) {
    const close = findEmphasisClose(src, i + 2, c + c, c)
    if (close !== -1 && close > i + 2) {
      const children = parseInline(src.slice(i + 2, close), depth + 1, inLink)
      return { node: { type: 'strong', children }, end: close + 2 }
    }
  }
  if (canOpen(src, i, 1, c)) {
    const close = findEmphasisClose(src, i + 1, c, c)
    if (close !== -1 && close > i + 1) {
      const children = parseInline(src.slice(i + 1, close), depth + 1, inLink)
      return { node: { type: 'em', children }, end: close + 1 }
    }
  }
  return null
}

/**
 * Parse inline markdown into a node list.
 * @param {string} src
 * @param {number} [depth] recursion depth; delimiters go literal at the cap
 * @param {boolean} [inLink] nested links are not parsed inside link text
 * @returns {object[]}
 */
export function parseInline(src, depth = 0, inLink = false) {
  const nodes = []
  let text = ''
  let i = 0
  const flush = () => {
    if (text) {
      nodes.push({ type: 'text', text })
      text = ''
    }
  }
  while (i < src.length) {
    const c = src[i]
    if (c === '\\') {
      const next = src[i + 1]
      if (next === '\n') {
        flush()
        nodes.push({ type: 'br' })
        i += 2
        continue
      }
      if (next && PUNCT.test(next)) {
        text += next
        i += 2
        continue
      }
      text += c
      i++
      continue
    }
    if (c === '\n') {
      if (/ {2}$/.test(text)) {
        text = text.replace(/ +$/, '')
        flush()
        nodes.push({ type: 'br' })
      } else {
        text = text.replace(/ +$/, '')
        flush()
        nodes.push({ type: 'softbreak' })
      }
      i++
      continue
    }
    if (c === '`') {
      const open = runLength(src, i, '`')
      const close = findCodeClose(src, i + open, open)
      if (close !== -1) {
        flush()
        let code = src.slice(i + open, close)
        if (code.length >= 2 && code[0] === ' ' && code.endsWith(' ') && code.trim()) {
          code = code.slice(1, -1)
        }
        nodes.push({ type: 'code', text: code })
        i = close + open
        continue
      }
      text += src.slice(i, i + open)
      i += open
      continue
    }
    if (c === '<' && !inLink) {
      const auto = /^<(https?:\/\/[^\s<>]+|mailto:[^\s<>]+)>/i.exec(src.slice(i))
      if (auto) {
        flush()
        const url = auto[1]
        const label = url.replace(/^mailto:/i, '')
        nodes.push({ type: 'link', href: url, title: '', children: [{ type: 'text', text: label }] })
        i += auto[0].length
        continue
      }
      text += c
      i++
      continue
    }
    if ((c === 'h' || c === 'H') && !inLink && (i === 0 || !WORD.test(src[i - 1]))) {
      const bare = /^https?:\/\/[^\s<]+/i.exec(src.slice(i))
      if (bare) {
        const url = trimAutolink(bare[0])
        flush()
        nodes.push({ type: 'link', href: url, title: '', children: [{ type: 'text', text: url }] })
        i += url.length
        continue
      }
      text += c
      i++
      continue
    }
    if (c === '!' && src[i + 1] === '[') {
      const image = parseLinkLike(src, i + 1, depth, true)
      if (image) {
        flush()
        nodes.push(image.node)
        i = image.end
        continue
      }
      text += c
      i++
      continue
    }
    if (c === '[' && !inLink) {
      const link = parseLinkLike(src, i, depth, false)
      if (link) {
        flush()
        nodes.push(link.node)
        i = link.end
        continue
      }
      text += c
      i++
      continue
    }
    if ((c === '*' || c === '_' || c === '~') && depth < MAX_DEPTH) {
      const emph = parseEmphasis(src, i, c, depth, inLink)
      if (emph) {
        flush()
        nodes.push(emph.node)
        i = emph.end
        continue
      }
      text += c
      i++
      continue
    }
    text += c
    i++
  }
  flush()
  return nodes
}

/** @param {object[]} nodes @param {{linkTarget?: string}} opts @returns {string} html */
function serialize(nodes, opts) {
  let out = ''
  for (const n of nodes) {
    switch (n.type) {
      case 'text':
        out += escapeHtml(n.text)
        break
      case 'softbreak':
        out += '\n'
        break
      case 'br':
        out += '<br>\n'
        break
      case 'code':
        out += `<code>${escapeHtml(n.text)}</code>`
        break
      case 'em':
        out += `<em>${serialize(n.children, opts)}</em>`
        break
      case 'strong':
        out += `<strong>${serialize(n.children, opts)}</strong>`
        break
      case 'del':
        out += `<del>${serialize(n.children, opts)}</del>`
        break
      case 'link': {
        const href = escapeHtml(sanitizeUrl(n.href))
        const title = n.title ? ` title="${escapeHtml(n.title)}"` : ''
        const target = opts.linkTarget
          ? ` target="${escapeHtml(opts.linkTarget)}" rel="noopener noreferrer"`
          : ''
        out += `<a href="${href}"${title}${target}>${serialize(n.children, opts)}</a>`
        break
      }
      case 'image': {
        const src = escapeHtml(sanitizeUrl(n.src, { image: true }))
        const title = n.title ? ` title="${escapeHtml(n.title)}"` : ''
        out += `<img src="${src}" alt="${escapeHtml(n.alt)}"${title}>`
        break
      }
    }
  }
  return out
}

/**
 * Render inline markdown to an HTML string (block layer calls this per block).
 * @param {string} src
 * @param {{linkTarget?: string}} [opts]
 * @returns {string}
 */
export function renderInline(src, opts = {}) {
  return serialize(parseInline(src), opts)
}
