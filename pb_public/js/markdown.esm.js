/* cubby markdown v0.1.0 (https://github.com/patsissons/cubby) */
import{escapeHtml as R}from"./core.esm.js";import{escapeHtml as v,sanitizeUrl as W}from"./core.esm.js";var ne=16,oe=/[!-/:-@[-`{-~]/,I=/[A-Za-z0-9_]/;function E(e,r,t){let n=0;for(;e[r+n]===t;)n++;return n}function j(e,r,t){let n=r;for(;n<e.length;)if(e[n]==="`"){let o=E(e,n,"`");if(o===t)return n;n+=o}else n++;return-1}function re(e){for(;e.length;){let r=e[e.length-1];if(`.,;:!?'"`.includes(r)){e=e.slice(0,-1);continue}if(r===")"){let t=(e.match(/\(/g)||[]).length;if((e.match(/\)/g)||[]).length>t){e=e.slice(0,-1);continue}}break}return e}function ie(e,r){let t=0,n=r;for(;n<e.length;){let o=e[n];if(o==="\\"){n+=2;continue}if(o==="`"){let i=E(e,n,"`"),l=j(e,n+i,i);n=l===-1?n+i:l+i;continue}if(o==="[")t++;else if(o==="]"&&(t--,t===0))return n;n++}return-1}function le(e,r){if(e[r]!=="(")return null;let t=r+1;for(;e[t]===" "||e[t]===`
`;)t++;let n="";if(e[t]==="<"){let i=e.indexOf(">",t+1);if(i===-1||(n=e.slice(t+1,i),n.includes(`
`)))return null;t=i+1}else{let i=0,l=t;for(;t<e.length;){let c=e[t];if(c==="\\"&&e[t+1]){t+=2;continue}if(/\s/.test(c))break;if(c==="(")i++;else if(c===")"){if(i===0)break;i--}t++}n=e.slice(l,t).replace(/\\([!-/:-@[-`{-~])/g,"$1")}for(;e[t]===" "||e[t]===`
`;)t++;let o="";if(e[t]==='"'||e[t]==="'"){let i=e[t],l=t+1;for(;l<e.length&&e[l]!==i;)e[l]==="\\"&&e[l+1]?(o+=e[l+1],l+=2):(o+=e[l],l++);if(l>=e.length)return null;for(t=l+1;e[t]===" "||e[t]===`
`;)t++}return e[t]!==")"?null:{href:n,title:o,end:t+1}}function L(e){let r="";for(let t of e)t.type==="text"||t.type==="code"?r+=t.text:t.type==="image"?r+=t.alt:t.children&&(r+=L(t.children));return r}function B(e,r,t,n){let o=ie(e,r);if(o===-1)return null;let i=le(e,o+1);if(!i)return null;let l=e.slice(r+1,o);if(n){let d=L(x(l,t+1,!0));return{node:{type:"image",src:i.href,alt:d,title:i.title},end:i.end}}let c=x(l,t+1,!0);return{node:{type:"link",href:i.href,title:i.title,children:c},end:i.end}}function C(e,r,t,n){let o=e[r+t];if(!o||/\s/.test(o))return!1;if(n==="_"){let i=e[r-1];if(i&&I.test(i))return!1}return!0}function U(e,r,t,n){let o=r;for(;o<e.length;){let i=e[o];if(i==="\\"){o+=2;continue}if(i==="`"){let l=E(e,o,"`"),c=j(e,o+l,l);o=c===-1?o+l:c+l;continue}if(i===n&&e.startsWith(t,o)){let l=e[o-1],c=E(e,o,n),d=e[o+c],s=!!l&&!/\s/.test(l),a=n!=="_"||!d||!I.test(d);if(s&&a)return o;o+=c;continue}o++}return-1}function ae(e,r,t,n,o){let i=E(e,r,t);if(t==="~"){if(i<2||!C(e,r,2,t))return null;let l=U(e,r+2,"~~",t);return l===-1||l<=r+2?null:{node:{type:"del",children:x(e.slice(r+2,l),n+1,o)},end:l+2}}if(i>=3&&C(e,r,3,t)){let l=U(e,r+3,t+t+t,t);if(l!==-1&&l>r+3)return{node:{type:"em",children:[{type:"strong",children:x(e.slice(r+3,l),n+1,o)}]},end:l+3}}if(i>=2&&C(e,r,2,t)){let l=U(e,r+2,t+t,t);if(l!==-1&&l>r+2)return{node:{type:"strong",children:x(e.slice(r+2,l),n+1,o)},end:l+2}}if(C(e,r,1,t)){let l=U(e,r+1,t,t);if(l!==-1&&l>r+1)return{node:{type:"em",children:x(e.slice(r+1,l),n+1,o)},end:l+1}}return null}function x(e,r=0,t=!1){let n=[],o="",i=0,l=()=>{o&&(n.push({type:"text",text:o}),o="")};for(;i<e.length;){let c=e[i];if(c==="\\"){let d=e[i+1];if(d===`
`){l(),n.push({type:"br"}),i+=2;continue}if(d&&oe.test(d)){o+=d,i+=2;continue}o+=c,i++;continue}if(c===`
`){/ {2}$/.test(o)?(o=o.replace(/ +$/,""),l(),n.push({type:"br"})):(o=o.replace(/ +$/,""),l(),n.push({type:"softbreak"})),i++;continue}if(c==="`"){let d=E(e,i,"`"),s=j(e,i+d,d);if(s!==-1){l();let a=e.slice(i+d,s);a.length>=2&&a[0]===" "&&a.endsWith(" ")&&a.trim()&&(a=a.slice(1,-1)),n.push({type:"code",text:a}),i=s+d;continue}o+=e.slice(i,i+d),i+=d;continue}if(c==="<"&&!t){let d=/^<(https?:\/\/[^\s<>]+|mailto:[^\s<>]+)>/i.exec(e.slice(i));if(d){l();let s=d[1],a=s.replace(/^mailto:/i,"");n.push({type:"link",href:s,title:"",children:[{type:"text",text:a}]}),i+=d[0].length;continue}o+=c,i++;continue}if((c==="h"||c==="H")&&!t&&(i===0||!I.test(e[i-1]))){let d=/^https?:\/\/[^\s<]+/i.exec(e.slice(i));if(d){let s=re(d[0]);l(),n.push({type:"link",href:s,title:"",children:[{type:"text",text:s}]}),i+=s.length;continue}o+=c,i++;continue}if(c==="!"&&e[i+1]==="["){let d=B(e,i+1,r,!0);if(d){l(),n.push(d.node),i=d.end;continue}o+=c,i++;continue}if(c==="["&&!t){let d=B(e,i,r,!1);if(d){l(),n.push(d.node),i=d.end;continue}o+=c,i++;continue}if((c==="*"||c==="_"||c==="~")&&r<ne){let d=ae(e,i,c,r,t);if(d){l(),n.push(d.node),i=d.end;continue}o+=c,i++;continue}o+=c,i++}return l(),n}function A(e,r){let t="";for(let n of e)switch(n.type){case"text":t+=v(n.text);break;case"softbreak":t+=`
`;break;case"br":t+=`<br>
`;break;case"code":t+=`<code>${v(n.text)}</code>`;break;case"em":t+=`<em>${A(n.children,r)}</em>`;break;case"strong":t+=`<strong>${A(n.children,r)}</strong>`;break;case"del":t+=`<del>${A(n.children,r)}</del>`;break;case"link":{let o=v(W(n.href)),i=n.title?` title="${v(n.title)}"`:"",l=r.linkTarget?` target="${v(r.linkTarget)}" rel="noopener noreferrer"`:"";t+=`<a href="${o}"${i}${l}>${A(n.children,r)}</a>`;break}case"image":{let o=v(W(n.src,{image:!0})),i=n.title?` title="${v(n.title)}"`:"";t+=`<img src="${o}" alt="${v(n.alt)}"${i}>`;break}}return t}function $(e,r={}){return A(x(e),r)}var P=/^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)/,F=/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/,X=/^ {0,3}(?:(?:- *){3,}|(?:\* *){3,}|(?:_ *){3,})$/,_=/^ {0,3}>/,G=/^( *)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/,ce=/^\[( |x|X)\][ \t]+/;function q(e){let r=G.exec(e);return r?{indent:r[1].length,marker:r[2],content:r[3],ordered:de.test(r[2][0])}:null}var de=/[0-9]/;function D(e){let r=e.trim(),t=[],n="";for(let o=0;o<r.length;o++){let i=r[o];if(i==="\\"&&r[o+1]==="|"){n+="|",o++;continue}if(i==="\\"&&r[o+1]){n+=i+r[o+1],o++;continue}if(i==="|"){t.push(n),n="";continue}n+=i}return t.push(n),t.length&&r.startsWith("|")&&t[0].trim()===""&&t.shift(),t.length&&r.endsWith("|")&&t[t.length-1].trim()===""&&t.pop(),t}function V(e){if(!e||!e.includes("-"))return!1;let r=D(e);return r.length>0&&r.every(t=>/^ *:?-+:? *$/.test(t))}function H(e){return e?` style="text-align:${e}"`:""}function se(e,r,t){let n=e[r];if(!n.includes("|")||!V(e[r+1]))return null;let o=D(n),i=D(e[r+1]).map(s=>{let a=s.trim(),f=a.startsWith(":"),m=a.endsWith(":");return f&&m?"center":m?"right":f?"left":""});if(!o.length||o.length!==i.length)return null;let l=`<table>
<thead>
<tr>
`;o.forEach((s,a)=>{l+=`<th${H(i[a])}>${$(s.trim(),t)}</th>
`}),l+=`</tr>
</thead>
`;let c=r+2,d=[];for(;c<e.length&&e[c].trim()&&e[c].includes("|");)d.push(D(e[c])),c++;if(d.length){l+=`<tbody>
`;for(let s of d){l+=`<tr>
`;for(let a=0;a<o.length;a++)l+=`<td${H(i[a])}>${$((s[a]||"").trim(),t)}</td>
`;l+=`</tr>
`}l+=`</tbody>
`}return l+=`</table>
`,{html:l,end:c}}function K(e,r,t){let n=q(e[r]),o=n.indent,i=n.ordered,l=i?parseInt(n.marker,10):1,c=[],d=r;for(;d<e.length;){let a=e[d];if(!a.trim())break;let f=q(a);if(!f||f.indent<o)break;if(f.indent>=o+2){let m=K(e,d,t);c[c.length-1].nested+=m.html,d=m.end;continue}c.push({content:f.content,nested:""}),d++}let s=i?l!==1?`<ol start="${l}">
`:`<ol>
`:`<ul>
`;for(let a of c){let f=ce.exec(a.content);if(f){let m=f[1].toLowerCase()==="x"?" checked":"",h=a.content.slice(f[0].length);s+=`<li class="task"><input type="checkbox" disabled${m}> ${$(h,t)}${a.nested}</li>
`}else s+=`<li>${$(a.content,t)}${a.nested}</li>
`}return s+=i?`</ol>
`:`</ul>
`,{html:s,end:d}}function ue(e,r){return P.test(e)||F.test(e)||X.test(e)||_.test(e)||G.test(e)||e.includes("|")&&V(r)}function Q(e,r){let t="",n=0;for(;n<e.length;){let o=e[n];if(!o.trim()){n++;continue}let i=P.exec(o);if(i){let a=i[1],f=i[2],m=[],h=n+1;for(;h<e.length;){let b=/^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(e[h]);if(b&&b[1][0]===a[0]&&b[1].length>=a.length)break;m.push(e[h]),h++}let w=f?` class="language-${R(f)}"`:"",k=m.length?R(m.join(`
`))+`
`:"";t+=`<pre><code${w}>${k}</code></pre>
`,n=h+1;continue}let l=F.exec(o);if(l){let a=l[1].length,f=(l[2]||"").replace(/[ \t]+#+[ \t]*$/,"");t+=`<h${a}>${$(f,r)}</h${a}>
`,n++;continue}if(X.test(o)){t+=`<hr>
`,n++;continue}if(_.test(o)){let a=[];for(;n<e.length&&_.test(e[n]);)a.push(e[n].replace(/^ {0,3}> ?/,"")),n++;t+=`<blockquote>
${Q(a,r)}</blockquote>
`;continue}let c=se(e,n,r);if(c){t+=c.html,n=c.end;continue}if(q(o)){let a=K(e,n,r);t+=a.html,n=a.end;continue}let d=[o],s=n+1;for(;s<e.length&&e[s].trim()&&!ue(e[s],e[s+1]);)d.push(e[s]),s++;t+=`<p>${$(d.join(`
`),r)}</p>
`,n=s}return t}function Y(e,r={}){return typeof e!="string"||!e.trim()?"":Q(e.replace(/\r\n?/g,`
`).split(`
`),r)}import{injectStyle as fe,ensureTokens as be}from"./core.esm.js";var me=`
.cubby-markdown { line-height: 1.55; overflow-wrap: break-word; }
.cubby-markdown > :first-child { margin-top: 0; }
.cubby-markdown > :last-child { margin-bottom: 0; }
.cubby-markdown h1, .cubby-markdown h2, .cubby-markdown h3,
.cubby-markdown h4, .cubby-markdown h5, .cubby-markdown h6 { margin: 1.2em 0 0.5em; line-height: 1.25; }
.cubby-markdown h1 { font-size: 1.5em; }
.cubby-markdown h2 { font-size: 1.3em; }
.cubby-markdown h3 { font-size: 1.15em; }
.cubby-markdown p, .cubby-markdown ul, .cubby-markdown ol,
.cubby-markdown table, .cubby-markdown pre, .cubby-markdown blockquote { margin: 0.6em 0; }
.cubby-markdown a { color: var(--accent, #4a7dbd); }
.cubby-markdown code { background: var(--code-bg, rgba(127, 127, 127, 0.15)); padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.9em; }
.cubby-markdown pre { background: var(--code-bg, rgba(127, 127, 127, 0.15)); padding: 0.75em; border-radius: 8px; overflow-x: auto; }
.cubby-markdown pre code { background: none; padding: 0; font-size: 0.85em; }
.cubby-markdown blockquote { border-left: 3px solid var(--border, #c8c2ba); padding: 0.1em 1em; color: var(--muted, #6f6b66); white-space: normal; }
.cubby-markdown hr { border: 0; border-top: 1px solid var(--border, #c8c2ba); margin: 1.2em 0; }
.cubby-markdown img { max-width: 100%; }
.cubby-markdown table { border-collapse: collapse; display: block; overflow-x: auto; }
.cubby-markdown th, .cubby-markdown td { border: 1px solid var(--border, #c8c2ba); padding: 0.3em 0.7em; text-align: left; }
.cubby-markdown th { background: var(--code-bg, rgba(127, 127, 127, 0.15)); }
/* own the list layout: apps commonly reset ul/ol globally */
.cubby-markdown ul { list-style: disc; }
.cubby-markdown ol { list-style: decimal; }
.cubby-markdown ul, .cubby-markdown ol { padding-left: 1.6em; }
.cubby-markdown li.task { list-style: none; margin-left: -1.6em; }
/* width/padding/border resets defend against app-global input rules */
.cubby-markdown li.task input { width: auto; padding: 0; border: 0; background: none; margin: 0 0.35em 0 0; vertical-align: middle; }

.cubby-md-editor { border: 1px solid var(--border, #c8c2ba); border-radius: 8px; overflow: hidden; }
/* explicit display rules would otherwise defeat the hidden attribute */
.cubby-md-input[hidden], .cubby-md-preview[hidden] { display: none; }
.cubby-md-tabs { display: flex; gap: 0.25rem; padding: 0.4rem 0.5rem 0; border-bottom: 1px solid var(--border, #c8c2ba); }
.cubby-md-tab { border: 0; background: none; color: var(--muted, #6f6b66); font: inherit; padding: 0.35rem 0.75rem; cursor: pointer; border-radius: 6px 6px 0 0; }
.cubby-md-tab[aria-selected="true"] { color: inherit; font-weight: 600; box-shadow: inset 0 -2px 0 var(--accent, #4a7dbd); }
.cubby-md-input { display: block; width: 100%; border: 0; outline: none; padding: 0.75rem; background: none; color: inherit; font: 0.9em/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; resize: vertical; min-height: 8rem; }
.cubby-md-preview { padding: 0.75rem; }
.cubby-md-empty { color: var(--muted, #6f6b66); }
.cubby-md-split { display: grid; grid-template-columns: 1fr 1fr; }
.cubby-md-split .cubby-md-preview { border-left: 1px solid var(--border, #c8c2ba); overflow-y: auto; }
@media (max-width: 40rem) {
  .cubby-md-split { grid-template-columns: 1fr; }
  .cubby-md-split .cubby-md-preview { border-left: 0; border-top: 1px solid var(--border, #c8c2ba); }
}
`;function Z(){be(),fe("markdown",me)}import{CubbyError as M,toCubbyError as pe}from"./core.esm.js";var N={"image/png":"png","image/jpeg":"jpg","image/gif":"gif","image/webp":"webp"};function J(e){return function(t,n={}){if(typeof document>"u")throw new M("bad_request","attachImageUpload requires a DOM");let o=n.pathPrefix||"uploads/",i=n.maxBytes||10*1024*1024,l=n.onUploadStart||(()=>{}),c=n.onUpload||(()=>{}),d=n.onError||(b=>console.error("[cubby] image upload failed:",b));function s(){t.dispatchEvent(new Event("input",{bubbles:!0}))}function a(b){t.setRangeText(b,t.selectionStart,t.selectionEnd,"end"),s()}function f(b,u){let p=t.value.indexOf(b);return p===-1?!1:(t.setRangeText(u,p,p+b.length,"preserve"),s(),!0)}async function m(b){let u=e.identity?.user;if(!u){d(new M("auth_required","sign in to upload images"));return}if(b.size>i){d(new M("file_too_large",`image exceeds ${i} bytes`));return}let p=N[b.type],T=Date.now().toString(36)+Math.random().toString(36).slice(2,8),g=(b.name||`image.${p}`).replace(/[[\]()\n\r]/g,""),S=`![Uploading ${g}\u2026](cubby-upload:${T})`,y=`${o}${u.id}/${T}.${p}`;a(S),l({name:g,path:y});try{let O=(await e.fs.write(y,b)).url||await e.fs.url(y);f(S,`![${g}](${O})`),c({name:g,path:y,url:O})}catch(z){f(S,""),d(pe(z,"upload_failed"))}}function h(b){let u=Array.from(b.clipboardData?.items||[]).filter(p=>p.kind==="file"&&N[p.type]).map(p=>p.getAsFile()).filter(Boolean);if(u.length){b.preventDefault();for(let p of u)m(p)}}function w(b){b.preventDefault()}function k(b){let u=Array.from(b.dataTransfer?.files||[]).filter(p=>N[p.type]);if(u.length){b.preventDefault();for(let p of u)m(p)}}return t.addEventListener("paste",h),t.addEventListener("dragover",w),t.addEventListener("drop",k),()=>{t.removeEventListener("paste",h),t.removeEventListener("dragover",w),t.removeEventListener("drop",k)}}}import{CubbyError as ee,widget as he}from"./core.esm.js";function te(e,r){return he("editor",(t,n,o={})=>{if(typeof document>"u")throw new ee("bad_request","editor requires a DOM");let i=e.markdown;if(!i)throw new ee("bad_request","the editor needs /js/markdown.js loaded before it");i.injectStyles();let l=o.preview===!1?"none":o.preview==="split"?"split":"tabs",c=o.previewDebounceMs??150,d=o.onChange||(()=>{}),s=document.createElement("div");s.className="cubby-md-editor";let a=document.createElement("textarea");a.className="cubby-md-input",a.rows=o.rows||8,a.value=o.value||"",o.placeholder&&(a.placeholder=o.placeholder);let f=document.createElement("div");f.className="cubby-md-preview cubby-markdown";function m(){let u=a.value;f.innerHTML=u.trim()?i.render(u,{linkTarget:o.linkTarget}):'<p class="cubby-md-empty">Nothing to preview</p>'}let h=null,w=null;if(l==="tabs"){let u=document.createElement("div");u.className="cubby-md-tabs",u.setAttribute("role","tablist");let p=(g,S)=>{let y=document.createElement("button");return y.type="button",y.className="cubby-md-tab",y.setAttribute("role","tab"),y.setAttribute("aria-selected",String(S)),y.textContent=g,u.appendChild(y),y};h=p("Write",!0),w=p("Preview",!1);let T=g=>{h.setAttribute("aria-selected",String(!g)),w.setAttribute("aria-selected",String(g)),a.hidden=g,f.hidden=!g,g?m():a.focus()};t.on(h,"click",()=>T(!1)),t.on(w,"click",()=>T(!0)),f.hidden=!0,s.append(u,a,f)}else if(l==="split"){let u=document.createElement("div");u.className="cubby-md-split",u.append(a,f),s.appendChild(u),m()}else s.appendChild(a);let k=null;t.on(a,"input",()=>{d(a.value),l==="split"&&(clearTimeout(k),k=setTimeout(m,c))}),t.own(()=>clearTimeout(k));let b=[];return o.upload!==!1&&e.hasPlatform?.()&&t.own(r(a,{...o.upload||{},onUploadStart:o.onUploadStart,onUpload:u=>{b.push(u),o.onUpload?.(u)},onError:o.onError})),n.replaceChildren(s),t.own(()=>s.remove()),{get value(){return a.value},set value(u){this.setValue(u)},setValue(u){a.value=String(u),d(a.value),(l==="split"||l==="tabs"&&!f.hidden)&&m()},textarea:a,preview:f,images:b,focus(){a.focus()},refresh(){m()}}})}function ge(e){let r=J(e);return{render:Y,editor:te(e,r),attachImageUpload:r,injectStyles:Z}}var _e=ge;export{ge as createMarkdown,_e as default,Y as render};
