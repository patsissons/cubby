import { widget, injectStyle, ensureTokens } from '#core'
import { STYLES } from './styles.js'
import { layout, describeJourney } from './layout.js'

/**
 * Node-and-edge diagrams in inline SVG. Zero dependencies: no d3, no mermaid,
 * no canvas -- a static-files-only site cannot afford a renderer script.
 *
 * Data is declarative with no coordinates (see ./layout.js). Journeys name
 * EDGES, never nodes, so which nodes a journey touches -- and which nodes no
 * journey touches at all -- are derived rather than maintained.
 */

const SVG = 'http://www.w3.org/2000/svg'
const DEFAULT_KINDS = {
  default: { hue: 220, dash: '', label: 'link' },
}

export function createGraph(cubby) {
  /**
   * The diagram and its display options travel in ONE object, keeping the
   * widget contract f(target, options) -> handle uniform across the library.
   *
   * @param {string|Element} target
   * @param {{
   *   lanes: Array<{id: string, label?: string}>,
   *   nodes: Array<{id: string, lane: string, column: number, label?: string, type?: string, note?: string}>,
   *   edges: Array<{id: string, from: string, to: string, kind?: string, label?: string, note?: string}>,
   *   journeys?: Array<{id: string, label?: string, hue?: number, edges: string[]}>,
   *   kinds?: Record<string, {hue?: number, dash?: string}>,
   *   label?: string, minZoom?: number, maxZoom?: number,
   * }} [data]
   */
  return widget('graph', (ctx, mount, data = {}) => {
    const options = data
    const doc = mount.ownerDocument
    const win = doc.defaultView
    ensureTokens()
    injectStyle('graph', STYLES)

    const model = layout(data)
    if (model.problems.length) {
      // Report rather than throw: half a diagram is more useful than an
      // exception, and each message names the id that caused it.
      console.error(`[cubby.graph] ${model.problems.join('; ')}`)
    }

    const root = doc.createElement('div')
    root.className = 'cubby-graph'

    // Kinds, node types and journey hues are CONFIG applied through custom
    // properties -- not an enum in JS duplicated by a hardcoded hex in CSS. A
    // seventh kind is a data change, and a consumer with their own vocabulary
    // can express it by redefining the property.
    const kinds = { ...DEFAULT_KINDS, ...(data.kinds || {}) }
    for (const [name, kind] of Object.entries(kinds)) {
      root.style.setProperty(`--cubby-graph-k-${name}`, `hsl(${kind.hue ?? 220} 70% 45%)`)
      root.style.setProperty(`--cubby-graph-d-${name}`, kind.dash || 'none')
    }
    for (const journey of model.journeys) {
      root.style.setProperty(`--cubby-graph-j-${journey.id}`, `hsl(${journey.hue ?? 20} 75% 45%)`)
    }

    const frame = doc.createElement('div')
    frame.className = 'cubby-graph-frame'
    const svg = doc.createElementNS(SVG, 'svg')
    svg.setAttribute('class', 'cubby-graph-canvas')
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', options.label || data.label || 'Diagram')
    svg.setAttribute('viewBox', `0 0 ${model.width} ${model.height}`)
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    frame.appendChild(svg)

    // --- lanes ---------------------------------------------------------------
    for (const lane of model.lanes) {
      const rect = doc.createElementNS(SVG, 'rect')
      rect.setAttribute('class', 'cubby-graph-lane')
      rect.setAttribute('x', '4')
      rect.setAttribute('y', String(lane.y - 4))
      rect.setAttribute('width', String(model.width - 8))
      rect.setAttribute('height', String(lane.h + 8))
      rect.setAttribute('rx', '8')
      svg.appendChild(rect)
      const label = doc.createElementNS(SVG, 'text')
      label.setAttribute('class', 'cubby-graph-lane-label')
      label.setAttribute('x', '14')
      label.setAttribute('y', String(lane.y + 10))
      label.textContent = lane.label || lane.id
      svg.appendChild(label)
    }

    // --- edges ---------------------------------------------------------------
    /** @type {Map<string, {line: Element, hit: Element, label: Element|null}>} */
    const edgeEls = new Map()
    for (const edge of model.edges) {
      const line = doc.createElementNS(SVG, 'path')
      line.setAttribute('class', 'cubby-graph-edge')
      line.setAttribute('d', edge.d)
      // Kind differs by DASH PATTERN as well as hue: six line colours on a
      // dense diagram is more than colour alone can carry, and a dash survives
      // greyscale printing and colour vision differences.
      line.setAttribute('stroke', `var(--cubby-graph-k-${edge.kind})`)
      line.setAttribute('stroke-dasharray', `var(--cubby-graph-d-${edge.kind})`)
      // role + aria-label, never an SVG <title> child: browsers render <title>
      // as a native tooltip after ~1s, on top of the designed popover, saying
      // less, in a font we do not control.
      line.setAttribute('role', 'img')
      line.setAttribute('aria-label', edgeLabel(edge))

      // A transparent fat stroke gives the hairline a usable hit area.
      const hit = doc.createElementNS(SVG, 'path')
      hit.setAttribute('class', 'cubby-graph-edge-hit')
      hit.setAttribute('d', edge.d)
      hit.setAttribute('tabindex', '0')
      hit.setAttribute('role', 'button')
      hit.setAttribute('aria-label', edgeLabel(edge))

      svg.append(line, hit)

      let label = null
      if (edge.label) {
        label = doc.createElementNS(SVG, 'text')
        label.setAttribute('class', 'cubby-graph-edge-label')
        label.setAttribute('x', String(edge.mx))
        label.setAttribute('y', String(edge.my - 6))
        label.textContent = edge.label
        svg.appendChild(label)
      }
      edgeEls.set(edge.id, { line, hit, label })

      // Everything reachable by hover is reachable by focus, with an IDENTICAL
      // highlight state -- no hover-only information anywhere.
      ctx.on(hit, 'mouseenter', () => focusEdge(edge))
      ctx.on(hit, 'focus', () => focusEdge(edge))
      ctx.on(hit, 'mouseleave', clear)
      ctx.on(hit, 'blur', clear)
    }

    // --- nodes ---------------------------------------------------------------
    /** @type {Map<string, Element>} */
    const nodeEls = new Map()
    for (const node of model.nodes) {
      const g = doc.createElementNS(SVG, 'g')
      g.setAttribute('class', 'cubby-graph-node')
      g.setAttribute('tabindex', '0')
      g.setAttribute('role', 'button')
      g.setAttribute('aria-label', node.label || node.id)
      const rect = doc.createElementNS(SVG, 'rect')
      rect.setAttribute('x', String(node.x))
      rect.setAttribute('y', String(node.y))
      rect.setAttribute('width', String(node.w))
      rect.setAttribute('height', String(node.h))
      rect.setAttribute('rx', '8')
      if (node.type) rect.setAttribute('stroke', `var(--cubby-graph-k-${node.type}, var(--border, #c8c2ba))`)
      g.appendChild(rect)
      for (const [i, line] of wrap(node.label || node.id).entries()) {
        const text = doc.createElementNS(SVG, 'text')
        text.setAttribute('x', String(node.cx))
        text.setAttribute('y', String(node.cy + 4 + (i - (wrap(node.label || node.id).length - 1) / 2) * 13))
        text.textContent = line
        g.appendChild(text)
      }
      svg.appendChild(g)
      nodeEls.set(node.id, g)

      ctx.on(g, 'mouseenter', () => focusNode(node))
      ctx.on(g, 'focus', () => focusNode(node))
      ctx.on(g, 'mouseleave', clear)
      ctx.on(g, 'blur', clear)
    }

    // --- controls, legend, prose ---------------------------------------------
    const controls = doc.createElement('div')
    controls.className = 'cubby-graph-controls'
    for (const [glyph, factor, label] of [
      ['+', 1 / 1.25, 'Zoom in'],
      ['−', 1.25, 'Zoom out'],
      ['○', 0, 'Reset view'],
    ]) {
      const button = doc.createElement('button')
      button.type = 'button'
      button.textContent = glyph
      button.setAttribute('aria-label', label)
      ctx.on(button, 'click', () => (factor ? zoomBy(factor) : reset()))
      controls.appendChild(button)
    }
    frame.appendChild(controls)
    root.appendChild(frame)

    const legend = doc.createElement('ul')
    legend.className = 'cubby-graph-legend'
    for (const journey of model.journeys) {
      const li = doc.createElement('li')
      const chip = doc.createElement('button')
      chip.type = 'button'
      chip.className = 'cubby-graph-chip'
      chip.textContent = journey.label || journey.id
      chip.style.color = `var(--cubby-graph-j-${journey.id})`
      ctx.on(chip, 'mouseenter', () => focusJourney(journey))
      ctx.on(chip, 'focus', () => focusJourney(journey))
      ctx.on(chip, 'mouseleave', clear)
      ctx.on(chip, 'blur', clear)
      li.appendChild(chip)
      legend.appendChild(li)
    }
    if (model.journeys.length) root.appendChild(legend)

    const hint = doc.createElement('p')
    hint.className = 'cubby-graph-hint'
    // A modifier key is not discoverable, so say it.
    hint.textContent = 'Drag to pan. Hold ⌘/Ctrl and scroll to zoom.'
    root.appendChild(hint)

    // The same journeys as prose. The drawing is never the only copy, and this
    // is what licenses hiding the popover on touch and on a narrow screen.
    if (model.journeys.length) {
      const prose = doc.createElement('dl')
      prose.className = 'cubby-graph-prose'
      for (const journey of model.journeys) {
        const dt = doc.createElement('dt')
        dt.textContent = journey.label || journey.id
        const dd = doc.createElement('dd')
        dd.textContent = describeJourney(model, journey)
        prose.append(dt, dd)
      }
      root.appendChild(prose)
    }

    const popover = doc.createElement('div')
    popover.className = 'cubby-graph-popover'
    popover.hidden = true
    doc.body.appendChild(popover)
    ctx.own(() => popover.remove())

    mount.replaceChildren(root)
    ctx.own(() => root.remove())

    // --- highlight ------------------------------------------------------------
    function setOn(nodeIds, edgeIds) {
      root.setAttribute('data-focused', '')
      for (const [id, el] of nodeEls) el.toggleAttribute('data-on', nodeIds.has(id))
      for (const [id, els] of edgeEls) {
        const on = edgeIds.has(id)
        els.line.toggleAttribute('data-on', on)
        els.label?.toggleAttribute('data-on', on)
      }
    }

    function clear() {
      root.removeAttribute('data-focused')
      for (const el of nodeEls.values()) el.removeAttribute('data-on')
      for (const els of edgeEls.values()) {
        els.line.removeAttribute('data-on')
        els.label?.removeAttribute('data-on')
      }
      popover.hidden = true
    }
    ctx.own(clear)

    function focusJourney(journey) {
      setOn(new Set(journey.nodes), new Set(journey.edges))
      show(journey.label || journey.id, describeJourney(model, journey), null)
    }

    function focusEdge(edge) {
      setOn(new Set([edge.from, edge.to]), new Set([edge.id]))
      show(edgeLabel(edge), edge.note || '', edgeEls.get(edge.id).hit)
    }

    function focusNode(node) {
      const journeys = model.nodeJourneys.get(node.id) || []
      if (journeys.length) {
        const nodes = new Set()
        const edges = new Set()
        for (const id of journeys) {
          const j = model.journeys.find((x) => x.id === id)
          j.nodes.forEach((n) => nodes.add(n))
          j.edges.forEach((e) => edges.add(e))
        }
        setOn(nodes, edges)
      } else {
        // A node no journey touches falls back to its own edges. Without this,
        // hovering it dims the whole diagram and highlights nothing, which
        // reads as a bug rather than as an absence of journeys.
        const edges = model.nodeEdges.get(node.id) || []
        const nodes = new Set([node.id])
        for (const id of edges) {
          nodes.add(model.edgeById.get(id).from)
          nodes.add(model.edgeById.get(id).to)
        }
        setOn(nodes, new Set(edges))
      }
      show(node.label || node.id, node.note || '', nodeEls.get(node.id))
    }

    function edgeLabel(edge) {
      const from = model.byId.get(edge.from)?.label || edge.from
      const to = model.byId.get(edge.to)?.label || edge.to
      return edge.label ? `${from} → ${to}: ${edge.label}` : `${from} → ${to}`
    }

    /**
     * Notes are markdown when the module is loaded and plain text otherwise --
     * never a raw innerHTML string from a caller. cubby already owns an
     * escape-first renderer whose output is the one sanctioned innerHTML
     * source; there is no reason to invent a second, weaker path.
     */
    function show(title, note, anchorEl) {
      popover.replaceChildren()
      const strong = doc.createElement('strong')
      strong.textContent = title
      popover.appendChild(strong)
      if (note) {
        const body = doc.createElement('div')
        if (cubby?.markdown?.render) body.innerHTML = cubby.markdown.render(note)
        else body.textContent = note
        popover.appendChild(body)
      }
      popover.hidden = false
      positionPopover(anchorEl)
    }

    function positionPopover(anchorEl) {
      const target = (anchorEl || svg).getBoundingClientRect()
      const box = frame.getBoundingClientRect()
      const w = popover.offsetWidth || 240
      const h = popover.offsetHeight || 80
      // Asymmetric on purpose: horizontal bounds are the frame intersected with
      // the viewport, vertical bounds are the VIEWPORT ALONE. Clamping
      // vertically to the frame leaves a tall popover over a canvas low on
      // screen nowhere to go and cuts off its last line, and truncated text is
      // worse than overlapping the legend by a few pixels.
      const minX = Math.max(8, box.left)
      const maxX = Math.min(win.innerWidth - 8, box.right) - w
      let x = target.left + target.width / 2 - w / 2
      x = Math.max(minX, Math.min(x, Math.max(minX, maxX)))
      let y = target.bottom + 10
      if (y + h > win.innerHeight - 8) y = target.top - h - 10
      y = Math.max(8, Math.min(y, win.innerHeight - h - 8))
      popover.style.left = `${Math.round(x)}px`
      popover.style.top = `${Math.round(y)}px`
    }

    // --- zoom and pan ---------------------------------------------------------
    const home = [0, 0, model.width, model.height]
    let view = [...home]
    const minZoom = options.minZoom ?? 0.4
    const maxZoom = options.maxZoom ?? 4

    const applyView = () => svg.setAttribute('viewBox', view.join(' '))
    const reset = () => {
      view = [...home]
      applyView()
    }

    function zoomBy(factor, originX = 0.5, originY = 0.5) {
      const scale = model.width / view[2]
      const next = Math.min(maxZoom, Math.max(minZoom, scale / factor))
      const w = model.width / next
      const h = model.height / next
      view = [view[0] + (view[2] - w) * originX, view[1] + (view[3] - h) * originY, w, h]
      applyView()
    }

    ctx.on(
      frame,
      'wheel',
      (e) => {
        // With no modifier this listener does NOTHING -- not even
        // preventDefault. A canvas that swallows plain wheel traps a reader
        // scrolling past it, and on a trackpad they may not realise what
        // happened.
        if (!e.ctrlKey && !e.metaKey) return
        e.preventDefault()
        const box = frame.getBoundingClientRect()
        zoomBy(e.deltaY > 0 ? 1.12 : 1 / 1.12, (e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height)
      },
      { passive: false }
    )

    let panning = null
    ctx.on(svg, 'pointerdown', (e) => {
      panning = { x: e.clientX, y: e.clientY, view: [...view] }
      svg.setAttribute('data-panning', '')
      svg.setPointerCapture?.(e.pointerId)
    })
    ctx.on(svg, 'pointermove', (e) => {
      if (!panning) return
      // A pointerdown with no matching pointerup -- pointer leaving the window
      // mid-drag, a dropped capture, a synthetic event -- would otherwise latch
      // pan mode and send the diagram off into space on every later move.
      if (e.buttons === 0) return endPan()
      const box = frame.getBoundingClientRect()
      view = [
        panning.view[0] - ((e.clientX - panning.x) / box.width) * view[2],
        panning.view[1] - ((e.clientY - panning.y) / box.height) * view[3],
        view[2],
        view[3],
      ]
      applyView()
    })
    const endPan = () => {
      panning = null
      svg.removeAttribute('data-panning')
    }
    ctx.on(svg, 'pointerup', endPan)
    ctx.on(svg, 'pointercancel', endPan)

    return {
      model,
      /** Highlight a journey by id, as hovering its chip would. */
      focus(id) {
        const journey = model.journeys.find((j) => j.id === id)
        if (journey) focusJourney(journey)
      },
      clear,
      reset,
      popover,
    }
  })
}

/** Two lines at most; a third would collide with the node below. */
function wrap(text, limit = 18) {
  const words = String(text).split(/\s+/)
  const lines = ['']
  for (const word of words) {
    const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word
    if (next.length > limit && lines.at(-1)) lines.push(word)
    else lines[lines.length - 1] = next
  }
  return lines.slice(0, 2)
}

export { layout, describeJourney, validate } from './layout.js'
export default createGraph
