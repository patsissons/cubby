import { requireCore } from '#core'
import { createMarkdown } from './index.js'

// IIFE entry. Scripts load with defer and defer scripts execute in document
// order, so core.js has already run by the time this evaluates -- no polling,
// no ready event. Apps list core.js first, markdown.js after it.
if (typeof window !== 'undefined') {
  const ns = requireCore('markdown.js')
  if (ns) ns.markdown = createMarkdown(ns)
}
