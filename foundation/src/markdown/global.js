import { createMarkdown } from './index.js'

// Both scripts load with defer, and defer scripts execute in document
// order — so require foundation.js to have run already rather than
// polling for it. Apps list the tags foundation first, markdown second.
if (typeof window !== 'undefined') {
  if (window.cubby) {
    window.cubby.markdown = createMarkdown(window.cubby)
  } else {
    console.error('[cubby] markdown.js requires foundation.js to load first (both defer, foundation before markdown)')
  }
}
