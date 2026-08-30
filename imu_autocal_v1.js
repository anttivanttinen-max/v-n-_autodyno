(() => {
  'use strict';

  const VERSION='imu-autocal-v1';
  const RAW_SCHEMA='imu_raw_v1';
  const MAX_EVENTS=7000;
  const MAX_PAIRS=180;
  const state={
    events:[],pairs:[],latest:null,axis:null,axisConfidence:0,correlation:0,
    gravity:null,mountState:'INIT',lastStateEvent:'',lastAxisUpdate:0,
    wrappedCollect:false,wrappedPut:false
  };

  const n=v=>Number.isFinite(+v)?+v:null;
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const vec=(x,y,z)=>[n(x)||0,n(y)||0,n(z)||0];
  const mag=v=>Math.hypot(v[0],v[1],v[2]);
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const unit=v=>{const m=mag(v);return m>1e-9?v.map(x=>x/m):null};
  const mix=(a,b,k)=>a.map((x,i)=>x*(1-k)+b[i]*k);

  function corr(rows){
    if(rows.length<8)return 0;
    const ax=rows.map(x=>x.imu),ay=rows.map(x=>x.gps);
    const mx=ax.reduce((s,x)=>s+x,0)/ax.length,my=ay.reduce((s,x)=>s+x,0)/ay.length;
    let num=0,dx=0,dy=0;
    for(let i=0;i<ax.length;i++){const x=ax[i]-mx,y=ay[i]-my;num+=x*y;dx+=x*x;dy+=y*y}
    return dx>1e-9&&dy>1e-9?num/Math.sqrt(dx*dy):0;
  }

  function gravityFromEvent(e,a,ag){
    if(e.acceleration&&e.accelerationIncludingGravity){
      return [ag[0]-a[0],ag[1]-a[1],ag[2]-a[2]];
    }
    if(!state.gravity)return ag;
    return state.gravity;
  }

  function onMotion(e){
    const t=Date.now();
    const a=vec(e.acceleration?.x,e.acceleration?.y,e.acceleration?.z);
    const ag=vec(e.accelerationIncludingGravity?.x,e.accelerationIncludingGravity?.y,e.accelerationIncludingGravity?.z);
    const r=vec(e.rotationRate?.alpha,e.rotationRate?.beta,e.rotationRate?.gamma);
    const g=gravityFromEvent(e,a,ag);
    if(mag(g)>4&&mag(g)<15){
      const gu=unit(g);
      state.gravity=state.gravity?unit(mix(state.gravity,gu,.035)):gu;
    }
    const rotMag=mag(r);
    const userMag=mag(a);
    const movingHard=rotMag>85||userMag>7;
    if(movingHard)state.mountState='MOVING';
    else if(state.axisConfidence>=.55)state.mountState='CALIBRATED';
    else if(state.axisConfidence>=.2)state.mountState='LEARNING';
    else state.mountState='UNVERIFIED';

    const longitudinal=state.axis?dot(a,state.axis):null;
    const rec={
      t, eventTimeStampMs:n(e.timeStamp), intervalMs:n(e.interval),
      ax:a[0],ay:a[1],az:a[2],agx:ag[0],agy:ag[1],agz:ag[2],
      rotAlpha:r[0],rotBeta:r[1],rotGamma:r[2],
      gx:state.gravity?.[0]??null,gy:state.gravity?.[1]??null,gz:state.gravity?.[2]??null,
      longitudinalMps2:Number.isFinite(longitudinal)?longitudinal:null,
      axisX:state.axis?.[0]??null,axisY:state.axis?.[1]??null,axisZ:state.axis?.[2]??null,
      confidence:state.axisConfidence,correlation:state.correlation,mountState:state.mountState,
      userAccelMag:userMag,rotationMag:rotMag
    };
    state.latest=rec;state.events.push(rec);
    if(state.events.length>MAX_EVENTS)state.events.splice(0,state.events.length-MAX_EVENTS);
    globalThis.MOTOLAB_IMU_AUTOCAL={version:VERSION,schema:RAW_SCHEMA,...snapshot()};
  }

  function calibrateFromGps(sample){
    const gpsA=n(sample?.a);
    const rec=state.latest;
    if(gpsA==null||!rec||Date.now()-rec.t>350)return;
    const a=[rec.ax||0,rec.ay||0,rec.az||0],am=mag(a);
    if(Math.abs(gpsA)>.12&&am>.06&&am<8&&rec.rotationMag<90){
      let candidate=unit(a);
      if(candidate){
        if(gpsA<0)candidate=candidate.map(x=>-x);
        if(state.axis&&dot(candidate,state.axis)<0)candidate=candidate.map(x=>-x);
        const alpha=state.axis?.length?.1:.2;
        state.axis=state.axis?unit(mix(state.axis,candidate,alpha)):candidate;
        state.lastAxisUpdate=Date.now();
      }
    }
    if(state.axis){
      const projected=dot(a,state.axis);
      if(Number.isFinite(projected)&&Math.abs(gpsA)>.05){
        state.pairs.push({imu:projected,gps:gpsA,t:Date.now()});
        if(state.pairs.length>MAX_PAIRS)state.pairs.splice(0,state.pairs.length-MAX_PAIRS);
        const recent=state.pairs.filter(x=>Date.now()-x.t<60000);
        state.correlation=corr(recent);
        const countScore=clamp(recent.length/45);
        const corrScore=clamp((state.correlation-.15)/.7);
        const rotPenalty=rec.rotationMag>45?.55:1;
        const freshness=Date.now()-state.lastAxisUpdate<30000?1:.65;
        state.axisConfidence=clamp(countScore*corrScore*rotPenalty*freshness);
      }
    }
    maybeEvent();
  }

  function snapshot(){
    return {
      axis:state.axis?{x:state.axis[0],y:state.axis[1],z:state.axis[2]}:null,
      gravity:state.gravity?{x:state.gravity[0],y:state.gravity[1],z:state.gravity[2]}:null,
      confidence:state.axisConfidence,correlation:state.correlation,
      mountState:state.mountState,pairCount:state.pairs.length,lastEventAt:state.latest?.t||null
    };
  }

  function maybeEvent(){
    const key=state.mountState+':'+Math.round(state.axisConfidence*10);
    if(key===state.lastStateEvent)return;
    state.lastStateEvent=key;
    try{globalThis.addLearningEvent?.('imu_autocal_state',{module:VERSION,...snapshot()})}catch{}
  }

  function nearest(t){
    if(!state.events.length)return null;
    let best=null,bestDt=Infinity;
    for(let i=state.events.length-1;i>=0;i--){
      const r=state.events[i],d=Math.abs(r.t-t);
      if(d<bestDt){best=r;bestDt=d}
      if(r.t<t-500)break;
    }
    return bestDt<=250?{rec:best,age:bestDt}:null;
  }

  function enrichChunk(chunk){
    if(!chunk||!Array.isArray(chunk.samples))return chunk;
    for(const row of chunk.samples){
      const hit=nearest(n(row.t)||Date.now());
      if(!hit)continue;
      const r=hit.rec;
      Object.assign(row,{
        imuRawSchema:RAW_SCHEMA,imuCalibrationVersion:VERSION,imuEventAgeMs:hit.age,
        imuReceiveTimeMs:r.t,imuEventTimeStampMs:r.eventTimeStampMs,imuIntervalMs:r.intervalMs,
        imuAccelX:r.ax,imuAccelY:r.ay,imuAccelZ:r.az,
        imuAccelIncludingGravityX:r.agx,imuAccelIncludingGravityY:r.agy,imuAccelIncludingGravityZ:r.agz,
        imuRotationAlpha:r.rotAlpha,imuRotationBeta:r.rotBeta,imuRotationGamma:r.rotGamma,
        imuGravityX:r.gx,imuGravityY:r.gy,imuGravityZ:r.gz,
        imuLongitudinalMps2:r.longitudinalMps2,
        imuAxisX:r.axisX,imuAxisY:r.axisY,imuAxisZ:r.axisZ,
        imuCalibrationConfidence:r.confidence,imuGpsCorrelation:r.correlation,
        imuMountState:r.mountState,imuUserAccelMag:r.userAccelMag,imuRotationMag:r.rotationMag
      });
    }
    chunk.imu={schema:RAW_SCHEMA,calibrationVersion:VERSION,mode:'shadow_only',...snapshot()};
    return chunk;
  }

  function patchCollect(){
    if(state.wrappedCollect||typeof globalThis.collectLearningSample!=='function')return false;
    const original=globalThis.collectLearningSample;
    function wrapped(sample){calibrateFromGps(sample);return original.apply(this,arguments)}
    wrapped.__imuAutocalWrapped=true;
    globalThis.collectLearningSample=wrapped;state.wrappedCollect=true;return true;
  }

  function patchPut(){
    if(state.wrappedPut||typeof globalThis.putRawChunk!=='function')return false;
    const original=globalThis.putRawChunk;
    async function wrapped(chunk){return original.call(this,enrichChunk(chunk))}
    wrapped.__imuAutocalWrapped=true;
    globalThis.putRawChunk=wrapped;state.wrappedPut=true;return true;
  }

  window.addEventListener('devicemotion',onMotion,{passive:true});
  const timer=setInterval(()=>{
    patchCollect();patchPut();
    if(state.wrappedCollect&&state.wrappedPut)clearInterval(timer);
  },250);
  patchCollect();patchPut();
  globalThis.MotoLabImuAutoCal={version:VERSION,schema:RAW_SCHEMA,snapshot,enrichChunk};
  try{globalThis.addLearningEvent?.('imu_autocal_loaded',{module:VERSION,schema:RAW_SCHEMA,mode:'shadow_only'})}catch{}
})();
