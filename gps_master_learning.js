(() => {
'use strict';
const MODE='gpslearn';
const MODULE_VERSION='v32-gps-master-mic-learn-1';
const $m=id=>document.getElementById(id);

function installModeOption(){
  const sel=$m('rpmSourceMode');
  if(!sel)return false;
  if(![...sel.options].some(o=>o.value===MODE)){
    const opt=document.createElement('option');
    opt.value=MODE; opt.textContent='GPS MASTER + MIC LEARN';
    sel.insertBefore(opt,sel.firstChild);
  }
  const flag='motolab_v32_gps_master_default_set';
  if(!localStorage.getItem(flag)){
    sel.value=MODE;
    try{
      const key=(typeof SETTINGS_KEY!=='undefined'&&SETTINGS_KEY)||'motolab_v26_settings';
      const d=JSON.parse(localStorage.getItem(key)||'{}');
      d.rpmSourceMode=MODE;
      localStorage.setItem(key,JSON.stringify(d));
    }catch{}
    localStorage.setItem(flag,'1');
  }
  return true;
}

function installControls(){
  const status=$m('sourceModeStatus');
  if(!status||$m('gpsMasterPrepare'))return;
  const box=document.createElement('div');
  box.className='statusbox';
  box.id='gpsMasterBox';
  box.innerHTML=`<b>GPS MASTER TESTI</b><br>GPS määrää näytetyn RPM:n ja vedon. BT MIC tallentuu vain oppimis-/shadow-dataksi eikä saa vaikuttaa vetoon.<br><button id="gpsMasterPrepare" class="action" type="button" style="width:100%;margin-top:7px">VALMISTELE GPS + MIC TESTI</button><div id="gpsMasterState" class="tiny" style="margin-top:6px">Valitse ensin oikea vaihde ja BT-kuulokemikrofoni.</div>`;
  status.insertAdjacentElement('afterend',box);
  $m('gpsMasterPrepare').onclick=async()=>{
    const sel=$m('rpmSourceMode'); if(sel)sel.value=MODE;
    if(typeof updateSourceModeUI==='function')updateSourceModeUI();
    let gpsOk=false,micOk=false;
    try{gpsOk=typeof startGPS==='function'?await startGPS():false}catch{}
    try{micOk=typeof startAudio==='function'?await startAudio():false}catch{}
    if(typeof addLearningEvent==='function')addLearningEvent('gps_master_mic_learn_prepare',{gpsOk:!!gpsOk,micOk:!!micOk,selectedGear:+($m('manualGear')?.value||0)||null,module:MODULE_VERSION});
    const st=$m('gpsMasterState');
    if(st)st.textContent=`GPS ${gpsOk?'ON':'EI'} • MIC ${micOk?'ON':'EI'} • vaihde ${$m('manualGear')?.value||'–'} • MIC ei ohjaa RPM:ää`;
  };
}

function patchCore(){
  if(typeof currentSettings==='function'&&!currentSettings.__gpsMasterPatched){
    const original=currentSettings;
    const patched=function(){
      const c=original();
      if($m('rpmSourceMode')?.value===MODE){
        c.rpmSourceMode='gps';
        c.gearLearn=false;
        c.gpsMasterMicLearn=true;
      }
      return c;
    };
    patched.__gpsMasterPatched=true;
    currentSettings=patched;
  }

  if(typeof updateSourceModeUI==='function'&&!updateSourceModeUI.__gpsMasterPatched){
    const original=updateSourceModeUI;
    const patched=function(){
      if($m('rpmSourceMode')?.value!==MODE)return original();
      const s=$m('sourceModeStatus');
      if(s)s.textContent='GPS MASTER + MIC LEARN: GPS/nopeus + valittu vaihde määrää RPM:n. BT MIC tallennetaan shadow-dataksi eikä se vaikuta RPM:ään, vaihdeoppimiseen tai vedon hyväksyntään.';
      if(typeof pushConfig==='function')pushConfig();
    };
    patched.__gpsMasterPatched=true;
    updateSourceModeUI=patched;
  }

  if(typeof collectLearningSample==='function'&&!collectLearningSample.__gpsMasterPatched){
    const patched=function(s){
      if(!learningEnabled||!learningSensorsActive()||!s)return;
      ensureLearningSession();
      const mode=$m('rpmSourceMode')?.value||'fusion';
      const gpsRef=Number.isFinite(s.speedRpm)?s.speedRpm:null;
      const gpsRefConf=Number.isFinite(s.speedConf)?s.speedConf:null;
      const mic=Number.isFinite(s.audioRpm)?s.audioRpm:null;
      const raw=Number.isFinite(s.audioRawRpm)?s.audioRawRpm:null;
      const delta=(gpsRef&&mic!=null)?mic-gpsRef:null;
      const errPct=(gpsRef&&mic!=null)?Math.abs(delta)/Math.max(1,gpsRef)*100:null;
      const ratio=(gpsRef&&mic!=null)?mic/gpsRef:null;
      const row={
        t:s.t||Date.now(),
        profileId:getCurrentProfile?.()?.id||null,
        rpmSourceMode:mode,
        selectedGear:+$m('manualGear')?.value||null,
        learningPhase:mode===MODE?'gps_master_mic_learn':'normal',
        rpmControlAuthority:mode===MODE?'gps':(s.source||null),
        micInfluencesDisplayedRpm:mode===MODE?false:null,
        micInfluencesRunAcceptance:mode===MODE?false:null,
        micInfluencesGearLearning:mode===MODE?false:null,
        gpsReferenceRpm:gpsRef,
        gpsReferenceConf:gpsRefConf,
        gpsReferenceKmh:Number.isFinite(s.kmh)?s.kmh:null,
        gpsReferenceGear:+$m('manualGear')?.value||s.gear||null,
        micShadowRpm:mic,
        micShadowRawRpm:raw,
        micShadowDeltaRpm:delta,
        micShadowErrorPct:errPct,
        micShadowRatioToGps:ratio,
        audioRawRpm:raw,
        audioRpm:mic,
        audioConf:Number.isFinite(s.audioConf)?s.audioConf:null,
        observedF0Hz:Number.isFinite(s.audioObservedF0)?s.audioObservedF0:null,
        fingerprintScore:Number.isFinite(s.audioFpScore)?s.audioFpScore:null,
        candidateGap:Number.isFinite(s.audioCandidateGap)?s.audioCandidateGap:null,
        runnerRpm:Number.isFinite(s.audioRunnerRpm)?s.audioRunnerRpm:null,
        audioLevel:Number.isFinite(s.audioLevel)?s.audioLevel:null,
        speedRpm:gpsRef,
        speedConf:gpsRefConf,
        fusedRpm:Number.isFinite(s.fusionRpm)?s.fusionRpm:null,
        fusedConf:Number.isFinite(s.conf)?s.conf:null,
        source:s.source||null,fusionMode:s.fusionMode||null,
        gpsKmh:Number.isFinite(s.kmh)?s.kmh:null,
        gpsAccuracyM:Number.isFinite(s.gpsAcc)?s.gpsAcc:null,
        accelerationMps2:Number.isFinite(s.a)?s.a:null,
        accelerationG:Number.isFinite(s.g)?s.g:null,
        motionMag:Number.isFinite(s.motionMag)?s.motionMag:null,
        motionAgeMs:Number.isFinite(s.motionAgeMs)?s.motionAgeMs:null,
        gear:s.gear||null,gearConf:Number.isFinite(s.gearConf)?s.gearConf:null,
        rpmPerKmh:Number.isFinite(s.ratio)?s.ratio:null,
        slip:!!s.slip,agreement:Number.isFinite(s.agreement)?s.agreement:null,
        estimatedHp:Number.isFinite(s.hp)?s.hp:null,estimatedNm:Number.isFinite(s.nm)?s.nm:null,
        sampleQuality:Number.isFinite(s.quality)?s.quality:null
      };
      learningBuffer.push(row);learningSampleCount++;
      if(learningBuffer.length>=250||Date.now()-learningLastStore>30000)flushLearningChunk();
      if(Date.now()-lastLearningUiAt>500){lastLearningUiAt=Date.now();updateLearningUi()}
    };
    patched.__gpsMasterPatched=true;
    collectLearningSample=patched;
  }
}

function patchLiveStatus(){
  const sel=$m('rpmSourceMode');
  if(!sel||sel.__gpsMasterListener)return;
  sel.__gpsMasterListener=true;
  sel.addEventListener('change',()=>{
    if(sel.value===MODE&&typeof addLearningEvent==='function')addLearningEvent('gps_master_mic_learn_selected',{selectedGear:+($m('manualGear')?.value||0)||null,module:MODULE_VERSION});
    const st=$m('gpsMasterState');
    if(st)st.textContent=sel.value===MODE?'GPS MASTER valittu • käynnistä GPS + MIC testipainikkeella.':'GPS MASTER ei valittuna.';
  });
}

function boot(){
  if(!installModeOption()){setTimeout(boot,180);return;}
  patchCore(); installControls(); patchLiveStatus();
  if($m('rpmSourceMode')?.value===MODE&&typeof updateSourceModeUI==='function')updateSourceModeUI();
  if(typeof addLearningEvent==='function')addLearningEvent('gps_master_module_loaded',{module:MODULE_VERSION});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
