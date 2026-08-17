(() => {
'use strict';
const MODULE='motolab-diagnostics-v1';
const STORE_KEY='motolab_v32_diagnostics_ring';
const SESSION_KEY='motolab_v32_diagnostics_session';
const HEARTBEAT_KEY='motolab_v32_diagnostics_heartbeat';
const MAX_EVENTS=500;
const MAX_STACK=8000;
const release=()=>globalThis.MOTOLAB_RELEASE||null;
let sessionId='diag-'+Date.now()+'-'+Math.random().toString(36).slice(2);
let wrappedLearning=false;
let heartbeatTimer=null;
let queueTimer=null;
let lastQueueSig='';
let inRecorder=false;

function safeString(v,max=2000){try{const s=typeof v==='string'?v:JSON.stringify(v);return String(s??'').slice(0,max)}catch{return String(v).slice(0,max)}}
function safeClone(v){try{return JSON.parse(JSON.stringify(v))}catch{return safeString(v)}}
function readRing(){try{const x=JSON.parse(localStorage.getItem(STORE_KEY)||'[]');return Array.isArray(x)?x:[]}catch{return []}}
function writeRing(a){try{localStorage.setItem(STORE_KEY,JSON.stringify(a.slice(-MAX_EVENTS)))}catch{}}
function sensorSnapshot(){
 let prefs={};try{prefs=JSON.parse(localStorage.getItem('motolab_v32_sensor_prefs')||'{}')}catch{}
 let track=null,stream=null;try{track=globalThis.audioSessions?.ext?.track||globalThis.audioSessions?.ext?.stream?.getAudioTracks?.()[0]||null;stream=globalThis.audioSessions?.ext?.stream||null}catch{}
 return {desired:{gps:!!prefs.gps,imu:!!prefs.imu,mic:!!prefs.mic},active:{gps:!!globalThis.gpsOn,imu:!!globalThis.imuOn,mic:!!(track&&track.readyState==='live'&&track.enabled!==false&&(!stream||stream.active!==false))},micTrack:track?{readyState:track.readyState,enabled:track.enabled,muted:track.muted,label:track.label||''}:null,visibility:document.visibilityState,online:navigator.onLine};
}
function queueSummary(){
 const out={};
 const known=['motolab_v32_raw_sync_queue','motolab_v32_research_sync_queue','motolab_v32_sensor_autostart_queue'];
 for(const k of known){try{const v=JSON.parse(localStorage.getItem(k)||'null');if(v==null)continue;out[k]={pending:Array.isArray(v?.pending)?v.pending.length:undefined,sent:Number.isFinite(v?.sent)?v.sent:undefined,lastOk:v?.lastOk||null,lastError:v?.lastError?safeString(v.lastError,500):null}}catch{}}
 try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(!/queue/i.test(k)||out[k])continue;const raw=localStorage.getItem(k);let v=null;try{v=JSON.parse(raw||'null')}catch{};if(Array.isArray(v))out[k]={length:v.length};else if(v&&typeof v==='object')out[k]={pending:Array.isArray(v.pending)?v.pending.length:undefined,length:Array.isArray(v.items)?v.items.length:undefined,lastError:v.lastError?safeString(v.lastError,500):null}}}catch{}
 return out;
}
function record(type,data={},severity='info'){
 if(inRecorder)return;inRecorder=true;
 try{
  const event={t:Date.now(),iso:new Date().toISOString(),sessionId,type,severity,release:release(),data:safeClone(data),sensors:sensorSnapshot()};
  const a=readRing();a.push(event);writeRing(a);
  try{if(typeof globalThis.addLearningEvent==='function'&&!type.startsWith('learning_event_mirror'))globalThis.addLearningEvent('diagnostic_event',{type,severity,sessionId,data:event.data,sensors:event.sensors,module:MODULE})}catch{}
 }finally{inRecorder=false}
}
function errorData(err,extra={}){return {...extra,name:err?.name||'',message:safeString(err?.message||err,2000),stack:safeString(err?.stack||'',MAX_STACK)}}
function heartbeat(){const hb={t:Date.now(),sessionId,release:release(),sensors:sensorSnapshot(),queues:queueSummary()};try{localStorage.setItem(HEARTBEAT_KEY,JSON.stringify(hb))}catch{}}
function markSession(clean=false,reason=''){try{localStorage.setItem(SESSION_KEY,JSON.stringify({sessionId,startedAt:Date.now(),lastSeen:Date.now(),clean,reason,release:release()}))}catch{}}
function detectPreviousUnclean(){try{const prev=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');const hb=JSON.parse(localStorage.getItem(HEARTBEAT_KEY)||'null');if(prev&&!prev.clean&&prev.sessionId!==sessionId){record('previous_session_unclean',{previous:prev,lastHeartbeat:hb,queues:queueSummary()},'error')}}catch{}}
function installGlobalErrors(){
 window.addEventListener('error',e=>record('window_error',{message:e.message||'',filename:e.filename||'',lineno:e.lineno||0,colno:e.colno||0,...errorData(e.error)},'error'),true);
 window.addEventListener('unhandledrejection',e=>record('unhandled_rejection',errorData(e.reason),'error'));
 const origError=console.error.bind(console),origWarn=console.warn.bind(console);
 console.error=(...a)=>{try{record('console_error',{args:a.map(x=>safeString(x,1500))},'error')}catch{};origError(...a)};
 console.warn=(...a)=>{try{record('console_warn',{args:a.map(x=>safeString(x,1200))},'warn')}catch{};origWarn(...a)};
}
function wrapLearningEvents(){
 if(wrappedLearning||typeof globalThis.addLearningEvent!=='function')return;
 const original=globalThis.addLearningEvent;
 const wrapped=function(type,data){if(!inRecorder){try{const a=readRing();a.push({t:Date.now(),iso:new Date().toISOString(),sessionId,type:'learning_event_mirror',severity:'info',release:release(),data:{eventType:type,eventData:safeClone(data)},sensors:sensorSnapshot()});writeRing(a)}catch{}}return original.apply(this,arguments)};
 wrapped.__motolabDiagnosticsWrapped=true;globalThis.addLearningEvent=wrapped;wrappedLearning=true;record('learning_event_hook_installed',{module:MODULE});
}
function snapshotQueues(force=false){const q=queueSummary(),sig=safeString(q,10000);if(force||sig!==lastQueueSig){lastQueueSig=sig;record('queue_state',{queues:q},'info')}}
function lifecycle(){
 document.addEventListener('visibilitychange',()=>{record('visibility_change',{visibility:document.visibilityState});heartbeat();snapshotQueues(true)});
 window.addEventListener('online',()=>record('network_online',{queues:queueSummary()}));
 window.addEventListener('offline',()=>record('network_offline',{queues:queueSummary()},'warn'));
 window.addEventListener('pagehide',e=>{record('pagehide',{persisted:!!e.persisted});markSession(true,'pagehide');heartbeat()});
 window.addEventListener('beforeunload',()=>{markSession(true,'beforeunload');heartbeat()});
 window.addEventListener('pageshow',e=>record('pageshow',{persisted:!!e.persisted}));
 try{navigator.mediaDevices?.addEventListener?.('devicechange',()=>record('media_devicechange',{sensors:sensorSnapshot()}))}catch{}
 ['motolab-audio-candidates'].forEach(n=>window.addEventListener(n,()=>record('app_event',{name:n})));
}
function expose(){globalThis.MOTOLAB_DIAGNOSTICS={module:MODULE,sessionId,record,getEvents:()=>readRing(),getQueueSummary:queueSummary,getSensorSnapshot:sensorSnapshot,clear:()=>{try{localStorage.removeItem(STORE_KEY)}catch{}},export:()=>({schema:'motolab_diagnostics_export_v1',exportedAt:new Date().toISOString(),release:release(),sessionId,events:readRing(),queues:queueSummary(),sensors:sensorSnapshot()})}}
function boot(){detectPreviousUnclean();markSession(false,'running');installGlobalErrors();lifecycle();expose();wrapLearningEvents();record('diagnostics_started',{module:MODULE,maxEvents:MAX_EVENTS,queues:queueSummary()});heartbeat();snapshotQueues(true);heartbeatTimer=setInterval(()=>{markSession(false,'running');heartbeat();wrapLearningEvents()},2000);queueTimer=setInterval(()=>snapshotQueues(false),3000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
