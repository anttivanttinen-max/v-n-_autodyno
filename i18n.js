(() => {
'use strict';
const VERSION='motolab-i18n-v1';
const LANG_KEY='motolab_language';
const CONSENT_KEY='motolab_v32_beta_consent';
const SUPPORTED=new Set(['fi','en']);
const originalText=new WeakMap(),originalAttrs=new WeakMap();
let applying=false,observer=null,current='fi';

const EN={
'MITTAUS':'MEASURE','VEDOT':'RUNS','LIVE':'LIVE DATA','ANALYYSI':'ANALYSIS','ASETUKSET':'SETTINGS','AUTOTUNE':'AUTOTUNE',
'KÄYTTÄJÄ / BETA':'USER / BETA','Käyttäjä / Beta':'User / Beta','OMA TILI':'MY ACCOUNT','PALAUTE & VIESTIT':'FEEDBACK & MESSAGES','BETA-KESKUSTELU':'BETA COMMUNITY','JAETUT VEDOT':'SHARED RUNS','TESTERITASO':'TESTER LEVEL','KUTSU TESTAAJA':'INVITE TESTER',
'KÄYTTÄJIEN HYVÄKSYNNÄT':'USER APPROVALS','PALAUTTEET':'FEEDBACK','MERIT-ARVIOINTI':'MERIT REVIEW','KÄYTTÖOIKEUDET':'FEATURE ACCESS','YHTEISÖ / DIAGNOSTIIKKA':'COMMUNITY / DIAGNOSTICS','Ylläpito':'Administration','Omat toiminnot':'My tools',
'Kirjautuminen tapahtuu automaattisesti tämän laitteen MotoLab-tunnisteella. Salasanaa ei tarvita.':'Sign-in is automatic with this device’s MotoLab identity. No routine password is required.',
'Nimimerkki, tila ja käyttäjä':'Nickname, status and account','Yksityinen keskustelu ylläpidon kanssa':'Private conversation with the administrator','Ongelmat, ohjeet ja kokemukset':'Issues, guidance and experiences','Jaa ja vertaa graafisia vetoja':'Share and compare graphical run data','Oma beta-testeritasosi':'Your beta tester level','Jaa kutsu sovelluksen jakovalikolla':'Share an invitation with the system share sheet',
'Hyväksy, estä ja tarkista käyttäjät':'Approve, block and review users','Yksityiset käyttäjäkeskustelut':'Private user conversations','Pisteet, ideat ja testeriaktiivisuus':'Scores, ideas and tester activity','Avaa testitoiminnot käyttäjäkohtaisesti':'Grant test features per user','Ongelmaketjut ja admin-diagnostiikka':'Issue threads and private admin diagnostics',
'SULJE':'CLOSE','AVAA':'OPEN','TALLENNA':'SAVE','PERUUTA':'CANCEL','TYHJENNÄ':'CLEAR','RESET DATA':'RESET DATA','AJA TESTIT':'RUN TESTS','PÄIVITÄ LÄHTEET':'REFRESH INPUTS',
'KIELI':'LANGUAGE','SUOMI':'FINNISH','ENGLANTI':'ENGLISH','Suomi':'Finnish','English':'English',
'KIERROSLUKU':'RPM','RPM':'RPM','NOPEUS':'SPEED','VAIHDE':'GEAR','TEHO':'POWER','VÄÄNTÖ':'TORQUE','HUIPPUTEHO':'PEAK POWER','HUIPPUVÄÄNTÖ':'PEAK TORQUE','LAATU':'QUALITY','Profiili':'Profile','PROFIILI':'PROFILE','AJONEUVO':'VEHICLE',
'PÄÄLLÄ':'ON','POIS':'OFF','VALMIS':'READY','TALLENTAA':'RECORDING','ODOTTAA':'WAITING','AKTIIVINEN':'ACTIVE','ESTETTY':'BLOCKED','HYVÄKSYTTY':'ACCEPTED','HYLÄTTY':'REJECTED','VIRHE':'ERROR','VAROITUS':'WARNING',
'KÄYNNISTÄ':'START','ALOITA':'START','PYSÄYTÄ':'STOP','STOP & TALLENNA':'STOP & SAVE','LÄHETÄ':'SEND','VASTAA':'REPLY','HYVÄKSY':'ACCEPT','HYLKÄÄ':'REJECT','POISTA VETO':'DELETE RUN',
'VERTAA':'COMPARE','YHDISTÄ':'MERGE','MYÖS HYLÄTYT':'INCLUDE REJECTED','VERTAA OMAAN VETOON':'COMPARE WITH MY RUN','VERTAA PARHAASEEN OMAAN VETOON':'COMPARE WITH MY BEST RUN','Jaa oma veto':'Share my run','Vetojen jako':'Run sharing','Jaetut vedot':'Shared runs','Oma veto':'My run','Jaettu veto':'Shared run',
'3. VAIHTEEN TESTI':'3RD GEAR TEST','ALOITA 3. VAIHDE':'START 3RD GEAR TEST','MIKÄ VAIHDE KÄYTÖSSÄ?':'WHICH GEAR IS ENGAGED?','OHITA':'SKIP','VAHVISTA':'CONFIRM','VAHVISTETTU':'CONFIRMED','VAIHDE POIKKEAA':'GEAR CHANGED','REFERENSSI':'REFERENCE','OPETUSDATA':'TRAINING DATA',
'ANTURIT':'SENSORS','MIKROFONI':'MICROPHONE','PUHELINMIKKI':'PHONE MIC','AUDIOLÄHDE':'AUDIO INPUT','ADMIN • AUDIOLÄHDE':'ADMIN • AUDIO INPUT','JÄRJESTELMÄN OLETUS':'SYSTEM DEFAULT','LÄHDE':'SOURCE','LUOTTAMUS':'CONFIDENCE','SIGNAALI':'SIGNAL','YHDISTETTY':'CONNECTED','EI YHTEYTTÄ':'DISCONNECTED','PALAUTUS':'RECOVERY',
'RAAKADATA':'RAW DATA','DIAGNOSTIIKKA':'DIAGNOSTICS','TAPAHTUMALOKI':'EVENT LOG','JONO':'QUEUE','SYNKRONOINTI':'SYNC','JÄRJESTELMÄ':'SYSTEM','HUOLTO':'MAINTENANCE','HISTORIA':'HISTORY',
'PALAUTE':'FEEDBACK','KEHITYSIDEA':'FEATURE IDEA','ILMOITA ONGELMASTA':'REPORT AN ISSUE','MINULLA SAMA ONGELMA':'I HAVE THE SAME ISSUE','RATKAISU':'SOLUTION','TOIMIVA RATKAISU':'WORKING SOLUTION','JULKAISE YHTEISÖÖN':'PUBLISH TO COMMUNITY','YKSITYINEN':'PRIVATE','ANONYYMI':'ANONYMOUS',
'BETA TESTER':'BETA TESTER','AKTIIVINEN TESTAAJA':'ACTIVE TESTER','EDISTYNYT TESTAAJA':'ADVANCED TESTER','YDINTES­TAAJA':'CORE TESTER',
'SMART BIKE PROFILES':'SMART BIKE PROFILES','MITTAUS & RPM':'MEASUREMENT & RPM','AJONEUVO & DYNO':'VEHICLE & DYNO','VAIHDE / RPM / GPS KALIBROINTI':'GEAR / RPM / GPS CALIBRATION','BT RPM – LISÄASETUKSET':'BT RPM – ADVANCED SETTINGS','JÄRJESTELMÄTESTI':'SYSTEM TEST','KAASUTTIMEN SÄÄTÖ':'CARBURETOR TUNING','SUUTIN-EHDOTUS':'JETTING SUGGESTION',
'PÄÄLLEKKÄISVERTAILU':'OVERLAY COMPARISON','AVAA KÄYRÄ KOKO NÄYTÖLLE':'OPEN CURVE FULL SCREEN','Dynokäyrä':'Dyno curve','Teho paksu • vääntö ohut • RPM alhaalla':'Power thick • torque thin • RPM below','Napauta käyrää nähdäksesi tarkan pisteen.':'Tap the curve to inspect an exact point.',
'GPS ONLY':'GPS ONLY','BT MIC ONLY':'BT MIC ONLY','AUTO FUSION':'AUTO FUSION','GPS MASTER':'GPS MASTER','MIC LEARN':'MIC LEARN','LIVE DATA':'LIVE DATA','RAW':'RAW','SYNC':'SYNC','GEAR':'GEAR','DYNO / RUN':'DYNO / RUN','SYSTEM':'SYSTEM'
};

const PATTERNS=[
 [/^Ei aktiivista käyttäjäistuntoa$/,'No active user session'],
 [/^Käyttäjä: /,'User: '],[/^Laite: /,'Device: '],[/^Valittu: /,'Selected: '],[/^aktiivinen: /,'active: '],
 [/^VÄNÄ OWNER \/ ADMIN AKTIIVINEN/,'VÄNÄ OWNER / ADMIN ACTIVE'],
 [/^Vahvistetaan (\d)\. /i,(_,g)=>`Confirming gear ${g} • `],
 [/^(\d)\. VAIHDE\?$/i,(_,g)=>`GEAR ${g}?`],[/^3\. VAIHDE$/,'3RD GEAR'],
 [/^VAHVISTETTU (\d)\.$/i,(_,g)=>`CONFIRMED GEAR ${g}`],
 [/^Odottaa hyväksyntää$/,'Pending approval'],[/^Käyttö estetty$/,'Access blocked']
];

function readConsent(){try{return JSON.parse(localStorage.getItem(CONSENT_KEY)||'null')}catch{return null}}
function writeConsentLanguage(lang){try{const c=readConsent()||{};if(c.uiLanguage===lang)return;c.uiLanguage=lang;localStorage.setItem(CONSENT_KEY,JSON.stringify(c))}catch{}}
function initialLanguage(){const l=String(localStorage.getItem(LANG_KEY)||'').toLowerCase();if(SUPPORTED.has(l))return l;const c=readConsent(),cl=String(c?.uiLanguage||'').toLowerCase();if(SUPPORTED.has(cl)){localStorage.setItem(LANG_KEY,cl);return cl}return 'fi'}
function translateText(s){if(current!=='en')return s;if(Object.prototype.hasOwnProperty.call(EN,s))return EN[s];for(const [r,v] of PATTERNS){const m=s.match(r);if(m)return typeof v==='function'?v(...m):s.replace(r,v)}return s}
function shouldSkip(n){const p=n?.parentElement;if(!p)return false;return /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE|PRE)$/i.test(p.tagName)||p.closest?.('[data-i18n-skip="1"]')}
function textNode(n){if(!n||n.nodeType!==3||shouldSkip(n))return;const val=n.nodeValue;if(!val||!val.trim())return;if(!originalText.has(n))originalText.set(n,val);const base=originalText.get(n);n.nodeValue=current==='fi'?base:translateText(base)}
function attrs(el){if(!el||el.nodeType!==1)return;for(const a of ['placeholder','title','aria-label']){if(!el.hasAttribute(a))continue;let o=originalAttrs.get(el);if(!o){o={};originalAttrs.set(el,o)}if(!(a in o))o[a]=el.getAttribute(a);el.setAttribute(a,current==='fi'?o[a]:translateText(o[a]))}}
function walk(root=document.body){if(!root)return;if(root.nodeType===3)return textNode(root);if(root.nodeType!==1&&root.nodeType!==9&&root.nodeType!==11)return;if(root.nodeType===1)attrs(root);const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n;while((n=w.nextNode())){if(n.nodeType===3)textNode(n);else attrs(n)}}
function apply(){if(applying)return;applying=true;try{document.documentElement.lang=current;walk(document.body);document.querySelectorAll('[data-motolab-language-select]').forEach(s=>{if(s.value!==current)s.value=current})}finally{applying=false}}
function setLanguage(lang,{persist=true}={}){lang=String(lang||'fi').toLowerCase();if(!SUPPORTED.has(lang))lang='fi';current=lang;if(persist){localStorage.setItem(LANG_KEY,lang);writeConsentLanguage(lang)}apply();window.dispatchEvent(new CustomEvent('motolab-language-change',{detail:{language:lang,version:VERSION}}));return current}
function t(fi){return current==='en'?translateText(String(fi??'')):String(fi??'')}
function boot(){current=initialLanguage();apply();observer=new MutationObserver(ms=>{if(applying)return;for(const m of ms){if(m.type==='characterData')textNode(m.target);else{m.addedNodes.forEach(walk);if(m.target?.nodeType===1)attrs(m.target)}}});observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});setInterval(()=>{const c=String(readConsent()?.uiLanguage||'').toLowerCase();if(!localStorage.getItem(LANG_KEY)&&SUPPORTED.has(c)&&c!==current)setLanguage(c,{persist:false})},3000)}

globalThis.MotoLabI18n={version:VERSION,t,setLanguage,apply,get language(){return current},supported:['fi','en'],key:LANG_KEY};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
