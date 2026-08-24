/* cubby draw v0.1.0 (https://github.com/patsissons/cubby) */
(()=>{var g=typeof window<"u"&&window.cubby||null,Ce=g?.CubbyError,De=g?.toCubbyError,Pe=g?.escapeHtml,je=g?.sanitizeUrl,G=g?.injectStyle,oe=g?.ensureTokens,se=g?.widget;function ae(n,...o){let u=[];g?.CubbyError||u.push("core.js");for(let s of o)g?.[s]||u.push(`${s}.js`);return u.length?(console.error(`[cubby] ${n} needs ${u.join(" + ")} loaded first. Tag order is core.js, platform.js, markdown.js, editor.js, then your app.js \u2014 all defer.`),null):g}var ie=`
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
`,ce=`
body.cubby-draw-held,
body.cubby-draw-held * { cursor: none !important; }
`;function Me(n,o,u){let s=u[0]-o[0],a=u[1]-o[1];if(s===0&&a===0)return(n[0]-o[0])**2+(n[1]-o[1])**2;let i=s*(o[1]-n[1])-a*(o[0]-n[0]);return i*i/(s*s+a*a)}function le(n,o=.002){if(!Array.isArray(n)||n.length<3)return n?[...n]:[];let u=o*o,s=new Uint8Array(n.length);s[0]=1,s[n.length-1]=1;let a=[[0,n.length-1]];for(;a.length;){let[f,D]=a.pop(),v=-1,P=u;for(let k=f+1;k<D;k++){let z=Me(n[k],n[f],n[D]);z>P&&(P=z,v=k)}v!==-1&&(s[v]=1,a.push([f,v],[v,D]))}let i=[];for(let f=0;f<n.length;f++)s[f]&&i.push(n[f]);return i}function J(n,{tolerance:o=.002,max:u=500}={}){let s=le(n,o);if(s.length>u){let a=s.length/u,i=[];for(let f=0;f<u-1;f++)i.push(s[Math.floor(f*a)]);i.push(s[s.length-1]),s=i}return s.map(([a,i])=>[Math.round(a*1e3)/1e3,Math.round(i)])}function ue(n){if(!n.length)return"";let o=`M${n[0][0]} ${n[0][1]}`;for(let u=1;u<n.length;u++)o+=`L${n[u][0]} ${n[u][1]}`;return o}var Te={alt:"altKey",ctrl:"ctrlKey",meta:"metaKey",shift:"shiftKey"},de=[8,200,145,275,45,320,175,95],N=n=>{let o=0;for(let u=0;u<String(n).length;u++)o=o*31+String(n).charCodeAt(u)>>>0;return de[o%de.length]};function he(n){return se("draw",(o,u,s={})=>{let a=u.ownerDocument,i=a.defaultView;oe(),G("draw",ie),G("draw-held",ce);let f=Te[s.modifier||"alt"]||"altKey",D=s.strokeWidth??3,v=s.opacity??.42,P=s.fadeMs??5e3,k=s.segmentMs??800,z=s.cursorMs??250,fe=s.tolerance??.002,K=s.cursors===!0,pe=s.room||`draw${i.location.pathname.replace(/\/+$/,"")||"/"}`,y=a.createElementNS("http://www.w3.org/2000/svg","svg");y.setAttribute("class","cubby-draw-marks"),y.setAttribute("aria-hidden","true");let M=a.createElement("div");M.className="cubby-draw-cursors",M.setAttribute("aria-hidden","true"),a.body.append(y,M),o.own(()=>{y.remove(),M.remove()});function Y(){y.style.height="0px";let e=Math.max(a.documentElement?.scrollHeight||0,a.body?.scrollHeight||0);y.style.height=`${e}px`}Y(),a.documentElement.style.setProperty("--cubby-draw-fade",`${P}ms`),o.own(()=>a.documentElement.style.removeProperty("--cubby-draw-fade"));function R(){let e=u.getBoundingClientRect();return{left:e.left+i.scrollX,top:e.top+i.scrollY,width:e.width||1}}let x=R(),U=(e,c)=>[(e-x.left)/x.width,c-x.top],V=([e,c])=>[x.left+e*x.width,x.top+c],b=null,S=new Map;function me(e,c){let l=S.get(e);if(l)return l;let h=a.createElementNS("http://www.w3.org/2000/svg","path");return h.setAttribute("class","cubby-draw-path"),h.setAttribute("stroke",`hsl(${c} 85% 45% / ${v})`),h.setAttribute("stroke-width",String(D)),y.appendChild(h),l={el:h,strokes:[],timer:null},S.set(e,l),l}function Q(e){let c=S.get(e);c&&(i.clearTimeout(c.timer),c.timer=null)}function F(e,c=0){let l=S.get(e);l&&(i.clearTimeout(l.timer),l.timer=i.setTimeout(()=>{l.el.setAttribute("data-fading",""),l.timer=i.setTimeout(()=>{l.el.remove(),S.delete(e)},P)},c))}function Z(e){e.el.setAttribute("d",e.strokes.map(c=>ue(c.map(V))).join(""))}function I(e,c,l,{stitch:h=!1,newStroke:w=!1}={}){(!y.style.height||y.style.height==="0px")&&Y();let p=me(e,c);(w||!p.strokes.length)&&p.strokes.push([]);let T=p.strokes[p.strokes.length-1],E=h&&T.length&&l.length?1:0;for(let A=E;A<l.length;A++)T.push(l[A]);return Z(p),p}function be(){Y(),x=R();for(let e of S.values())Z(e);for(let[e,c]of j)H(c,c._at,e===b)}o.on(i,"resize",be);let j=new Map;function O(e,c){let l=j.get(e);if(l)return l;l=a.createElement("div"),l.className="cubby-draw-puck";let h=a.createElement("span");h.className="cubby-draw-dot",h.style.background=`hsl(${N(e)} 85% 45%)`;let w=a.createElement("span");return w.className="cubby-draw-name",w.style.background=`hsl(${N(e)} 85% 45%)`,w.textContent=c||"",c||(w.hidden=!0),l.append(h,w),M.appendChild(l),j.set(e,l),l}function H(e,c,l){if(!c)return;e._at=c;let[h,w]=V(c);e.style.left=`${h}px`,e.style.top=`${w}px`,l&&e.setAttribute("data-self","")}function _(e){j.get(e)?.remove(),j.delete(e)}return we();function we(){let e=!1,c=!1,l=0,h=0,w=0,p=[],T=0,E=null,A=0,m=null,B=null,C=()=>`${b||"me"}|${l}`;function X(t){if(i.clearTimeout(E),E=null,p.length<2){t&&(p=[]);return}let r=J(p,{tolerance:fe}),d=Math.max(1,Date.now()-T);p=t?[]:[p[p.length-1]],T=Date.now();let $={s:l,k:h,q:w++,p:r,ms:d};m?.emit("draw.mark",$).catch(()=>{}),t||ee()}function ee(){i.clearTimeout(E),E=i.setTimeout(()=>X(!1),k)}o.own(()=>i.clearTimeout(E));function ye(t){if(!K||!m)return;let r=Date.now();r-A<z||(A=r,m.updateUserState({at:t}).catch(()=>{}))}function te(t){e||(e=!0,a.body.classList.add("cubby-draw-held"),l+=1,h=0,H(O(b||"me","You"),U(t.pageX,t.pageY),!0))}function L(){e&&(e=!1,c=!1,a.body.classList.remove("cubby-draw-held"),X(!0),F(C()),_(b||"me"),K&&m?.updateUserState({at:null}).catch(()=>{}))}o.own(L),o.on(i,"keydown",t=>{!t[f]||e||B&&te(B)},{capture:!0}),o.on(i,"keyup",()=>L(),{capture:!0}),o.on(i,"blur",()=>L()),o.on(a,"visibilitychange",()=>a.hidden&&L()),o.on(i,"pointermove",t=>{if(B=t,!t[f])return L();e||te(t);let r=U(t.pageX,t.pageY);if(H(O(b||"me","You"),r,!0),ye(r),c&&t.buttons===0)return re();c&&(p.push(r),I(C(),N(b||"me"),[r]),Q(C()))},{capture:!0});function ge(t){Y(),c=!0,h+=1,w=0;let r=U(t.pageX,t.pageY);p=[r],I(C(),N(b||"me"),[r],{newStroke:!0}),Q(C()),T=Date.now(),ee()}function re(){c&&(c=!1,X(!0),F(C()))}for(let t of["pointerdown","click","dragstart","selectstart"])o.on(i,t,r=>{!r[f]&&!e||(r.preventDefault(),r.stopPropagation(),t==="pointerdown"&&ge(r))},{capture:!0});o.on(i,"pointerup",()=>re(),{capture:!0});function ke(t,r){if(!b||!r||r.id===b)return;let d=`${r.id}|${t.s}`,$=I(d,N(r.id),t.p||[],{stitch:!0,newStroke:t.q===0});ve($,t),F(d,Math.min(t.ms||0,k*2))}function ve(t,r){let d=t.el,$=typeof d.getTotalLength=="function"?d.getTotalLength():0;if(!$)return;let $e=Math.max(1,Math.min(r.ms||0,k*2));d.style.transition="none",d.style.strokeDasharray=String($),d.style.strokeDashoffset=String($),i.requestAnimationFrame?.(()=>{d.style.transition=`stroke-dashoffset ${$e}ms linear, opacity var(--cubby-draw-fade) linear`,d.style.strokeDashoffset="0"})}function xe(t,r,d){if(!(!K||!b||!d||d.id===b)){if(!r?.at)return _(d.id);H(O(d.id,d.name||d.username||"Someone"),r.at,!1)}}let W=s.chip===!1?null:Se();function Se(){let t=a.createElement("div");t.className="cubby-draw-chip",t.setAttribute("role","status");let r=a.createElement("span");r.className="cubby-draw-said";let d=a.createElement("span");return d.className="cubby-draw-count",d.setAttribute("aria-hidden","true"),t.append(d,r),a.body.appendChild(t),o.own(()=>t.remove()),{el:t,said:r,count:d}}function q(t,r){W&&(W.said.textContent=t,W.count.textContent=r==null?"":String(r))}let ne=i.matchMedia?.("(hover: none)").matches?"Drawing unavailable":`Hold ${s.modifier||"Alt"} to draw`;q(ne,null);async function Ee(){if(n?.rooms)try{if(await Promise.race([n.ready,new Promise(r=>i.setTimeout(r,s.identifyMs??3e3))]),b=n.identity?.user?.id||null,!b)return q(`${ne} - sign in to share`,null);m=n.rooms.room(pe),m.on("draw.mark",ke),m.on("user.state",xe),m.on("user.leave",r=>_(r.id));let t=()=>{let r=Math.max(0,m.users.length-1);q(r?`${r} other${r===1?"":"s"} here`:"Just you",r)};m.on("room.sync",t),m.on("user.join",t),await m.join(),t()}catch{m=null,q("Sharing offline",null)}}return Ee(),o.own(()=>m?.leave().catch(()=>{})),{get room(){return m?.id||null},get marks(){return S.size},marksLayer:y,cursorsLayer:M}}})}if(typeof window<"u"){let n=ae("draw.js");n&&(n.draw=he(n))}})();
