(() => {
'use strict';
const MODULE_VERSION='v32-beta-release-1';
const CONSENT_KEY='motolab_v32_beta_consent';
const DEV_KEY='motolab_v32_dev_unlocked';
const LEARNING_KEY='motolab_v29_learning_enabled';
const $=id=>document.getElementById(id);

function forceLearningOn(){
  try{localStorage.setItem(LEARNING_KEY,'1')}catch{}
  try{if(typeof learningEnabled!=='undefined')learningEnabled=true}catch{}
  const el=$('learningEnabled')||$('learningToggle');
  if(el){el.classList.add('on');el.setAttribute('aria-checked','true')}
}
function consent(){try{return JSON.parse(localStorage.getItem(CONSENT_KEY)||'null')}catch{return null}}
function setConsent(v){localStorage.setItem(CONSENT_KEY,JSON.stringify(v))}
function devOn(){return localStorage.getItem(DEV_KEY)==='1'}
function setDev(on){localStorage.setItem(DEV_KEY,on?'1':'0');document.body.classList.toggle('dev-mode',on);document.body.classList.toggle('beta-user-mode',!on);toast(on?'KEHITTÄJÄTILA AVATTU':'Käyttäjätila käytössä')}
function toast(text){let e=$('betaToast');if(!e){e=document.createElement('div');e.id='betaToast';document.body.appendChild(e)}e.textContent=text;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),1800)}
function advancedPanel(p){const t=(p.querySelector('.ptitle')?.textContent||p.textContent||'').toUpperCase();return /RAW AUTO SYNC|AUTO RESEARCH SYNC|3\. VAIHTEEN GPS|OPPIMIS|RAAKA|ALGORITMI|DEVELOPER|DEBUG|MIC.*CANDIDATE|GPS.*KALIBROINTI/.test(t)}
function applyMode(){document.body.classList.toggle('dev-mode',devOn());document.body.classList.toggle('beta-user-mode',!devOn());document.querySelectorAll('#screen-settings>.panel, .devOnly').forEach(e=>{if(e.classList.contains('devOnly')||advancedPanel(e))e.classList.toggle('beta-hidden',!devOn())});forceLearningOn()}
function installUnlock(){let clicks=[];const hit=()=>{const now=Date.now();clicks=clicks.filter(t=>now-t<2600);clicks.push(now);if(clicks.length>=7){clicks=[];setDev(!devOn());applyMode()}};const wire=()=>{const targets=[document.querySelector('.ver'),$('motolabFullVersion')].filter(Boolean);if(!targets.length)return false;targets.forEach(e=>{if(e.dataset.betaUnlock)return;e.dataset.betaUnlock='1';e.style.cursor='pointer';e.addEventListener('click',hit)});return true};if(!wire())setTimeout(wire,400)}
async function requestPermissions(){
  const status=$('betaPermissionStatus');if(status)status.textContent='Pyydetään GPS- ja mikrofoniluvat…';
  let gps='ei tuettu',mic='ei tuettu';
  if(navigator.geolocation){try{await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(()=>{gps='sallittu';resolve()},e=>{gps='estetty';reject(e)},{enableHighAccuracy:true,timeout:12000,maximumAge:0}))}catch{}}
  if(navigator.mediaDevices?.getUserMedia){try{const s=await navigator.mediaDevices.getUserMedia({audio:true});mic='sallittu';s.getTracks().forEach(t=>t.stop())}catch{mic='estetty'}}
  if(status)status.textContent=`GPS: ${gps} • Mikrofoni: ${mic}`;
  setTimeout(autoEnableSensors,80);
}
function clickIfOff(ids){for(const id of ids){const b=$(id);if(!b)continue;const on=b.classList.contains('on')||b.getAttribute('aria-pressed')==='true';if(!on){try{b.click()}catch{}}return}}
function autoEnableSensors(){clickIfOff(['gpsBtn','gpsToggle','gps']);clickIfOff(['phoneMicBtn','micBtn','phoneMicToggle']);forceLearningOn()}
function installConsent(){if(consent()?.accepted){autoEnableSensors();return}if($('betaConsentOverlay'))return;const o=document.createElement('div');o.id='betaConsentOverlay';o.innerHTML=`<div class="betaConsentCard"><div class="betaLogo">VÄNÄ <b>MotoLab</b> BETA</div><h2>Testikäytön luvat</h2><p>MotoLab käyttää GPS:ää nopeuteen, dynolaskentaan ja Gear Learniin. Mikrofonia käytetään moottorin taajuuksien ja harmonisten oppimiseen. GPS säilyy RPM:n ohjaavana lähteenä.</p><p>Jatkuva tekninen oppimis- ja RAW-data pidetään päällä beta-testissä. Kun pilvisynkkaus on käytössä, teknistä mittausdataa voidaan lähettää MotoLabin kehityspalvelimelle virheiden löytämiseen ja algoritmien parantamiseen. Kuunneltavaa puheääntä ei tallenneta tähän RAW-oppimisdataan.</p><p class="betaSmall">Voit tarkistaa luvat myöhemmin asetuksista. Käyttöjärjestelmä näyttää omat GPS- ja mikrofonilupansa erikseen.</p><div id="betaPermissionStatus" class="betaStatus">GPS ja mikrofoni kysytään hyväksynnän jälkeen.</div><button id="betaAccept" class="action">HYVÄKSY JA JATKA</button></div>`;document.body.appendChild(o);$('betaAccept').onclick=async()=>{setConsent({accepted:true,at:new Date().toISOString(),version:MODULE_VERSION,learning:true,rawTechnicalData:true,microphoneFeatures:true});forceLearningOn();await requestPermissions();o.remove();applyMode();if(typeof addLearningEvent==='function')addLearningEvent('beta_consent_accepted',{module:MODULE_VERSION})}}
function installStyles(){if($('betaReleaseStyles'))return;const s=document.createElement('style');s.id='betaReleaseStyles';s.textContent=`body.beta-user-mode .beta-hidden{display:none!important}#betaConsentOverlay{position:fixed;inset:0;z-index:200000;background:rgba(0,0,0,.94);display:flex;align-items:flex-end;justify-content:center;padding:12px}.betaConsentCard{width:min(100%,440px);border:1px solid #ff263f;border-radius:22px;background:linear-gradient(#15161b,#07080b);padding:18px;color:#fff;box-shadow:0 20px 70px #000}.betaConsentCard h2{margin:10px 0;font-size:20px}.betaConsentCard p{font-size:11px;line-height:1.55;color:#d8dbe0}.betaConsentCard .action{width:100%;margin-top:12px}.betaLogo{font-weight:1000;font-style:italic;font-size:18px}.betaLogo b{color:#ff263f}.betaSmall{color:#9da3ab!important;font-size:9px!important}.betaStatus{padding:9px;border:1px solid #33242a;background:#090a0d;border-radius:10px;font-size:9px;color:#cbd0d6}#betaToast{position:fixed;top:calc(12px + env(safe-area-inset-top));left:50%;transform:translate(-50%,-20px);z-index:220000;background:#11151a;border:1px solid #ff263f;color:#fff;border-radius:999px;padding:9px 14px;font:900 9px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;opacity:0;pointer-events:none;transition:.18s}#betaToast.show{opacity:1;transform:translate(-50%,0)}`;document.head.appendChild(s)}
function boot(){installStyles();forceLearningOn();installUnlock();installConsent();applyMode();const mo=new MutationObserver(()=>applyMode());mo.observe(document.body,{childList:true,subtree:true});setInterval(forceLearningOn,4000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
