(() => {
'use strict';
const VERSION='motolab-raw-data-ui-light-v3-dual-sync';
const DB_NAME='VanaMotoLabResearch',DB_VERSION=1,SENT_KEY='motolab_research_raw_sent_v1';
const $=id=>document.getElementById(id);
function reqP(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function sentSet(){try{return new Set(JSON.parse(localStorage.getItem(SENT_KEY)||'[]'))}catch{return new Set()}}
async function countStore(db,name){if(!db.objectStoreNames.contains(name))return 0;return reqP(db.transaction(name,'readonly').objectStore(name).count())}
async function recentKeys(db,name,limit=5){if(!db.objectStoreNames.contains(name))return[];return new Promise((resolve,reject)=>{const out=[],tx=db.transaction(name,'readonly'),store=tx.objectStore(name);let req;try{req=store.openKeyCursor(null,'prev')}catch{req=store.openCursor(null,'prev')}req.onerror=()=>reject(req.error);req.onsuccess=()=>{const c=req.result;if(!c||out.length>=limit){resolve(out);return}out.push(String(c.primaryKey??c.key??c.value?.id??''));c.continue()}})}
async function summary(){let db;try{db=await openDb();const [sessions,timelineChunks]=await Promise.all([countStore(db,'sessions'),countStore(db,'timelineChunks')]);const done=[...sentSet()];const sessionsMarkedSent=Math.min(sessions,done.filter(x=>x.startsWith('sessions:')).length),timelineChunksMarkedSent=Math.min(timelineChunks,done.filter(x=>x.startsWith('timelineChunks:')).length);return {sessions,timelineChunks,sessionsMarkedSent,timelineChunksMarkedSent}}finally{db?.close()}}
function summaryText(x){return `Paikallinen: sessions ${x.sessions} • timelineChunks ${x.timelineChunks}\nJo lähetystilaan merkitty: sessions ${x.sessionsMarkedSent} • timelineChunks ${x.timelineChunksMarkedSent}`}
function styles(){if($('mlRawDataStyle'))return;const s=document.createElement('style');s.id='mlRawDataStyle';s.textContent='.ml-raw-data-overlay{position:fixed;inset:0;z-index:320000;background:#000e;display:flex;align-items:flex-end;justify-content:center;padding:12px;color:#fff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;pointer-events:auto;touch-action:pan-y;overscroll-behavior:contain}.ml-raw-data-card{position:relative;z-index:1;width:min(100%,480px);max-height:88dvh;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;pointer-events:auto;touch-action:pan-y;border:1px solid #ff263f;border-radius:20px;background:#090b0e;padding:15px}.ml-raw-data-card h2{margin:0 0 6px;font-size:17px}.ml-raw-data-copy{font-size:10px;line-height:1.45;color:#bdc2ca;white-space:pre-line}.ml-raw-data-list{margin-top:10px;border-top:1px solid #30343b}.ml-raw-data-row{padding:8px 0;border-bottom:1px solid #30343b;font-size:9px;line-height:1.35}.ml-raw-data-row b{display:block;color:#fff;overflow-wrap:anywhere}.ml-raw-data-action{width:100%;min-height:45px;margin-top:9px;border:1px solid #ff263f;border-radius:11px;background:#a80d20;color:#fff;font-weight:1000;pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.ml-raw-data-close{background:#15181d;border-color:#555}.ml-raw-data-secondary{background:#17191e;border-color:#555}';document.head.appendChild(s)}
async function showKeys(){const list=$('mlRawDataList');if(!list)return;list.innerHTML='<div class="ml-raw-data-row">Luetaan vain viimeisimmät tunnisteet…</div>';let db;try{db=await openDb();const done=sentSet(),[sessions,timeline]=await Promise.all([recentKeys(db,'sessions',5),recentKeys(db,'timelineChunks',5)]);list.innerHTML=[...sessions.map(id=>`<div class="ml-raw-data-row"><b>SESSION • ${id||'–'}</b>${done.has(`sessions:${id}`)?'lähetetty':'odottaa lähetystä'}</div>`),...timeline.map(id=>`<div class="ml-raw-data-row"><b>TIMELINE • ${id||'–'}</b>${done.has(`timelineChunks:${id}`)?'lähetetty':'odottaa lähetystä'}</div>`)].join('')||'<div class="ml-raw-data-row">Ei paikallisia tunnisteita.</div>'}catch(e){list.innerHTML='<div class="ml-raw-data-row">VIRHE: '+(e?.message||e)+'</div>'}finally{db?.close()}}
function openResearchRawData(){
 styles();$('mlRawDataPanel')?.remove();
 const panel=document.createElement('div');panel.id='mlRawDataPanel';panel.className='ml-raw-data-overlay';panel.innerHTML='<div class="ml-raw-data-card"><h2>OMA RAW-DATA</h2><div id="mlRawDataStatus" class="ml-raw-data-copy">Näkymä valmis. RAW-payloadia ei ladata tähän ruutuun.</div><div id="mlRawDataList" class="ml-raw-data-list"><div class="ml-raw-data-row">Paina “NÄYTÄ VIIMEISIMMÄT ID:T” vain jos haluat nähdä tunnisteet.</div></div><button id="mlRawDataIds" class="ml-raw-data-action ml-raw-data-secondary" type="button">NÄYTÄ VIIMEISIMMÄT ID:T</button><button id="mlRawDataSend" data-ml-learning-raw-bound="1" class="ml-raw-data-action" type="button">LÄHETÄ KAIKKI RAW-DATA NYT</button><button id="mlRawDataClose" class="ml-raw-data-action ml-raw-data-close" type="button">SULJE</button></div>';
 document.body.appendChild(panel);panel.addEventListener('click',e=>{if(e.target===panel)panel.remove()});const status=$('mlRawDataStatus'),send=$('mlRawDataSend');
 $('mlRawDataClose').onclick=()=>panel.remove();$('mlRawDataIds').onclick=showKeys;
 setTimeout(async()=>{try{const s=await summary();if(panel.isConnected)status.textContent=summaryText(s)+(!s.sessions&&!s.timelineChunks?'\n\nEI PAIKALLISTA RESEARCH-RAW-DATAA TÄLLÄ PUHELIMELLA.':'')}catch(e){if(panel.isConnected)status.textContent='Yhteenveto ei auennut, mutta näkymää voi silti käyttää. '+(e?.message||e)}},250);
 send.onclick=async()=>{
  send.disabled=true;status.textContent='Kaikki RAW-data lähetetään nyt…';
  let report=null,researchError='',learning=null,learningError='';
  try{report=await globalThis.MotoLabV34RuntimeFixes?.syncResearchRaw?.();if(!report)throw Error('Research RAW -synkka ei ole latautunut.');if(report.error)researchError=String(report.error)}catch(e){researchError=String(e?.message||e)}
  try{const sync=globalThis.MotoLabRawSync;if(!sync?.flushAll)throw Error('Learning RAW -synkka ei ole latautunut.');learning=await sync.flushAll()}catch(e){learningError=String(e?.message||e)}
  try{
   let after=report?.after||null;if(!after){try{after=await summary()}catch{}}
   const lines=[];
   if(after)lines.push(summaryText(after));
   if(report)lines.push(`Tällä ajolla Research RAW: sessions ${report.sentThisRun?.sessions||0} • timelineChunks ${report.sentThisRun?.timelineChunks||0}`);
   if(researchError)lines.push('RESEARCH RAW VIRHE: '+researchError);
   if(learning)lines.push(`LEARNING RAW: jonossa ${learning.pending||0} • lähetetty yhteensä ${learning.sent||0}${learning.lastError?`\nViimeisin virhe: ${learning.lastError}`:''}`);
   if(learningError)lines.push('LEARNING RAW VIRHE: '+learningError);
   if(!researchError&&!learningError&&!(learning?.pending||0))lines.push('KAIKKI RAW-LÄHETYKSET VALMIIT.');
   status.textContent=lines.join('\n\n')||'RAW-lähetys päättyi ilman tilatietoa.';
  }finally{send.disabled=false}
 };
 return panel
}
function install(){const rt=globalThis.MotoLabV34RuntimeFixes;if(!rt){setTimeout(install,100);return}rt.openResearchRawData=openResearchRawData;rt.lightRawUiVersion=VERSION}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
