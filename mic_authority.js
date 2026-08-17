(() => {
'use strict';
const MODULE='motolab-mic-authority-v2';
const PREF_KEY='motolab_v32_sensor_prefs';
let wrapped=false,queue=Promise.resolve(),seq=0;
function readPrefs(){try{return {...{gps:false,imu:false,mic:false},...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}}catch{return {gps:false,imu:false,mic:false}}}
function writeMic(v,source='unknown'){const p=readPrefs();p.mic=!!v;localStorage.setItem(PREF_KEY,JSON.stringify(p));try{if(typeof addLearningEvent==='function')addLearningEvent('mic_user_authority',{module:MODULE,desired:!!v,source})}catch{};window.dispatchEvent(new CustomEvent('motolab-mic-desired',{detail:{desired:!!v,source,module:MODULE}}))}
function micActive(){try{const s=globalThis.audioSessions?.ext?.stream,t=globalThis.audioSessions?.ext?.track||s?.getAudioTracks?.()[0];return !!(t&&t.readyState==='live'&&t.enabled!==false&&(!s||s.active!==false))}catch{return false}}
function wrapStartAudio(){if(wrapped||typeof globalThis.startAudio!=='function')return;const original=globalThis.startAudio;if(original.__motolabMicAuthorityWrapped){wrapped=true;return}const guarded=async function(){if(!readPrefs().mic){try{if(typeof addLearningEvent==='function')addLearningEvent('mic_start_blocked_user_off',{module:MODULE})}catch{}return false}return original.apply(this,arguments)};guarded.__motolabMicAuthorityWrapped=true;guarded.__motolabOriginal=original;globalThis.startAudio=guarded;wrapped=true}
async function enforceOff(source='authority'){if(readPrefs().mic)return false;try{const live=micActive();if(live&&typeof globalThis.stopAudio==='function'){await globalThis.stopAudio();try{if(typeof addLearningEvent==='function')addLearningEvent('mic_forced_stop_user_off',{module:MODULE,source})}catch{}}return !micActive()}catch{return false}}
async function run(action,source){const id=++seq;wrapStartAudio();let want;if(action==='toggle')want=!readPrefs().mic;else want=action==='on';try{if(typeof addLearningEvent==='function')addLearningEvent('mic_command_start',{module:MODULE,id,action,source,desiredBefore:!!readPrefs().mic,activeBefore:micActive()})}catch{}
 writeMic(want,source);
 let ok=false,error='';
 try{if(!want){globalThis.MOTOLAB_MIC_USER_OFF_AT=Date.now();if(typeof globalThis.stopAudio==='function')await globalThis.stopAudio();await enforceOff(source);ok=!micActive()}else{if(micActive())ok=true;else if(typeof globalThis.startAudio==='function')ok=!!(await globalThis.startAudio());else error='startAudio_missing'}}catch(e){error=e?.name||e?.message||String(e)}
 const result={id,action,source,desired:!!readPrefs().mic,active:micActive(),ok:want?micActive():!micActive(),error};
 try{if(typeof addLearningEvent==='function')addLearningEvent('mic_command_done',{module:MODULE,...result})}catch{};window.dispatchEvent(new CustomEvent('motolab-mic-command-done',{detail:result}));return result
}
function command(action='toggle',source='api'){queue=queue.catch(()=>{}).then(()=>run(action,source));return queue}
function interceptControl(e){const control=e.target?.closest?.('#extMicBtn,#extChip');if(!control||e.target?.closest?.('.ib'))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();command('toggle',control.id)}
function interceptOff(e){const control=e.target?.closest?.('#homeMicOff,[data-motolab-mic-off="1"]');if(!control)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();command('off',control.id||'mic-off')}
function boot(){document.addEventListener('click',interceptControl,{capture:true});document.addEventListener('click',interceptOff,{capture:true});wrapStartAudio();setInterval(()=>{wrapStartAudio();enforceOff('periodic')},500);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){wrapStartAudio();enforceOff('visibility')}});try{if(typeof addLearningEvent==='function')addLearningEvent('mic_authority_loaded',{module:MODULE,unifiedControls:['extMicBtn','extChip']})}catch{}}
globalThis.MotoLabMicAuthority={version:MODULE,command,toggle:(source='api')=>command('toggle',source),on:(source='api')=>command('on',source),off:(source='api')=>command('off',source),setDesired(v,source='api'){return command(v?'on':'off',source)},get desired(){return !!readPrefs().mic},get active(){return micActive()}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
