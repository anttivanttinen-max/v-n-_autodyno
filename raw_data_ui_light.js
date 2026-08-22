(() => {
'use strict';
const VERSION='motolab-raw-data-ui-light-v1';
const DB_NAME='VanaMotoLabResearch',DB_VERSION=1,SENT_KEY='motolab_research_raw_sent_v1';
const $=id=>document.getElementById(id);
function reqP(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function sent(){try{return new Set(JSON.parse(localStorage.getItem(SENT_KEY)||'[]'))}catch{return new Set()}}
async function countStore(db,name){if(!db.objectStoreNames.contains(name))return 0;return reqP(db.transaction(name,'readonly').objectStore(name).count())}
async function recentRows(db,name,limit=8){
 if(!db.objectStoreNames.contains(name))return [];
 return new Promise((resolve,reject)=>{
  const out=[],tx=db.transaction(name,'readonly'),store=tx.objectStore(name),req=store.openCursor(null,'prev');
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{const c=req.result;if(!c||out.length>=limit){resolve(out);return}out.push(c.value);c.continue()};
 })
}
async function countSentKeys(db,name,done){
 if(!db.objectStoreNames.contains(name))return 0;
 return new Promise((resolve,reject)=>{
  let n=0,tx=db.transaction(name,'readonly'),store=tx.objectStore(name),req;
  try{req=store.openKeyCursor()}catch{req=store.openCursor()}
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{const c=req.result;if(!c){resolve(n);return}const id=String(c.primaryKey??c.key??c.value?.id??'');if(done.has(`${name}:${id}`))n++;c.continue()};
 })
}
async function summary(){let db;try{db=await openDb();const done=sent();const [sessions,timelineChunks,sessionsMarkedSent,timelineChunksMarkedSent]=await Promise.all([countStore(db,'sessions'),countStore(db,'timelineChunks'),countSentKeys(db,'sessions',done),countSentKeys(db,'timelineChunks',done)]);return {sessions,timelineChunks,sessionsMarkedSent,timelineChunksMarkedSent}}finally{db?.close()}}
function summaryText(x){return `Paikallinen: sessions ${x.sessions} • timelineChunks ${x.timelineChunks}\nJo lähetystilaan merkitty: sessions ${x.sessionsMarkedSent} • timelineChunks ${x.timelineChunksMarkedSent}`}
function styles(){if($('mlRawDataStyle'))return;const s=document.createElement('style');s.id='mlRawDataStyle';s.textContent='.ml-raw-data-overlay{position:fixed;inset:0;z-index:320000;background:#000e;display:flex;align-items:flex-end;justify-content:center;padding:12px;color:#fff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}.ml-raw-data-card{width:min(100%,480px);max-height:88dvh;overflow:auto;border:1px solid #ff263f;border-radius:20px;background:#090b0e;padding:15px}.ml-raw-data-card h2{margin:0 0 6px;font-size:17px}.ml-raw-data-copy{font-size:10px;line-height:1.45;color:#bdc2ca;white-space:pre-line}.ml-raw-data-list{margin-top:10px;border-top:1px solid #30343b}.ml-raw-data-row{padding:8px 0;border-bottom:1px solid #30343b;font-size:9px;line-height:1.35}.ml-raw-data-row b{display:block;color:#fff;overflow-wrap:anywhere}.ml-raw-data-action{width:100%;min-height:45px;margin-top:9px;border:1px solid #ff263f;border-radius:11px;background:#a80d20;color:#fff;font-weight:1000}.ml-raw-data-close{background:#15181d;border-color:#555}';document.head.appendChild(s)}
async function openResearchRawData(){
 styles();$('mlRawDataPanel')?.remove();
 const panel=document.createElement('div');panel.id='mlRawDataPanel';panel.className='ml-raw-data-overlay';panel.innerHTML='<div class="ml-raw-data-card"><h2>OMA RAW-DATA</h2><div id="mlRawDataStatus" class="ml-raw-data-copy">Luetaan kevyt RAW-yhteenveto…</div><div id="mlRawDataList" class="ml-raw-data-list"></div><button id="mlRawDataSend" class="ml-raw-data-action" type="button">LÄHETÄ RAW-DATA NYT</button><button id="mlRawDataClose" class="ml-raw-data-action ml-raw-data-close" type="button">SULJE</button></div>';
 document.body.appendChild(panel);const status=$('mlRawDataStatus'),list=$('mlRawDataList'),send=$('mlRawDataSend');
 $('mlRawDataClose').onclick=()=>panel.remove();
 const refresh=async()=>{let db;try{const s=await summary();status.textContent=summaryText(s)+(!s.sessions&&!s.timelineChunks?'\n\nEI PAIKALLISTA RAW-DATAA TÄLLÄ PUHELIMELLA.':'');db=await openDb();const done=sent();const [sessions,timeline]=await Promise.all([recentRows(db,'sessions',8),recentRows(db,'timelineChunks',8)]);list.innerHTML=[...sessions.map(x=>`<div class="ml-raw-data-row"><b>SESSION • ${String(x.id||'–')}</b>${x.startedAt||x.createdAt||'aika puuttuu'} • ${done.has(`sessions:${x.id}`)?'lähetetty':'odottaa lähetystä'}</div>`),...timeline.map(x=>`<div class="ml-raw-data-row"><b>TIMELINE • ${String(x.id||'–')}</b>${x.createdAt||'aika puuttuu'} • ${Array.isArray(x.frames)?x.frames.length:'?'} kehystä • ${done.has(`timelineChunks:${x.id}`)?'lähetetty':'odottaa lähetystä'}</div>`)].join('')||'<div class="ml-raw-data-row">Ei näytettäviä paikallisia rivejä.</div>'}finally{db?.close()}};
 send.onclick=async()=>{send.disabled=true;status.textContent='RAW-dataa lähetetään nyt…';try{const report=await globalThis.MotoLabV34RuntimeFixes?.syncResearchRaw?.();if(!report)throw Error('RAW-synkka ei ole latautunut.');status.textContent=`${summaryText(report.after)}\n\nTällä ajolla lähetetty: sessions ${report.sentThisRun.sessions} • timelineChunks ${report.sentThisRun.timelineChunks}${report.error?`\n\nVIRHE: ${report.error}`:'\n\nLÄHETYS VALMIS.'}`;await refresh()}catch(e){status.textContent='VIRHE: '+(e?.message||e)}finally{send.disabled=false}};
 refresh().catch(e=>{status.textContent='VIRHE: '+(e?.message||e)});return panel
}
function install(){const rt=globalThis.MotoLabV34RuntimeFixes;if(!rt){setTimeout(install,100);return}rt.openResearchRawData=openResearchRawData;rt.lightRawUiVersion=VERSION}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
