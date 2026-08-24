/* cubby markdown v0.1.0 (https://github.com/patsissons/cubby) */
import{escapeHtml as F}from"./core.esm.js";import{escapeHtml as k,sanitizeUrl as B}from"./core.esm.js";var te=16,ne=/[!-/:-@[-`{-~]/,j=/[A-Za-z0-9_]/;function T(e,i,t){let n=0;for(;e[i+n]===t;)n++;return n}function q(e,i,t){let n=i;for(;n<e.length;)if(e[n]==="`"){let o=T(e,n,"`");if(o===t)return n;n+=o}else n++;return-1}function oe(e){for(;e.length;){let i=e[e.length-1];if(`.,;:!?'"`.includes(i)){e=e.slice(0,-1);continue}if(i===")"){let t=(e.match(/\(/g)||[]).length;if((e.match(/\)/g)||[]).length>t){e=e.slice(0,-1);continue}}break}return e}function re(e,i){let t=0,n=i;for(;n<e.length;){let o=e[n];if(o==="\\"){n+=2;continue}if(o==="`"){let r=T(e,n,"`"),l=q(e,n+r,r);n=l===-1?n+r:l+r;continue}if(o==="[")t++;else if(o==="]"&&(t--,t===0))return n;n++}return-1}function ie(e,i){if(e[i]!=="(")return null;let t=i+1;for(;e[t]===" "||e[t]===`
`;)t++;let n="";if(e[t]==="<"){let r=e.indexOf(">",t+1);if(r===-1||(n=e.slice(t+1,r),n.includes(`
`)))return null;t=r+1}else{let r=0,l=t;for(;t<e.length;){let a=e[t];if(a==="\\"&&e[t+1]){t+=2;continue}if(/\s/.test(a))break;if(a==="(")r++;else if(a===")"){if(r===0)break;r--}t++}n=e.slice(l,t).replace(/\\([!-/:-@[-`{-~])/g,"$1")}for(;e[t]===" "||e[t]===`
`;)t++;let o="";if(e[t]==='"'||e[t]==="'"){let r=e[t],l=t+1;for(;l<e.length&&e[l]!==r;)e[l]==="\\"&&e[l+1]?(o+=e[l+1],l+=2):(o+=e[l],l++);if(l>=e.length)return null;for(t=l+1;e[t]===" "||e[t]===`
`;)t++}return e[t]!==")"?null:{href:n,title:o,end:t+1}}function H(e){let i="";for(let t of e)t.type==="text"||t.type==="code"?i+=t.text:t.type==="image"?i+=t.alt:t.children&&(i+=H(t.children));return i}function R(e,i,t,n){let o=re(e,i);if(o===-1)return null;let r=ie(e,o+1);if(!r)return null;let l=e.slice(i+1,o);if(n){let c=H(x(l,t+1,!0));return{node:{type:"image",src:r.href,alt:c,title:r.title},end:r.end}}let a=x(l,t+1,!0);return{node:{type:"link",href:r.href,title:r.title,children:a},end:r.end}}function C(e,i,t,n){let o=e[i+t];if(!o||/\s/.test(o))return!1;if(n==="_"){let r=e[i-1];if(r&&j.test(r))return!1}return!0}function U(e,i,t,n){let o=i;for(;o<e.length;){let r=e[o];if(r==="\\"){o+=2;continue}if(r==="`"){let l=T(e,o,"`"),a=q(e,o+l,l);o=a===-1?o+l:a+l;continue}if(r===n&&e.startsWith(t,o)){let l=e[o-1],a=T(e,o,n),c=e[o+a],d=!!l&&!/\s/.test(l),u=n!=="_"||!c||!j.test(c);if(d&&u)return o;o+=a;continue}o++}return-1}function le(e,i,t,n,o){let r=T(e,i,t);if(t==="~"){if(r<2||!C(e,i,2,t))return null;let l=U(e,i+2,"~~",t);return l===-1||l<=i+2?null:{node:{type:"del",children:x(e.slice(i+2,l),n+1,o)},end:l+2}}if(r>=3&&C(e,i,3,t)){let l=U(e,i+3,t+t+t,t);if(l!==-1&&l>i+3)return{node:{type:"em",children:[{type:"strong",children:x(e.slice(i+3,l),n+1,o)}]},end:l+3}}if(r>=2&&C(e,i,2,t)){let l=U(e,i+2,t+t,t);if(l!==-1&&l>i+2)return{node:{type:"strong",children:x(e.slice(i+2,l),n+1,o)},end:l+2}}if(C(e,i,1,t)){let l=U(e,i+1,t,t);if(l!==-1&&l>i+1)return{node:{type:"em",children:x(e.slice(i+1,l),n+1,o)},end:l+1}}return null}function x(e,i=0,t=!1){let n=[],o="",r=0,l=()=>{o&&(n.push({type:"text",text:o}),o="")};for(;r<e.length;){let a=e[r];if(a==="\\"){let c=e[r+1];if(c===`
`){l(),n.push({type:"br"}),r+=2;continue}if(c&&ne.test(c)){o+=c,r+=2;continue}o+=a,r++;continue}if(a===`
`){/ {2}$/.test(o)?(o=o.replace(/ +$/,""),l(),n.push({type:"br"})):(o=o.replace(/ +$/,""),l(),n.push({type:"softbreak"})),r++;continue}if(a==="`"){let c=T(e,r,"`"),d=q(e,r+c,c);if(d!==-1){l();let u=e.slice(r+c,d);u.length>=2&&u[0]===" "&&u.endsWith(" ")&&u.trim()&&(u=u.slice(1,-1)),n.push({type:"code",text:u}),r=d+c;continue}o+=e.slice(r,r+c),r+=c;continue}if(a==="<"&&!t){let c=/^<(https?:\/\/[^\s<>]+|mailto:[^\s<>]+)>/i.exec(e.slice(r));if(c){l();let d=c[1],u=d.replace(/^mailto:/i,"");n.push({type:"link",href:d,title:"",children:[{type:"text",text:u}]}),r+=c[0].length;continue}o+=a,r++;continue}if((a==="h"||a==="H")&&!t&&(r===0||!j.test(e[r-1]))){let c=/^https?:\/\/[^\s<]+/i.exec(e.slice(r));if(c){let d=oe(c[0]);l(),n.push({type:"link",href:d,title:"",children:[{type:"text",text:d}]}),r+=d.length;continue}o+=a,r++;continue}if(a==="!"&&e[r+1]==="["){let c=R(e,r+1,i,!0);if(c){l(),n.push(c.node),r=c.end;continue}o+=a,r++;continue}if(a==="["&&!t){let c=R(e,r,i,!1);if(c){l(),n.push(c.node),r=c.end;continue}o+=a,r++;continue}if((a==="*"||a==="_"||a==="~")&&i<te){let c=le(e,r,a,i,t);if(c){l(),n.push(c.node),r=c.end;continue}o+=a,r++;continue}o+=a,r++}return l(),n}function S(e,i){let t="";for(let n of e)switch(n.type){case"text":t+=k(n.text);break;case"softbreak":t+=`
`;break;case"br":t+=`<br>
`;break;case"code":t+=`<code>${k(n.text)}</code>`;break;case"em":t+=`<em>${S(n.children,i)}</em>`;break;case"strong":t+=`<strong>${S(n.children,i)}</strong>`;break;case"del":t+=`<del>${S(n.children,i)}</del>`;break;case"link":{let o=k(B(n.href)),r=n.title?` title="${k(n.title)}"`:"",l=i.linkTarget?` target="${k(i.linkTarget)}" rel="noopener noreferrer"`:"";t+=`<a href="${o}"${r}${l}>${S(n.children,i)}</a>`;break}case"image":{let o=k(B(n.src,{image:!0})),r=n.title?` title="${k(n.title)}"`:"";t+=`<img src="${o}" alt="${k(n.alt)}"${r}>`;break}}return t}function $(e,i={}){return S(x(e),i)}var X=/^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)/,G=/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/,K=/^ {0,3}(?:(?:- *){3,}|(?:\* *){3,}|(?:_ *){3,})$/,L=/^ {0,3}>/,Q=/^( *)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/,ce=/^\[( |x|X)\][ \t]+/;function M(e){let i=Q.exec(e);return i?{indent:i[1].length,marker:i[2],content:i[3],ordered:ae.test(i[2][0])}:null}var ae=/[0-9]/;function D(e){let i=e.trim(),t=[],n="";for(let o=0;o<i.length;o++){let r=i[o];if(r==="\\"&&i[o+1]==="|"){n+="|",o++;continue}if(r==="\\"&&i[o+1]){n+=r+i[o+1],o++;continue}if(r==="|"){t.push(n),n="";continue}n+=r}return t.push(n),t.length&&i.startsWith("|")&&t[0].trim()===""&&t.shift(),t.length&&i.endsWith("|")&&t[t.length-1].trim()===""&&t.pop(),t}function Y(e){if(!e||!e.includes("-"))return!1;let i=D(e);return i.length>0&&i.every(t=>/^ *:?-+:? *$/.test(t))}function P(e){return e?` style="text-align:${e}"`:""}function de(e,i,t){let n=e[i];if(!n.includes("|")||!Y(e[i+1]))return null;let o=D(n),r=D(e[i+1]).map(d=>{let u=d.trim(),f=u.startsWith(":"),m=u.endsWith(":");return f&&m?"center":m?"right":f?"left":""});if(!o.length||o.length!==r.length)return null;let l=`<table>
<thead>
<tr>
`;o.forEach((d,u)=>{l+=`<th${P(r[u])}>${$(d.trim(),t)}</th>
`}),l+=`</tr>
</thead>
`;let a=i+2,c=[];for(;a<e.length&&e[a].trim()&&e[a].includes("|");)c.push(D(e[a])),a++;if(c.length){l+=`<tbody>
`;for(let d of c){l+=`<tr>
`;for(let u=0;u<o.length;u++)l+=`<td${P(r[u])}>${$((d[u]||"").trim(),t)}</td>
`;l+=`</tr>
`}l+=`</tbody>
`}return l+=`</table>
`,{html:l,end:a}}function Z(e,i,t){let n=M(e[i]),o=n.indent,r=n.ordered,l=r?parseInt(n.marker,10):1,a=[],c=i;for(;c<e.length;){let u=e[c];if(!u.trim())break;let f=M(u);if(!f||f.indent<o)break;if(f.indent>=o+2){let m=Z(e,c,t);a[a.length-1].nested+=m.html,c=m.end;continue}a.push({content:f.content,nested:""}),c++}let d=r?l!==1?`<ol start="${l}">
`:`<ol>
`:`<ul>
`;for(let u of a){let f=ce.exec(u.content);if(f){let m=f[1].toLowerCase()==="x"?" checked":"",p=u.content.slice(f[0].length);d+=`<li class="task"><input type="checkbox" disabled${m}> ${$(p,t)}${u.nested}</li>
`}else d+=`<li>${$(u.content,t)}${u.nested}</li>
`}return d+=r?`</ol>
`:`</ul>
`,{html:d,end:c}}function ue(e,i){return X.test(e)||G.test(e)||K.test(e)||L.test(e)||Q.test(e)||e.includes("|")&&Y(i)}function J(e,i){let t="",n=0;for(;n<e.length;){let o=e[n];if(!o.trim()){n++;continue}let r=X.exec(o);if(r){let u=r[1],f=r[2],m=[],p=n+1;for(;p<e.length;){let s=/^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(e[p]);if(s&&s[1][0]===u[0]&&s[1].length>=u.length)break;m.push(e[p]),p++}let w=f?` class="language-${F(f)}"`:"",v=m.length?F(m.join(`
`))+`
`:"";t+=`<pre><code${w}>${v}</code></pre>
`,n=p+1;continue}let l=G.exec(o);if(l){let u=l[1].length,f=(l[2]||"").replace(/[ \t]+#+[ \t]*$/,"");t+=`<h${u}>${$(f,i)}</h${u}>
`,n++;continue}if(K.test(o)){t+=`<hr>
`,n++;continue}if(L.test(o)){let u=[];for(;n<e.length&&L.test(e[n]);)u.push(e[n].replace(/^ {0,3}> ?/,"")),n++;t+=`<blockquote>
${J(u,i)}</blockquote>
`;continue}let a=de(e,n,i);if(a){t+=a.html,n=a.end;continue}if(M(o)){let u=Z(e,n,i);t+=u.html,n=u.end;continue}let c=[o],d=n+1;for(;d<e.length&&e[d].trim()&&!ue(e[d],e[d+1]);)c.push(e[d]),d++;t+=`<p>${$(c.join(`
`),i)}</p>
`,n=d}return t}function I(e,i={}){return typeof e!="string"||!e.trim()?"":J(e.replace(/\r\n?/g,`
`).split(`
`),i)}import{injectStyle as se,ensureTokens as fe}from"./core.esm.js";var be=`
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
`;function _(){fe(),se("markdown",be)}import{CubbyError as N,toCubbyError as me}from"./core.esm.js";var z={"image/png":"png","image/jpeg":"jpg","image/gif":"gif","image/webp":"webp"};function V(e){return function(t,n={}){if(typeof document>"u")throw new N("bad_request","attachImageUpload requires a DOM");let o=n.pathPrefix||"uploads/",r=n.maxBytes||10*1024*1024,l=n.onUploadStart||(()=>{}),a=n.onUpload||(()=>{}),c=n.onError||(s=>console.error("[cubby] image upload failed:",s));function d(){t.dispatchEvent(new Event("input",{bubbles:!0}))}function u(s){t.setRangeText(s,t.selectionStart,t.selectionEnd,"end"),d()}function f(s,h){let b=t.value.indexOf(s);return b===-1?!1:(t.setRangeText(h,b,b+s.length,"preserve"),d(),!0)}async function m(s){let h=e.identity.user;if(!h){c(new N("auth_required","sign in to upload images"));return}if(s.size>r){c(new N("file_too_large",`image exceeds ${r} bytes`));return}let b=z[s.type],y=Date.now().toString(36)+Math.random().toString(36).slice(2,8),E=(s.name||`image.${b}`).replace(/[[\]()\n\r]/g,""),g=`![Uploading ${E}\u2026](cubby-upload:${y})`,A=`${o}${h.id}/${y}.${b}`;u(g),l({name:E,path:A});try{let W=(await e.fs.write(A,s)).url||await e.fs.url(A);f(g,`![${E}](${W})`),a({name:E,path:A,url:W})}catch(O){f(g,""),c(me(O,"upload_failed"))}}function p(s){let h=Array.from(s.clipboardData?.items||[]).filter(b=>b.kind==="file"&&z[b.type]).map(b=>b.getAsFile()).filter(Boolean);if(h.length){s.preventDefault();for(let b of h)m(b)}}function w(s){s.preventDefault()}function v(s){let h=Array.from(s.dataTransfer?.files||[]).filter(b=>z[b.type]);if(h.length){s.preventDefault();for(let b of h)m(b)}}return t.addEventListener("paste",p),t.addEventListener("dragover",w),t.addEventListener("drop",v),()=>{t.removeEventListener("paste",p),t.removeEventListener("dragover",w),t.removeEventListener("drop",v)}}}import{CubbyError as pe}from"./core.esm.js";function ee(e,i){return function(n,o={}){if(typeof document>"u")throw new pe("bad_request","editor requires a DOM");_();let r=o.preview===!1?"none":o.preview==="split"?"split":"tabs",l=o.previewDebounceMs??150,a=o.onChange||(()=>{}),c=document.createElement("div");c.className="cubby-md-editor";let d=document.createElement("textarea");d.className="cubby-md-input",d.rows=o.rows||8,d.value=o.value||"",o.placeholder&&(d.placeholder=o.placeholder);let u=document.createElement("div");u.className="cubby-md-preview cubby-markdown";function f(){let s=d.value;u.innerHTML=s.trim()?I(s,{linkTarget:o.linkTarget}):'<p class="cubby-md-empty">Nothing to preview</p>'}let m=null,p=null;if(r==="tabs"){let s=document.createElement("div");s.className="cubby-md-tabs",s.setAttribute("role","tablist");let h=(y,E)=>{let g=document.createElement("button");return g.type="button",g.className="cubby-md-tab",g.setAttribute("role","tab"),g.setAttribute("aria-selected",String(E)),g.textContent=y,s.appendChild(g),g};m=h("Write",!0),p=h("Preview",!1);let b=y=>{m.setAttribute("aria-selected",String(!y)),p.setAttribute("aria-selected",String(y)),d.hidden=y,u.hidden=!y,y?f():d.focus()};m.addEventListener("click",()=>b(!1)),p.addEventListener("click",()=>b(!0)),u.hidden=!0,c.append(s,d,u)}else if(r==="split"){let s=document.createElement("div");s.className="cubby-md-split",s.append(d,u),c.appendChild(s),f()}else c.appendChild(d);let w=null;d.addEventListener("input",()=>{a(d.value),r==="split"&&(clearTimeout(w),w=setTimeout(f,l))});let v=()=>{};return o.upload!==!1&&(v=i(d,{...o.upload||{},onUploadStart:o.onUploadStart,onUpload:o.onUpload,onError:o.onError})),n.replaceChildren(c),{get value(){return d.value},set value(s){d.value=String(s),a(d.value),(r==="split"||r==="tabs"&&!u.hidden)&&f()},textarea:d,focus(){d.focus()},refresh(){f()},destroy(){clearTimeout(w),v(),c.remove()}}}}function he(e){let i=V(e);return{render:I,editor:ee(e,i),attachImageUpload:i,injectStyles:_}}var qe=he;export{he as createMarkdown,qe as default,I as render};
