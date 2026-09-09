import { CubbyError, widget } from '#core'
import { attachLinkPaste } from './linkPaste.js'
import { injectEditorStyles } from './styles.js'

/**
 * Markdown editor factory: a plain textarea plus a live preview, in one of
 * two layouts. 'tabs' (default) is GitHub-style Write | Preview; 'split'
 * shows the preview beside the textarea, re-rendering as you type
 * (stacked on narrow screens). Paste/drop/attach file upload is wired in
 * unless opts.upload is false, or unless there is no platform to upload to:
 * images become image markdown, any other file becomes a plain link, and the
 * whole editor is the drop target.
 *
 * A plain <textarea>, deliberately: no CodeMirror, no contenteditable. The
 * thing being edited is markdown and the thing that has to be right is the
 * paste handling; a textarea gets undo, spellcheck, mobile keyboards and
 * every accessibility affordance for free.
 *
 * render and injectStyles are read off cubby.markdown at CALL time rather
 * than imported, so this file bundles into /js/editor.js without dragging the
 * whole renderer in with it -- and so the preview renders through exactly the
 * same renderer the consumer uses for the saved value. That identity is the
 * point: what you see while typing is not an approximation of what gets
 * stored.
 */

/** @param {object} cubby @param {Function} attachFileUpload */
export function createEditor(cubby, attachFileUpload) {
  /**
   * @param {HTMLElement} container emptied and filled with the editor
   * @param {{
   *   value?: string,
   *   placeholder?: string,
   *   preview?: boolean | 'tabs' | 'split',
   *   previewDebounceMs?: number,
   *   rows?: number,
   *   linkTarget?: string,
   *   upload?: false | {pathPrefix?: string, maxBytes?: number},
   *   onChange?: (value: string) => void,
   *   onUploadStart?: (info: {name: string, path: string, kind: 'image' | 'file'}) => void,
   *   onUpload?: (info: {name: string, path: string, url: string, kind: 'image' | 'file'}) => void,
   *   onError?: (err: CubbyError) => void,
   * }} [opts]
   * @returns {{value: string, textarea: HTMLTextAreaElement, focus: () => void, refresh: () => void, destroy: () => void}}
   */
  return widget('editor', (ctx, container, opts = {}) => {
    if (typeof document === 'undefined') {
      throw new CubbyError('bad_request', 'editor requires a DOM')
    }
    const md = cubby.markdown
    if (!md) {
      throw new CubbyError('bad_request', 'the editor needs /js/markdown.js loaded before it')
    }
    // The preview area is styled by .cubby-markdown, which markdown.js owns;
    // the editor chrome is ours.
    md.injectStyles()
    injectEditorStyles()
    const mode = opts.preview === false ? 'none' : opts.preview === 'split' ? 'split' : 'tabs'
    const debounceMs = opts.previewDebounceMs ?? 150
    const onChange = opts.onChange || (() => {})

    const root = document.createElement('div')
    root.className = 'cubby-md-editor'

    const textarea = document.createElement('textarea')
    textarea.className = 'cubby-md-input'
    textarea.rows = opts.rows || 8
    textarea.value = opts.value || ''
    if (opts.placeholder) textarea.placeholder = opts.placeholder

    const previewEl = document.createElement('div')
    previewEl.className = 'cubby-md-preview cubby-markdown'

    function renderPreview() {
      const value = textarea.value
      previewEl.innerHTML = value.trim()
        ? md.render(value, { linkTarget: opts.linkTarget })
        : '<p class="cubby-md-empty">Nothing to preview</p>'
    }

    let writeTab = null
    let previewTab = null
    if (mode === 'tabs') {
      const tabs = document.createElement('div')
      tabs.className = 'cubby-md-tabs'
      tabs.setAttribute('role', 'tablist')
      const makeTab = (label, selected) => {
        const tab = document.createElement('button')
        tab.type = 'button'
        tab.className = 'cubby-md-tab'
        tab.setAttribute('role', 'tab')
        tab.setAttribute('aria-selected', String(selected))
        tab.textContent = label
        tabs.appendChild(tab)
        return tab
      }
      writeTab = makeTab('Write', true)
      previewTab = makeTab('Preview', false)
      const select = (showPreview) => {
        writeTab.setAttribute('aria-selected', String(!showPreview))
        previewTab.setAttribute('aria-selected', String(showPreview))
        textarea.hidden = showPreview
        previewEl.hidden = !showPreview
        if (showPreview) renderPreview()
        else textarea.focus()
      }
      ctx.on(writeTab, 'click', () => select(false))
      ctx.on(previewTab, 'click', () => select(true))
      previewEl.hidden = true
      root.append(tabs, textarea, previewEl)
    } else if (mode === 'split') {
      const split = document.createElement('div')
      split.className = 'cubby-md-split'
      split.append(textarea, previewEl)
      root.appendChild(split)
      renderPreview()
    } else {
      root.appendChild(textarea)
    }

    let timer = null
    ctx.on(textarea, 'input', () => {
      onChange(textarea.value)
      // A visible preview must track edits -- including the synthetic input
      // an async upload swap dispatches while the Preview tab is showing.
      if (mode === 'split' || (mode === 'tabs' && !previewEl.hidden)) {
        clearTimeout(timer)
        timer = setTimeout(renderPreview, debounceMs)
      }
    })
    ctx.own(() => clearTimeout(timer))

    // Every image this editor has successfully uploaded, in order -- and
    // every upload of any kind, in files.
    const images = []
    const files = []

    // Upload needs a platform to upload to. With none, this is simply a plain
    // composer -- silently. The platform's absence is a supported
    // configuration (a static page with no backend), never a failure to
    // report, so nothing is logged and no affordance is shown.
    if (opts.upload !== false && cubby.hasPlatform?.()) {
      const detach = attachFileUpload(textarea, {
        ...(opts.upload || {}),
        // The whole editor -- tabs, preview, footer -- takes drops, so a
        // file dragged anywhere onto it lands at the last caret position.
        dropTarget: root,
        dragClass: 'cubby-md-dragover',
        onUploadStart: opts.onUploadStart,
        onUpload: (info) => {
          files.push(info)
          if (info.kind === 'image') images.push(info)
          opts.onUpload?.(info)
        },
        onError: opts.onError,
      })
      ctx.own(detach)

      const footer = document.createElement('div')
      footer.className = 'cubby-md-footer'
      const picker = document.createElement('input')
      picker.type = 'file'
      picker.multiple = true
      picker.hidden = true
      const attach = document.createElement('button')
      attach.type = 'button'
      attach.className = 'cubby-md-attach'
      attach.textContent = 'Attach files'
      ctx.on(attach, 'click', () => picker.click())
      ctx.on(picker, 'change', () => {
        for (const file of Array.from(picker.files || [])) detach.upload(file)
        // Reset so choosing the same file again still fires change.
        picker.value = ''
      })
      footer.append(attach, picker)
      root.appendChild(footer)
    }

    // Registered after the upload wiring on purpose: a paste carrying a file
    // must reach the uploader, not the linkifier.
    ctx.own(attachLinkPaste(textarea))

    container.replaceChildren(root)
    ctx.own(() => root.remove())

    return {
      get value() {
        return textarea.value
      },
      set value(v) {
        this.setValue(v)
      },
      /** Replace the contents, firing onChange and refreshing a visible preview. */
      setValue(v) {
        textarea.value = String(v)
        onChange(textarea.value)
        if (mode === 'split' || (mode === 'tabs' && !previewEl.hidden)) renderPreview()
      },
      textarea,
      /** The preview element, so a caller can style or measure it. */
      preview: previewEl,
      /** Images uploaded through this editor: [{ name, path, url, kind }]. */
      images,
      /** Every upload through this editor, images included: [{ name, path, url, kind }]. */
      files,
      focus() {
        textarea.focus()
      },
      refresh() {
        renderPreview()
      },
    }
  })
}
