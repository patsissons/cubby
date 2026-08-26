/* cubby markdown v0.1.0 (https://github.com/patsissons/cubby) */
import{CubbyError as ne}from"./core.esm.js";import{escapeHtml as W}from"./core.esm.js";import{escapeHtml as h,sanitizeUrl as E}from"./core.esm.js";var P=16,G=/[!-/:-@[-`{-~]/,v=/[A-Za-z0-9_]/;function p(e,o,t){let n=0;for(;e[o+n]===t;)n++;return n}function j(e,o,t){let n=o;for(;n<e.length;)if(e[n]==="`"){let i=p(e,n,"`");if(i===t)return n;n+=i}else n++;return-1}function X(e){for(;e.length;){let o=e[e.length-1];if(`.,;:!?'"`.includes(o)){e=e.slice(0,-1);continue}if(o===")"){let t=(e.match(/\(/g)||[]).length;if((e.match(/\)/g)||[]).length>t){e=e.slice(0,-1);continue}}break}return e}function F(e,o){let t=0,n=o;for(;n<e.length;){let i=e[n];if(i==="\\"){n+=2;continue}if(i==="`"){let r=p(e,n,"`"),l=j(e,n+r,r);n=l===-1?n+r:l+r;continue}if(i==="[")t++;else if(i==="]"&&(t--,t===0))return n;n++}return-1}function K(e,o){if(e[o]!=="(")return null;let t=o+1;for(;e[t]===" "||e[t]===`
`;)t++;let n="";if(e[t]==="<"){let r=e.indexOf(">",t+1);if(r===-1||(n=e.slice(t+1,r),n.includes(`
`)))return null;t=r+1}else{let r=0,l=t;for(;t<e.length;){let c=e[t];if(c==="\\"&&e[t+1]){t+=2;continue}if(/\s/.test(c))break;if(c==="(")r++;else if(c===")"){if(r===0)break;r--}t++}n=e.slice(l,t).replace(/\\([!-/:-@[-`{-~])/g,"$1")}for(;e[t]===" "||e[t]===`
`;)t++;let i="";if(e[t]==='"'||e[t]==="'"){let r=e[t],l=t+1;for(;l<e.length&&e[l]!==r;)e[l]==="\\"&&e[l+1]?(i+=e[l+1],l+=2):(i+=e[l],l++);if(l>=e.length)return null;for(t=l+1;e[t]===" "||e[t]===`
`;)t++}return e[t]!==")"?null:{href:n,title:i,end:t+1}}function A(e){let o="";for(let t of e)t.type==="text"||t.type==="code"?o+=t.text:t.type==="image"?o+=t.alt:t.children&&(o+=A(t.children));return o}function z(e,o,t,n){let i=F(e,o);if(i===-1)return null;let r=K(e,i+1);if(!r)return null;let l=e.slice(o+1,i);if(n){let a=A(m(l,t+1,!0));return{node:{type:"image",src:r.href,alt:a,title:r.title},end:r.end}}let c=m(l,t+1,!0);return{node:{type:"link",href:r.href,title:r.title,children:c},end:r.end}}function y(e,o,t,n){let i=e[o+t];if(!i||/\s/.test(i))return!1;if(n==="_"){let r=e[o-1];if(r&&v.test(r))return!1}return!0}function w(e,o,t,n){let i=o;for(;i<e.length;){let r=e[i];if(r==="\\"){i+=2;continue}if(r==="`"){let l=p(e,i,"`"),c=j(e,i+l,l);i=c===-1?i+l:c+l;continue}if(r===n&&e.startsWith(t,i)){let l=e[i-1],c=p(e,i,n),a=e[i+c],s=!!l&&!/\s/.test(l),u=n!=="_"||!a||!v.test(a);if(s&&u)return i;i+=c;continue}i++}return-1}function L(e,o,t,n,i){let r=p(e,o,t);if(t==="~"){if(r<2||!y(e,o,2,t))return null;let l=w(e,o+2,"~~",t);return l===-1||l<=o+2?null:{node:{type:"del",children:m(e.slice(o+2,l),n+1,i)},end:l+2}}if(r>=3&&y(e,o,3,t)){let l=w(e,o+3,t+t+t,t);if(l!==-1&&l>o+3)return{node:{type:"em",children:[{type:"strong",children:m(e.slice(o+3,l),n+1,i)}]},end:l+3}}if(r>=2&&y(e,o,2,t)){let l=w(e,o+2,t+t,t);if(l!==-1&&l>o+2)return{node:{type:"strong",children:m(e.slice(o+2,l),n+1,i)},end:l+2}}if(y(e,o,1,t)){let l=w(e,o+1,t,t);if(l!==-1&&l>o+1)return{node:{type:"em",children:m(e.slice(o+1,l),n+1,i)},end:l+1}}return null}function m(e,o=0,t=!1){let n=[],i="",r=0,l=()=>{i&&(n.push({type:"text",text:i}),i="")};for(;r<e.length;){let c=e[r];if(c==="\\"){let a=e[r+1];if(a===`
`){l(),n.push({type:"br"}),r+=2;continue}if(a&&G.test(a)){i+=a,r+=2;continue}i+=c,r++;continue}if(c===`
`){/ {2}$/.test(i)?(i=i.replace(/ +$/,""),l(),n.push({type:"br"})):(i=i.replace(/ +$/,""),l(),n.push({type:"softbreak"})),r++;continue}if(c==="`"){let a=p(e,r,"`"),s=j(e,r+a,a);if(s!==-1){l();let u=e.slice(r+a,s);u.length>=2&&u[0]===" "&&u.endsWith(" ")&&u.trim()&&(u=u.slice(1,-1)),n.push({type:"code",text:u}),r=s+a;continue}i+=e.slice(r,r+a),r+=a;continue}if(c==="<"&&!t){let a=/^<(https?:\/\/[^\s<>]+|mailto:[^\s<>]+)>/i.exec(e.slice(r));if(a){l();let s=a[1],u=s.replace(/^mailto:/i,"");n.push({type:"link",href:s,title:"",children:[{type:"text",text:u}]}),r+=a[0].length;continue}i+=c,r++;continue}if((c==="h"||c==="H")&&!t&&(r===0||!v.test(e[r-1]))){let a=/^https?:\/\/[^\s<]+/i.exec(e.slice(r));if(a){let s=X(a[0]);l(),n.push({type:"link",href:s,title:"",children:[{type:"text",text:s}]}),r+=s.length;continue}i+=c,r++;continue}if(c==="!"&&e[r+1]==="["){let a=z(e,r+1,o,!0);if(a){l(),n.push(a.node),r=a.end;continue}i+=c,r++;continue}if(c==="["&&!t){let a=z(e,r,o,!1);if(a){l(),n.push(a.node),r=a.end;continue}i+=c,r++;continue}if((c==="*"||c==="_"||c==="~")&&o<P){let a=L(e,r,c,o,t);if(a){l(),n.push(a.node),r=a.end;continue}i+=c,r++;continue}i+=c,r++}return l(),n}function k(e,o){let t="";for(let n of e)switch(n.type){case"text":t+=h(n.text);break;case"softbreak":t+=`
`;break;case"br":t+=`<br>
`;break;case"code":t+=`<code>${h(n.text)}</code>`;break;case"em":t+=`<em>${k(n.children,o)}</em>`;break;case"strong":t+=`<strong>${k(n.children,o)}</strong>`;break;case"del":t+=`<del>${k(n.children,o)}</del>`;break;case"link":{let i=h(E(n.href)),r=n.title?` title="${h(n.title)}"`:"",l=o.linkTarget?` target="${h(o.linkTarget)}" rel="noopener noreferrer"`:"";t+=`<a href="${i}"${r}${l}>${k(n.children,o)}</a>`;break}case"image":{let i=h(E(n.src,{image:!0})),r=n.title?` title="${h(n.title)}"`:"";t+=`<img src="${i}" alt="${h(n.alt)}"${r}>`;break}}return t}function g(e,o={}){return k(m(e),o)}var C=/^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)/,O=/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/,S=/^ {0,3}(?:(?:- *){3,}|(?:\* *){3,}|(?:_ *){3,})$/,I=/^ {0,3}>/,q=/^( *)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/,Q=/^\[( |x|X)\][ \t]+/;function T(e){let o=q.exec(e);return o?{indent:o[1].length,marker:o[2],content:o[3],ordered:Y.test(o[2][0])}:null}var Y=/[0-9]/;function $(e){let o=e.trim(),t=[],n="";for(let i=0;i<o.length;i++){let r=o[i];if(r==="\\"&&o[i+1]==="|"){n+="|",i++;continue}if(r==="\\"&&o[i+1]){n+=r+o[i+1],i++;continue}if(r==="|"){t.push(n),n="";continue}n+=r}return t.push(n),t.length&&o.startsWith("|")&&t[0].trim()===""&&t.shift(),t.length&&o.endsWith("|")&&t[t.length-1].trim()===""&&t.pop(),t}function D(e){if(!e||!e.includes("-"))return!1;let o=$(e);return o.length>0&&o.every(t=>/^ *:?-+:? *$/.test(t))}function _(e){return e?` style="text-align:${e}"`:""}function Z(e,o,t){let n=e[o];if(!n.includes("|")||!D(e[o+1]))return null;let i=$(n),r=$(e[o+1]).map(s=>{let u=s.trim(),d=u.startsWith(":"),f=u.endsWith(":");return d&&f?"center":f?"right":d?"left":""});if(!i.length||i.length!==r.length)return null;let l=`<table>
<thead>
<tr>
`;i.forEach((s,u)=>{l+=`<th${_(r[u])}>${g(s.trim(),t)}</th>
`}),l+=`</tr>
</thead>
`;let c=o+2,a=[];for(;c<e.length&&e[c].trim()&&e[c].includes("|");)a.push($(e[c])),c++;if(a.length){l+=`<tbody>
`;for(let s of a){l+=`<tr>
`;for(let u=0;u<i.length;u++)l+=`<td${_(r[u])}>${g((s[u]||"").trim(),t)}</td>
`;l+=`</tr>
`}l+=`</tbody>
`}return l+=`</table>
`,{html:l,end:c}}function H(e,o,t){let n=T(e[o]),i=n.indent,r=n.ordered,l=r?parseInt(n.marker,10):1,c=[],a=o;for(;a<e.length;){let u=e[a];if(!u.trim())break;let d=T(u);if(!d||d.indent<i)break;if(d.indent>=i+2){let f=H(e,a,t);c[c.length-1].nested+=f.html,a=f.end;continue}c.push({content:d.content,nested:""}),a++}let s=r?l!==1?`<ol start="${l}">
`:`<ol>
`:`<ul>
`;for(let u of c){let d=Q.exec(u.content);if(d){let f=d[1].toLowerCase()==="x"?" checked":"",b=u.content.slice(d[0].length);s+=`<li class="task"><input type="checkbox" disabled${f}> ${g(b,t)}${u.nested}</li>
`}else s+=`<li>${g(u.content,t)}${u.nested}</li>
`}return s+=r?`</ol>
`:`</ul>
`,{html:s,end:a}}function J(e,o){return C.test(e)||O.test(e)||S.test(e)||I.test(e)||q.test(e)||e.includes("|")&&D(o)}function B(e,o){let t="",n=0;for(;n<e.length;){let i=e[n];if(!i.trim()){n++;continue}let r=C.exec(i);if(r){let u=r[1],d=r[2],f=[],b=n+1;for(;b<e.length;){let x=/^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(e[b]);if(x&&x[1][0]===u[0]&&x[1].length>=u.length)break;f.push(e[b]),b++}let N=d?` class="language-${W(d)}"`:"",M=f.length?W(f.join(`
`))+`
`:"";t+=`<pre><code${N}>${M}</code></pre>
`,n=b+1;continue}let l=O.exec(i);if(l){let u=l[1].length,d=(l[2]||"").replace(/[ \t]+#+[ \t]*$/,"");t+=`<h${u}>${g(d,o)}</h${u}>
`,n++;continue}if(S.test(i)){t+=`<hr>
`,n++;continue}if(I.test(i)){let u=[];for(;n<e.length&&I.test(e[n]);)u.push(e[n].replace(/^ {0,3}> ?/,"")),n++;t+=`<blockquote>
${B(u,o)}</blockquote>
`;continue}let c=Z(e,n,o);if(c){t+=c.html,n=c.end;continue}if(T(i)){let u=H(e,n,o);t+=u.html,n=u.end;continue}let a=[i],s=n+1;for(;s<e.length&&e[s].trim()&&!J(e[s],e[s+1]);)a.push(e[s]),s++;t+=`<p>${g(a.join(`
`),o)}</p>
`,n=s}return t}function R(e,o={}){return typeof e!="string"||!e.trim()?"":B(e.replace(/\r\n?/g,`
`).split(`
`),o)}import{injectStyle as V,ensureTokens as ee}from"./core.esm.js";var te=`
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
`;function U(){ee(),V("markdown",te)}function oe(e){return new ne("editor_moved",`cubby.markdown.${e} moved to cubby.editor. Add <script src="/js/editor.js" defer><\/script> after markdown.js.`)}function re(e){let o={render:R,injectStyles:U};for(let[t,n]of[["editor",()=>e?.editor],["attachImageUpload",()=>e?.editor?.attachImageUpload]])Object.defineProperty(o,t,{configurable:!0,enumerable:!1,get(){let i=n();if(i)return i;throw oe(t)}});return o}var me=re;export{re as createMarkdown,me as default,R as render};
