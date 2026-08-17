(() => {
'use strict';
const MODULE='trip-gear-marker-v1';
const DB='VanaMotoLabResearch',VER=1,STORE='timelineChunks';
let db=null,seq=0,lastState=null;
function reqP(r){return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function txDone(tx){return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||new Error('abort'))})}
function openDb(){if(db)return Promise.resolve(db);return new Promise((res,rej)=>{const r=indexedDB.open(DB,VER);r.onsuccess=()=>{db=r.result;res(db)};r.onerror=()=>rej(r.error)})}
async function activeSession(){const d=await openDb(),tx=d.transaction('sessions','readonly'),a=await reqP(tx.objectStore('sessions').getAll());await txDone(tx);return (a||[]).filter(x=>!x.endedAt).sort((x,y)=>(y.startedAtMs||0)-(x.startedAtMs||0))[0]||null}
async function writeMarker(detail){const s=await activeSession();if(!s)return;const t=Date.now(),frame={t,kind:'gear_guard_marker',module:MODULE,state:detail?.state||'unknown',gear3:detail?.gear3===true,micDataAllowed:detail?.micDataAllowed===true,evidence:detail?.evidence||null};const d=await openDb(),tx=d.transaction(STORE,'readwrite'),i=900000+seq++;tx.objectStore(STORE).put({id:`${s.id}-gear-marker-${String(i).padStart(6,'0')}`,sessionId:s.id,index:i,createdAt:new Date(t).toISOString(),source:MODULE,frames:[frame]});await txDone(tx)}
window.addEventListener('motolab-trip-gear-guard',e=>{const d=e.detail||{},st=d.state||'unknown';if(st===lastState)return;lastState=st;writeMarker(d).catch(()=>{})});
})();
