(() => {
'use strict';
const VERSION='motolab-simple-user-ui-v1';
const TECH_SETTINGS=/KNOWLEDGE BASE|VAIHDE\s*\/\s*RPM\s*\/\s*GPS|BT RPM|OPPIVA DATA|RAW AUDIO|MIC CALIBRATION|JÄRJESTELMÄTESTI/i;
const BASIC_SETTINGS=/SMART BIKE PROFILES|MITTAUS\s*&\s*RPM|AJONEUVO\s*&\s*DYNO|SOVELLUS/i;
let lastRole='';
const $=id=>document.getElementById(id);
function user(){return globalThis.MotoLabUser?.user||null}
function admin(){return user()?.role==='admin'}
function title(panel){return String(panel?.querySelector('.ptitle')?.textContent||'').replace(/\s+/g,' ').trim()}
function style(){if($('mlSimpleUiStyle'))return;const s=document.createElement('style');s.id='mlSimpleUiStyle';s.textContent=`
#screen-settings .panel.ml-accordion{overflow:hidden}
#screen-settings .panel.ml-accordion>.phead{cursor:pointer;user-select:none;border-bottom:0;min-height:48px}
#screen-settings .panel.ml-accordion>.phead:after{content:'›';font-size:21px;color:#ff263f;font-weight:900;transition:transform .15s ease;transform:rotate(90deg)}
#screen-settings .panel.ml-accordion.ml-open>.phead{border-bottom:1px solid rgba(255,255,255,.05)}
#screen-settings .panel.ml-accordion.ml-open>.phead:after{transform:rotate(-90deg)}
#screen-settings .panel.ml-accordion:not(.ml-open)>:not(.phead){display:none!important}
#screen-settings .panel.ml-hidden-user{display:none!important}
body.ml-basic-user #screen-live,body.ml-basic-user .bottomNav .nav[data-screen="live"],body.ml-basic-user .bottomNav .nav[data-screen="autotune"]{display:none!important}
body.ml-basic-user #screen-measure>.panel{display:none!important}
body.ml-basic-user #sensorBtn{display:none!important}
body.ml-basic-user .controls{grid-template-columns:repeat(3,1fr)}
body.ml-basic-user #extMicBtn .lbl{font-size:0}body.ml-basic-user #extMicBtn .lbl:after{content:'MIC';font-size:9px}
body.ml-basic-user #extMicBtn .ico{font-size:20px}
body.ml-basic-user .hero{height:410px}
body.ml-basic-user .heroChartBox{opacity:.72}
body.ml-basic-user .metrics .metric:nth-child(4){display:none!important}
body.ml-basic-user .metrics{grid-template-columns:repeat(3,1fr)}
body.ml-basic-user #screen-settings .tiny{display:none}
body.ml-basic-user #screen-settings .panel[data-ml-kind="measure"] label:has(#manualGear),
body.ml-basic-user #screen-settings .panel[data-ml-kind="measure"] label:has(#autoSensitivity),
body.ml-basic-user #screen-settings .panel[data-ml-kind="measure"] label:has(#autoStopDelay),
body.ml-basic-user #screen-settings .panel[data-ml-kind="measure"] .switchrow:has(#gearLearnToggle){display:none!important}
body.ml-basic-user #screen-settings .panel[data-ml-kind="vehicle"] label:has(#cda),
body.ml-basic-user #screen-settings .panel[data-ml-kind="vehicle"] label:has(#crr),
body.ml-basic-user #screen-settings .panel[data-ml-kind="vehicle"] label:has(#rho),
body.ml-basic-user #screen-settings .panel[data-ml-kind="vehicle"] .switchrow:has(#gridToggle),
body.ml-basic-user #screen-settings .panel[data-ml-kind="vehicle"] .switchrow:has(#infoToggle),
body.ml-basic-user #screen-settings .panel[data-ml-kind="vehicle"] .switchrow:has(#wakeToggle){display:none!important}
.ml-simple-intro{margin:8px 0 2px;padding:11px 12px;border:1px solid #302126;border-radius:13px;background:#08090c;color:#b8bec6;font-size:9px;line-height:1.45}
.ml-simple-intro b{display:block;color:#fff;font-size:11px;margin-bottom:3px}
`;
document.head.appendChild(s)}
function classify(panel){const t=title(panel);if(/SMART BIKE PROFILES/i.test(t))return 'profile';if(/MITTAUS\s*&\s*RPM/i.test(t))return 'measure';if(/AJONEUVO\s*&\s*DYNO/i.test(t))return 'vehicle';if(/SOVELLUS/i.test(t))return 'app';if(TECH_SETTINGS.test(t))return 'technical';return BASIC_SETTINGS.test(t)?'basic':'other'}
function makeAccordion(panel){if(panel.classList.contains('ml-accordion'))return;panel.classList.add('ml-accordion');panel.classList.remove('ml-open');const h=panel.querySelector(':scope > .phead');if(!h)return;h.setAttribute('role','button');h.setAttribute('tabindex','0');h.setAttribute('aria-expanded','false');const toggle=()=>{const on=!panel.classList.contains('ml-open');document.querySelectorAll('#screen-settings .panel.ml-accordion.ml-open').forEach(p=>{if(p!==panel){p.classList.remove('ml-open');p.querySelector(':scope > .phead')?.setAttribute('aria-expanded','false')}});panel.classList.toggle('ml-open',on);h.setAttribute('aria-expanded',String(on))};h.addEventListener('click',e=>{if(e.target.closest('button,input,select,a'))return;toggle()});h.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}})}
function addIntro(){const sec=$('screen-settings');if(!sec||$('mlSimpleSettingsIntro'))return;const d=document.createElement('div');d.id='mlSimpleSettingsIntro';d.className='ml-simple-intro';d.innerHTML='<b>ASETUKSET</b>Avaa vain tarvitsemasi kohta. Perusasetukset on pidetty tarkoituksella lyhyinä.';sec.insertBefore(d,sec.firstChild)}
function simplifySettings(isAdmin){const sec=$('screen-settings');if(!sec)return;addIntro();sec.querySelectorAll(':scope > .panel').forEach(panel=>{const kind=classify(panel);panel.dataset.mlKind=kind;makeAccordion(panel);panel.classList.remove('ml-open');panel.querySelector(':scope > .phead')?.setAttribute('aria-expanded','false');const hide=!isAdmin&&(kind==='technical'||kind==='other');panel.classList.toggle('ml-hidden-user',hide);const t=panel.querySelector('.ptitle');if(!isAdmin&&t){const txt=title(panel);if(/SMART BIKE PROFILES/i.test(txt))t.innerHTML='<span class="r">🏍️</span> PYÖRÄ';else if(/MITTAUS\s*&\s*RPM/i.test(txt))t.innerHTML='<span class="r">🎛️</span> MITTAUS';else if(/AJONEUVO\s*&\s*DYNO/i.test(txt))t.innerHTML='<span class="r">⚙️</span> AJONEUVON TIEDOT';else if(/SOVELLUS/i.test(txt))t.innerHTML='<span class="r">📱</span> SOVELLUS'}})}
function simplifyHome(isAdmin){document.body.classList.toggle('ml-basic-user',!isAdmin);document.body.classList.toggle('ml-admin-user',isAdmin);const liveNav=document.querySelector('.bottomNav .nav[data-screen="live"]');if(liveNav)liveNav.hidden=!isAdmin;const live=$('screen-live');if(live)live.hidden=!isAdmin;if(!isAdmin&&live?.classList.contains('active')){try{globalThis.switchScreen?.('measure')}catch{}}
}
function apply(){style();const isAdmin=admin();const role=isAdmin?'admin':'user';simplifyHome(isAdmin);simplifySettings(isAdmin);lastRole=role;try{globalThis.MOTOLAB_DIAGNOSTICS?.record?.('simple_ui_applied',{module:VERSION,role})}catch{}}
function boot(){apply();let tries=0;const timer=setInterval(()=>{tries++;const role=admin()?'admin':'user';if(role!==lastRole||tries<20)apply();if(tries>60)clearInterval(timer)},500);new MutationObserver(()=>apply()).observe(document.documentElement,{childList:true,subtree:true})}
globalThis.MotoLabSimpleUI={version:VERSION,apply,get role(){return admin()?'admin':'user'}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
