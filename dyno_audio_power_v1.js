(() => {
'use strict';
const MODULE_VERSION='motorlab-dyno-audio-power-v1';

const finite=n=>Number.isFinite(+n);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function median(a){
  const s=(a||[]).filter(finite).map(Number).sort((x,y)=>x-y);
  if(!s.length)return 0;
  const m=s.length>>1;
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
}
function medianFilter(a,r=2){
  return a.map((_,i)=>median(a.slice(Math.max(0,i-r),Math.min(a.length,i+r+1))));
}
function localSlope(t,y,i,halfWindowMs=450){
  const t0=t[i], xs=[],ys=[];
  for(let k=0;k<t.length;k++){
    if(Math.abs(t[k]-t0)<=halfWindowMs&&finite(y[k])){xs.push((t[k]-t0)/1000);ys.push(+y[k]);}
  }
  if(xs.length<6)return NaN;
  const xm=xs.reduce((a,b)=>a+b,0)/xs.length,ym=ys.reduce((a,b)=>a+b,0)/ys.length;
  let num=0,den=0;
  for(let k=0;k<xs.length;k++){const dx=xs[k]-xm;num+=dx*(ys[k]-ym);den+=dx*dx;}
  return den>1e-9?num/den:NaN;
}
function deriveGearRatio(run,data){
  if(finite(run?.gearRatioMedian)&&+run.gearRatioMedian>10)return +run.gearRatioMedian;
  const direct=data.map(p=>+p.ratio||0).filter(x=>x>10&&x<1000);
  if(direct.length>=5)return median(direct);
  const speed=data.map(p=>{
    const kmh=+p.kmh||0,sr=+p.speedRpm||0;
    return kmh>8&&sr>500?sr/kmh:0;
  }).filter(x=>x>10&&x<1000);
  if(speed.length>=5)return median(speed);
  const trusted=data.map(p=>{
    const kmh=+p.kmh||0,ar=+p.audioRpm||0,ac=+p.audioConf||0;
    return kmh>8&&ar>800&&ac>=.62&&!p.harmonicRejected?ar/kmh:0;
  }).filter(x=>x>10&&x<1000);
  return trusted.length>=5?median(trusted):0;
}
function chooseRpm(p){
  const ar=+p.audioRpm||0,ac=+p.audioConf||0;
  if(ar>=900&&ac>=.50&&!p.harmonicRejected&&!p.harmonicHeld)return {rpm:ar,source:'audio',conf:ac};
  const fr=+p.rpm||+p.fusionRpm||0,fc=+p.conf||0;
  if(fr>=900&&fc>=.34)return {rpm:fr,source:'fusion',conf:fc};
  return {rpm:NaN,source:'none',conf:0};
}
function recalculateRun(run,settings={}){
  const src=(run?.data||[]).filter(p=>finite(p?.t)).slice().sort((a,b)=>+a.t-+b.t);
  if(src.length<12)return {run,applied:false,reason:'too-few-samples'};
  const ratio=deriveGearRatio(run,src);
  if(!(ratio>10&&ratio<1000))return {run,applied:false,reason:'no-stable-gear-ratio'};

  const chosen=src.map(chooseRpm),rawRpm=chosen.map(x=>x.rpm);
  const valid=rawRpm.filter(finite);
  if(valid.length<Math.max(10,src.length*.45))return {run,applied:false,reason:'rpm-quality'};

  const filled=rawRpm.slice();
  let last=NaN;
  for(let i=0;i<filled.length;i++){if(finite(filled[i]))last=filled[i];else if(finite(last))filled[i]=last;}
  last=NaN;
  for(let i=filled.length-1;i>=0;i--){if(finite(filled[i]))last=filled[i];else if(finite(last))filled[i]=last;}
  if(filled.some(x=>!finite(x)))return {run,applied:false,reason:'rpm-gaps'};

  const rpm=medianFilter(filled,2);
  const t=src.map(p=>+p.t);
  const slopes=rpm.map((_,i)=>localSlope(t,rpm,i,450));
  const mass=Math.max(20,+settings.mass||190);
  const eqMass=Math.max(0,+settings.inertiaEqMassKg||+src[0]?.inertiaEqMassKg||0);
  const cda=Math.max(0,+settings.cda||.55),crr=Math.max(0,+settings.crr||.015),rho=Math.max(.5,+settings.rho||1.225);
  const rotJ=Math.max(0,+settings.rotatingInertiaKgM2||+settings.dynoRotatingInertiaKgM2||0);
  const g0=9.80665;
  let accepted=0;

  const out=src.map((p,i)=>{
    const r=rpm[i],dr=slopes[i],audio=chosen[i].source==='audio';
    if(!finite(dr)||r<900)return {...p,dynoAudioPowerValid:false};
    const kmhFromRpm=r/ratio,v=kmhFromRpm/3.6,a=dr/ratio/3.6;
    const gpsKmh=+p.kmh||0;
    const speedAgreement=gpsKmh>8?Math.abs(kmhFromRpm-gpsKmh)/Math.max(kmhFromRpm,gpsKmh):0;
    const slip=!!p.slip||speedAgreement>.24;
    const accelerating=dr>40&&a>0;
    if(slip||!accelerating)return {...p,rpm:r,dynoRpm:r,dynoRpmSlope:dr,dynoKmhFromRpm:kmhFromRpm,dynoSpeedAgreement:speedAgreement,dynoAudioPowerValid:false};
    const force=(mass+eqMass)*a+.5*rho*cda*v*v+crr*mass*g0;
    const omega=r*2*Math.PI/60,alpha=dr*2*Math.PI/60;
    const watts=Math.max(0,force*v+rotJ*omega*alpha);
    const hp=watts/735.49875,nm=omega>1?watts/omega:0;
    accepted++;
    const q0=+p.quality||0,conf=chosen[i].conf;
    const q=Math.round(clamp(q0*.55+conf*100*.35+(1-clamp(speedAgreement/.24,0,1))*10,0,100));
    return {...p,rpm:r,hp,nm,quality:q,dynoRpm:r,dynoRpmSlope:dr,dynoKmhFromRpm:kmhFromRpm,dynoSpeedAgreement:speedAgreement,
      dynoAccelSource:audio?'AUDIO_RPM':'FUSION_RPM',dynoGearRatio:ratio,dynoAudioPowerValid:true,dynoAudioPowerVersion:MODULE_VERSION,
      dynoRotatingInertiaKgM2:rotJ,dynoEquivalentMassKg:eqMass};
  });

  if(accepted<8)return {run,applied:false,reason:'not-enough-acceleration-points'};
  const good=out.filter(p=>p.dynoAudioPowerValid);
  const result={...run,data:out,maxHp:Math.max(0,...good.map(p=>+p.hp||0)),maxNm:Math.max(0,...good.map(p=>+p.nm||0)),maxRpm:Math.max(0,...good.map(p=>+p.rpm||0))};
  result.dynoAudioPower={version:MODULE_VERSION,applied:true,gearRatio:ratio,acceptedSamples:accepted,totalSamples:out.length,
    source:'audio-rpm-derivative',absoluteCalibration:rotJ>0||eqMass>0?'profile-calibrated':'road-model-estimate',
    rotatingInertiaKgM2:rotJ,equivalentMassKg:eqMass};
  return {run:result,applied:true,reason:'ok'};
}
function runtimeSettings(){
  try{
    if(typeof currentSettings==='function')return currentSettings()||{};
  }catch{}
  const val=(id,d)=>{try{const n=+document.getElementById(id)?.value;return finite(n)?n:d}catch{return d}};
  return {mass:val('mass',190),cda:val('cda',.55),crr:val('crr',.015),rho:val('rho',1.225)};
}

if(typeof handleRunComplete==='function'){
  const previousHandleRunComplete=handleRunComplete;
  handleRunComplete=async function(r,reason){
    try{
      const z=recalculateRun(r,runtimeSettings());
      if(z.applied)r=z.run;
      else r.dynoAudioPower={version:MODULE_VERSION,applied:false,reason:z.reason};
    }catch(e){
      try{r.dynoAudioPower={version:MODULE_VERSION,applied:false,reason:'exception',message:String(e?.message||e)}}catch{}
    }
    return previousHandleRunComplete(r,reason);
  };
}
globalThis.MotorLabDynoAudioPowerV1={version:MODULE_VERSION,recalculateRun,deriveGearRatio};
})();