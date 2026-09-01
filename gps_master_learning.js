(() => {
'use strict';
const MODE='gpslearn';
const MODULE_VERSION='v32-gps-master-mic-learn-3';
const $m=id=>document.getElementById(id);

function drivetrainReference(){
  try{
    const p=typeof getCurrentProfile==='function'?getCurrentProfile():null;
    const d=p?.knowledge?.drivetrain||{};
    const gear=Math.max(1,Math.min(6,+($m('manualGear')?.value||0)||0));
    const primary=+d.primaryRatio;
    const gears=Array.isArray(d.gearRatios)?d.gearRatios:[];
    const gearRatio=+gears[gear-1];
    const front=+d.frontSprocket,rear=+d.rearSprocket;
    const finalRatio=+d.finalRatio||(front>0&&rear>0?rear/front:0);
    const wheelCircMm=+d.wheelCircMm;
    if(!(primary>0&&gearRatio>0&&finalRatio>0&&wheelCircMm>0))return null;
    const rpmPerKmh=(16666.6666667/wheelCircMm)*primary*gearRatio*finalRatio;
    if(!Number.isFinite(rpmPerKmh)||rpmPerKmh<=0)return null;
    return {gear,ratio:rpmPerKmh,source:'profile_drivetrain',primary,gearRatio,finalRatio,wheelCircMm};
  }catch{return null}
}

function gpsReferenceMeta(){
  const gear=+($m('manualGear')?.value||0)||null;
  const d=drivetrainReference();
  if(d)return d;
  try{
    const a=typeof getGpsCalibrations==='function'?getGpsCalibrations():[];
    const c=(a||[]).find(x=>+x.gear===+gear&&+x.ratio>0);
    if(c)return {gear,ratio:+c.ratio,source:'gps_calibration'};
  }catch{}
  return {gear,ratio:null,source:'missing_reference'};
}

function micLearningState(s,refMeta,gpsRef){
  const mic=Number.isFinite(s?.audioRpm)?s.audioRpm:null;
  const raw=Number.isFinite(s?.audioRawRpm)?s.audioRawRpm:null;
  const level=Number.isFinite(s?.audioLevel)?s.audioLevel:null;
  const micSignalPresent=(mic!=null&&mic>0)||(raw!=null&&raw>0)||(level!=null&&level>0);
  const gpsReferenceAvailable=Number.isFinite(refMeta?.ratio)&&refMeta.ratio>0;
  const gpsMotionReferenceAvailable=Number.isFinite(gpsRef)&&gpsRef>0;
  const state=!gpsReferenceAvailable?'GPS_NO_REFERENCE':(micSignalPresent?'MIC_SIGNAL':'MIC_ZERO');
  return {state,micSignalPresent,gpsReferenceAvailable,gpsMotionReferenceAvailable,learningEligible:gpsReferenceAvailable&&gpsMotionReferenceAvailable&&micSignalPresent};
}
function installModeOption(){const sel=$m('rpmSourceMode');if(!sel)return false;if(![...sel.options].some(o=>o.value===MODE)){const opt=document.createElement('option');opt.value=MODE;opt.textContent='GPS MASTER + MIC LEARN';sel.insertBefore(opt,sel.firstChild)}const flag='motolab_v32_gps_master_default_set';if(!localStorage.getItem(flag)){sel.value=MODE;try{const key=(typeof SETTINGS_KEY!=='undefined'&&SETTINGS_KEY)||'motolab_v26_settings';const d=JSON.parse(localStorage.getItem(key)||'{}');d.rpmSourceMode=MODE;localStorage.setItem(key,JSON.stringify(d))}catch{}localStorage.setItem(flag,'1')}return true}
function referenceText(){const r=gpsReferenceMeta();if(r.ratio)return `${r.source==='profile_drivetrain'?'VÄLITYKSISTÄ':'GPS-KALIBROINNISTA'} ${r.ratio.toFixed(2)} rpm/kmh`;return 'RPM-REFERENSSI PUUTTUU: kalibroi vaihde tai anna välitykset + renkaan ympärys'}
function installControls(){const status=$m('sourceModeStatus');if(!status||$m('gpsMasterPrepare'))return;const box=document.createElement('div');box.className='statusbox';box.id='gpsMasterBox';box.innerHTML=`<b>GPS MASTER TESTI</b><br>GPS määrää näytetyn RPM:n ja vedon. BT MIC tallentuu vain oppimis-/shadow-dataksi eikä saa vaikuttaa vetoon.<br><button id="gpsMasterPrepare" class="action" type="button" style="width:100%;margin-top:7px">VALMISTELE GPS + MIC TESTI</button><div id="gpsMasterState" class="tiny" style="margin-top:6px">Valitse ensin oikea vaihde ja BT-kuulokemikrofoni.</div>`;status.insertAdjacentElement('afterend',box);$m('gpsMasterPrepare').onclick=async()=>{const sel=$m('rpmSourceMode');if(sel)sel.value=MODE;if(typeof updateSourceModeUI==='function')updateSourceModeUI();const ref=gpsReferenceMeta();let gpsOk=false,micOk=false;try{gpsOk=typeof startGPS==='function'?await startGPS():false}catch{}try{micOk=typeof startAudio==='function'?await startAudio():false}catch{}if(typeof addLearningEvent==='function')addLearningEvent('gps_master_mic_learn_prepare',{gpsOk:!!gpsOk,micOk:!!micOk,selectedGear:ref.gear,module:MODULE_VERSION,referenceSource:ref.source,rpmPerKmh:ref.ratio});const st=$m('gpsMasterState');if(st)st.textContent=`GPS ${gpsOk?'ON':'EI'} • MIC ${micOk?'ON':'EI'} • vaihde ${ref.gear||'–'} • ${referenceText()} • MIC ei ohjaa RPM:ää`}}
function patchCore(){if(typeof currentSettings==='function'&&!currentSettings.__gpsMasterPatched){const original=currentSettings;const patched=function(){const c=original();if($m('rpmSourceMode')?.value===MODE){c.rpmSourceMode='gps';c.gearLearn=false;c.gpsMasterMicLearn=true;const ref=drivetrainReference();if(ref){const existing=(c.gpsCalibrations||[]).filter(x=>+x.gear!==+ref.gear);c.gpsCalibrations=[...existing,{gear:ref.gear,ratio:ref.ratio,source:'profile_drivetrain'}];c.selectedGear=ref.gear}}return c};patched.__gpsMasterPatched=true;currentSettings=patched}
if(typeof updateSourceModeUI==='function'&&!updateSourceModeUI.__gpsMasterPatched){const original=updateSourceModeUI;const patched=function(){if($m('rpmSourceMode')?.value!==MODE)return original();const s=$m('sourceModeStatus');if(s)s.textContent=`GPS MASTER + MIC LEARN: GPS/nopeus + valittu vaihde määrää RPM:n (${referenceText()}). BT MIC tallennetaan shadow-dataksi eikä se vaikuta RPM:ään, vaihdeoppimiseen tai vedon hyväksyntään.`;if(typeof pushConfig==='function')pushConfig()};patched.__gpsMasterPatched=true;updateSourceModeUI=patched}
if(typeof collectLearningSample==='function'&&!collectLearningSample.__gpsMasterPatched){const patched=function(s){if(!learningEnabled||!learningSensorsActive()||!s)return;ensureLearningSession();const mode=$m('rpmSourceMode')?.value||'fusion';const refMeta=gpsReferenceMeta();const gpsRef=Number.isFinite(s.speedRpm)?s.speedRpm:null;const gpsRefConf=Number.isFinite(s.speedConf)?s.speedConf:null;const mic=Number.isFinite(s.audioRpm)?s.audioRpm:null;const raw=Number.isFinite(s.audioRawRpm)?s.audioRawRpm:null;const delta=(gpsRef&&mic!=null)?mic-gpsRef:null;const errPct=(gpsRef&&mic!=null)?Math.abs(delta)/Math.max(1,gpsRef)*100:null;const ratio=(gpsRef&&mic!=null)?mic/gpsRef:null;const micState=micLearningState(s,refMeta,gpsRef);const row={t:s.t||Date.now(),profileId:getCurrentProfile?.()?.id||null,rpmSourceMode:mode,selectedGear:+$m('manualGear')?.value||null,learningPhase:mode===MODE?'gps_master_mic_learn':'normal',rpmControlAuthority:mode===MODE?'gps':(s.source||null),micInfluencesDisplayedRpm:mode===MODE?false:null,micInfluencesRunAcceptance:mode===MODE?false:null,micInfluencesGearLearning:mode===MODE?false:null,micLearningState:mode===MODE?micState.state:null,micSignalPresent:mode===MODE?micState.micSignalPresent:null,gpsReferenceAvailable:mode===MODE?micState.gpsReferenceAvailable:null,gpsMotionReferenceAvailable:mode===MODE?micState.gpsMotionReferenceAvailable:null,micLearningEligible:mode===MODE?micState.learningEligible:null,gpsReferenceSource:mode===MODE?refMeta.source:null,gpsReferenceRpmPerKmh:mode===MODE?refMeta.ratio:null,gpsReferenceRpm:gpsRef,gpsReferenceConf:gpsRefConf,gpsReferenceKmh:Number.isFinite(s.kmh)?s.kmh:null,gpsReferenceAgeMs:Number.isFinite(s.gpsAgeMs)?s.gpsAgeMs:null,gpsReferenceGear:+$m('manualGear')?.value||s.gear||null,micShadowRpm:mic,micShadowRawRpm:raw,micShadowDeltaRpm:delta,micShadowErrorPct:errPct,micShadowRatioToGps:ratio,audioRawRpm:raw,audioRpm:mic,audioConf:Number.isFinite(s.audioConf)?s.audioConf:null,observedF0Hz:Number.isFinite(s.audioObservedF0)?s.audioObservedF0:null,fingerprintScore:Number.isFinite(s.audioFpScore)?s.audioFpScore:null,candidateGap:Number.isFinite(s.audioCandidateGap)?s.audioCandidateGap:null,runnerRpm:Number.isFinite(s.audioRunnerRpm)?s.audioRunnerRpm:null,audioLevel:Number.isFinite(s.audioLevel)?s.audioLevel:null,speedRpm:gpsRef,speedConf:gpsRefConf,fusedRpm:Number.isFinite(s.fusionRpm)?s.fusionRpm:null,fusedConf:Number.isFinite(s.conf)?s.conf:null,source:s.source||null,fusionMode:s.fusionMode||null,gpsKmh:Number.isFinite(s.kmh)?s.kmh:null,gpsAccuracyM:Number.isFinite(s.gpsAcc)?s.gpsAcc:null,accelerationMps2:Number.isFinite(s.a)?s.a:null,accelerationG:Number.isFinite(s.g)?s.g:null,motionMag:Number.isFinite(s.motionMag)?s.motionMag:null,motionAgeMs:Number.isFinite(s.motionAgeMs)?s.motionAgeMs:null,gear:s.gear||null,gearConf:Number.isFinite(s.gearConf)?s.gearConf:null,rpmPerKmh:Number.isFinite(s.ratio)?s.ratio:null,slip:!!s.slip,agreement:Number.isFinite(s.agreement)?s.agreement:null,estimatedHp:Number.isFinite(s.hp)?s.hp:null,estimatedNm:Number.isFinite(s.nm)?s.nm:null,sampleQuality:Number.isFinite(s.quality)?s.quality:null};learningBuffer.push(row);learningSampleCount++;if(learningBuffer.length>=250||Date.now()-learningLastStore>30000)flushLearningChunk();if(Date.now()-lastLearningUiAt>500){lastLearningUiAt=Date.now();updateLearningUi()}};patched.__gpsMasterPatched=true;collectLearningSample=patched}}
function patchLiveStatus(){const sel=$m('rpmSourceMode');if(!sel||sel.__gpsMasterListener)return;sel.__gpsMasterListener=true;sel.addEventListener('change',()=>{if(sel.value===MODE&&typeof addLearningEvent==='function')addLearningEvent('gps_master_mic_learn_selected',{selectedGear:+($m('manualGear')?.value||0)||null,module:MODULE_VERSION,reference:gpsReferenceMeta()});const st=$m('gpsMasterState');if(st)st.textContent=sel.value===MODE?`GPS MASTER valittu • ${referenceText()}`:'GPS MASTER ei valittuna.'});$m('manualGear')?.addEventListener('change',()=>{if(sel.value===MODE){if(typeof updateSourceModeUI==='function')updateSourceModeUI();const st=$m('gpsMasterState');if(st)st.textContent=`Vaihde vaihdettu • ${referenceText()}`}})}
function boot(){if(!installModeOption()){setTimeout(boot,180);return}patchCore();installControls();patchLiveStatus();if($m('rpmSourceMode')?.value===MODE&&typeof updateSourceModeUI==='function')updateSourceModeUI();if(typeof addLearningEvent==='function')addLearningEvent('gps_master_module_loaded',{module:MODULE_VERSION,reference:gpsReferenceMeta()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
