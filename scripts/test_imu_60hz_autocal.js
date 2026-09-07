const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const src=fs.readFileSync(path.resolve(__dirname,'../imu_autocal_v1.js'),'utf8');
let now=1_000_000,saved=null;
class FakeDate extends Date{static now(){return now}}
const handlers={};
const ctx={console,Math,Date:FakeDate,learningSessionId:'learn-test-imu60',learningEnabled:true,learningBuffer:[],window:{addEventListener:(n,f)=>handlers[n]=f},document:{},setInterval:()=>0,clearInterval:()=>{},addLearningEvent:()=>{},collectLearningSample:s=>{ctx.learningBuffer.push(s)},putRawChunk:async c=>{saved=c},measurementWorker:{onmessage:()=>{}},currentSettings:()=>({mass:190,rho:1.225,cda:.55,crr:.015})};
vm.createContext(ctx);vm.runInContext(src,ctx);assert(handlers.devicemotion,'devicemotion handler missing');
const axis=[0.6,-0.8,0];const gravity=[0,0,9.80665];
const accel=t=>1.1*Math.sin(t/1700)+0.45*Math.sin(t/620)+0.25*Math.cos(t/3100);
let eventStamp=0;
for(let ms=0;ms<=65000;ms+=17){
 now=1_000_000+ms;eventStamp+=17;const a=accel(ms);const ua=axis.map(x=>x*a);
 handlers.devicemotion({timeStamp:eventStamp,interval:.017,acceleration:{x:ua[0],y:ua[1],z:ua[2]},accelerationIncludingGravity:{x:ua[0]+gravity[0],y:ua[1]+gravity[1],z:ua[2]+gravity[2]},rotationRate:{alpha:0,beta:0,gamma:0}});
 if(ms%102<17){const gpsA=accel(ms-2000);ctx.collectLearningSample({t:now,kmh:42,gpsKmh:42,a:gpsA,accelerationMps2:gpsA,gpsAccelerationMps2:gpsA})}
}
for(let i=0;i<4;i++){now+=1600;ctx.MotoLabImuAutoCal.solveCalibration(true)}
const snap=ctx.MotoLabImuAutoCal.snapshot();assert(snap.eventRateHz>50&&snap.eventRateHz<70,'event rate not ~60 Hz: '+snap.eventRateHz);assert(Math.abs(Math.abs(snap.bestLagMs)-2000)<=500,'lag not near 2 s: '+snap.bestLagMs);assert(snap.correlation>.7,'correlation too low: '+snap.correlation);assert(snap.axis,'axis missing');const got=[snap.axis.x,snap.axis.y,snap.axis.z];const align=Math.abs(got.reduce((s,x,i)=>s+x*axis[i],0));assert(align>.9,'axis alignment too low: '+align);
const chunk={id:'c1',sessionId:'learn-test-imu60',samples:[{t:1_000_000+35000},{t:1_000_000+65000}],events:[]};
(async()=>{await ctx.putRawChunk(chunk);assert(saved&&saved.imuRaw60Hz,'60 Hz raw stream missing');assert(saved.imuRaw60Hz.targetHz===60);assert(saved.imuRaw60Hz.rows.length>3000,'too few raw IMU rows: '+saved.imuRaw60Hz.rows.length);assert(saved.imuRaw60Hz.fields.includes('ax')&&saved.imuRaw60Hz.fields.includes('rotGamma'));console.log(JSON.stringify({ok:true,eventRateHz:+snap.eventRateHz.toFixed(1),lagMs:snap.bestLagMs,correlation:+snap.correlation.toFixed(3),axisAlignment:+align.toFixed(3),mountState:snap.mountState,rawRows:saved.imuRaw60Hz.rows.length,rawSchema:saved.imuRaw60Hz.schema}))})().catch(e=>{console.error(e);process.exit(1)});
