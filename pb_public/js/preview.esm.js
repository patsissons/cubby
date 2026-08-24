/* cubby preview v0.1.0 (https://github.com/patsissons/cubby) */
import{widget as $,injectStyle as I,ensureTokens as Y}from"./core.esm.js";var W=`
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
`;function N(h,n){try{return new URL(h,n)}catch{return null}}function z(h,{allow:n=[],origin:p}={}){let l=N(h,p);if(!l||l.protocol!=="http:"&&l.protocol!=="https:")return!1;let a=N(p,p);if(a&&l.origin===a.origin)return!0;let r=l.hostname.toLowerCase();for(let y of n){if(typeof y!="string"||!y)continue;let b=y.trim().toLowerCase();if(b.startsWith(".")){if(r===b.slice(1)||r.endsWith(b))return!0}else if(r===b)return!0}return!1}var j=900,B=220,V=4e3,q=4e3;function G(h){return $("preview",(n,p,l={})=>{let a=p.ownerDocument,r=a.defaultView;Y(),I("preview",W);let y=l.selector||"a[href]",b=l.delay??j,F=l.hideDelay??B,H=l.unloadDelay??V,_=l.allow||h?.config?.preview?.frameable||[],S=r.location.origin,o=a.createElement("div");o.className="cubby-preview",o.hidden=!0,a.body.appendChild(o),n.own(()=>o.remove());let v=null,g=null,L=null,E=null,T=()=>{g&&r.clearTimeout(g),g=null};n.own(T),n.own(()=>r.clearTimeout(L)),n.own(()=>r.clearTimeout(E));function O(e){let t=l.describe?.(e);return{title:t?.title??e.getAttribute("data-preview-title")??e.textContent.trim(),description:t?.description??e.getAttribute("data-preview-description")??"",href:t?.href??e.getAttribute("href")}}function U({title:e,description:t,href:u,url:s,frameable:c}){o.replaceChildren();let i=a.createElement("div");i.className="cubby-preview-head";let C=a.createElement("span");if(C.className="cubby-preview-title",C.textContent=e||s?.hostname||"Preview",i.appendChild(C),s){let d=a.createElement("a");d.className="cubby-preview-open",d.href=u,d.textContent="Open",d.rel="noopener noreferrer",i.appendChild(d)}if(o.appendChild(i),c){let d=a.createElement("div");d.className="cubby-preview-frame-wrap";let m=a.createElement("div");m.className="cubby-preview-overlay",m.textContent="loading preview...";let f=a.createElement("iframe");return f.className="cubby-preview-frame",f.setAttribute("title",e||"Preview"),f.setAttribute("loading","lazy"),f.setAttribute("referrerpolicy","no-referrer"),f.setAttribute("sandbox",l.scripts?"allow-scripts":""),f.addEventListener("load",()=>{r.clearTimeout(E),m.remove()}),d.append(f,m),o.appendChild(d),r.clearTimeout(E),E=r.setTimeout(()=>{m.isConnected&&(m.textContent="still loading; the site may be refusing to embed",m.setAttribute("data-slow",""))},q),f}if(t){let d=a.createElement("div");d.className="cubby-preview-description",d.textContent=t,o.appendChild(d)}let w=a.createElement("div");return w.className="cubby-preview-note",w.textContent=s?`${s.hostname} does not allow embedding.`:"That link cannot be previewed.",o.appendChild(w),null}function P(e){let t=e.getBoundingClientRect(),u=o.offsetWidth||432,s=o.offsetHeight||360,c=t.left;c+u>r.innerWidth-8&&(c=r.innerWidth-u-8),c<8&&(c=8);let i=t.bottom+8;i+s>r.innerHeight-8&&(i=t.top-s-8),i<8&&(i=8),o.style.left=`${Math.round(c)}px`,o.style.top=`${Math.round(i)}px`}function D(e){let{title:t,description:u,href:s}=O(e),c=N(s,S),i=c&&(c.protocol==="http:"||c.protocol==="https:")?c:null,C=z(s,{allow:_,origin:S});v=e,r.clearTimeout(L);let w=U({title:t,description:u,href:s,url:i,frameable:C});o.hidden=!1,P(e),w&&i&&w.setAttribute("src",i.href),o.setAttribute("data-shown","")}function x(){T(),v=null,o.removeAttribute("data-shown"),o.hidden=!0,r.clearTimeout(E),r.clearTimeout(L),L=r.setTimeout(()=>{v||o.replaceChildren()},H)}function k(e){T(),g=r.setTimeout(()=>D(e),b)}function A(e){T(),g=r.setTimeout(()=>{(v===e||v===null)&&x()},F)}let M=e=>e.target instanceof r.Element?e.target.closest(y):null;n.on(p,"mouseover",e=>{let t=M(e);t&&k(t)}),n.on(p,"mouseout",e=>{let t=M(e);t&&A(t)}),n.on(p,"focusin",e=>{let t=M(e);t&&k(t)}),n.on(p,"focusout",e=>{let t=M(e);t&&A(t)}),n.on(o,"mouseenter",T),n.on(o,"mouseleave",()=>A(v)),n.on(a,"keydown",e=>{e.key==="Escape"&&x()}),n.on(a,"scroll",e=>{let t=e.target;t instanceof r.Node&&o.contains(t)||x()},{capture:!0,passive:!0}),n.on(r,"resize",x);function R(e,t={}){let u=()=>k(e),s=()=>A(e),c=t.describe;c&&(e.__cubbyPreviewDescribe=c),e.addEventListener("mouseenter",u),e.addEventListener("mouseleave",s),e.addEventListener("focus",u),e.addEventListener("blur",s);let i=()=>{e.removeEventListener("mouseenter",u),e.removeEventListener("mouseleave",s),e.removeEventListener("focus",u),e.removeEventListener("blur",s)};return n.own(i),i}return{attach:R,show:D,hide:x,popover:o,isFrameable:e=>z(e,{allow:_,origin:S})}})}var ee=G;export{G as createPreview,ee as default,z as isFrameable,N as resolveUrl};
