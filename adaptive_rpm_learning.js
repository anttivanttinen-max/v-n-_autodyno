(() => {
'use strict';
const MODULE='adaptive-rpm-learning-v2.1-donoharm';
const MODEL_URL='./rpm-learning-model.json';
const MODEL_KEY='motolab_v32_rpm_learning_model';
const MODEL_META_KEY='motolab_v32_rpm_learning_meta';
const CORRECTIONS=[.5,.75,1,1.25,2];
const INTERMEDIATE_CORRECTIONS=new Set([.75,1.25]);
const INTERMEDIATE_GPS_GAIN=.08;
const INTERMEDIATE_WEAK_1X_GPS=.50;
const $a=id=>document.getElementById(id);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
let model=null,lastChosen=0,lastChosenAt=0,originalPost=null,patched=false;
let stuckHistory=[];

function safeJson(s,fallback=null){try{return JSON.parse(s)}catch{return fallback}}
function median(a){if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2}
function percentile(a,p){if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),i=clamp(Math.round((b.length-1)*p),0,b.length-1);return b[i]}
function activeMode(){return $a('rpmSourceMode')?.value||'fusion'}
function gpsRef(){try{const r=+lastUi?.speedRpm||0,c=+lastUi?.speedConf||0;if(r>0&&c>.2)return {rpm:r,conf:c}}catch{}return null}
function bandFor(rpm,m=model){const bands=m?.bands||[];return bands.find(b=>rpm>=+b.minRpm&&rpm<+b.maxRpm)||bands.reduce((best,b)=>!best||Math.abs(((+b.minRpm)+(+b.maxRpm))/2-rpm)<Math.abs(((+best.minRpm)+(+best.maxRpm))/2-rpm)?b:best,null)}
function storedModel(){return safeJson(localStorage.getItem(MODEL_KEY)||'',null)}
function validModel(m){return !!(m&&m.schema==='motolab_rpm_learning_model_v1'&&Array.isArray(m.bands))}
function setModel(m,source='unknown'){
 if(!validModel(m))return false;
 model=m;localStorage.setItem(MODEL_KEY,JSON.stringify(m));localStorage.setItem(MODEL_META_KEY,JSON.stringify({source,loadedAt:new Date().toISOString(),version:m.version||null}));
 paintStatus(`Malli ${m.version||'–'} käytössä • ${m.bands.length} RPM-aluetta • ${source}`);try{addLearningEvent('rpm_learning_model_loaded',{module:MODULE,version:m.version||null,source,bands:m.bands.length})}catch{};return true
}
async function loadModel(force=false){
 if(!force){const s=storedModel();if(validModel(s))model=s}
 try{const r=await fetch(MODEL_URL+'?t='+Date.now(),{cache:'no-store'});if(r.ok){const m=await r.json();if(validModel(m))setModel(m,'published')}}catch{}
 if(!model){model={schema:'motolab_rpm_learning_model_v1',version:'baseline-v32.4',createdAt:null,baseline:'v32.4',bands:[],acceptance:{minSamplesPerBand:20,maxMedianErrorPct:12,maxP90ErrorPct:24}}}
 return model
}
function normalizeCandidate(c){
 if(Array.isArray(c))return {rpm:+c[0]||0,f0:+c[1]||0,rawRpm:+c[2]||0,q:+c[3]||0,fp:+c[4]||0,baseScore:+c[5]||0,mult:+c[6]||1};
 return {rpm:+c.rpm||0,f0:+c.f0||+c.observedF0||0,rawRpm:+c.rawRpm||0,q:+c.q||0,fp:+c.fp||0,baseScore:+c.score||0,mult:+c.ratio||+c.mult||1};
}
function latestCandidates(){
 const p=globalThis.MOTOLAB_PHONE_RPM;
 if(Array.isArray(p?.topCandidates)&&p.topCandidates.length)return p.topCandidates.map(normalizeCandidate);
 const a=globalThis.MOTOLAB_AUDIO_LAST;
 if(Array.isArray(a?.candidates)&&a.candidates.length)return a.candidates.map(normalizeCandidate);
 return []
}
function expScore(err,scale){return Math.exp(-Math.max(0,err)/Math.max(1,scale))}
function detectStuckBranch(audioRpm,gps,now){
 if(!(audioRpm>0&&gps?.rpm>0))return {active:false};
 stuckHistory.push({t:now,audio:+audioRpm,gps:+gps.rpm});
 while(stuckHistory.length&&now-stuckHistory[0].t>900)stuckHistory.shift();
 if(stuckHistory.length<5)return {active:false};
 const first=stuckHistory[0],last=stuckHistory[stuckHistory.length-1],spanMs=last.t-first.t;
 if(spanMs<500)return {active:false};
 const aud=stuckHistory.map(x=>x.audio),gpsv=stuckHistory.map(x=>x.gps);
 const audMid=median(aud)||audioRpm,gpsMid=median(gpsv)||gps.rpm;
 const audSpread=(Math.max(...aud)-Math.min(...aud))/Math.max(1,audMid);
 const gpsMove=Math.abs(last.gps-first.gps)/Math.max(1,gpsMid);
 const gpsDir=Math.sign(last.gps-first.gps);
 const active=audSpread<=.035&&gpsMove>=.10&&gpsDir!==0;
 return {active,audSpread,gpsMove,gpsDir,spanMs}
}
function guardIntermediateBranch(best,scored,gps,stuck){
 if(!best||!INTERMEDIATE_CORRECTIONS.has(best.corr))return best;
 const oneX=scored.find(x=>x.corr===1);
 if(!oneX)return best;
 if(stuck?.active)return best;
 if(!gps)return {...oneX,guardedFrom:best.corr,guardReason:'no-gps-intermediate-block'};
 const gpsGain=best.gpsScore-oneX.gpsScore;
 const strongGpsEvidence=gpsGain>=INTERMEDIATE_GPS_GAIN&&best.score>=oneX.score;
 const weakOneX=oneX.gpsScore<INTERMEDIATE_WEAK_1X_GPS&&gpsGain>=INTERMEDIATE_GPS_GAIN/2;
 if(strongGpsEvidence||weakOneX)return best;
 return {...oneX,guardedFrom:best.corr,guardReason:'intermediate-do-no-harm'};
}
function chooseCandidate(incoming){
 const candidates=latestCandidates().filter(c=>c.rpm>0),gps=gpsRef(),now=Date.now();
 const stuck=detectStuckBranch(incoming.rpm||incoming.rawRpm||0,gps,now);
 if(!candidates.length){
   const b=bandFor(gps?.rpm||incoming.rpm||lastChosen||0),corr=+b?.correction||1;
   if(corr!==1&&incoming.rpm>0)return {...incoming,rpm:incoming.rpm*corr,rawRpm:incoming.rawRpm||incoming.rpm,adaptiveCorrection:corr,adaptiveModel:true,stuckBranch:stuck.active};
   return {...incoming,stuckBranch:stuck.active}
 }
 const expected=gps?.rpm||lastChosen||incoming.rpm||candidates[0].rpm;
 const band=bandFor(expected),preferred=+band?.correction||1,tolPct=clamp(+band?.tolerancePct||12,5,35);
 let scored=[];
 for(const c0 of candidates){
   for(const corr of CORRECTIONS){
     const rpm=c0.rpm*corr;if(rpm<800||rpm>15000)continue;
     const spectral=clamp((c0.baseScore||c0.q||.2),0,1);
     const gpsScore=gps?expScore(Math.abs(rpm-gps.rpm),Math.max(180,gps.rpm*tolPct/100)):.5;
     const dt=lastChosenAt?clamp((now-lastChosenAt)/1000,.02,1):.1;
     const continuity=lastChosen?expScore(Math.abs(rpm-lastChosen),Math.max(260,lastChosen*(.07+dt*.08))):.65;
     const prior=expScore(Math.abs(corr-preferred),.32);
     const score=stuck.active
       ? spectral*.18+continuity*.10+prior*.12+(gps?gpsScore*.60:0)
       : spectral*.22+continuity*.33+prior*.17+(gps?gpsScore*.28:0);
     scored.push({rpm,corr,c:c0,score,gpsScore,continuity,prior})
   }
 }
 scored.sort((a,b)=>b.score-a.score);if(!scored.length)return incoming;
 const rawBest=scored[0],best=guardIntermediateBranch(rawBest,scored,gps,stuck),runner=scored.find(x=>Math.abs(x.rpm-best.rpm)>Math.max(160,best.rpm*.045));
 const gap=runner?clamp((best.score-runner.score)/Math.max(.01,best.score),0,1):1;
 lastChosen=best.rpm;lastChosenAt=now;
 return {...incoming,rpm:+best.rpm.toFixed(1),rawRpm:incoming.rawRpm||best.c.rawRpm||best.c.rpm,conf:clamp((+incoming.conf||0)*.55+best.score*.30+gap*.15,0,1),candidateGap:Math.max(+incoming.candidateGap||0,gap),runnerRpm:runner?.rpm||incoming.runnerRpm||0,observedF0:best.c.f0||incoming.observedF0||0,adaptiveCorrection:best.corr,adaptiveModel:true,adaptiveModelVersion:model?.version||null,adaptiveGpsRef:gps?.rpm||0,adaptiveGuardedFrom:best.guardedFrom||0,adaptiveGuardReason:best.guardReason||null,stuckBranch:stuck.active,stuckGpsMove:stuck.gpsMove||0,stuckAudioSpread:stuck.audSpread||0};
}
function patchMeasurementInput(){
 try{
  if(patched||typeof measurementWorker==='undefined'||!measurementWorker?.postMessage)return false;
  originalPost=measurementWorker.postMessage.bind(measurementWorker);
  measurementWorker.postMessage=function(msg,...rest){
    if(msg&&msg.type==='rpm'&&msg.source==='ext'&&msg.rpm>0){
      const corrected=chooseCandidate(msg);
      try{globalThis.MOTOLAB_ADAPTIVE_RPM={...corrected,t:Date.now(),module:MODULE}}catch{}
      return originalPost(corrected,...rest)
    }
    return originalPost(msg,...rest)
  };
  patched=true;return true
 }catch{return false}
}
function patchLearningRows(){
 try{
  if(typeof collectLearningSample!=='function'||collectLearningSample.__adaptivePatched)return false;
  const orig=collectLearningSample;
  const wrapped=function(s){
    const a=globalThis.MOTOLAB_AUDIO_LAST,p=globalThis.MOTOLAB_PHONE_RPM,ad=globalThis.MOTOLAB_ADAPTIVE_RPM;
    const before=learningBuffer?.length||0;orig(s);
    try{if((learningBuffer?.length||0)>before){const row=learningBuffer[learningBuffer.length-1];row.audioCandidates=Array.isArray(a?.candidates)?a.candidates:(Array.isArray(p?.topCandidates)?p.topCandidates:null);row.adaptiveRpm=Number.isFinite(ad?.rpm)?ad.rpm:null;row.adaptiveCorrection=Number.isFinite(ad?.adaptiveCorrection)?ad.adaptiveCorrection:null;row.adaptiveModelVersion=model?.version||null;row.adaptiveGuardedFrom=Number.isFinite(ad?.adaptiveGuardedFrom)?ad.adaptiveGuardedFrom:null;row.adaptiveGuardReason=ad?.adaptiveGuardReason||null;row.stuckBranch=!!ad?.stuckBranch;row.stuckGpsMove=Number.isFinite(ad?.stuckGpsMove)?ad.stuckGpsMove:null;row.stuckAudioSpread=Number.isFinite(ad?.stuckAudioSpread)?ad.stuckAudioSpread:null}}catch{}
  };
  wrapped.__adaptivePatched=true;collectLearningSample=wrapped;return true
 }catch{return false}
}
function extractSamples(chunks){const out=[];for(const c of chunks||[]){if(Array.isArray(c?.samples))out.push(...c.samples);else if(Array.isArray(c?.chunk?.samples))out.push(...c.chunk.samples)}return out}
function bestCorrection(row,gps){
 const cand=Array.isArray(row.audioCandidates)?row.audioCandidates.map(normalizeCandidate):[];
 let choices=[];
 if(cand.length){for(const c of cand)for(const corr of CORRECTIONS){const rpm=c.rpm*corr;if(rpm>0)choices.push({corr,rpm,err:Math.abs(rpm-gps)/gps*100})}}
 const observed=+row.micShadowRpm||+row.audioRpm||+row.audioRawRpm||0;
 if(observed>0)for(const corr of CORRECTIONS)choices.push({corr,rpm:observed*corr,err:Math.abs(observed*corr-gps)/gps*100});
 choices.sort((a,b)=>a.err-b.err);return choices[0]||null
}
function trainFromSamples(samples){
 const usable=[];
 for(const r of samples){const gps=+r.gpsReferenceRpm||+r.speedRpm||0;if(gps<1000||gps>14000)continue;if(r.micLearningEligible===false)continue;const b=bestCorrection(r,gps);if(!b||b.err>35)continue;usable.push({gps,corr:b.corr,err:b.err})}
 const bands=[];
 for(let min=1000;min<14000;min+=500){const rows=usable.filter(x=>x.gps>=min&&x.gps<min+500);if(!rows.length)continue;const corrVotes=CORRECTIONS.map(c=>({c,n:rows.filter(x=>x.corr===c).length})).sort((a,b)=>b.n-a.n);const corr=corrVotes[0].c,errs=rows.filter(x=>x.corr===corr).map(x=>x.err);bands.push({minRpm:min,maxRpm:min+500,correction:corr,tolerancePct:+clamp(percentile(errs,.9)||12,6,28).toFixed(1),samples:rows.length,medianErrorPct:+(median(errs)||0).toFixed(2),p90ErrorPct:+(percentile(errs,.9)||0).toFixed(2),agreement:+(corrVotes[0].n/rows.length).toFixed(3)})}
 return {schema:'motolab_rpm_learning_model_v1',version:'local-'+new Date().toISOString().replace(/[:.]/g,'-'),createdAt:new Date().toISOString(),baseline:'v32.4',source:'local_raw_replay',sampleCount:samples.length,usablePairs:usable.length,bands,acceptance:{minSamplesPerBand:20,maxMedianErrorPct:12,maxP90ErrorPct:24}}
}
function validateModel(m){const good=m.bands.filter(b=>b.samples>=5&&b.medianErrorPct<=15&&b.agreement>=.45);return {ok:good.length>=2,goodBands:good.length,totalBands:m.bands.length}}
async function replayLocalRaw(){
 paintStatus('Ajetaan paikallinen RAW-historia uudelleen…');
 try{if(typeof getLearningChunks!=='function')throw Error('RAW-tietovarastoa ei löytynyt');const chunks=await getLearningChunks(false),samples=extractSamples(chunks),m=trainFromSamples(samples),v=validateModel(m);if(!v.ok){paintStatus(`Replay valmis, mutta mallia ei hyväksytty • ${samples.length} näytettä • ${m.usablePairs} paria • ${v.goodBands}/${v.totalBands} kelvollista aluetta`);return m}setModel(m,'local replay');paintStatus(`Replay HYVÄKSYTTY • ${samples.length} näytettä • ${m.usablePairs} GPS–mikki-paria • ${v.goodBands} aluetta`);try{addLearningEvent('rpm_local_replay_accepted',{module:MODULE,version:m.version,samples:samples.length,pairs:m.usablePairs,bands:v.goodBands})}catch{};return m}catch(e){paintStatus('Replay epäonnistui: '+(e.message||e));return null}
}
function integrateGearLearning(){
 try{
   if(typeof currentSettings!=='function'||currentSettings.__adaptiveGearPatched)return false;
   const orig=currentSettings;
   const wrapped=function(){const c=orig();const mode=activeMode();c.adaptiveRpmModelVersion=model?.version||null;c.adaptiveRpmLearning=true;if(mode==='gpslearn'){c.gearLearn=false;c.gearLearnAuthority='gps-master-safety'}else if(c.gearLearn){c.gearLearnAuthority='adaptive-mic+gps'}return c};wrapped.__adaptiveGearPatched=true;currentSettings=wrapped;return true
 }catch{return false}
}
function paintStatus(t){const e=$a('adaptiveRpmStatus');if(e)e.textContent=t}
function installUi(){
 if($a('adaptiveRpmPanel'))return true;const settings=$a('screen-settings');if(!settings)return false;
 const p=document.createElement('div');p.className='panel';p.id='adaptiveRpmPanel';p.innerHTML=`<div class="phead"><div class="ptitle"><span class="r">🧠</span> RPM OPPIMISMALLI</div><span class="tiny">${MODULE}</span></div><div class="statusbox">GPS-master opettaa mikrofonin candidate/harmoniset RPM-alueittain. Malli ohjaa vain mikrofonin shadow/candidate-valintaa; GPS-masterin auktoriteettia ei muuteta. 0.75×/1.25× välihaarat, stuck-branch-valvonta ja do-no-harm-guard ovat käytössä.</div><div class="form"><button id="adaptiveLoadModel" class="action gray full" type="button">LATAA HYVÄKSYTTY MALLI</button><button id="adaptiveReplayRaw" class="action full" type="button">AJA PAIKALLINEN RAW UUDELLEEN NYT</button></div><div id="adaptiveRpmStatus" class="statusbox">Oppimismallia alustetaan…</div>`;
 const anchor=$a('rawAutoSyncPanel')||settings.querySelector('.panel:last-of-type')||settings;anchor.insertAdjacentElement('afterend',p);
 $a('adaptiveLoadModel').onclick=()=>loadModel(true);$a('adaptiveReplayRaw').onclick=replayLocalRaw;return true
}
function boot(){
 const okUi=installUi(),okPost=patchMeasurementInput(),okRows=patchLearningRows(),okGear=integrateGearLearning();
 if(!(okUi&&okPost&&okRows&&okGear)){setTimeout(boot,250);return}
 loadModel(false).then(()=>paintStatus(`Valmis • malli ${model?.version||'baseline'} • ${model?.bands?.length||0} aluetta • stuck guard v2.1 do-no-harm`));
 try{addLearningEvent('adaptive_rpm_learning_loaded',{module:MODULE,corrections:CORRECTIONS,intermediateGpsGain:INTERMEDIATE_GPS_GAIN})}catch{}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();