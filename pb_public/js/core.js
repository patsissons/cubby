/* cubby core v0.1.0 (https://github.com/patsissons/cubby) */
(()=>{var n=class extends Error{constructor(t,r,o={}){super(r||t),this.name="CubbyError",this.code=t,o.status&&(this.status=o.status),o.cause&&(this.cause=o.cause)}};function h(e,t="unknown"){if(e instanceof n)return e;let r=e&&typeof e=="object"&&"status"in e?e.status:void 0;return r===401||r===403?new n("auth_required",String(e?.message||e),{cause:e,status:r}):r===404?new n("not_found",String(e?.message||e),{cause:e,status:r}):new n(t,String(e?.message||e),{cause:e,status:r})}var v={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};function g(e){return String(e).replace(/[&<>"']/g,t=>v[t])}var T=/^[a-z][a-z0-9+.-]*:/i,k=/[\x00-\x20\x7f]+/g;function x(e,t={}){if(typeof e!="string")return"";let r=e.replace(k,""),o=T.exec(r);if(!o)return r;let s=o[0].toLowerCase();return s==="http:"||s==="https:"||s==="mailto:"&&!t.image?r:""}var y=e=>["--bg: #16130f;","--fg: #ede9e3;","--muted: #9a938a;","--accent: #e8823f;","--accent-soft: #e8823f26;","--card: #201c17;","--border: #362f27;","--code-bg: #211d18;","--shadow: 0 1px 2px rgb(0 0 0 / 0.3), 0 4px 12px rgb(0 0 0 / 0.25);","--shadow-hover: 0 2px 4px rgb(0 0 0 / 0.35), 0 10px 24px rgb(0 0 0 / 0.4);"].map(t=>e+t).join(`
`),w=`:root {
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
${y("    ")}
  }
}

:root[data-theme='dark'] {
  color-scheme: dark;

${y("  ")}
}

:root[data-theme='light'] {
  color-scheme: light;
}
`;function p(e,t){if(typeof document>"u")return;let r=`data-cubby-${e}`;if(document.querySelector(`[${r}]`))return;let o=document.createElement("style");o.setAttribute(r,""),o.textContent=t,document.head.prepend(o)}function E(){p("tokens",w)}function j(e){if(typeof e=="string"){if(typeof document>"u")throw new n("bad_request","a selector target needs a DOM");let t=document.querySelector(e);if(!t)throw new n("not_found",`no element matches "${e}"`);return t}if(!e)throw new n("bad_request","a mount target is required");return e}function _(e,t){return function(o,s={}){let a=j(o),u=[],O={element:a,on(c,l,d,b){return c.addEventListener(l,d,b),u.push(()=>c.removeEventListener(l,d,b)),d},own(c){return u.push(c),c}},i;try{i=t(O,a,s)||{}}catch(c){throw S(u,e),c}let f=!1,N=Object.defineProperties({},Object.getOwnPropertyDescriptors(i));return Object.defineProperties(N,{element:{enumerable:!0,value:a},destroyed:{enumerable:!0,get:()=>f},destroy:{enumerable:!0,value:()=>{if(!f){if(f=!0,typeof i.destroy=="function")try{i.destroy()}catch(c){console.error(`[cubby.${e}] destroy threw:`,c)}S(u,e)}}}})}}function S(e,t){for(;e.length;){let r=e.pop();try{r()}catch(o){console.error(`[cubby.${t}] cleanup threw:`,o)}}}var m="cubby";function q(e){return!!(e&&e.fs&&e.identity&&e._pb)}function C(e={}){return e.CubbyError?e:Object.assign(e,{version:"0.1.0",CubbyError:n,toCubbyError:h,escapeHtml:g,sanitizeUrl:x,injectStyle:p,ensureTokens:E,widget:_,hasPlatform:()=>q(e)})}typeof window<"u"&&(window[m]=C(window[m]||{}));})();
