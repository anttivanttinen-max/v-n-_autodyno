(() => {
'use strict';
const MODULE='motolab-live-status-guard-v1';
function boot(){
 const screen=document.getElementById('screen-live');
 if(!screen){setTimeout(boot,80);return}
 screen.classList.remove('screen');screen.classList.add('liveAuxScreen');
 if(!document.getElementById('motolabLiveGuardStyle')){const s=document.createElement('style');s.id='motolabLiveGuardStyle';s.textContent='.liveAuxScreen{display:none;position:relative;z-index:4}.liveAuxScreen.active{display:block}';document.head.appendChild(s)}
 document.querySelectorAll('.nav:not([data-screen="live"])').forEach(b=>b.addEventListener('click',()=>screen.classList.remove('active'),true));
 try{globalThis.MOTOLAB_DIAGNOSTICS?.record?.('live_status_guard_loaded',{module:MODULE})}catch{}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
