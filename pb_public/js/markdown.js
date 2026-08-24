/* cubby markdown v0.1.0 (https://github.com/patsissons/cubby) */
(()=>{var k=typeof window<"u"&&window.cubby||null,C=k?.CubbyError,R=k?.toCubbyError,g=k?.escapeHtml,q=k?.sanitizeUrl,F=k?.injectStyle,P=k?.ensureTokens,ge=k?.widget;function X(e,...r){let t=[];k?.CubbyError||t.push("core.js");for(let n of r)k?.[n]||t.push(`${n}.js`);return t.length?(console.error(`[cubby] ${e} needs ${t.join(" + ")} loaded first. Tag order is core.js, platform.js, markdown.js, editor.js, then your app.js \u2014 all defer.`),null):k}var le=16,ce=/[!-/:-@[-`{-~]/,M=/[A-Za-z0-9_]/;function j(e,r,t){let n=0;for(;e[r+n]===t;)n++;return n}function z(e,r,t){let n=r;for(;n<e.length;)if(e[n]==="`"){let o=j(e,n,"`");if(o===t)return n;n+=o}else n++;return-1}function ae(e){for(;e.length;){let r=e[e.length-1];if(`.,;:!?'"`.includes(r)){e=e.slice(0,-1);continue}if(r===")"){let t=(e.match(/\(/g)||[]).length;if((e.match(/\)/g)||[]).length>t){e=e.slice(0,-1);continue}}break}return e}function de(e,r){let t=0,n=r;for(;n<e.length;){let o=e[n];if(o==="\\"){n+=2;continue}if(o==="`"){let i=j(e,n,"`"),l=z(e,n+i,i);n=l===-1?n+i:l+i;continue}if(o==="[")t++;else if(o==="]"&&(t--,t===0))return n;n++}return-1}function se(e,r){if(e[r]!=="(")return null;let t=r+1;for(;e[t]===" "||e[t]===`
`;)t++;let n="";if(e[t]==="<"){let i=e.indexOf(">",t+1);if(i===-1||(n=e.slice(t+1,i),n.includes(`
`)))return null;t=i+1}else{let i=0,l=t;for(;t<e.length;){let a=e[t];if(a==="\\"&&e[t+1]){t+=2;continue}if(/\s/.test(a))break;if(a==="(")i++;else if(a===")"){if(i===0)break;i--}t++}n=e.slice(l,t).replace(/\\([!-/:-@[-`{-~])/g,"$1")}for(;e[t]===" "||e[t]===`
`;)t++;let o="";if(e[t]==='"'||e[t]==="'"){let i=e[t],l=t+1;for(;l<e.length&&e[l]!==i;)e[l]==="\\"&&e[l+1]?(o+=e[l+1],l+=2):(o+=e[l],l++);if(l>=e.length)return null;for(t=l+1;e[t]===" "||e[t]===`
`;)t++}return e[t]!==")"?null:{href:n,title:o,end:t+1}}function K(e){let r="";for(let t of e)t.type==="text"||t.type==="code"?r+=t.text:t.type==="image"?r+=t.alt:t.children&&(r+=K(t.children));return r}function G(e,r,t,n){let o=de(e,r);if(o===-1)return null;let i=se(e,o+1);if(!i)return null;let l=e.slice(r+1,o);if(n){let c=K($(l,t+1,!0));return{node:{type:"image",src:i.href,alt:c,title:i.title},end:i.end}}let a=$(l,t+1,!0);return{node:{type:"link",href:i.href,title:i.title,children:a},end:i.end}}function U(e,r,t,n){let o=e[r+t];if(!o||/\s/.test(o))return!1;if(n==="_"){let i=e[r-1];if(i&&M.test(i))return!1}return!0}function D(e,r,t,n){let o=r;for(;o<e.length;){let i=e[o];if(i==="\\"){o+=2;continue}if(i==="`"){let l=j(e,o,"`"),a=z(e,o+l,l);o=a===-1?o+l:a+l;continue}if(i===n&&e.startsWith(t,o)){let l=e[o-1],a=j(e,o,n),c=e[o+a],d=!!l&&!/\s/.test(l),s=n!=="_"||!c||!M.test(c);if(d&&s)return o;o+=a;continue}o++}return-1}function ue(e,r,t,n,o){let i=j(e,r,t);if(t==="~"){if(i<2||!U(e,r,2,t))return null;let l=D(e,r+2,"~~",t);return l===-1||l<=r+2?null:{node:{type:"del",children:$(e.slice(r+2,l),n+1,o)},end:l+2}}if(i>=3&&U(e,r,3,t)){let l=D(e,r+3,t+t+t,t);if(l!==-1&&l>r+3)return{node:{type:"em",children:[{type:"strong",children:$(e.slice(r+3,l),n+1,o)}]},end:l+3}}if(i>=2&&U(e,r,2,t)){let l=D(e,r+2,t+t,t);if(l!==-1&&l>r+2)return{node:{type:"strong",children:$(e.slice(r+2,l),n+1,o)},end:l+2}}if(U(e,r,1,t)){let l=D(e,r+1,t,t);if(l!==-1&&l>r+1)return{node:{type:"em",children:$(e.slice(r+1,l),n+1,o)},end:l+1}}return null}function $(e,r=0,t=!1){let n=[],o="",i=0,l=()=>{o&&(n.push({type:"text",text:o}),o="")};for(;i<e.length;){let a=e[i];if(a==="\\"){let c=e[i+1];if(c===`
`){l(),n.push({type:"br"}),i+=2;continue}if(c&&ce.test(c)){o+=c,i+=2;continue}o+=a,i++;continue}if(a===`
`){/ {2}$/.test(o)?(o=o.replace(/ +$/,""),l(),n.push({type:"br"})):(o=o.replace(/ +$/,""),l(),n.push({type:"softbreak"})),i++;continue}if(a==="`"){let c=j(e,i,"`"),d=z(e,i+c,c);if(d!==-1){l();let s=e.slice(i+c,d);s.length>=2&&s[0]===" "&&s.endsWith(" ")&&s.trim()&&(s=s.slice(1,-1)),n.push({type:"code",text:s}),i=d+c;continue}o+=e.slice(i,i+c),i+=c;continue}if(a==="<"&&!t){let c=/^<(https?:\/\/[^\s<>]+|mailto:[^\s<>]+)>/i.exec(e.slice(i));if(c){l();let d=c[1],s=d.replace(/^mailto:/i,"");n.push({type:"link",href:d,title:"",children:[{type:"text",text:s}]}),i+=c[0].length;continue}o+=a,i++;continue}if((a==="h"||a==="H")&&!t&&(i===0||!M.test(e[i-1]))){let c=/^https?:\/\/[^\s<]+/i.exec(e.slice(i));if(c){let d=ae(c[0]);l(),n.push({type:"link",href:d,title:"",children:[{type:"text",text:d}]}),i+=d.length;continue}o+=a,i++;continue}if(a==="!"&&e[i+1]==="["){let c=G(e,i+1,r,!0);if(c){l(),n.push(c.node),i=c.end;continue}o+=a,i++;continue}if(a==="["&&!t){let c=G(e,i,r,!1);if(c){l(),n.push(c.node),i=c.end;continue}o+=a,i++;continue}if((a==="*"||a==="_"||a==="~")&&r<le){let c=ue(e,i,a,r,t);if(c){l(),n.push(c.node),i=c.end;continue}o+=a,i++;continue}o+=a,i++}return l(),n}function S(e,r){let t="";for(let n of e)switch(n.type){case"text":t+=g(n.text);break;case"softbreak":t+=`
`;break;case"br":t+=`<br>
`;break;case"code":t+=`<code>${g(n.text)}</code>`;break;case"em":t+=`<em>${S(n.children,r)}</em>`;break;case"strong":t+=`<strong>${S(n.children,r)}</strong>`;break;case"del":t+=`<del>${S(n.children,r)}</del>`;break;case"link":{let o=g(q(n.href)),i=n.title?` title="${g(n.title)}"`:"",l=r.linkTarget?` target="${g(r.linkTarget)}" rel="noopener noreferrer"`:"";t+=`<a href="${o}"${i}${l}>${S(n.children,r)}</a>`;break}case"image":{let o=g(q(n.src,{image:!0})),i=n.title?` title="${g(n.title)}"`:"";t+=`<img src="${o}" alt="${g(n.alt)}"${i}>`;break}}return t}function E(e,r={}){return S($(e),r)}var Y=/^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)/,Z=/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/,J=/^ {0,3}(?:(?:- *){3,}|(?:\* *){3,}|(?:_ *){3,})$/,O=/^ {0,3}>/,V=/^( *)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/,fe=/^\[( |x|X)\][ \t]+/;function L(e){let r=V.exec(e);return r?{indent:r[1].length,marker:r[2],content:r[3],ordered:be.test(r[2][0])}:null}var be=/[0-9]/;function I(e){let r=e.trim(),t=[],n="";for(let o=0;o<r.length;o++){let i=r[o];if(i==="\\"&&r[o+1]==="|"){n+="|",o++;continue}if(i==="\\"&&r[o+1]){n+=i+r[o+1],o++;continue}if(i==="|"){t.push(n),n="";continue}n+=i}return t.push(n),t.length&&r.startsWith("|")&&t[0].trim()===""&&t.shift(),t.length&&r.endsWith("|")&&t[t.length-1].trim()===""&&t.pop(),t}function ee(e){if(!e||!e.includes("-"))return!1;let r=I(e);return r.length>0&&r.every(t=>/^ *:?-+:? *$/.test(t))}function Q(e){return e?` style="text-align:${e}"`:""}function me(e,r,t){let n=e[r];if(!n.includes("|")||!ee(e[r+1]))return null;let o=I(n),i=I(e[r+1]).map(d=>{let s=d.trim(),f=s.startsWith(":"),m=s.endsWith(":");return f&&m?"center":m?"right":f?"left":""});if(!o.length||o.length!==i.length)return null;let l=`<table>
<thead>
<tr>
`;o.forEach((d,s)=>{l+=`<th${Q(i[s])}>${E(d.trim(),t)}</th>
`}),l+=`</tr>
</thead>
`;let a=r+2,c=[];for(;a<e.length&&e[a].trim()&&e[a].includes("|");)c.push(I(e[a])),a++;if(c.length){l+=`<tbody>
`;for(let d of c){l+=`<tr>
`;for(let s=0;s<o.length;s++)l+=`<td${Q(i[s])}>${E((d[s]||"").trim(),t)}</td>
`;l+=`</tr>
`}l+=`</tbody>
`}return l+=`</table>
`,{html:l,end:a}}function te(e,r,t){let n=L(e[r]),o=n.indent,i=n.ordered,l=i?parseInt(n.marker,10):1,a=[],c=r;for(;c<e.length;){let s=e[c];if(!s.trim())break;let f=L(s);if(!f||f.indent<o)break;if(f.indent>=o+2){let m=te(e,c,t);a[a.length-1].nested+=m.html,c=m.end;continue}a.push({content:f.content,nested:""}),c++}let d=i?l!==1?`<ol start="${l}">
`:`<ol>
`:`<ul>
`;for(let s of a){let f=fe.exec(s.content);if(f){let m=f[1].toLowerCase()==="x"?" checked":"",p=s.content.slice(f[0].length);d+=`<li class="task"><input type="checkbox" disabled${m}> ${E(p,t)}${s.nested}</li>
`}else d+=`<li>${E(s.content,t)}${s.nested}</li>
`}return d+=i?`</ol>
`:`</ul>
`,{html:d,end:c}}function pe(e,r){return Y.test(e)||Z.test(e)||J.test(e)||O.test(e)||V.test(e)||e.includes("|")&&ee(r)}function ne(e,r){let t="",n=0;for(;n<e.length;){let o=e[n];if(!o.trim()){n++;continue}let i=Y.exec(o);if(i){let s=i[1],f=i[2],m=[],p=n+1;for(;p<e.length;){let u=/^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(e[p]);if(u&&u[1][0]===s[0]&&u[1].length>=s.length)break;m.push(e[p]),p++}let v=f?` class="language-${g(f)}"`:"",x=m.length?g(m.join(`
`))+`
`:"";t+=`<pre><code${v}>${x}</code></pre>
`,n=p+1;continue}let l=Z.exec(o);if(l){let s=l[1].length,f=(l[2]||"").replace(/[ \t]+#+[ \t]*$/,"");t+=`<h${s}>${E(f,r)}</h${s}>
`,n++;continue}if(J.test(o)){t+=`<hr>
`,n++;continue}if(O.test(o)){let s=[];for(;n<e.length&&O.test(e[n]);)s.push(e[n].replace(/^ {0,3}> ?/,"")),n++;t+=`<blockquote>
${ne(s,r)}</blockquote>
`;continue}let a=me(e,n,r);if(a){t+=a.html,n=a.end;continue}if(L(o)){let s=te(e,n,r);t+=s.html,n=s.end;continue}let c=[o],d=n+1;for(;d<e.length&&e[d].trim()&&!pe(e[d],e[d+1]);)c.push(e[d]),d++;t+=`<p>${E(c.join(`
`),r)}</p>
`,n=d}return t}function N(e,r={}){return typeof e!="string"||!e.trim()?"":ne(e.replace(/\r\n?/g,`
`).split(`
`),r)}var he=`
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
`;function _(){P(),F("markdown",he)}var H={"image/png":"png","image/jpeg":"jpg","image/gif":"gif","image/webp":"webp"};function oe(e){return function(t,n={}){if(typeof document>"u")throw new C("bad_request","attachImageUpload requires a DOM");let o=n.pathPrefix||"uploads/",i=n.maxBytes||10*1024*1024,l=n.onUploadStart||(()=>{}),a=n.onUpload||(()=>{}),c=n.onError||(u=>console.error("[cubby] image upload failed:",u));function d(){t.dispatchEvent(new Event("input",{bubbles:!0}))}function s(u){t.setRangeText(u,t.selectionStart,t.selectionEnd,"end"),d()}function f(u,h){let b=t.value.indexOf(u);return b===-1?!1:(t.setRangeText(h,b,b+u.length,"preserve"),d(),!0)}async function m(u){let h=e.identity.user;if(!h){c(new C("auth_required","sign in to upload images"));return}if(u.size>i){c(new C("file_too_large",`image exceeds ${i} bytes`));return}let b=H[u.type],w=Date.now().toString(36)+Math.random().toString(36).slice(2,8),T=(u.name||`image.${b}`).replace(/[[\]()\n\r]/g,""),y=`![Uploading ${T}\u2026](cubby-upload:${w})`,A=`${o}${h.id}/${w}.${b}`;s(y),l({name:T,path:A});try{let B=(await e.fs.write(A,u)).url||await e.fs.url(A);f(y,`![${T}](${B})`),a({name:T,path:A,url:B})}catch(W){f(y,""),c(R(W,"upload_failed"))}}function p(u){let h=Array.from(u.clipboardData?.items||[]).filter(b=>b.kind==="file"&&H[b.type]).map(b=>b.getAsFile()).filter(Boolean);if(h.length){u.preventDefault();for(let b of h)m(b)}}function v(u){u.preventDefault()}function x(u){let h=Array.from(u.dataTransfer?.files||[]).filter(b=>H[b.type]);if(h.length){u.preventDefault();for(let b of h)m(b)}}return t.addEventListener("paste",p),t.addEventListener("dragover",v),t.addEventListener("drop",x),()=>{t.removeEventListener("paste",p),t.removeEventListener("dragover",v),t.removeEventListener("drop",x)}}}function re(e,r){return function(n,o={}){if(typeof document>"u")throw new C("bad_request","editor requires a DOM");_();let i=o.preview===!1?"none":o.preview==="split"?"split":"tabs",l=o.previewDebounceMs??150,a=o.onChange||(()=>{}),c=document.createElement("div");c.className="cubby-md-editor";let d=document.createElement("textarea");d.className="cubby-md-input",d.rows=o.rows||8,d.value=o.value||"",o.placeholder&&(d.placeholder=o.placeholder);let s=document.createElement("div");s.className="cubby-md-preview cubby-markdown";function f(){let u=d.value;s.innerHTML=u.trim()?N(u,{linkTarget:o.linkTarget}):'<p class="cubby-md-empty">Nothing to preview</p>'}let m=null,p=null;if(i==="tabs"){let u=document.createElement("div");u.className="cubby-md-tabs",u.setAttribute("role","tablist");let h=(w,T)=>{let y=document.createElement("button");return y.type="button",y.className="cubby-md-tab",y.setAttribute("role","tab"),y.setAttribute("aria-selected",String(T)),y.textContent=w,u.appendChild(y),y};m=h("Write",!0),p=h("Preview",!1);let b=w=>{m.setAttribute("aria-selected",String(!w)),p.setAttribute("aria-selected",String(w)),d.hidden=w,s.hidden=!w,w?f():d.focus()};m.addEventListener("click",()=>b(!1)),p.addEventListener("click",()=>b(!0)),s.hidden=!0,c.append(u,d,s)}else if(i==="split"){let u=document.createElement("div");u.className="cubby-md-split",u.append(d,s),c.appendChild(u),f()}else c.appendChild(d);let v=null;d.addEventListener("input",()=>{a(d.value),i==="split"&&(clearTimeout(v),v=setTimeout(f,l))});let x=()=>{};return o.upload!==!1&&(x=r(d,{...o.upload||{},onUploadStart:o.onUploadStart,onUpload:o.onUpload,onError:o.onError})),n.replaceChildren(c),{get value(){return d.value},set value(u){d.value=String(u),a(d.value),(i==="split"||i==="tabs"&&!s.hidden)&&f()},textarea:d,focus(){d.focus()},refresh(){f()},destroy(){clearTimeout(v),x(),c.remove()}}}}function ie(e){let r=oe(e);return{render:N,editor:re(e,r),attachImageUpload:r,injectStyles:_}}if(typeof window<"u"){let e=X("markdown.js");e&&(e.markdown=ie(e))}})();
