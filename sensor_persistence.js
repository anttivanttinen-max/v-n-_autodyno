(() => {
'use strict';
const MODULE='sensor-persistence-v1';
const PREF_KEY='motolab_v32_sensor_prefs';
const AUDIO_DEVICE_KEY='motolab_v28_audio_device';
const KNOWN_MICS_KEY='motolab_v32_known_mics';
const $=id=>document.getElementById(id);
let restoring=false;

function readPrefs(){try{return {...{gps:false,imu:false,mic:false},...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}}catch{return {gps:false,imu:false,mic:false}}}
function writePrefs(p){localStorage.setItem(PREF_KEY,JSON.stringify(p))}
function uiOn(id){return !!$(id)?.classList.contains('on')}
function saveFromUi(){if(restoring)return;const p=readPrefs();p.gps=$('gpsDot')?.classList.contains('on')||false;p.imu=$('imuDot')?.classList.contains('on')||false;if(uiOn('extMicBtn'))p.mic=true;writePrefs(p);decorateMicState()}
function setDesired(k,v){const p=readPrefs();p[k]=!!v;writePrefs(p);decorateMicState()}

function selectedLabel(){const sel=$('audioDevice');if(sel?.value){const o=sel.options?.[sel.selectedIndex];if(o?.textContent)return o.textContent.trim()}return ''}
function micActive(){return uiOn('extMicBtn')}
function micDesired(){return !!readPrefs().mic}
function decorateMicState(){
 const b=$('extMicBtn'),s=$('extState');if(!b||!s)return;
 const desired=micDesired(),active=micActive(),label=selectedLabel();
 b.dataset.desired=desired?'1':'0';
 b.classList.toggle('sensor-waiting',desired&&!active);
 if(active){s.textContent=(label||s.textContent||'AKTIIVINEN').toUpperCase();return}
 if(desired){s.textContent=label?`ODOTTAA • ${label}`:'ODOTTAA AKTIVOINTIA';return}
 if(!active)s.textContent='POIS';
}

function knownMics(){try{return JSON.parse(localStorage.getItem(KNOWN_MICS_KEY)||'[]')}catch{return []}}
function rememberMics(list){
 const old=knownMics(),map=new Map(old.map(x=>[x.deviceId,x]));
 for(const d of list){if(!d.deviceId)continue;map.set(d.deviceId,{deviceId:d.deviceId,label:(d.label||map.get(d.deviceId)?.label||'Mikrofoni').trim(),lastSeen:Date.now()})}
 const out=[...map.values()].sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0)).slice(0,30);localStorage.setItem(KNOWN_MICS_KEY,JSON.stringify(out));return out
}

function ensureModal(){
 if($('homeMicPicker'))return;
 const wrap=document.createElement('div');wrap.id='homeMicPicker';wrap.style.cssText='position:fixed;inset:0;z-index:100000;display:none;background:rgba(0,0,0,.78);align-items:flex-end;justify-content:center;padding:8px';
 wrap.innerHTML=`<div style="width:min(100%,440px);max-height:88vh;overflow:auto;border-radius:22px 22px 14px 14px;background:linear-gradient(#121419,#08090c);border:1px solid rgba(255,38,63,.55);padding:13px;box-shadow:0 -10px 35px rgba(0,0,0,.5)">
 <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><b style="font-size:15px">🎙️ Valitse mikrofoni</b><div id="homeMicHint" style="font-size:9px;color:#aeb4bc;margin-top:4px">Haetaan laitteen audiotulot…</div></div><button id="homeMicClose" type="button" style="border:1px solid #555;background:#17191e;color:#fff;border-radius:10px;padding:8px 11px">SULJE</button></div>
 <div id="homeMicList" style="display:grid;gap:7px;margin-top:11px"></div>
 <button id="homeMicOff" type="button" style="width:100%;margin-top:10px;padding:11px;border-radius:11px;border:1px solid #555;background:#17191e;color:#fff;font-weight:800">MIKROFONI POIS</button>
 </div>`;
 document.body.appendChild(wrap);
 $('homeMicClose').onclick=()=>{wrap.style.display='none'};
 wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.style.display='none'});
 $('homeMicOff').onclick=async()=>{setDesired('mic',false);try{if(typeof stopAudio==='function')await stopAudio()}catch{}decorateMicState();wrap.style.display='none'};
}

async function currentInputs(requestPermission=true){
 if(!navigator.mediaDevices?.enumerateDevices)return [];
 try{
  if(requestPermission&&typeof enumerateAudio==='function')await enumerateAudio(true);
  const ds=await navigator.mediaDevices.enumerateDevices();
  const now=ds.filter(d=>d.kind==='audioinput');rememberMics(now);return now
 }catch{return []}
}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
async function chooseMic(deviceId){
 localStorage.setItem(AUDIO_DEVICE_KEY,deviceId);setDesired('mic',true);
 try{if(typeof enumerateAudio==='function')await enumerateAudio(false)}catch{}
 const sel=$('audioDevice');if(sel){sel.value=deviceId;sel.dispatchEvent(new Event('change',{bubbles:true}))}
 try{if(typeof stopAudio==='function'&&micActive())await stopAudio()}catch{}
 let ok=false;try{if(typeof startAudio==='function')ok=await startAudio()}catch{}
 setDesired('mic',true);decorateMicState();
 const hint=$('homeMicHint');if(hint)hint.textContent=ok?'Mikrofoni aktiivinen.':'Valinta tallennettu • odottaa aktivointia tai laite ei ole saatavilla.';
 if(ok)setTimeout(()=>{$('homeMicPicker').style.display='none'},350)
}
async function renderMicPicker(){
 ensureModal();const wrap=$('homeMicPicker'),list=$('homeMicList'),hint=$('homeMicHint');wrap.style.display='flex';list.innerHTML='<div style="padding:12px;color:#bbb;font-size:10px">Haetaan mikrofoneja…</div>';
 const current=await currentInputs(true),currentIds=new Set(current.map(x=>x.deviceId)),all=rememberMics(current),selected=localStorage.getItem(AUDIO_DEVICE_KEY)||'';
 hint.textContent=current.length?`${current.length} audiotuloa löytyi. Valitse käytettävä mikrofoni.`:'Mikrofoneja ei löytynyt tai lupaa ei saatu. Aiemmin tunnetut laitteet näytetään silti.';
 if(!all.length){list.innerHTML='<div style="padding:12px;border:1px solid #39252a;border-radius:11px;color:#bbb;font-size:10px">Ei tunnettuja mikrofoneja.</div>';return}
 list.innerHTML='';
 for(const d of all){const available=currentIds.has(d.deviceId),btn=document.createElement('button');btn.type='button';btn.disabled=!available;btn.style.cssText=`text-align:left;width:100%;padding:11px;border-radius:12px;border:1px solid ${d.deviceId===selected?'#ff263f':'#34363d'};background:${available?'#101217':'#090a0d'};color:${available?'#fff':'#737780'};opacity:${available?'1':'.7'}`;btn.innerHTML=`<b style="display:block;font-size:10px">${esc(d.label||'Mikrofoni')}</b><span style="display:block;font-size:8px;margin-top:4px">${available?(d.deviceId===selected?'VALITTU • SAATAVILLA':'SAATAVILLA'):'EI NYT SAATAVILLA'}</span>`;if(available)btn.onclick=()=>chooseMic(d.deviceId);list.appendChild(btn)}
}

function hookHomeMic(){
 const b=$('extMicBtn');if(!b)return false;
 b.onclick=e=>{if(e.target?.classList?.contains('ib'))return;e.preventDefault();e.stopPropagation();renderMicPicker()};
 const chip=$('extChip');if(chip)chip.onclick=e=>{e.preventDefault();e.stopPropagation();renderMicPicker()};
 return true
}

async function restoreSensors(){
 const p=readPrefs();restoring=true;
 try{
  if(p.gps&&!$('gpsDot')?.classList.contains('on'))try{$('gpsChip')?.click()}catch{}
  if(p.imu&&!$('imuDot')?.classList.contains('on'))try{$('imuChip')?.click()}catch{}
  if(p.mic){
   const chosen=localStorage.getItem(AUDIO_DEVICE_KEY)||'';
   if(chosen){try{if(typeof enumerateAudio==='function')await enumerateAudio(false)}catch{};try{if(typeof startAudio==='function')await startAudio()}catch{}}
  }
 }finally{restoring=false;setTimeout(decorateMicState,100)}
}

function attachPersistence(){
 ['gpsChip','imuChip','sensorBtn','extChip','extMicBtn','armBtn','manualBtn'].forEach(id=>$(id)?.addEventListener('click',()=>setTimeout(saveFromUi,500)));
 if(navigator.mediaDevices?.addEventListener)navigator.mediaDevices.addEventListener('devicechange',()=>{currentInputs(false).then(()=>decorateMicState())});
 const obs=new MutationObserver(()=>decorateMicState());if($('extMicBtn'))obs.observe($('extMicBtn'),{attributes:true,attributeFilter:['class']});if($('extState'))obs.observe($('extState'),{childList:true,subtree:true});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')decorateMicState()});
}

function boot(){
 if(!$('extMicBtn')||!$('gpsChip')||!$('imuChip')){setTimeout(boot,200);return}
 ensureModal();hookHomeMic();attachPersistence();decorateMicState();setTimeout(restoreSensors,450);
 try{if(typeof addLearningEvent==='function')addLearningEvent('sensor_persistence_loaded',{module:MODULE})}catch{}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
