/* cubby core v0.1.0 (https://github.com/patsissons/cubby) */
var n=class extends Error{constructor(e,r,o={}){super(r||e),this.name="CubbyError",this.code=e,o.status&&(this.status=o.status),o.cause&&(this.cause=o.cause)}};function l(t,e="unknown"){if(t instanceof n)return t;let r=t&&typeof t=="object"&&"status"in t?t.status:void 0;return r===401||r===403?new n("auth_required",String(t?.message||t),{cause:t,status:r}):r===404?new n("not_found",String(t?.message||t),{cause:t,status:r}):new n(e,String(t?.message||t),{cause:t,status:r})}var C={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};function b(t){return String(t).replace(/[&<>"']/g,e=>C[e])}var O=/^[a-z][a-z0-9+.-]*:/i,k=/[\x00-\x20\x7f]+/g;function g(t,e={}){if(typeof t!="string")return"";let r=t.replace(k,""),o=O.exec(r);if(!o)return r;let s=o[0].toLowerCase();return s==="http:"||s==="https:"||s==="mailto:"&&!e.image?r:""}var x=t=>["--bg: #16130f;","--fg: #ede9e3;","--muted: #9a938a;","--accent: #e8823f;","--accent-soft: #e8823f26;","--card: #201c17;","--border: #362f27;","--code-bg: #211d18;","--shadow: 0 1px 2px rgb(0 0 0 / 0.3), 0 4px 12px rgb(0 0 0 / 0.25);","--shadow-hover: 0 2px 4px rgb(0 0 0 / 0.35), 0 10px 24px rgb(0 0 0 / 0.4);"].map(e=>t+e).join(`
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
`;function p(t,e){if(typeof document>"u")return;let r=`data-cubby-${t}`;if(document.querySelector(`[${r}]`))return;let o=document.createElement("style");o.setAttribute(r,""),o.textContent=e,document.head.prepend(o)}function w(){p("tokens",y)}function N(t){if(typeof t=="string"){if(typeof document>"u")throw new n("bad_request","a selector target needs a DOM");let e=document.querySelector(t);if(!e)throw new n("not_found",`no element matches "${t}"`);return e}if(!t)throw new n("bad_request","a mount target is required");return t}function E(t,e){return function(o,s={}){let i=N(o),u=[],_={element:i,on(c,m,d,h){return c.addEventListener(m,d,h),u.push(()=>c.removeEventListener(m,d,h)),d},own(c){return u.push(c),c}},a;try{a=e(_,i,s)||{}}catch(c){throw S(u,t),c}let f=!1;return{...a,element:i,get destroyed(){return f},destroy(){if(!f){if(f=!0,typeof a.destroy=="function")try{a.destroy()}catch(c){console.error(`[cubby.${t}] destroy threw:`,c)}S(u,t)}}}}}function S(t,e){for(;t.length;){let r=t.pop();try{r()}catch(o){console.error(`[cubby.${e}] cleanup threw:`,o)}}}var P="cubby";function T(t){return!!(t&&t.fs&&t.identity&&t._pb)}function v(t={}){return t.CubbyError?t:Object.assign(t,{version:"0.1.0",CubbyError:n,toCubbyError:l,escapeHtml:b,sanitizeUrl:g,injectStyle:p,ensureTokens:w,widget:E,hasPlatform:()=>T(t)})}var R=v;export{n as CubbyError,P as FOUNDATION_NAMESPACE,v as attachCore,R as default,w as ensureTokens,b as escapeHtml,T as hasPlatform,p as injectStyle,g as sanitizeUrl,l as toCubbyError,E as widget};
