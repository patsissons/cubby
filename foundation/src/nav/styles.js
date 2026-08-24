export const STYLES = `
.cubby-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--bg, #faf8f5);
  border-bottom: 1px solid var(--border, #e7e2da);
}
.cubby-nav-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 64rem;
  margin: 0 auto;
  padding: 0 1rem;
}
.cubby-nav-sections {
  border-top: 1px solid var(--border, #e7e2da);
}
/* min-width: 0 is load-bearing. Flex items default to min-width: auto and
   refuse to size below their content, so without this the scrolling row shoves
   the action area off the right edge of a narrow window instead of scrolling
   itself -- carrying the only pressable controls out of reach. */
.cubby-nav-scroll {
  min-width: 0;
  flex: 1;
  display: flex;
  gap: 0.15rem;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.cubby-nav-scroll::-webkit-scrollbar { display: none; }
/* The action area never scrolls: it is pinned beside the scrolling row. */
.cubby-nav-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
/* Style the slot's children generically. Naming a consumer by class here
   (.cubby-nav-actions .some-widget) would make the bar know about widgets that
   have not been written yet. */
.cubby-nav-actions > * { flex: none; }
.cubby-nav-pill {
  flex: none;
  display: inline-block;
  padding: 0.5rem 0.7rem;
  color: var(--muted, #77706a);
  text-decoration: none;
  font-size: 0.9rem;
  line-height: 1.2;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
}
.cubby-nav-pill:hover { color: var(--fg, #201d1a); }
.cubby-nav-pill[aria-current] {
  color: var(--accent, #c2571b);
  border-bottom-color: var(--accent, #c2571b);
}
.cubby-nav-sections .cubby-nav-pill { padding: 0.35rem 0.6rem; font-size: 0.85rem; }
.cubby-nav-pill:focus-visible {
  outline: 2px solid var(--accent, #c2571b);
  outline-offset: -2px;
  border-radius: 4px;
}
`

/**
 * The two rules the bar leaks into the host page, both opt-out-able.
 *
 * A sticky bar that does not set scroll-margin-top lands every anchor jump
 * underneath itself. The offset is read from the custom property the bar
 * publishes from its own measured height, so it cannot disagree with reality
 * for a different font, type scale, or number of rows.
 */
export const GLOBAL_STYLES = `
:target,
[id] { scroll-margin-top: calc(var(--cubby-nav-height, 0px) + 0.75rem); }
@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
}
`
