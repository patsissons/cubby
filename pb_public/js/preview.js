/* cubby preview v0.1.0 (https://github.com/patsissons/cubby) */
(()=>{var b=typeof window<"u"&&window.cubby||null,Q=b?.CubbyError,X=b?.toCubbyError,Z=b?.escapeHtml,ee=b?.sanitizeUrl,D=b?.injectStyle,H=b?.ensureTokens,O=b?.widget;function F(p,...n){let d=[];b?.CubbyError||d.push("core.js");for(let s of n)b?.[s]||d.push(`${s}.js`);return d.length?(console.error(`[cubby] ${p} needs ${d.join(" + ")} loaded first. Tag order is core.js, platform.js, markdown.js, editor.js, then your app.js \u2014 all defer.`),null):b}var P=`
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
`;function k(p,n){try{return new URL(p,n)}catch{return null}}function z(p,{allow:n=[],origin:d}={}){let s=k(p,d);if(!s||s.protocol!=="http:"&&s.protocol!=="https:")return!1;let a=k(d,d);if(a&&s.origin===a.origin)return!0;let r=s.hostname.toLowerCase();for(let g of n){if(typeof g!="string"||!g)continue;let w=g.trim().toLowerCase();if(w.startsWith(".")){if(r===w.slice(1)||r.endsWith(w))return!0}else if(r===w)return!0}return!1}var V=900,G=220,J=4e3,K=4e3;function W(p){return O("preview",(n,d,s={})=>{let a=d.ownerDocument,r=a.defaultView;H(),D("preview",P);let g=s.selector||"a[href]",w=s.delay??V,$=s.hideDelay??G,I=s.unloadDelay??J,U=s.allow||p?.config?.preview?.frameable||[],j=r.location.origin,o=a.createElement("div");o.className="cubby-preview",o.hidden=!0,a.body.appendChild(o),n.own(()=>o.remove());let h=null,E=null,L=null,x=null,C=()=>{E&&r.clearTimeout(E),E=null};n.own(C),n.own(()=>r.clearTimeout(L)),n.own(()=>r.clearTimeout(x));function R(e){let t=s.describe?.(e);return{title:t?.title??e.getAttribute("data-preview-title")??e.textContent.trim(),description:t?.description??e.getAttribute("data-preview-description")??"",href:t?.href??e.getAttribute("href")}}function q({title:e,description:t,href:f,url:c,frameable:l}){o.replaceChildren();let i=a.createElement("div");i.className="cubby-preview-head";let A=a.createElement("span");if(A.className="cubby-preview-title",A.textContent=e||c?.hostname||"Preview",i.appendChild(A),c){let u=a.createElement("a");u.className="cubby-preview-open",u.href=f,u.textContent="Open",u.rel="noopener noreferrer",i.appendChild(u)}if(o.appendChild(i),l){let u=a.createElement("div");u.className="cubby-preview-frame-wrap";let v=a.createElement("div");v.className="cubby-preview-overlay",v.textContent="loading preview...";let m=a.createElement("iframe");return m.className="cubby-preview-frame",m.setAttribute("title",e||"Preview"),m.setAttribute("loading","lazy"),m.setAttribute("referrerpolicy","no-referrer"),m.setAttribute("sandbox",s.scripts?"allow-scripts":""),m.addEventListener("load",()=>{r.clearTimeout(x),v.remove()}),u.append(m,v),o.appendChild(u),r.clearTimeout(x),x=r.setTimeout(()=>{v.isConnected&&(v.textContent="still loading; the site may be refusing to embed",v.setAttribute("data-slow",""))},K),m}if(t){let u=a.createElement("div");u.className="cubby-preview-description",u.textContent=t,o.appendChild(u)}let y=a.createElement("div");return y.className="cubby-preview-note",y.textContent=c?`${c.hostname} does not allow embedding.`:"That link cannot be previewed.",o.appendChild(y),null}function Y(e){let t=e.getBoundingClientRect(),f=o.offsetWidth||432,c=o.offsetHeight||360,l=t.left;l+f>r.innerWidth-8&&(l=r.innerWidth-f-8),l<8&&(l=8);let i=t.bottom+8;i+c>r.innerHeight-8&&(i=t.top-c-8),i<8&&(i=8),o.style.left=`${Math.round(l)}px`,o.style.top=`${Math.round(i)}px`}function _(e){let{title:t,description:f,href:c}=R(e),l=k(c,j),i=l&&(l.protocol==="http:"||l.protocol==="https:")?l:null,A=z(c,{allow:U,origin:j});h=e,r.clearTimeout(L);let y=q({title:t,description:f,href:c,url:i,frameable:A});o.hidden=!1,Y(e),y&&i&&y.setAttribute("src",i.href),o.setAttribute("data-shown","")}function T(){C(),h=null,o.removeAttribute("data-shown"),o.hidden=!0,r.clearTimeout(x),r.clearTimeout(L),L=r.setTimeout(()=>{h||o.replaceChildren()},I)}function M(e){C(),E=r.setTimeout(()=>_(e),w)}function N(e){C(),E=r.setTimeout(()=>{(h===e||h===null)&&T()},$)}let S=e=>e.target instanceof r.Element?e.target.closest(g):null;n.on(d,"mouseover",e=>{let t=S(e);t&&M(t)}),n.on(d,"mouseout",e=>{let t=S(e);t&&N(t)}),n.on(d,"focusin",e=>{let t=S(e);t&&M(t)}),n.on(d,"focusout",e=>{let t=S(e);t&&N(t)}),n.on(o,"mouseenter",C),n.on(o,"mouseleave",()=>N(h)),n.on(a,"keydown",e=>{e.key==="Escape"&&T()}),n.on(a,"scroll",e=>{let t=e.target;t instanceof r.Node&&o.contains(t)||T()},{capture:!0,passive:!0}),n.on(r,"resize",T);function B(e,t={}){let f=()=>M(e),c=()=>N(e),l=t.describe;l&&(e.__cubbyPreviewDescribe=l),e.addEventListener("mouseenter",f),e.addEventListener("mouseleave",c),e.addEventListener("focus",f),e.addEventListener("blur",c);let i=()=>{e.removeEventListener("mouseenter",f),e.removeEventListener("mouseleave",c),e.removeEventListener("focus",f),e.removeEventListener("blur",c)};return n.own(i),i}return{attach:B,show:_,hide:T,popover:o,isFrameable:e=>z(e,{allow:U,origin:j})}})}if(typeof window<"u"){let p=F("preview.js");p&&(p.preview=W(p))}})();
