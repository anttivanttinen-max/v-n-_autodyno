globalThis.MOTOLAB_RELEASE={version:"34.8",label:"v34.8 BETA",build:"2026-08-18e-cache-reset"};
(() => {
 if(typeof document==='undefined')return;
 const BUILD=globalThis.MOTOLAB_RELEASE.build;
 const LABEL=globalThis.MOTOLAB_RELEASE.label;
 const VERSION=globalThis.MOTOLAB_RELEASE.version;
 document.documentElement.classList.add('ml-early-boot');
 const s=document.createElement('style');s.id='mlEarlyBootStyle';s.textContent=`html.ml-early-boot body>*{visibility:hidden}html.ml-early-boot #motolabBootSplash{visibility:visible!important}#motolabBootSplash{position:fixed;inset:0;z-index:1000000;background:#000;color:#fff;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;opacity:1;transition:opacity .45s ease}#motolabBootSplash.mls-out{opacity:0;pointer-events:none}#motolabBootImage{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:50% 50%;filter:none;background:#000;image-rendering:auto}.mls-version{position:absolute;top:calc(16px + env(safe-area-inset-top));right:14px;z-index:5;padding:7px 10px;border-radius:10px;border:1px solid #ff263f;background:rgba(3,3,4,.94);color:#fff;font-size:11px;font-weight:1000;letter-spacing:.02em;box-shadow:0 4px 18px #000}.mls-version b{color:#ff263f}#motolabBootStatus{position:absolute;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:5;max-width:88vw;padding:7px 11px;border-radius:9px;background:rgba(0,0,0,.74);font-size:9px;font-weight:900;letter-spacing:.12em;text-align:center;white-space:nowrap}.mls-boot-bottom{display:none}#motolabBootPanel{position:absolute;inset:calc(72px + env(safe-area-inset-top)) 12px calc(72px + env(safe-area-inset-bottom));z-index:6;display:flex;align-items:center;justify-content:center;pointer-events:none}#motolabBootPanel.mls-panel-on{pointer-events:auto}.mls-login{width:min(90vw,430px);max-height:72vh;overflow:auto;background:rgba(7,8,11,.94);border:1px solid #ff263f;border-radius:22px;padding:16px;box-shadow:0 24px 70px #000d;text-align:left}.mls-login-title{font-size:20px;font-weight:1000;font-style:italic}.mls-login-copy{margin:7px 0 11px;color:#c2c6cc;font-size:10px;line-height:1.45}.mls-login label{display:block;margin-top:8px;color:#aeb4bc;font-size:9px}.mls-login input{box-sizing:border-box;width:100%;margin-top:5px;padding:12px;border-radius:11px;border:1px solid #42464d;background:#050609;color:#fff;font-size:16px}.mls-login button{width:100%;min-height:52px;margin-top:9px;border-radius:12px;color:#fff;font-weight:1000}.mls-primary{border:1px solid #ff263f;background:#a80d20}.mls-secondary,.mls-ghost{border:1px solid #555;background:#15181d}.mls-msg{min-height:18px;margin-top:9px;font-size:9px;text-align:center}`;document.head.appendChild(s);
 function loadScript(src,key,done){if(document.querySelector(`script[data-${key}]`)){done?.();return}const x=document.createElement('script');x.src=src;x.dataset[key]='1';x.onload=()=>done?.();document.body.appendChild(x)}
 function ensureBootLogic(){const loadSplash=()=>{if(!globalThis.MotoLabSplash&&!document.querySelector('script[data-ml-splash-early]'))loadScript('./splash_boot.js?build='+encodeURIComponent(BUILD),'mlSplashEarly')};if(!navigator.serviceWorker?.controller&&!globalThis.MotoLabUser&&!document.querySelector('script[data-ml-identity-early]'))loadScript('./user_identity.js?build='+encodeURIComponent(BUILD),'mlIdentityEarly',loadSplash);else loadSplash()}
 function applyReleaseLabels(){
   const badge=document.getElementById('appVersionBadge');if(badge)badge.textContent=LABEL;
   const full=document.getElementById('motolabFullVersion');if(full)full.textContent=`VÄNÄ MotorLab ${LABEL} • ${BUILD}`;
   document.title=`VÄNÄ MOTOLAB ${LABEL}`;
 }
 function mount(){
  if(!document.getElementById('motolabBootSplash')){const d=document.createElement('div');d.id='motolabBootSplash';d.innerHTML=`<img id="motolabBootImage" src="./assets/motolab-start-v34.png?build=${encodeURIComponent(BUILD)}" alt="VäNä Motorsport MotorLab"><div class="mls-version"><b>${LABEL}</b></div><div id="motolabBootPanel"></div><div id="motolabBootStatus">LADATAAN MOTORLABIA…</div>`;document.body.prepend(d)}
  document.documentElement.classList.remove('ml-early-boot');applyReleaseLabels();ensureBootLogic();
  setTimeout(applyReleaseLabels,250);setTimeout(applyReleaseLabels,1500);
 }
 async function forceSwUpdate(){
  if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
  try{
   const reg=await navigator.serviceWorker.register('./sw.js?build='+encodeURIComponent(BUILD),{updateViaCache:'none'});
   await reg.update().catch(()=>{});
   if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
   navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='MOTOLAB_SW_ACTIVE'&&e.data.build===BUILD){const k='motolab_sw_reload_'+BUILD;if(!sessionStorage.getItem(k)){sessionStorage.setItem(k,'1');location.reload()}}});
  }catch{}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{mount();forceSwUpdate()},{once:true});else{mount();forceSwUpdate()}
})();
