import { attachCore } from '#core'
import { attachPlatform } from './index.js'

/**
 * ESM entry for /js/platform.esm.js: core plus platform, one namespace per
 * module instance.
 *
 * This lives apart from index.js on purpose. The namespace is built by a
 * top-level call, and index.js is imported by the IIFE build too -- so putting
 * it there would construct a throwaway namespace on every page load and, far
 * worse, trip attachPlatform's _pb guard so the real attach onto window.cubby
 * became a silent no-op.
 */
export default attachPlatform(attachCore({}))

export { attachPlatform } from './index.js'
export { CubbyError, FOUNDATION_NAMESPACE } from '#core'
