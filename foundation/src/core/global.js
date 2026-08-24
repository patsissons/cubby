import { attachCore, FOUNDATION_NAMESPACE } from './index.js'

// IIFE entry: create (or adopt) window.cubby and publish core onto it.
if (typeof window !== 'undefined') {
  window[FOUNDATION_NAMESPACE] = attachCore(window[FOUNDATION_NAMESPACE] || {})
}
