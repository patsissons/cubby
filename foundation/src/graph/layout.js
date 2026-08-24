/**
 * Deterministic layout and derived relationships for a node-and-edge diagram.
 *
 * There is no force simulation and there are no authored coordinates. Lanes
 * give y, `column` gives x, and one pass computes the rest -- a diagram that
 * rearranges itself between visits cannot be referred to in prose, and hand
 * coordinates rot the moment a node is added.
 *
 * `column` is 1-based and unique within a lane. That is what makes layout a
 * direct mapping rather than a packing problem, and why column is an
 * author-controlled alignment hint rather than something derived. Two nodes
 * sharing a lane and column overlap, which validate() reports.
 *
 * Pure and DOM-free, so it is testable under plain Node.
 */

export const METRICS = {
  nodeWidth: 148,
  nodeHeight: 52,
  columnGap: 44,
  laneGap: 56,
  laneLabel: 22,
  padding: 20,
}

/**
 * Problems an author can actually cause, reported rather than thrown: half a
 * diagram is more useful than an exception, and the messages name the id.
 * @returns {string[]}
 */
export function validate(data) {
  const problems = []
  const lanes = new Set((data.lanes || []).map((l) => l.id))
  const nodes = new Map()
  const seen = new Set()

  for (const node of data.nodes || []) {
    if (nodes.has(node.id)) problems.push(`duplicate node id "${node.id}"`)
    nodes.set(node.id, node)
    if (!lanes.has(node.lane)) problems.push(`node "${node.id}" is in unknown lane "${node.lane}"`)
    const slot = `${node.lane}:${node.column}`
    if (seen.has(slot)) problems.push(`nodes overlap at lane "${node.lane}" column ${node.column}`)
    seen.add(slot)
    if (!(node.column >= 1)) problems.push(`node "${node.id}" needs a 1-based column`)
  }

  const edges = new Set()
  for (const edge of data.edges || []) {
    if (edges.has(edge.id)) problems.push(`duplicate edge id "${edge.id}"`)
    edges.add(edge.id)
    for (const end of ['from', 'to']) {
      if (!nodes.has(edge[end])) problems.push(`edge "${edge.id}" points at unknown node "${edge[end]}"`)
    }
  }

  for (const journey of data.journeys || []) {
    for (const id of journey.edges || []) {
      // A journey is a list of EDGE ids, never node ids -- so it can only
      // describe hops that were actually declared.
      if (!edges.has(id)) problems.push(`journey "${journey.id}" names unknown edge "${id}"`)
    }
  }
  return problems
}

/** Geometry for one node. */
function place(node, laneIndex, metrics) {
  const { nodeWidth, nodeHeight, columnGap, laneGap, laneLabel, padding } = metrics
  const x = padding + (node.column - 1) * (nodeWidth + columnGap)
  const y = padding + laneIndex * (nodeHeight + laneGap) + laneLabel
  return { x, y, w: nodeWidth, h: nodeHeight, cx: x + nodeWidth / 2, cy: y + nodeHeight / 2 }
}

/** A cubic between two placed nodes: horizontal within a lane, vertical across. */
function route(a, b) {
  if (a.laneIndex === b.laneIndex) {
    const forward = b.x >= a.x
    const sx = forward ? a.x + a.w : a.x
    const ex = forward ? b.x : b.x + b.w
    const bend = Math.max(18, Math.abs(ex - sx) / 2)
    return {
      d: `M${sx} ${a.cy}C${sx + (forward ? bend : -bend)} ${a.cy} ${ex - (forward ? bend : -bend)} ${b.cy} ${ex} ${b.cy}`,
      mx: (sx + ex) / 2,
      my: (a.cy + b.cy) / 2,
    }
  }
  const down = b.y > a.y
  const sy = down ? a.y + a.h : a.y
  const ey = down ? b.y : b.y + b.h
  const bend = Math.max(20, Math.abs(ey - sy) / 2)
  return {
    d: `M${a.cx} ${sy}C${a.cx} ${sy + (down ? bend : -bend)} ${b.cx} ${ey - (down ? bend : -bend)} ${b.cx} ${ey}`,
    mx: (a.cx + b.cx) / 2,
    my: (sy + ey) / 2,
  }
}

/**
 * Compute positions, paths and every derived relationship.
 *
 * The derivations are the point. Journeys name edges, so which nodes a journey
 * touches, and which nodes no journey touches at all, are COMPUTED rather than
 * maintained -- the two cannot disagree, and adding an edge to a journey
 * updates both for free.
 */
export function layout(data, overrides = {}) {
  const metrics = { ...METRICS, ...overrides }
  const laneIndex = new Map((data.lanes || []).map((lane, i) => [lane.id, i]))

  const nodes = (data.nodes || [])
    .filter((n) => laneIndex.has(n.lane))
    .map((n) => ({ ...n, laneIndex: laneIndex.get(n.lane), ...place(n, laneIndex.get(n.lane), metrics) }))
  const byId = new Map(nodes.map((n) => [n.id, n]))

  const edges = (data.edges || [])
    .filter((e) => byId.has(e.from) && byId.has(e.to))
    .map((e) => ({ ...e, kind: e.kind || 'default', ...route(byId.get(e.from), byId.get(e.to)) }))
  const edgeById = new Map(edges.map((e) => [e.id, e]))

  const journeys = (data.journeys || []).map((j) => {
    const ids = (j.edges || []).filter((id) => edgeById.has(id))
    const nodeIds = new Set()
    for (const id of ids) {
      nodeIds.add(edgeById.get(id).from)
      nodeIds.add(edgeById.get(id).to)
    }
    return { ...j, edges: ids, nodes: [...nodeIds] }
  })

  /** node id -> journey ids that touch it */
  const nodeJourneys = new Map()
  /** edge id -> journey ids that include it */
  const edgeJourneys = new Map()
  for (const j of journeys) {
    for (const id of j.nodes) {
      if (!nodeJourneys.has(id)) nodeJourneys.set(id, [])
      nodeJourneys.get(id).push(j.id)
    }
    for (const id of j.edges) {
      if (!edgeJourneys.has(id)) edgeJourneys.set(id, [])
      edgeJourneys.get(id).push(j.id)
    }
  }

  /** node id -> its own edge ids, the fallback when no journey touches it */
  const nodeEdges = new Map(nodes.map((n) => [n.id, []]))
  for (const e of edges) {
    nodeEdges.get(e.from).push(e.id)
    nodeEdges.get(e.to).push(e.id)
  }

  const columns = Math.max(0, ...nodes.map((n) => n.column))
  const width = metrics.padding * 2 + columns * metrics.nodeWidth + Math.max(0, columns - 1) * metrics.columnGap
  const height =
    metrics.padding * 2 +
    (data.lanes || []).length * (metrics.nodeHeight + metrics.laneGap + metrics.laneLabel) -
    metrics.laneGap

  return {
    metrics,
    nodes,
    edges,
    journeys,
    byId,
    edgeById,
    nodeJourneys,
    edgeJourneys,
    nodeEdges,
    /** Nodes no journey touches -- derived, never maintained. */
    orphans: nodes.filter((n) => !nodeJourneys.has(n.id)).map((n) => n.id),
    lanes: (data.lanes || []).map((lane, i) => ({
      ...lane,
      y: metrics.padding + i * (metrics.nodeHeight + metrics.laneGap + metrics.laneLabel),
      h: metrics.nodeHeight + metrics.laneLabel,
    })),
    width,
    height: Math.max(height, metrics.padding * 2),
    problems: validate(data),
  }
}

/**
 * A journey as a sentence: the drawing is never the only copy of the
 * information. That prose is what licenses hiding the popover on touch and
 * below a narrow breakpoint.
 */
export function describeJourney(model, journey) {
  const hops = journey.edges.map((id) => {
    const e = model.edgeById.get(id)
    const from = model.byId.get(e.from)?.label || e.from
    const to = model.byId.get(e.to)?.label || e.to
    return e.label ? `${from} → ${to} (${e.label})` : `${from} → ${to}`
  })
  return hops.join(', then ')
}
