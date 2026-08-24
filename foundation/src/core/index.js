import { CubbyError, toCubbyError } from './errors.js'
import { escapeHtml, sanitizeUrl } from './html.js'
import { injectStyle, ensureTokens } from './styles.js'
import { widget } from './widget.js'

/**
 * cubby core: the namespace, the one canonical error type, escaping, and the
 * widget lifecycle. No PocketBase, no network, no DOM at module scope.
 *
 * Everything else in cubby layers on top of this — the PocketBase platform
 * (/js/platform.js) as much as any widget. That inversion is deliberate: nav,
 * graph, preview and a preview-only editor need no backend at all, so the
 * backend has to be the optional part.
 *
 * Loaded via <script src="/js/core.js" defer></script> before every other
 * cubby tag, or as an ES module from /js/core.esm.js.
 */

export const FOUNDATION_NAMESPACE = 'cubby'

export { CubbyError, toCubbyError, escapeHtml, sanitizeUrl, injectStyle, ensureTokens, widget }

/**
 * Is a PocketBase-backed platform present on this namespace?
 *
 * Widgets sense this at CALL time, never at load time, and treat `false` as a
 * supported configuration: degrade and stay silent. Absence is never reported
 * as a failure — a page deliberately serving markdown with no backend must not
 * log anything.
 *
 * @param {object} [ns]
 * @returns {boolean}
 */
export function hasPlatform(ns) {
  return !!(ns && ns.fs && ns.identity && ns._pb)
}

/**
 * Publish core onto a cubby namespace object.
 *
 * Non-clobbering: if the namespace already carries a CubbyError then an
 * earlier core.js (or the deprecated all-in-one foundation.js) owns this page,
 * and replacing the class would be the exact bug this module exists to
 * prevent — two CubbyError classes on one page means `instanceof` is false for
 * half the errors thrown.
 *
 * @param {object} [ns]
 * @returns {object} the same namespace, populated
 */
export function attachCore(ns = {}) {
  if (ns.CubbyError) return ns
  return Object.assign(ns, {
    // __CUBBY_VERSION__ is replaced by esbuild's define with the package version.
    version: typeof __CUBBY_VERSION__ === 'undefined' ? 'dev' : __CUBBY_VERSION__,
    CubbyError,
    toCubbyError,
    escapeHtml,
    sanitizeUrl,
    injectStyle,
    ensureTokens,
    widget,
    hasPlatform: () => hasPlatform(ns),
  })
}

export default attachCore
