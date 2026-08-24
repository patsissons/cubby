import { requireCore } from '#core'
import { attachPlatform } from './index.js'

// IIFE entry: layer the platform onto the window.cubby that core.js created.
// core is a HARD dependency (every facade throws CubbyError), so its absence
// is a developer error worth one console.error -- unlike a missing platform,
// which is a supported configuration and stays silent.
if (typeof window !== 'undefined') {
  const ns = requireCore('platform.js')
  if (ns) attachPlatform(ns)
}
