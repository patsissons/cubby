/* cubby markdown v0.1.0 (https://github.com/patsissons/cubby) */
var te={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};function g(e){return String(e).replace(/[&<>"']/g,o=>te[o])}var ne=/^[a-z][a-z0-9+.-]*:/i,oe=/[\x00-\x20\x7f]+/g;function z(e,o={}){if(typeof e!="string")return"";let t=e.replace(oe,""),n=ne.exec(t);if(!n)return t;let r=n[0].toLowerCase();return r==="http:"||r==="https:"||r==="mailto:"&&!o.image?t:""}var re=16,ie=/[!-/:-@[-`{-~]/,L=/[A-Za-z0-9_]/;function T(e,o,t){let n=0;for(;e[o+n]===t;)n++;return n}function N(e,o,t){let n=o;for(;n<e.length;)if(e[n]==="`"){let r=T(e,n,"`");if(r===t)return n;n+=r}else n++;return-1}function le(e){for(;e.length;){let o=e[e.length-1];if(`.,;:!?'"`.includes(o)){e=e.slice(0,-1);continue}if(o===")"){let t=(e.match(/\(/g)||[]).length;if((e.match(/\)/g)||[]).length>t){e=e.slice(0,-1);continue}}break}return e}function ce(e,o){let t=0,n=o;for(;n<e.length;){let r=e[n];if(r==="\\"){n+=2;continue}if(r==="`"){let i=T(e,n,"`"),l=N(e,n+i,i);n=l===-1?n+i:l+i;continue}if(r==="[")t++;else if(r==="]"&&(t--,t===0))return n;n++}return-1}function ae(e,o){if(e[o]!=="(")return null;let t=o+1;for(;e[t]===" "||e[t]===`
`;)t++;let n="";if(e[t]==="<"){let i=e.indexOf(">",t+1);if(i===-1||(n=e.slice(t+1,i),n.includes(`
`)))return null;t=i+1}else{let i=0,l=t;for(;t<e.length;){let a=e[t];if(a==="\\"&&e[t+1]){t+=2;continue}if(/\s/.test(a))break;if(a==="(")i++;else if(a===")"){if(i===0)break;i--}t++}n=e.slice(l,t).replace(/\\([!-/:-@[-`{-~])/g,"$1")}for(;e[t]===" "||e[t]===`
`;)t++;let r="";if(e[t]==='"'||e[t]==="'"){let i=e[t],l=t+1;for(;l<e.length&&e[l]!==i;)e[l]==="\\"&&e[l+1]?(r+=e[l+1],l+=2):(r+=e[l],l++);if(l>=e.length)return null;for(t=l+1;e[t]===" "||e[t]===`
`;)t++}return e[t]!==")"?null:{href:n,title:r,end:t+1}}function B(e){let o="";for(let t of e)t.type==="text"||t.type==="code"?o+=t.text:t.type==="image"?o+=t.alt:t.children&&(o+=B(t.children));return o}function W(e,o,t,n){let r=ce(e,o);if(r===-1)return null;let i=ae(e,r+1);if(!i)return null;let l=e.slice(o+1,r);if(n){let c=B($(l,t+1,!0));return{node:{type:"image",src:i.href,alt:c,title:i.title},end:i.end}}let a=$(l,t+1,!0);return{node:{type:"link",href:i.href,title:i.title,children:a},end:i.end}}function U(e,o,t,n){let r=e[o+t];if(!r||/\s/.test(r))return!1;if(n==="_"){let i=e[o-1];if(i&&L.test(i))return!1}return!0}function I(e,o,t,n){let r=o;for(;r<e.length;){let i=e[r];if(i==="\\"){r+=2;continue}if(i==="`"){let l=T(e,r,"`"),a=N(e,r+l,l);r=a===-1?r+l:a+l;continue}if(i===n&&e.startsWith(t,r)){let l=e[r-1],a=T(e,r,n),c=e[r+a],s=!!l&&!/\s/.test(l),d=n!=="_"||!c||!L.test(c);if(s&&d)return r;r+=a;continue}r++}return-1}function se(e,o,t,n,r){let i=T(e,o,t);if(t==="~"){if(i<2||!U(e,o,2,t))return null;let l=I(e,o+2,"~~",t);return l===-1||l<=o+2?null:{node:{type:"del",children:$(e.slice(o+2,l),n+1,r)},end:l+2}}if(i>=3&&U(e,o,3,t)){let l=I(e,o+3,t+t+t,t);if(l!==-1&&l>o+3)return{node:{type:"em",children:[{type:"strong",children:$(e.slice(o+3,l),n+1,r)}]},end:l+3}}if(i>=2&&U(e,o,2,t)){let l=I(e,o+2,t+t,t);if(l!==-1&&l>o+2)return{node:{type:"strong",children:$(e.slice(o+2,l),n+1,r)},end:l+2}}if(U(e,o,1,t)){let l=I(e,o+1,t,t);if(l!==-1&&l>o+1)return{node:{type:"em",children:$(e.slice(o+1,l),n+1,r)},end:l+1}}return null}function $(e,o=0,t=!1){let n=[],r="",i=0,l=()=>{r&&(n.push({type:"text",text:r}),r="")};for(;i<e.length;){let a=e[i];if(a==="\\"){let c=e[i+1];if(c===`
`){l(),n.push({type:"br"}),i+=2;continue}if(c&&ie.test(c)){r+=c,i+=2;continue}r+=a,i++;continue}if(a===`
`){/ {2}$/.test(r)?(r=r.replace(/ +$/,""),l(),n.push({type:"br"})):(r=r.replace(/ +$/,""),l(),n.push({type:"softbreak"})),i++;continue}if(a==="`"){let c=T(e,i,"`"),s=N(e,i+c,c);if(s!==-1){l();let d=e.slice(i+c,s);d.length>=2&&d[0]===" "&&d.endsWith(" ")&&d.trim()&&(d=d.slice(1,-1)),n.push({type:"code",text:d}),i=s+c;continue}r+=e.slice(i,i+c),i+=c;continue}if(a==="<"&&!t){let c=/^<(https?:\/\/[^\s<>]+|mailto:[^\s<>]+)>/i.exec(e.slice(i));if(c){l();let s=c[1],d=s.replace(/^mailto:/i,"");n.push({type:"link",href:s,title:"",children:[{type:"text",text:d}]}),i+=c[0].length;continue}r+=a,i++;continue}if((a==="h"||a==="H")&&!t&&(i===0||!L.test(e[i-1]))){let c=/^https?:\/\/[^\s<]+/i.exec(e.slice(i));if(c){let s=le(c[0]);l(),n.push({type:"link",href:s,title:"",children:[{type:"text",text:s}]}),i+=s.length;continue}r+=a,i++;continue}if(a==="!"&&e[i+1]==="["){let c=W(e,i+1,o,!0);if(c){l(),n.push(c.node),i=c.end;continue}r+=a,i++;continue}if(a==="["&&!t){let c=W(e,i,o,!1);if(c){l(),n.push(c.node),i=c.end;continue}r+=a,i++;continue}if((a==="*"||a==="_"||a==="~")&&o<re){let c=se(e,i,a,o,t);if(c){l(),n.push(c.node),i=c.end;continue}r+=a,i++;continue}r+=a,i++}return l(),n}function C(e,o){let t="";for(let n of e)switch(n.type){case"text":t+=g(n.text);break;case"softbreak":t+=`
`;break;case"br":t+=`<br>
`;break;case"code":t+=`<code>${g(n.text)}</code>`;break;case"em":t+=`<em>${C(n.children,o)}</em>`;break;case"strong":t+=`<strong>${C(n.children,o)}</strong>`;break;case"del":t+=`<del>${C(n.children,o)}</del>`;break;case"link":{let r=g(z(n.href)),i=n.title?` title="${g(n.title)}"`:"",l=o.linkTarget?` target="${g(o.linkTarget)}" rel="noopener noreferrer"`:"";t+=`<a href="${r}"${i}${l}>${C(n.children,o)}</a>`;break}case"image":{let r=g(z(n.src,{image:!0})),i=n.title?` title="${g(n.title)}"`:"";t+=`<img src="${r}" alt="${g(n.alt)}"${i}>`;break}}return t}function E(e,o={}){return C($(e),o)}var P=/^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)/,X=/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/,G=/^ {0,3}(?:(?:- *){3,}|(?:\* *){3,}|(?:_ *){3,})$/,j=/^ {0,3}>/,K=/^( *)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/,de=/^\[( |x|X)\][ \t]+/;function M(e){let o=K.exec(e);return o?{indent:o[1].length,marker:o[2],content:o[3],ordered:ue.test(o[2][0])}:null}var ue=/[0-9]/;function D(e){let o=e.trim(),t=[],n="";for(let r=0;r<o.length;r++){let i=o[r];if(i==="\\"&&o[r+1]==="|"){n+="|",r++;continue}if(i==="\\"&&o[r+1]){n+=i+o[r+1],r++;continue}if(i==="|"){t.push(n),n="";continue}n+=i}return t.push(n),t.length&&o.startsWith("|")&&t[0].trim()===""&&t.shift(),t.length&&o.endsWith("|")&&t[t.length-1].trim()===""&&t.pop(),t}function Q(e){if(!e||!e.includes("-"))return!1;let o=D(e);return o.length>0&&o.every(t=>/^ *:?-+:? *$/.test(t))}function F(e){return e?` style="text-align:${e}"`:""}function fe(e,o,t){let n=e[o];if(!n.includes("|")||!Q(e[o+1]))return null;let r=D(n),i=D(e[o+1]).map(s=>{let d=s.trim(),f=d.startsWith(":"),m=d.endsWith(":");return f&&m?"center":m?"right":f?"left":""});if(!r.length||r.length!==i.length)return null;let l=`<table>
<thead>
<tr>
`;r.forEach((s,d)=>{l+=`<th${F(i[d])}>${E(s.trim(),t)}</th>
`}),l+=`</tr>
</thead>
`;let a=o+2,c=[];for(;a<e.length&&e[a].trim()&&e[a].includes("|");)c.push(D(e[a])),a++;if(c.length){l+=`<tbody>
`;for(let s of c){l+=`<tr>
`;for(let d=0;d<r.length;d++)l+=`<td${F(i[d])}>${E((s[d]||"").trim(),t)}</td>
`;l+=`</tr>
`}l+=`</tbody>
`}return l+=`</table>
`,{html:l,end:a}}function Y(e,o,t){let n=M(e[o]),r=n.indent,i=n.ordered,l=i?parseInt(n.marker,10):1,a=[],c=o;for(;c<e.length;){let d=e[c];if(!d.trim())break;let f=M(d);if(!f||f.indent<r)break;if(f.indent>=r+2){let m=Y(e,c,t);a[a.length-1].nested+=m.html,c=m.end;continue}a.push({content:f.content,nested:""}),c++}let s=i?l!==1?`<ol start="${l}">
`:`<ol>
`:`<ul>
`;for(let d of a){let f=de.exec(d.content);if(f){let m=f[1].toLowerCase()==="x"?" checked":"",p=d.content.slice(f[0].length);s+=`<li class="task"><input type="checkbox" disabled${m}> ${E(p,t)}${d.nested}</li>
`}else s+=`<li>${E(d.content,t)}${d.nested}</li>
`}return s+=i?`</ol>
`:`</ul>
`,{html:s,end:c}}function be(e,o){return P.test(e)||X.test(e)||G.test(e)||j.test(e)||K.test(e)||e.includes("|")&&Q(o)}function Z(e,o){let t="",n=0;for(;n<e.length;){let r=e[n];if(!r.trim()){n++;continue}let i=P.exec(r);if(i){let d=i[1],f=i[2],m=[],p=n+1;for(;p<e.length;){let u=/^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(e[p]);if(u&&u[1][0]===d[0]&&u[1].length>=d.length)break;m.push(e[p]),p++}let v=f?` class="language-${g(f)}"`:"",x=m.length?g(m.join(`
`))+`
`:"";t+=`<pre><code${v}>${x}</code></pre>
`,n=p+1;continue}let l=X.exec(r);if(l){let d=l[1].length,f=(l[2]||"").replace(/[ \t]+#+[ \t]*$/,"");t+=`<h${d}>${E(f,o)}</h${d}>
`,n++;continue}if(G.test(r)){t+=`<hr>
`,n++;continue}if(j.test(r)){let d=[];for(;n<e.length&&j.test(e[n]);)d.push(e[n].replace(/^ {0,3}> ?/,"")),n++;t+=`<blockquote>
${Z(d,o)}</blockquote>
`;continue}let a=fe(e,n,o);if(a){t+=a.html,n=a.end;continue}if(M(r)){let d=Y(e,n,o);t+=d.html,n=d.end;continue}let c=[r],s=n+1;for(;s<e.length&&e[s].trim()&&!be(e[s],e[s+1]);)c.push(e[s]),s++;t+=`<p>${E(c.join(`
`),o)}</p>
`,n=s}return t}function _(e,o={}){return typeof e!="string"||!e.trim()?"":Z(e.replace(/\r\n?/g,`
`).split(`
`),o)}var me=`
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
`;function q(){if(typeof document>"u"||document.querySelector("style[data-cubby-markdown]"))return;let e=document.createElement("style");e.setAttribute("data-cubby-markdown",""),e.textContent=me,document.head.appendChild(e)}var y=class extends Error{constructor(o,t,n={}){super(t||o),this.name="CubbyError",this.code=o,n.status&&(this.status=n.status),n.cause&&(this.cause=n.cause)}};function J(e,o="unknown"){if(e instanceof y)return e;let t=e&&typeof e=="object"&&"status"in e?e.status:void 0;return t===401||t===403?new y("auth_required",String(e?.message||e),{cause:e,status:t}):t===404?new y("not_found",String(e?.message||e),{cause:e,status:t}):new y(o,String(e?.message||e),{cause:e,status:t})}var O={"image/png":"png","image/jpeg":"jpg","image/gif":"gif","image/webp":"webp"};function V(e){return function(t,n={}){if(typeof document>"u")throw new y("bad_request","attachImageUpload requires a DOM");let r=n.pathPrefix||"uploads/",i=n.maxBytes||10*1024*1024,l=n.onUploadStart||(()=>{}),a=n.onUpload||(()=>{}),c=n.onError||(u=>console.error("[cubby] image upload failed:",u));function s(){t.dispatchEvent(new Event("input",{bubbles:!0}))}function d(u){t.setRangeText(u,t.selectionStart,t.selectionEnd,"end"),s()}function f(u,h){let b=t.value.indexOf(u);return b===-1?!1:(t.setRangeText(h,b,b+u.length,"preserve"),s(),!0)}async function m(u){let h=e.identity.user;if(!h){c(new y("auth_required","sign in to upload images"));return}if(u.size>i){c(new y("file_too_large",`image exceeds ${i} bytes`));return}let b=O[u.type],k=Date.now().toString(36)+Math.random().toString(36).slice(2,8),S=(u.name||`image.${b}`).replace(/[[\]()\n\r]/g,""),w=`![Uploading ${S}\u2026](cubby-upload:${k})`,A=`${r}${h.id}/${k}.${b}`;d(w),l({name:S,path:A});try{let R=(await e.fs.write(A,u)).url||await e.fs.url(A);f(w,`![${S}](${R})`),a({name:S,path:A,url:R})}catch(H){f(w,""),c(J(H,"upload_failed"))}}function p(u){let h=Array.from(u.clipboardData?.items||[]).filter(b=>b.kind==="file"&&O[b.type]).map(b=>b.getAsFile()).filter(Boolean);if(h.length){u.preventDefault();for(let b of h)m(b)}}function v(u){u.preventDefault()}function x(u){let h=Array.from(u.dataTransfer?.files||[]).filter(b=>O[b.type]);if(h.length){u.preventDefault();for(let b of h)m(b)}}return t.addEventListener("paste",p),t.addEventListener("dragover",v),t.addEventListener("drop",x),()=>{t.removeEventListener("paste",p),t.removeEventListener("dragover",v),t.removeEventListener("drop",x)}}}function ee(e,o){return function(n,r={}){if(typeof document>"u")throw new y("bad_request","editor requires a DOM");q();let i=r.preview===!1?"none":r.preview==="split"?"split":"tabs",l=r.previewDebounceMs??150,a=r.onChange||(()=>{}),c=document.createElement("div");c.className="cubby-md-editor";let s=document.createElement("textarea");s.className="cubby-md-input",s.rows=r.rows||8,s.value=r.value||"",r.placeholder&&(s.placeholder=r.placeholder);let d=document.createElement("div");d.className="cubby-md-preview cubby-markdown";function f(){let u=s.value;d.innerHTML=u.trim()?_(u,{linkTarget:r.linkTarget}):'<p class="cubby-md-empty">Nothing to preview</p>'}let m=null,p=null;if(i==="tabs"){let u=document.createElement("div");u.className="cubby-md-tabs",u.setAttribute("role","tablist");let h=(k,S)=>{let w=document.createElement("button");return w.type="button",w.className="cubby-md-tab",w.setAttribute("role","tab"),w.setAttribute("aria-selected",String(S)),w.textContent=k,u.appendChild(w),w};m=h("Write",!0),p=h("Preview",!1);let b=k=>{m.setAttribute("aria-selected",String(!k)),p.setAttribute("aria-selected",String(k)),s.hidden=k,d.hidden=!k,k?f():s.focus()};m.addEventListener("click",()=>b(!1)),p.addEventListener("click",()=>b(!0)),d.hidden=!0,c.append(u,s,d)}else if(i==="split"){let u=document.createElement("div");u.className="cubby-md-split",u.append(s,d),c.appendChild(u),f()}else c.appendChild(s);let v=null;s.addEventListener("input",()=>{a(s.value),i==="split"&&(clearTimeout(v),v=setTimeout(f,l))});let x=()=>{};return r.upload!==!1&&(x=o(s,{...r.upload||{},onUploadStart:r.onUploadStart,onUpload:r.onUpload,onError:r.onError})),n.replaceChildren(c),{get value(){return s.value},set value(u){s.value=String(u),a(s.value),(i==="split"||i==="tabs"&&!d.hidden)&&f()},textarea:s,focus(){s.focus()},refresh(){f()},destroy(){clearTimeout(v),x(),c.remove()}}}}function pe(e){let o=V(e);return{render:_,editor:ee(e,o),attachImageUpload:o,injectStyles:q}}var ze=pe;export{pe as createMarkdown,ze as default,_ as render};
