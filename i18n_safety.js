(() => {
'use strict';
const IDS=['tripResearchState','armState','manualState','measureStatus','gearCalStatus','sourceModeStatus','engineHealth'];
function mark(){for(const id of IDS){const e=document.getElementById(id);if(e)e.dataset.i18nSkip='1'}}
function boot(){mark();new MutationObserver(mark).observe(document.documentElement,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
