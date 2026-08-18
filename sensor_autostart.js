(() => {
'use strict';
const MODULE='sensor-autostart-v3-ios-safe',PREF_KEY='motolab_v32_sensor_prefs';
let busy=false,lastTry={gps:0,imu:0},startupReady=false,timer=null;const $=id=>document.getElementById(id);
function prefs(){try{return {...{gps:false,imu:false,mic:false},...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}}catch{return {gps:false,imu:false,mic:false}}}
function gpsLive(){return !!$('gpsDot')?.classList.contains('on')}function imuLive(){return !!$('imuDot')?.classList.contains('on')}
async function tryStart(kind,force=false){if(!startupReady)return false;const now=Date.now();if(!force&&now-lastTry[kind]<7000)return false;lastTry[kind]=now;try{if(kind==='gps'){if(gpsLive())return true;if(typeof startGPS==='function')await startGPS();return gpsLive()}if(kind==='imu'){if(imuLive())return true;if(typeof startIMU==='function')await startIMU();return imuLive()}}catch{}return false}
async function ensureNonAudioSensors(force=false){if(!startupReady||busy||document.visibilityState==='hidden')return;busy=true;try{const p=prefs();if(p.gps)await tryStart('gps',force);if(p.imu)await tryStart('imu',force);try{if(typeof addLearningEvent==='function')addLearningEvent('sensor_autostart_check',{module:MODULE,desired:p,active:{gps:gpsLive(),imu:imuLive(),mic:globalThis.MotoLabMicAuthority?.active||false},micAutostart:false,force})}catch{}}finally{busy=false}}
function release(){if(startupReady)return;startupReady=true;setTimeout(()=>ensureNonAudioSensors(false),350)}
function boot(){if(!$('gpsDot')||!$('imuDot')||!$('extMicBtn')){setTimeout(boot,220);return}if(globalThis.MotorLabStartupReady)release();else document.addEventListener('motorlab-startup-ready',release,{once:true});timer=setInterval(()=>ensureNonAudioSensors(false),7000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&startupReady)setTimeout(()=>ensureNonAudioSensors(true),300)});window.addEventListener('online',()=>ensureNonAudioSensors(true));try{if(typeof addLearningEvent==='function')addLearningEvent('sensor_autostart_loaded',{module:MODULE,micRequiresExplicitUserGesture:true})}catch{}}
globalThis.MotoLabSensorAutostart={version:MODULE,ensure:ensureNonAudioSensors};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
