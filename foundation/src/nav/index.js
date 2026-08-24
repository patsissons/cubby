import { widget, injectStyle, ensureTokens } from '#core'
import { STYLES, GLOBAL_STYLES } from './styles.js'

/**
 * A sticky two-row site bar.
 *
 * Row one is the declared pages plus a pinned action area on the right that
 * never scrolls. Row two is the CURRENT PAGE'S SECTIONS, derived from the DOM
 * rather than declared: a section opts in by carrying aria-labelledby pointing
 * at its own heading id. That one id is the accessible name, the jump target
 * and the nav label all at once, which makes "a nav entry pointing at a
 * section that no longer exists" unrepresentable rather than merely unlikely.
 */

const HEIGHT_PROPERTY = '--cubby-nav-height'

/** Directory of a path, treating /x/ and /x/index.html as the same page. */
function pageKey(href) {
  let pathname
  try {
    pathname = new URL(href, 'https://x.invalid/').pathname
  } catch {
    return null
  }
  return pathname.replace(/index\.html?$/, '').replace(/\/*$/, '/')
}

/**
 * @param {object} cubby the namespace (unused today; keeps the module factory
 *   shape uniform with markdown and editor)
 */
export function createNav() {
  /**
   * @param {string|Element} target where the bar mounts
   * @param {{
   *   pages?: Array<{href: string, label: string}>,
   *   sections?: string|Element,
   *   label?: string,
   *   globalRules?: boolean,
   *   band?: [number, number],
   * }} [options]
   */
  return widget('nav', (ctx, mount, options = {}) => {
    const doc = mount.ownerDocument
    const win = doc.defaultView
    ensureTokens()
    injectStyle('nav', STYLES)
    // Opt-out for a host that wants to own scroll-margin and scroll-behaviour.
    if (options.globalRules !== false) injectStyle('nav-global', GLOBAL_STYLES)

    const root = doc.createElement('nav')
    root.className = 'cubby-nav'
    root.setAttribute('aria-label', options.label || 'Site')

    // --- row one: declared pages + the pinned action area --------------------
    const pageRow = doc.createElement('div')
    pageRow.className = 'cubby-nav-row cubby-nav-pages'
    const pageScroll = doc.createElement('div')
    pageScroll.className = 'cubby-nav-scroll'
    const actions = doc.createElement('div')
    actions.className = 'cubby-nav-actions'

    const here = pageKey(win.location.href)
    for (const page of options.pages || []) {
      const a = doc.createElement('a')
      a.className = 'cubby-nav-pill'
      a.href = page.href
      a.textContent = page.label
      if (pageKey(page.href) === here) a.setAttribute('aria-current', 'page')
      pageScroll.appendChild(a)
    }
    pageRow.append(pageScroll, actions)
    root.appendChild(pageRow)

    // --- row two: sections, derived ------------------------------------------
    const sectionRow = doc.createElement('div')
    sectionRow.className = 'cubby-nav-row cubby-nav-sections'
    const sectionScroll = doc.createElement('div')
    sectionScroll.className = 'cubby-nav-scroll'
    sectionRow.appendChild(sectionScroll)
    root.appendChild(sectionRow)

    mount.replaceChildren(root)
    ctx.own(() => root.remove())

    /** @type {Map<string, HTMLElement>} heading id -> its pill */
    let pills = new Map()
    let observer = null
    let active = null

    function container() {
      const s = options.sections
      if (!s) return doc.querySelector('main') || doc.body
      return typeof s === 'string' ? doc.querySelector(s) : s
    }

    /** Sections that opted in, are still in the document, and are not hidden. */
    function discover() {
      const scope = container()
      if (!scope) return []
      return [...scope.querySelectorAll('[aria-labelledby]')]
        .map((section) => {
          const id = section.getAttribute('aria-labelledby')
          const heading = id && doc.getElementById(id)
          if (!heading) return null
          // A hidden section would scroll nowhere and never highlight, which
          // reads as a broken bar. Leave it out entirely.
          if (section.hidden || section.closest('[hidden]')) return null
          const label = section.getAttribute('data-nav-label') || heading.textContent.trim()
          return { id, section, label }
        })
        .filter(Boolean)
    }

    /**
     * Bring a pill into view inside its own scrolling row.
     *
     * Only when it is actually outside -- "nearest" semantics, not "centre".
     * Recentring on every activation would slide the whole row a little on each
     * section boundary, which is far more distracting than the occasional jump.
     *
     * Deliberately NOT scrollIntoView: that walks every scrollable ancestor and
     * can move the page itself, which is exactly what a nav bar must never do
     * to someone who is mid-scroll. Setting scrollLeft on the one container
     * cannot escape it. Offsets come from getBoundingClientRect rather than
     * offsetLeft, which would be measured against whatever the offsetParent
     * happens to be.
     */
    function revealPill(el, container) {
      if (!el || !container) return
      const box = container.getBoundingClientRect()
      // No layout yet (or a hidden bar): nothing sensible to compute.
      if (!box.width) return
      const pill = el.getBoundingClientRect()
      const pad = 16
      let delta = 0
      if (pill.left < box.left + pad) delta = pill.left - box.left - pad
      else if (pill.right > box.right - pad) delta = pill.right - box.right + pad
      if (!delta) return

      // Clamp into the container's real scroll range, then bail if that lands
      // where we already are. Without the lower clamp the FIRST pill -- flush
      // against the left edge, and so "within pad of it" -- asks to scroll to
      // -16 every time it activates. Browsers clamp that to 0, which is why it
      // is invisible rather than harmless.
      const max = Math.max(0, container.scrollWidth - container.clientWidth)
      const target = Math.max(0, Math.min(container.scrollLeft + delta, max || Infinity))
      if (target === container.scrollLeft) return

      const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ left: target, behavior: reduced ? 'auto' : 'smooth' })
      } else {
        container.scrollLeft = target
      }
    }

    function setActive(id) {
      if (id === active) return
      if (active) pills.get(active)?.removeAttribute('aria-current')
      active = id
      const pill = pills.get(id)
      pill?.setAttribute('aria-current', 'true')
      // The highlight is worthless if it is scrolled off the end of the row.
      revealPill(pill, sectionScroll)
    }

    /** Rebuild row two. Call after rendering sections with JS. */
    function refresh() {
      observer?.disconnect()
      pills = new Map()
      sectionScroll.replaceChildren()

      const found = discover()
      sectionRow.hidden = found.length === 0

      for (const { id, label } of found) {
        const a = doc.createElement('a')
        a.className = 'cubby-nav-pill'
        a.href = `#${id}`
        a.textContent = label
        sectionScroll.appendChild(a)
        pills.set(id, a)
      }

      if (active && !pills.has(active)) active = null
      measure()
      observe(found)
    }

    function observe(found) {
      if (!found.length || typeof win.IntersectionObserver !== 'function') return
      const height = currentHeight()
      const [top, bottom] = options.band || [height + 8, 70]
      observer = new win.IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            // No `else clear`. Mid-section on a tall block nothing is inside
            // the band, and the last answer standing is the correct one --
            // clearing makes the highlight flicker off, which reads as a bug.
            if (entry.isIntersecting) setActive(entry.target.getAttribute('aria-labelledby'))
          }
        },
        { rootMargin: `-${top}px 0px -${bottom}% 0px` }
      )
      ctx.own(() => observer?.disconnect())
      for (const { section } of found) observer.observe(section)
    }

    function currentHeight() {
      const raw = doc.documentElement.style.getPropertyValue(HEIGHT_PROPERTY)
      return parseFloat(raw) || 0
    }

    /**
     * One measurement, published as a custom property and re-read by
     * everything that needs it. Hardcoded scroll-margin and observer offsets
     * have to agree with the bar's real height, and silently will not for
     * another font, type scale, or number of rows.
     */
    function measure() {
      const height = root.getBoundingClientRect().height
      doc.documentElement.style.setProperty(HEIGHT_PROPERTY, `${Math.round(height)}px`)
      // The bar is position: fixed, so it occupies no space in normal flow and
      // the page would start underneath it. Reserve exactly its height on the
      // mount element instead of pushing a body padding rule onto the host --
      // the widget owns its own mount point, and the host keeps its layout.
      if (height) mount.style.height = `${Math.round(height)}px`
      return height
    }

    refresh()
    // The current page can be off the end of row one too, for a site with more
    // pages than fit. Once at mount is enough: row one never changes.
    revealPill(pageScroll.querySelector('[aria-current]'), pageScroll)
    ctx.on(win, 'resize', () => {
      measure()
      // The observer's rootMargin is baked in at construction, so a height
      // change means rebuilding it.
      observer?.disconnect()
      observe(discover())
    })
    ctx.own(() => doc.documentElement.style.removeProperty(HEIGHT_PROPERTY))
    ctx.own(() => mount.style.removeProperty('height'))

    return {
      /**
       * Where the bar is, so other widgets can find the action area to mount
       * into without being told about it.
       * @returns {{page: string|null, section: string|null, actions: Element}}
       */
      current() {
        return { page: here, section: active, actions }
      },
      /** Re-derive row two. Sections rendered by JS after load need this. */
      refresh,
      /** The measured bar height in px. */
      height: measure,
      root,
      actions,
    }
  })
}

export default createNav
