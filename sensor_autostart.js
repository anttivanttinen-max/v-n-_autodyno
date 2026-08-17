(() => {
'use strict';
const MODULE='sensor-autostart-v2';
const PREF_KEY='motolab_v32_sensor_prefs';
let busy=false,lastTry={gps:0,imu:0,mic:0},timer=null,startupReady=false;
const $=id=>document.getElementById(id);
function prefs(){try{return {...{gps:false,imu:false,mic:false},...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}}catch{return {gps:false,imu:false,mic:false}}}
function micLive(){try{const s=audioSessions?.ext?.stream,t=audioSessions?.ext?.track||s?.getAudioTracks?.()[0];return !!(t&&t.readyState==='live'&&t.enabled!==false&&(!s||s.active!==false))}catch{return false}}
function gpsLive(){return !!$('gpsDot')?.classList.contains('on')}function imuLive(){return !!$('imuDot')?.classList.contains('on')}
async function tryStart(kind,force=false){if(!startupReady)return false;const now=Date.now();if(!force&&now-lastTry[kind]<6000)return false;lastTry[kind]=now;try{if(kind==='gps'){if(gpsLive())return true;if(typeof startGPS==='function')await startGPS();return gpsLive()}if(kind==='imu'){if(imuLive())return true;if(typeof startIMU==='function')await startIMU();return imuLive()}if(kind==='mic'){if(micLive())return true;if(typeof startAudio==='function')await startAudio();return micLive()}}catch{}return false}
async function ensureSensors(force=false){if(!startupReady||busy||document.visibilityState==='hidden')return;busy=true;try{const p=prefs(),out={};if(p.gps)out.gps=await tryStart('gps',force);if(p.imu)out.imu=await tryStart('imu',force);if(p.mic)out.mic=await tryStart('mic',force);try{if(typeof addLearningEvent==='function')addLearningEvent('sensor_autostart_check',{module:MODULE,desired:p,active:{gps:gpsLive(),imu:imuLive(),mic:micLive()},force})}catch{}}finally{busy=false}}
function releaseStartup(){if(startupReady)return;startupReady=true;setTimeout(()=>ensureSensors(false),350)}function onUserGesture(){if(startupReady)ensureSensors(true)}
function boot(){if(!$('gpsDot')||!$('imuDot')||!$('extMicBtn')){setTimeout(boot,250);return}if(globalThis.MotorLabStartupReady)releaseStartup();else document.addEventListener('motorlab-startup-ready',releaseStartup,{once:true});timer=setInterval(()=>ensureSensors(false),5000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&startupReady)setTimeout(()=>ensureSensors(true),250)});['pointerdown','touchstart','click'].forEach(ev=>document.addEventListener(ev,onUserGesture,{passive:true,capture:true}));window.addEventListener('online',()=>ensureSensors(true));try{if(typeof addLearningEvent==='function')addLearningEvent('sensor_autostart_loaded',{module:MODULE,startupGated:true})}catch{}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
