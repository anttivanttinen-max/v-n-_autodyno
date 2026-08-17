(() => {
'use strict';
const VERSION='motorlab-i18n-v1';
const KEY='motolab_language';
const FI='fi',EN='en';
const exact={
'MITTAUS':'MEASURE','ETUSIVU':'HOME','VEDOT':'RUNS','ANALYYSI':'ANALYSIS','ASETUKSET':'SETTINGS','KÄYTTÄJÄ':'USER','KÄYTTÄJÄ / BETA':'USER / BETA','LIVE / ANTURIT':'LIVE / SENSORS','LIVE':'LIVE DATA',
'NOPEUS':'SPEED','TEHO':'POWER','VÄÄNTÖ':'TORQUE','VAIHDE':'GEAR','VALMIS':'READY','POIS':'OFF','PÄÄLLÄ':'ON','ANTURIT':'SENSORS','BT KUULOKE':'MIC','ARM AUTO':'ARM AUTO','MANUAALI':'MANUAL','PYSÄYTÄ':'STOP','STOP':'STOP',
'VETO':'RUN','VERTAA':'COMPARE','YHDISTÄ':'MERGE','MYÖS HYLÄTYT':'INCLUDE REJECTED','PÄÄLLEKKÄISVERTAILU':'OVERLAY COMPARISON','AVAA':'OPEN','SULJE':'CLOSE','POISTA VETO':'DELETE RUN','AVAA KÄYRÄ KOKO NÄYTÖLLE':'OPEN FULL-SCREEN CURVE',
'KAASUTTIMEN SÄÄTÖ':'CARBURETOR TUNING','SUUTIN-EHDOTUS':'JETTING SUGGESTION','TALLENNA SÄÄTÖ':'SAVE TUNE','LASKE EHDOTUS':'CALCULATE SUGGESTION',
'PYÖRÄ':'BIKE','MITTAUS & RPM':'MEASUREMENT & RPM','AJONEUVON TIEDOT':'VEHICLE DETAILS','SOVELLUS':'APP','KIELI':'LANGUAGE','SUOMI':'FINNISH','ENGLANTI':'ENGLISH',
'TALLENNA ASETUKSET':'SAVE SETTINGS','UUSI':'NEW','ASENNA / OHJE':'INSTALL / HELP','KOKO NÄYTTÖ':'FULL SCREEN','TALLENNA':'SAVE','PERUUTA':'CANCEL','TYHJENNÄ':'CLEAR',
'OMA TILI':'MY ACCOUNT','PALAUTE & VIESTIT':'FEEDBACK & MESSAGES','BETA-KESKUSTELU':'BETA COMMUNITY','BETA-YHTEISÖ':'BETA COMMUNITY','JAETUT VEDOT':'SHARED RUNS','TESTERITASO':'TESTER LEVEL','KUTSU TESTAAJA':'INVITE TESTER','KÄYTTÄJIEN HYVÄKSYNNÄT':'USER APPROVALS','PALAUTTEET':'FEEDBACK','MERIT-ARVIOINTI':'MERIT REVIEW','KÄYTTÖOIKEUDET':'FEATURE ACCESS','YHTEISÖ / DIAGNOSTIIKKA':'COMMUNITY / DIAGNOSTICS',
'3. VAIHTEEN TESTI':'3RD GEAR TEST','MIKÄ VAIHDE KÄYTÖSSÄ?':'WHICH GEAR IS ENGAGED?','OHITA':'SKIP','VAHVISTA':'CONFIRM','OPETUSDATA':'TRAINING DATA','REFERENSSI':'REFERENCE',
'DIAGNOSTIIKKA':'DIAGNOSTICS','TAPAHTUMALOKI':'EVENT LOG','SYNKRONOINTI':'SYNC','RAAKADATA':'RAW DATA','JÄRJESTELMÄ':'SYSTEM','VIRHE':'ERROR','VAROITUS':'WARNING','LUOTTAMUS':'CONFIDENCE','AUDIOLÄHDE':'AUDIO INPUT','LÄHDE':'SOURCE',
'ODOTTAA HYVÄKSYNTÄÄ':'PENDING APPROVAL','AKTIIVINEN':'ACTIVE','ESTETTY':'BLOCKED','ILMOITA ONGELMASTA':'REPORT AN ISSUE','LÄHETÄ':'SEND','VASTAA':'REPLY','MINULLA SAMA ONGELMA':'I HAVE THE SAME ISSUE','RATKAISU':'SOLUTION','TOIMIVA RATKAISU':'WORKING SOLUTION','YKSITYINEN':'PRIVATE','ANONYYMI':'ANONYMOUS'
};
const reverse=Object.fromEntries(Object.entries(exact).map(([a,b])=>[b,a]));
const $=id=>document.getElementById(id);
function lang(){return localStorage.getItem(KEY)==='en'?EN:FI}
function setLang(v){const next=v===EN?EN:FI;localStorage.setItem(KEY,next);document.documentElement.lang=next;apply();document.dispatchEvent(new CustomEvent('motorlab-language-change',{detail:{language:next}}));try{globalThis.MOTOLAB_DIAGNOSTICS?.record?.('language_changed',{language:next,module:VERSION})}catch{}return next}
function translateText(s,to){const raw=String(s||'');const trimmed=raw.trim();if(!trimmed)return raw;const dict=to===EN?exact:reverse;if(dict[trimmed])return raw.replace(trimmed,dict[trimmed]);let out=raw;const pairs=Object.entries(dict).sort((a,b)=>b[0].length-a[0].length);for(const [a,b] of pairs){if(out.includes(a))out=out.split(a).join(b)}return out}
function skip(el){return !el||['SCRIPT','STYLE','TEXTAREA','INPUT','OPTION'].includes(el.parentElement?.tagName)||el.parentElement?.dataset?.i18nSkip==='1'}
function translateRoot(root=document.body){const to=lang();const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const n of nodes){if(skip(n))continue;if(!n.parentElement.dataset.mlFiText&&to===EN)n.parentElement.dataset.mlFiText=n.nodeValue;const src=to===FI?(n.parentElement.dataset.mlFiText||n.nodeValue):n.nodeValue;n.nodeValue=translateText(src,to)}document.querySelectorAll('input[placeholder]').forEach(el=>{if(!el.dataset.mlFiPlaceholder)el.dataset.mlFiPlaceholder=el.getAttribute('placeholder')||'';el.placeholder=to===EN?translateText(el.dataset.mlFiPlaceholder,EN):el.dataset.mlFiPlaceholder});document.querySelectorAll('option').forEach(o=>{if(!o.dataset.mlFiText)o.dataset.mlFiText=o.textContent;o.textContent=to===EN?translateText(o.dataset.mlFiText,EN):o.dataset.mlFiText})}
function selector(){const sec=$('screen-settings');if(!sec||$('motorlabLanguagePanel'))return;const p=document.createElement('div');p.className='panel';p.id='motorlabLanguagePanel';p.dataset.mlOriginalTitle='KIELI';p.innerHTML='<div class="phead"><div class="ptitle"><span class="r">🌐</span> KIELI</div></div><div class="form"><label class="full">Kieli / Language<select id="motorlabLanguage"><option value="fi">Suomi</option><option value="en">English</option></select></label></div><div class="statusbox">Kielen vaihto ei käynnistä antureita tai mittausta uudelleen.</div>';const app=[...sec.querySelectorAll(':scope > .panel')].find(x=>/SOVELLUS/i.test(x.textContent||''));sec.insertBefore(p,app||sec.firstChild);const sel=$('motorlabLanguage');sel.value=lang();sel.onchange=()=>setLang(sel.value);globalThis.MotoLabSimpleUI?.apply?.()}
function apply(){document.documentElement.lang=lang();selector();translateRoot();const sel=$('motorlabLanguage');if(sel)sel.value=lang()}
function boot(){apply();let busy=false;new MutationObserver(()=>{if(busy)return;busy=true;requestAnimationFrame(()=>{apply();busy=false})}).observe(document.documentElement,{subtree:true,childList:true});setInterval(()=>{const sel=$('motorlabLanguage');if(sel&&sel.value!==lang())sel.value=lang()},2000)}
globalThis.MotorLabI18n={version:VERSION,get language(){return lang()},setLanguage:setLang,apply,t:(s)=>translateText(s,lang())};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
