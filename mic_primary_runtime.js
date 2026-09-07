(() => {
'use strict';
const MODULE='mic-primary-runtime-v1',BUILD='2026-09-07-mic-primary-v1';
let trustedRpm=0,trustedAt=0,lastSpeed=0,workerWrapped=false,learningWrapped=false;
function speed(){try{return +lastUi?.kmh||0}catch{return 0}}
function nearFamily(r){return (r>=1.75&&r<=2.25)||(r>=.44&&r<=.57)}
function guardPhone(e){
 const p=e?.detail;if(!p||!(+p.rpm>0))return;const now=Date.now(),kmh=speed(),candidate=+p.correctedCandidateRpm||+p.rpm||0;
 if(trustedRpm>0&&kmh<8&&lastSpeed<8&&candidate>0&&nearFamily(candidate/trustedRpm)){
  p.guardInputRpm=+p.rpm||0;p.guardCandidateRpm=candidate;p.rpm=trustedRpm;p.conf=Math.min(+p.conf||0,.34);p.held=true;p.harmonicRejected=true;p.harmonicHeld=true;p.micTrust='uncertain';
  try{globalThis.MOTOLAB_PHONE_RPM=p}catch{};lastSpeed=kmh;return;
 }
 p.harmonicRejected=false;p.harmonicHeld=false;
 if(+p.rpm>=1200&&+p.rpm<=13000&&+p.conf>=.55){trustedRpm=+p.rpm;trustedAt=now}
 lastSpeed=kmh;
}
function patchWorker(){
 try{if(workerWrapped||typeof measurementWorker==='undefined'||!measurementWorker?.postMessage)return false;const original=measurementWorker.postMessage.bind(measurementWorker);measurementWorker.postMessage=function(message,transfer){let m=message;if(m?.type==='rpm'&&m?.source==='ext'){const p=globalThis.MOTOLAB_PHONE_RPM||{};m={...m,harmonicRejected:!!p.harmonicRejected,harmonicHeld:!!p.harmonicHeld}}return transfer===undefined?original(m):original(m,transfer)};workerWrapped=true;return true}catch{return false}
}
function patchLearning(){
 try{if(learningWrapped||typeof collectLearningSample!=='function')return false;const original=collectLearningSample;collectLearningSample=function(s){const before=Array.isArray(learningBuffer)?learningBuffer.length:0,out=original(s),p=globalThis.MOTOLAB_PHONE_RPM||{};if(Array.isArray(learningBuffer)&&learningBuffer.length>before)Object.assign(learningBuffer[learningBuffer.length-1],{phoneMicHarmonicRejected:!!p.harmonicRejected,phoneMicHarmonicHeld:!!p.harmonicHeld,phoneMicGuardCandidateRpm:+p.guardCandidateRpm||0,phoneMicGuardInputRpm:+p.guardInputRpm||0,phoneMicGuardTrustedRpm:trustedRpm||0});return out};learningWrapped=true;return true}catch{return false}
}
function boot(){globalThis.addEventListener?.('motolab-phone-rpm',guardPhone);patchWorker();patchLearning();setInterval(()=>{patchWorker();patchLearning()},500);try{addLearningEvent('mic_primary_runtime_loaded',{module:MODULE,build:BUILD})}catch{}}
globalThis.MotoLabMicPrimaryRuntime={version:MODULE,build:BUILD,get trustedRpm(){return trustedRpm},get trustedAt(){return trustedAt}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
