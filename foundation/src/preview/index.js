import { widget, injectStyle, ensureTokens } from '#core'
import { STYLES } from './styles.js'
import { isFrameable, resolveUrl } from './frameable.js'

/**
 * Hover a link, see the page: a popover anchored under it with the title and
 * an Open link across the top and the page itself in an iframe underneath.
 *
 * See ./frameable.js for the constraint the whole design follows from --
 * a blocked frame is undetectable from JavaScript, so framing is an allowlist
 * of measured hosts rather than a try-and-fall-back.
 */

const SHOW_MS = 900
const HIDE_MS = 220
const UNLOAD_MS = 4000
const FRAME_TIMEOUT_MS = 4000

export function createPreview(cubby) {
  /**
   * @param {string|Element} target the delegation root
   * @param {{
   *   allow?: string[], selector?: string, delay?: number, hideDelay?: number,
   *   unloadDelay?: number, scripts?: boolean, describe?: (el: Element) => object,
   * }} [options]
   */
  return widget('preview', (ctx, root, options = {}) => {
    const doc = root.ownerDocument
    const win = doc.defaultView
    ensureTokens()
    injectStyle('preview', STYLES)

    const selector = options.selector || 'a[href]'
    const showMs = options.delay ?? SHOW_MS
    const hideMs = options.hideDelay ?? HIDE_MS
    const unloadMs = options.unloadDelay ?? UNLOAD_MS
    const allow = options.allow || cubby?.config?.preview?.frameable || []
    const origin = win.location.origin

    const pop = doc.createElement('div')
    pop.className = 'cubby-preview'
    pop.hidden = true
    doc.body.appendChild(pop)
    ctx.own(() => pop.remove())

    /** The element the popover currently belongs to. */
    let owner = null
    /**
     * ONE timer for opening and closing, and the sharing IS the mechanism:
     * mouseout on the trigger schedules the hide, mouseenter on the popover
     * clears that same timer. Two timers look tidier and silently make the
     * Open link unreachable, because nothing would cancel the pending close
     * as the pointer travels toward it.
     */
    let timer = null
    let unloadTimer = null
    let frameTimer = null

    const clearTimer = () => {
      if (timer) win.clearTimeout(timer)
      timer = null
    }
    ctx.own(clearTimer)
    ctx.own(() => win.clearTimeout(unloadTimer))
    ctx.own(() => win.clearTimeout(frameTimer))

    function describe(el) {
      const custom = options.describe?.(el)
      return {
        title: custom?.title ?? el.getAttribute('data-preview-title') ?? el.textContent.trim(),
        description: custom?.description ?? el.getAttribute('data-preview-description') ?? '',
        href: custom?.href ?? el.getAttribute('href'),
      }
    }

    /** Built with DOM calls and textContent -- never innerHTML plus an escaper. */
    function card({ title, description, href, url, frameable }) {
      pop.replaceChildren()

      const head = doc.createElement('div')
      head.className = 'cubby-preview-head'
      const heading = doc.createElement('span')
      heading.className = 'cubby-preview-title'
      heading.textContent = title || url?.hostname || 'Preview'
      head.appendChild(heading)

      // A refused scheme gets the card with no live link.
      if (url) {
        const open = doc.createElement('a')
        open.className = 'cubby-preview-open'
        open.href = href
        open.textContent = 'Open'
        open.rel = 'noopener noreferrer'
        head.appendChild(open)
      }
      pop.appendChild(head)

      if (frameable) {
        const wrap = doc.createElement('div')
        wrap.className = 'cubby-preview-frame-wrap'
        const overlay = doc.createElement('div')
        overlay.className = 'cubby-preview-overlay'
        overlay.textContent = 'loading preview...'
        const frame = doc.createElement('iframe')
        frame.className = 'cubby-preview-frame'
        frame.setAttribute('title', title || 'Preview')
        frame.setAttribute('loading', 'lazy')
        frame.setAttribute('referrerpolicy', 'no-referrer')
        // sandbox="" by default: with scripts on, previewing a page that
        // itself loads this library gets you a nested nav bar, a second modal,
        // and a stray socket join into that page's room. Never pair
        // allow-scripts with allow-same-origin -- together they let a
        // same-origin framed document remove its own sandbox attribute.
        frame.setAttribute('sandbox', options.scripts ? 'allow-scripts' : '')
        // NO error listener, deliberately: a blocked frame fires none. The
        // only failure path there can be is this timeout.
        frame.addEventListener('load', () => {
          win.clearTimeout(frameTimer)
          overlay.remove()
        })
        wrap.append(frame, overlay)
        pop.appendChild(wrap)

        win.clearTimeout(frameTimer)
        frameTimer = win.setTimeout(() => {
          // Only if the overlay is still on the page.
          if (overlay.isConnected) {
            overlay.textContent = 'still loading; the site may be refusing to embed'
            overlay.setAttribute('data-slow', '')
          }
        }, FRAME_TIMEOUT_MS)
        return frame
      }

      if (description) {
        const d = doc.createElement('div')
        d.className = 'cubby-preview-description'
        d.textContent = description
        pop.appendChild(d)
      }
      // Rendering nothing here reads as a broken feature rather than as a page
      // that will not embed, so always say which host refused and why.
      const note = doc.createElement('div')
      note.className = 'cubby-preview-note'
      note.textContent = url
        ? `${url.hostname} does not allow embedding.`
        : 'That link cannot be previewed.'
      pop.appendChild(note)
      return null
    }

    function place(el) {
      const rect = el.getBoundingClientRect()
      const width = pop.offsetWidth || 432
      const height = pop.offsetHeight || 360
      // Clamping is asymmetric on purpose: horizontally the popover is kept
      // inside the viewport, but vertically it is clamped to the VIEWPORT
      // ALONE rather than to anything nearer. A tall popover over a trigger
      // low on screen would otherwise have nowhere to go and lose its last
      // line -- truncated text is worse than overlapping something by a few
      // pixels.
      let left = rect.left
      if (left + width > win.innerWidth - 8) left = win.innerWidth - width - 8
      if (left < 8) left = 8
      let top = rect.bottom + 8
      if (top + height > win.innerHeight - 8) top = rect.top - height - 8
      if (top < 8) top = 8
      pop.style.left = `${Math.round(left)}px`
      pop.style.top = `${Math.round(top)}px`
    }

    function show(el) {
      const { title, description, href } = describe(el)
      const url = resolveUrl(href, origin)
      const live = url && (url.protocol === 'http:' || url.protocol === 'https:') ? url : null
      const frameable = isFrameable(href, { allow, origin })

      owner = el
      win.clearTimeout(unloadTimer)
      const frame = card({ title, description, href, url: live, frameable })

      pop.hidden = false
      place(el)
      // src goes on only AFTER the popover is laid out, and there is only ever
      // one iframe: a list of a few hundred links would otherwise load a few
      // hundred documents.
      if (frame && live) frame.setAttribute('src', live.href)
      pop.setAttribute('data-shown', '')
    }

    /** Empties the popover, which tears the framed document down. */
    function hide() {
      clearTimer()
      owner = null
      pop.removeAttribute('data-shown')
      pop.hidden = true
      win.clearTimeout(frameTimer)
      // Drop the framed document shortly after hiding, so a quick re-hover of
      // the same link stays instant.
      win.clearTimeout(unloadTimer)
      unloadTimer = win.setTimeout(() => {
        if (!owner) pop.replaceChildren()
      }, unloadMs)
    }

    function scheduleShow(el) {
      clearTimer()
      // The dwell delay applies to focus too: opening instantly on focus fires
      // a document load at every tab stop through a list.
      timer = win.setTimeout(() => show(el), showMs)
    }

    function scheduleHide(el) {
      clearTimer()
      timer = win.setTimeout(() => {
        // Guarded: a deferred hide fires only while the popover still belongs
        // to the element that scheduled it, so a stale close cannot kill a
        // popover that has since opened for another link.
        if (owner === el || owner === null) hide()
      }, hideMs)
    }

    const linkFrom = (event) =>
      event.target instanceof win.Element ? event.target.closest(selector) : null

    // Delegated triggers take mouseover/mouseout because those BUBBLE;
    // attach() below takes mouseenter/mouseleave because those do not. A
    // synthetic mouseenter on a delegated link reaches nothing.
    ctx.on(root, 'mouseover', (e) => {
      const el = linkFrom(e)
      if (el) scheduleShow(el)
    })
    ctx.on(root, 'mouseout', (e) => {
      const el = linkFrom(e)
      if (el) scheduleHide(el)
    })
    ctx.on(root, 'focusin', (e) => {
      const el = linkFrom(e)
      if (el) scheduleShow(el)
    })
    ctx.on(root, 'focusout', (e) => {
      const el = linkFrom(e)
      if (el) scheduleHide(el)
    })

    // Entering the popover clears the SAME timer the trigger's mouseout set.
    // This is the only reason the Open link can be clicked at all.
    ctx.on(pop, 'mouseenter', clearTimer)
    ctx.on(pop, 'mouseleave', () => scheduleHide(owner))

    // Position is computed against the trigger at open time, so it is stale
    // the moment the page moves. Dismissing is honest; repositioning every
    // frame is not worth it for something this transient.
    ctx.on(doc, 'keydown', (e) => {
      if (e.key === 'Escape') hide()
    })
    ctx.on(
      doc,
      'scroll',
      (e) => {
        // Capture phase, so a nested scroll container cannot leave a stale
        // popover behind. Node.contains() throws a TypeError on anything that
        // is not a Node, and window is a legitimate scroll target.
        const t = e.target
        if (t instanceof win.Node && pop.contains(t)) return
        hide()
      },
      { capture: true, passive: true }
    )
    ctx.on(win, 'resize', hide)

    /**
     * Wire one element directly, for a link outside the delegation root.
     * @returns {() => void} disposer
     */
    function attach(el, opts = {}) {
      const enter = () => scheduleShow(el)
      const leave = () => scheduleHide(el)
      const describeOne = opts.describe
      if (describeOne) el.__cubbyPreviewDescribe = describeOne
      el.addEventListener('mouseenter', enter)
      el.addEventListener('mouseleave', leave)
      el.addEventListener('focus', enter)
      el.addEventListener('blur', leave)
      const dispose = () => {
        el.removeEventListener('mouseenter', enter)
        el.removeEventListener('mouseleave', leave)
        el.removeEventListener('focus', enter)
        el.removeEventListener('blur', leave)
      }
      ctx.own(dispose)
      return dispose
    }

    // `element` is reserved by the widget contract for the MOUNT TARGET, so
    // the popover gets its own name rather than being silently overridden.
    return { attach, show, hide, popover: pop, isFrameable: (href) => isFrameable(href, { allow, origin }) }
  })
}

export { isFrameable, resolveUrl }
export default createPreview
