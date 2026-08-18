/* cubby markdown v0.1.0 (https://github.com/patsissons/cubby) */
(()=>{var ne={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};function g(e){return String(e).replace(/[&<>"']/g,o=>ne[o])}var oe=/^[a-z][a-z0-9+.-]*:/i,re=/[\x00-\x20\x7f]+/g;function j(e,o={}){if(typeof e!="string")return"";let t=e.replace(re,""),n=oe.exec(t);if(!n)return t;let r=n[0].toLowerCase();return r==="http:"||r==="https:"||r==="mailto:"&&!o.image?t:""}var ie=16,ce=/[!-/:-@[-`{-~]/,z=/[A-Za-z0-9_]/;function T(e,o,t){let n=0;for(;e[o+n]===t;)n++;return n}function L(e,o,t){let n=o;for(;n<e.length;)if(e[n]==="`"){let r=T(e,n,"`");if(r===t)return n;n+=r}else n++;return-1}function le(e){for(;e.length;){let o=e[e.length-1];if(`.,;:!?'"`.includes(o)){e=e.slice(0,-1);continue}if(o===")"){let t=(e.match(/\(/g)||[]).length;if((e.match(/\)/g)||[]).length>t){e=e.slice(0,-1);continue}}break}return e}function ae(e,o){let t=0,n=o;for(;n<e.length;){let r=e[n];if(r==="\\"){n+=2;continue}if(r==="`"){let i=T(e,n,"`"),c=L(e,n+i,i);n=c===-1?n+i:c+i;continue}if(r==="[")t++;else if(r==="]"&&(t--,t===0))return n;n++}return-1}function de(e,o){if(e[o]!=="(")return null;let t=o+1;for(;e[t]===" "||e[t]===`
`;)t++;let n="";if(e[t]==="<"){let i=e.indexOf(">",t+1);if(i===-1||(n=e.slice(t+1,i),n.includes(`
`)))return null;t=i+1}else{let i=0,c=t;for(;t<e.length;){let a=e[t];if(a==="\\"&&e[t+1]){t+=2;continue}if(/\s/.test(a))break;if(a==="(")i++;else if(a===")"){if(i===0)break;i--}t++}n=e.slice(c,t).replace(/\\([!-/:-@[-`{-~])/g,"$1")}for(;e[t]===" "||e[t]===`
`;)t++;let r="";if(e[t]==='"'||e[t]==="'"){let i=e[t],c=t+1;for(;c<e.length&&e[c]!==i;)e[c]==="\\"&&e[c+1]?(r+=e[c+1],c+=2):(r+=e[c],c++);if(c>=e.length)return null;for(t=c+1;e[t]===" "||e[t]===`
`;)t++}return e[t]!==")"?null:{href:n,title:r,end:t+1}}function B(e){let o="";for(let t of e)t.type==="text"||t.type==="code"?o+=t.text:t.type==="image"?o+=t.alt:t.children&&(o+=B(t.children));return o}function W(e,o,t,n){let r=ae(e,o);if(r===-1)return null;let i=de(e,r+1);if(!i)return null;let c=e.slice(o+1,r);if(n){let l=B($(c,t+1,!0));return{node:{type:"image",src:i.href,alt:l,title:i.title},end:i.end}}let a=$(c,t+1,!0);return{node:{type:"link",href:i.href,title:i.title,children:a},end:i.end}}function U(e,o,t,n){let r=e[o+t];if(!r||/\s/.test(r))return!1;if(n==="_"){let i=e[o-1];if(i&&z.test(i))return!1}return!0}function I(e,o,t,n){let r=o;for(;r<e.length;){let i=e[r];if(i==="\\"){r+=2;continue}if(i==="`"){let c=T(e,r,"`"),a=L(e,r+c,c);r=a===-1?r+c:a+c;continue}if(i===n&&e.startsWith(t,r)){let c=e[r-1],a=T(e,r,n),l=e[r+a],d=!!c&&!/\s/.test(c),s=n!=="_"||!l||!z.test(l);if(d&&s)return r;r+=a;continue}r++}return-1}function se(e,o,t,n,r){let i=T(e,o,t);if(t==="~"){if(i<2||!U(e,o,2,t))return null;let c=I(e,o+2,"~~",t);return c===-1||c<=o+2?null:{node:{type:"del",children:$(e.slice(o+2,c),n+1,r)},end:c+2}}if(i>=3&&U(e,o,3,t)){let c=I(e,o+3,t+t+t,t);if(c!==-1&&c>o+3)return{node:{type:"em",children:[{type:"strong",children:$(e.slice(o+3,c),n+1,r)}]},end:c+3}}if(i>=2&&U(e,o,2,t)){let c=I(e,o+2,t+t,t);if(c!==-1&&c>o+2)return{node:{type:"strong",children:$(e.slice(o+2,c),n+1,r)},end:c+2}}if(U(e,o,1,t)){let c=I(e,o+1,t,t);if(c!==-1&&c>o+1)return{node:{type:"em",children:$(e.slice(o+1,c),n+1,r)},end:c+1}}return null}function $(e,o=0,t=!1){let n=[],r="",i=0,c=()=>{r&&(n.push({type:"text",text:r}),r="")};for(;i<e.length;){let a=e[i];if(a==="\\"){let l=e[i+1];if(l===`
`){c(),n.push({type:"br"}),i+=2;continue}if(l&&ce.test(l)){r+=l,i+=2;continue}r+=a,i++;continue}if(a===`
`){/ {2}$/.test(r)?(r=r.replace(/ +$/,""),c(),n.push({type:"br"})):(r=r.replace(/ +$/,""),c(),n.push({type:"softbreak"})),i++;continue}if(a==="`"){let l=T(e,i,"`"),d=L(e,i+l,l);if(d!==-1){c();let s=e.slice(i+l,d);s.length>=2&&s[0]===" "&&s.endsWith(" ")&&s.trim()&&(s=s.slice(1,-1)),n.push({type:"code",text:s}),i=d+l;continue}r+=e.slice(i,i+l),i+=l;continue}if(a==="<"&&!t){let l=/^<(https?:\/\/[^\s<>]+|mailto:[^\s<>]+)>/i.exec(e.slice(i));if(l){c();let d=l[1],s=d.replace(/^mailto:/i,"");n.push({type:"link",href:d,title:"",children:[{type:"text",text:s}]}),i+=l[0].length;continue}r+=a,i++;continue}if((a==="h"||a==="H")&&!t&&(i===0||!z.test(e[i-1]))){let l=/^https?:\/\/[^\s<]+/i.exec(e.slice(i));if(l){let d=le(l[0]);c(),n.push({type:"link",href:d,title:"",children:[{type:"text",text:d}]}),i+=d.length;continue}r+=a,i++;continue}if(a==="!"&&e[i+1]==="["){let l=W(e,i+1,o,!0);if(l){c(),n.push(l.node),i=l.end;continue}r+=a,i++;continue}if(a==="["&&!t){let l=W(e,i,o,!1);if(l){c(),n.push(l.node),i=l.end;continue}r+=a,i++;continue}if((a==="*"||a==="_"||a==="~")&&o<ie){let l=se(e,i,a,o,t);if(l){c(),n.push(l.node),i=l.end;continue}r+=a,i++;continue}r+=a,i++}return c(),n}function C(e,o){let t="";for(let n of e)switch(n.type){case"text":t+=g(n.text);break;case"softbreak":t+=`
`;break;case"br":t+=`<br>
`;break;case"code":t+=`<code>${g(n.text)}</code>`;break;case"em":t+=`<em>${C(n.children,o)}</em>`;break;case"strong":t+=`<strong>${C(n.children,o)}</strong>`;break;case"del":t+=`<del>${C(n.children,o)}</del>`;break;case"link":{let r=g(j(n.href)),i=n.title?` title="${g(n.title)}"`:"",c=o.linkTarget?` target="${g(o.linkTarget)}" rel="noopener noreferrer"`:"";t+=`<a href="${r}"${i}${c}>${C(n.children,o)}</a>`;break}case"image":{let r=g(j(n.src,{image:!0})),i=n.title?` title="${g(n.title)}"`:"";t+=`<img src="${r}" alt="${g(n.alt)}"${i}>`;break}}return t}function E(e,o={}){return C($(e),o)}var P=/^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)/,X=/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/,G=/^ {0,3}(?:(?:- *){3,}|(?:\* *){3,}|(?:_ *){3,})$/,M=/^ {0,3}>/,K=/^( *)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/,ue=/^\[( |x|X)\][ \t]+/;function N(e){let o=K.exec(e);return o?{indent:o[1].length,marker:o[2],content:o[3],ordered:fe.test(o[2][0])}:null}var fe=/[0-9]/;function D(e){let o=e.trim(),t=[],n="";for(let r=0;r<o.length;r++){let i=o[r];if(i==="\\"&&o[r+1]==="|"){n+="|",r++;continue}if(i==="\\"&&o[r+1]){n+=i+o[r+1],r++;continue}if(i==="|"){t.push(n),n="";continue}n+=i}return t.push(n),t.length&&o.startsWith("|")&&t[0].trim()===""&&t.shift(),t.length&&o.endsWith("|")&&t[t.length-1].trim()===""&&t.pop(),t}function Q(e){if(!e||!e.includes("-"))return!1;let o=D(e);return o.length>0&&o.every(t=>/^ *:?-+:? *$/.test(t))}function F(e){return e?` style="text-align:${e}"`:""}function be(e,o,t){let n=e[o];if(!n.includes("|")||!Q(e[o+1]))return null;let r=D(n),i=D(e[o+1]).map(d=>{let s=d.trim(),f=s.startsWith(":"),m=s.endsWith(":");return f&&m?"center":m?"right":f?"left":""});if(!r.length||r.length!==i.length)return null;let c=`<table>
<thead>
<tr>
`;r.forEach((d,s)=>{c+=`<th${F(i[s])}>${E(d.trim(),t)}</th>
`}),c+=`</tr>
</thead>
`;let a=o+2,l=[];for(;a<e.length&&e[a].trim()&&e[a].includes("|");)l.push(D(e[a])),a++;if(l.length){c+=`<tbody>
`;for(let d of l){c+=`<tr>
`;for(let s=0;s<r.length;s++)c+=`<td${F(i[s])}>${E((d[s]||"").trim(),t)}</td>
`;c+=`</tr>
`}c+=`</tbody>
`}return c+=`</table>
`,{html:c,end:a}}function Y(e,o,t){let n=N(e[o]),r=n.indent,i=n.ordered,c=i?parseInt(n.marker,10):1,a=[],l=o;for(;l<e.length;){let s=e[l];if(!s.trim())break;let f=N(s);if(!f||f.indent<r)break;if(f.indent>=r+2){let m=Y(e,l,t);a[a.length-1].nested+=m.html,l=m.end;continue}a.push({content:f.content,nested:""}),l++}let d=i?c!==1?`<ol start="${c}">
`:`<ol>
`:`<ul>
`;for(let s of a){let f=ue.exec(s.content);if(f){let m=f[1].toLowerCase()==="x"?" checked":"",p=s.content.slice(f[0].length);d+=`<li class="task"><input type="checkbox" disabled${m}> ${E(p,t)}${s.nested}</li>
`}else d+=`<li>${E(s.content,t)}${s.nested}</li>
`}return d+=i?`</ol>
`:`</ul>
`,{html:d,end:l}}function me(e,o){return P.test(e)||X.test(e)||G.test(e)||M.test(e)||K.test(e)||e.includes("|")&&Q(o)}function Z(e,o){let t="",n=0;for(;n<e.length;){let r=e[n];if(!r.trim()){n++;continue}let i=P.exec(r);if(i){let s=i[1],f=i[2],m=[],p=n+1;for(;p<e.length;){let u=/^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(e[p]);if(u&&u[1][0]===s[0]&&u[1].length>=s.length)break;m.push(e[p]),p++}let v=f?` class="language-${g(f)}"`:"",x=m.length?g(m.join(`
`))+`
`:"";t+=`<pre><code${v}>${x}</code></pre>
`,n=p+1;continue}let c=X.exec(r);if(c){let s=c[1].length,f=(c[2]||"").replace(/[ \t]+#+[ \t]*$/,"");t+=`<h${s}>${E(f,o)}</h${s}>
`,n++;continue}if(G.test(r)){t+=`<hr>
`,n++;continue}if(M.test(r)){let s=[];for(;n<e.length&&M.test(e[n]);)s.push(e[n].replace(/^ {0,3}> ?/,"")),n++;t+=`<blockquote>
${Z(s,o)}</blockquote>
`;continue}let a=be(e,n,o);if(a){t+=a.html,n=a.end;continue}if(N(r)){let s=Y(e,n,o);t+=s.html,n=s.end;continue}let l=[r],d=n+1;for(;d<e.length&&e[d].trim()&&!me(e[d],e[d+1]);)l.push(e[d]),d++;t+=`<p>${E(l.join(`
`),o)}</p>
`,n=d}return t}function q(e,o={}){return typeof e!="string"||!e.trim()?"":Z(e.replace(/\r\n?/g,`
`).split(`
`),o)}var pe=`
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
`;function _(){if(typeof document>"u"||document.querySelector("style[data-cubby-markdown]"))return;let e=document.createElement("style");e.setAttribute("data-cubby-markdown",""),e.textContent=pe,document.head.appendChild(e)}var y=class extends Error{constructor(o,t,n={}){super(t||o),this.name="CubbyError",this.code=o,n.status&&(this.status=n.status),n.cause&&(this.cause=n.cause)}};function J(e,o="unknown"){if(e instanceof y)return e;let t=e&&typeof e=="object"&&"status"in e?e.status:void 0;return t===401||t===403?new y("auth_required",String(e?.message||e),{cause:e,status:t}):t===404?new y("not_found",String(e?.message||e),{cause:e,status:t}):new y(o,String(e?.message||e),{cause:e,status:t})}var O={"image/png":"png","image/jpeg":"jpg","image/gif":"gif","image/webp":"webp"};function V(e){return function(t,n={}){if(typeof document>"u")throw new y("bad_request","attachImageUpload requires a DOM");let r=n.pathPrefix||"uploads/",i=n.maxBytes||10*1024*1024,c=n.onUploadStart||(()=>{}),a=n.onUpload||(()=>{}),l=n.onError||(u=>console.error("[cubby] image upload failed:",u));function d(){t.dispatchEvent(new Event("input",{bubbles:!0}))}function s(u){t.setRangeText(u,t.selectionStart,t.selectionEnd,"end"),d()}function f(u,h){let b=t.value.indexOf(u);return b===-1?!1:(t.setRangeText(h,b,b+u.length,"preserve"),d(),!0)}async function m(u){let h=e.identity.user;if(!h){l(new y("auth_required","sign in to upload images"));return}if(u.size>i){l(new y("file_too_large",`image exceeds ${i} bytes`));return}let b=O[u.type],k=Date.now().toString(36)+Math.random().toString(36).slice(2,8),S=(u.name||`image.${b}`).replace(/[[\]()\n\r]/g,""),w=`![Uploading ${S}\u2026](cubby-upload:${k})`,A=`${r}${h.id}/${k}.${b}`;s(w),c({name:S,path:A});try{let R=(await e.fs.write(A,u)).url||await e.fs.url(A);f(w,`![${S}](${R})`),a({name:S,path:A,url:R})}catch(H){f(w,""),l(J(H,"upload_failed"))}}function p(u){let h=Array.from(u.clipboardData?.items||[]).filter(b=>b.kind==="file"&&O[b.type]).map(b=>b.getAsFile()).filter(Boolean);if(h.length){u.preventDefault();for(let b of h)m(b)}}function v(u){u.preventDefault()}function x(u){let h=Array.from(u.dataTransfer?.files||[]).filter(b=>O[b.type]);if(h.length){u.preventDefault();for(let b of h)m(b)}}return t.addEventListener("paste",p),t.addEventListener("dragover",v),t.addEventListener("drop",x),()=>{t.removeEventListener("paste",p),t.removeEventListener("dragover",v),t.removeEventListener("drop",x)}}}function ee(e,o){return function(n,r={}){if(typeof document>"u")throw new y("bad_request","editor requires a DOM");_();let i=r.preview===!1?"none":r.preview==="split"?"split":"tabs",c=r.previewDebounceMs??150,a=r.onChange||(()=>{}),l=document.createElement("div");l.className="cubby-md-editor";let d=document.createElement("textarea");d.className="cubby-md-input",d.rows=r.rows||8,d.value=r.value||"",r.placeholder&&(d.placeholder=r.placeholder);let s=document.createElement("div");s.className="cubby-md-preview cubby-markdown";function f(){let u=d.value;s.innerHTML=u.trim()?q(u,{linkTarget:r.linkTarget}):'<p class="cubby-md-empty">Nothing to preview</p>'}let m=null,p=null;if(i==="tabs"){let u=document.createElement("div");u.className="cubby-md-tabs",u.setAttribute("role","tablist");let h=(k,S)=>{let w=document.createElement("button");return w.type="button",w.className="cubby-md-tab",w.setAttribute("role","tab"),w.setAttribute("aria-selected",String(S)),w.textContent=k,u.appendChild(w),w};m=h("Write",!0),p=h("Preview",!1);let b=k=>{m.setAttribute("aria-selected",String(!k)),p.setAttribute("aria-selected",String(k)),d.hidden=k,s.hidden=!k,k?f():d.focus()};m.addEventListener("click",()=>b(!1)),p.addEventListener("click",()=>b(!0)),s.hidden=!0,l.append(u,d,s)}else if(i==="split"){let u=document.createElement("div");u.className="cubby-md-split",u.append(d,s),l.appendChild(u),f()}else l.appendChild(d);let v=null;d.addEventListener("input",()=>{a(d.value),i==="split"&&(clearTimeout(v),v=setTimeout(f,c))});let x=()=>{};return r.upload!==!1&&(x=o(d,{...r.upload||{},onUploadStart:r.onUploadStart,onUpload:r.onUpload,onError:r.onError})),n.replaceChildren(l),{get value(){return d.value},set value(u){d.value=String(u),a(d.value),(i==="split"||i==="tabs"&&!s.hidden)&&f()},textarea:d,focus(){d.focus()},refresh(){f()},destroy(){clearTimeout(v),x(),l.remove()}}}}function te(e){let o=V(e);return{render:q,editor:ee(e,o),attachImageUpload:o,injectStyles:_}}typeof window<"u"&&(window.cubby?window.cubby.markdown=te(window.cubby):console.error("[cubby] markdown.js requires foundation.js to load first (both defer, foundation before markdown)"));})();
