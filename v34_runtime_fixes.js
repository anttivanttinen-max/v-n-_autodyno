(() => {
'use strict';
const VERSION='motolab-v34-runtime-fixes-v2-research-sync';
const $=id=>document.getElementById(id);
let savePatched=false,candidateBridge=false,researchSyncBusy=false,researchSyncTimer=null;
const RESEARCH_DB='VanaMotoLabResearch',RESEARCH_DB_VERSION=1,RESEARCH_SENT_KEY='motolab_research_raw_sent_v1';

function hideFloatingFeedback(){
 for(const id of ['motolabFeedbackBtn','motolabAdminFeedbackBtn'])$(id)?.remove();
 let s=$('mlV34RuntimeStyle');if(!s){s=document.createElement('style');s.id='mlV34RuntimeStyle';s.textContent=`#motolabFeedbackBtn,#motolabAdminFeedbackBtn{display:none!important}.ml-meta-gear{grid-column:1/-1}.ml-meta-gear select{width:100%;min-height:44px}`;document.head.appendChild(s)}
}
function currentRuns(){try{return Array.isArray(runs)?runs:[]}catch{return []}}
function confirmedGear(){
 const c=globalThis.MOTOLAB_CONFIRMED_GEAR;
 if(c&&[1,2,3,4,5,6].includes(+c.gear)&&Date.now()-(+c.t||0)<60000)return {gear:+c.gear,origin:c.origin||'user_confirmed',t:+c.t||Date.now()};
 const g=globalThis.MOTOLAB_TRIP_GEAR_GUARD;
 if(g?.state==='third')return {gear:3,origin:g.manualGear===3?'user_confirmed':'research_gear_guard',t:+g.t||Date.now()};
 return null;
}
function patchSaveRun(){
 if(savePatched)return true;
 let orig=null;try{orig=typeof saveRun==='function'?saveRun:null}catch{}
 if(!orig)return false;
 const wrapped=async function(run){
  try{
   const cg=confirmedGear(),research=$('tripResearchState')?.textContent?.trim()==='TALLENTAA';
   if(cg&&(research||!run?.gear||+run.gear===1)){
    run.gear=cg.gear;run.gearOrigin=cg.origin;run.gearConfirmedAt=new Date(cg.t).toISOString();
   }
  }catch{}
  return orig(run)
 };
 wrapped.__mlV34GearPatched=true;
 try{saveRun=wrapped}catch{}
 globalThis.saveRun=wrapped;savePatched=true;return true;
}
function ensureGearEditor(){
 const modal=$('mlRunEditModal'),form=modal?.querySelector('.ml-meta-form');if(!modal||!form)return false;
 if(!$('mlMetaGear')){
  const label=document.createElement('label');label.className='ml-meta-gear';label.innerHTML='Vaihde<select id="mlMetaGear"><option value="">–</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option></select>';
  form.prepend(label);
 }
 if(modal.dataset.mlGearObserver!=='1'){
  modal.dataset.mlGearObserver='1';
  new MutationObserver(()=>{
   if(!modal.classList.contains('show'))return;const r=currentRuns().find(x=>x.id===modal.dataset.runId);if(r&&$('mlMetaGear'))$('mlMetaGear').value=r.gear?String(r.gear):'';
  }).observe(modal,{attributes:true,attributeFilter:['class','data-run-id']});
 }
 const save=$('mlMetaSave');
 if(save&&save.dataset.mlGearCapture!=='1'){
  save.dataset.mlGearCapture='1';
  save.addEventListener('click',()=>{
   const id=modal.dataset.runId,r=currentRuns().find(x=>x.id===id),g=+$('mlMetaGear')?.value||0;if(!r||!g)return;
   r.gear=g;r.gearOrigin='post_run_edit';r.gearEditedAfterRun=true;r.gearEditedAt=new Date().toISOString();
   r.tuning={...(r.tuning||{}),gear:g,gearEditedAfterRun:true,gearEditedAt:r.gearEditedAt,metadataOrigin:'post_run_edit'};
   try{globalThis.MOTOLAB_DIAGNOSTICS?.record?.('run_gear_metadata_edited',{runId:r.id,gear:g,module:VERSION})}catch{}
  },true);
 }
 return true;
}
function installCandidateBridge(){
 if(candidateBridge)return;candidateBridge=true;
 window.addEventListener('motolab-phone-rpm',e=>{
  const p=e.detail||{};if(!Array.isArray(p.topCandidates)||!p.topCandidates.length)return;
  const detail={...p,candidates:p.topCandidates.map(x=>({rpm:x.rpm,observedHz:x.f0||0,rawRpm:x.rawRpm||0,corr:x.ratio||1,fingerprint:0,score:x.score||0,multiplier:x.ratio||1}))};
  window.dispatchEvent(new CustomEvent('motolab-audio-candidates',{detail}));
 },{passive:true});
}
function researchRequest(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function openResearchDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(RESEARCH_DB,RESEARCH_DB_VERSION);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function readResearchStore(db,name){if(!db.objectStoreNames.contains(name))return[];return researchRequest(db.transaction(name,'readonly').objectStore(name).getAll())}
function researchSent(){try{return new Set(JSON.parse(localStorage.getItem(RESEARCH_SENT_KEY)||'[]'))}catch{return new Set()}}
function saveResearchSent(done){try{localStorage.setItem(RESEARCH_SENT_KEY,JSON.stringify([...done].slice(-20000)))}catch{}}
function researchUserReady(){const u=globalThis.MotoLabUser?.user;return !!(u&&u.status==='active'&&localStorage.getItem('motolab_v32_beta_token'))}
function isAdmin(){try{const u=globalThis.MotoLabUser?.user;return u?.role==='admin'&&u?.status==='active'}catch{return false}}
async function researchRawSummary(){let db;try{db=await openResearchDb();const done=researchSent(),sessions=await readResearchStore(db,'sessions'),timelineChunks=await readResearchStore(db,'timelineChunks');return {sessions:sessions.length,timelineChunks:timelineChunks.length,sessionsMarkedSent:sessions.filter(x=>done.has(`sessions:${x.id}`)).length,timelineChunksMarkedSent:timelineChunks.filter(x=>done.has(`timelineChunks:${x.id}`)).length}}finally{db?.close()}}
function rawRecoveryText(x){return `Paikallinen: sessions ${x.sessions} • timelineChunks ${x.timelineChunks}\nJo lähetystilaan merkitty: sessions ${x.sessionsMarkedSent} • timelineChunks ${x.timelineChunksMarkedSent}`}
async function sendResearchRow(store,row){
 const server=globalThis.MotoLabUser?.productionServer||'https://v-n-autodyno-production.up.railway.app';
 const token=localStorage.getItem('motolab_v32_beta_token')||'';
 const safeId=String(row?.id||('row-'+Date.now())).replace(/[^a-zA-Z0-9._-]/g,'_');
 const chunk={id:`research-${store}-${safeId}`,schema:'motolab_research_raw_bridge_v1',sourceDb:RESEARCH_DB,sourceStore:store,recoveredAt:new Date().toISOString(),payload:row};
 const response=await fetch(server+'/api/users/v1/raw-chunk',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-MotoLab-Beta-Token':token},body:JSON.stringify({moduleVersion:VERSION,deviceLabel:navigator.platform||'iPhone',chunk})});
 if(!response.ok)throw Error('Research RAW sync HTTP '+response.status);
}
async function syncResearchRaw(){
 let before;try{before=await researchRawSummary()}catch(e){return {before:{sessions:0,timelineChunks:0,sessionsMarkedSent:0,timelineChunksMarkedSent:0},after:{sessions:0,timelineChunks:0,sessionsMarkedSent:0,timelineChunksMarkedSent:0},sentThisRun:{sessions:0,timelineChunks:0},error:String(e?.message||e)}}const report={before,after:before,sentThisRun:{sessions:0,timelineChunks:0},error:null};
 if(researchSyncBusy){report.error='RAW-palaute on jo käynnissä.';return report}
 if(!researchUserReady()){report.error='Aktiivinen käyttäjäistunto puuttuu.';return report}
 researchSyncBusy=true;
 let db;
 try{
  db=await openResearchDb();const done=researchSent();
  for(const store of ['sessions','timelineChunks']){
   const rows=await readResearchStore(db,store);
   for(const row of rows){
    const key=`${store}:${row.id}`;if(done.has(key))continue;
    await sendResearchRow(store,row);done.add(key);saveResearchSent(done);
   }
  }
  report.after=await researchRawSummary();report.sentThisRun={sessions:Math.max(0,report.after.sessionsMarkedSent-before.sessionsMarkedSent),timelineChunks:Math.max(0,report.after.timelineChunksMarkedSent-before.timelineChunksMarkedSent)};
 }catch(e){report.error=String(e?.message||e);console.warn('[MotoLab research RAW sync]',e);try{report.after=await researchRawSummary()}catch{}}
 finally{db?.close();researchSyncBusy=false}
 return report;
}
function scheduleResearchSync(delay=1200){clearTimeout(researchSyncTimer);researchSyncTimer=setTimeout(syncResearchRaw,delay)}
function ensureRawRecoveryUi(){const settings=$('screen-settings');if(!settings||!isAdmin()){$('mlRawRecoveryPanel')?.remove();return false}if($('mlRawRecoveryPanel'))return true;const panel=document.createElement('div');panel.id='mlRawRecoveryPanel';panel.className='panel';panel.innerHTML='<div class="phead"><div class="ptitle"><span class="r">⚕</span> ADMIN / DIAGNOSTIIKKA</div><span class="tiny">RAW</span></div><div class="statusbox"><b>MANUAALINEN RAW-PALAUTUS</b><div class="tiny" style="margin-top:5px">Ajaa Research RAW -synkan heti ja näyttää VanaMotoLabResearchin sessions- ja timelineChunks-rivit. GPS-, RPM- ja gear-logiikkaan ei kosketa.</div></div><button id="mlRawRecoveryRun" class="action full" type="button">MANUAALINEN RAW-PALAUTUS</button><div id="mlRawRecoveryStatus" class="statusbox">Luetaan paikallista RAW-tilaa…</div>';settings.appendChild(panel);const out=$('mlRawRecoveryStatus'),run=$('mlRawRecoveryRun');const refresh=async()=>{const summary=await researchRawSummary();out.textContent=rawRecoveryText(summary)+(!summary.sessions&&!summary.timelineChunks?'\n\nEI PALAUTETTAVAA PAIKALLISTA RAW-DATAA.':'')};run.onclick=async()=>{run.disabled=true;out.textContent='MANUAALINEN RAW-PALAUTUS käynnissä…';try{const report=await globalThis.MotoLabV34RuntimeFixes.syncResearchRaw(),empty=!report.after.sessions&&!report.after.timelineChunks;out.textContent=`ENNEN\n${rawRecoveryText(report.before)}\n\nJÄLKEEN\n${rawRecoveryText(report.after)}\n\nTÄLLÄ AJOLLA LÄHETETTY\nsessions ${report.sentThisRun.sessions} • timelineChunks ${report.sentThisRun.timelineChunks}${report.error?`\n\nVIRHE: ${report.error}`:''}${empty?'\n\nEI PALAUTETTAVAA PAIKALLISTA RAW-DATAA.':'\n\nRAW-PALAUTUS VALMIS.'}`}catch(e){out.textContent='VIRHE: '+(e?.message||e)}finally{run.disabled=false}};refresh().catch(e=>{out.textContent='VIRHE: '+(e?.message||e)});return true}
function boot(){
 hideFloatingFeedback();installCandidateBridge();
 let n=0;const t=setInterval(()=>{hideFloatingFeedback();patchSaveRun();ensureGearEditor();ensureRawRecoveryUi();if(++n>160)clearInterval(t)},250);
 const mo=new MutationObserver(()=>{hideFloatingFeedback();ensureGearEditor();ensureRawRecoveryUi()});mo.observe(document.documentElement,{childList:true,subtree:true});
 scheduleResearchSync(1800);setInterval(syncResearchRaw,60000);
 document.addEventListener('motorlab-user-ready',()=>scheduleResearchSync(500));
 window.addEventListener('online',()=>scheduleResearchSync(500));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleResearchSync(500)});
}
globalThis.MotoLabV34RuntimeFixes={version:VERSION,patchSaveRun,ensureGearEditor,confirmedGear,syncResearchRaw};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
