(() => {
'use strict';
const MODULE='motolab-phone-bridge-v1';
const PREF_KEY='motolab_v32_sensor_prefs';
const AUTO_RIDE_KEY='motorlab_auto_ride_enabled';
const $=id=>document.getElementById(id);
let enabled=false,busy=false,timer=null,lastError='';

function readPrefs(){try{return {...{gps:false,imu:false,mic:false},...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}}catch{return {gps:false,imu:false,mic:false}}}
function writePrefs(next){localStorage.setItem(PREF_KEY,JSON.stringify({...readPrefs(),...next}))}
function logEvent(type,data={}){try{if(typeof addLearningEvent==='function')addLearningEvent(type,{module:MODULE,...data})}catch{}}
function micActive(){try{return !!globalThis.MotoLabMicAuthority?.active}catch{return !!globalThis.extMicOn}}
function gpsActive(){try{return !!globalThis.gpsOn}catch{return !!$('gpsDot')?.classList.contains('on')}}
function imuActive(){try{return !!globalThis.imuOn}catch{return !!$('imuDot')?.classList.contains('on')}}
function phoneRpm(){const p=globalThis.MOTOLAB_PHONE_RPM||{};return {rpm:+p.rpm||0,rawRpm:+p.rawRpm||0,conf:+p.conf||0,f0:+p.observedF0||0,trackLabel:p.trackLabel||''}}
function snapshot(){
 const p=phoneRpm(),u=globalThis.lastUi||{};
 return {
  module:MODULE,t:Date.now(),enabled,busy,lastError,
  sensors:{mic:micActive(),gps:gpsActive(),imu:imuActive()},
  mic:p,
  gps:{kmh:Number.isFinite(+u.kmh)?+u.kmh:null,accuracyM:Number.isFinite(+u.gpsAcc)?+u.gpsAcc:null},
  motion:{accelMps2:Number.isFinite(+u.a)?+u.a:null,accelG:Number.isFinite(+u.g)?+u.g:null}
 };
}
function emit(){const s=snapshot();globalThis.MOTOLAB_PHONE_BRIDGE_STATE=s;try{window.dispatchEvent(new CustomEvent('motolab-phone-bridge-state',{detail:s}))}catch{}return s}

function styleButton(b,kind='normal'){
 if(!b)return;
 const danger=kind==='danger';
 b.style.cssText=`width:100%;padding:12px;border-radius:11px;border:1px solid ${danger?'#ff263f':'#3b8e42'};background:${danger?'linear-gradient(#6a1220,#31080e)':'linear-gradient(#153c18,#0b220d)'};color:#fff;font:900 11px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif`;
}
function mount(){
 if($('phoneBridgeChip'))return;
 const statuses=document.querySelector('.statuses');
 if(statuses){
  const chip=document.createElement('button');chip.id='phoneBridgeChip';chip.type='button';chip.className='spill clickable';chip.style.border='1px solid rgba(255,38,63,.35)';chip.innerHTML='<span id="phoneBridgeDot" class="dot"></span><span>PHONE</span>';
  chip.onclick=()=>openPanel();statuses.appendChild(chip);
 }
 const modal=document.createElement('div');modal.id='phoneBridgeModal';modal.style.cssText='position:fixed;inset:0;z-index:100200;display:none;background:rgba(0,0,0,.78);align-items:flex-end;justify-content:center;padding:8px';
 modal.innerHTML=`<div style="width:min(100%,440px);border-radius:22px 22px 14px 14px;background:linear-gradient(#121419,#08090c);border:1px solid rgba(255,38,63,.55);padding:13px;box-shadow:0 20px 60px #000">
  <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div><b style="font-size:15px">📱 MotorLab Phone Bridge</b><div style="font-size:9px;color:#aeb4bc;margin-top:4px">Rajattu mittalaiteyhteys • mic RPM + GPS + IMU</div></div><button id="phoneBridgeClose" type="button" style="border:1px solid #555;background:#17191e;color:#fff;border-radius:10px;padding:8px 11px">SULJE</button></div>
  <div id="phoneBridgeState" style="margin-top:11px;padding:10px;border:1px solid #30343b;border-radius:11px;background:#08090c;color:#d8dde5;font:10px/1.55 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">VALMIS</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px"><button id="phoneBridgeOn" type="button">PHONE BRIDGE ON</button><button id="phoneBridgeOff" type="button">MASTER OFF</button></div>
  <div style="font-size:8px;color:#8f949c;line-height:1.45;margin-top:9px">Mic-RPM:n nykyiseen laskenta-algoritmiin ei tehdä muutoksia. Kamera ja BLE eivät kuulu v1:een.</div>
 </div>`;
 document.body.appendChild(modal);
 styleButton($('phoneBridgeOn'),'normal');styleButton($('phoneBridgeOff'),'danger');
 $('phoneBridgeClose').onclick=()=>modal.style.display='none';
 modal.addEventListener('click',e=>{if(e.target===modal)modal.style.display='none'});
 $('phoneBridgeOn').onclick=start;
 $('phoneBridgeOff').onclick=masterOff;
 paint();
}
function openPanel(){mount();$('phoneBridgeModal').style.display='flex';paint()}
function paint(){
 const s=emit(),dot=$('phoneBridgeDot'),box=$('phoneBridgeState'),chip=$('phoneBridgeChip');
 const all=s.sensors.mic&&s.sensors.gps&&s.sensors.imu;
 if(dot){dot.classList.toggle('on',enabled&&all);dot.classList.toggle('warn',enabled&&!all)}
 if(chip)chip.title=enabled?'Phone Bridge active':'Phone Bridge off';
 if(box){
  const rpm=s.mic.rpm?`${Math.round(s.mic.rpm)} RPM • ${Math.round(s.mic.conf*100)} %`:'–';
  box.innerHTML=`<b>${busy?'KÄYNNISTETÄÄN…':enabled?'BRIDGE ON':'BRIDGE OFF'}</b><br>MIC ${s.sensors.mic?'ON':'OFF'} • GPS ${s.sensors.gps?'ON':'OFF'} • IMU ${s.sensors.imu?'ON':'OFF'}<br>Mic RPM: ${rpm}${lastError?`<br><span style="color:#ff7586">${String(lastError).replace(/[&<>]/g,'')}</span>`:''}`;
 }
}
async function start(){
 if(busy)return false;busy=true;lastError='';paint();
 writePrefs({gps:true,imu:true,mic:true});
 const errors=[];
 try{
  // iOS motion permission is the most gesture-sensitive, so ask it first.
  try{if(typeof globalThis.startIMU==='function')await globalThis.startIMU()}catch(e){errors.push('IMU '+(e?.message||e))}
  try{if(typeof globalThis.startGPS==='function')await globalThis.startGPS()}catch(e){errors.push('GPS '+(e?.message||e))}
  try{
   if(globalThis.MotoLabMicAuthority?.on)await globalThis.MotoLabMicAuthority.on('phone_bridge');
   else if(typeof globalThis.startAudio==='function')await globalThis.startAudio();
  }catch(e){errors.push('MIC '+(e?.message||e))}
  enabled=true;lastError=errors.join(' • ');
  logEvent('phone_bridge_on',{sensors:snapshot().sensors,errors});
  return errors.length===0;
 }finally{busy=false;paint()}
}
async function masterOff(){
 if(busy)return false;busy=true;lastError='';
 try{
  enabled=false;
  writePrefs({gps:false,imu:false,mic:false});
  try{localStorage.setItem(AUTO_RIDE_KEY,'0')}catch{}
  try{globalThis.MotoLabSensorAutostart?.setAutoRide?.(false)}catch{}
  const errors=[];
  try{if(globalThis.MotoLabMicAuthority?.off)await globalThis.MotoLabMicAuthority.off('phone_bridge_master_off');else if(typeof globalThis.stopAudio==='function')await globalThis.stopAudio()}catch(e){errors.push('MIC '+(e?.message||e))}
  try{if(typeof globalThis.stopGPS==='function')globalThis.stopGPS()}catch(e){errors.push('GPS '+(e?.message||e))}
  try{if(typeof globalThis.stopIMU==='function')globalThis.stopIMU()}catch(e){errors.push('IMU '+(e?.message||e))}
  lastError=errors.join(' • ');
  logEvent('phone_bridge_master_off',{errors});
  return errors.length===0;
 }finally{busy=false;paint()}
}
function boot(){
 if(!document.body){setTimeout(boot,100);return}
 mount();
 timer=setInterval(paint,700);
 logEvent('phone_bridge_loaded',{explicitUserStart:true,masterOff:true,micAlgorithmUntouched:true});
}

globalThis.MotoLabPhoneBridge={version:MODULE,start,masterOff,open:openPanel,snapshot,get enabled(){return enabled}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();