(() => {
'use strict';
const VERSION='motorlab-branding-v6-no-splash';
function release(){if(globalThis.MotorLabStartupReady)return;globalThis.MotorLabStartupReady=true;document.dispatchEvent(new CustomEvent('motorlab-startup-ready'))}
function relabel(){document.title=`VäNä MotorLab ${globalThis.MOTOLAB_RELEASE?.label||''}`.trim()}
function boot(){relabel();document.getElementById('motorlabSplash')?.remove();document.body?.classList.remove('ml-splash-open');release()}
globalThis.MotorLabBranding={version:VERSION,apply:relabel,showSplash:()=>{}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
