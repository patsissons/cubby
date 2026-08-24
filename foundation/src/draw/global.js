import { requireCore } from '#core'
import { createDraw } from './index.js'

// IIFE entry. core is a hard dependency; the PLATFORM is optional and sensed
// at call time -- with no rooms this degrades to single-player (your own marks,
// your own puck) and says nothing about it.
if (typeof window !== 'undefined') {
  const ns = requireCore('draw.js')
  if (ns) ns.draw = createDraw(ns)
}
