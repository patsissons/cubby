/* cubby nav v0.1.0 (https://github.com/patsissons/cubby) */
(()=>{var s=typeof window<"u"&&window.cubby||null,H=s?.CubbyError,U=s?.toCubbyError,_=s?.escapeHtml,D=s?.sanitizeUrl,E=s?.injectStyle,j=s?.ensureTokens,M=s?.widget;function $(o,...c){let i=[];s?.CubbyError||i.push("core.js");for(let r of c)s?.[r]||i.push(`${r}.js`);return i.length?(console.error(`[cubby] ${o} needs ${i.join(" + ")} loaded first. Tag order is core.js, platform.js, markdown.js, editor.js, then your app.js \u2014 all defer.`),null):s}var R=`
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
`,I=`
:target,
[id] { scroll-margin-top: calc(var(--cubby-nav-height, 0px) + 0.75rem); }
@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
}
`;var C="--cubby-nav-height";function O(o){let c;try{c=new URL(o,"https://x.invalid/").pathname}catch{return null}return c.replace(/index\.html?$/,"").replace(/\/*$/,"/")}function P(){return M("nav",(o,c,i={})=>{let r=c.ownerDocument,p=r.defaultView;j(),E("nav",R),i.globalRules!==!1&&E("nav-global",I);let u=r.createElement("nav");u.className="cubby-nav",u.setAttribute("aria-label",i.label||"Site");let w=r.createElement("div");w.className="cubby-nav-row cubby-nav-pages";let h=r.createElement("div");h.className="cubby-nav-scroll";let y=r.createElement("div");y.className="cubby-nav-actions";let S=O(p.location.href);for(let e of i.pages||[]){let t=r.createElement("a");t.className="cubby-nav-pill",t.href=e.href,t.textContent=e.label,O(e.href)===S&&t.setAttribute("aria-current","page"),h.appendChild(t)}w.append(h,y),u.appendChild(w);let v=r.createElement("div");v.className="cubby-nav-row cubby-nav-sections";let f=r.createElement("div");f.className="cubby-nav-scroll",v.appendChild(f),u.appendChild(v),c.replaceChildren(u),o.own(()=>u.remove());let g=new Map,m=null,b=null;function q(){let e=i.sections;return e?typeof e=="string"?r.querySelector(e):e:r.querySelector("main")||r.body}function A(){let e=q();return e?[...e.querySelectorAll("[aria-labelledby]")].map(t=>{let a=t.getAttribute("aria-labelledby"),n=a&&r.getElementById(a);if(!n||t.hidden||t.closest("[hidden]"))return null;let l=t.getAttribute("data-nav-label")||n.textContent.trim();return{id:a,section:t,label:l}}).filter(Boolean):[]}function N(e,t){if(!e||!t)return;let a=t.getBoundingClientRect();if(!a.width)return;let n=e.getBoundingClientRect(),l=16,d=0;if(n.left<a.left+l?d=n.left-a.left-l:n.right>a.right-l&&(d=n.right-a.right+l),!d)return;let Y=Math.max(0,t.scrollWidth-t.clientWidth),k=Math.max(0,Math.min(t.scrollLeft+d,Y||1/0));if(k===t.scrollLeft)return;let F=p.matchMedia?.("(prefers-reduced-motion: reduce)").matches;typeof t.scrollTo=="function"?t.scrollTo({left:k,behavior:F?"auto":"smooth"}):t.scrollLeft=k}function z(e){if(e===b)return;b&&g.get(b)?.removeAttribute("aria-current"),b=e;let t=g.get(e);t?.setAttribute("aria-current","true"),N(t,f)}function T(){m?.disconnect(),g=new Map,f.replaceChildren();let e=A();v.hidden=e.length===0;for(let{id:t,label:a}of e){let n=r.createElement("a");n.className="cubby-nav-pill",n.href=`#${t}`,n.textContent=a,f.appendChild(n),g.set(t,n)}b&&!g.has(b)&&(b=null),x(),L(e)}function L(e){if(!e.length||typeof p.IntersectionObserver!="function")return;let t=B(),[a,n]=i.band||[t+8,70];m=new p.IntersectionObserver(l=>{for(let d of l)d.isIntersecting&&z(d.target.getAttribute("aria-labelledby"))},{rootMargin:`-${a}px 0px -${n}% 0px`}),o.own(()=>m?.disconnect());for(let{section:l}of e)m.observe(l)}function B(){let e=r.documentElement.style.getPropertyValue(C);return parseFloat(e)||0}function x(){let e=u.getBoundingClientRect().height;return r.documentElement.style.setProperty(C,`${Math.round(e)}px`),e&&(c.style.height=`${Math.round(e)}px`),e}return T(),N(h.querySelector("[aria-current]"),h),o.on(p,"resize",()=>{x(),m?.disconnect(),L(A())}),o.own(()=>r.documentElement.style.removeProperty(C)),o.own(()=>c.style.removeProperty("height")),{current(){return{page:S,section:b,actions:y}},refresh:T,height:x,root:u,actions:y}})}if(typeof window<"u"){let o=$("nav.js");o&&(o.nav=P(o))}})();
