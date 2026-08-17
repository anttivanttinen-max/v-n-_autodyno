(() => {
'use strict';

const MODULE='motolab-sensor-fusion-shadow-v1';
const DB_NAME='VanaMotoLabFusionShadow';
const DB_VERSION=1;
const STORE='chunks';
const SAMPLE_MS=100;
const CHUNK_SIZE=300;
const ENABLE_KEY='motolab_fusion_shadow_enabled';
const MAX_MOTION_WINDOW_MS=2200;
const G=9.80665;

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const num=v=>Number.isFinite(+v)?+v:null;
const now=()=>Date.now();
const $=id=>document.getElementById(id);

let enabled=localStorage.getItem(ENABLE_KEY)!=='0';
let db=null;
let seq=0;
let chunkSeq=0;
let buffer=[];
let flushBusy=false;
let lastTick=0;
let lastGps={t:0,kmh:null,filtered:null,accel:0};
let shadow={t:0,speedKmh:null,accelMps2:null,rpm:null,gear:null};
let motion=[];
let lastMotionAt=0;
let latestMotion=null;
let forwardAxis=null;
let axisEvidence=[0,0,0];
let axisEvidenceWeight=0;
let lastRotationMag=0;
let lastGravityDir=null;
let recentGpsDerivative=[];

function openDb(){
 if(db)return Promise.resolve(db);
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open(DB_NAME,DB_VERSION);
  r.onupgradeneeded=()=>{
   const d=r.result;
   if(!d.objectStoreNames.contains(STORE)){
    const s=d.createObjectStore(STORE,{keyPath:'id'});
    s.createIndex('created','created',{unique:false});
   }
  };
  r.onsuccess=()=>{db=r.result;resolve(db)};
  r.onerror=()=>reject(r.error);
 });
}
function reqDone(tx){return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||new Error('aborted'))})}
async function flush(force=false){
 if(flushBusy||(!buffer.length&&!force))return false;
 const frames=buffer.splice(0,buffer.length);
 if(!frames.length)return false;
 flushBusy=true;
 try{
  const d=await openDb();
  const tx=d.transaction(STORE,'readwrite');
  tx.objectStore(STORE).put({
   id:`fusion-${Date.now()}-${String(chunkSeq++).padStart(6,'0')}`,
   created:new Date().toISOString(),module:MODULE,shadowOnly:true,frames
  });
  await reqDone(tx);return true;
 }catch(e){buffer.unshift(...frames);return false}
 finally{flushBusy=false}
}

function parseTextNumber(id){
 const e=$(id);if(!e)return null;
 const m=String(e.textContent||'').replace(',','.').match(/-?\d+(?:\.\d+)?/);
 return m?+m[0]:null;
}
function currentProfile(){
 try{
  const ps=JSON.parse(localStorage.getItem('motolab_v26_profiles')||'[]');
  if(!Array.isArray(ps)||!ps.length)return null;
  const id=localStorage.getItem('motolab_v26_profile');
  return ps.find(p=>p.id===id)||ps[0]||null;
 }catch{return null}
}
function sortedGearRatios(){
 const p=currentProfile();
 const out=[];
 const cals=Array.isArray(p?.gpsCalibrations)?p.gpsCalibrations:[];
 for(const x of cals){if(+x.gear>0&&+x.ratio>0)out.push({gear:+x.gear,ratio:+x.ratio,source:'gps_calibration'})}
 if(!out.length&&Array.isArray(p?.gearRatios)){
  const a=p.gearRatios.filter(x=>+x.ratio>0).slice().sort((a,b)=>b.ratio-a.ratio);
  a.forEach((x,i)=>out.push({gear:i+1,ratio:+x.ratio,source:'learned_ratio'}));
 }
 return out;
}
function getGearRatio(gear){
 if(!(gear>0))return null;
 return sortedGearRatios().find(x=>x.gear===gear)||null;
}

function unit(v){
 const n=Math.hypot(v[0]||0,v[1]||0,v[2]||0);
 return n>1e-6?[v[0]/n,v[1]/n,v[2]/n]:null;
}
function dot(a,b){return a&&b?a[0]*b[0]+a[1]*b[1]+a[2]*b[2]:0}
function angleDeg(a,b){
 if(!a||!b)return 0;
 return Math.acos(clamp(dot(a,b),-1,1))*180/Math.PI;
}
function std(a){
 if(!a.length)return 0;const m=a.reduce((s,x)=>s+x,0)/a.length;
 return Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/a.length);
}

function onMotion(e){
 const t=now();
 const a=e.acceleration||{};
 const ag=e.accelerationIncludingGravity||{};
 const rr=e.rotationRate||{};
 const av=[num(a.x)||0,num(a.y)||0,num(a.z)||0];
 const gv=[num(ag.x)||0,num(ag.y)||0,num(ag.z)||0];
 const gravityDir=unit(gv);
 const rot=[num(rr.alpha)||0,num(rr.beta)||0,num(rr.gamma)||0];
 const rotMag=Math.hypot(...rot);
 const accelMag=Math.hypot(...av);
 const gravityChange=lastGravityDir&&gravityDir?angleDeg(lastGravityDir,gravityDir):0;
 lastGravityDir=gravityDir||lastGravityDir;
 lastRotationMag=rotMag;
 latestMotion={t,accel:av,accelMag,accelIncludingGravity:gv,gravityDir,rotationRate:rot,rotationMag:rotMag,gravityChangeDeg:gravityChange,intervalMs:num(e.interval)};
 lastMotionAt=t;
 motion.push(latestMotion);
 while(motion.length&&t-motion[0].t>MAX_MOTION_WINDOW_MS)motion.shift();
}
window.addEventListener('devicemotion',onMotion,{passive:true});

function mountAssessment(){
 const t=now();
 if(!lastMotionAt||t-lastMotionAt>900||motion.length<5){
  return {state:'imu_unavailable',confidence:0,rotationRms:null,gravityJitterDeg:null,accelJitter:null};
 }
 const rots=motion.map(x=>x.rotationMag);
 const gchg=motion.map(x=>x.gravityChangeDeg).filter(Number.isFinite);
 const amag=motion.map(x=>x.accelMag);
 const rotationRms=Math.sqrt(rots.reduce((s,x)=>s+x*x,0)/Math.max(1,rots.length));
 const gravityJitterDeg=gchg.length?Math.sqrt(gchg.reduce((s,x)=>s+x*x,0)/gchg.length):0;
 const accelJitter=std(amag);

 // A fixed bike mount can vibrate, but its gravity direction should not wander continuously.
 // Pocket/body movement tends to combine orientation wandering + rotation + non-engine accel jitter.
 let penalty=0;
 penalty+=clamp((gravityJitterDeg-1.2)/7.0,0,1)*0.48;
 penalty+=clamp((rotationRms-5)/55,0,1)*0.30;
 penalty+=clamp((accelJitter-0.35)/3.2,0,1)*0.22;
 let confidence=clamp(1-penalty,0,1);
 let state='fixed';
 if(confidence<0.25)state='pocket_suspected';
 else if(confidence<0.58)state='unstable';
 return {state,confidence,rotationRms,gravityJitterDeg,accelJitter};
}

function gpsState(){
 const t=now();
 const kmh=parseTextNumber('speedMain');
 const acc=parseTextNumber('gpsAccuracy');
 if(!(kmh>=0))return {kmh:null,accuracyM:acc,confidence:0,spike:false,ageMs:null,accelMps2:null};
 let c=acc==null?0.50:acc<=5?0.95:acc<=8?0.82:acc<=12?0.67:acc<=20?0.42:0.20;
 let spike=false,ga=null;
 if(lastGps.t&&lastGps.kmh!=null){
  const dt=(t-lastGps.t)/1000;
  if(dt>0.03&&dt<2){
   const step=kmh-lastGps.kmh;
   ga=(step/3.6)/dt;
   const maxPlausible=12.0; // generous motorcycle longitudinal acceleration gate
   if(Math.abs(ga)>maxPlausible){spike=true;c*=0.18}
   recentGpsDerivative.push({t,a:ga});
   while(recentGpsDerivative.length&&t-recentGpsDerivative[0].t>1200)recentGpsDerivative.shift();
  }
 }
 lastGps={t,kmh,accel:ga,filtered:lastGps.filtered};
 return {kmh,accuracyM:acc,confidence:clamp(c,0,1),spike,ageMs:0,accelMps2:ga};
}

function rpmState(gps){
 const t=now();
 const rpm=parseTextNumber('rpmMain');
 const confPct=parseTextNumber('rpmConf');
 const gear=parseTextNumber('gearMain');
 const src=String($('rpmSource')?.textContent||'').trim();
 let c=confPct==null?0.35:clamp(confPct/100,0,1);
 if(!(rpm>0))c=0;
 const gr=getGearRatio(gear);
 let speedKmh=null,agreement=null;
 if(rpm>0&&gr?.ratio>0){
  speedKmh=rpm/gr.ratio;
  if(gps.kmh>3){
   agreement=Math.abs(speedKmh-gps.kmh)/Math.max(speedKmh,gps.kmh,1);
   if(agreement>.35)c*=0.15;
   else if(agreement>.20)c*=0.45;
   else if(agreement>.10)c*=0.75;
  }
 }
 const a=globalThis.MOTOLAB_AUDIO_LAST||{};
 const audioConf=Number.isFinite(+a.conf)?+a.conf:null;
 const candidateGap=Number.isFinite(+a.candidateGap)?+a.candidateGap:null;
 if(/audio|mic|bt/i.test(src)&&audioConf!=null)c*=clamp(0.45+audioConf*0.70,0,1);
 if(candidateGap!=null&&candidateGap<0.08)c*=0.55;
 return {t,rpm:rpm||null,confidence:clamp(c,0,1),source:src,gear:gear||null,gearRatio:gr?.ratio||null,speedKmh,agreement,audioConf,candidateGap};
}

function learnForwardAxis(gps,mount){
 if(!latestMotion||mount.confidence<0.72||gps.confidence<0.65||!Number.isFinite(gps.accelMps2))return;
 const a=latestMotion.accel;
 const amag=Math.hypot(...a);
 if(amag<0.10||Math.abs(gps.accelMps2)<0.15)return;
 const sign=gps.accelMps2>=0?1:-1;
 const u=unit(a);if(!u)return;
 const w=clamp(Math.abs(gps.accelMps2)/4,0.08,1)*mount.confidence*gps.confidence;
 for(let i=0;i<3;i++)axisEvidence[i]+=u[i]*sign*w;
 axisEvidenceWeight+=w;
 const candidate=unit(axisEvidence);
 if(candidate&&axisEvidenceWeight>2.5)forwardAxis=candidate;
}

function imuState(mount){
 if(!latestMotion||mount.confidence<=0)return {longAccelMps2:null,confidence:0,axis:null,ageMs:null};
 const age=now()-latestMotion.t;
 let c=mount.confidence*clamp(1-age/900,0,1);
 let longAccel=null;
 if(forwardAxis){
  longAccel=dot(latestMotion.accel,forwardAxis);
  c*=0.92;
 }else{
  // Without a learned vehicle-forward axis we keep IMU observational only.
  c*=0.20;
 }
 if(mount.state==='pocket_suspected')c=Math.min(c,0.03);
 else if(mount.state==='unstable')c=Math.min(c,0.20);
 return {longAccelMps2:longAccel,confidence:clamp(c,0,1),axis:forwardAxis?forwardAxis.slice():null,ageMs:age};
}

function weights(gps,rpm,imu){
 let wg=gps.confidence;
 let wr=(rpm.speedKmh!=null?rpm.confidence:0);
 let wi=(imu.longAccelMps2!=null?imu.confidence:0);
 // GPS is the absolute anchor; even when weak it retains a tiny correcting role if present.
 if(gps.kmh!=null)wg=Math.max(wg,0.06);
 const sum=wg+wr+wi;
 return sum>0?{gps:wg/sum,rpm:wr/sum,imu:wi/sum}:{gps:0,rpm:0,imu:0};
}

function integrateFusion(gps,rpm,imu,w,t){
 const dt=lastTick?clamp((t-lastTick)/1000,0.02,0.5):SAMPLE_MS/1000;
 lastTick=t;
 let v=shadow.speedKmh;
 if(v==null){
  if(gps.kmh!=null)v=gps.kmh;
  else if(rpm.speedKmh!=null)v=rpm.speedKmh;
  else v=0;
 }
 if(imu.longAccelMps2!=null&&imu.confidence>0.05)v+=imu.longAccelMps2*dt*3.6;
 const absWeight=w.gps+w.rpm;
 if(absWeight>0){
  const target=((gps.kmh??v)*w.gps+(rpm.speedKmh??v)*w.rpm)/absWeight;
  const correction=clamp(absWeight*0.42,0.04,0.55);
  v=v+(target-v)*correction;
 }
 v=Math.max(0,v);
 const gpsA=Number.isFinite(gps.accelMps2)&&!gps.spike?gps.accelMps2:null;
 const waGps=gpsA==null?0:gps.confidence;
 const waImu=imu.longAccelMps2==null?0:imu.confidence;
 const asum=waGps+waImu;
 const fusedA=asum>0?((gpsA||0)*waGps+(imu.longAccelMps2||0)*waImu)/asum:null;
 const fusedRpm=rpm.rpm;
 shadow={t,speedKmh:v,accelMps2:fusedA,rpm:fusedRpm,gear:rpm.gear};
 return shadow;
}

function snapshot(){
 const t=now();
 const mount=mountAssessment();
 const gps=gpsState();
 const rpm=rpmState(gps);
 learnForwardAxis(gps,mount);
 const imu=imuState(mount);
 const w=weights(gps,rpm,imu);
 const fused=integrateFusion(gps,rpm,imu,w,t);
 const reason=[];
 if(gps.spike)reason.push('gps_spike_rejected');
 if(mount.state==='pocket_suspected')reason.push('pocket_suspected_imu_near_zero');
 else if(mount.state==='unstable')reason.push('unstable_mount_imu_reduced');
 if(rpm.agreement!=null&&rpm.agreement>.20)reason.push('rpm_speed_disagreement');
 if(!forwardAxis)reason.push('imu_forward_axis_unlearned');
 const out={
  t,module:MODULE,shadowOnly:true,authority:'observational_only',
  gps,rpm,imu,mount,weights:w,
  shadow:{speedKmh:fused.speedKmh,accelMps2:fused.accelMps2,rpm:fused.rpm,gear:fused.gear},
  reason,
  rawMotion:latestMotion?{
   t:latestMotion.t,accel:latestMotion.accel,accelIncludingGravity:latestMotion.accelIncludingGravity,
   gravityDir:latestMotion.gravityDir,rotationRate:latestMotion.rotationRate,
   rotationMag:latestMotion.rotationMag,gravityChangeDeg:latestMotion.gravityChangeDeg,intervalMs:latestMotion.intervalMs
  }:null
 };
 globalThis.MOTOLAB_FUSION_SHADOW=out;
 window.dispatchEvent(new CustomEvent('motolab-fusion-shadow',{detail:out}));
 return out;
}

async function exportData(){
 await flush(true);
 const d=await openDb();
 const chunks=await new Promise((res,rej)=>{const tx=d.transaction(STORE,'readonly'),r=tx.objectStore(STORE).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)});
 const payload={schema:'motolab_fusion_shadow_export_v1',module:MODULE,exported:new Date().toISOString(),shadowOnly:true,chunks};
 const blob=new Blob([JSON.stringify(payload)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='VANA_MotoLab_fusion_shadow_'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
 return chunks.length;
}
async function clearData(){
 const d=await openDb();const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).clear();await reqDone(tx);chunkSeq=0;buffer=[];
}
function setEnabled(v){enabled=!!v;localStorage.setItem(ENABLE_KEY,enabled?'1':'0');return enabled}

globalThis.MOTOLAB_FUSION_SHADOW_API={module:MODULE,shadowOnly:true,snapshot:()=>globalThis.MOTOLAB_FUSION_SHADOW||null,exportData,clearData,setEnabled,isEnabled:()=>enabled};

setInterval(()=>{
 if(!enabled)return;
 try{
  const s=snapshot();buffer.push(s);seq++;
  if(buffer.length>=CHUNK_SIZE)flush().catch(()=>{});
 }catch{}
},SAMPLE_MS);
window.addEventListener('pagehide',()=>flush(true).catch(()=>{}));

})();
