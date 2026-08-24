/**
 * Can this URL be shown in an iframe?
 *
 * This is the constraint everything in the preview widget follows from: a
 * frame blocked by X-Frame-Options or a frame-ancestors CSP CANNOT BE DETECTED
 * FROM JAVASCRIPT. No error event fires, and `load` may still run on the
 * blocked shell. So "try the iframe and fall back if it fails" is not
 * implementable -- the fallback never triggers and the reader sits looking at
 * a blank box.
 *
 * Therefore framing is an allowlist of hosts whose headers were ACTUALLY
 * MEASURED. It is a measurement, not a preference. Adding a host means
 * checking it first:
 *
 *   curl -sI <url> | grep -iE 'x-frame-options|frame-ancestors'
 *
 * and following any 301/302 -- a redirect tells you nothing about the page you
 * would land on, so measure the target. Record the date you checked alongside
 * the entry; headers change.
 *
 * Pure and DOM-free, so scripts/core-tests.mjs can assert it against hostile
 * controls under plain Node.
 */

/**
 * Resolve a possibly-relative URL. A bare word like `not-a-url` IS a valid
 * relative URL and resolves against the origin -- the same rule that makes
 * `/demo/graph.html` work.
 * @returns {URL|null}
 */
export function resolveUrl(href, origin) {
  try {
    return new URL(href, origin)
  } catch {
    return null
  }
}

/**
 * @param {string} href
 * @param {{allow?: string[], origin: string}} opts
 *   allow: exact hostnames, or a LEADING DOT meaning "subdomain of, at any
 *   depth" (and the bare domain itself).
 * @returns {boolean}
 */
export function isFrameable(href, { allow = [], origin } = {}) {
  const url = resolveUrl(href, origin)
  if (!url) return false
  // Scheme-check before anything reaches frame.src.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

  // A site can always frame its own pages, and no suffix rule would catch
  // them reliably.
  const base = resolveUrl(origin, origin)
  if (base && url.origin === base.origin) return true

  const host = url.hostname.toLowerCase()
  for (const raw of allow) {
    if (typeof raw !== 'string' || !raw) continue
    const entry = raw.trim().toLowerCase()
    if (entry.startsWith('.')) {
      // ".example.com" admits example.com and any depth of subdomain, and
      // must NOT admit x.example.com.evil.com -- which endsWith on the dotted
      // form correctly refuses.
      if (host === entry.slice(1) || host.endsWith(entry)) return true
    } else if (host === entry) {
      // Exact only. A bare "example.com" must not admit "evilexample.com".
      return true
    }
  }
  return false
}
