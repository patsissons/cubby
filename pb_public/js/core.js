/* cubby core v0.1.0 (https://github.com/patsissons/cubby) */
(()=>{var n=class extends Error{constructor(e,o,r={}){super(o||e),this.name="CubbyError",this.code=e,r.status&&(this.status=r.status),r.cause&&(this.cause=r.cause)}};function b(t,e="unknown"){if(t instanceof n)return t;let o=t&&typeof t=="object"&&"status"in t?t.status:void 0;return o===401||o===403?new n("auth_required",String(t?.message||t),{cause:t,status:o}):o===404?new n("not_found",String(t?.message||t),{cause:t,status:o}):new n(e,String(t?.message||t),{cause:t,status:o})}var O={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};function g(t){return String(t).replace(/[&<>"']/g,e=>O[e])}var T=/^[a-z][a-z0-9+.-]*:/i,k=/[\x00-\x20\x7f]+/g;function x(t,e={}){if(typeof t!="string")return"";let o=t.replace(k,""),r=T.exec(o);if(!r)return o;let s=r[0].toLowerCase();return s==="http:"||s==="https:"||s==="mailto:"&&!e.image?o:""}var y=t=>["--bg: #16130f;","--fg: #ede9e3;","--muted: #9a938a;","--accent: #e8823f;","--accent-soft: #e8823f26;","--card: #201c17;","--border: #362f27;","--code-bg: #211d18;","--shadow: 0 1px 2px rgb(0 0 0 / 0.3), 0 4px 12px rgb(0 0 0 / 0.25);","--shadow-hover: 0 2px 4px rgb(0 0 0 / 0.35), 0 10px 24px rgb(0 0 0 / 0.4);"].map(e=>t+e).join(`
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
`;function p(t,e){if(typeof document>"u")return;let o=`data-cubby-${t}`;if(document.querySelector(`[${o}]`))return;let r=document.createElement("style");r.setAttribute(o,""),r.textContent=e,document.head.prepend(r)}function E(){p("tokens",w)}function v(t){if(typeof t=="string"){if(typeof document>"u")throw new n("bad_request","a selector target needs a DOM");let e=document.querySelector(t);if(!e)throw new n("not_found",`no element matches "${t}"`);return e}if(!t)throw new n("bad_request","a mount target is required");return t}function _(t,e){return function(r,s={}){let a=v(r),u=[],N={element:a,on(c,h,d,l){return c.addEventListener(h,d,l),u.push(()=>c.removeEventListener(h,d,l)),d},own(c){return u.push(c),c}},i;try{i=e(N,a,s)||{}}catch(c){throw S(u,t),c}let f=!1;return{...i,element:a,get destroyed(){return f},destroy(){if(!f){if(f=!0,typeof i.destroy=="function")try{i.destroy()}catch(c){console.error(`[cubby.${t}] destroy threw:`,c)}S(u,t)}}}}}function S(t,e){for(;t.length;){let o=t.pop();try{o()}catch(r){console.error(`[cubby.${e}] cleanup threw:`,r)}}}var m="cubby";function q(t){return!!(t&&t.fs&&t.identity&&t._pb)}function C(t={}){return t.CubbyError?t:Object.assign(t,{version:"0.1.0",CubbyError:n,toCubbyError:b,escapeHtml:g,sanitizeUrl:x,injectStyle:p,ensureTokens:E,widget:_,hasPlatform:()=>q(t)})}typeof window<"u"&&(window[m]=C(window[m]||{}));})();
