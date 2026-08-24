/* cubby graph v0.1.0 (https://github.com/patsissons/cubby) */
import{widget as Q,injectStyle as ee,ensureTokens as te}from"./core.esm.js";var Z=`
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
`;var U={nodeWidth:148,nodeHeight:52,columnGap:44,laneGap:56,laneLabel:22,padding:20};function X(d){let o=[],l=new Set((d.lanes||[]).map(i=>i.id)),u=new Map,p=new Set;for(let i of d.nodes||[]){u.has(i.id)&&o.push(`duplicate node id "${i.id}"`),u.set(i.id,i),l.has(i.lane)||o.push(`node "${i.id}" is in unknown lane "${i.lane}"`);let r=`${i.lane}:${i.column}`;p.has(r)&&o.push(`nodes overlap at lane "${i.lane}" column ${i.column}`),p.add(r),i.column>=1||o.push(`node "${i.id}" needs a 1-based column`)}let s=new Set;for(let i of d.edges||[]){s.has(i.id)&&o.push(`duplicate edge id "${i.id}"`),s.add(i.id);for(let r of["from","to"])u.has(i[r])||o.push(`edge "${i.id}" points at unknown node "${i[r]}"`)}for(let i of d.journeys||[])for(let r of i.edges||[])s.has(r)||o.push(`journey "${i.id}" names unknown edge "${r}"`);return o}function _(d,o,l){let{nodeWidth:u,nodeHeight:p,columnGap:s,laneGap:i,laneLabel:r,padding:b}=l,v=b+(d.column-1)*(u+s),y=b+o*(p+i)+r;return{x:v,y,w:u,h:p,cx:v+u/2,cy:y+p/2}}function q(d,o){if(d.laneIndex===o.laneIndex){let i=o.x>=d.x,r=i?d.x+d.w:d.x,b=i?o.x:o.x+o.w,v=Math.max(18,Math.abs(b-r)/2);return{d:`M${r} ${d.cy}C${r+(i?v:-v)} ${d.cy} ${b-(i?v:-v)} ${o.cy} ${b} ${o.cy}`,mx:(r+b)/2,my:(d.cy+o.cy)/2}}let l=o.y>d.y,u=l?d.y+d.h:d.y,p=l?o.y:o.y+o.h,s=Math.max(20,Math.abs(p-u)/2);return{d:`M${d.cx} ${u}C${d.cx} ${u+(l?s:-s)} ${o.cx} ${p-(l?s:-s)} ${o.cx} ${p}`,mx:(d.cx+o.cx)/2,my:(u+p)/2}}function J(d,o={}){let l={...U,...o},u=new Map((d.lanes||[]).map((a,f)=>[a.id,f])),p=(d.nodes||[]).filter(a=>u.has(a.lane)).map(a=>({...a,laneIndex:u.get(a.lane),..._(a,u.get(a.lane),l)})),s=new Map(p.map(a=>[a.id,a])),i=(d.edges||[]).filter(a=>s.has(a.from)&&s.has(a.to)).map(a=>({...a,kind:a.kind||"default",...q(s.get(a.from),s.get(a.to))})),r=new Map(i.map(a=>[a.id,a])),b=(d.journeys||[]).map(a=>{let f=(a.edges||[]).filter(A=>r.has(A)),m=new Set;for(let A of f)m.add(r.get(A).from),m.add(r.get(A).to);return{...a,edges:f,nodes:[...m]}}),v=new Map,y=new Map;for(let a of b){for(let f of a.nodes)v.has(f)||v.set(f,[]),v.get(f).push(a.id);for(let f of a.edges)y.has(f)||y.set(f,[]),y.get(f).push(a.id)}let h=new Map(p.map(a=>[a.id,[]]));for(let a of i)h.get(a.from).push(a.id),h.get(a.to).push(a.id);let C=Math.max(0,...p.map(a=>a.column)),M=l.padding*2+C*l.nodeWidth+Math.max(0,C-1)*l.columnGap,j=l.padding*2+(d.lanes||[]).length*(l.nodeHeight+l.laneGap+l.laneLabel)-l.laneGap;return{metrics:l,nodes:p,edges:i,journeys:b,byId:s,edgeById:r,nodeJourneys:v,edgeJourneys:y,nodeEdges:h,orphans:p.filter(a=>!v.has(a.id)).map(a=>a.id),lanes:(d.lanes||[]).map((a,f)=>({...a,y:l.padding+f*(l.nodeHeight+l.laneGap+l.laneLabel),h:l.nodeHeight+l.laneLabel})),width:M,height:Math.max(j,l.padding*2),problems:X(d)}}function I(d,o){return o.edges.map(u=>{let p=d.edgeById.get(u),s=d.byId.get(p.from)?.label||p.from,i=d.byId.get(p.to)?.label||p.to;return p.label?`${s} \u2192 ${i} (${p.label})`:`${s} \u2192 ${i}`}).join(", then ")}var S="http://www.w3.org/2000/svg",ne={default:{hue:220,dash:"",label:"link"}};function oe(d){return Q("graph",(o,l,u={})=>{let p=u,s=l.ownerDocument,i=s.defaultView;te(),ee("graph",Z);let r=J(u);r.problems.length&&console.error(`[cubby.graph] ${r.problems.join("; ")}`);let b=s.createElement("div");b.className="cubby-graph";let v={...ne,...u.kinds||{}};for(let[e,t]of Object.entries(v))b.style.setProperty(`--cubby-graph-k-${e}`,`hsl(${t.hue??220} 70% 45%)`),b.style.setProperty(`--cubby-graph-d-${e}`,t.dash||"none");for(let e of r.journeys)b.style.setProperty(`--cubby-graph-j-${e.id}`,`hsl(${e.hue??20} 75% 45%)`);let y=s.createElement("div");y.className="cubby-graph-frame";let h=s.createElementNS(S,"svg");h.setAttribute("class","cubby-graph-canvas"),h.setAttribute("role","img"),h.setAttribute("aria-label",p.label||u.label||"Diagram"),h.setAttribute("viewBox",`0 0 ${r.width} ${r.height}`),h.setAttribute("preserveAspectRatio","xMidYMid meet"),y.appendChild(h);for(let e of r.lanes){let t=s.createElementNS(S,"rect");t.setAttribute("class","cubby-graph-lane"),t.setAttribute("x","4"),t.setAttribute("y",String(e.y-4)),t.setAttribute("width",String(r.width-8)),t.setAttribute("height",String(e.h+8)),t.setAttribute("rx","8"),h.appendChild(t);let n=s.createElementNS(S,"text");n.setAttribute("class","cubby-graph-lane-label"),n.setAttribute("x","14"),n.setAttribute("y",String(e.y+10)),n.textContent=e.label||e.id,h.appendChild(n)}let C=new Map;for(let e of r.edges){let t=s.createElementNS(S,"path");t.setAttribute("class","cubby-graph-edge"),t.setAttribute("d",e.d),t.setAttribute("stroke",`var(--cubby-graph-k-${e.kind})`),t.setAttribute("stroke-dasharray",`var(--cubby-graph-d-${e.kind})`),t.setAttribute("role","img"),t.setAttribute("aria-label",G(e));let n=s.createElementNS(S,"path");n.setAttribute("class","cubby-graph-edge-hit"),n.setAttribute("d",e.d),n.setAttribute("tabindex","0"),n.setAttribute("role","button"),n.setAttribute("aria-label",G(e)),h.append(t,n);let c=null;e.label&&(c=s.createElementNS(S,"text"),c.setAttribute("class","cubby-graph-edge-label"),c.setAttribute("x",String(e.mx)),c.setAttribute("y",String(e.my-6)),c.textContent=e.label,h.appendChild(c)),C.set(e.id,{line:t,hit:n,label:c}),o.on(n,"mouseenter",()=>R(e)),o.on(n,"focus",()=>R(e)),o.on(n,"mouseleave",k),o.on(n,"blur",k)}let M=new Map;for(let e of r.nodes){let t=s.createElementNS(S,"g");t.setAttribute("class","cubby-graph-node"),t.setAttribute("tabindex","0"),t.setAttribute("role","button"),t.setAttribute("aria-label",e.label||e.id);let n=s.createElementNS(S,"rect");n.setAttribute("x",String(e.x)),n.setAttribute("y",String(e.y)),n.setAttribute("width",String(e.w)),n.setAttribute("height",String(e.h)),n.setAttribute("rx","8"),e.type&&n.setAttribute("stroke",`var(--cubby-graph-k-${e.type}, var(--border, #c8c2ba))`),t.appendChild(n);for(let[c,g]of K(e.label||e.id).entries()){let x=s.createElementNS(S,"text");x.setAttribute("x",String(e.cx)),x.setAttribute("y",String(e.cy+4+(c-(K(e.label||e.id).length-1)/2)*13)),x.textContent=g,t.appendChild(x)}h.appendChild(t),M.set(e.id,t),o.on(t,"mouseenter",()=>Y(e)),o.on(t,"focus",()=>Y(e)),o.on(t,"mouseleave",k),o.on(t,"blur",k)}let j=s.createElement("div");j.className="cubby-graph-controls";for(let[e,t,n]of[["+",1/1.25,"Zoom in"],["\u2212",1.25,"Zoom out"],["\u25CB",0,"Reset view"]]){let c=s.createElement("button");c.type="button",c.textContent=e,c.setAttribute("aria-label",n),o.on(c,"click",()=>t?W(t):P()),j.appendChild(c)}y.appendChild(j),b.appendChild(y);let a=s.createElement("ul");a.className="cubby-graph-legend";for(let e of r.journeys){let t=s.createElement("li"),n=s.createElement("button");n.type="button",n.className="cubby-graph-chip",n.textContent=e.label||e.id,n.style.color=`var(--cubby-graph-j-${e.id})`,o.on(n,"mouseenter",()=>B(e)),o.on(n,"focus",()=>B(e)),o.on(n,"mouseleave",k),o.on(n,"blur",k),t.appendChild(n),a.appendChild(t)}r.journeys.length&&b.appendChild(a);let f=s.createElement("p");if(f.className="cubby-graph-hint",f.textContent="Drag to pan. Hold \u2318/Ctrl and scroll to zoom.",b.appendChild(f),r.journeys.length){let e=s.createElement("dl");e.className="cubby-graph-prose";for(let t of r.journeys){let n=s.createElement("dt");n.textContent=t.label||t.id;let c=s.createElement("dd");c.textContent=I(r,t),e.append(n,c)}b.appendChild(e)}let m=s.createElement("div");m.className="cubby-graph-popover",m.hidden=!0,s.body.appendChild(m),o.own(()=>m.remove()),l.replaceChildren(b),o.own(()=>b.remove());function A(e,t){b.setAttribute("data-focused","");for(let[n,c]of M)c.toggleAttribute("data-on",e.has(n));for(let[n,c]of C){let g=t.has(n);c.line.toggleAttribute("data-on",g),c.label?.toggleAttribute("data-on",g)}}function k(){b.removeAttribute("data-focused");for(let e of M.values())e.removeAttribute("data-on");for(let e of C.values())e.line.removeAttribute("data-on"),e.label?.removeAttribute("data-on");m.hidden=!0}o.own(k);function B(e){A(new Set(e.nodes),new Set(e.edges)),H(e.label||e.id,I(r,e),null)}function R(e){A(new Set([e.from,e.to]),new Set([e.id])),H(G(e),e.note||"",C.get(e.id).hit)}function Y(e){let t=r.nodeJourneys.get(e.id)||[];if(t.length){let n=new Set,c=new Set;for(let g of t){let x=r.journeys.find($=>$.id===g);x.nodes.forEach($=>n.add($)),x.edges.forEach($=>c.add($))}A(n,c)}else{let n=r.nodeEdges.get(e.id)||[],c=new Set([e.id]);for(let g of n)c.add(r.edgeById.get(g).from),c.add(r.edgeById.get(g).to);A(c,new Set(n))}H(e.label||e.id,e.note||"",M.get(e.id))}function G(e){let t=r.byId.get(e.from)?.label||e.from,n=r.byId.get(e.to)?.label||e.to;return e.label?`${t} \u2192 ${n}: ${e.label}`:`${t} \u2192 ${n}`}function H(e,t,n){m.replaceChildren();let c=s.createElement("strong");if(c.textContent=e,m.appendChild(c),t){let g=s.createElement("div");d?.markdown?.render?g.innerHTML=d.markdown.render(t):g.textContent=t,m.appendChild(g)}m.hidden=!1,O(n)}function O(e){let t=(e||h).getBoundingClientRect(),n=y.getBoundingClientRect(),c=m.offsetWidth||240,g=m.offsetHeight||80,x=Math.max(8,n.left),$=Math.min(i.innerWidth-8,n.right)-c,D=t.left+t.width/2-c/2;D=Math.max(x,Math.min(D,Math.max(x,$)));let N=t.bottom+10;N+g>i.innerHeight-8&&(N=t.top-g-10),N=Math.max(8,Math.min(N,i.innerHeight-g-8)),m.style.left=`${Math.round(D)}px`,m.style.top=`${Math.round(N)}px`}let z=[0,0,r.width,r.height],w=[...z],V=p.minZoom??.4,F=p.maxZoom??4,L=()=>h.setAttribute("viewBox",w.join(" ")),P=()=>{w=[...z],L()};function W(e,t=.5,n=.5){let c=r.width/w[2],g=Math.min(F,Math.max(V,c/e)),x=r.width/g,$=r.height/g;w=[w[0]+(w[2]-x)*t,w[1]+(w[3]-$)*n,x,$],L()}o.on(y,"wheel",e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();let t=y.getBoundingClientRect();W(e.deltaY>0?1.12:1/1.12,(e.clientX-t.left)/t.width,(e.clientY-t.top)/t.height)},{passive:!1});let E=null;o.on(h,"pointerdown",e=>{E={x:e.clientX,y:e.clientY,view:[...w]},h.setAttribute("data-panning",""),h.setPointerCapture?.(e.pointerId)}),o.on(h,"pointermove",e=>{if(!E)return;if(e.buttons===0)return T();let t=y.getBoundingClientRect();w=[E.view[0]-(e.clientX-E.x)/t.width*w[2],E.view[1]-(e.clientY-E.y)/t.height*w[3],w[2],w[3]],L()});let T=()=>{E=null,h.removeAttribute("data-panning")};return o.on(h,"pointerup",T),o.on(h,"pointercancel",T),{model:r,focus(e){let t=r.journeys.find(n=>n.id===e);t&&B(t)},clear:k,reset:P,popover:m}})}function K(d,o=18){let l=String(d).split(/\s+/),u=[""];for(let p of l){let s=u.at(-1)?`${u.at(-1)} ${p}`:p;s.length>o&&u.at(-1)?u.push(p):u[u.length-1]=s}return u.slice(0,2)}var ce=oe;export{oe as createGraph,ce as default,I as describeJourney,J as layout,X as validate};
