import { requireCore } from '#core'
import { createNav } from './index.js'

// IIFE entry. core only -- the bar needs no backend.
if (typeof window !== 'undefined') {
  const ns = requireCore('nav.js')
  if (ns) ns.nav = createNav(ns)
}
