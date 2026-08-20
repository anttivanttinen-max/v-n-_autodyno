(() => {
'use strict';
const MODULE='rpm-harmonic-gps-guard-v1';
const MIN_RPM=1200,MAX_RPM=13000;
let patched=false,originalPost=null;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mode=()=>document.getElementById('rpmSourceMode')?.value||'';
function gpsRef(){
 try{
  const rpm=+lastUi?.speedRpm||0,conf=+lastUi?.speedConf||0;
  if(rpm>=MIN_RPM&&rpm<=MAX_RPM&&conf>=.60)return {rpm,conf};
 }catch{}
 return null;
}
function phoneState(){return globalThis.MOTOLAB_PHONE_RPM||null}
function micLooksUsable(){
 const p=phoneState();
 if(!p)return false;
 const conf=+p.conf||0,level=+p.level||0,h=+p.harmonics||0;
 return conf>=.25&&level>.0007&&h>=2;
}
function candidates(msg,gps){
 const out=[];
 const seen=new Set();
 const add=(rpm,corr,source,score=0)=>{
  rpm=+rpm||0;if(rpm<MIN_RPM||rpm>MAX_RPM)return;
  const key=Math.round(rpm/5);if(seen.has(key))return;seen.add(key);
  const errPct=Math.abs(rpm-gps.rpm)/gps.rpm*100;
  out.push({rpm,corr,source,score:+score||0,errPct});
 };
 const base=[];
 if(+msg?.rpm>0)base.push({rpm:+msg.rpm,source:'incoming',score:+msg.conf||0});
 if(+msg?.rawRpm>0)base.push({rpm:+msg.rawRpm,source:'raw',score:+msg.conf||0});
 const p=phoneState();
 if(+p?.rpm>0)base.push({rpm:+p.rpm,source:'phone',score:+p.conf||0});
 for(const c of Array.isArray(p?.topCandidates)?p.topCandidates:[]){
  const r=+c?.rpm||0;if(r>0)base.push({rpm:r,source:'top',score:+c?.score||0});
 }
 for(const b of base)for(const corr of [.5,1,2])add(b.rpm*corr,corr,b.source,b.score);
 out.sort((a,b)=>a.errPct-b.errPct||b.score-a.score);
 return out;
}
function chooseCorrection(msg){
 if(mode()!=='gpslearn'||!micLooksUsable())return null;
 const gps=gpsRef();if(!gps)return null;
 const all=candidates(msg,gps);if(!all.length)return null;
 const best=all[0];
 const current=+msg?.rpm||0;
 const currentErr=current>0?Math.abs(current-gps.rpm)/gps.rpm*100:999;
 // GPS-master is authoritative. Correct only when a harmonic branch is clearly plausible;
 // do not manufacture an RPM from weak/non-engine-like microphone data.
 if(best.errPct>10)return null;
 if(currentErr<=8&&best.errPct>=currentErr-1)return null;
 if(currentErr-best.errPct<4&&currentErr<18)return null;
 return {best,gps,currentErr};
}
function correctMessage(msg){
 const hit=chooseCorrection(msg);if(!hit)return msg;
 const {best,gps,currentErr}=hit;
 const corrected={...msg,rpm:+best.rpm.toFixed(1),gpsHarmonicGuard:true,gpsHarmonicCorrection:best.corr,gpsHarmonicSource:best.source,gpsHarmonicGpsRpm:+gps.rpm.toFixed(1),gpsHarmonicErrorBeforePct:+currentErr.toFixed(2),gpsHarmonicErrorAfterPct:+best.errPct.toFixed(2)};
 // Preserve original confidence; GPS is a selector here, not proof that the audio signal is valid.
 corrected.conf=clamp(+msg.conf||0,0,1);
 return corrected;
}
function patchWorker(){
 try{
  if(patched||typeof measurementWorker==='undefined'||!measurementWorker?.postMessage)return false;
  originalPost=measurementWorker.postMessage.bind(measurementWorker);
  measurementWorker.postMessage=function(msg,...rest){
   if(msg&&msg.type==='rpm'&&msg.source==='ext'&&msg.rpm>0)return originalPost(correctMessage(msg),...rest);
   return originalPost(msg,...rest);
  };
  patched=true;return true;
 }catch{return false}
}
function annotatePhoneEvent(e){
 const p=e?.detail;if(!p||mode()!=='gpslearn'||!micLooksUsable())return;
 const gps=gpsRef();if(!gps)return;
 const msg={rpm:+p.rpm||0,rawRpm:+p.rawRpm||0,conf:+p.conf||0};
 const hit=chooseCorrection(msg);if(!hit)return;
 p.gpsHarmonicGuardCandidateRpm=+hit.best.rpm.toFixed(1);
 p.gpsHarmonicGuardCorrection=hit.best.corr;
 p.gpsHarmonicGuardGpsRpm=+gps.rpm.toFixed(1);
 globalThis.MOTOLAB_GPS_HARMONIC_GUARD={module:MODULE,t:Date.now(),rpm:p.gpsHarmonicGuardCandidateRpm,correction:hit.best.corr,gpsRpm:p.gpsHarmonicGuardGpsRpm,errorBeforePct:+hit.currentErr.toFixed(2),errorAfterPct:+hit.best.errPct.toFixed(2)};
}
function boot(){
 globalThis.addEventListener('motolab-phone-rpm',annotatePhoneEvent,{passive:true});
 let tries=0;const t=setInterval(()=>{if(patchWorker()||++tries>120)clearInterval(t)},100);
 try{addLearningEvent('rpm_harmonic_gps_guard_loaded',{module:MODULE})}catch{}
}
globalThis.MotoLabRpmHarmonicGpsGuard={module:MODULE,patchWorker,chooseCorrection};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
