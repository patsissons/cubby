import { render } from './render.js'
import { injectStyles } from './styles.js'
import { createAttachImageUpload } from './upload.js'
import { createEditor } from './editor.js'

/**
 * Opt-in markdown module: safe rendering plus an editor with live preview
 * and paste-image upload. Loaded per-app via
 * <script src="/js/markdown.js" defer></script> after the foundation
 * script, which attaches it as cubby.markdown. render() is pure and works
 * in Node; the editor pieces need a DOM.
 */

/**
 * Build the cubby.markdown facade.
 * @param {object} cubby the global cubby (editor uploads need fs + identity)
 * @returns {{render: Function, editor: Function, attachImageUpload: Function, injectStyles: Function}}
 */
export function createMarkdown(cubby) {
  const attachImageUpload = createAttachImageUpload(cubby)
  return {
    render,
    editor: createEditor(cubby, attachImageUpload),
    attachImageUpload,
    injectStyles,
  }
}

export { render }
export default createMarkdown
