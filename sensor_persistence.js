(() => {
'use strict';
const MODULE='sensor-persistence-v6-ios-mic-recovery';
const PREF_KEY='motolab_v32_sensor_prefs';
const AUDIO_DEVICE_KEY='motolab_v28_audio_device';
const KNOWN_MICS_KEY='motolab_v32_known_mics';
const RETRY_MS=[1000,2000,4000,8000];
const $=id=>document.getElementById(id);
let restoring=false,hadLiveMic=false,reconnecting=false,healthTimer=null;
let reconnectFailures=0,nextReconnectAt=0,lastRecoveryReason='',endedGraceUntil=0;

function readPrefs(){try{return {...{gps:false,imu:false,mic:false},...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}}catch{return {gps:false,imu:false,mic:false}}}
function writePrefs(p){localStorage.setItem(PREF_KEY,JSON.stringify(p))}
function uiOn(id){return !!$(id)?.classList.contains('on')}
function setDesired(k,v){const p=readPrefs();p[k]=!!v;writePrefs(p);decorateMicState()}
function micDesired(){return !!readPrefs().mic}
function selectedLabel(){const sel=$('audioDevice');if(sel?.value){const o=sel.options?.[sel.selectedIndex];if(o?.textContent)return o.textContent.trim()}return ''}
function micTrack(){try{return audioSessions?.ext?.track||audioSessions?.ext?.stream?.getAudioTracks?.()[0]||null}catch{return null}}
function micStream(){try{return audioSessions?.ext?.stream||null}catch{return null}}
function micActive(){const t=micTrack(),s=micStream();return !!(t&&t.readyState==='live'&&t.enabled!==false&&(!s||s.active!==false))}
function saveFromUi(){if(restoring)return;const p=readPrefs();p.gps=$('gpsDot')?.classList.contains('on')||false;p.imu=$('imuDot')?.classList.contains('on')||false;if(micActive()||uiOn('extMicBtn'))p.mic=true;writePrefs(p);decorateMicState()}
function logRecovery(type,data={}){try{if(typeof addLearningEvent==='function')addLearningEvent(type,{...data,module:MODULE})}catch{}}
function setMicUi(active,text){const b=$('extMicBtn'),dot=$('extDot'),s=$('extState');if(b)b.classList.toggle('on',!!active);if(dot)dot.classList.toggle('on',!!active);if(s&&text)s.textContent=text}
function hideRecoveryAction(){const b=$('micRecoveryAction');if(b)b.style.display='none'}
function ensureRecoveryAction(){let b=$('micRecoveryAction');if(!b){b=document.createElement('button');b.id='micRecoveryAction';b.type='button';b.textContent='🎙 MIC RECOVERY • PALAUTA MIKROFONI';b.style.cssText='position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:100001;display:none;max-width:calc(100vw - 24px);padding:12px 16px;border-radius:12px;border:1px solid #ff263f;background:#17070a;color:#fff;font:800 11px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.45)';b.onclick=async()=>{nextReconnectAt=0;endedGraceUntil=0;logRecovery('mic_recovery_user_gesture',{reason:lastRecoveryReason||'manual'});await recoverMic('user_gesture',true)};document.body.appendChild(b)}return b}
function showRecoveryAction(){const b=ensureRecoveryAction();b.style.display='block'}
function decorateMicState(){const b=$('extMicBtn'),s=$('extState');if(!b||!s)return;const desired=micDesired(),active=micActive(),label=selectedLabel();if(active){hadLiveMic=true;reconnectFailures=0;nextReconnectAt=0;hideRecoveryAction()}b.dataset.desired=desired?'1':'0';b.classList.toggle('sensor-waiting',desired&&!active);if(active){setMicUi(true,(label||'AKTIIVINEN').toUpperCase());return}setMicUi(false,desired?(hadLiveMic?'YHTEYS KATKESI • ODOTTAA':(label?`ODOTTAA • ${label}`:'ODOTTAA AKTIVOINTIA')):'POIS')}
async function wait(ms){return new Promise(r=>setTimeout(r,ms))}
async function startMicOnce(){let ok=false,error='';try{if(globalThis.MotoLabMicAuthority?.desired&&typeof globalThis.MotoLabMicAuthority.on==='function'){const r=await globalThis.MotoLabMicAuthority.on('sensor_persistence_recovery');ok=!!r?.ok}else if(typeof startAudio==='function')ok=!!(await startAudio())}catch(e){error=e?.name||e?.message||String(e)}return {ok,error}}
async function recoverMic(reason,force=false){
 if(reconnecting||!micDesired()||!hadLiveMic||document.visibilityState==='hidden')return false;
 const now=Date.now();if(!force&&now<Math.max(nextReconnectAt,endedGraceUntil))return false;
 reconnecting=true;lastRecoveryReason=reason;
 const attempt=reconnectFailures+1,oldTrack=micTrack(),oldLabel=oldTrack?.label||selectedLabel()||'';
 setMicUi(false,'YHTEYS KATKESI • YHDISTETÄÄN…');
 logRecovery('mic_recovery_attempt',{reason,attempt,oldTrackState:oldTrack?.readyState||'none',oldLabel,forced:!!force});
 try{
  // phone_rpm_smart has its own fast restart. Give it time first so two recovery loops do not stop/start each other.
  if(!force){await wait(900);if(micActive()){reconnectFailures=0;nextReconnectAt=0;bindTrackHealth();hideRecoveryAction();logRecovery('mic_recovery_success',{reason,attempt,via:'smart_restart_grace'});decorateMicState();return true}}
  try{if(typeof stopAudio==='function')await stopAudio()}catch(e){logRecovery('mic_recovery_teardown_error',{reason,attempt,error:e?.name||e?.message||String(e)})}
  try{if(globalThis.audioSessions?.ext&&!micActive())globalThis.audioSessions.ext=null}catch{}
  await wait(420);
  let first=await startMicOnce();
  await wait(650);
  let live=micActive();
  // startPhone can legitimately return false while an overlapping start is still finishing. Inspect live state, then retry once without another teardown.
  if(!live){await wait(350);const second=await startMicOnce();if(!first.error)first.error=second.error;await wait(650);live=micActive()}
  const newTrack=micTrack();
  if(live){
   reconnectFailures=0;nextReconnectAt=0;hadLiveMic=true;bindTrackHealth();hideRecoveryAction();
   logRecovery('mic_stream_recreated',{ok:true,reason,attempt,oldLabel,newLabel:newTrack?.label||'',newTrackState:newTrack?.readyState||'none'});
   logRecovery('mic_recovery_success',{reason,attempt,via:'serialized_recreate'});
  }else{
   reconnectFailures=Math.min(reconnectFailures+1,1000);
   const retryInMs=RETRY_MS[Math.min(reconnectFailures-1,RETRY_MS.length-1)];
   nextReconnectAt=Date.now()+retryInMs;
   logRecovery('mic_recovery_failure',{ok:false,reason,attempt,retryInMs,error:first.error||'track_not_live',newTrackState:newTrack?.readyState||'none'});
   if(reconnectFailures>=2)showRecoveryAction();
  }
  decorateMicState();return live;
 }finally{reconnecting=false}
}
function healthCheck(){const active=micActive();if(active)hadLiveMic=true;decorateMicState();if(!micDesired()||!hadLiveMic||reconnecting)return;if(!active)recoverMic('track_not_live')}
function bindTrackHealth(){const t=micTrack();if(!t||t.__motolabHealthBound)return;t.__motolabHealthBound=true;t.addEventListener?.('ended',()=>{endedGraceUntil=Date.now()+900;decorateMicState();setTimeout(()=>recoverMic('track_ended',false),950)});t.addEventListener?.('mute',()=>setTimeout(healthCheck,1400));t.addEventListener?.('unmute',()=>decorateMicState())}

function knownMics(){try{return JSON.parse(localStorage.getItem(KNOWN_MICS_KEY)||'[]')}catch{return []}}
function rememberMics(list){const old=knownMics(),map=new Map(old.map(x=>[x.deviceId,x]));for(const d of list){if(!d.deviceId)continue;map.set(d.deviceId,{deviceId:d.deviceId,label:(d.label||map.get(d.deviceId)?.label||'Mikrofoni').trim(),lastSeen:Date.now()})}const out=[...map.values()].sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0)).slice(0,30);localStorage.setItem(KNOWN_MICS_KEY,JSON.stringify(out));return out}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function ensureModal(){if($('homeMicPicker'))return;const wrap=document.createElement('div');wrap.id='homeMicPicker';wrap.style.cssText='position:fixed;inset:0;z-index:100000;display:none;background:rgba(0,0,0,.78);align-items:flex-end;justify-content:center;padding:8px;overflow:auto;-webkit-overflow-scrolling:touch';wrap.innerHTML=`<div style="width:min(100%,440px);max-height:88vh;overflow:auto;-webkit-overflow-scrolling:touch;border-radius:22px 22px 14px 14px;background:linear-gradient(#121419,#08090c);border:1px solid rgba(255,38,63,.55);padding:13px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><b style="font-size:15px">🎙️ Valitse mikrofoni</b><div id="homeMicHint" style="font-size:9px;color:#aeb4bc;margin-top:4px">Haetaan laitteen audiotulot…</div></div><button id="homeMicClose" type="button" style="border:1px solid #555;background:#17191e;color:#fff;border-radius:10px;padding:8px 11px">SULJE</button></div><div id="homeMicList" style="display:grid;gap:7px;margin-top:11px"></div><button id="homeMicOff" type="button" style="width:100%;margin-top:10px;padding:11px;border-radius:11px;border:1px solid #555;background:#17191e;color:#fff;font-weight:800">MIKROFONI POIS</button></div>`;document.body.appendChild(wrap);$('homeMicClose').onclick=()=>{wrap.style.display='none'};wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.style.display='none'});$('homeMicOff').onclick=async()=>{setDesired('mic',false);hadLiveMic=false;reconnectFailures=0;nextReconnectAt=0;hideRecoveryAction();try{if(typeof stopAudio==='function')await stopAudio()}catch{}decorateMicState();wrap.style.display='none'}}
async function currentInputs(requestPermission=true){if(!navigator.mediaDevices?.enumerateDevices)return [];try{if(requestPermission&&typeof enumerateAudio==='function')await enumerateAudio(true);const ds=await navigator.mediaDevices.enumerateDevices();const now=ds.filter(d=>d.kind==='audioinput');rememberMics(now);return now}catch{return []}}
async function chooseMic(deviceId){localStorage.setItem(AUDIO_DEVICE_KEY,deviceId);setDesired('mic',true);reconnectFailures=0;nextReconnectAt=0;hideRecoveryAction();try{if(typeof enumerateAudio==='function')await enumerateAudio(false)}catch{}const sel=$('audioDevice');if(sel){sel.value=deviceId;sel.dispatchEvent(new Event('change',{bubbles:true}))}let ok=false;try{if(globalThis.MotoLabMicAuthority?.on){const r=await globalThis.MotoLabMicAuthority.on('mic_picker');ok=!!r?.ok}else if(typeof startAudio==='function')ok=await startAudio()}catch{}setDesired('mic',true);if(ok&&micActive()){hadLiveMic=true;bindTrackHealth()}decorateMicState();const hint=$('homeMicHint');if(hint)hint.textContent=ok&&micActive()?'Mikrofoni aktiivinen.':'Valinta tallennettu • odottaa aktivointia tai laite ei ole saatavilla.';if(ok&&micActive())setTimeout(()=>{const m=$('homeMicPicker');if(m)m.style.display='none'},250)}
async function renderMicPicker(){ensureModal();const wrap=$('homeMicPicker'),list=$('homeMicList'),hint=$('homeMicHint');wrap.style.display='flex';list.innerHTML='<div style="padding:12px;color:#bbb;font-size:10px">Haetaan mikrofoneja…</div>';const current=await currentInputs(true),currentIds=new Set(current.map(x=>x.deviceId)),all=rememberMics(current),selected=localStorage.getItem(AUDIO_DEVICE_KEY)||'';hint.textContent=current.length?`${current.length} audiotuloa löytyi. Valitse käytettävä mikrofoni.`:'Mikrofoneja ei löytynyt tai lupaa ei saatu.';if(!all.length){list.innerHTML='<div style="padding:12px;border:1px solid #39252a;border-radius:11px;color:#bbb;font-size:10px">Ei tunnettuja mikrofoneja.</div>';return}list.innerHTML='';for(const d of all){const available=currentIds.has(d.deviceId),btn=document.createElement('button');btn.type='button';btn.disabled=!available;btn.style.cssText=`text-align:left;width:100%;padding:11px;border-radius:12px;border:1px solid ${d.deviceId===selected?'#ff263f':'#34363d'};background:${available?'#101217':'#090a0d'};color:${available?'#fff':'#737780'};opacity:${available?'1':'.7'}`;btn.innerHTML=`<b style="display:block;font-size:10px">${esc(d.label||'Mikrofoni')}</b><span style="display:block;font-size:8px;margin-top:4px">${available?(d.deviceId===selected?'VALITTU • SAATAVILLA':'SAATAVILLA'):'EI NYT SAATAVILLA'}</span>`;if(available)btn.onclick=()=>chooseMic(d.deviceId);list.appendChild(btn)}}
function hookHomeMic(){const b=$('extMicBtn');if(!b)return false;b.onclick=e=>{if(e.target?.classList?.contains('ib'))return;e.preventDefault();e.stopPropagation();renderMicPicker()};const chip=$('extChip');if(chip)chip.onclick=e=>{e.preventDefault();e.stopPropagation();renderMicPicker()};return true}
async function restoreSensors(){const p=readPrefs();restoring=true;try{if(p.gps&&!$('gpsDot')?.classList.contains('on'))try{if(typeof startGPS==='function')await startGPS()}catch{}if(p.imu&&!$('imuDot')?.classList.contains('on'))try{if(typeof startIMU==='function')await startIMU()}catch{}/* iOS may require a user gesture for a fresh getUserMedia start. */}finally{restoring=false;decorateMicState()}}
function attachPersistence(){['gpsChip','imuChip','sensorBtn','extChip','extMicBtn','armBtn','manualBtn'].forEach(id=>$(id)?.addEventListener('click',()=>setTimeout(saveFromUi,350)));if(navigator.mediaDevices?.addEventListener)navigator.mediaDevices.addEventListener('devicechange',()=>{currentInputs(false).then(()=>{decorateMicState();healthCheck()})});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){decorateMicState();endedGraceUntil=Date.now()+900;setTimeout(healthCheck,1000)}});window.addEventListener('motolab-audio-candidates',()=>{if(micActive()){hadLiveMic=true;bindTrackHealth()}})}
function boot(){if(!$('extMicBtn')||!$('gpsChip')||!$('imuChip')){setTimeout(boot,200);return}ensureModal();ensureRecoveryAction();hookHomeMic();attachPersistence();decorateMicState();setTimeout(restoreSensors,450);healthTimer=setInterval(()=>{bindTrackHealth();healthCheck()},1200);logRecovery('sensor_persistence_loaded',{retryScheduleMs:RETRY_MS,liveTrackIsAuthoritative:true,serializedMicRecovery:true,smartRestartGraceMs:900})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
