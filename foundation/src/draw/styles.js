export const STYLES = `
.cubby-draw-marks,
.cubby-draw-cursors {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  /* Load-bearing: these overlays cover the page and would otherwise eat every
     click, hover and text selection on it. */
  pointer-events: none;
}
/* The cursors layer is a <div>: absolutely positioned children escape a zero
   height happily, so it needs no size of its own. */
.cubby-draw-cursors {
  height: 0;
  overflow: visible;
}
/* The marks layer is an <svg>, which is NOT the same. An outer svg establishes
   its own viewport and clips to it, so at height 0 every stroke was drawn
   correctly and then clipped away entirely -- the bug where the puck appeared
   and the line never did. Its height is set from the document in JS; the
   overflow rule stays only as a backstop. */
.cubby-draw-marks {
  overflow: visible;
}
/* Marks sit BELOW a sticky bar -- a mark drawn near the top should slide under
   it like the content it was drawn on, and painting over the bar makes the nav
   unreadable for the whole fade. Cursors sit ABOVE it: a peer pointing at a nav
   link is the one case the puck has to win. */
.cubby-draw-marks { z-index: 30; }
.cubby-draw-cursors { z-index: 70; }

.cubby-draw-path {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: opacity var(--cubby-draw-fade, 5000ms) linear;
}
.cubby-draw-path[data-fading] { opacity: 0 !important; }

.cubby-draw-puck {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  transform: translate(-2px, -2px);
  font: 500 0.75rem/1 system-ui, sans-serif;
  white-space: nowrap;
  transition: left 220ms linear, top 220ms linear;
}
.cubby-draw-puck[data-self] { transition: none; }
.cubby-draw-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50% 50% 50% 2px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.35);
}
.cubby-draw-name {
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  color: #fff;
}

.cubby-draw-chip {
  position: fixed;
  right: 0.75rem;
  bottom: 0.75rem;
  z-index: 71;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  background: var(--card, #fff);
  border: 1px solid var(--border, #e7e2da);
  box-shadow: var(--shadow, 0 4px 12px rgb(0 0 0 / 0.08));
  color: var(--muted, #77706a);
  font: 0.8rem/1 system-ui, sans-serif;
}
.cubby-draw-count { font-variant-numeric: tabular-nums; }
/* Below a narrow breakpoint the sentence is CLIPPED, not display:none, so a
   screen reader still hears "2 others here" while the eye gets a bare numeral
   -- and the numeral is aria-hidden precisely because it is the lesser copy.
   Hiding the sentence would downgrade a spoken live region to a digit. */
.cubby-draw-said {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
@media (min-width: 30rem) {
  .cubby-draw-said {
    position: static;
    width: auto;
    height: auto;
    margin: 0;
    overflow: visible;
    clip: auto;
  }
  .cubby-draw-count { display: none; }
}
`

/**
 * Hiding the native cursor needs the one !important in the library: a host page
 * has any number of cursor: pointer rules plus the UA's own on links and
 * inputs, every one of them more specific than a rule on body.
 */
export const HELD_STYLES = `
body.cubby-draw-held,
body.cubby-draw-held * { cursor: none !important; }
`
