import { CubbyError, toCubbyError } from '#core'

/**
 * Paste/drop/programmatic file upload for a textarea, GitHub PR editor
 * style: an "Uploading…" placeholder goes in at the cursor immediately and
 * is swapped for real markdown when the cubby.fs upload finishes — image
 * markdown for images, a plain link for everything else.
 */

// SVG is deliberately absent: PocketBase serves stored files with their
// declared content type, and SVG can script on the instance origin.
const EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

// Same origin-scripting rationale as the SVG exclusion above: these render
// inline on the instance origin, so they never upload through the editor.
const DENY_EXT = new Set(['svg', 'html', 'htm', 'xhtml', 'xml'])
const DENY_MIME = new Set([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'text/xml',
  'application/xml',
])

/** @param {File} file @returns {string} sanitized display name (never empty) */
function safeName(file) {
  const stripped = (file.name || '').replace(/[[\]()\n\r]/g, '')
  if (stripped) return stripped
  const ext = EXT[file.type]
  return ext ? `image.${ext}` : 'file.bin'
}

/** @param {File} file @param {string} name @returns {string} storage extension */
function extOf(file, name) {
  const mapped = EXT[file.type]
  if (mapped) return mapped
  const tail = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
  return /^[a-z0-9]{1,10}$/.test(tail) ? tail : 'bin'
}

/** @param {File} file @returns {boolean} false for inline-scriptable types */
function acceptable(file) {
  if (DENY_MIME.has(file.type)) return false
  return !DENY_EXT.has(extOf(file, safeName(file)))
}

/** @param {DragEvent} event @returns {boolean} is a file drag (not text) */
function draggingFiles(event) {
  return !!event.dataTransfer?.types?.includes?.('Files')
}

/** @param {object} cubby the global cubby (needs fs + identity) */
export function createAttachFileUpload(cubby) {
  /**
   * Wire paste + drag/drop file upload onto an existing textarea.
   * Uploads require a signed-in user; when signed out onError receives a
   * CubbyError with code auth_required and nothing is inserted.
   * @param {HTMLTextAreaElement} textarea
   * @param {{
   *   pathPrefix?: string,
   *   maxBytes?: number,
   *   dropTarget?: HTMLElement,
   *   dragClass?: string,
   *   onUploadStart?: (info: {name: string, path: string, kind: 'image' | 'file'}) => void,
   *   onUpload?: (info: {name: string, path: string, url: string, kind: 'image' | 'file'}) => void,
   *   onError?: (err: CubbyError) => void,
   * }} [opts]
   * @returns {(() => void) & {upload: (file: File) => Promise<void>}} detach
   *   function; detach.upload uploads one File programmatically (the
   *   editor's Attach button uses it)
   */
  return function attachFileUpload(textarea, opts = {}) {
    if (typeof document === 'undefined') {
      throw new CubbyError('bad_request', 'attachFileUpload requires a DOM')
    }
    const pathPrefix = opts.pathPrefix || 'uploads/'
    const maxBytes = opts.maxBytes || 10 * 1024 * 1024
    const target = opts.dropTarget || textarea
    const dragClass = opts.dragClass || ''
    const onUploadStart = opts.onUploadStart || (() => {})
    const onUpload = opts.onUpload || (() => {})
    // A genuine upload failure with no handler still logs -- that is a real
    // error a developer needs to see. What must never log is the ABSENCE of a
    // platform, and that case never reaches here: the editor does not wire
    // uploads at all without one.
    const onError = opts.onError || ((err) => console.error('[cubby] file upload failed:', err))

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
        onError(new CubbyError('auth_required', 'sign in to upload files'))
        return
      }
      // Paste/drop filter unacceptable files out before this, silently; the
      // picker path lands here directly, and an explicit choice deserves an
      // explicit answer.
      if (!acceptable(file)) {
        onError(new CubbyError('unsupported_type', `"${file.type || file.name}" can script on this origin, so the editor refuses it`))
        return
      }
      if (file.size > maxBytes) {
        onError(new CubbyError('file_too_large', `file exceeds ${maxBytes} bytes`))
        return
      }
      const kind = EXT[file.type] ? 'image' : 'file'
      // Unique token in the URL slot: concurrent pastes of same-named
      // files stay distinguishable, and the swap search has one match.
      const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
      const name = safeName(file)
      const bang = kind === 'image' ? '!' : ''
      const placeholder = `${bang}[Uploading ${name}…](cubby-upload:${token})`
      const path = `${pathPrefix}${user.id}/${token}.${extOf(file, name)}`
      insert(placeholder)
      onUploadStart({ name, path, kind })
      try {
        const meta = await cubby.fs.write(path, file)
        // url fallback covers forks whose foundation predates write().url
        const url = meta.url || (await cubby.fs.url(path))
        // The file exists even if the user deleted the placeholder, so
        // onUpload still fires when the swap finds nothing to replace.
        replace(placeholder, `${bang}[${name}](${url})`)
        onUpload({ name, path, url, kind })
      } catch (err) {
        replace(placeholder, '')
        onError(toCubbyError(err, 'upload_failed'))
      }
    }

    function onPaste(event) {
      const files = Array.from(event.clipboardData?.items || [])
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file) => file && acceptable(file))
      // Without an acceptable file the paste stays native so text paste,
      // undo history, and IME composition keep working.
      if (!files.length) return
      event.preventDefault()
      for (const file of files) upload(file)
    }

    // dragenter/dragleave fire in pairs for every child crossed, so a naive
    // toggle strobes the highlight; a depth counter keeps it steady.
    let dragDepth = 0
    function clearDrag() {
      dragDepth = 0
      if (dragClass) target.classList.remove(dragClass)
    }

    function onDragEnter(event) {
      if (!draggingFiles(event)) return
      dragDepth++
      if (dragClass) target.classList.add(dragClass)
    }

    function onDragLeave(event) {
      if (!draggingFiles(event)) return
      dragDepth--
      if (dragDepth <= 0) clearDrag()
    }

    function onDragOver(event) {
      event.preventDefault()
    }

    function onDrop(event) {
      clearDrag()
      const files = Array.from(event.dataTransfer?.files || []).filter(acceptable)
      if (!files.length) return
      event.preventDefault()
      for (const file of files) upload(file)
    }

    textarea.addEventListener('paste', onPaste)
    target.addEventListener('dragenter', onDragEnter)
    target.addEventListener('dragleave', onDragLeave)
    target.addEventListener('dragover', onDragOver)
    target.addEventListener('drop', onDrop)
    const detach = () => {
      textarea.removeEventListener('paste', onPaste)
      target.removeEventListener('dragenter', onDragEnter)
      target.removeEventListener('dragleave', onDragLeave)
      target.removeEventListener('dragover', onDragOver)
      target.removeEventListener('drop', onDrop)
      clearDrag()
    }
    detach.upload = upload
    return detach
  }
}
