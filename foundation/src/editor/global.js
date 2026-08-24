import { requireCore } from '#core'
import { createEditor } from './index.js'

// IIFE entry. markdown is a HARD dependency -- the preview renders through
// cubby.markdown.render, and sharing one renderer is the whole point. The
// PLATFORM is optional and is sensed at call time inside the editor, so its
// absence stays silent.
if (typeof window !== 'undefined') {
  const ns = requireCore('editor.js', 'markdown')
  if (ns) ns.editor = createEditor(ns)
}
