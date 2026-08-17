(() => {
'use strict';
const MODULE='motolab-mic-authority-v1';
const PREF_KEY='motolab_v32_sensor_prefs';
let wrapped=false;
function readPrefs(){try{return {...{gps:false,imu:false,mic:false},...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}}catch{return {gps:false,imu:false,mic:false}}}
function writeMic(v){const p=readPrefs();p.mic=!!v;localStorage.setItem(PREF_KEY,JSON.stringify(p));try{if(typeof addLearningEvent==='function')addLearningEvent('mic_user_authority',{module:MODULE,desired:!!v})}catch{}}
function isOffControl(target){const e=target?.closest?.('#homeMicOff,[data-motolab-mic-off="1"]');return !!e}
function markOffEarly(e){if(!isOffControl(e.target))return;writeMic(false);globalThis.MOTOLAB_MIC_USER_OFF_AT=Date.now()}
function wrapStartAudio(){if(wrapped||typeof globalThis.startAudio!=='function')return;const original=globalThis.startAudio;if(original.__motolabMicAuthorityWrapped){wrapped=true;return}const guarded=async function(){const desired=!!readPrefs().mic;if(!desired){try{if(typeof addLearningEvent==='function')addLearningEvent('mic_start_blocked_user_off',{module:MODULE})}catch{}return false}return original.apply(this,arguments)};guarded.__motolabMicAuthorityWrapped=true;guarded.__motolabOriginal=original;globalThis.startAudio=guarded;wrapped=true}
async function enforceOff(){if(readPrefs().mic)return;try{const s=globalThis.audioSessions?.ext?.stream,t=globalThis.audioSessions?.ext?.track||s?.getAudioTracks?.()[0];const live=!!(t&&t.readyState==='live'&&t.enabled!==false&&(!s||s.active!==false));if(live&&typeof globalThis.stopAudio==='function'){await globalThis.stopAudio();try{if(typeof addLearningEvent==='function')addLearningEvent('mic_forced_stop_user_off',{module:MODULE})}catch{}}}catch{}}
function boot(){['pointerdown','touchstart','click'].forEach(ev=>document.addEventListener(ev,markOffEarly,{capture:true,passive:true}));wrapStartAudio();setInterval(()=>{wrapStartAudio();enforceOff()},500);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){wrapStartAudio();enforceOff()}});try{if(typeof addLearningEvent==='function')addLearningEvent('mic_authority_loaded',{module:MODULE})}catch{}}
globalThis.MotoLabMicAuthority={version:MODULE,setDesired(v){writeMic(v);if(!v)enforceOff()},get desired(){return !!readPrefs().mic}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
