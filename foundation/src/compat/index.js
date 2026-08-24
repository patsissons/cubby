import { attachCore, FOUNDATION_NAMESPACE } from '#core'
import { attachPlatform } from '../platform/index.js'

/**
 * DEPRECATED. The all-in-one bundle: core + platform in one file, which is
 * what /js/foundation.js was before the split. Use core.js + platform.js.
 *
 * This keeps building, and must keep building, for as long as anything might
 * still request it. phio deploys are additive -- deleted files never leave the
 * server -- and PocketHost's CDN caches per URL for ~4h, so a page cached
 * before the migration will go on asking for /js/foundation.js with no core.js
 * tag beside it. The IIFE build therefore inlines core rather than reading it
 * off window.cubby: it has to work standalone.
 */

export default attachPlatform(attachCore({}))
export { CubbyError } from '#core'
export { FOUNDATION_NAMESPACE }
