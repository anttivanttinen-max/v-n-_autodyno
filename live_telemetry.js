(() => {
'use strict';
const MODULE_VERSION='v1-tv-live-telemetry-1hz';
const URL='https://motorlab-server.tail3764b7.ts.net/raw/api/users/v1/live-telemetry';
const TOKEN_KEY='motolab_v32_beta_token';
const INTERVAL_MS=1000;
let seq=0,busy=false,lastOk=0,lastError=null,lastStatus=0;
const fallbackSession='live-'+Date.now()+'-'+Math.random().toString(16).slice(2);
function n(v,d=0){v=Number(v);return Number.isFinite(v)?v:d}
function currentUi(){try{return typeof lastUi!=='undefined'&&lastUi&&typeof lastUi==='object'?lastUi:null}catch{return null}}
function sessionId(){try{if(typeof learningSessionId!=='undefined'&&learningSessionId)return String(learningSessionId)}catch{}return fallbackSession}
function token(){try{return localStorage.getItem(TOKEN_KEY)||''}catch{return ''}}
function userActive(){const s=globalThis.MotoLabUser?.user?.status;return !s||s==='active'}
function status(){return {version:MODULE_VERSION,busy,lastOk,lastError,seq,sessionId:sessionId()}}
async function tick(){
 if(busy)return false;
 const tkn=token(),d=currentUi();
 if(!tkn||!d||!userActive())return false;
 const payload={moduleVersion:MODULE_VERSION,uploadedAt:new Date().toISOString(),telemetry:{
  t:Date.now(),sessionId:sessionId(),seq:seq++,kmh:n(d.kmh),rpm:Math.max(0,Math.round(n(d.rpm))),
  gear:Number.isFinite(Number(d.gear))?Number(d.gear):null,confidence:Math.max(0,Math.min(1,n(d.conf))),
  quality:Math.max(0,Math.min(100,Math.round(n(d.quality)))),source:String(d.source||'').slice(0,48),
  fusionMode:String(d.fusionMode||'').slice(0,48),gpsAgeMs:Number.isFinite(Number(d.gpsAgeMs))?Number(d.gpsAgeMs):null,
  gpsAcc:Number.isFinite(Number(d.gpsAcc))?Number(d.gpsAcc):null,hp:n(d.hp),nm:n(d.nm),
  accelMps2:Number.isFinite(Number(d.a))?Number(d.a):(Number.isFinite(Number(d.accelMps2))?Number(d.accelMps2):null),
  pageVisible:document.visibilityState==='visible'
 }};
 busy=true;const ctl=typeof AbortController!=='undefined'?new AbortController():null;const timer=ctl?setTimeout(()=>ctl.abort(),3500):null;
 try{
  const r=await fetch(URL,{method:'POST',cache:'no-store',keepalive:true,headers:{'Content-Type':'application/json','X-MotoLab-Beta-Token':tkn},body:JSON.stringify(payload),signal:ctl?.signal});
  let body={};try{body=await r.json()}catch{}
  if(!r.ok||body.ok!==true)throw Error(body.error||('HTTP '+r.status));
  lastOk=Date.now();lastError=null;lastStatus=r.status;
  window.dispatchEvent(new CustomEvent('motolab-live-telemetry',{detail:{ok:true,receivedAt:body.receivedAt||null,seq:payload.telemetry.seq}}));
  return true;
 }catch(e){lastError=String(e?.message||e);lastStatus=0;window.dispatchEvent(new CustomEvent('motolab-live-telemetry',{detail:{ok:false,error:lastError}}));return false}
 finally{if(timer)clearTimeout(timer);busy=false}
}
const timer=setInterval(tick,INTERVAL_MS);setTimeout(tick,350);
window.addEventListener('online',()=>setTimeout(tick,80));
window.addEventListener('pageshow',()=>setTimeout(tick,100));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(tick,100)});
globalThis.MotoLabLiveTelemetry={version:MODULE_VERSION,tick,status,stop:()=>clearInterval(timer)};
})();
