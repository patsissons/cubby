export const STYLES = `
.cubby-preview {
  position: fixed;
  z-index: 60;
  width: 27rem;
  max-width: calc(100vw - 1rem);
  background: var(--card, #fff);
  border: 1px solid var(--border, #e7e2da);
  border-radius: 10px;
  box-shadow: var(--shadow-hover, 0 10px 24px rgb(0 0 0 / 0.18));
  overflow: hidden;
  opacity: 0;
  transition: opacity 120ms ease;
  font-size: 0.9rem;
}
.cubby-preview[data-shown] { opacity: 1; }
.cubby-preview-head {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid var(--border, #e7e2da);
}
.cubby-preview-title {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  color: var(--fg, #201d1a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cubby-preview-open {
  flex: none;
  color: var(--accent, #c2571b);
  text-decoration: none;
  font-size: 0.85em;
}
.cubby-preview-open:hover { text-decoration: underline; }
.cubby-preview-note,
.cubby-preview-description {
  padding: 0.7rem 0.8rem;
  color: var(--muted, #77706a);
  line-height: 1.5;
}
.cubby-preview-note { border-top: 1px solid var(--border, #e7e2da); font-size: 0.85em; }
.cubby-preview-frame-wrap {
  position: relative;
  height: 20rem;
  background: var(--bg, #faf8f5);
}
.cubby-preview-frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
.cubby-preview-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--muted, #77706a);
  font-size: 0.85em;
  background: var(--bg, #faf8f5);
}
.cubby-preview-overlay[data-slow] { color: #b4690e; }
/* A tap on a wide touch device can move focus and open a popover with no
   pointer to dismiss it, so suppress on hover-less pointers as well as on
   narrow screens. */
@media (hover: none), (max-width: 40rem) {
  .cubby-preview { display: none !important; }
}
`
