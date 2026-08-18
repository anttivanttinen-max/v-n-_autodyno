(() => {
'use strict';
const MODULE='motolab-mic-authority-v3-ios',PREF_KEY='motolab_v32_sensor_prefs',AUDIO_DEVICE_KEY='motolab_v28_audio_device';
let wrapped=false,queue=Promise.resolve(),seq=0;const $=id=>document.getElementById(id);
function readPrefs(){try{return {...{gps:false,imu:false,mic:false},...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}}catch{return {gps:false,imu:false,mic:false}}}
function writeMic(v,source='unknown'){const p=readPrefs();p.mic=!!v;localStorage.setItem(PREF_KEY,JSON.stringify(p));try{if(typeof addLearningEvent==='function')addLearningEvent('mic_user_authority',{module:MODULE,desired:!!v,source})}catch{};window.dispatchEvent(new CustomEvent('motolab-mic-desired',{detail:{desired:!!v,source,module:MODULE}}))}
function micActive(){try{const s=globalThis.audioSessions?.ext?.stream,t=globalThis.audioSessions?.ext?.track||s?.getAudioTracks?.()[0];return !!(t&&t.readyState==='live'&&t.enabled!==false&&(!s||s.active!==false))}catch{return false}}
function admin(){return globalThis.MotoLabUser?.user?.role==='admin'}
async function prepareDefaultInput(){
 const sel=$('audioDevice');if(sel?.value)return true;
 if(admin())return false;
 try{
  if(typeof globalThis.enumerateAudio==='function')await globalThis.enumerateAudio(true);
  const s=$('audioDevice');if(!s)return false;
  const options=[...s.options].filter(o=>o.value);if(!options.length)return false;
  const preferred=options.find(o=>/default|iphone|built.?in|sisäinen/i.test(o.textContent||''))||options[0];
  s.value=preferred.value;localStorage.setItem(AUDIO_DEVICE_KEY,preferred.value);s.dispatchEvent(new Event('change',{bubbles:true}));
  try{if(typeof addLearningEvent==='function')addLearningEvent('mic_default_input_selected',{module:MODULE,label:preferred.textContent||'',admin:false})}catch{}
  return true
 }catch{return false}
}
function wrapStartAudio(){if(wrapped||typeof globalThis.startAudio!=='function')return;const original=globalThis.startAudio;if(original.__motolabMicAuthorityWrapped){wrapped=true;return}const guarded=async function(){if(!readPrefs().mic){try{if(typeof addLearningEvent==='function')addLearningEvent('mic_start_blocked_user_off',{module:MODULE})}catch{}return false}if(!$('audioDevice')?.value)await prepareDefaultInput();return original.apply(this,arguments)};guarded.__motolabMicAuthorityWrapped=true;guarded.__motolabOriginal=original;globalThis.startAudio=guarded;wrapped=true}
async function enforceOff(source='authority'){if(readPrefs().mic)return false;try{if(micActive()&&typeof globalThis.stopAudio==='function')await globalThis.stopAudio();return !micActive()}catch{return false}}
async function run(action,source){const id=++seq;wrapStartAudio();const want=action==='toggle'?!readPrefs().mic:action==='on';writeMic(want,source);let error='';try{if(!want){globalThis.MOTOLAB_MIC_USER_OFF_AT=Date.now();if(typeof globalThis.stopAudio==='function')await globalThis.stopAudio();await enforceOff(source)}else{if(!micActive()){await prepareDefaultInput();if(typeof globalThis.startAudio==='function')await globalThis.startAudio();else error='startAudio_missing'}}}catch(e){error=e?.name||e?.message||String(e)}const result={id,action,source,desired:!!readPrefs().mic,active:micActive(),ok:want?micActive():!micActive(),error};try{if(typeof addLearningEvent==='function')addLearningEvent('mic_command_done',{module:MODULE,...result})}catch{};window.dispatchEvent(new CustomEvent('motolab-mic-command-done',{detail:result}));return result}
function command(action='toggle',source='api'){queue=queue.catch(()=>{}).then(()=>run(action,source));return queue}
function interceptControl(e){const control=e.target?.closest?.('#extMicBtn,#extChip');if(!control||e.target?.closest?.('.ib'))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();command('toggle',control.id)}
function interceptOff(e){const control=e.target?.closest?.('#homeMicOff,[data-motolab-mic-off="1"]');if(!control)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();command('off',control.id||'mic-off')}
function boot(){document.addEventListener('click',interceptControl,{capture:true});document.addEventListener('click',interceptOff,{capture:true});wrapStartAudio();setInterval(()=>{wrapStartAudio();enforceOff('periodic')},900);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){wrapStartAudio();enforceOff('visibility')}});try{if(typeof addLearningEvent==='function')addLearningEvent('mic_authority_loaded',{module:MODULE,serialized:true,iosExplicitStart:true})}catch{}}
globalThis.MotoLabMicAuthority={version:MODULE,command,toggle:(source='api')=>command('toggle',source),on:(source='api')=>command('on',source),off:(source='api')=>command('off',source),setDesired(v,source='api'){return command(v?'on':'off',source)},prepareDefaultInput,get desired(){return !!readPrefs().mic},get active(){return micActive()}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
