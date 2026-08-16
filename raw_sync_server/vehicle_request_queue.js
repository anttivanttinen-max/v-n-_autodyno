'use strict';
const fs=require('fs');
const path=require('path');
function norm(q){return String(q||'').trim().replace(/\s+/g,' ').toLowerCase()}
function read(file){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return {schema:'motolab_vehicle_request_queue_v1',items:[]}}}
function write(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+process.pid+'-'+Date.now();fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,file)}
function eventQuery(e){
 const name=String(e?.type||e?.event||e?.name||e?.kind||'');
 if(name!=='vehicle_lookup_missing_request')return '';
 return String(e?.query||e?.data?.query||e?.detail?.query||e?.payload?.query||'').trim();
}
function createVehicleRequestQueue({dataDir}){
 const file=path.join(dataDir,'vehicle_research','requests.json');
 function add(query,meta={}){query=String(query||'').trim();if(query.length<2)return null;const db=read(file),key=norm(query),now=new Date().toISOString();let item=db.items.find(x=>x.key===key);if(!item){item={key,query,status:'pending',firstSeen:now,lastSeen:now,count:0,deviceIds:[],lastResultAt:null,lastError:null};db.items.push(item)}item.count++;item.lastSeen=now;if(meta.deviceId&&!item.deviceIds.includes(meta.deviceId))item.deviceIds.push(meta.deviceId);if(item.status==='error')item.status='pending';write(file,db);return item}
 function captureChunk(chunk,meta={}){let n=0;const groups=[chunk?.events,chunk?.learningEvents,chunk?.samples];for(const a of groups){if(!Array.isArray(a))continue;for(const e of a){const q=eventQuery(e);if(q){add(q,meta);n++}}}return n}
 function list(){const db=read(file);return db.items.slice().sort((a,b)=>String(b.lastSeen).localeCompare(String(a.lastSeen)))}
 function pending(limit=10){return list().filter(x=>x.status==='pending').slice(0,Math.max(1,Math.min(50,limit)))}
 function update(query,patch){const db=read(file),item=db.items.find(x=>x.key===norm(query));if(!item)return null;Object.assign(item,patch);write(file,db);return item}
 return {add,captureChunk,list,pending,update};
}
module.exports={createVehicleRequestQueue};
