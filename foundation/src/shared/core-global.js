/**
 * What the `#core` specifier resolves to in IIFE widget bundles.
 *
 * core.js publishes the canonical helpers onto window.cubby; every other IIFE
 * bundle reads them back off it rather than bundling its own copy. That is the
 * entire mechanism behind `err instanceof cubby.CubbyError` holding across
 * bundles.
 *
 * NEVER add a local fallback class here. A duplicate class is precisely the
 * bug this file exists to kill: the markdown bundle used to import
 * ../errors.js directly, so it shipped a second CubbyError and every error
 * cubby.markdown threw failed an instanceof check against cubby.CubbyError.
 * scripts/core-tests.mjs asserts no widget bundle contains the class.
 *
 * The ESM builds do not use this file at all — there `#core` stays a real
 * external `import … from './core.esm.js'`, which Node's module map dedupes.
 */

const ns = (typeof window !== 'undefined' && window.cubby) || null

// Captured once at load. defer scripts execute in document order, so core.js
// has already published these by the time a widget bundle evaluates. Optional
// chaining rather than a throw, so a mis-ordered page reaches requireCore()'s
// actionable message instead of dying on an opaque TypeError.
export const CubbyError = ns?.CubbyError
export const toCubbyError = ns?.toCubbyError
export const escapeHtml = ns?.escapeHtml
export const sanitizeUrl = ns?.sanitizeUrl
export const injectStyle = ns?.injectStyle
export const ensureTokens = ns?.ensureTokens
export const widget = ns?.widget
export const FOUNDATION_NAMESPACE = 'cubby'

/**
 * Hard-dependency gate for a widget's global.js entry.
 *
 * Hard deps (core, and markdown for the editor) are developer errors: log once
 * with the corrective tag order, attach nothing, and do not throw — later
 * <script> tags must still run. Optional deps (the PocketBase platform) are
 * NOT checked here; their absence is a supported configuration and must stay
 * completely silent.
 *
 * @param {string} self e.g. 'editor.js'
 * @param {...string} needs extra namespace keys that must already exist
 * @returns {object|null} the namespace, or null when something is missing
 */
export function requireCore(self, ...needs) {
  const missing = []
  if (!ns?.CubbyError) missing.push('core.js')
  for (const key of needs) if (!ns?.[key]) missing.push(`${key}.js`)
  if (!missing.length) return ns
  console.error(
    `[cubby] ${self} needs ${missing.join(' + ')} loaded first. Tag order is ` +
      'core.js, platform.js, markdown.js, editor.js, then your app.js — all defer.'
  )
  return null
}
