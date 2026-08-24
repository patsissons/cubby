export const STYLES = `
.cubby-graph {
  --cubby-graph-dim: 0.16;
  position: relative;
  margin: 1.25rem 0;
  color: var(--fg, #201d1a);
}
.cubby-graph-frame {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border, #e7e2da);
  border-radius: 10px;
  background: var(--card, #fff);
  touch-action: pan-y;
}
.cubby-graph-canvas { display: block; width: 100%; height: auto; cursor: grab; }
.cubby-graph-canvas[data-panning] { cursor: grabbing; }

.cubby-graph-lane { fill: var(--code-bg, #f2eee8); }
.cubby-graph-lane-label {
  fill: var(--muted, #77706a);
  font: 600 10px/1 system-ui, sans-serif;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.cubby-graph-node rect {
  fill: var(--card, #fff);
  stroke: var(--border, #c8c2ba);
  stroke-width: 1.5;
  rx: 8;
}
.cubby-graph-node text {
  fill: var(--fg, #201d1a);
  font: 500 12px/1 system-ui, sans-serif;
  text-anchor: middle;
}
.cubby-graph-node { cursor: pointer; }
.cubby-graph-node:focus { outline: none; }
.cubby-graph-node:focus-visible rect,
.cubby-graph-node[data-on] rect { stroke: var(--accent, #c2571b); stroke-width: 2.5; }
.cubby-graph-edge {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  cursor: pointer;
}
.cubby-graph-edge-hit { fill: none; stroke: transparent; stroke-width: 14; cursor: pointer; }
.cubby-graph-edge-label {
  fill: var(--muted, #77706a);
  font: 10px/1 system-ui, sans-serif;
  text-anchor: middle;
  paint-order: stroke;
  stroke: var(--card, #fff);
  stroke-width: 3px;
}
/* Dimming is applied to everything NOT participating, so the highlight reads
   as focus rather than as a colour change. */
.cubby-graph[data-focused] .cubby-graph-node:not([data-on]),
.cubby-graph[data-focused] .cubby-graph-edge:not([data-on]),
.cubby-graph[data-focused] .cubby-graph-edge-label:not([data-on]) {
  opacity: var(--cubby-graph-dim);
}
.cubby-graph-edge[data-on] { stroke-width: 3.5; }

.cubby-graph-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0.6rem 0 0;
  padding: 0;
  list-style: none;
}
.cubby-graph-chip {
  border: 1px solid var(--border, #e7e2da);
  background: none;
  border-radius: 999px;
  padding: 0.25rem 0.6rem;
  font: 500 0.8rem/1.2 system-ui, sans-serif;
  color: var(--muted, #77706a);
  cursor: pointer;
}
.cubby-graph-chip::before {
  content: '';
  display: inline-block;
  width: 0.7rem;
  height: 0.2rem;
  margin-right: 0.35rem;
  vertical-align: middle;
  border-radius: 2px;
  background: currentColor;
}
.cubby-graph-chip[data-on],
.cubby-graph-chip:hover,
.cubby-graph-chip:focus-visible { color: var(--fg, #201d1a); border-color: currentColor; }

.cubby-graph-controls {
  position: absolute;
  right: 0.5rem;
  top: 0.5rem;
  display: flex;
  gap: 0.25rem;
}
.cubby-graph-controls button {
  width: 1.75rem;
  height: 1.75rem;
  border: 1px solid var(--border, #e7e2da);
  background: var(--card, #fff);
  border-radius: 6px;
  color: var(--muted, #77706a);
  font: 600 0.9rem/1 system-ui, sans-serif;
  cursor: pointer;
}
.cubby-graph-hint {
  margin: 0.4rem 0 0;
  color: var(--muted, #77706a);
  font-size: 0.78rem;
}
.cubby-graph-prose { margin: 0.5rem 0 0; font-size: 0.85rem; color: var(--muted, #77706a); }
.cubby-graph-prose dt { font-weight: 600; color: var(--fg, #201d1a); margin-top: 0.4rem; }
.cubby-graph-prose dd { margin: 0.1rem 0 0; }

/* pointer-events: none is load-bearing. Without it, moving the cursor toward
   the popover hovers the popover, which fires the edge's mouseleave, and the
   popover vanishes as you reach for it. */
.cubby-graph-popover {
  position: fixed;
  z-index: 50;
  max-width: 18rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--border, #e7e2da);
  border-radius: 8px;
  background: var(--card, #fff);
  box-shadow: var(--shadow, 0 4px 12px rgb(0 0 0 / 0.1));
  font-size: 0.82rem;
  line-height: 1.45;
  pointer-events: none;
}
.cubby-graph-popover strong { display: block; margin-bottom: 0.15rem; }
/* The prose list below the canvas carries the same information, which is what
   licenses hiding the popover here at all. */
@media (hover: none), (max-width: 34rem) {
  .cubby-graph-popover { display: none !important; }
}
`
