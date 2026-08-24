import { attachCore, FOUNDATION_NAMESPACE } from '#core'
import { attachPlatform } from '../platform/index.js'

// DEPRECATED IIFE entry for /js/foundation.js -- see index.js.
if (typeof window !== 'undefined') {
  const ns = window[FOUNDATION_NAMESPACE]
  if (ns && ns._pb) {
    // platform.js already owns this page. Attaching again would be a no-op
    // anyway (attachPlatform guards on _pb), but say so: carrying both tags is
    // ~14KB of duplicate download for nothing.
    console.warn('[cubby] foundation.js ignored: platform.js is already loaded. Drop the foundation.js tag.')
  } else {
    window[FOUNDATION_NAMESPACE] = attachPlatform(attachCore(ns || {}))
  }
}
