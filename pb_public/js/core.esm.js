/* cubby core v0.1.0 (https://github.com/patsissons/cubby) */
var n=class extends Error{constructor(t,r,o={}){super(r||t),this.name="CubbyError",this.code=t,o.status&&(this.status=o.status),o.cause&&(this.cause=o.cause)}};function b(e,t="unknown"){if(e instanceof n)return e;let r=e&&typeof e=="object"&&"status"in e?e.status:void 0;return r===401||r===403?new n("auth_required",String(e?.message||e),{cause:e,status:r}):r===404?new n("not_found",String(e?.message||e),{cause:e,status:r}):new n(t,String(e?.message||e),{cause:e,status:r})}var O={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};function h(e){return String(e).replace(/[&<>"']/g,t=>O[t])}var v=/^[a-z][a-z0-9+.-]*:/i,k=/[\x00-\x20\x7f]+/g;function g(e,t={}){if(typeof e!="string")return"";let r=e.replace(k,""),o=v.exec(r);if(!o)return r;let s=o[0].toLowerCase();return s==="http:"||s==="https:"||s==="mailto:"&&!t.image?r:""}var x=e=>["--bg: #16130f;","--fg: #ede9e3;","--muted: #9a938a;","--accent: #e8823f;","--accent-soft: #e8823f26;","--card: #201c17;","--border: #362f27;","--code-bg: #211d18;","--shadow: 0 1px 2px rgb(0 0 0 / 0.3), 0 4px 12px rgb(0 0 0 / 0.25);","--shadow-hover: 0 2px 4px rgb(0 0 0 / 0.35), 0 10px 24px rgb(0 0 0 / 0.4);"].map(t=>e+t).join(`
`),y=`:root {
  color-scheme: light dark;

  --bg: #faf8f5;
  --fg: #201d1a;
  --muted: #77706a;
  --accent: #c2571b;
  --accent-soft: #c2571b22;
  --card: #ffffff;
  --border: #e7e2da;
  --code-bg: #f2eee8;
  --shadow: 0 1px 2px rgb(32 29 26 / 0.05), 0 4px 12px rgb(32 29 26 / 0.06);
  --shadow-hover: 0 2px 4px rgb(32 29 26 / 0.07), 0 10px 24px rgb(32 29 26 / 0.1);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${x("    ")}
  }
}

:root[data-theme='dark'] {
  color-scheme: dark;

${x("  ")}
}

:root[data-theme='light'] {
  color-scheme: light;
}
`;function p(e,t){if(typeof document>"u")return;let r=`data-cubby-${e}`;if(document.querySelector(`[${r}]`))return;let o=document.createElement("style");o.setAttribute(r,""),o.textContent=t,document.head.prepend(o)}function w(){p("tokens",y)}function N(e){if(typeof e=="string"){if(typeof document>"u")throw new n("bad_request","a selector target needs a DOM");let t=document.querySelector(e);if(!t)throw new n("not_found",`no element matches "${e}"`);return t}if(!e)throw new n("bad_request","a mount target is required");return e}function E(e,t){return function(o,s={}){let i=N(o),u=[],_={element:i,on(c,m,d,l){return c.addEventListener(m,d,l),u.push(()=>c.removeEventListener(m,d,l)),d},own(c){return u.push(c),c}},a;try{a=t(_,i,s)||{}}catch(c){throw S(u,e),c}let f=!1,C=Object.defineProperties({},Object.getOwnPropertyDescriptors(a));return Object.defineProperties(C,{element:{enumerable:!0,value:i},destroyed:{enumerable:!0,get:()=>f},destroy:{enumerable:!0,value:()=>{if(!f){if(f=!0,typeof a.destroy=="function")try{a.destroy()}catch(c){console.error(`[cubby.${e}] destroy threw:`,c)}S(u,e)}}}})}}function S(e,t){for(;e.length;){let r=e.pop();try{r()}catch(o){console.error(`[cubby.${t}] cleanup threw:`,o)}}}var M="cubby";function T(e){return!!(e&&e.fs&&e.identity&&e._pb)}function j(e={}){return e.CubbyError?e:Object.assign(e,{version:"0.1.0",CubbyError:n,toCubbyError:b,escapeHtml:h,sanitizeUrl:g,injectStyle:p,ensureTokens:w,widget:E,hasPlatform:()=>T(e)})}var R=j;export{n as CubbyError,M as FOUNDATION_NAMESPACE,j as attachCore,R as default,w as ensureTokens,h as escapeHtml,T as hasPlatform,p as injectStyle,g as sanitizeUrl,b as toCubbyError,E as widget};
