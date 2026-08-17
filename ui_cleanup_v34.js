(() => {
'use strict';
const VERSION='motolab-ui-cleanup-v34.0';
const LEGACY_IDS=['mlBetaMenuBtn','motolabUserPill','motolabFeedbackBtn','motolabAdminFeedbackBtn','mlCommunityPill'];
function hide(){for(const id of LEGACY_IDS){const e=document.getElementById(id);if(e){e.hidden=true;e.setAttribute('aria-hidden','true');e.style.setProperty('display','none','important')}}}
function boot(){const s=document.createElement('style');s.id='motolabV34CleanupStyle';s.textContent='#mlBetaMenuBtn,#motolabUserPill,#motolabFeedbackBtn,#motolabAdminFeedbackBtn,#mlCommunityPill{display:none!important}';document.head.appendChild(s);hide();new MutationObserver(hide).observe(document.documentElement,{childList:true,subtree:true})}
globalThis.MotoLabUiCleanup={version:VERSION,hide};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
