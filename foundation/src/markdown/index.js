import { CubbyError } from '#core'
import { render } from './render.js'
import { injectStyles } from './styles.js'

/**
 * Opt-in markdown module: safe rendering, and nothing else. Loaded per-app via
 * <script src="/js/markdown.js" defer></script> after core.js, which attaches
 * it as cubby.markdown. render() is pure and runs in Node.
 *
 * The editor used to live here. It moved to /js/editor.js so an app that only
 * renders markdown -- a comment list, a README view -- stops paying for a
 * textarea it never mounts.
 */

/** Point a caller at the tag they are missing, rather than at `undefined`. */
function moved(name) {
  return new CubbyError(
    'editor_moved',
    `cubby.markdown.${name} moved to cubby.editor. Add ` +
      '<script src="/js/editor.js" defer></script> after markdown.js.'
  )
}

/**
 * Build the cubby.markdown facade.
 * @param {object} cubby the namespace, so the moved members can forward to it
 * @returns {{render: Function, injectStyles: Function}}
 */
export function createMarkdown(cubby) {
  const md = { render, injectStyles }

  // Forwarding accessors for the two members that moved. A page that loads
  // editor.js keeps working through the old names; a page that does not gets
  // an error naming the tag it needs instead of "undefined is not a function"
  // thrown from inside a minified bundle. Removable once no caller uses them.
  for (const [name, resolve] of [
    ['editor', () => cubby?.editor],
    ['attachImageUpload', () => cubby?.editor?.attachImageUpload],
  ]) {
    Object.defineProperty(md, name, {
      configurable: true,
      enumerable: false,
      get() {
        const fn = resolve()
        if (fn) return fn
        throw moved(name)
      },
    })
  }

  return md
}

export { render }
export default createMarkdown
