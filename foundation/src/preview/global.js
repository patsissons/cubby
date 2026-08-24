import { requireCore } from '#core'
import { createPreview } from './index.js'

// IIFE entry. core only -- the allowlist may come from cubby.config when the
// platform happens to be loaded, but nothing here requires it.
if (typeof window !== 'undefined') {
  const ns = requireCore('preview.js')
  if (ns) ns.preview = createPreview(ns)
}
