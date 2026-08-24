/* cubby nav v0.1.0 (https://github.com/patsissons/cubby) */
(()=>{var i=typeof window<"u"&&window.cubby||null,M=i?.CubbyError,Y=i?.toCubbyError,B=i?.escapeHtml,F=i?.sanitizeUrl,x=i?.injectStyle,T=i?.ensureTokens,j=i?.widget;function L(n,...l){let o=[];i?.CubbyError||o.push("core.js");for(let t of l)i?.[t]||o.push(`${t}.js`);return o.length?(console.error(`[cubby] ${n} needs ${o.join(" + ")} loaded first. Tag order is core.js, platform.js, markdown.js, editor.js, then your app.js \u2014 all defer.`),null):i}var $=`
/* FIXED, not sticky. A sticky element only sticks while its containing block
   is in view, and the mount point is a bare element whose height is exactly the
   bar's -- so it scrolled out of view immediately and took the bar with it.
   Fixed sidesteps the containing block entirely; the widget reserves the space
   it no longer occupies by setting the mount element's height from its own
   measurement, rather than leaking a third global rule onto the host. */
.cubby-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  background: var(--bg, #faf8f5);
  border-bottom: 1px solid var(--border, #e7e2da);
}

/* The translucent background is applied ONLY where the blur actually works.
   Without the guard, a browser lacking backdrop-filter renders a see-through
   bar with page content legible straight through the labels; an opaque bar is
   the correct degradation. */
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  .cubby-nav {
    background: color-mix(in srgb, var(--bg, #faf8f5) 72%, transparent);
    -webkit-backdrop-filter: blur(10px) saturate(1.4);
    backdrop-filter: blur(10px) saturate(1.4);
  }
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
`,O=`
:target,
[id] { scroll-margin-top: calc(var(--cubby-nav-height, 0px) + 0.75rem); }
@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
}
`;var k="--cubby-nav-height";function z(n){let l;try{l=new URL(n,"https://x.invalid/").pathname}catch{return null}return l.replace(/index\.html?$/,"").replace(/\/*$/,"/")}function I(){return j("nav",(n,l,o={})=>{let t=l.ownerDocument,h=t.defaultView;T(),x("nav",$),o.globalRules!==!1&&x("nav-global",O);let s=t.createElement("nav");s.className="cubby-nav",s.setAttribute("aria-label",o.label||"Site");let y=t.createElement("div");y.className="cubby-nav-row cubby-nav-pages";let v=t.createElement("div");v.className="cubby-nav-scroll";let f=t.createElement("div");f.className="cubby-nav-actions";let E=z(h.location.href);for(let e of o.pages||[]){let r=t.createElement("a");r.className="cubby-nav-pill",r.href=e.href,r.textContent=e.label,z(e.href)===E&&r.setAttribute("aria-current","page"),v.appendChild(r)}y.append(v,f),s.appendChild(y);let g=t.createElement("div");g.className="cubby-nav-row cubby-nav-sections";let m=t.createElement("div");m.className="cubby-nav-scroll",g.appendChild(m),s.appendChild(g),l.replaceChildren(s),n.own(()=>s.remove());let u=new Map,d=null,c=null;function P(){let e=o.sections;return e?typeof e=="string"?t.querySelector(e):e:t.querySelector("main")||t.body}function C(){let e=P();return e?[...e.querySelectorAll("[aria-labelledby]")].map(r=>{let b=r.getAttribute("aria-labelledby"),a=b&&t.getElementById(b);if(!a||r.hidden||r.closest("[hidden]"))return null;let p=r.getAttribute("data-nav-label")||a.textContent.trim();return{id:b,section:r,label:p}}).filter(Boolean):[]}function R(e){e!==c&&(c&&u.get(c)?.removeAttribute("aria-current"),c=e,u.get(e)?.setAttribute("aria-current","true"))}function S(){d?.disconnect(),u=new Map,m.replaceChildren();let e=C();g.hidden=e.length===0;for(let{id:r,label:b}of e){let a=t.createElement("a");a.className="cubby-nav-pill",a.href=`#${r}`,a.textContent=b,m.appendChild(a),u.set(r,a)}c&&!u.has(c)&&(c=null),w(),A(e)}function A(e){if(!e.length||typeof h.IntersectionObserver!="function")return;let r=q(),[b,a]=o.band||[r+8,70];d=new h.IntersectionObserver(p=>{for(let N of p)N.isIntersecting&&R(N.target.getAttribute("aria-labelledby"))},{rootMargin:`-${b}px 0px -${a}% 0px`}),n.own(()=>d?.disconnect());for(let{section:p}of e)d.observe(p)}function q(){let e=t.documentElement.style.getPropertyValue(k);return parseFloat(e)||0}function w(){let e=s.getBoundingClientRect().height;return t.documentElement.style.setProperty(k,`${Math.round(e)}px`),e&&(l.style.height=`${Math.round(e)}px`),e}return S(),n.on(h,"resize",()=>{w(),d?.disconnect(),A(C())}),n.own(()=>t.documentElement.style.removeProperty(k)),n.own(()=>l.style.removeProperty("height")),{current(){return{page:E,section:c,actions:f}},refresh:S,height:w,root:s,actions:f}})}if(typeof window<"u"){let n=L("nav.js");n&&(n.nav=I(n))}})();
