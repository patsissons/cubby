/* cubby markdown v0.1.0 (https://github.com/patsissons/cubby) */
(()=>{var h=typeof window<"u"&&window.cubby||null,A=h?.CubbyError,le=h?.toCubbyError,f=h?.escapeHtml,v=h?.sanitizeUrl,z=h?.injectStyle,S=h?.ensureTokens,ce=h?.widget;function O(e,...o){let t=[];h?.CubbyError||t.push("core.js");for(let n of o)h?.[n]||t.push(`${n}.js`);return t.length?(console.error(`[cubby] ${e} needs ${t.join(" + ")} loaded first. Tag order is core.js, platform.js, markdown.js, editor.js, then your app.js \u2014 all defer.`),null):h}var L=16,Q=/[!-/:-@[-`{-~]/,E=/[A-Za-z0-9_]/;function k(e,o,t){let n=0;for(;e[o+n]===t;)n++;return n}function T(e,o,t){let n=o;for(;n<e.length;)if(e[n]==="`"){let i=k(e,n,"`");if(i===t)return n;n+=i}else n++;return-1}function Y(e){for(;e.length;){let o=e[e.length-1];if(`.,;:!?'"`.includes(o)){e=e.slice(0,-1);continue}if(o===")"){let t=(e.match(/\(/g)||[]).length;if((e.match(/\)/g)||[]).length>t){e=e.slice(0,-1);continue}}break}return e}function Z(e,o){let t=0,n=o;for(;n<e.length;){let i=e[n];if(i==="\\"){n+=2;continue}if(i==="`"){let r=k(e,n,"`"),l=T(e,n+r,r);n=l===-1?n+r:l+r;continue}if(i==="[")t++;else if(i==="]"&&(t--,t===0))return n;n++}return-1}function J(e,o){if(e[o]!=="(")return null;let t=o+1;for(;e[t]===" "||e[t]===`
`;)t++;let n="";if(e[t]==="<"){let r=e.indexOf(">",t+1);if(r===-1||(n=e.slice(t+1,r),n.includes(`
`)))return null;t=r+1}else{let r=0,l=t;for(;t<e.length;){let c=e[t];if(c==="\\"&&e[t+1]){t+=2;continue}if(/\s/.test(c))break;if(c==="(")r++;else if(c===")"){if(r===0)break;r--}t++}n=e.slice(l,t).replace(/\\([!-/:-@[-`{-~])/g,"$1")}for(;e[t]===" "||e[t]===`
`;)t++;let i="";if(e[t]==='"'||e[t]==="'"){let r=e[t],l=t+1;for(;l<e.length&&e[l]!==r;)e[l]==="\\"&&e[l+1]?(i+=e[l+1],l+=2):(i+=e[l],l++);if(l>=e.length)return null;for(t=l+1;e[t]===" "||e[t]===`
`;)t++}return e[t]!==")"?null:{href:n,title:i,end:t+1}}function q(e){let o="";for(let t of e)t.type==="text"||t.type==="code"?o+=t.text:t.type==="image"?o+=t.alt:t.children&&(o+=q(t.children));return o}function _(e,o,t,n){let i=Z(e,o);if(i===-1)return null;let r=J(e,i+1);if(!r)return null;let l=e.slice(o+1,i);if(n){let s=q(p(l,t+1,!0));return{node:{type:"image",src:r.href,alt:s,title:r.title},end:r.end}}let c=p(l,t+1,!0);return{node:{type:"link",href:r.href,title:r.title,children:c},end:r.end}}function w(e,o,t,n){let i=e[o+t];if(!i||/\s/.test(i))return!1;if(n==="_"){let r=e[o-1];if(r&&E.test(r))return!1}return!0}function x(e,o,t,n){let i=o;for(;i<e.length;){let r=e[i];if(r==="\\"){i+=2;continue}if(r==="`"){let l=k(e,i,"`"),c=T(e,i+l,l);i=c===-1?i+l:c+l;continue}if(r===n&&e.startsWith(t,i)){let l=e[i-1],c=k(e,i,n),s=e[i+c],a=!!l&&!/\s/.test(l),u=n!=="_"||!s||!E.test(s);if(a&&u)return i;i+=c;continue}i++}return-1}function V(e,o,t,n,i){let r=k(e,o,t);if(t==="~"){if(r<2||!w(e,o,2,t))return null;let l=x(e,o+2,"~~",t);return l===-1||l<=o+2?null:{node:{type:"del",children:p(e.slice(o+2,l),n+1,i)},end:l+2}}if(r>=3&&w(e,o,3,t)){let l=x(e,o+3,t+t+t,t);if(l!==-1&&l>o+3)return{node:{type:"em",children:[{type:"strong",children:p(e.slice(o+3,l),n+1,i)}]},end:l+3}}if(r>=2&&w(e,o,2,t)){let l=x(e,o+2,t+t,t);if(l!==-1&&l>o+2)return{node:{type:"strong",children:p(e.slice(o+2,l),n+1,i)},end:l+2}}if(w(e,o,1,t)){let l=x(e,o+1,t,t);if(l!==-1&&l>o+1)return{node:{type:"em",children:p(e.slice(o+1,l),n+1,i)},end:l+1}}return null}function p(e,o=0,t=!1){let n=[],i="",r=0,l=()=>{i&&(n.push({type:"text",text:i}),i="")};for(;r<e.length;){let c=e[r];if(c==="\\"){let s=e[r+1];if(s===`
`){l(),n.push({type:"br"}),r+=2;continue}if(s&&Q.test(s)){i+=s,r+=2;continue}i+=c,r++;continue}if(c===`
`){/ {2}$/.test(i)?(i=i.replace(/ +$/,""),l(),n.push({type:"br"})):(i=i.replace(/ +$/,""),l(),n.push({type:"softbreak"})),r++;continue}if(c==="`"){let s=k(e,r,"`"),a=T(e,r+s,s);if(a!==-1){l();let u=e.slice(r+s,a);u.length>=2&&u[0]===" "&&u.endsWith(" ")&&u.trim()&&(u=u.slice(1,-1)),n.push({type:"code",text:u}),r=a+s;continue}i+=e.slice(r,r+s),r+=s;continue}if(c==="<"&&!t){let s=/^<(https?:\/\/[^\s<>]+|mailto:[^\s<>]+)>/i.exec(e.slice(r));if(s){l();let a=s[1],u=a.replace(/^mailto:/i,"");n.push({type:"link",href:a,title:"",children:[{type:"text",text:u}]}),r+=s[0].length;continue}i+=c,r++;continue}if((c==="h"||c==="H")&&!t&&(r===0||!E.test(e[r-1]))){let s=/^https?:\/\/[^\s<]+/i.exec(e.slice(r));if(s){let a=Y(s[0]);l(),n.push({type:"link",href:a,title:"",children:[{type:"text",text:a}]}),r+=a.length;continue}i+=c,r++;continue}if(c==="!"&&e[r+1]==="["){let s=_(e,r+1,o,!0);if(s){l(),n.push(s.node),r=s.end;continue}i+=c,r++;continue}if(c==="["&&!t){let s=_(e,r,o,!1);if(s){l(),n.push(s.node),r=s.end;continue}i+=c,r++;continue}if((c==="*"||c==="_"||c==="~")&&o<L){let s=V(e,r,c,o,t);if(s){l(),n.push(s.node),r=s.end;continue}i+=c,r++;continue}i+=c,r++}return l(),n}function y(e,o){let t="";for(let n of e)switch(n.type){case"text":t+=f(n.text);break;case"softbreak":t+=`
`;break;case"br":t+=`<br>
`;break;case"code":t+=`<code>${f(n.text)}</code>`;break;case"em":t+=`<em>${y(n.children,o)}</em>`;break;case"strong":t+=`<strong>${y(n.children,o)}</strong>`;break;case"del":t+=`<del>${y(n.children,o)}</del>`;break;case"link":{let i=f(v(n.href)),r=n.title?` title="${f(n.title)}"`:"",l=o.linkTarget?` target="${f(o.linkTarget)}" rel="noopener noreferrer"`:"";t+=`<a href="${i}"${r}${l}>${y(n.children,o)}</a>`;break}case"image":{let i=f(v(n.src,{image:!0})),r=n.title?` title="${f(n.title)}"`:"";t+=`<img src="${i}" alt="${f(n.alt)}"${r}>`;break}}return t}function g(e,o={}){return y(p(e),o)}var U=/^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)/,W=/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/,D=/^ {0,3}(?:(?:- *){3,}|(?:\* *){3,}|(?:_ *){3,})$/,C=/^ {0,3}>/,N=/^( *)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/,ee=/^\[( |x|X)\][ \t]+/;function I(e){let o=N.exec(e);return o?{indent:o[1].length,marker:o[2],content:o[3],ordered:te.test(o[2][0])}:null}var te=/[0-9]/;function $(e){let o=e.trim(),t=[],n="";for(let i=0;i<o.length;i++){let r=o[i];if(r==="\\"&&o[i+1]==="|"){n+="|",i++;continue}if(r==="\\"&&o[i+1]){n+=r+o[i+1],i++;continue}if(r==="|"){t.push(n),n="";continue}n+=r}return t.push(n),t.length&&o.startsWith("|")&&t[0].trim()===""&&t.shift(),t.length&&o.endsWith("|")&&t[t.length-1].trim()===""&&t.pop(),t}function B(e){if(!e||!e.includes("-"))return!1;let o=$(e);return o.length>0&&o.every(t=>/^ *:?-+:? *$/.test(t))}function H(e){return e?` style="text-align:${e}"`:""}function ne(e,o,t){let n=e[o];if(!n.includes("|")||!B(e[o+1]))return null;let i=$(n),r=$(e[o+1]).map(a=>{let u=a.trim(),d=u.startsWith(":"),b=u.endsWith(":");return d&&b?"center":b?"right":d?"left":""});if(!i.length||i.length!==r.length)return null;let l=`<table>
<thead>
<tr>
`;i.forEach((a,u)=>{l+=`<th${H(r[u])}>${g(a.trim(),t)}</th>
`}),l+=`</tr>
</thead>
`;let c=o+2,s=[];for(;c<e.length&&e[c].trim()&&e[c].includes("|");)s.push($(e[c])),c++;if(s.length){l+=`<tbody>
`;for(let a of s){l+=`<tr>
`;for(let u=0;u<i.length;u++)l+=`<td${H(r[u])}>${g((a[u]||"").trim(),t)}</td>
`;l+=`</tr>
`}l+=`</tbody>
`}return l+=`</table>
`,{html:l,end:c}}function M(e,o,t){let n=I(e[o]),i=n.indent,r=n.ordered,l=r?parseInt(n.marker,10):1,c=[],s=o;for(;s<e.length;){let u=e[s];if(!u.trim())break;let d=I(u);if(!d||d.indent<i)break;if(d.indent>=i+2){let b=M(e,s,t);c[c.length-1].nested+=b.html,s=b.end;continue}c.push({content:d.content,nested:""}),s++}let a=r?l!==1?`<ol start="${l}">
`:`<ol>
`:`<ul>
`;for(let u of c){let d=ee.exec(u.content);if(d){let b=d[1].toLowerCase()==="x"?" checked":"",m=u.content.slice(d[0].length);a+=`<li class="task"><input type="checkbox" disabled${b}> ${g(m,t)}${u.nested}</li>
`}else a+=`<li>${g(u.content,t)}${u.nested}</li>
`}return a+=r?`</ol>
`:`</ul>
`,{html:a,end:s}}function oe(e,o){return U.test(e)||W.test(e)||D.test(e)||C.test(e)||N.test(e)||e.includes("|")&&B(o)}function R(e,o){let t="",n=0;for(;n<e.length;){let i=e[n];if(!i.trim()){n++;continue}let r=U.exec(i);if(r){let u=r[1],d=r[2],b=[],m=n+1;for(;m<e.length;){let j=/^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(e[m]);if(j&&j[1][0]===u[0]&&j[1].length>=u.length)break;b.push(e[m]),m++}let X=d?` class="language-${f(d)}"`:"",K=b.length?f(b.join(`
`))+`
`:"";t+=`<pre><code${X}>${K}</code></pre>
`,n=m+1;continue}let l=W.exec(i);if(l){let u=l[1].length,d=(l[2]||"").replace(/[ \t]+#+[ \t]*$/,"");t+=`<h${u}>${g(d,o)}</h${u}>
`,n++;continue}if(D.test(i)){t+=`<hr>
`,n++;continue}if(C.test(i)){let u=[];for(;n<e.length&&C.test(e[n]);)u.push(e[n].replace(/^ {0,3}> ?/,"")),n++;t+=`<blockquote>
${R(u,o)}</blockquote>
`;continue}let c=ne(e,n,o);if(c){t+=c.html,n=c.end;continue}if(I(i)){let u=M(e,n,o);t+=u.html,n=u.end;continue}let s=[i],a=n+1;for(;a<e.length&&e[a].trim()&&!oe(e[a],e[a+1]);)s.push(e[a]),a++;t+=`<p>${g(s.join(`
`),o)}</p>
`,n=a}return t}function P(e,o={}){return typeof e!="string"||!e.trim()?"":R(e.replace(/\r\n?/g,`
`).split(`
`),o)}var re=`
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
`;function F(){S(),z("markdown",re)}function ie(e){return new A("editor_moved",`cubby.markdown.${e} moved to cubby.editor. Add <script src="/js/editor.js" defer><\/script> after markdown.js.`)}function G(e){let o={render:P,injectStyles:F};for(let[t,n]of[["editor",()=>e?.editor],["attachImageUpload",()=>e?.editor?.attachImageUpload]])Object.defineProperty(o,t,{configurable:!0,enumerable:!1,get(){let i=n();if(i)return i;throw ie(t)}});return o}if(typeof window<"u"){let e=O("markdown.js");e&&(e.markdown=G(e))}})();
