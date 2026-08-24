import { requireCore } from '#core'
import { createGraph } from './index.js'

// IIFE entry. core only. cubby.markdown is used for popover notes when it
// happens to be loaded, and plain text when it is not.
if (typeof window !== 'undefined') {
  const ns = requireCore('graph.js')
  if (ns) ns.graph = createGraph(ns)
}
