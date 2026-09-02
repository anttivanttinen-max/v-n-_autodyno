(() => {
'use strict';
const VERSION='post-run-curve-check-v1-corner-gear-rpm';
const n=v=>Number.isFinite(+v)?+v:null,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
function rpmConfidence(p){return Math.max(0,n(p?.phoneMicConfidence)||0,n(p?.audioConf)||0,n(p?.fusionConfidence)||0,n(p?.rpmConfidence)||0)}
function pointAssessment(p){let score=1;const reasons=[];
 const gpsAge=n(p?.gpsAgeMs);if(gpsAge!=null){if(gpsAge>2500){score=0;reasons.push('gps_stale')}else if(gpsAge>1200){score*=.65;reasons.push('gps_age')}}
 const rc=rpmConfidence(p);if(rc>0){if(rc<.30){score=0;reasons.push('rpm_conf')}else if(rc<.50){score*=.65;reasons.push('rpm_weak')}}
 if(p?.slip){score*=.25;reasons.push('slip')}
 if(p?.imuCornerActive){const a=n(p?.imuCornerAgreement);if(a!=null){if(a<.25){score*=.18;reasons.push('corner_mismatch')}else if(a<.50){score*=.55;reasons.push('corner_uncertain')}else if(a>=.70){score=Math.min(1,score*1.05)}}}
 const iw=n(p?.imuFusionWeight);if(iw!=null&&iw>.45&&String(p?.imuMountState||'').toUpperCase()!=='VERIFIED'){score*=.7;reasons.push('imu_unverified_weight')}
 return {score:clamp(score),reasons}}
function analyze(data){const src=Array.isArray(data)?data:[];if(src.length<8)return {data:src,meta:{version:VERSION,applied:false,reason:'too_short'}};
 const assess=src.map(pointAssessment),shift=new Set();for(let i=1;i<src.length;i++){const a=n(src[i-1]?.gear),b=n(src[i]?.gear);if(a&&b&&a!==b&&Math.abs(a-b)<=2){for(let j=Math.max(0,i-2);j<=Math.min(src.length-1,i+2);j++)shift.add(j)}}
 for(const i of shift){assess[i].score*=.25;assess[i].reasons.push('gear_transition')}
 let kept=[];for(let i=0;i<src.length;i++){if(assess[i].score>=.42)kept.push({...src[i],postRunPointQuality:Math.round(assess[i].score*100)})}
 const minKeep=Math.max(8,Math.ceil(src.length*.45));let fallback=false;if(kept.length<minKeep){kept=src.map((p,i)=>({...p,postRunPointQuality:Math.round(assess[i].score*100)}));fallback=true}
 const reasonCounts={};for(const a of assess)for(const r of a.reasons)reasonCounts[r]=(reasonCounts[r]||0)+1;
 const mean=assess.reduce((s,a)=>s+a.score,0)/Math.max(1,assess.length),acceptance=kept.length/src.length;
 return {data:kept,meta:{version:VERSION,applied:true,fallback,sourcePoints:src.length,acceptedPoints:kept.length,rejectedPoints:fallback?0:src.length-kept.length,acceptanceRatio:+acceptance.toFixed(3),meanPointScore:+mean.toFixed(3),reasons:reasonCounts,checks:['gps_freshness','rpm_confidence','slip','gear_transition','imu_corner_agreement','imu_verified_weight']}}}
function applyToRun(r){if(!r||!Array.isArray(r.data))return r;const out=analyze(r.data);r.data=out.data;r.postRunCurveCheck=out.meta;if(out.meta.applied&&r.data.length){r.maxHp=Math.max(0,...r.data.map(x=>+x.hp||0));r.maxNm=Math.max(0,...r.data.map(x=>+x.nm||0));r.maxRpm=Math.max(0,...r.data.map(x=>+x.rpm||0));const base=n(r.quality)??100,post=Math.round(100*clamp((out.meta.meanPointScore||0)*.6+(out.meta.acceptanceRatio||0)*.4));r.quality=Math.round(base*.65+post*.35);if(out.meta.fallback)r.status='warn';else r.status=r.quality>=78?'good':r.quality>=55?'warn':'bad'}return r}
if(typeof globalThis.handleRunComplete==='function'){const original=globalThis.handleRunComplete;globalThis.handleRunComplete=async function(r,reason){applyToRun(r);return original.apply(this,arguments)}}
globalThis.MotoLabPostRunCurveCheck={version:VERSION,analyze,applyToRun};
try{globalThis.addLearningEvent?.('post_run_curve_check_loaded',{module:VERSION,mode:'post_run_only'})}catch{}
})();
