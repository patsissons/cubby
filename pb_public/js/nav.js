/* cubby nav v0.1.0 (https://github.com/patsissons/cubby) */
(()=>{var i=typeof window<"u"&&window.cubby||null,B=i?.CubbyError,H=i?.toCubbyError,M=i?.escapeHtml,Y=i?.sanitizeUrl,x=i?.injectStyle,k=i?.ensureTokens,T=i?.widget;function L(r,...s){let o=[];i?.CubbyError||o.push("core.js");for(let t of s)i?.[t]||o.push(`${t}.js`);return o.length?(console.error(`[cubby] ${r} needs ${o.join(" + ")} loaded first. Tag order is core.js, platform.js, markdown.js, editor.js, then your app.js \u2014 all defer.`),null):i}var $=`
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
`,z=`
:target,
[id] { scroll-margin-top: calc(var(--cubby-nav-height, 0px) + 0.75rem); }
@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
}
`;var E="--cubby-nav-height";function O(r){let s;try{s=new URL(r,"https://x.invalid/").pathname}catch{return null}return s.replace(/index\.html?$/,"").replace(/\/*$/,"/")}function R(){return T("nav",(r,s,o={})=>{let t=s.ownerDocument,f=t.defaultView;k(),x("nav",$),o.globalRules!==!1&&x("nav-global",z);let l=t.createElement("nav");l.className="cubby-nav",l.setAttribute("aria-label",o.label||"Site");let v=t.createElement("div");v.className="cubby-nav-row cubby-nav-pages";let g=t.createElement("div");g.className="cubby-nav-scroll";let m=t.createElement("div");m.className="cubby-nav-actions";let C=O(f.location.href);for(let e of o.pages||[]){let n=t.createElement("a");n.className="cubby-nav-pill",n.href=e.href,n.textContent=e.label,O(e.href)===C&&n.setAttribute("aria-current","page"),g.appendChild(n)}v.append(g,m),l.appendChild(v);let h=t.createElement("div");h.className="cubby-nav-row cubby-nav-sections";let y=t.createElement("div");y.className="cubby-nav-scroll",h.appendChild(y),l.appendChild(h),s.replaceChildren(l),r.own(()=>l.remove());let u=new Map,d=null,c=null;function I(){let e=o.sections;return e?typeof e=="string"?t.querySelector(e):e:t.querySelector("main")||t.body}function S(){let e=I();return e?[...e.querySelectorAll("[aria-labelledby]")].map(n=>{let b=n.getAttribute("aria-labelledby"),a=b&&t.getElementById(b);if(!a||n.hidden||n.closest("[hidden]"))return null;let p=n.getAttribute("data-nav-label")||a.textContent.trim();return{id:b,section:n,label:p}}).filter(Boolean):[]}function P(e){e!==c&&(c&&u.get(c)?.removeAttribute("aria-current"),c=e,u.get(e)?.setAttribute("aria-current","true"))}function A(){d?.disconnect(),u=new Map,y.replaceChildren();let e=S();h.hidden=e.length===0;for(let{id:n,label:b}of e){let a=t.createElement("a");a.className="cubby-nav-pill",a.href=`#${n}`,a.textContent=b,y.appendChild(a),u.set(n,a)}c&&!u.has(c)&&(c=null),w(),N(e)}function N(e){if(!e.length||typeof f.IntersectionObserver!="function")return;let n=q(),[b,a]=o.band||[n+8,70];d=new f.IntersectionObserver(p=>{for(let j of p)j.isIntersecting&&P(j.target.getAttribute("aria-labelledby"))},{rootMargin:`-${b}px 0px -${a}% 0px`}),r.own(()=>d?.disconnect());for(let{section:p}of e)d.observe(p)}function q(){let e=t.documentElement.style.getPropertyValue(E);return parseFloat(e)||0}function w(){let e=l.getBoundingClientRect().height;return t.documentElement.style.setProperty(E,`${Math.round(e)}px`),e}return A(),r.on(f,"resize",()=>{w(),d?.disconnect(),N(S())}),r.own(()=>t.documentElement.style.removeProperty(E)),{current(){return{page:C,section:c,actions:m}},refresh:A,height:w,root:l,actions:m}})}if(typeof window<"u"){let r=L("nav.js");r&&(r.nav=R(r))}})();
