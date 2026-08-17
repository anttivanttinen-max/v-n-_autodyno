(() => {
'use strict';
const MODULE='phone-rpm-smart-v1';
const BUILD='2026-08-16-phone-rpm-1';
const MIN_RPM=1200, MAX_RPM=13000;
const FFT_SIZE=16384;
const STEP_HZ=.5;
const FRAME_MS=33;
const RESTART_AFTER_MS=1800;
const $p=id=>document.getElementById(id);

let enabled=false,starting=false,stream=null,ctx=null,src=null,analyser=null,freq=null,time=null,timer=null,healthTimer=null;
let lastFrameAt=0,lastRpm=0,lastVel=0,lastTs=0,pendingJump=null,restartTimer=null;
let legacyStartAudio=null,legacyStopAudio=null,legacyToggleAudio=null,legacyRenderLive=null,legacyCollectLearningSample=null;

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const expScore=(err,scale)=>Math.exp(-Math.max(0,err)/Math.max(1,scale));
function rmsDb(r){return r>1e-9?20*Math.log10(r):-120}
function gpsReference(){
  try{
    const r=+lastUi?.speedRpm||0,c=+lastUi?.speedConf||0;
    return r>MIN_RPM&&c>.35?{rpm:r,conf:c}:null;
  }catch{return null}
}
function dbAt(hz){
  if(!analyser||!freq||!ctx||hz<=0||hz>=ctx.sampleRate/2)return -120;
  const b=Math.round(hz*analyser.fftSize/ctx.sampleRate);
  let m=-120;
  for(let i=Math.max(1,b-2);i<=Math.min(freq.length-1,b+2);i++)m=Math.max(m,freq[i]);
  return m;
}
function spectralCandidates(){
  analyser.getFloatFrequencyData(freq);
  const out=[];
  for(let f=20;f<=250;f+=STEP_HZ){
    let score=0,n=0,hs=[];
    const w=[0,.72,1,.96,.84,.66,.50];
    for(let h=1;h<=6;h++){
      const d=dbAt(f*h),q=clamp((d+92)/72,0,1);
      score+=q*w[h];
      if(d>-68)n++;
      hs.push({h,hz:+(f*h).toFixed(2),db:+d.toFixed(2)});
    }
    score+=Math.min(.95,n*.155);
    out.push({f,rpm:f*60,score,harmonics:n,hs});
  }
  out.sort((a,b)=>b.score-a.score);
  return out.slice(0,14);
}
function signalLevel(){
  analyser.getFloatTimeDomainData(time);
  let s=0;
  for(const x of time)s+=x*x;
  return Math.sqrt(s/time.length);
}
function chooseSmart(base,now){
  const dt=lastTs?clamp((now-lastTs)/1000,.015,.20):FRAME_MS/1000;
  const predicted=lastRpm?clamp(lastRpm+lastVel*dt,MIN_RPM,MAX_RPM):0;
  const gps=gpsReference();
  const maxBase=Math.max(.001,...base.map(x=>x.score));
  let branches=[];
  for(let rank=0;rank<base.length;rank++){
    const b=base[rank];
    for(const ratio of [.5,1,2]){
      const rpm=b.rpm*ratio;
      if(rpm<MIN_RPM||rpm>MAX_RPM)continue;
      const spectral=clamp(b.score/maxBase,0,1);
      const rankScore=1-rank/Math.max(14,base.length+2);
      const tol=lastRpm?Math.max(260,lastRpm*.065,Math.abs(lastVel)*dt*1.35+220):900;
      const continuity=lastRpm?expScore(Math.abs(rpm-predicted),tol):.62;
      const direct=lastRpm?expScore(Math.abs(rpm-lastRpm),Math.max(320,lastRpm*.085)):.62;
      const gpsScore=gps?expScore(Math.abs(rpm-gps.rpm),Math.max(260,gps.rpm*.075)):.5;
      let ratioPrior=.50;
      if(ratio===1)ratioPrior=.56;
      if(lastRpm&&lastRpm<3600&&ratio===.5&&b.rpm>lastRpm*1.65)ratioPrior=.62;
      if(lastRpm&&lastRpm>3800&&ratio===1)ratioPrior=.61;
      const score=spectral*.34+rankScore*.08+continuity*.28+direct*.12+ratioPrior*.06+(gps?gpsScore*.12:0);
      branches.push({rpm,ratio,rawRpm:b.rpm,f0:b.f,score,spectral,harmonics:b.harmonics,hs:b.hs,gpsScore});
    }
  }
  branches.sort((a,b)=>b.score-a.score);
  if(!branches.length)return null;
  let best=branches[0];
  const runner=branches.find(x=>Math.abs(x.rpm-best.rpm)>Math.max(180,best.rpm*.05))||branches[1]||null;
  const gap=runner?clamp((best.score-runner.score)/Math.max(.01,best.score),0,1):1;

  if(lastRpm){
    const jump=Math.abs(best.rpm-predicted);
    const jumpLimit=Math.max(750,lastRpm*.18,Math.abs(lastVel)*dt*1.7+420);
    if(jump>jumpLimit){
      if(pendingJump&&Math.abs(pendingJump.rpm-best.rpm)<Math.max(350,best.rpm*.08))pendingJump.count++;
      else pendingJump={rpm:best.rpm,count:1,t:now};
      if(pendingJump.count<2){
        const alt=branches.find(x=>Math.abs(x.rpm-predicted)<Math.max(650,lastRpm*.13));
        if(alt)best=alt;
        else best={...best,rpm:clamp(predicted,MIN_RPM,MAX_RPM),ratio:0,held:true};
      }else pendingJump=null;
    }else pendingJump=null;
  }

  let target=best.rpm;
  if(lastRpm){
    const maxDelta=Math.max(340,22000*dt);
    target=clamp(target,lastRpm-maxDelta,lastRpm+maxDelta);
  }
  const err=lastRpm?Math.abs(target-predicted):0;
  const alpha=!lastRpm?1:err<220?.62:err<600?.48:.36;
  const smart=lastRpm?lastRpm+(target-lastRpm)*alpha:target;
  const instVel=lastRpm?(smart-lastRpm)/dt:0;
  lastVel=lastRpm?lastVel*.68+instVel*.32:0;
  lastRpm=smart;lastTs=now;

  const harmonicStrength=clamp((best.harmonics-1)/5,0,1);
  const continuityConf=predicted?expScore(Math.abs(smart-predicted),Math.max(300,smart*.08)):.7;
  const conf=clamp(best.spectral*.42+harmonicStrength*.23+continuityConf*.22+gap*.13,0,1);
  return {rpm:smart,rawRpm:best.rawRpm,correctedCandidateRpm:best.rpm,observedF0:best.f,conf,candidateGap:gap,runnerRpm:runner?.rpm||0,ratio:best.ratio,predictedRpm:predicted,velocity:lastVel,harmonics:best.harmonics,harmonicData:best.hs,top:branches.slice(0,8).map(x=>({rpm:+x.rpm.toFixed(1),ratio:x.ratio,rawRpm:+x.rawRpm.toFixed(1),f0:+x.f0.toFixed(2),score:+x.score.toFixed(4),harmonics:x.harmonics})),gpsAssistRpm:gps?.rpm||0,gpsAssistConf:gps?.conf||0,held:!!best.held};
}
function resetTracker(){lastRpm=0;lastVel=0;lastTs=0;pendingJump=null}
function postZero(){
  try{measurementWorker.postMessage({type:'rpm',source:'ext',rpm:0,conf:0,rawRpm:0,fpScore:0,observedF0:0,level:0,candidateGap:0,runnerRpm:0,t:Date.now()})}catch{}
}
function tick(){
  if(!enabled||!analyser)return;
  const now=Date.now(),level=signalLevel();
  let result=null;
  if(level>.0007){
    const base=spectralCandidates();
    if(base.length)result=chooseSmart(base,now);
  }
  lastFrameAt=now;
  if(result){
    const payload={module:MODULE,build:BUILD,t:now,rpm:+result.rpm.toFixed(1),rawRpm:+result.rawRpm.toFixed(1),correctedCandidateRpm:+result.correctedCandidateRpm.toFixed(1),predictedRpm:+result.predictedRpm.toFixed(1),velocity:+result.velocity.toFixed(1),chosenRatio:result.ratio,conf:result.conf,candidateGap:result.candidateGap,runnerRpm:+result.runnerRpm.toFixed(1),observedF0:result.observedF0,level,rmsDb:rmsDb(level),harmonics:result.harmonics,harmonicData:result.harmonicData,topCandidates:result.top,gpsAssistRpm:result.gpsAssistRpm,gpsAssistConf:result.gpsAssistConf,held:result.held,trackLabel:stream?.getAudioTracks?.()[0]?.label||''};
    globalThis.MOTOLAB_PHONE_RPM=payload;
    globalThis.dispatchEvent(new CustomEvent('motolab-phone-rpm',{detail:payload}));
    try{measurementWorker.postMessage({type:'rpm',source:'ext',rpm:payload.rpm,rawRpm:payload.rawRpm,conf:payload.conf,fpScore:clamp((result.harmonics/6)*.7+result.conf*.3,0,1),observedF0:payload.observedF0,level,candidateGap:payload.candidateGap,runnerRpm:payload.runnerRpm,t:now})}catch{}
  }else{
    globalThis.MOTOLAB_PHONE_RPM={module:MODULE,build:BUILD,t:now,rpm:0,rawRpm:0,conf:0,level,rmsDb:rmsDb(level),trackLabel:stream?.getAudioTracks?.()[0]?.label||''};
    postZero();
  }
  paint();
}
function paint(){
  const p=globalThis.MOTOLAB_PHONE_RPM||{};
  const dot=$p('extDot'),btn=$p('extMicBtn'),state=$p('extState');
  dot?.classList.toggle('on',enabled);
  btn?.classList.toggle('on',enabled);
  if(state)state.textContent=enabled?(p.rpm?Math.round(p.rpm)+' RPM':'AKTIIVINEN'):'POIS';
  if($p('audioRpmState'))$p('audioRpmState').textContent=p.rpm?Math.round(p.rpm)+' • '+Math.round((p.conf||0)*100)+'%':'–';
  if($p('btLevelState'))$p('btLevelState').textContent=Number.isFinite(p.rmsDb)?p.rmsDb.toFixed(1)+' dB':'–';
  if($p('btFpState'))$p('btFpState').textContent=p.observedF0?`${p.observedF0.toFixed(1)} Hz • H${p.harmonics||0} • ${p.chosenRatio||0}× • GAP ${Math.round((p.candidateGap||0)*100)}%`:'–';
  if($p('btRouteStatus'))$p('btRouteStatus').textContent=enabled?`PUHELINMIC AKTIIVINEN • ${p.trackLabel||'oletusmikrofoni'} • smart RPM ${p.rpm?Math.round(p.rpm):'–'}`:'Puhelimen mikrofoni ei ole käynnissä.';
}
async function startPhone(){
  if(enabled)return true;
  if(starting)return false;
  starting=true;
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Media API puuttuu');
    await requestWake?.();
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1}});
    const tr=stream.getAudioTracks()[0];
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    await ctx.resume();
    src=ctx.createMediaStreamSource(stream);
    analyser=ctx.createAnalyser();
    analyser.fftSize=FFT_SIZE;
    analyser.smoothingTimeConstant=.28;
    src.connect(analyser);
    freq=new Float32Array(analyser.frequencyBinCount);
    time=new Float32Array(analyser.fftSize);
    enabled=true;extMicOn=true;resetTracker();lastFrameAt=Date.now();
    if(tr){tr.onended=()=>scheduleRestart('track ended');tr.onmute=()=>setTimeout(()=>{if(enabled&&tr.muted)scheduleRestart('track muted')},900)}
    clearInterval(timer);timer=setInterval(tick,FRAME_MS);
    clearInterval(healthTimer);healthTimer=setInterval(()=>{if(enabled&&document.visibilityState==='visible'&&Date.now()-lastFrameAt>RESTART_AFTER_MS)scheduleRestart('watchdog')},700);
    try{audioSessions.ext={stream,ac:ctx,track:tr,phoneSmart:true}}catch{}
    try{addLearningEvent('phone_rpm_on',{module:MODULE,build:BUILD,device:tr?.label||'default',sampleRate:ctx.sampleRate})}catch{}
    if($p('measureStatus'))$p('measureStatus').textContent=`PUHELINMIC RPM: ${tr?.label||'oletusmikrofoni'} • ${ctx.sampleRate} Hz • SMART TRACKER`;
    paint();return true;
  }catch(e){
    enabled=false;extMicOn=false;
    if($p('measureStatus'))$p('measureStatus').textContent='PUHELINMIC: '+(e?.message||e);
    try{log('Phone RPM: '+(e?.message||e))}catch{}
    return false;
  }finally{starting=false}
}
async function stopPhone(keepWanted=false){
  enabled=false;extMicOn=false;
  clearInterval(timer);timer=null;clearInterval(healthTimer);healthTimer=null;clearTimeout(restartTimer);restartTimer=null;
  try{stream?.getTracks().forEach(t=>{t.onended=null;t.onmute=null;t.stop()})}catch{}
  try{src?.disconnect()}catch{};try{await ctx?.close()}catch{}
  stream=null;src=null;ctx=null;analyser=null;freq=null;time=null;resetTracker();postZero();
  try{audioSessions.ext=null}catch{}
  if(!keepWanted)try{addLearningEvent('phone_rpm_off',{module:MODULE})}catch{}
  paint();return true;
}
function scheduleRestart(reason){
  if(!enabled||restartTimer)return;
  restartTimer=setTimeout(async()=>{
    restartTimer=null;
    if(document.visibilityState!=='visible')return;
    try{addLearningEvent('phone_rpm_restart',{reason,module:MODULE})}catch{}
    await stopPhone(true);await startPhone();
  },250);
}
async function togglePhone(){enabled?await stopPhone():await startPhone()}

function patchUi(){
  const chip=$p('extChip');if(chip){const dot=$p('extDot');chip.innerHTML='';if(dot)chip.appendChild(dot);chip.append(' PHONE MIC')}
  const btn=$p('extMicBtn');if(btn){const ico=btn.querySelector('.ico'),lbl=btn.querySelector('.lbl');if(ico)ico.textContent='🎤';if(lbl)lbl.textContent='PUHELINMIC';btn.onclick=togglePhone}
  const rename=(id,text)=>{const el=$p(id),sp=el?.parentElement?.querySelector('span');if(sp)sp.textContent=text};
  rename('audioRpmState','Puhelin RPM');rename('btLevelState','Puhelin taso');rename('btFpState','Puhelin f0 / harmoniset');
  const sel=$p('rpmSourceMode');if(sel){for(const o of sel.options){if(o.value==='bt')o.textContent='PHONE MIC ONLY';if(o.value==='fusion')o.textContent='PHONE MIC + GPS FUSION'}}
  const panel=$p('btRouteStatus')?.closest('.panel');if(panel){const t=panel.querySelector('.ptitle');if(t)t.innerHTML='<span class="r">🎤</span> PUHELIN RPM – SMART SENSOR';const boxes=panel.querySelectorAll('.statusbox');if(boxes[0])boxes[0].textContent='Puhelimen oma mikrofoni käyttää Smart Trackeria: harmoniset 0,5× / 1× / 2×, trendiennuste, hyppyjen esto ja GPS vain pehmeänä vertailuna. GPS MASTER -tilassa mikki ei ohjaa näytettyä RPM:ää, vetoa eikä vaihdeoppimista.';const dev=$p('audioDevice');if(dev)dev.closest('label').style.display='none';const refresh=$p('audioRefreshBtn');if(refresh)refresh.style.display='none';const hint=$p('audioDeviceHint');if(hint)hint.style.display='none'}
  const gpsBox=$p('gpsMasterBox');if(gpsBox)gpsBox.innerHTML=gpsBox.innerHTML.replace(/BT MIC/g,'PUHELINMIC').replace(/BT-kuulokemikrofoni/g,'puhelimen mikrofoni');
  document.title='VÄNÄ MOTOLAB v32.5';if($p('appVersionBadge'))$p('appVersionBadge').textContent='v32.5';
}
function patchCore(){
  try{legacyStartAudio=startAudio;startAudio=startPhone}catch{}
  try{legacyStopAudio=stopAudio;stopAudio=stopPhone}catch{}
  try{legacyToggleAudio=toggleAudio;toggleAudio=togglePhone}catch{}
  try{
    legacyRenderLive=renderLive;
    renderLive=function(d,m){if(d?.source)d.source=String(d.source).replace(/BT MIC/g,'PHONE MIC');return legacyRenderLive(d,m)};
  }catch{}
  try{
    legacyCollectLearningSample=collectLearningSample;
    collectLearningSample=function(s){
      const before=Array.isArray(learningBuffer)?learningBuffer.length:0;
      const out=legacyCollectLearningSample(s);
      const p=globalThis.MOTOLAB_PHONE_RPM;
      if(p&&Array.isArray(learningBuffer)&&learningBuffer.length>before){
        Object.assign(learningBuffer[learningBuffer.length-1],{phoneMicModule:MODULE,phoneMicRpm:p.rpm||0,phoneMicRawRpm:p.rawRpm||0,phoneMicCorrectedCandidateRpm:p.correctedCandidateRpm||0,phoneMicPredictedRpm:p.predictedRpm||0,phoneMicVelocity:p.velocity||0,phoneMicChosenRatio:p.chosenRatio||0,phoneMicConfidence:p.conf||0,phoneMicCandidateGap:p.candidateGap||0,phoneMicRunnerRpm:p.runnerRpm||0,phoneMicObservedF0Hz:p.observedF0||0,phoneMicRmsDb:p.rmsDb??null,phoneMicHarmonics:p.harmonics||0,phoneMicTopCandidates:p.topCandidates||[],phoneMicHarmonicData:p.harmonicData||[],phoneMicGpsAssistRpm:p.gpsAssistRpm||0,phoneMicGpsAssistConf:p.gpsAssistConf||0,phoneMicHeld:!!p.held,phoneMicTrackLabel:p.trackLabel||''});
      }
      return out;
    };
  }catch{}
}
function boot(){
  patchCore();patchUi();paint();
  document.addEventListener('visibilitychange',async()=>{if(document.visibilityState==='visible'&&enabled){try{await ctx?.resume()}catch{}if(!stream?.active)scheduleRestart('visibility resume')}});
  setInterval(paint,500);
  try{addLearningEvent('phone_rpm_module_loaded',{module:MODULE,build:BUILD,controlAuthority:$p('rpmSourceMode')?.value||null})}catch{}
  try{log('Phone RPM Smart loaded • '+MODULE)}catch{}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
