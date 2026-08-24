/* cubby draw v0.1.0 (https://github.com/patsissons/cubby) */
import{widget as Se,injectStyle as se,ensureTokens as xe}from"./core.esm.js";var re=`
.cubby-draw-marks,
.cubby-draw-cursors {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  /* Load-bearing: these overlays cover the page and would otherwise eat every
     click, hover and text selection on it. */
  pointer-events: none;
}
/* The cursors layer is a <div>: absolutely positioned children escape a zero
   height happily, so it needs no size of its own. */
.cubby-draw-cursors {
  height: 0;
  overflow: visible;
}
/* The marks layer is an <svg>, which is NOT the same. An outer svg establishes
   its own viewport and clips to it, so at height 0 every stroke was drawn
   correctly and then clipped away entirely -- the bug where the puck appeared
   and the line never did. Its height is set from the document in JS; the
   overflow rule stays only as a backstop. */
.cubby-draw-marks {
  overflow: visible;
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
`,ne=`
body.cubby-draw-held,
body.cubby-draw-held * { cursor: none !important; }
`;function ve(n,o,d){let c=d[0]-o[0],a=d[1]-o[1];if(c===0&&a===0)return(n[0]-o[0])**2+(n[1]-o[1])**2;let s=c*(o[1]-n[1])-a*(o[0]-n[0]);return s*s/(c*c+a*a)}function oe(n,o=.002){if(!Array.isArray(n)||n.length<3)return n?[...n]:[];let d=o*o,c=new Uint8Array(n.length);c[0]=1,c[n.length-1]=1;let a=[[0,n.length-1]];for(;a.length;){let[f,D]=a.pop(),k=-1,P=d;for(let y=f+1;y<D;y++){let Y=ve(n[y],n[f],n[D]);Y>P&&(P=Y,k=y)}k!==-1&&(c[k]=1,a.push([f,k],[k,D]))}let s=[];for(let f=0;f<n.length;f++)c[f]&&s.push(n[f]);return s}function W(n,{tolerance:o=.002,max:d=500}={}){let c=oe(n,o);if(c.length>d){let a=c.length/d,s=[];for(let f=0;f<d-1;f++)s.push(c[Math.floor(f*a)]);s.push(c[c.length-1]),c=s}return c.map(([a,s])=>[Math.round(a*1e3)/1e3,Math.round(s)])}function ae(n){if(!n.length)return"";let o=`M${n[0][0]} ${n[0][1]}`;for(let d=1;d<n.length;d++)o+=`L${n[d][0]} ${n[d][1]}`;return o}var Me={alt:"altKey",ctrl:"ctrlKey",meta:"metaKey",shift:"shiftKey"},ie=[8,200,145,275,45,320,175,95],N=n=>{let o=0;for(let d=0;d<String(n).length;d++)o=o*31+String(n).charCodeAt(d)>>>0;return ie[o%ie.length]};function Ee(n){return Se("draw",(o,d,c={})=>{let a=d.ownerDocument,s=a.defaultView;xe(),se("draw",re),se("draw-held",ne);let f=Me[c.modifier||"alt"]||"altKey",D=c.strokeWidth??3,k=c.opacity??.42,P=c.fadeMs??5e3,y=c.segmentMs??800,Y=c.cursorMs??250,le=c.tolerance??.002,j=c.cursors===!0,ce=c.room||`draw${s.location.pathname.replace(/\/+$/,"")||"/"}`,g=a.createElementNS("http://www.w3.org/2000/svg","svg");g.setAttribute("class","cubby-draw-marks"),g.setAttribute("aria-hidden","true");let E=a.createElement("div");E.className="cubby-draw-cursors",E.setAttribute("aria-hidden","true"),a.body.append(g,E),o.own(()=>{g.remove(),E.remove()});function z(){g.style.height="0px";let e=Math.max(a.documentElement?.scrollHeight||0,a.body?.scrollHeight||0);g.style.height=`${e}px`}z(),a.documentElement.style.setProperty("--cubby-draw-fade",`${P}ms`),o.own(()=>a.documentElement.style.removeProperty("--cubby-draw-fade"));function G(){let e=d.getBoundingClientRect();return{left:e.left+s.scrollX,top:e.top+s.scrollY,width:e.width||1}}let v=G(),q=(e,i)=>[(e-v.left)/v.width,i-v.top],J=([e,i])=>[v.left+e*v.width,v.top+i],w=null,S=new Map;function ue(e,i){let l=S.get(e);if(l)return l;let h=a.createElementNS("http://www.w3.org/2000/svg","path");return h.setAttribute("class","cubby-draw-path"),h.setAttribute("stroke",`hsl(${i} 85% 45% / ${k})`),h.setAttribute("stroke-width",String(D)),g.appendChild(h),l={el:h,strokes:[],timer:null},S.set(e,l),l}function R(e){let i=S.get(e);i&&(s.clearTimeout(i.timer),i.timer=null)}function F(e,i=0){let l=S.get(e);l&&(s.clearTimeout(l.timer),l.timer=s.setTimeout(()=>{l.el.setAttribute("data-fading",""),l.timer=s.setTimeout(()=>{l.el.remove(),S.delete(e)},P)},i))}function V(e){e.el.setAttribute("d",e.strokes.map(i=>ae(i.map(J))).join(""))}function I(e,i,l,{stitch:h=!1,newStroke:b=!1}={}){(!g.style.height||g.style.height==="0px")&&z();let m=ue(e,i);(b||!m.strokes.length)&&m.strokes.push([]);let $=m.strokes[m.strokes.length-1],x=h&&$.length&&l.length?1:0;for(let A=x;A<l.length;A++)$.push(l[A]);return V(m),m}function de(){z(),v=G();for(let e of S.values())V(e);for(let[e,i]of L)H(i,i._at,e===w)}o.on(s,"resize",de);let L=new Map;function _(e,i){let l=L.get(e);if(l)return l;l=a.createElement("div"),l.className="cubby-draw-puck";let h=a.createElement("span");h.className="cubby-draw-dot",h.style.background=`hsl(${N(e)} 85% 45%)`;let b=a.createElement("span");return b.className="cubby-draw-name",b.style.background=`hsl(${N(e)} 85% 45%)`,b.textContent=i||"",i||(b.hidden=!0),l.append(h,b),E.appendChild(l),L.set(e,l),l}function H(e,i,l){if(!i)return;e._at=i;let[h,b]=J(i);e.style.left=`${h}px`,e.style.top=`${b}px`,l&&e.setAttribute("data-self","")}function B(e){L.get(e)?.remove(),L.delete(e)}return he();function he(){let e=!1,i=!1,l=0,h=0,b=0,m=[],$=0,x=null,A=0,p=null,O=null,T=()=>`${w||"me"}|${l}`;function U(t){if(s.clearTimeout(x),x=null,m.length<2){t&&(m=[]);return}let r=W(m,{tolerance:le}),u=Math.max(1,Date.now()-$);m=t?[]:[m[m.length-1]],$=Date.now();let M={s:l,k:h,q:b++,p:r,ms:u};p?.emit("draw.mark",M).catch(()=>{}),t||Q()}function Q(){s.clearTimeout(x),x=s.setTimeout(()=>U(!1),y)}o.own(()=>s.clearTimeout(x));function fe(t){if(!j||!p)return;let r=Date.now();r-A<Y||(A=r,p.updateUserState({at:t}).catch(()=>{}))}function Z(t){e||(e=!0,a.body.classList.add("cubby-draw-held"),l+=1,h=0,H(_(w||"me","You"),q(t.pageX,t.pageY),!0))}function C(){e&&(e=!1,i=!1,a.body.classList.remove("cubby-draw-held"),U(!0),F(T()),B(w||"me"),j&&p?.updateUserState({at:null}).catch(()=>{}))}o.own(C),o.on(s,"keydown",t=>{!t[f]||e||O&&Z(O)},{capture:!0}),o.on(s,"keyup",()=>C(),{capture:!0}),o.on(s,"blur",()=>C()),o.on(a,"visibilitychange",()=>a.hidden&&C()),o.on(s,"pointermove",t=>{if(O=t,!t[f])return C();e||Z(t);let r=q(t.pageX,t.pageY);if(H(_(w||"me","You"),r,!0),fe(r),i&&t.buttons===0)return ee();i&&(m.push(r),I(T(),N(w||"me"),[r]),R(T()))},{capture:!0});function me(t){z(),i=!0,h+=1,b=0;let r=q(t.pageX,t.pageY);m=[r],I(T(),N(w||"me"),[r],{newStroke:!0}),R(T()),$=Date.now(),Q()}function ee(){i&&(i=!1,U(!0),F(T()))}for(let t of["pointerdown","click","dragstart","selectstart"])o.on(s,t,r=>{!r[f]&&!e||(r.preventDefault(),r.stopPropagation(),t==="pointerdown"&&me(r))},{capture:!0});o.on(s,"pointerup",()=>ee(),{capture:!0});function pe(t,r){if(!w||!r||r.id===w)return;let u=`${r.id}|${t.s}`,M=I(u,N(r.id),t.p||[],{stitch:!0,newStroke:t.q===0});we(M,t),F(u,Math.min(t.ms||0,y*2))}function we(t,r){let u=t.el,M=typeof u.getTotalLength=="function"?u.getTotalLength():0;if(!M)return;let ke=Math.max(1,Math.min(r.ms||0,y*2));u.style.transition="none",u.style.strokeDasharray=String(M),u.style.strokeDashoffset=String(M),s.requestAnimationFrame?.(()=>{u.style.transition=`stroke-dashoffset ${ke}ms linear, opacity var(--cubby-draw-fade) linear`,u.style.strokeDashoffset="0"})}function be(t,r,u){if(!(!j||!w||!u||u.id===w)){if(!r?.at)return B(u.id);H(_(u.id,u.name||u.username||"Someone"),r.at,!1)}}let X=c.chip===!1?null:ge();function ge(){let t=a.createElement("div");t.className="cubby-draw-chip",t.setAttribute("role","status");let r=a.createElement("span");r.className="cubby-draw-said";let u=a.createElement("span");return u.className="cubby-draw-count",u.setAttribute("aria-hidden","true"),t.append(u,r),a.body.appendChild(t),o.own(()=>t.remove()),{el:t,said:r,count:u}}function K(t,r){X&&(X.said.textContent=t,X.count.textContent=r==null?"":String(r))}let te=s.matchMedia?.("(hover: none)").matches?"Drawing unavailable":`Hold ${c.modifier||"Alt"} to draw`;K(te,null);async function ye(){if(n?.rooms)try{if(await Promise.race([n.ready,new Promise(r=>s.setTimeout(r,c.identifyMs??3e3))]),w=n.identity?.user?.id||null,!w)return K(`${te} - sign in to share`,null);p=n.rooms.room(ce),p.on("draw.mark",pe),p.on("user.state",be),p.on("user.leave",r=>B(r.id));let t=()=>{let r=Math.max(0,p.users.length-1);K(r?`${r} other${r===1?"":"s"} here`:"Just you",r)};p.on("room.sync",t),p.on("user.join",t),await p.join(),t()}catch{p=null,K("Sharing offline",null)}}return ye(),o.own(()=>p?.leave().catch(()=>{})),{get room(){return p?.id||null},get marks(){return S.size},marksLayer:g,cursorsLayer:E}}})}var Ce=Ee;export{Ee as createDraw,Ce as default,W as packPoints,oe as simplify};
