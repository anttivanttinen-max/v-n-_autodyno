(() => {
'use strict';
const MODULE='sensor-autostart-v4-auto-ride';
const PREF_KEY='motolab_v32_sensor_prefs';
const AUTO_RIDE_KEY='motorlab_auto_ride_enabled';
let busy=false,lastTry={gps:0,imu:0},startupReady=false,timer=null;
let autoArmDone=false,autoArmBusy=false;
const $=id=>document.getElementById(id);
function prefs(){try{return {...{gps:false,imu:false,mic:false},...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}}catch{return {gps:false,imu:false,mic:false}}}
function gpsLive(){return !!$('gpsDot')?.classList.contains('on')}
function imuLive(){return !!$('imuDot')?.classList.contains('on')}
function autoRideEnabled(){
 try{
  const v=localStorage.getItem(AUTO_RIDE_KEY);
  if(v===null){localStorage.setItem(AUTO_RIDE_KEY,'1');return true}
  return v!=='0';
 }catch{return true}
}
function logEvent(type,data={}){try{if(typeof addLearningEvent==='function')addLearningEvent(type,{module:MODULE,...data})}catch{}}
async function tryStart(kind,force=false){
 if(!startupReady)return false;
 const now=Date.now();
 if(!force&&now-lastTry[kind]<7000)return false;
 lastTry[kind]=now;
 try{
  if(kind==='gps'){
   if(gpsLive())return true;
   if(typeof startGPS==='function')await startGPS();
   return gpsLive();
  }
  if(kind==='imu'){
   if(imuLive())return true;
   if(typeof startIMU==='function')await startIMU();
   return imuLive();
  }
 }catch{}
 return false;
}
async function ensureNonAudioSensors(force=false){
 if(!startupReady||busy||document.visibilityState==='hidden')return;
 busy=true;
 try{
  const p=prefs();
  if(p.gps)await tryStart('gps',force);
  if(p.imu)await tryStart('imu',force);
  logEvent('sensor_autostart_check',{desired:p,active:{gps:gpsLive(),imu:imuLive(),mic:globalThis.MotoLabMicAuthority?.active||false},micAutostart:false,force});
 }finally{busy=false}
}
async function ensureAutoRide(force=false){
 if(!startupReady||autoArmBusy||document.visibilityState==='hidden'||!autoRideEnabled())return false;
 if(autoArmDone&&!force)return true;
 const arm=$('armBtn');
 if(!arm)return false;
 autoArmBusy=true;
 try{
  // ARM AUTO already owns the correct startup sequence: wake lock, GPS, optional mic and worker arming.
  // Calling the existing control keeps one canonical measurement path instead of duplicating dyno logic here.
  arm.click();
  autoArmDone=true;
  logEvent('auto_ride_autostart',{enabled:true,gps:gpsLive(),imu:imuLive(),mic:globalThis.MotoLabMicAuthority?.active||false});
  return true;
 }catch(e){
  autoArmDone=false;
  logEvent('auto_ride_autostart_error',{error:e?.name||e?.message||String(e)});
  return false;
 }finally{autoArmBusy=false}
}
function release(){
 if(startupReady)return;
 startupReady=true;
 setTimeout(()=>ensureNonAudioSensors(false),350);
 setTimeout(()=>ensureAutoRide(false),850);
}
function boot(){
 if(!$('gpsDot')||!$('imuDot')||!$('extMicBtn')||!$('armBtn')){setTimeout(boot,220);return}
 if(globalThis.MotorLabStartupReady)release();
 else document.addEventListener('motorlab-startup-ready',release,{once:true});
 timer=setInterval(()=>ensureNonAudioSensors(false),7000);
 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&startupReady){
   setTimeout(()=>ensureNonAudioSensors(true),300);
   if(!autoArmDone)setTimeout(()=>ensureAutoRide(false),700);
  }
 });
 window.addEventListener('online',()=>ensureNonAudioSensors(true));
 logEvent('sensor_autostart_loaded',{micRequiresExplicitUserGesture:true,autoRideEnabled:autoRideEnabled(),autoRideRestoresOnLaunch:true});
}
globalThis.MotoLabSensorAutostart={
 version:MODULE,
 ensure:ensureNonAudioSensors,
 ensureAutoRide,
 autoRideEnabled,
 setAutoRide(on){
  try{localStorage.setItem(AUTO_RIDE_KEY,on?'1':'0')}catch{}
  if(on){autoArmDone=false;return ensureAutoRide(true)}
  return false;
 }
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
