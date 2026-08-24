import { widget, injectStyle, ensureTokens } from '#core'
import { STYLES, HELD_STYLES } from './styles.js'
import { packPoints, toPathData } from './simplify.js'

/**
 * Ephemeral shared cursors and freehand marks.
 *
 * Hold a modifier and your pointer becomes an avatar puck; hold and drag and
 * you draw a translucent line peers can see; release and the marks fade.
 *
 * Nothing is ever read back. cubby.rooms only subscribes to `create`, never
 * fetching event history, so a late joiner sees nothing and a refresh clears
 * the page -- deliberate rather than unfinished, because a scribble is not a
 * record and must not outlive the conversation it belonged to. A row does
 * exist for as long as the sweeper's TTL, which is the one place this departs
 * from "no persistence of any kind"; it is never read after its realtime
 * moment.
 *
 * TRANSPORT. A stroke is captured locally as a vector and sent as WHOLE PATHS,
 * one event per time-boxed segment, rather than as a stream of points. That is
 * ~16x fewer writes than a 50ms point stream, which is what makes this
 * affordable on a durable event log at all. Segments are flushed every
 * `segmentMs` as well as on release, so a peer's latency is bounded by the
 * segment rather than by however long you keep drawing.
 *
 * Because a segment is self-contained there is no stroke-end broadcast, and
 * therefore none of the machinery it would need: no session ordinal to
 * reconcile, no retired set, no way for a point to arrive after its own end.
 * A group's fade timer is REFRESHED BY ACTIVITY instead of started by an end
 * event, so a mark cannot freeze on the page even if the last segment is lost.
 */

const MODIFIERS = { alt: 'altKey', ctrl: 'ctrlKey', meta: 'metaKey', shift: 'shiftKey' }
const HUES = [8, 200, 145, 275, 45, 320, 175, 95]

const hueFor = (id) => {
  let h = 0
  for (let i = 0; i < String(id).length; i++) h = (h * 31 + String(id).charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

export function createDraw(cubby) {
  /**
   * @param {string|Element} target the anchor: coordinates are relative to it
   * @param {{
   *   room?: string, modifier?: 'alt'|'ctrl'|'meta'|'shift', cursors?: boolean,
   *   strokeWidth?: number, opacity?: number, fadeMs?: number, segmentMs?: number,
   *   cursorMs?: number, tolerance?: number, chip?: boolean, identifyMs?: number,
   * }} [options]
   */
  return widget('draw', (ctx, anchor, options = {}) => {
    const doc = anchor.ownerDocument
    const win = doc.defaultView
    ensureTokens()
    injectStyle('draw', STYLES)
    injectStyle('draw-held', HELD_STYLES)

    const modifierKey = MODIFIERS[options.modifier || 'alt'] || 'altKey'
    const strokeWidth = options.strokeWidth ?? 3
    // A highlighter, not a redaction.
    const opacity = options.opacity ?? 0.42
    const fadeMs = options.fadeMs ?? 5000
    const segmentMs = options.segmentMs ?? 800
    const cursorMs = options.cursorMs ?? 250
    const tolerance = options.tolerance ?? 0.002
    // Remote cursor broadcast is OFF by default: the local puck costs nothing,
    // while every remote cursor sample is a presence write and an SSE fan-out.
    const shareCursor = options.cursors === true
    // Default the room per page, so two pages do not share marks.
    const roomName = options.room || `draw${win.location.pathname.replace(/\/+$/, '') || '/'}`

    // --- layers ---------------------------------------------------------------
    const marks = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    marks.setAttribute('class', 'cubby-draw-marks')
    marks.setAttribute('aria-hidden', 'true')
    const cursors = doc.createElement('div')
    cursors.className = 'cubby-draw-cursors'
    cursors.setAttribute('aria-hidden', 'true')
    doc.body.append(marks, cursors)
    ctx.own(() => {
      marks.remove()
      cursors.remove()
    })
    /**
     * Give the marks layer a real height covering the document.
     *
     * Reset to zero before measuring: the layer is absolutely positioned, so it
     * contributes to the scrollable overflow area, and measuring while it is
     * already tall means the document can only ever grow.
     */
    function sizeMarks() {
      marks.style.height = '0px'
      const height = Math.max(
        doc.documentElement?.scrollHeight || 0,
        doc.body?.scrollHeight || 0
      )
      marks.style.height = `${height}px`
    }

    sizeMarks()
    doc.documentElement.style.setProperty('--cubby-draw-fade', `${fadeMs}ms`)
    ctx.own(() => doc.documentElement.style.removeProperty('--cubby-draw-fade'))

    // --- coordinates ----------------------------------------------------------
    //
    // x is a fraction of the anchor's width, y is document pixels from its top.
    // Raw page coordinates misalign for the commonest case there is: two people
    // on wide monitors whose layout is pixel-identical because the container is
    // capped, differing only in how much margin sits to the left. What anchoring
    // cannot fix is reflow -- below the cap, text wraps differently, so the same
    // y is a different line. Points are kept in memory so a resize re-projects
    // rather than losing them.
    function frame() {
      const r = anchor.getBoundingClientRect()
      return { left: r.left + win.scrollX, top: r.top + win.scrollY, width: r.width || 1 }
    }
    let box = frame()
    const toAnchor = (pageX, pageY) => [(pageX - box.left) / box.width, pageY - box.top]
    const toPage = ([x, y]) => [box.left + x * box.width, box.top + y]

    /** Our own user id, or null until identity resolves. Outer scope because
     *  reproject() needs it to tell our puck from a peer's. */
    let myId = null

    // --- groups: one modifier-hold, fading as a single thing -------------------
    /** @type {Map<string, {el: SVGPathElement, points: Array, timer: any}>} */
    const groups = new Map()

    function groupFor(key, hue) {
      let g = groups.get(key)
      if (g) return g
      const el = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
      el.setAttribute('class', 'cubby-draw-path')
      el.setAttribute('stroke', `hsl(${hue} 85% 45% / ${opacity})`)
      el.setAttribute('stroke-width', String(strokeWidth))
      marks.appendChild(el)
      // strokes, not points: one modifier-hold is ONE group so it fades as a
      // single thing, but each press is its own subpath. Flattening them into
      // one point list draws a line from where you lifted to where you next
      // pressed.
      g = { el, strokes: [], timer: null }
      groups.set(key, g)
      return g
    }

    /**
     * fadeMs is the whole visible lifetime after the last activity, not a delay
     * before one: it feeds BOTH the CSS transition and the removal timer, so a
     * hold-then-fade pair would have to be added to both or marks outlive their
     * fade / vanish mid-way through it.
     */
    /** Cancel any pending fade, without scheduling one -- used while a stroke
     *  is still being drawn. */
    function holdGroup(key) {
      const g = groups.get(key)
      if (!g) return
      win.clearTimeout(g.timer)
      g.timer = null
    }

    function touchGroup(key, extraMs = 0) {
      const g = groups.get(key)
      if (!g) return
      win.clearTimeout(g.timer)
      g.timer = win.setTimeout(() => {
        g.el.setAttribute('data-fading', '')
        g.timer = win.setTimeout(() => {
          g.el.remove()
          groups.delete(key)
        }, fadeMs)
      }, extraMs)
    }

    /**
     * @param {boolean} [stitch] true for a received segment, whose first point
     *   repeats the last point of its predecessor -- drop the duplicate rather
     *   than drawing a zero-length join that blobs at a round line cap. Never
     *   true for a locally captured point, which would drop the point itself.
     */
    /** Every subpath of a group, joined -- one M per press. */
    function paint(g) {
      g.el.setAttribute('d', g.strokes.map((stroke) => toPathData(stroke.map(toPage))).join(''))
    }

    /**
     * @param {boolean} [opts.stitch] true for a received segment, whose first
     *   point repeats the last point of its predecessor -- drop the duplicate
     *   rather than drawing a zero-length join that blobs at a round line cap.
     *   Never true for a locally captured point, which would drop the point.
     * @param {boolean} [opts.newStroke] begin a new subpath rather than
     *   continuing the last one.
     */
    function appendPoints(key, hue, points, { stitch = false, newStroke = false } = {}) {
      // A stroke may run past what the layer covered when it was last sized --
      // the page can have grown, or this is the first mark on it.
      if (!marks.style.height || marks.style.height === '0px') sizeMarks()
      const g = groupFor(key, hue)
      if (newStroke || !g.strokes.length) g.strokes.push([])
      const target = g.strokes[g.strokes.length - 1]
      const start = stitch && target.length && points.length ? 1 : 0
      for (let i = start; i < points.length; i++) target.push(points[i])
      paint(g)
      return g
    }

    function reproject() {
      sizeMarks()
      box = frame()
      for (const g of groups.values()) paint(g)
      for (const [id, puck] of pucks) placePuck(puck, puck._at, id === myId)
    }
    ctx.on(win, 'resize', reproject)

    // --- pucks ----------------------------------------------------------------
    /** @type {Map<string, HTMLElement>} */
    const pucks = new Map()

    function puckFor(id, name) {
      let el = pucks.get(id)
      if (el) return el
      el = doc.createElement('div')
      el.className = 'cubby-draw-puck'
      const dot = doc.createElement('span')
      dot.className = 'cubby-draw-dot'
      dot.style.background = `hsl(${hueFor(id)} 85% 45%)`
      const label = doc.createElement('span')
      label.className = 'cubby-draw-name'
      label.style.background = `hsl(${hueFor(id)} 85% 45%)`
      label.textContent = name || ''
      if (!name) label.hidden = true
      el.append(dot, label)
      cursors.appendChild(el)
      pucks.set(id, el)
      return el
    }

    function placePuck(el, at, self) {
      if (!at) return
      el._at = at
      const [px, py] = toPage(at)
      el.style.left = `${px}px`
      el.style.top = `${py}px`
      if (self) el.setAttribute('data-self', '')
    }

    function dropPuck(id) {
      pucks.get(id)?.remove()
      pucks.delete(id)
    }

    return wire()

    // --- input ----------------------------------------------------------------
    function wire() {
      let held = false
      let drawing = false
      let session = 0
      let stroke = 0
      let seq = 0
      let buffer = []
      let segmentStart = 0
      let flushTimer = null
      let lastCursorSent = 0
      let room = null

      let lastPointer = null

      const selfKey = () => `${myId || 'me'}|${session}`

      // --- outbound ----------------------------------------------------------
      function flush(final) {
        win.clearTimeout(flushTimer)
        flushTimer = null
        if (buffer.length < 2) {
          if (final) buffer = []
          return
        }
        const points = packPoints(buffer, { tolerance })
        const ms = Math.max(1, Date.now() - segmentStart)
        // Carry the last raw point into the next segment so the two join.
        buffer = final ? [] : [buffer[buffer.length - 1]]
        segmentStart = Date.now()
        const payload = { s: session, k: stroke, q: seq++, p: points, ms }
        room?.emit('draw.mark', payload).catch(() => {
          // Absence is never reported as failure: with no session, no room, or
          // no platform at all, this degrades to single-player in silence.
        })
        if (!final) schedule()
      }

      function schedule() {
        win.clearTimeout(flushTimer)
        flushTimer = win.setTimeout(() => flush(false), segmentMs)
      }
      ctx.own(() => win.clearTimeout(flushTimer))

      function sendCursor(at) {
        if (!shareCursor || !room) return
        const now = Date.now()
        if (now - lastCursorSent < cursorMs) return
        lastCursorSent = now
        room.updateUserState({ at }).catch(() => {})
      }

      // --- local gesture -----------------------------------------------------
      function enter(event) {
        if (held) return
        held = true
        doc.body.classList.add('cubby-draw-held')
        session += 1
        stroke = 0
        placePuck(puckFor(myId || 'me', 'You'), toAnchor(event.pageX, event.pageY), true)
      }

      /**
       * One idempotent exit, reached four ways, because the modifier's keyup is
       * NOT reliable: Alt-Tab, window blur, tab switch and OS-level grabs all
       * swallow it, and a latched modifier silently eats every subsequent click
       * on the host page. The pointermove case matters most -- the pointer is
       * the most reliable witness to the key's real state, and it catches a
       * window regaining focus with the modifier already held, where no keydown
       * ever arrives.
       *
       * pointerleave is deliberately absent. These are capture-phase listeners
       * on window, which see the pointerleave of every element the pointer
       * crosses on its way anywhere; including it would end the stroke at the
       * first boundary. `buttons === 0` covers the pointer that really left.
       */
      function exit() {
        if (!held) return
        held = false
        drawing = false
        doc.body.classList.remove('cubby-draw-held')
        flush(true)
        touchGroup(selfKey())
        dropPuck(myId || 'me')
        if (shareCursor) room?.updateUserState({ at: null }).catch(() => {})
      }
      ctx.own(exit)

      // NEVER preventDefault the modifier keydown: Alt+arrow is text
      // navigation, Alt+letter is how special characters are typed, and screen
      // readers use it as a modifier. Take over the interaction you were asked
      // for and nothing adjacent.
      ctx.on(
        win,
        'keydown',
        (e) => {
          if (!e[modifierKey] || held) return
          // With no pointer seen yet there is nowhere to put the puck; the
          // first pointermove enters instead.
          if (lastPointer) enter(lastPointer)
        },
        { capture: true }
      )
      ctx.on(win, 'keyup', () => exit(), { capture: true })
      ctx.on(win, 'blur', () => exit())
      ctx.on(doc, 'visibilitychange', () => doc.hidden && exit())

      ctx.on(
        win,
        'pointermove',
        (e) => {
          lastPointer = e
          if (!e[modifierKey]) return exit()
          if (!held) enter(e)
          const at = toAnchor(e.pageX, e.pageY)
          placePuck(puckFor(myId || 'me', 'You'), at, true)
          sendCursor(at)
          // A pointerdown with no matching pointerup -- pointer leaving the
          // window mid-drag, a dropped capture, a synthetic event -- would
          // otherwise latch drag mode and every later move would keep drawing.
          if (drawing && e.buttons === 0) return endStroke()
          if (!drawing) return
          buffer.push(at)
          appendPoints(selfKey(), hueFor(myId || 'me'), [at])
          holdGroup(selfKey())
        },
        { capture: true }
      )

      function beginStroke(e) {
        sizeMarks()
        drawing = true
        stroke += 1
        seq = 0
        const at = toAnchor(e.pageX, e.pageY)
        buffer = [at]
        // Render the press point too. Without it the line starts one pointermove
        // late, and a short stroke of two points renders as a bare moveto --
        // which draws nothing at all.
        appendPoints(selfKey(), hueFor(myId || 'me'), [at], { newStroke: true })
        holdGroup(selfKey())
        segmentStart = Date.now()
        schedule()
      }

      function endStroke() {
        if (!drawing) return
        drawing = false
        flush(true)
        touchGroup(selfKey())
      }

      // Take over the pointer while held, so a modifier-drag over a diagram
      // does not also pan it and a modifier-click on a link does not follow it.
      for (const type of ['pointerdown', 'click', 'dragstart', 'selectstart']) {
        ctx.on(
          win,
          type,
          (e) => {
            if (!e[modifierKey] && !held) return
            e.preventDefault()
            e.stopPropagation()
            if (type === 'pointerdown') beginStroke(e)
          },
          { capture: true }
        )
      }
      ctx.on(win, 'pointerup', () => endStroke(), { capture: true })

      // --- inbound -----------------------------------------------------------
      function onMark(payload, user) {
        // THE central rule: render your own marks from your own pointer, and
        // drop every inbound event whose sender is you -- INCLUDING everything
        // that arrives before your own id is known, because until then you
        // cannot tell yours from anyone's. Production emit() may be
        // outbound-only with the echo unobservable, while a dev shim echoes on
        // purpose; trusting the echo makes your own drawing vanish the moment
        // it deploys, and rendering both makes every local stroke double.
        // Neither failure is visible in the environment where the other one is.
        if (!myId || !user || user.id === myId) return
        const key = `${user.id}|${payload.s}`
        const group = appendPoints(key, hueFor(user.id), payload.p || [], {
          stitch: true,
          newStroke: payload.q === 0,
        })
        animate(group, payload)
        // Refreshed by activity, so a lost final segment cannot freeze a mark.
        touchGroup(key, Math.min(payload.ms || 0, segmentMs * 2))
      }

      function animate(group, payload) {
        const el = group.el
        // getTotalLength is SVG geometry the DOM may not implement; without it
        // the mark simply appears whole, which is the correct degradation.
        const length = typeof el.getTotalLength === 'function' ? el.getTotalLength() : 0
        if (!length) return
        const ms = Math.max(1, Math.min(payload.ms || 0, segmentMs * 2))
        el.style.transition = 'none'
        el.style.strokeDasharray = String(length)
        el.style.strokeDashoffset = String(length)
        win.requestAnimationFrame?.(() => {
          el.style.transition = `stroke-dashoffset ${ms}ms linear, opacity var(--cubby-draw-fade) linear`
          el.style.strokeDashoffset = '0'
        })
      }

      function onCursor(_prev, next, user) {
        if (!shareCursor || !myId || !user || user.id === myId) return
        if (!next?.at) return dropPuck(user.id)
        placePuck(puckFor(user.id, user.name || user.username || 'Someone'), next.at, false)
      }

      // --- chip --------------------------------------------------------------
      const chip = options.chip === false ? null : makeChip()
      function makeChip() {
        const el = doc.createElement('div')
        el.className = 'cubby-draw-chip'
        el.setAttribute('role', 'status')
        const said = doc.createElement('span')
        said.className = 'cubby-draw-said'
        const count = doc.createElement('span')
        count.className = 'cubby-draw-count'
        count.setAttribute('aria-hidden', 'true')
        el.append(count, said)
        doc.body.appendChild(el)
        ctx.own(() => el.remove())
        return { el, said, count }
      }

      /**
       * The chip never claims what it has not established. Pre-connect, and
       * with no room at all, it shows the modifier hint and no count: "Just
       * you" is a claim, and making it before `ready` would be a guess.
       */
      function say(text, n) {
        if (!chip) return
        chip.said.textContent = text
        chip.count.textContent = n == null ? '' : String(n)
      }
      const touch = win.matchMedia?.('(hover: none)').matches
      const hint = touch ? 'Drawing unavailable' : `Hold ${options.modifier || 'Alt'} to draw`
      say(hint, null)

      // --- join ---------------------------------------------------------------
      //
      // Identify BEFORE joining, bounded by a timeout: a dev shim may read
      // identity synchronously inside join, so joining first makes everyone
      // anonymous; and an identity call against production over CORS can hang
      // rather than reject. Losing the identity race costs a name; losing the
      // join costs the feature.
      async function connect() {
        if (!cubby?.rooms) return
        try {
          await Promise.race([
            cubby.ready,
            new Promise((r) => win.setTimeout(r, options.identifyMs ?? 3000)),
          ])
          myId = cubby.identity?.user?.id || null
          if (!myId) return say(`${hint} - sign in to share`, null)

          room = cubby.rooms.room(roomName)
          // Handlers go on BEFORE the await: `ready` fires DURING join and
          // reads them, and `room` must already be assigned when it does.
          room.on('draw.mark', onMark)
          room.on('user.state', onCursor)
          room.on('user.leave', (user) => dropPuck(user.id))
          const render = () => {
            const others = Math.max(0, room.users.length - 1)
            say(others ? `${others} other${others === 1 ? '' : 's'} here` : 'Just you', others)
          }
          room.on('room.sync', render)
          room.on('user.join', render)
          await room.join()
          render()
        } catch {
          room = null
          say('Sharing offline', null)
        }
      }
      connect()
      ctx.own(() => room?.leave().catch(() => {}))

      return {
        /** The room id, once joined. */
        get room() {
          return room?.id || null
        },
        /** Live groups currently on the page. */
        get marks() {
          return groups.size
        },
        marksLayer: marks,
        cursorsLayer: cursors,
      }
    }
  })
}

export { packPoints, simplify } from './simplify.js'
export default createDraw
