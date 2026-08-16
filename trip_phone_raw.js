(() => {
'use strict';
const MODULE='trip-phone-raw-v2';
const DB_NAME='VanaMotoLabResearch',DB_VERSION=1;
const STORE='timelineChunks';
const SAMPLE_MS=200;
const FFT_SIZE=16384;
const FFT_MIN_HZ=20,FFT_MAX_HZ=1500;
const BATCH=25;
const $r=id=>document.getElementById(id);
let db=null,active=false,sessionId=null,seq=0,chunkSeq=0,pending=[];
let ctx=null,src=null,an=null,freq=null,time=null,timer=null,lastPhone=null,lastGpsRpm=0,lastGpsT=0;
let flushBusy=false,total=0,lastStatus=0,pausedByGear=false;

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function reqP(req){return new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)})}
function txDone(tx){return new Promise((res,rej)=>{tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||new Error('transaction aborted'))})}
function openDb(){if(db)return Promise.resolve(db);return new Promise((res,rej)=>{const q=indexedDB.open(DB_NAME,DB_VERSION);q.onsuccess=()=>{db=q.result;res(db)};q.onerror=()=>rej(q.error)})}
async function latestSession(){const d=await openDb(),tx=d.transaction('sessions','readonly'),a=await reqP(tx.objectStore('sessions').getAll());await txDone(tx);return (a||[]).sort((x,y)=>(y.startedAtMs||0)-(x.startedAtMs||0))[0]||null}
function ui(){try{return typeof lastUi!=='undefined'&&lastUi?lastUi:{}}catch{return {}}}
function researchRunning(){return $r('tripResearchState')?.textContent?.trim()==='TALLENTAA'}
function micDataAllowed(){const g=globalThis.MOTOLAB_TRIP_GEAR_GUARD;return g?g.micDataAllowed===true:true}
function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)}
function dbAt(hz){if(!an||!ctx||hz<=0||hz>=ctx.sampleRate/2)return -120;const b=Math.round(hz*an.fftSize/ctx.sampleRate);let m=-120;for(let i=Math.max(1,b-2);i<=Math.min(freq.length-1,b+2);i++)m=Math.max(m,freq[i]);return m}
function median(a){if(!a.length)return -120;const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]}
function spectrumSnapshot(){
 an.getFloatFrequencyData(freq);
 const binHz=ctx.sampleRate/an.fftSize,start=Math.max(1,Math.ceil(FFT_MIN_HZ/binHz)),end=Math.min(freq.length-1,Math.floor(FFT_MAX_HZ/binHz));
 const q=new Uint8Array(end-start+1),nf=[];
 for(let b=start,j=0;b<=end;b++,j++){const d=Number.isFinite(freq[b])?freq[b]:-120;q[j]=clamp(Math.round(d+120),0,120);if((j&3)===0)nf.push(d)}
 return {minHz:+(start*binHz).toFixed(3),maxHz:+(end*binHz).toFixed(3),binHz:+binHz.toFixed(6),encoding:'u8_db_plus_120_base64',db:q.length?b64(q):'',noiseFloorDb:+median(nf).toFixed(1)}
}
function signalStats(){an.getFloatTimeDomainData(time);let s=0,peak=0,clips=0;for(const x of time){s+=x*x;const a=Math.abs(x);if(a>peak)peak=a;if(a>=.98)clips++}const rms=Math.sqrt(s/time.length);return {rms:+rms.toFixed(7),rmsDb:rms>1e-9:+(20*Math.log10(rms)).toFixed(2):-120,peak:+peak.toFixed(5),clipFraction:+(clips/time.length).toFixed(6)}}
function harmonic10(f0){const a=[];if(!(f0>0))return a;for(let h=1;h<=10;h++)a.push({h,hz:+(f0*h).toFixed(2),db:+dbAt(f0*h).toFixed(2)});return a}
function spectralTop20(){const out=[],w=[0,.72,1,.96,.84,.66,.50,.42,.36,.30,.26];for(let f=20;f<=250;f+=.5){let score=0,n=0;for(let h=1;h<=10;h++){const d=dbAt(f*h),v=clamp((d+92)/72,0,1);score+=v*w[h];if(d>-68)n++}score+=Math.min(1.1,n*.11);out.push({rpm:+(f*60).toFixed(1),f0:+f.toFixed(2),score:+score.toFixed(4),harmonics:n})}out.sort((a,b)=>b.score-a.score);return out.slice(0,20)}
function driveState(gpsRpm,t){let rate=0,state='unknown';if(gpsRpm>0&&lastGpsRpm>0&&lastGpsT){const dt=(t-lastGpsT)/1000;if(dt>.02)rate=(gpsRpm-lastGpsRpm)/dt}if(gpsRpm>0){lastGpsRpm=gpsRpm;lastGpsT=t}if(Number.isFinite(rate)){if(Math.abs(rate)<150)state='steady';else if(rate>0)state='accelerating';else state='decelerating'}return {state,gpsRpmRate:+rate.toFixed(1)}}
async function setupAnalyser(){
 const stream=globalThis.audioSessions?.ext?.stream;if(!stream)return false;
 try{if(ctx)await ctx.close()}catch{}
 ctx=new (window.AudioContext||window.webkitAudioContext)();await ctx.resume();src=ctx.createMediaStreamSource(stream);an=ctx.createAnalyser();an.fftSize=FFT_SIZE;an.smoothingTimeConstant=.12;src.connect(an);freq=new Float32Array(an.frequencyBinCount);time=new Float32Array(an.fftSize);return true
}
async function flush(){if(flushBusy||!pending.length||!sessionId)return;flushBusy=true;const frames=pending.splice(0,pending.length),i=chunkSeq++;try{const d=await openDb(),tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).put({id:`${sessionId}-phone-raw-${String(i).padStart(6,'0')}`,sessionId,index:1000000+i,createdAt:new Date().toISOString(),source:MODULE,frames});await txDone(tx)}catch(e){pending.unshift(...frames);paint('PHONE RAW tallennusvirhe: '+(e.message||e))}finally{flushBusy=false;if(pending.length>=BATCH)flush()}}
function buildFrame(){
 if(!active||!an||!sessionId)return null;const t=Date.now(),u=ui(),p=lastPhone||globalThis.MOTOLAB_PHONE_RPM||{},ad=globalThis.MOTOLAB_ADAPTIVE_RPM||{};
 const gpsRpm=Number.isFinite(+u.speedRpm)?+u.speedRpm:0,drive=driveState(gpsRpm,t),f0=+p.observedF0||(+p.rawRpm>0?+p.rawRpm/60:0),spec=spectrumSnapshot(),sig=signalStats();
 return {t,kind:'phone_raw_research',module:MODULE,seq:seq++,gear:3,gpsKmh:Number.isFinite(+u.kmh)?+u.kmh:null,gpsReferenceRpm:gpsRpm||null,gpsReferenceConf:Number.isFinite(+u.speedConf)?+u.speedConf:null,gpsAccuracyM:Number.isFinite(+u.gpsAcc)?+u.gpsAcc:null,accelMps2:Number.isFinite(+u.a)?+u.a:null,accelG:Number.isFinite(+u.g)?+u.g:null,...drive,phone:{rpm:+p.rpm||0,rawRpm:+p.rawRpm||0,correctedCandidateRpm:+p.correctedCandidateRpm||0,predictedRpm:+p.predictedRpm||0,velocity:+p.velocity||0,chosenRatio:Number.isFinite(+p.chosenRatio)?+p.chosenRatio:null,conf:+p.conf||0,candidateGap:+p.candidateGap||0,runnerRpm:+p.runnerRpm||0,f0,level:+p.level||0,rmsDb:Number.isFinite(+p.rmsDb)?+p.rmsDb:null,harmonics:+p.harmonics||0,harmonicH1H6:Array.isArray(p.harmonicData)?p.harmonicData:null,harmonicH1H10:harmonic10(f0),topCandidates:Array.isArray(p.topCandidates)?p.topCandidates:null,trackLabel:p.trackLabel||''},adaptive:{rpm:+ad.rpm||0,rawRpm:+ad.rawRpm||0,correction:Number.isFinite(+ad.adaptiveCorrection)?+ad.adaptiveCorrection:null,modelVersion:ad.adaptiveModelVersion||null,gpsRef:+ad.adaptiveGpsRef||0},spectralTop20:spectralTop20(),spectrum:spec,signal:sig,audio:{sampleRate:ctx.sampleRate,fftSize:an.fftSize}}
}
async function sample(){
 if(!active)return;
 if(!micDataAllowed()){
   if(!pausedByGear){pausedByGear=true;paint('PHONE RAW TAUOLLA • vaihde ei ole 3.')}
   return;
 }
 if(pausedByGear){pausedByGear=false;paint('PHONE RAW JATKUU • 3. vaihde')}
 try{const f=buildFrame();if(!f)return;pending.push(f);total++;if(pending.length>=BATCH)flush();if(Date.now()-lastStatus>900){lastStatus=Date.now();paint(`PHONE RAW ${total} • FFT 5 Hz • H1–H10 • top20`)}}catch(e){paint('PHONE RAW virhe: '+(e.message||e))}
}
async function begin(){if(active)return;const meta=await latestSession();if(!meta||meta.endedAt)return;sessionId=meta.id;seq=0;chunkSeq=0;pending=[];total=0;pausedByGear=false;lastGpsRpm=0;lastGpsT=0;if(!await setupAnalyser()){paint('PHONE RAW odottaa mikrofonivirtaa');return}active=true;clearInterval(timer);timer=setInterval(sample,SAMPLE_MS);paint('PHONE RAW KÄYNNISSÄ')}
async function end(){if(!active)return;active=false;clearInterval(timer);timer=null;await flush();let tries=0;while((flushBusy||pending.length)&&tries++<30){await new Promise(r=>setTimeout(r,50));await flush()}try{src?.disconnect()}catch{};try{await ctx?.close()}catch{}ctx=src=an=freq=time=null;paint(`PHONE RAW TALLENNETTU • ${total} kehystä`);sessionId=null}
function paint(s){let e=$r('tripPhoneRawState');if(!e){const panel=$r('tripResearchPanel');if(panel){e=document.createElement('div');e.id='tripPhoneRawState';e.className='statusbox';panel.appendChild(e)}}if(e)e.textContent=s}
function watch(){const running=researchRunning();if(running&&!active)begin().catch(e=>paint('PHONE RAW aloitusvirhe: '+(e.message||e)));if(!running&&active)end().catch(e=>paint('PHONE RAW lopetusvirhe: '+(e.message||e)))}
window.addEventListener('motolab-phone-rpm',e=>{lastPhone=e.detail||null});
window.addEventListener('motolab-trip-gear-guard',()=>{if(active&&!micDataAllowed())paint('PHONE RAW TAUOLLA • vaihde ei ole 3.')});
setInterval(watch,250);
window.addEventListener('beforeunload',()=>{if(active)flush().catch(()=>{})});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>paint('PHONE RAW valmis • odottaa tutkimusajoa'),{once:true});else paint('PHONE RAW valmis • odottaa tutkimusajoa');
})();
