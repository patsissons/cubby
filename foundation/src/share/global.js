import { requireCore } from '#core'
import { createShare } from './index.js'

// IIFE entry. core only -- the stack shares a URL the app already knows;
// nothing here touches PocketBase.
if (typeof window !== 'undefined') {
  const ns = requireCore('share.js')
  if (ns) ns.share = createShare()
}
