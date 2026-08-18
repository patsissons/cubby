/**
 * Escaping and URL vetting for the markdown renderer. Every piece of source
 * text passes through escapeHtml at emission time — raw HTML in markdown
 * input always renders as visible text, which is what makes render() output
 * safe to assign to innerHTML without a sanitizer library.
 */

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/**
 * Escape the five HTML special characters. Safe for both text and
 * (quoted) attribute contexts.
 * @param {string} s
 * @returns {string}
 */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ENTITIES[c])
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i
const CONTROLS = /[\x00-\x20\x7f]+/g

/**
 * Vet a link/image destination. Control characters and whitespace are
 * stripped before scheme detection so tricks like "java\tscript:" cannot
 * smuggle a scheme past the check. Allowed: http:, https:, scheme-less
 * (relative, //host, #hash, ?query) and — for links only — mailto:.
 * Anything else returns '' (empty href/src, text still renders).
 * @param {string} url
 * @param {{image?: boolean}} [opts] image sources additionally reject mailto:
 * @returns {string}
 */
export function sanitizeUrl(url, opts = {}) {
  if (typeof url !== 'string') return ''
  const clean = url.replace(CONTROLS, '')
  const match = SCHEME.exec(clean)
  if (!match) return clean
  const scheme = match[0].toLowerCase()
  if (scheme === 'http:' || scheme === 'https:') return clean
  if (scheme === 'mailto:' && !opts.image) return clean
  return ''
}
