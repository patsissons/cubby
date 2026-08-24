/* cubby graph v0.1.0 (https://github.com/patsissons/cubby) */
(()=>{var A=typeof window<"u"&&window.cubby||null,se=A?.CubbyError,ie=A?.toCubbyError,de=A?.escapeHtml,ce=A?.sanitizeUrl,O=A?.injectStyle,X=A?.ensureTokens,U=A?.widget;function K(i,...n){let l=[];A?.CubbyError||l.push("core.js");for(let p of n)A?.[p]||l.push(`${p}.js`);return l.length?(console.error(`[cubby] ${i} needs ${l.join(" + ")} loaded first. Tag order is core.js, platform.js, markdown.js, editor.js, then your app.js \u2014 all defer.`),null):A}var V=`
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
`;var oe={nodeWidth:148,nodeHeight:52,columnGap:44,laneGap:56,laneLabel:22,padding:20};function q(i){let n=[],l=new Set((i.lanes||[]).map(d=>d.id)),p=new Map,u=new Set;for(let d of i.nodes||[]){p.has(d.id)&&n.push(`duplicate node id "${d.id}"`),p.set(d.id,d),l.has(d.lane)||n.push(`node "${d.id}" is in unknown lane "${d.lane}"`);let r=`${d.lane}:${d.column}`;u.has(r)&&n.push(`nodes overlap at lane "${d.lane}" column ${d.column}`),u.add(r),d.column>=1||n.push(`node "${d.id}" needs a 1-based column`)}let s=new Set;for(let d of i.edges||[]){s.has(d.id)&&n.push(`duplicate edge id "${d.id}"`),s.add(d.id);for(let r of["from","to"])p.has(d[r])||n.push(`edge "${d.id}" points at unknown node "${d[r]}"`)}for(let d of i.journeys||[])for(let r of d.edges||[])s.has(r)||n.push(`journey "${d.id}" names unknown edge "${r}"`);return n}function ne(i,n,l){let{nodeWidth:p,nodeHeight:u,columnGap:s,laneGap:d,laneLabel:r,padding:h}=l,w=h+(i.column-1)*(p+s),y=h+n*(u+d)+r;return{x:w,y,w:p,h:u,cx:w+p/2,cy:y+u/2}}function re(i,n){if(i.laneIndex===n.laneIndex){let d=n.x>=i.x,r=d?i.x+i.w:i.x,h=d?n.x:n.x+n.w,w=Math.max(18,Math.abs(h-r)/2);return{d:`M${r} ${i.cy}C${r+(d?w:-w)} ${i.cy} ${h-(d?w:-w)} ${n.cy} ${h} ${n.cy}`,mx:(r+h)/2,my:(i.cy+n.cy)/2}}let l=n.y>i.y,p=l?i.y+i.h:i.y,u=l?n.y:n.y+n.h,s=Math.max(20,Math.abs(u-p)/2);return{d:`M${i.cx} ${p}C${i.cx} ${p+(l?s:-s)} ${n.cx} ${u-(l?s:-s)} ${n.cx} ${u}`,mx:(i.cx+n.cx)/2,my:(p+u)/2}}function J(i,n={}){let l={...oe,...n},p=new Map((i.lanes||[]).map((a,f)=>[a.id,f])),u=(i.nodes||[]).filter(a=>p.has(a.lane)).map(a=>({...a,laneIndex:p.get(a.lane),...ne(a,p.get(a.lane),l)})),s=new Map(u.map(a=>[a.id,a])),d=(i.edges||[]).filter(a=>s.has(a.from)&&s.has(a.to)).map(a=>({...a,kind:a.kind||"default",...re(s.get(a.from),s.get(a.to))})),r=new Map(d.map(a=>[a.id,a])),h=(i.journeys||[]).map(a=>{let f=(a.edges||[]).filter(C=>r.has(C)),m=new Set;for(let C of f)m.add(r.get(C).from),m.add(r.get(C).to);return{...a,edges:f,nodes:[...m]}}),w=new Map,y=new Map;for(let a of h){for(let f of a.nodes)w.has(f)||w.set(f,[]),w.get(f).push(a.id);for(let f of a.edges)y.has(f)||y.set(f,[]),y.get(f).push(a.id)}let b=new Map(u.map(a=>[a.id,[]]));for(let a of d)b.get(a.from).push(a.id),b.get(a.to).push(a.id);let E=Math.max(0,...u.map(a=>a.column)),j=l.padding*2+E*l.nodeWidth+Math.max(0,E-1)*l.columnGap,N=l.padding*2+(i.lanes||[]).length*(l.nodeHeight+l.laneGap+l.laneLabel)-l.laneGap;return{metrics:l,nodes:u,edges:d,journeys:h,byId:s,edgeById:r,nodeJourneys:w,edgeJourneys:y,nodeEdges:b,orphans:u.filter(a=>!w.has(a.id)).map(a=>a.id),lanes:(i.lanes||[]).map((a,f)=>({...a,y:l.padding+f*(l.nodeHeight+l.laneGap+l.laneLabel),h:l.nodeHeight+l.laneLabel})),width:j,height:Math.max(N,l.padding*2),problems:q(i)}}function H(i,n){return n.edges.map(p=>{let u=i.edgeById.get(p),s=i.byId.get(u.from)?.label||u.from,d=i.byId.get(u.to)?.label||u.to;return u.label?`${s} \u2192 ${d} (${u.label})`:`${s} \u2192 ${d}`}).join(", then ")}var k="http://www.w3.org/2000/svg",ae={default:{hue:220,dash:"",label:"link"}};function _(i){return U("graph",(n,l,p={})=>{let u=p,s=l.ownerDocument,d=s.defaultView;X(),O("graph",V);let r=J(p);r.problems.length&&console.error(`[cubby.graph] ${r.problems.join("; ")}`);let h=s.createElement("div");h.className="cubby-graph";let w={...ae,...p.kinds||{}};for(let[e,t]of Object.entries(w))h.style.setProperty(`--cubby-graph-k-${e}`,`hsl(${t.hue??220} 70% 45%)`),h.style.setProperty(`--cubby-graph-d-${e}`,t.dash||"none");for(let e of r.journeys)h.style.setProperty(`--cubby-graph-j-${e.id}`,`hsl(${e.hue??20} 75% 45%)`);let y=s.createElement("div");y.className="cubby-graph-frame";let b=s.createElementNS(k,"svg");b.setAttribute("class","cubby-graph-canvas"),b.setAttribute("role","img"),b.setAttribute("aria-label",u.label||p.label||"Diagram"),b.setAttribute("viewBox",`0 0 ${r.width} ${r.height}`),b.setAttribute("preserveAspectRatio","xMidYMid meet"),y.appendChild(b);for(let e of r.lanes){let t=s.createElementNS(k,"rect");t.setAttribute("class","cubby-graph-lane"),t.setAttribute("x","4"),t.setAttribute("y",String(e.y-4)),t.setAttribute("width",String(r.width-8)),t.setAttribute("height",String(e.h+8)),t.setAttribute("rx","8"),b.appendChild(t);let o=s.createElementNS(k,"text");o.setAttribute("class","cubby-graph-lane-label"),o.setAttribute("x","14"),o.setAttribute("y",String(e.y+10)),o.textContent=e.label||e.id,b.appendChild(o)}let E=new Map;for(let e of r.edges){let t=s.createElementNS(k,"path");t.setAttribute("class","cubby-graph-edge"),t.setAttribute("d",e.d),t.setAttribute("stroke",`var(--cubby-graph-k-${e.kind})`),t.setAttribute("stroke-dasharray",`var(--cubby-graph-d-${e.kind})`),t.setAttribute("role","img"),t.setAttribute("aria-label",B(e));let o=s.createElementNS(k,"path");o.setAttribute("class","cubby-graph-edge-hit"),o.setAttribute("d",e.d),o.setAttribute("tabindex","0"),o.setAttribute("role","button"),o.setAttribute("aria-label",B(e)),b.append(t,o);let c=null;e.label&&(c=s.createElementNS(k,"text"),c.setAttribute("class","cubby-graph-edge-label"),c.setAttribute("x",String(e.mx)),c.setAttribute("y",String(e.my-6)),c.textContent=e.label,b.appendChild(c)),E.set(e.id,{line:t,hit:o,label:c}),n.on(o,"mouseenter",()=>P(e)),n.on(o,"focus",()=>P(e)),n.on(o,"mouseleave",S),n.on(o,"blur",S)}let j=new Map;for(let e of r.nodes){let t=s.createElementNS(k,"g");t.setAttribute("class","cubby-graph-node"),t.setAttribute("tabindex","0"),t.setAttribute("role","button"),t.setAttribute("aria-label",e.label||e.id);let o=s.createElementNS(k,"rect");o.setAttribute("x",String(e.x)),o.setAttribute("y",String(e.y)),o.setAttribute("width",String(e.w)),o.setAttribute("height",String(e.h)),o.setAttribute("rx","8"),e.type&&o.setAttribute("stroke",`var(--cubby-graph-k-${e.type}, var(--border, #c8c2ba))`),t.appendChild(o);for(let[c,g]of F(e.label||e.id).entries()){let v=s.createElementNS(k,"text");v.setAttribute("x",String(e.cx)),v.setAttribute("y",String(e.cy+4+(c-(F(e.label||e.id).length-1)/2)*13)),v.textContent=g,t.appendChild(v)}b.appendChild(t),j.set(e.id,t),n.on(t,"mouseenter",()=>R(e)),n.on(t,"focus",()=>R(e)),n.on(t,"mouseleave",S),n.on(t,"blur",S)}let N=s.createElement("div");N.className="cubby-graph-controls";for(let[e,t,o]of[["+",1/1.25,"Zoom in"],["\u2212",1.25,"Zoom out"],["\u25CB",0,"Reset view"]]){let c=s.createElement("button");c.type="button",c.textContent=e,c.setAttribute("aria-label",o),n.on(c,"click",()=>t?Z(t):W()),N.appendChild(c)}y.appendChild(N),h.appendChild(y);let a=s.createElement("ul");a.className="cubby-graph-legend";for(let e of r.journeys){let t=s.createElement("li"),o=s.createElement("button");o.type="button",o.className="cubby-graph-chip",o.textContent=e.label||e.id,o.style.color=`var(--cubby-graph-j-${e.id})`,n.on(o,"mouseenter",()=>T(e)),n.on(o,"focus",()=>T(e)),n.on(o,"mouseleave",S),n.on(o,"blur",S),t.appendChild(o),a.appendChild(t)}r.journeys.length&&h.appendChild(a);let f=s.createElement("p");if(f.className="cubby-graph-hint",f.textContent="Drag to pan. Hold \u2318/Ctrl and scroll to zoom.",h.appendChild(f),r.journeys.length){let e=s.createElement("dl");e.className="cubby-graph-prose";for(let t of r.journeys){let o=s.createElement("dt");o.textContent=t.label||t.id;let c=s.createElement("dd");c.textContent=H(r,t),e.append(o,c)}h.appendChild(e)}let m=s.createElement("div");m.className="cubby-graph-popover",m.hidden=!0,s.body.appendChild(m),n.own(()=>m.remove()),l.replaceChildren(h),n.own(()=>h.remove());function C(e,t){h.setAttribute("data-focused","");for(let[o,c]of j)c.toggleAttribute("data-on",e.has(o));for(let[o,c]of E){let g=t.has(o);c.line.toggleAttribute("data-on",g),c.label?.toggleAttribute("data-on",g)}}function S(){h.removeAttribute("data-focused");for(let e of j.values())e.removeAttribute("data-on");for(let e of E.values())e.line.removeAttribute("data-on"),e.label?.removeAttribute("data-on");m.hidden=!0}n.own(S);function T(e){C(new Set(e.nodes),new Set(e.edges)),G(e.label||e.id,H(r,e),null)}function P(e){C(new Set([e.from,e.to]),new Set([e.id])),G(B(e),e.note||"",E.get(e.id).hit)}function R(e){let t=r.nodeJourneys.get(e.id)||[];if(t.length){let o=new Set,c=new Set;for(let g of t){let v=r.journeys.find($=>$.id===g);v.nodes.forEach($=>o.add($)),v.edges.forEach($=>c.add($))}C(o,c)}else{let o=r.nodeEdges.get(e.id)||[],c=new Set([e.id]);for(let g of o)c.add(r.edgeById.get(g).from),c.add(r.edgeById.get(g).to);C(c,new Set(o))}G(e.label||e.id,e.note||"",j.get(e.id))}function B(e){let t=r.byId.get(e.from)?.label||e.from,o=r.byId.get(e.to)?.label||e.to;return e.label?`${t} \u2192 ${o}: ${e.label}`:`${t} \u2192 ${o}`}function G(e,t,o){m.replaceChildren();let c=s.createElement("strong");if(c.textContent=e,m.appendChild(c),t){let g=s.createElement("div");i?.markdown?.render?g.innerHTML=i.markdown.render(t):g.textContent=t,m.appendChild(g)}m.hidden=!1,Q(o)}function Q(e){let t=(e||b).getBoundingClientRect(),o=y.getBoundingClientRect(),c=m.offsetWidth||240,g=m.offsetHeight||80,v=Math.max(8,o.left),$=Math.min(d.innerWidth-8,o.right)-c,D=t.left+t.width/2-c/2;D=Math.max(v,Math.min(D,Math.max(v,$)));let I=t.bottom+10;I+g>d.innerHeight-8&&(I=t.top-g-10),I=Math.max(8,Math.min(I,d.innerHeight-g-8)),m.style.left=`${Math.round(D)}px`,m.style.top=`${Math.round(I)}px`}let Y=[0,0,r.width,r.height],x=[...Y],ee=u.minZoom??.4,te=u.maxZoom??4,L=()=>b.setAttribute("viewBox",x.join(" ")),W=()=>{x=[...Y],L()};function Z(e,t=.5,o=.5){let c=r.width/x[2],g=Math.min(te,Math.max(ee,c/e)),v=r.width/g,$=r.height/g;x=[x[0]+(x[2]-v)*t,x[1]+(x[3]-$)*o,v,$],L()}n.on(y,"wheel",e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();let t=y.getBoundingClientRect();Z(e.deltaY>0?1.12:1/1.12,(e.clientX-t.left)/t.width,(e.clientY-t.top)/t.height)},{passive:!1});let M=null;n.on(b,"pointerdown",e=>{M={x:e.clientX,y:e.clientY,view:[...x]},b.setAttribute("data-panning",""),b.setPointerCapture?.(e.pointerId)}),n.on(b,"pointermove",e=>{if(!M)return;if(e.buttons===0)return z();let t=y.getBoundingClientRect();x=[M.view[0]-(e.clientX-M.x)/t.width*x[2],M.view[1]-(e.clientY-M.y)/t.height*x[3],x[2],x[3]],L()});let z=()=>{M=null,b.removeAttribute("data-panning")};return n.on(b,"pointerup",z),n.on(b,"pointercancel",z),{model:r,focus(e){let t=r.journeys.find(o=>o.id===e);t&&T(t)},clear:S,reset:W,popover:m}})}function F(i,n=18){let l=String(i).split(/\s+/),p=[""];for(let u of l){let s=p.at(-1)?`${p.at(-1)} ${u}`:u;s.length>n&&p.at(-1)?p.push(u):p[p.length-1]=s}return p.slice(0,2)}if(typeof window<"u"){let i=K("graph.js");i&&(i.graph=_(i))}})();
