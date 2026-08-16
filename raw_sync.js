(() => {
'use strict';
const MODULE_VERSION='v32-raw-auto-sync-2';
const CFG_KEY='motolab_v32_raw_sync_cfg';
const QUEUE_KEY='motolab_v32_raw_sync_queue';
const DEVICE_KEY='motolab_v32_raw_sync_device';
const $r=id=>document.getElementById(id);
let syncing=false,syncTimer=null;

function readCfg(){try{return {...{enabled:false,endpoint:'',ingestKey:'',deviceLabel:'iPhone'},...JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}}catch{return {enabled:false,endpoint:'',ingestKey:'',deviceLabel:'iPhone'}}}
function writeCfg(c){localStorage.setItem(CFG_KEY,JSON.stringify(c))}
function readQueue(){try{return JSON.parse(localStorage.getItem(QUEUE_KEY)||'{"pending":[],"sent":0,"lastOk":null,"lastError":null}')}catch{return {pending:[],sent:0,lastOk:null,lastError:null}}}
function writeQueue(q){q.pending=(q.pending||[]).slice(-2500);localStorage.setItem(QUEUE_KEY,JSON.stringify(q));renderState()}
function deviceId(){let id=localStorage.getItem(DEVICE_KEY);if(!id){id=(crypto.randomUUID?crypto.randomUUID():'dev-'+Date.now()+'-'+Math.random().toString(36).slice(2));localStorage.setItem(DEVICE_KEY,id)}return id}
function normalizeEndpoint(s){s=String(s||'').trim();if(!s)return '';if(!/^https:\/\//i.test(s))throw Error('Vastaanottimen pitää käyttää HTTPS-yhteyttä.');return s.replace(/\/$/,'')}
function enqueue(id){if(!id)return;const q=readQueue();if(!q.pending.some(x=>x.id===id))q.pending.push({id,added:Date.now(),tries:0,nextAttempt:0});writeQueue(q);scheduleSync(300)}
async function getChunk(id){
 if(typeof db!=='undefined'&&db&&typeof useFallback!=='undefined'&&!useFallback&&db.objectStoreNames.contains('rawChunks')){
  return await new Promise((resolve,reject)=>{const tx=db.transaction('rawChunks','readonly'),req=tx.objectStore('rawChunks').get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)})
 }
 try{const a=JSON.parse(localStorage.getItem('motolab_v29_raw_fallback')||'[]');for(const c of a){if(c.id===id)return c}}catch{}
 return null
}
function statusText(t){const e=$r('rawSyncStatus');if(e)e.textContent=t}
function renderState(){
 const c=readCfg(),q=readQueue();
 if($r('rawSyncEnabled'))$r('rawSyncEnabled').classList.toggle('on',!!c.enabled);
 if($r('rawSyncEndpoint')&&document.activeElement!==$r('rawSyncEndpoint'))$r('rawSyncEndpoint').value=c.endpoint||'';
 if($r('rawSyncKey')&&document.activeElement!==$r('rawSyncKey'))$r('rawSyncKey').value=c.ingestKey||'';
 if($r('rawSyncLabel')&&document.activeElement!==$r('rawSyncLabel'))$r('rawSyncLabel').value=c.deviceLabel||'';
 if($r('rawSyncQueue'))$r('rawSyncQueue').textContent=String(q.pending?.length||0);
 if($r('rawSyncSent'))$r('rawSyncSent').textContent=String(q.sent||0);
 if($r('rawSyncLast'))$r('rawSyncLast').textContent=q.lastOk?new Date(q.lastOk).toLocaleString('fi-FI'):'–';
}
function saveFromUi(){
 const c=readCfg();c.endpoint=($r('rawSyncEndpoint')?.value||'').trim();c.ingestKey=$r('rawSyncKey')?.value||'';c.deviceLabel=($r('rawSyncLabel')?.value||'').trim()||'iPhone';writeCfg(c);renderState();return c
}
async function sendChunk(chunk,cfg){
 const endpoint=normalizeEndpoint(cfg.endpoint);
 if(!endpoint||!cfg.ingestKey)throw Error('Aseta vastaanottimen URL ja ingest-avain.');
 const payload={schema:'motolab_raw_sync_envelope_v1',moduleVersion:MODULE_VERSION,deviceId:deviceId(),deviceLabel:cfg.deviceLabel||'',uploadedAt:new Date().toISOString(),chunk};
 const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-MotoLab-Ingest-Key':cfg.ingestKey},body:JSON.stringify(payload),cache:'no-store'});
 let body=null;try{body=await r.json()}catch{}
 if(!r.ok)throw Error((body&&body.error)||('HTTP '+r.status));
 return body||{ok:true}
}
async function syncNow(force=false){
 if(syncing)return;const cfg=readCfg();if(!cfg.enabled&&!force)return;if(!cfg.endpoint||!cfg.ingestKey){statusText('RAW AUTO SYNC odottaa vastaanottimen URL:ia ja ingest-avainta.');return}
 syncing=true;clearTimeout(syncTimer);syncTimer=null;
 try{
  let q=readQueue(),done=0,skipped=0;
  for(const item of [...q.pending]){
   if(done>=20)break;if(!force&&item.nextAttempt&&Date.now()<item.nextAttempt){skipped++;continue}
   const chunk=await getChunk(item.id);
   if(!chunk){q.pending=q.pending.filter(x=>x.id!==item.id);continue}
   try{await sendChunk(chunk,cfg);q.pending=q.pending.filter(x=>x.id!==item.id);q.sent=(q.sent||0)+1;q.lastOk=Date.now();q.lastError=null;done++;writeQueue(q)}catch(e){const live=q.pending.find(x=>x.id===item.id);if(live){live.tries=(live.tries||0)+1;live.nextAttempt=Date.now()+Math.min(15*60*1000,5000*Math.pow(2,Math.min(7,live.tries-1)))}q.lastError=String(e.message||e);writeQueue(q);statusText('Synkkaus jäi jonoon: '+q.lastError);break}
  }
  q=readQueue();if(!q.pending.length)statusText(`RAW AUTO SYNC valmis • lähetetty yhteensä ${q.sent||0}.`);else if(done)statusText(`Lähetetty ${done} • jonossa ${q.pending.length}${skipped?' • osa odottaa uutta yritystä':''}.`)
 }finally{syncing=false;renderState();if(readCfg().enabled&&readQueue().pending.length)scheduleSync(15000)}
}
function scheduleSync(ms=1000){if(syncTimer)return;syncTimer=setTimeout(()=>{syncTimer=null;syncNow(false)},ms)}
async function queueAllLocal(){
 if(typeof getLearningChunks!=='function'){statusText('RAW-tietovarastoa ei löytynyt.');return}
 statusText('Haetaan paikalliset RAW-jaksot jonoon…');try{const chunks=await getLearningChunks(false);for(const c of chunks)enqueue(c.id);statusText(`Jonotettu ${chunks.length} paikallista RAW-jaksoa.`);if(readCfg().enabled)scheduleSync(200)}catch(e){statusText('Jonotus epäonnistui: '+e.message)}
}
async function exportRawJson(){
 if(typeof getLearningChunks!=='function'){statusText('RAW-tietovarastoa ei löytynyt.');return}
 statusText('Kootaan RAW JSON -tiedostoa…');
 try{
  const chunks=await getLearningChunks(false);
  if(!chunks.length){statusText('Paikallista RAW-dataa ei löytynyt vietäväksi.');return}
  const payload={schema:'motolab_raw_export_v1',exportedAt:new Date().toISOString(),release:globalThis.MOTOLAB_RELEASE||null,deviceId:deviceId(),deviceLabel:readCfg().deviceLabel||'iPhone',chunkCount:chunks.length,chunks};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const fileName=`MotoLab_RAW_${stamp}.json`;
  const file=new File([blob],fileName,{type:'application/json'});
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
   await navigator.share({files:[file],title:'MotoLab RAW data'});
   statusText(`RAW JSON valmis • ${chunks.length} chunkia • avattiin iPhonen jakovalikko.`);
  }else{
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
   statusText(`RAW JSON ladattu • ${chunks.length} chunkia.`);
  }
 }catch(e){if(e&&e.name==='AbortError'){statusText('RAW-vienti peruttiin.');return}statusText('RAW-vienti epäonnistui: '+(e.message||e))}
}
async function testReceiver(){
 const c=saveFromUi();try{const endpoint=normalizeEndpoint(c.endpoint);if(!endpoint||!c.ingestKey)throw Error('URL tai ingest-avain puuttuu.');const test={id:'connection-test-'+Date.now(),sessionId:'connection-test',created:new Date().toISOString(),schema:'connection_test',samples:[],events:[]};await sendChunk(test,c);statusText('Vastaanotin toimii. Testipaketti hyväksyttiin.')}catch(e){statusText('Vastaanottimen testi epäonnistui: '+e.message)}
}
function installUi(){
 if($r('rawAutoSyncPanel'))return true;
 const settings=$r('screen-settings');if(!settings)return false;
 const panels=[...settings.querySelectorAll('.panel')];const anchor=panels.find(p=>/OPPIMIS|RAAKA|RAW/i.test(p.textContent||''))||panels[panels.length-1]||settings;
 const p=document.createElement('div');p.className='panel';p.id='rawAutoSyncPanel';p.innerHTML=`<div class="phead"><div class="ptitle"><span class="r">☁️</span> RAW AUTO SYNC</div><span class="tiny">${MODULE_VERSION}</span></div><div class="statusbox">RAW tallennetaan aina ensin puhelimeen. Voit viedä kaiken paikallisen RAW-datan JSON-tiedostoksi ilman palvelinta tai synkata sen HTTPS-vastaanottimeen myöhemmin.</div><div class="form"><button id="rawExportJson" class="action full" type="button">VIE RAW DATA • JSON</button><div class="switchrow"><div><b style="font-size:9px">Automaattinen RAW-synkkaus</b><div class="tiny">Lähetä uudet RAW-chunkit taustalla, kun vastaanotin on asetettu.</div></div><button id="rawSyncEnabled" class="switch" type="button"></button></div><label class="full">Vastaanottimen HTTPS-URL<input id="rawSyncEndpoint" type="url" placeholder="https://.../api/raw/v1/chunk"></label><label class="full">Ingest-avain<input id="rawSyncKey" type="password" autocomplete="off" placeholder="Tallennetaan vain tähän laitteeseen"></label><label class="full">Laitteen nimi<input id="rawSyncLabel" value="iPhone" placeholder="esim. Antti iPhone"></label><button id="rawSyncSave" class="action full" type="button">TALLENNA RAW SYNC -ASETUKSET</button><button id="rawSyncTest" class="action gray full" type="button">TESTAA VASTAANOTIN</button><button id="rawSyncAll" class="action gray full" type="button">JONOTA KAIKKI PAIKALLISET RAW-TIEDOT</button><button id="rawSyncNow" class="action full" type="button">SYNKKAA NYT</button></div><div class="grid2"><div class="card"><span>Jonossa</span><b id="rawSyncQueue">0</b></div><div class="card"><span>Lähetetty</span><b id="rawSyncSent">0</b></div><div class="card full"><span>Viimeisin onnistuminen</span><b id="rawSyncLast">–</b></div></div><div id="rawSyncStatus" class="statusbox">RAW JSON -vienti toimii ilman vastaanotinta. RAW AUTO SYNC ei lähetä mitään ennen kuin se on kytketty päälle ja vastaanotin on asetettu.</div>`;
 anchor.insertAdjacentElement('afterend',p);
 $r('rawExportJson').onclick=exportRawJson;
 $r('rawSyncEnabled').onclick=()=>{const c=saveFromUi();c.enabled=!c.enabled;writeCfg(c);renderState();statusText(c.enabled?'RAW AUTO SYNC päällä.':'RAW AUTO SYNC pois päältä.');if(c.enabled)scheduleSync(100)};
 $r('rawSyncSave').onclick=()=>{saveFromUi();statusText('RAW SYNC -asetukset tallennettu vain tähän laitteeseen.');if(readCfg().enabled)scheduleSync(100)};
 $r('rawSyncTest').onclick=testReceiver;$r('rawSyncAll').onclick=queueAllLocal;$r('rawSyncNow').onclick=()=>syncNow(true);renderState();return true
}
function patchRawStore(){
 if(typeof putRawChunk!=='function'||putRawChunk.__rawSyncPatched)return false;
 const original=putRawChunk;const patched=async function(chunk){const out=await original(chunk);enqueue(chunk?.id);return out};patched.__rawSyncPatched=true;putRawChunk=patched;return true
}
function boot(){const a=installUi(),b=patchRawStore();if(!a||!b){setTimeout(boot,200);return}window.addEventListener('online',()=>scheduleSync(300));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleSync(500)});if(readCfg().enabled)scheduleSync(1200);if(typeof addLearningEvent==='function')addLearningEvent('raw_auto_sync_loaded',{module:MODULE_VERSION,deviceId:deviceId()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
