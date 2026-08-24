/* cubby draw v0.1.0 (https://github.com/patsissons/cubby) */
(()=>{var y=typeof window<"u"&&window.cubby||null,Ce=y?.CubbyError,Me=y?.toCubbyError,Te=y?.escapeHtml,De=y?.sanitizeUrl,X=y?.injectStyle,re=y?.ensureTokens,ne=y?.widget;function oe(r,...o){let l=[];y?.CubbyError||l.push("core.js");for(let a of o)y?.[a]||l.push(`${a}.js`);return l.length?(console.error(`[cubby] ${r} needs ${l.join(" + ")} loaded first. Tag order is core.js, platform.js, markdown.js, editor.js, then your app.js \u2014 all defer.`),null):y}var ae=`
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
`,se=`
body.cubby-draw-held,
body.cubby-draw-held * { cursor: none !important; }
`;function Ee(r,o,l){let a=l[0]-o[0],i=l[1]-o[1];if(a===0&&i===0)return(r[0]-o[0])**2+(r[1]-o[1])**2;let s=a*(o[1]-r[1])-i*(o[0]-r[0]);return s*s/(a*a+i*i)}function ie(r,o=.002){if(!Array.isArray(r)||r.length<3)return r?[...r]:[];let l=o*o,a=new Uint8Array(r.length);a[0]=1,a[r.length-1]=1;let i=[[0,r.length-1]];for(;i.length;){let[p,C]=i.pop(),k=-1,M=l;for(let g=p+1;g<C;g++){let j=Ee(r[g],r[p],r[C]);j>M&&(M=j,k=g)}k!==-1&&(a[k]=1,i.push([p,k],[k,C]))}let s=[];for(let p=0;p<r.length;p++)a[p]&&s.push(r[p]);return s}function W(r,{tolerance:o=.002,max:l=500}={}){let a=ie(r,o);if(a.length>l){let i=a.length/l,s=[];for(let p=0;p<l-1;p++)s.push(a[Math.floor(p*i)]);s.push(a[a.length-1]),a=s}return a.map(([i,s])=>[Math.round(i*1e3)/1e3,Math.round(s)])}function G(r){if(!r.length)return"";let o=`M${r[0][0]} ${r[0][1]}`;for(let l=1;l<r.length;l++)o+=`L${r[l][0]} ${r[l][1]}`;return o}var $e={alt:"altKey",ctrl:"ctrlKey",meta:"metaKey",shift:"shiftKey"},ue=[8,200,145,275,45,320,175,95],q=r=>{let o=0;for(let l=0;l<String(r).length;l++)o=o*31+String(r).charCodeAt(l)>>>0;return ue[o%ue.length]};function ce(r){return ne("draw",(o,l,a={})=>{let i=l.ownerDocument,s=i.defaultView;re(),X("draw",ae),X("draw-held",se);let p=$e[a.modifier||"alt"]||"altKey",C=a.strokeWidth??3,k=a.opacity??.42,M=a.fadeMs??5e3,g=a.segmentMs??800,j=a.cursorMs??250,le=a.tolerance??.002,z=a.cursors===!0,de=a.room||`draw${s.location.pathname.replace(/\/+$/,"")||"/"}`,$=i.createElementNS("http://www.w3.org/2000/svg","svg");$.setAttribute("class","cubby-draw-marks"),$.setAttribute("aria-hidden","true");let A=i.createElement("div");A.className="cubby-draw-cursors",A.setAttribute("aria-hidden","true"),i.body.append($,A),o.own(()=>{$.remove(),A.remove()}),i.documentElement.style.setProperty("--cubby-draw-fade",`${M}ms`),o.own(()=>i.documentElement.style.removeProperty("--cubby-draw-fade"));function R(){let t=l.getBoundingClientRect();return{left:t.left+s.scrollX,top:t.top+s.scrollY,width:t.width||1}}let v=R(),H=(t,c)=>[(t-v.left)/v.width,c-v.top],K=([t,c])=>[v.left+t*v.width,v.top+c],b=null,x=new Map;function fe(t,c){let u=x.get(t);if(u)return u;let f=i.createElementNS("http://www.w3.org/2000/svg","path");return f.setAttribute("class","cubby-draw-path"),f.setAttribute("stroke",`hsl(${c} 85% 45% / ${k})`),f.setAttribute("stroke-width",String(C)),$.appendChild(f),u={el:f,points:[],timer:null},x.set(t,u),u}function pe(t){let c=x.get(t);c&&(s.clearTimeout(c.timer),c.timer=null)}function U(t,c=0){let u=x.get(t);u&&(s.clearTimeout(u.timer),u.timer=s.setTimeout(()=>{u.el.setAttribute("data-fading",""),u.timer=s.setTimeout(()=>{u.el.remove(),x.delete(t)},M)},c))}function V(t,c,u,f=!1){let h=fe(t,c),w=f&&h.points.length&&u.length?1:0;for(let S=w;S<u.length;S++)h.points.push(u[S]);return h.el.setAttribute("d",G(h.points.map(K))),h}function he(){v=R();for(let t of x.values())t.el.setAttribute("d",G(t.points.map(K)));for(let[t,c]of T)L(c,c._at,t===b)}o.on(s,"resize",he);let T=new Map;function F(t,c){let u=T.get(t);if(u)return u;u=i.createElement("div"),u.className="cubby-draw-puck";let f=i.createElement("span");f.className="cubby-draw-dot",f.style.background=`hsl(${q(t)} 85% 45%)`;let h=i.createElement("span");return h.className="cubby-draw-name",h.style.background=`hsl(${q(t)} 85% 45%)`,h.textContent=c||"",c||(h.hidden=!0),u.append(f,h),A.appendChild(u),T.set(t,u),u}function L(t,c,u){if(!c)return;t._at=c;let[f,h]=K(c);t.style.left=`${f}px`,t.style.top=`${h}px`,u&&t.setAttribute("data-self","")}function _(t){T.get(t)?.remove(),T.delete(t)}return me();function me(){let t=!1,c=!1,u=0,f=0,h=0,w=[],S=0,D=null,J=0,m=null,I=null,N=()=>`${b||"me"}|${u}`;function O(e){if(s.clearTimeout(D),D=null,w.length<2){e&&(w=[]);return}let n=W(w,{tolerance:le}),d=Math.max(1,Date.now()-S);w=e?[]:[w[w.length-1]],S=Date.now();let E={s:u,k:f,q:h++,p:n,ms:d};m?.emit("draw.mark",E).catch(()=>{}),e||Q()}function Q(){s.clearTimeout(D),D=s.setTimeout(()=>O(!1),g)}o.own(()=>s.clearTimeout(D));function be(e){if(!z||!m)return;let n=Date.now();n-J<j||(J=n,m.updateUserState({at:e}).catch(()=>{}))}function Z(e){t||(t=!0,i.body.classList.add("cubby-draw-held"),u+=1,f=0,L(F(b||"me","You"),H(e.pageX,e.pageY),!0))}function P(){t&&(t=!1,c=!1,i.body.classList.remove("cubby-draw-held"),O(!0),U(N()),_(b||"me"),z&&m?.updateUserState({at:null}).catch(()=>{}))}o.own(P),o.on(s,"keydown",e=>{!e[p]||t||I&&Z(I)},{capture:!0}),o.on(s,"keyup",()=>P(),{capture:!0}),o.on(s,"blur",()=>P()),o.on(i,"visibilitychange",()=>i.hidden&&P()),o.on(s,"pointermove",e=>{if(I=e,!e[p])return P();t||Z(e);let n=H(e.pageX,e.pageY);if(L(F(b||"me","You"),n,!0),be(n),c&&e.buttons===0)return ee();c&&(w.push(n),V(N(),q(b||"me"),[n]),pe(N()))},{capture:!0});function we(e){c=!0,f+=1,h=0,w=[H(e.pageX,e.pageY)],S=Date.now(),Q()}function ee(){c&&(c=!1,O(!0),U(N()))}for(let e of["pointerdown","click","dragstart","selectstart"])o.on(s,e,n=>{!n[p]&&!t||(n.preventDefault(),n.stopPropagation(),e==="pointerdown"&&we(n))},{capture:!0});o.on(s,"pointerup",()=>ee(),{capture:!0});function ye(e,n){if(!b||!n||n.id===b)return;let d=`${n.id}|${e.s}`,E=V(d,q(n.id),e.p||[],!0);ge(E,e),U(d,Math.min(e.ms||0,g*2))}function ge(e,n){let d=e.el,E=typeof d.getTotalLength=="function"?d.getTotalLength():0;if(!E)return;let Se=Math.max(1,Math.min(n.ms||0,g*2));d.style.transition="none",d.style.strokeDasharray=String(E),d.style.strokeDashoffset=String(E),s.requestAnimationFrame?.(()=>{d.style.transition=`stroke-dashoffset ${Se}ms linear, opacity var(--cubby-draw-fade) linear`,d.style.strokeDashoffset="0"})}function ke(e,n,d){if(!(!z||!b||!d||d.id===b)){if(!n?.at)return _(d.id);L(F(d.id,d.name||d.username||"Someone"),n.at,!1)}}let B=a.chip===!1?null:ve();function ve(){let e=i.createElement("div");e.className="cubby-draw-chip",e.setAttribute("role","status");let n=i.createElement("span");n.className="cubby-draw-said";let d=i.createElement("span");return d.className="cubby-draw-count",d.setAttribute("aria-hidden","true"),e.append(d,n),i.body.appendChild(e),o.own(()=>e.remove()),{el:e,said:n,count:d}}function Y(e,n){B&&(B.said.textContent=e,B.count.textContent=n==null?"":String(n))}let te=s.matchMedia?.("(hover: none)").matches?"Drawing unavailable":`Hold ${a.modifier||"Alt"} to draw`;Y(te,null);async function xe(){if(r?.rooms)try{if(await Promise.race([r.ready,new Promise(n=>s.setTimeout(n,a.identifyMs??3e3))]),b=r.identity?.user?.id||null,!b)return Y(`${te} - sign in to share`,null);m=r.rooms.room(de),m.on("draw.mark",ye),m.on("user.state",ke),m.on("user.leave",n=>_(n.id));let e=()=>{let n=Math.max(0,m.users.length-1);Y(n?`${n} other${n===1?"":"s"} here`:"Just you",n)};m.on("room.sync",e),m.on("user.join",e),await m.join(),e()}catch{m=null,Y("Sharing offline",null)}}return xe(),o.own(()=>m?.leave().catch(()=>{})),{get room(){return m?.id||null},get marks(){return x.size},marksLayer:$,cursorsLayer:A}}})}if(typeof window<"u"){let r=oe("draw.js");r&&(r.draw=ce(r))}})();
