import { CubbyError, toCubbyError } from '#core'

/**
 * Paste/drop image upload for a textarea, GitHub PR editor style: an
 * "Uploading…" placeholder goes in at the cursor immediately and is
 * swapped for real image markdown when the cubby.fs upload finishes.
 */

// SVG is deliberately absent: PocketBase serves stored files with their
// declared content type, and SVG can script on the instance origin.
const EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

/** @param {object} cubby the global cubby (needs fs + identity) */
export function createAttachImageUpload(cubby) {
  /**
   * Wire paste + drag/drop image upload onto an existing textarea.
   * Uploads require a signed-in user; when signed out onError receives a
   * CubbyError with code auth_required and nothing is inserted.
   * @param {HTMLTextAreaElement} textarea
   * @param {{
   *   pathPrefix?: string,
   *   maxBytes?: number,
   *   onUploadStart?: (info: {name: string, path: string}) => void,
   *   onUpload?: (info: {name: string, path: string, url: string}) => void,
   *   onError?: (err: CubbyError) => void,
   * }} [opts]
   * @returns {() => void} detach function
   */
  return function attachImageUpload(textarea, opts = {}) {
    if (typeof document === 'undefined') {
      throw new CubbyError('bad_request', 'attachImageUpload requires a DOM')
    }
    const pathPrefix = opts.pathPrefix || 'uploads/'
    const maxBytes = opts.maxBytes || 10 * 1024 * 1024
    const onUploadStart = opts.onUploadStart || (() => {})
    const onUpload = opts.onUpload || (() => {})
    // A genuine upload failure with no handler still logs -- that is a real
    // error a developer needs to see. What must never log is the ABSENCE of a
    // platform, and that case never reaches here: the editor does not wire
    // uploads at all without one.
    const onError = opts.onError || ((err) => console.error('[cubby] image upload failed:', err))

    // setRangeText keeps the browser undo stack (assigning .value would
    // clear it) but does not fire input — dispatch it so previews update.
    function edited() {
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    }

    function insert(text) {
      textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end')
      edited()
    }

    function replace(placeholder, replacement) {
      // Re-read value at swap time: the user kept typing during the await.
      const index = textarea.value.indexOf(placeholder)
      if (index === -1) return false
      textarea.setRangeText(replacement, index, index + placeholder.length, 'preserve')
      edited()
      return true
    }

    async function upload(file) {
      const user = cubby.identity?.user
      if (!user) {
        onError(new CubbyError('auth_required', 'sign in to upload images'))
        return
      }
      if (file.size > maxBytes) {
        onError(new CubbyError('file_too_large', `image exceeds ${maxBytes} bytes`))
        return
      }
      const ext = EXT[file.type]
      // Unique token in the URL slot: concurrent pastes of same-named
      // images stay distinguishable, and the swap search has one match.
      const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
      const name = (file.name || `image.${ext}`).replace(/[[\]()\n\r]/g, '')
      const placeholder = `![Uploading ${name}…](cubby-upload:${token})`
      const path = `${pathPrefix}${user.id}/${token}.${ext}`
      insert(placeholder)
      onUploadStart({ name, path })
      try {
        const meta = await cubby.fs.write(path, file)
        // url fallback covers forks whose foundation predates write().url
        const url = meta.url || (await cubby.fs.url(path))
        // The file exists even if the user deleted the placeholder, so
        // onUpload still fires when the swap finds nothing to replace.
        replace(placeholder, `![${name}](${url})`)
        onUpload({ name, path, url })
      } catch (err) {
        replace(placeholder, '')
        onError(toCubbyError(err, 'upload_failed'))
      }
    }

    function onPaste(event) {
      const files = Array.from(event.clipboardData?.items || [])
        .filter((item) => item.kind === 'file' && EXT[item.type])
        .map((item) => item.getAsFile())
        .filter(Boolean)
      // Without an image the paste stays native so text paste, undo
      // history, and IME composition keep working.
      if (!files.length) return
      event.preventDefault()
      for (const file of files) upload(file)
    }

    function onDragOver(event) {
      event.preventDefault()
    }

    function onDrop(event) {
      const files = Array.from(event.dataTransfer?.files || []).filter((f) => EXT[f.type])
      if (!files.length) return
      event.preventDefault()
      for (const file of files) upload(file)
    }

    textarea.addEventListener('paste', onPaste)
    textarea.addEventListener('dragover', onDragOver)
    textarea.addEventListener('drop', onDrop)
    return () => {
      textarea.removeEventListener('paste', onPaste)
      textarea.removeEventListener('dragover', onDragOver)
      textarea.removeEventListener('drop', onDrop)
    }
  }
}
