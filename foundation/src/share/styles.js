// Injected once per document under the cubby-share style tag. Everything is
// tokens-based so the stack inherits each app's theme for free.
export const STYLES = `
.cubby-share {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.cubby-share-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  font: inherit;
  color: var(--fg);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  cursor: pointer;
}

.cubby-share-btn:hover {
  border-color: var(--accent);
}

.cubby-share-btn.ok {
  border-color: var(--accent);
  color: var(--accent);
}

dialog.cubby-share-qr {
  text-align: center;
  color: var(--fg);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1.25rem;
  max-width: 20rem;
}

dialog.cubby-share-qr::backdrop {
  background: rgba(0, 0, 0, 0.5);
}

.cubby-share-qr h2 {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
  overflow-wrap: anywhere;
}

.cubby-share-qr img {
  width: 12.5rem;
  max-width: 100%;
  image-rendering: pixelated;
  border-radius: 0.5rem;
}

.cubby-share-qr .cubby-share-qr-url {
  color: var(--muted);
  font-size: 0.8rem;
  word-break: break-all;
}

.cubby-share-qr button {
  font: inherit;
  color: var(--fg);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.3rem 0.8rem;
  cursor: pointer;
}

.cubby-share-qr button:hover {
  border-color: var(--accent);
}
`
