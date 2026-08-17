(() => {
'use strict';
const MODULE_VERSION='v34-ui-compact-2';
const $u=id=>document.getElementById(id);
// Settings accordion ownership moved to simple_user_ui.js. This module only keeps
// the quick BT microphone presentation so two DOM controllers cannot fight each other.
function installQuickBtMic(){const btn=$u('extMicBtn');if(!btn)return false;const label=btn.querySelector('.lbl');if(label&&!label.dataset.compactLabel){label.textContent='BT MIC';label.dataset.compactLabel='1'}btn.setAttribute('aria-label','BT MIC päälle tai pois');btn.title='BT MIC päälle / pois suoraan etusivulta';return true}
function installStyles(){if($u('compactUiStyles'))return;const style=document.createElement('style');style.id='compactUiStyles';style.textContent=`#extMicBtn.on{box-shadow:0 0 0 1px rgba(59,240,107,.2),0 0 18px rgba(59,240,107,.10)}`;document.head.appendChild(style)}
function boot(){installStyles();if(!installQuickBtMic()){setTimeout(boot,180);return}if(typeof addLearningEvent==='function')addLearningEvent('ui_compact_loaded',{module:MODULE_VERSION,settingsAccordionOwner:'simple_user_ui'})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
