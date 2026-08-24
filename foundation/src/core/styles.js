import { TOKENS_CSS } from './tokens.js'

/**
 * Stylesheet injection for widgets.
 *
 * Nothing here runs at module scope — core must stay DOM-free at its top
 * level so it imports cleanly under plain Node. Widgets call these lazily,
 * on first mount.
 */

/**
 * Insert a keyed stylesheet once per document, PREPENDED to <head>.
 *
 * Prepending is the whole point: the host page's own stylesheet then comes
 * later in document order and wins every specificity tie, so adopting a
 * widget can never take a page's styling hostage. Appending (which is what
 * the markdown module used to do) silently inverts that.
 *
 * The key doubles as the idempotency marker: injectStyle('nav', …) writes
 * <style data-cubby-nav> and is a no-op if any [data-cubby-nav] already
 * exists — including one the host authored deliberately to pre-empt it.
 *
 * @param {string} key short module name, e.g. 'nav'
 * @param {string} css
 */
export function injectStyle(key, css) {
  if (typeof document === 'undefined') return
  const attr = `data-cubby-${key}`
  if (document.querySelector(`[${attr}]`)) return
  const el = document.createElement('style')
  el.setAttribute(attr, '')
  el.textContent = css
  document.head.prepend(el)
}

/**
 * Make sure the design tokens are defined, without fighting a page that
 * already defines them.
 *
 * cubby's own apps carry <link href="/css/tokens.css" data-cubby-tokens>, so
 * this is a no-op for them — which is the point. A page's chrome must never
 * depend on a runtime injection, or every navigation paints unstyled and
 * snaps into colour when the script lands. The injection exists only for
 * foreign hosts embedding a widget with no cubby stylesheet.
 *
 * Detection is structural (an attribute) rather than a getComputedStyle
 * probe for a token value: a deferred script can run before a pending
 * stylesheet has applied, so a computed probe races and loses at random.
 */
export function ensureTokens() {
  injectStyle('tokens', TOKENS_CSS)
}
