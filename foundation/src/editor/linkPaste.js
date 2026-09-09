/**
 * Paste-a-URL-over-a-selection linkification, GitHub editor style: with text
 * selected, pasting a lone URL wraps the selection as [selection](url); with
 * no selection the paste stays native and the URL goes in as plain text.
 * Needs no platform -- this is pure text editing.
 */

const URL_RE = /^https?:\/\/\S+$/i

/**
 * @param {HTMLTextAreaElement} textarea
 * @returns {() => void} detach function
 */
export function attachLinkPaste(textarea) {
  function onPaste(event) {
    // A file paste belongs to the upload handler; registration order makes
    // it run first, and the item check covers it even when it is not wired.
    if (event.defaultPrevented) return
    if (Array.from(event.clipboardData?.items || []).some((item) => item.kind === 'file')) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    if (start === end) return
    const text = (event.clipboardData?.getData('text/plain') || '').trim()
    if (!URL_RE.test(text)) return
    event.preventDefault()
    const label = textarea.value.slice(start, end)
    // setRangeText keeps the undo stack; the synthetic input updates previews.
    textarea.setRangeText(`[${label}](${text})`, start, end, 'end')
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  }
  textarea.addEventListener('paste', onPaste)
  return () => textarea.removeEventListener('paste', onPaste)
}
