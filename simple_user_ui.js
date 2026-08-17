(() => {
'use strict';
const VERSION='motorlab-simple-user-ui-v34';
const TECH_SETTINGS=/KNOWLEDGE BASE|VAIHDE\s*\/\s*RPM\s*\/\s*GPS|BT RPM|OPPIVA DATA|RAW AUDIO|MIC CALIBRATION|JÄRJESTELMÄTESTI/i;
let lastScreen='';
const $=id=>document.getElementById(id);
function user(){return globalThis.MotoLabUser?.user||null}
function admin(){return user()?.role==='admin'}
function originalTitle(panel){return panel?.dataset?.mlOriginalTitle||String(panel?.querySelector('.ptitle')?.textContent||'').replace(/\s+/g,' ').trim()}
function css(){if($('mlSimpleUiStyle'))return;const s=document.createElement('style');s.id='mlSimpleUiStyle';s.textContent=`
:root{--ml-bottom-nav-h:76px}
.app{padding-bottom:calc(var(--ml-bottom-nav-h) + 28px + env(safe-area-inset-bottom))!important}
.bottomNav{position:fixed!important;left:50%;transform:translateX(-50%);bottom:calc(7px + env(safe-area-inset-bottom));width:min(calc(100vw - 16px),424px);z-index:118000;margin:0!important;background:rgba(5,5,7,.88)!important;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 14px 40px #000c;border-color:#3a2428!important}
.screen{padding-bottom:20px}.screen:after{content:'';display:block;height:12px}
#screen-settings .panel.ml-accordion{overflow:hidden}
#screen-settings .panel.ml-accordion>.phead{cursor:pointer;user-select:none;border-bottom:0;min-height:49px}
#screen-settings .panel.ml-accordion>.phead:after{content:'›';font-size:22px;color:#ff263f;font-weight:1000;transition:transform .15s ease;transform:rotate(90deg)}
#screen-settings .panel.ml-accordion.ml-open>.phead{border-bottom:1px solid rgba(255,255,255,.06)}
#screen-settings .panel.ml-accordion.ml-open>.phead:after{transform:rotate(-90deg)}
#screen-settings .panel.ml-accordion:not(.ml-open)>:not(.phead){display:none!important}
#screen-settings .panel.ml-hidden-user{display:none!important}
body.ml-basic-user #screen-live,body.ml-basic-user .bottomNav .nav[data-screen="live"],body.ml-basic-user .bottomNav .nav[data-screen="autotune"]{display:none!important}
body.ml-basic-user #screen-measure>.panel{display:none!important}
body.ml-basic-user #sensorBtn{display:none!important}
body.ml-basic-user .controls{grid-template-columns:repeat(4,1fr)}
body.ml-basic-user #extMicBtn .lbl{font-size:0}body.ml-basic-user #extMicBtn .lbl:after{content:'MIC';font-size:9px}
body.ml-basic-user #extMicBtn .ico{font-size:20px}
body.ml-basic-user .metrics .metric:nth-child(4){display:none!important}
body.ml-basic-user .metrics{grid-template-columns:repeat(3,1fr)}
body.ml-basic-user #screen-settings .tiny{display:none!important}
body.ml-basic-user #screen-settings .panel[data-ml-kind="measure"] label:has(#manualGear),
body.ml-basic-user #screen-settings .panel[data-ml-kind="measure"] label:has(#autoSensitivity),
body.ml-basic-user #screen-settings .panel[data-ml-kind="measure"] label:has(#autoStopDelay),
body.ml-basic-user #screen-settings .panel[data-ml-kind="measure"] .switchrow:has(#gearLearnToggle),
body.ml-basic-user #screen-settings .panel[data-ml-kind="vehicle"] label:has(#cda),
body.ml-basic-user #screen-settings .panel[data-ml-kind="vehicle"] label:has(#crr),
body.ml-basic-user #screen-settings .panel[data-ml-kind="vehicle"] label:has(#rho),
body.ml-basic-user #screen-settings .panel[data-ml-kind="vehicle"] .switchrow:has(#gridToggle),
body.ml-basic-user #screen-settings .panel[data-ml-kind="vehicle"] .switchrow:has(#infoToggle),
body.ml-basic-user #screen-settings .panel[data-ml-kind="vehicle"] .switchrow:has(#wakeToggle){display:none!important}
.ml-simple-intro{margin:8px 0 2px;padding:11px 12px;border:1px solid #302126;border-radius:13px;background:rgba(8,9,12,.9);color:#b8bec6;font-size:9px;line-height:1.45}.ml-simple-intro b{display:block;color:#fff;font-size:11px;margin-bottom:3px}
#mlBetaMenuBtn,#motolabUserPill{display:none!important}
.bottomNav .ml-user-nav .ico{font-size:18px}
body.ml-basic-user .hero{background:linear-gradient(180deg,rgba(7,5,6,.62),rgba(4,3,4,.42))}
body.ml-basic-user .heroChartBox{opacity:.5}
`;
document.head.appendChild(s)}
function classify(panel){const t=originalTitle(panel);if(/SMART BIKE PROFILES/i.test(t))return 'profile';if(/MITTAUS\s*&\s*RPM/i.test(t))return 'measure';if(/AJONEUVO\s*&\s*DYNO/i.test(t))return 'vehicle';if(/SOVELLUS/i.test(t))return 'app';if(TECH_SETTINGS.test(t))return 'technical';return 'other'}
function closeAll(except=null){document.querySelectorAll('#screen-settings .panel.ml-accordion.ml-open').forEach(p=>{if(p===except)return;p.classList.remove('ml-open');p.querySelector(':scope > .phead')?.setAttribute('aria-expanded','false')})}
function makeAccordion(panel){if(panel.classList.contains('ml-accordion'))return;panel.classList.add('ml-accordion');const h=panel.querySelector(':scope > .phead');if(!h)return;h.setAttribute('role','button');h.setAttribute('tabindex','0');h.setAttribute('aria-expanded','false');const toggle=()=>{const open=!panel.classList.contains('ml-open');closeAll(panel);panel.classList.toggle('ml-open',open);h.setAttribute('aria-expanded',String(open))};h.addEventListener('click',e=>{if(!e.target.closest('button,input,select,a'))toggle()});h.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}})}
function rename(panel,isAdmin){if(isAdmin)return;const t=panel.querySelector('.ptitle');if(!t)return;const x=originalTitle(panel);if(/SMART BIKE PROFILES/i.test(x))t.innerHTML='<span class="r">🏍️</span> PYÖRÄ';else if(/MITTAUS\s*&\s*RPM/i.test(x))t.innerHTML='<span class="r">🎛️</span> MITTAUS';else if(/AJONEUVO\s*&\s*DYNO/i.test(x))t.innerHTML='<span class="r">⚙️</span> AJONEUVON TIEDOT';else if(/SOVELLUS/i.test(x))t.innerHTML='<span class="r">📱</span> SOVELLUS'}
function settings(isAdmin){const sec=$('screen-settings');if(!sec)return;if(!$('mlSimpleSettingsIntro')){const n=document.createElement('div');n.id='mlSimpleSettingsIntro';n.className='ml-simple-intro';n.innerHTML='<b>ASETUKSET</b>Avaa vain tarvitsemasi kohta. Vain yksi valikko on auki kerrallaan.';sec.insertBefore(n,sec.firstChild)}sec.querySelectorAll(':scope > .panel').forEach(panel=>{if(!panel.dataset.mlOriginalTitle)panel.dataset.mlOriginalTitle=String(panel.querySelector('.ptitle')?.textContent||'').replace(/\s+/g,' ').trim();const kind=classify(panel);panel.dataset.mlKind=kind;makeAccordion(panel);panel.classList.toggle('ml-hidden-user',!isAdmin&&(kind==='technical'||kind==='other'));rename(panel,isAdmin)})}
function nav(isAdmin){const n=document.querySelector('.bottomNav');if(!n)return;const measure=n.querySelector('.nav[data-screen="measure"] .txt');if(measure)measure.textContent='ETUSIVU';const runs=n.querySelector('.nav[data-screen="runs"] .txt');if(runs)runs.textContent='VEDOT';const ana=n.querySelector('.nav[data-screen="analysis"] .txt');if(ana)ana.textContent='ANALYYSI';const set=n.querySelector('.nav[data-screen="settings"] .txt');if(set)set.textContent='ASETUKSET';let u=n.querySelector('.ml-user-nav');if(!u){u=document.createElement('button');u.className='nav ml-user-nav';u.type='button';u.innerHTML='<div class="ico">👤</div><div class="txt">KÄYTTÄJÄ</div>';u.onclick=()=>globalThis.MotoLabBetaMenu?.open?.();n.appendChild(u)}const live=n.querySelector('.nav[data-screen="live"]');if(live)live.hidden=!isAdmin;const auto=n.querySelector('.nav[data-screen="autotune"]');if(auto)auto.hidden=true}
function home(isAdmin){document.body.classList.toggle('ml-basic-user',!isAdmin);document.body.classList.toggle('ml-admin-user',isAdmin);const live=$('screen-live');if(live)live.hidden=!isAdmin}
function currentScreen(){return document.querySelector('.screen.active')?.id||''}
function apply(){css();const isAdmin=admin();home(isAdmin);settings(isAdmin);nav(isAdmin);const now=currentScreen();if(now==='screen-settings'&&lastScreen!=='screen-settings')closeAll();if(lastScreen==='screen-settings'&&now!=='screen-settings')closeAll();lastScreen=now;try{globalThis.MOTOLAB_DIAGNOSTICS?.record?.('simple_ui_applied',{module:VERSION,role:isAdmin?'admin':'user'})}catch{}}
function boot(){apply();let tries=0;const t=setInterval(()=>{apply();if(++tries>80)clearInterval(t)},400);new MutationObserver(()=>apply()).observe(document.documentElement,{childList:true,subtree:true})}
globalThis.MotoLabSimpleUI={version:VERSION,apply,closeSettings:closeAll,get role(){return admin()?'admin':'user'}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
