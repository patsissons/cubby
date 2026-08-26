import { createAttachImageUpload } from './upload.js'
import { createEditor as buildEditor } from './editor.js'

/**
 * Opt-in editor module: a markdown textarea with live preview and
 * paste/drop image upload. Loaded per-app via
 * <script src="/js/editor.js" defer></script> after core.js and markdown.js,
 * which attaches it as cubby.editor.
 *
 * It renders its preview through cubby.markdown.render -- read off the
 * namespace at call time, never imported -- so the renderer is shared rather
 * than duplicated, and what you see while typing is exactly what gets stored.
 *
 * The platform is OPTIONAL. With no cubby.fs / cubby.identity this degrades to
 * a plain composer with the preview still working, and says nothing about it.
 *
 * @param {object} cubby the namespace (upload needs fs + identity when present)
 * @returns {Function} editor(target, options) -> handle
 */
export function createEditor(cubby) {
  const attachImageUpload = createAttachImageUpload(cubby)
  const editor = buildEditor(cubby, attachImageUpload)
  // The low-level helper hangs off the mount function, so cubby.editor is one
  // name carrying both. cubby.markdown.attachImageUpload forwards here.
  editor.attachImageUpload = attachImageUpload
  return editor
}

export default createEditor
