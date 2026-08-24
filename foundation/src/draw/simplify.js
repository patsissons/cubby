/**
 * Path simplification for captured strokes.
 *
 * Pointer input arrives at 60-120Hz, so a one-second stroke is 60-120 points
 * of which almost all are noise. Ramer-Douglas-Peucker keeps the points that
 * carry the shape and drops the rest, typically 70-90% of them. That is what
 * makes "one event per stroke segment" affordable: the whole path travels as a
 * few hundred bytes rather than a few kilobytes.
 *
 * Pure and DOM-free so it is testable under plain Node.
 */

/** Perpendicular distance from p to the line ab (squared, to avoid a sqrt). */
function distanceSq(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  if (dx === 0 && dy === 0) {
    return (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2
  }
  // Cross product magnitude over segment length, squared.
  const cross = dx * (a[1] - p[1]) - dy * (a[0] - p[0])
  return (cross * cross) / (dx * dx + dy * dy)
}

/**
 * Ramer-Douglas-Peucker, iterative so a long path cannot blow the stack.
 * @param {Array<[number, number]>} points
 * @param {number} tolerance in the same units as the points
 * @returns {Array<[number, number]>}
 */
export function simplify(points, tolerance = 0.002) {
  if (!Array.isArray(points) || points.length < 3) return points ? [...points] : []
  const toleranceSq = tolerance * tolerance
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1

  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()
    let index = -1
    let furthest = toleranceSq
    for (let i = first + 1; i < last; i++) {
      const d = distanceSq(points[i], points[first], points[last])
      if (d > furthest) {
        furthest = d
        index = i
      }
    }
    if (index !== -1) {
      keep[index] = 1
      stack.push([first, index], [index, last])
    }
  }

  const out = []
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i])
  return out
}

/**
 * Simplify, round, and hard-cap a captured segment for the wire.
 *
 * Rounding is not cosmetic: x is a fraction of the anchor's width so three
 * decimals is sub-pixel on any realistic screen, and y is document pixels so
 * whole numbers are exact. Together they roughly halve the payload.
 *
 * The cap is a backstop against a pathological input device, not an expected
 * path -- exceeding it decimates evenly rather than truncating, because losing
 * the end of a stroke is far more visible than losing detail along it.
 *
 * @param {Array<[number, number]>} points
 * @param {{tolerance?: number, max?: number}} [opts]
 */
export function packPoints(points, { tolerance = 0.002, max = 500 } = {}) {
  let out = simplify(points, tolerance)
  if (out.length > max) {
    const step = out.length / max
    const thinned = []
    for (let i = 0; i < max - 1; i++) thinned.push(out[Math.floor(i * step)])
    thinned.push(out[out.length - 1])
    out = thinned
  }
  return out.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y)])
}

/** Build an SVG path `d` from projected viewport/document points. */
export function toPathData(points) {
  if (!points.length) return ''
  let d = `M${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length; i++) d += `L${points[i][0]} ${points[i][1]}`
  return d
}
