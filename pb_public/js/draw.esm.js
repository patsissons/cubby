/* cubby draw v0.1.0 (https://github.com/patsissons/cubby) */
import{widget as ke,injectStyle as ne,ensureTokens as ve}from"./core.esm.js";var ee=`
.cubby-draw-marks,
.cubby-draw-cursors {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 0;
  overflow: visible;
  /* Load-bearing: these overlays cover the page and would otherwise eat every
     click, hover and text selection on it. */
  pointer-events: none;
}
/* Marks sit BELOW a sticky bar -- a mark drawn near the top should slide under
   it like the content it was drawn on, and painting over the bar makes the nav
   unreadable for the whole fade. Cursors sit ABOVE it: a peer pointing at a nav
   link is the one case the puck has to win. */
.cubby-draw-marks { z-index: 30; }
.cubby-draw-cursors { z-index: 70; }

.cubby-draw-path {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: opacity var(--cubby-draw-fade, 5000ms) linear;
}
.cubby-draw-path[data-fading] { opacity: 0 !important; }

.cubby-draw-puck {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  transform: translate(-2px, -2px);
  font: 500 0.75rem/1 system-ui, sans-serif;
  white-space: nowrap;
  transition: left 220ms linear, top 220ms linear;
}
.cubby-draw-puck[data-self] { transition: none; }
.cubby-draw-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50% 50% 50% 2px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.35);
}
.cubby-draw-name {
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  color: #fff;
}

.cubby-draw-chip {
  position: fixed;
  right: 0.75rem;
  bottom: 0.75rem;
  z-index: 71;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  background: var(--card, #fff);
  border: 1px solid var(--border, #e7e2da);
  box-shadow: var(--shadow, 0 4px 12px rgb(0 0 0 / 0.08));
  color: var(--muted, #77706a);
  font: 0.8rem/1 system-ui, sans-serif;
}
.cubby-draw-count { font-variant-numeric: tabular-nums; }
/* Below a narrow breakpoint the sentence is CLIPPED, not display:none, so a
   screen reader still hears "2 others here" while the eye gets a bare numeral
   -- and the numeral is aria-hidden precisely because it is the lesser copy.
   Hiding the sentence would downgrade a spoken live region to a digit. */
.cubby-draw-said {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
@media (min-width: 30rem) {
  .cubby-draw-said {
    position: static;
    width: auto;
    height: auto;
    margin: 0;
    overflow: visible;
    clip: auto;
  }
  .cubby-draw-count { display: none; }
}
`,te=`
body.cubby-draw-held,
body.cubby-draw-held * { cursor: none !important; }
`;function ye(n,o,d){let u=d[0]-o[0],s=d[1]-o[1];if(u===0&&s===0)return(n[0]-o[0])**2+(n[1]-o[1])**2;let a=u*(o[1]-n[1])-s*(o[0]-n[0]);return a*a/(u*u+s*s)}function re(n,o=.002){if(!Array.isArray(n)||n.length<3)return n?[...n]:[];let d=o*o,u=new Uint8Array(n.length);u[0]=1,u[n.length-1]=1;let s=[[0,n.length-1]];for(;s.length;){let[h,$]=s.pop(),y=-1,A=d;for(let g=h+1;g<$;g++){let L=ye(n[g],n[h],n[$]);L>A&&(A=L,y=g)}y!==-1&&(u[y]=1,s.push([h,y],[y,$]))}let a=[];for(let h=0;h<n.length;h++)u[h]&&a.push(n[h]);return a}function X(n,{tolerance:o=.002,max:d=500}={}){let u=re(n,o);if(u.length>d){let s=u.length/d,a=[];for(let h=0;h<d-1;h++)a.push(u[Math.floor(h*s)]);a.push(u[u.length-1]),u=a}return u.map(([s,a])=>[Math.round(s*1e3)/1e3,Math.round(a)])}function O(n){if(!n.length)return"";let o=`M${n[0][0]} ${n[0][1]}`;for(let d=1;d<n.length;d++)o+=`L${n[d][0]} ${n[d][1]}`;return o}var Se={alt:"altKey",ctrl:"ctrlKey",meta:"metaKey",shift:"shiftKey"},oe=[8,200,145,275,45,320,175,95],K=n=>{let o=0;for(let d=0;d<String(n).length;d++)o=o*31+String(n).charCodeAt(d)>>>0;return oe[o%oe.length]};function xe(n){return ke("draw",(o,d,u={})=>{let s=d.ownerDocument,a=s.defaultView;ve(),ne("draw",ee),ne("draw-held",te);let h=Se[u.modifier||"alt"]||"altKey",$=u.strokeWidth??3,y=u.opacity??.42,A=u.fadeMs??5e3,g=u.segmentMs??800,L=u.cursorMs??250,ae=u.tolerance??.002,j=u.cursors===!0,se=u.room||`draw${a.location.pathname.replace(/\/+$/,"")||"/"}`,E=s.createElementNS("http://www.w3.org/2000/svg","svg");E.setAttribute("class","cubby-draw-marks"),E.setAttribute("aria-hidden","true");let M=s.createElement("div");M.className="cubby-draw-cursors",M.setAttribute("aria-hidden","true"),s.body.append(E,M),o.own(()=>{E.remove(),M.remove()}),s.documentElement.style.setProperty("--cubby-draw-fade",`${A}ms`),o.own(()=>s.documentElement.style.removeProperty("--cubby-draw-fade"));function W(){let t=d.getBoundingClientRect();return{left:t.left+a.scrollX,top:t.top+a.scrollY,width:t.width||1}}let k=W(),q=(t,l)=>[(t-k.left)/k.width,l-k.top],z=([t,l])=>[k.left+t*k.width,k.top+l],b=null,v=new Map;function ie(t,l){let i=v.get(t);if(i)return i;let f=s.createElementNS("http://www.w3.org/2000/svg","path");return f.setAttribute("class","cubby-draw-path"),f.setAttribute("stroke",`hsl(${l} 85% 45% / ${y})`),f.setAttribute("stroke-width",String($)),E.appendChild(f),i={el:f,points:[],timer:null},v.set(t,i),i}function ue(t){let l=v.get(t);l&&(a.clearTimeout(l.timer),l.timer=null)}function F(t,l=0){let i=v.get(t);i&&(a.clearTimeout(i.timer),i.timer=a.setTimeout(()=>{i.el.setAttribute("data-fading",""),i.timer=a.setTimeout(()=>{i.el.remove(),v.delete(t)},A)},l))}function G(t,l,i,f=!1){let m=ie(t,l),w=f&&m.points.length&&i.length?1:0;for(let S=w;S<i.length;S++)m.points.push(i[S]);return m.el.setAttribute("d",O(m.points.map(z))),m}function le(){k=W();for(let t of v.values())t.el.setAttribute("d",O(t.points.map(z)));for(let[t,l]of D)C(l,l._at,t===b)}o.on(a,"resize",le);let D=new Map;function H(t,l){let i=D.get(t);if(i)return i;i=s.createElement("div"),i.className="cubby-draw-puck";let f=s.createElement("span");f.className="cubby-draw-dot",f.style.background=`hsl(${K(t)} 85% 45%)`;let m=s.createElement("span");return m.className="cubby-draw-name",m.style.background=`hsl(${K(t)} 85% 45%)`,m.textContent=l||"",l||(m.hidden=!0),i.append(f,m),M.appendChild(i),D.set(t,i),i}function C(t,l,i){if(!l)return;t._at=l;let[f,m]=z(l);t.style.left=`${f}px`,t.style.top=`${m}px`,i&&t.setAttribute("data-self","")}function _(t){D.get(t)?.remove(),D.delete(t)}return ce();function ce(){let t=!1,l=!1,i=0,f=0,m=0,w=[],S=0,P=null,R=0,p=null,B=null,N=()=>`${b||"me"}|${i}`;function I(e){if(a.clearTimeout(P),P=null,w.length<2){e&&(w=[]);return}let r=X(w,{tolerance:ae}),c=Math.max(1,Date.now()-S);w=e?[]:[w[w.length-1]],S=Date.now();let x={s:i,k:f,q:m++,p:r,ms:c};p?.emit("draw.mark",x).catch(()=>{}),e||V()}function V(){a.clearTimeout(P),P=a.setTimeout(()=>I(!1),g)}o.own(()=>a.clearTimeout(P));function de(e){if(!j||!p)return;let r=Date.now();r-R<L||(R=r,p.updateUserState({at:e}).catch(()=>{}))}function J(e){t||(t=!0,s.body.classList.add("cubby-draw-held"),i+=1,f=0,C(H(b||"me","You"),q(e.pageX,e.pageY),!0))}function T(){t&&(t=!1,l=!1,s.body.classList.remove("cubby-draw-held"),I(!0),F(N()),_(b||"me"),j&&p?.updateUserState({at:null}).catch(()=>{}))}o.own(T),o.on(a,"keydown",e=>{!e[h]||t||B&&J(B)},{capture:!0}),o.on(a,"keyup",()=>T(),{capture:!0}),o.on(a,"blur",()=>T()),o.on(s,"visibilitychange",()=>s.hidden&&T()),o.on(a,"pointermove",e=>{if(B=e,!e[h])return T();t||J(e);let r=q(e.pageX,e.pageY);if(C(H(b||"me","You"),r,!0),de(r),l&&e.buttons===0)return Q();l&&(w.push(r),G(N(),K(b||"me"),[r]),ue(N()))},{capture:!0});function fe(e){l=!0,f+=1,m=0,w=[q(e.pageX,e.pageY)],S=Date.now(),V()}function Q(){l&&(l=!1,I(!0),F(N()))}for(let e of["pointerdown","click","dragstart","selectstart"])o.on(a,e,r=>{!r[h]&&!t||(r.preventDefault(),r.stopPropagation(),e==="pointerdown"&&fe(r))},{capture:!0});o.on(a,"pointerup",()=>Q(),{capture:!0});function he(e,r){if(!b||!r||r.id===b)return;let c=`${r.id}|${e.s}`,x=G(c,K(r.id),e.p||[],!0);me(x,e),F(c,Math.min(e.ms||0,g*2))}function me(e,r){let c=e.el,x=typeof c.getTotalLength=="function"?c.getTotalLength():0;if(!x)return;let ge=Math.max(1,Math.min(r.ms||0,g*2));c.style.transition="none",c.style.strokeDasharray=String(x),c.style.strokeDashoffset=String(x),a.requestAnimationFrame?.(()=>{c.style.transition=`stroke-dashoffset ${ge}ms linear, opacity var(--cubby-draw-fade) linear`,c.style.strokeDashoffset="0"})}function pe(e,r,c){if(!(!j||!b||!c||c.id===b)){if(!r?.at)return _(c.id);C(H(c.id,c.name||c.username||"Someone"),r.at,!1)}}let U=u.chip===!1?null:be();function be(){let e=s.createElement("div");e.className="cubby-draw-chip",e.setAttribute("role","status");let r=s.createElement("span");r.className="cubby-draw-said";let c=s.createElement("span");return c.className="cubby-draw-count",c.setAttribute("aria-hidden","true"),e.append(c,r),s.body.appendChild(e),o.own(()=>e.remove()),{el:e,said:r,count:c}}function Y(e,r){U&&(U.said.textContent=e,U.count.textContent=r==null?"":String(r))}let Z=a.matchMedia?.("(hover: none)").matches?"Drawing unavailable":`Hold ${u.modifier||"Alt"} to draw`;Y(Z,null);async function we(){if(n?.rooms)try{if(await Promise.race([n.ready,new Promise(r=>a.setTimeout(r,u.identifyMs??3e3))]),b=n.identity?.user?.id||null,!b)return Y(`${Z} - sign in to share`,null);p=n.rooms.room(se),p.on("draw.mark",he),p.on("user.state",pe),p.on("user.leave",r=>_(r.id));let e=()=>{let r=Math.max(0,p.users.length-1);Y(r?`${r} other${r===1?"":"s"} here`:"Just you",r)};p.on("room.sync",e),p.on("user.join",e),await p.join(),e()}catch{p=null,Y("Sharing offline",null)}}return we(),o.own(()=>p?.leave().catch(()=>{})),{get room(){return p?.id||null},get marks(){return v.size},marksLayer:E,cursorsLayer:M}}})}var Te=xe;export{xe as createDraw,Te as default,X as packPoints,re as simplify};
