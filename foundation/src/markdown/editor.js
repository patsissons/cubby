import { CubbyError } from '../errors.js'
import { render } from './render.js'
import { injectStyles } from './styles.js'

/**
 * Markdown editor factory: a plain textarea plus a live preview, in one of
 * two layouts. 'tabs' (default) is GitHub-style Write | Preview; 'split'
 * shows the preview beside the textarea, re-rendering as you type
 * (stacked on narrow screens). Paste/drop image upload is wired in unless
 * opts.upload is false.
 */

/** @param {object} cubby @param {Function} attachImageUpload */
export function createEditor(cubby, attachImageUpload) {
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
   *   onUploadStart?: (info: {name: string, path: string}) => void,
   *   onUpload?: (info: {name: string, path: string, url: string}) => void,
   *   onError?: (err: CubbyError) => void,
   * }} [opts]
   * @returns {{value: string, textarea: HTMLTextAreaElement, focus: () => void, refresh: () => void, destroy: () => void}}
   */
  return function editor(container, opts = {}) {
    if (typeof document === 'undefined') {
      throw new CubbyError('bad_request', 'editor requires a DOM')
    }
    injectStyles()
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
        ? render(value, { linkTarget: opts.linkTarget })
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
      writeTab.addEventListener('click', () => select(false))
      previewTab.addEventListener('click', () => select(true))
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
    textarea.addEventListener('input', () => {
      onChange(textarea.value)
      if (mode === 'split') {
        clearTimeout(timer)
        timer = setTimeout(renderPreview, debounceMs)
      }
    })

    let detach = () => {}
    if (opts.upload !== false) {
      detach = attachImageUpload(textarea, {
        ...(opts.upload || {}),
        onUploadStart: opts.onUploadStart,
        onUpload: opts.onUpload,
        onError: opts.onError,
      })
    }

    container.replaceChildren(root)

    return {
      get value() {
        return textarea.value
      },
      set value(v) {
        textarea.value = String(v)
        onChange(textarea.value)
        if (mode === 'split' || (mode === 'tabs' && !previewEl.hidden)) renderPreview()
      },
      textarea,
      focus() {
        textarea.focus()
      },
      refresh() {
        renderPreview()
      },
      destroy() {
        clearTimeout(timer)
        detach()
        root.remove()
      },
    }
  }
}
