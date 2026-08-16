import cubby, { FOUNDATION_NAMESPACE } from './index.js'

// IIFE entry: expose the foundation as window.cubby.
if (typeof window !== 'undefined') {
  window[FOUNDATION_NAMESPACE] = cubby
}
