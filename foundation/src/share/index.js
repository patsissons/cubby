import { widget, injectStyle, ensureTokens, CubbyError } from '#core'
import { STYLES } from './styles.js'
import { qrcode } from './qrcode.js'

/**
 * The share stack: a row of compact icon buttons for one shareable URL -
 * share (native sheet, copy fallback), QR code (dialog), copy link, and,
 * when the app passes handlers, edit and delete. The pattern started life in
 * the go app; this widget is the extraction so any app can attach it in one
 * call:
 *
 *   cubby.share('#actions', {
 *     url: `${location.origin}/hang/${slug}`,
 *     label: `/hang/${slug}`,          // aria labels + QR heading (default: url)
 *     title: event.title,              // native share sheet title (default: label)
 *     onEdit: () => { ... },           // presence of the handler shows the button
 *     onDelete: () => { ... },         // ditto; confirm() is the app's business
 *   })
 *
 * Guests see three buttons; owners see five. The widget never decides who is
 * an owner - the app expresses that by passing (or not passing) the handlers.
 */

// Static, widget-authored icon markup (feather icons, MIT). This innerHTML
// carries no user-supplied content; labels and URLs go through textContent
// and attributes only.
const ICONS = {
  share:
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
    '<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  qr:
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>' +
    '<rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M21 17v4h-4"/>',
  link:
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
    '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  edit: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  trash:
    '<polyline points="3 6 5 6 21 6"/>' +
    '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
    '<line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
}

const svg = (paths) =>
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
  `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

export function createShare() {
  return widget('share', (ctx, root, options = {}) => {
    if (!options.url) throw new CubbyError('bad_request', 'cubby.share needs a url')
    const doc = root.ownerDocument
    const win = doc.defaultView
    ensureTokens()
    injectStyle('share', STYLES)

    const url = String(options.url)
    const label = options.label || url
    const title = options.title || label

    const stack = doc.createElement('span')
    stack.className = 'cubby-share'

    const button = (icon, aria) => {
      const btn = doc.createElement('button')
      btn.type = 'button'
      btn.className = 'cubby-share-btn'
      btn.title = aria
      btn.setAttribute('aria-label', aria)
      btn.innerHTML = svg(ICONS[icon])
      stack.append(btn)
      return btn
    }

    async function copy(feedback) {
      try {
        await win.navigator.clipboard.writeText(url)
        feedback.classList.add('ok')
        win.setTimeout(() => feedback.classList.remove('ok'), 800)
      } catch (err) {
        console.error('[cubby.share] copy failed:', err)
      }
    }

    const shareBtn = button('share', `share ${label}`)
    ctx.on(shareBtn, 'click', async () => {
      // The native sheet where it exists (mobile, some desktops); otherwise
      // sharing degrades to copying, which is what people reach for anyway.
      if (typeof win.navigator.share === 'function') {
        await win.navigator.share({ title, url }).catch(() => {})
      } else {
        await copy(shareBtn)
      }
    })

    const qrBtn = button('qr', `QR code for ${label}`)
    ctx.on(qrBtn, 'click', () => {
      const qr = qrcode(0, 'M')
      qr.addData(url)
      qr.make()
      const dialog = doc.createElement('dialog')
      dialog.className = 'cubby-share-qr'
      const heading = doc.createElement('h2')
      heading.textContent = label
      const img = doc.createElement('img')
      img.src = qr.createDataURL(6, 4)
      img.alt = `QR code for ${url}`
      const urlLine = doc.createElement('p')
      urlLine.className = 'cubby-share-qr-url'
      urlLine.textContent = url
      const close = doc.createElement('button')
      close.type = 'button'
      close.textContent = 'close'
      const closeRow = doc.createElement('p')
      closeRow.append(close)
      dialog.append(heading, img, urlLine, closeRow)
      close.addEventListener('click', () => dialog.close())
      dialog.addEventListener('close', () => dialog.remove())
      doc.body.append(dialog)
      // jsdom (and older engines) lack showModal; open the light way there.
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
      ctx.own(() => dialog.remove())
    })

    const linkBtn = button('link', `copy link to ${label}`)
    ctx.on(linkBtn, 'click', () => copy(linkBtn))

    if (typeof options.onEdit === 'function') {
      ctx.on(button('edit', `edit ${label}`), 'click', options.onEdit)
    }
    if (typeof options.onDelete === 'function') {
      ctx.on(button('trash', `delete ${label}`), 'click', options.onDelete)
    }

    root.append(stack)
    ctx.own(() => stack.remove())

    return { element: stack, url }
  })
}
