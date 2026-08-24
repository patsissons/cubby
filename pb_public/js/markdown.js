/* cubby markdown v0.1.0 (https://github.com/patsissons/cubby) */
(()=>{var k=typeof window<"u"&&window.cubby||null,$=k?.CubbyError,B=k?.toCubbyError,w=k?.escapeHtml,_=k?.sanitizeUrl,L=k?.injectStyle,R=k?.ensureTokens,P=k?.widget;function F(e,...r){let t=[];k?.CubbyError||t.push("core.js");for(let n of r)k?.[n]||t.push(`${n}.js`);return t.length?(console.error(`[cubby] ${e} needs ${t.join(" + ")} loaded first. Tag order is core.js, platform.js, markdown.js, editor.js, then your app.js \u2014 all defer.`),null):k}var ce=16,ae=/[!-/:-@[-`{-~]/,q=/[A-Za-z0-9_]/;function j(e,r,t){let n=0;for(;e[r+n]===t;)n++;return n}function N(e,r,t){let n=r;for(;n<e.length;)if(e[n]==="`"){let o=j(e,n,"`");if(o===t)return n;n+=o}else n++;return-1}function de(e){for(;e.length;){let r=e[e.length-1];if(`.,;:!?'"`.includes(r)){e=e.slice(0,-1);continue}if(r===")"){let t=(e.match(/\(/g)||[]).length;if((e.match(/\)/g)||[]).length>t){e=e.slice(0,-1);continue}}break}return e}function se(e,r){let t=0,n=r;for(;n<e.length;){let o=e[n];if(o==="\\"){n+=2;continue}if(o==="`"){let i=j(e,n,"`"),l=N(e,n+i,i);n=l===-1?n+i:l+i;continue}if(o==="[")t++;else if(o==="]"&&(t--,t===0))return n;n++}return-1}function ue(e,r){if(e[r]!=="(")return null;let t=r+1;for(;e[t]===" "||e[t]===`
`;)t++;let n="";if(e[t]==="<"){let i=e.indexOf(">",t+1);if(i===-1||(n=e.slice(t+1,i),n.includes(`
`)))return null;t=i+1}else{let i=0,l=t;for(;t<e.length;){let a=e[t];if(a==="\\"&&e[t+1]){t+=2;continue}if(/\s/.test(a))break;if(a==="(")i++;else if(a===")"){if(i===0)break;i--}t++}n=e.slice(l,t).replace(/\\([!-/:-@[-`{-~])/g,"$1")}for(;e[t]===" "||e[t]===`
`;)t++;let o="";if(e[t]==='"'||e[t]==="'"){let i=e[t],l=t+1;for(;l<e.length&&e[l]!==i;)e[l]==="\\"&&e[l+1]?(o+=e[l+1],l+=2):(o+=e[l],l++);if(l>=e.length)return null;for(t=l+1;e[t]===" "||e[t]===`
`;)t++}return e[t]!==")"?null:{href:n,title:o,end:t+1}}function G(e){let r="";for(let t of e)t.type==="text"||t.type==="code"?r+=t.text:t.type==="image"?r+=t.alt:t.children&&(r+=G(t.children));return r}function X(e,r,t,n){let o=se(e,r);if(o===-1)return null;let i=ue(e,o+1);if(!i)return null;let l=e.slice(r+1,o);if(n){let d=G(E(l,t+1,!0));return{node:{type:"image",src:i.href,alt:d,title:i.title},end:i.end}}let a=E(l,t+1,!0);return{node:{type:"link",href:i.href,title:i.title,children:a},end:i.end}}function U(e,r,t,n){let o=e[r+t];if(!o||/\s/.test(o))return!1;if(n==="_"){let i=e[r-1];if(i&&q.test(i))return!1}return!0}function D(e,r,t,n){let o=r;for(;o<e.length;){let i=e[o];if(i==="\\"){o+=2;continue}if(i==="`"){let l=j(e,o,"`"),a=N(e,o+l,l);o=a===-1?o+l:a+l;continue}if(i===n&&e.startsWith(t,o)){let l=e[o-1],a=j(e,o,n),d=e[o+a],s=!!l&&!/\s/.test(l),c=n!=="_"||!d||!q.test(d);if(s&&c)return o;o+=a;continue}o++}return-1}function fe(e,r,t,n,o){let i=j(e,r,t);if(t==="~"){if(i<2||!U(e,r,2,t))return null;let l=D(e,r+2,"~~",t);return l===-1||l<=r+2?null:{node:{type:"del",children:E(e.slice(r+2,l),n+1,o)},end:l+2}}if(i>=3&&U(e,r,3,t)){let l=D(e,r+3,t+t+t,t);if(l!==-1&&l>r+3)return{node:{type:"em",children:[{type:"strong",children:E(e.slice(r+3,l),n+1,o)}]},end:l+3}}if(i>=2&&U(e,r,2,t)){let l=D(e,r+2,t+t,t);if(l!==-1&&l>r+2)return{node:{type:"strong",children:E(e.slice(r+2,l),n+1,o)},end:l+2}}if(U(e,r,1,t)){let l=D(e,r+1,t,t);if(l!==-1&&l>r+1)return{node:{type:"em",children:E(e.slice(r+1,l),n+1,o)},end:l+1}}return null}function E(e,r=0,t=!1){let n=[],o="",i=0,l=()=>{o&&(n.push({type:"text",text:o}),o="")};for(;i<e.length;){let a=e[i];if(a==="\\"){let d=e[i+1];if(d===`
`){l(),n.push({type:"br"}),i+=2;continue}if(d&&ae.test(d)){o+=d,i+=2;continue}o+=a,i++;continue}if(a===`
`){/ {2}$/.test(o)?(o=o.replace(/ +$/,""),l(),n.push({type:"br"})):(o=o.replace(/ +$/,""),l(),n.push({type:"softbreak"})),i++;continue}if(a==="`"){let d=j(e,i,"`"),s=N(e,i+d,d);if(s!==-1){l();let c=e.slice(i+d,s);c.length>=2&&c[0]===" "&&c.endsWith(" ")&&c.trim()&&(c=c.slice(1,-1)),n.push({type:"code",text:c}),i=s+d;continue}o+=e.slice(i,i+d),i+=d;continue}if(a==="<"&&!t){let d=/^<(https?:\/\/[^\s<>]+|mailto:[^\s<>]+)>/i.exec(e.slice(i));if(d){l();let s=d[1],c=s.replace(/^mailto:/i,"");n.push({type:"link",href:s,title:"",children:[{type:"text",text:c}]}),i+=d[0].length;continue}o+=a,i++;continue}if((a==="h"||a==="H")&&!t&&(i===0||!q.test(e[i-1]))){let d=/^https?:\/\/[^\s<]+/i.exec(e.slice(i));if(d){let s=de(d[0]);l(),n.push({type:"link",href:s,title:"",children:[{type:"text",text:s}]}),i+=s.length;continue}o+=a,i++;continue}if(a==="!"&&e[i+1]==="["){let d=X(e,i+1,r,!0);if(d){l(),n.push(d.node),i=d.end;continue}o+=a,i++;continue}if(a==="["&&!t){let d=X(e,i,r,!1);if(d){l(),n.push(d.node),i=d.end;continue}o+=a,i++;continue}if((a==="*"||a==="_"||a==="~")&&r<ce){let d=fe(e,i,a,r,t);if(d){l(),n.push(d.node),i=d.end;continue}o+=a,i++;continue}o+=a,i++}return l(),n}function A(e,r){let t="";for(let n of e)switch(n.type){case"text":t+=w(n.text);break;case"softbreak":t+=`
`;break;case"br":t+=`<br>
`;break;case"code":t+=`<code>${w(n.text)}</code>`;break;case"em":t+=`<em>${A(n.children,r)}</em>`;break;case"strong":t+=`<strong>${A(n.children,r)}</strong>`;break;case"del":t+=`<del>${A(n.children,r)}</del>`;break;case"link":{let o=w(_(n.href)),i=n.title?` title="${w(n.title)}"`:"",l=r.linkTarget?` target="${w(r.linkTarget)}" rel="noopener noreferrer"`:"";t+=`<a href="${o}"${i}${l}>${A(n.children,r)}</a>`;break}case"image":{let o=w(_(n.src,{image:!0})),i=n.title?` title="${w(n.title)}"`:"";t+=`<img src="${o}" alt="${w(n.alt)}"${i}>`;break}}return t}function T(e,r={}){return A(E(e),r)}var K=/^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)/,Q=/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/,Y=/^ {0,3}(?:(?:- *){3,}|(?:\* *){3,}|(?:_ *){3,})$/,M=/^ {0,3}>/,Z=/^( *)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/,be=/^\[( |x|X)\][ \t]+/;function z(e){let r=Z.exec(e);return r?{indent:r[1].length,marker:r[2],content:r[3],ordered:me.test(r[2][0])}:null}var me=/[0-9]/;function I(e){let r=e.trim(),t=[],n="";for(let o=0;o<r.length;o++){let i=r[o];if(i==="\\"&&r[o+1]==="|"){n+="|",o++;continue}if(i==="\\"&&r[o+1]){n+=i+r[o+1],o++;continue}if(i==="|"){t.push(n),n="";continue}n+=i}return t.push(n),t.length&&r.startsWith("|")&&t[0].trim()===""&&t.shift(),t.length&&r.endsWith("|")&&t[t.length-1].trim()===""&&t.pop(),t}function J(e){if(!e||!e.includes("-"))return!1;let r=I(e);return r.length>0&&r.every(t=>/^ *:?-+:? *$/.test(t))}function V(e){return e?` style="text-align:${e}"`:""}function pe(e,r,t){let n=e[r];if(!n.includes("|")||!J(e[r+1]))return null;let o=I(n),i=I(e[r+1]).map(s=>{let c=s.trim(),f=c.startsWith(":"),m=c.endsWith(":");return f&&m?"center":m?"right":f?"left":""});if(!o.length||o.length!==i.length)return null;let l=`<table>
<thead>
<tr>
`;o.forEach((s,c)=>{l+=`<th${V(i[c])}>${T(s.trim(),t)}</th>
`}),l+=`</tr>
</thead>
`;let a=r+2,d=[];for(;a<e.length&&e[a].trim()&&e[a].includes("|");)d.push(I(e[a])),a++;if(d.length){l+=`<tbody>
`;for(let s of d){l+=`<tr>
`;for(let c=0;c<o.length;c++)l+=`<td${V(i[c])}>${T((s[c]||"").trim(),t)}</td>
`;l+=`</tr>
`}l+=`</tbody>
`}return l+=`</table>
`,{html:l,end:a}}function ee(e,r,t){let n=z(e[r]),o=n.indent,i=n.ordered,l=i?parseInt(n.marker,10):1,a=[],d=r;for(;d<e.length;){let c=e[d];if(!c.trim())break;let f=z(c);if(!f||f.indent<o)break;if(f.indent>=o+2){let m=ee(e,d,t);a[a.length-1].nested+=m.html,d=m.end;continue}a.push({content:f.content,nested:""}),d++}let s=i?l!==1?`<ol start="${l}">
`:`<ol>
`:`<ul>
`;for(let c of a){let f=be.exec(c.content);if(f){let m=f[1].toLowerCase()==="x"?" checked":"",h=c.content.slice(f[0].length);s+=`<li class="task"><input type="checkbox" disabled${m}> ${T(h,t)}${c.nested}</li>
`}else s+=`<li>${T(c.content,t)}${c.nested}</li>
`}return s+=i?`</ol>
`:`</ul>
`,{html:s,end:d}}function he(e,r){return K.test(e)||Q.test(e)||Y.test(e)||M.test(e)||Z.test(e)||e.includes("|")&&J(r)}function te(e,r){let t="",n=0;for(;n<e.length;){let o=e[n];if(!o.trim()){n++;continue}let i=K.exec(o);if(i){let c=i[1],f=i[2],m=[],h=n+1;for(;h<e.length;){let b=/^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(e[h]);if(b&&b[1][0]===c[0]&&b[1].length>=c.length)break;m.push(e[h]),h++}let v=f?` class="language-${w(f)}"`:"",x=m.length?w(m.join(`
`))+`
`:"";t+=`<pre><code${v}>${x}</code></pre>
`,n=h+1;continue}let l=Q.exec(o);if(l){let c=l[1].length,f=(l[2]||"").replace(/[ \t]+#+[ \t]*$/,"");t+=`<h${c}>${T(f,r)}</h${c}>
`,n++;continue}if(Y.test(o)){t+=`<hr>
`,n++;continue}if(M.test(o)){let c=[];for(;n<e.length&&M.test(e[n]);)c.push(e[n].replace(/^ {0,3}> ?/,"")),n++;t+=`<blockquote>
${te(c,r)}</blockquote>
`;continue}let a=pe(e,n,r);if(a){t+=a.html,n=a.end;continue}if(z(o)){let c=ee(e,n,r);t+=c.html,n=c.end;continue}let d=[o],s=n+1;for(;s<e.length&&e[s].trim()&&!he(e[s],e[s+1]);)d.push(e[s]),s++;t+=`<p>${T(d.join(`
`),r)}</p>
`,n=s}return t}function ne(e,r={}){return typeof e!="string"||!e.trim()?"":te(e.replace(/\r\n?/g,`
`).split(`
`),r)}var ge=`
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
`;function oe(){R(),L("markdown",ge)}var O={"image/png":"png","image/jpeg":"jpg","image/gif":"gif","image/webp":"webp"};function re(e){return function(t,n={}){if(typeof document>"u")throw new $("bad_request","attachImageUpload requires a DOM");let o=n.pathPrefix||"uploads/",i=n.maxBytes||10*1024*1024,l=n.onUploadStart||(()=>{}),a=n.onUpload||(()=>{}),d=n.onError||(b=>console.error("[cubby] image upload failed:",b));function s(){t.dispatchEvent(new Event("input",{bubbles:!0}))}function c(b){t.setRangeText(b,t.selectionStart,t.selectionEnd,"end"),s()}function f(b,u){let p=t.value.indexOf(b);return p===-1?!1:(t.setRangeText(u,p,p+b.length,"preserve"),s(),!0)}async function m(b){let u=e.identity?.user;if(!u){d(new $("auth_required","sign in to upload images"));return}if(b.size>i){d(new $("file_too_large",`image exceeds ${i} bytes`));return}let p=O[b.type],C=Date.now().toString(36)+Math.random().toString(36).slice(2,8),g=(b.name||`image.${p}`).replace(/[[\]()\n\r]/g,""),S=`![Uploading ${g}\u2026](cubby-upload:${C})`,y=`${o}${u.id}/${C}.${p}`;c(S),l({name:g,path:y});try{let W=(await e.fs.write(y,b)).url||await e.fs.url(y);f(S,`![${g}](${W})`),a({name:g,path:y,url:W})}catch(H){f(S,""),d(B(H,"upload_failed"))}}function h(b){let u=Array.from(b.clipboardData?.items||[]).filter(p=>p.kind==="file"&&O[p.type]).map(p=>p.getAsFile()).filter(Boolean);if(u.length){b.preventDefault();for(let p of u)m(p)}}function v(b){b.preventDefault()}function x(b){let u=Array.from(b.dataTransfer?.files||[]).filter(p=>O[p.type]);if(u.length){b.preventDefault();for(let p of u)m(p)}}return t.addEventListener("paste",h),t.addEventListener("dragover",v),t.addEventListener("drop",x),()=>{t.removeEventListener("paste",h),t.removeEventListener("dragover",v),t.removeEventListener("drop",x)}}}function ie(e,r){return P("editor",(t,n,o={})=>{if(typeof document>"u")throw new $("bad_request","editor requires a DOM");let i=e.markdown;if(!i)throw new $("bad_request","the editor needs /js/markdown.js loaded before it");i.injectStyles();let l=o.preview===!1?"none":o.preview==="split"?"split":"tabs",a=o.previewDebounceMs??150,d=o.onChange||(()=>{}),s=document.createElement("div");s.className="cubby-md-editor";let c=document.createElement("textarea");c.className="cubby-md-input",c.rows=o.rows||8,c.value=o.value||"",o.placeholder&&(c.placeholder=o.placeholder);let f=document.createElement("div");f.className="cubby-md-preview cubby-markdown";function m(){let u=c.value;f.innerHTML=u.trim()?i.render(u,{linkTarget:o.linkTarget}):'<p class="cubby-md-empty">Nothing to preview</p>'}let h=null,v=null;if(l==="tabs"){let u=document.createElement("div");u.className="cubby-md-tabs",u.setAttribute("role","tablist");let p=(g,S)=>{let y=document.createElement("button");return y.type="button",y.className="cubby-md-tab",y.setAttribute("role","tab"),y.setAttribute("aria-selected",String(S)),y.textContent=g,u.appendChild(y),y};h=p("Write",!0),v=p("Preview",!1);let C=g=>{h.setAttribute("aria-selected",String(!g)),v.setAttribute("aria-selected",String(g)),c.hidden=g,f.hidden=!g,g?m():c.focus()};t.on(h,"click",()=>C(!1)),t.on(v,"click",()=>C(!0)),f.hidden=!0,s.append(u,c,f)}else if(l==="split"){let u=document.createElement("div");u.className="cubby-md-split",u.append(c,f),s.appendChild(u),m()}else s.appendChild(c);let x=null;t.on(c,"input",()=>{d(c.value),l==="split"&&(clearTimeout(x),x=setTimeout(m,a))}),t.own(()=>clearTimeout(x));let b=[];return o.upload!==!1&&e.hasPlatform?.()&&t.own(r(c,{...o.upload||{},onUploadStart:o.onUploadStart,onUpload:u=>{b.push(u),o.onUpload?.(u)},onError:o.onError})),n.replaceChildren(s),t.own(()=>s.remove()),{get value(){return c.value},set value(u){this.setValue(u)},setValue(u){c.value=String(u),d(c.value),(l==="split"||l==="tabs"&&!f.hidden)&&m()},textarea:c,preview:f,images:b,focus(){c.focus()},refresh(){m()}}})}function le(e){let r=re(e);return{render:ne,editor:ie(e,r),attachImageUpload:r,injectStyles:oe}}if(typeof window<"u"){let e=F("markdown.js");e&&(e.markdown=le(e))}})();
