(() => {
'use strict';
const VERSION='motorlab-branding-v1';
const ASSET='./assets/motorlab_splash_approved.webp';
const $=id=>document.getElementById(id);
function style(){if($('motorlabBrandStyle'))return;const s=document.createElement('style');s.id='motorlabBrandStyle';s.textContent=`
body.ml-splash-open{overflow:hidden!important}
#motorlabSplash{position:fixed;inset:0;z-index:500000;background:#000;display:flex;align-items:center;justify-content:center;opacity:1;transition:opacity .35s ease;pointer-events:none}
#motorlabSplash.ml-hide{opacity:0}
#motorlabSplash img{width:100%;height:100%;object-fit:cover;object-position:center center;display:block}
#motorlabSplashVersion{position:absolute;left:50%;bottom:calc(15px + env(safe-area-inset-bottom));transform:translateX(-50%);padding:5px 9px;border-radius:999px;border:1px solid rgba(255,38,63,.45);background:rgba(0,0,0,.55);backdrop-filter:blur(8px);color:#ddd;font:800 9px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;letter-spacing:.08em}
.brand{font-size:0!important;display:flex;align-items:baseline;gap:3px}.brand:before{content:'VäNä';font-size:13px;color:#fff;font-weight:1000;font-style:italic}.brand:after{content:'MotorLab';font-size:13px;color:#ff263f;font-weight:1000;font-style:italic}
.logo1{font-size:0!important}.logo1:after{content:'VäNä';font-size:48px;line-height:.9;color:#fff;font-weight:1000;font-style:italic;letter-spacing:-3px}.logo2{font-size:0!important}.logo2:after{content:'MotorLab';font-size:35px;line-height:.9;color:#ff263f;font-weight:1000;font-style:italic;letter-spacing:-2px}
`;
document.head.appendChild(s)}
function relabel(){document.title=`VäNä MotorLab ${globalThis.MOTOLAB_RELEASE?.label||''}`.trim();document.querySelectorAll('.brand').forEach(b=>b.setAttribute('aria-label','VäNä MotorLab'));const fv=$('motolabFullVersion');if(fv)fv.textContent=`VÄNÄ MOTORLAB ${globalThis.MOTOLAB_RELEASE?.label||''} • build ${globalThis.MOTOLAB_RELEASE?.build||''}`}
function splash(){if($('motorlabSplash'))return;const now=Date.now(),prev=Number(sessionStorage.getItem('motorlab_splash_seen_at')||0);if(now-prev<30000)return;sessionStorage.setItem('motorlab_splash_seen_at',String(now));const el=document.createElement('div');el.id='motorlabSplash';el.innerHTML=`<img src="${ASSET}" alt="VäNä Motorsport MotorLab"><div id="motorlabSplashVersion">${globalThis.MOTOLAB_RELEASE?.label||''}</div>`;document.body.classList.add('ml-splash-open');document.body.appendChild(el);const born=performance.now();const close=()=>{const wait=Math.max(0,1100-(performance.now()-born));setTimeout(()=>{el.classList.add('ml-hide');setTimeout(()=>{el.remove();document.body.classList.remove('ml-splash-open')},380)},wait)};if(document.readyState==='complete')close();else window.addEventListener('load',close,{once:true});setTimeout(close,1800)}
function boot(){style();relabel();splash();new MutationObserver(relabel).observe(document.documentElement,{subtree:true,childList:true})}
globalThis.MotorLabBranding={version:VERSION,apply:relabel,showSplash:splash};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
