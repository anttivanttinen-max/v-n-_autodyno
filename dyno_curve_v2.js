(() => {
'use strict';
const MODULE_VERSION='v32-dyno-curve-2.2';
const GPS_POWER_CALIBRATION=1.07;

function finite(n){return Number.isFinite(+n)}
function validPoint(p){return p&&finite(p.rpm)&&+p.rpm>0&&finite(p.hp)&&finite(p.nm)}
function median(a){if(!a.length)return 0;const s=a.slice().sort((x,y)=>x-y);return s[Math.floor(s.length/2)]}
function avg(a,key){return a.length?a.reduce((s,x)=>s+(+x[key]||0),0)/a.length:0}
function calibratePoint(p){
 if(!p||p.powerCalibrationApplied===GPS_POWER_CALIBRATION)return p;
 return {...p,hp:(+p.hp||0)*GPS_POWER_CALIBRATION,nm:(+p.nm||0)*GPS_POWER_CALIBRATION,powerCalibrationApplied:GPS_POWER_CALIBRATION};
}
function calibrateData(data){return (data||[]).map(calibratePoint)}

function extractDynoSegment(input){
 const d=(input||[]).filter(validPoint).sort((a,b)=>(a.t||0)-(b.t||0));
 if(d.length<8)return d;
 const dtMedian=median(d.slice(1).map((p,i)=>Math.max(1,(p.t||0)-(d[i].t||0))))||50;
 const quietSamples=Math.max(5,Math.round(650/dtMedian));
 const candidates=[];
 let start=-1,lastProgress=-1,quiet=0;
 for(let i=1;i<d.length;i++){
   const p=d[i],q=d[i-1];
   const dr=(+p.rpm||0)-(+q.rpm||0),dv=(+p.kmh||0)-(+q.kmh||0),g=+p.g||0;
   const progress=(g>.018)||(dv>.025)||(dr>12);
   const hardBack=(dv<-.18)||(dr<-Math.max(120,(+q.rpm||0)*.025));
   if(progress){if(start<0)start=Math.max(0,i-1);lastProgress=i;quiet=0}
   else if(start>=0){quiet++;if(hardBack)quiet+=2;if(quiet>=quietSamples){const end=Math.max(start+1,lastProgress);if(end>start)candidates.push([start,end]);start=-1;lastProgress=-1;quiet=0}}
 }
 if(start>=0){const end=Math.max(start+1,lastProgress>=0?lastProgress:d.length-1);candidates.push([start,end])}
 if(!candidates.length)return d;
 let best=null;
 for(const [a,b] of candidates){const x=d.slice(a,b+1);if(x.length<6)continue;const rpmGain=Math.max(0,(+x[x.length-1].rpm||0)-(+x[0].rpm||0));const speedGain=Math.max(0,(+x[x.length-1].kmh||0)-(+x[0].kmh||0));const maxHp=Math.max(0,...x.map(p=>+p.hp||0));const duration=Math.max(0,((x[x.length-1].t||0)-(x[0].t||0))/1000);const score=maxHp*8+rpmGain/120+speedGain*1.5+Math.min(8,duration);if(!best||score>best.score)best={a,b,score}}
 if(!best)return d;
 let seg=d.slice(best.a,best.b+1);
 const peakR=Math.max(...seg.map(p=>+p.rpm||0)),peakV=Math.max(...seg.map(p=>+p.kmh||0));
 let lead=0;
 for(let i=0;i<seg.length-4;i++){const r0=+seg[i].rpm||0,v0=+seg[i].kmh||0,r1=+seg[Math.min(seg.length-1,i+4)].rpm||0,v1=+seg[Math.min(seg.length-1,i+4)].kmh||0;if((r1-r0>120||v1-v0>.6)&&(+seg[i].g||0)>-.01){lead=i;break}}
 seg=seg.slice(lead);
 let peakIndex=0,peakScore=-Infinity;const segMaxHp=Math.max(1,...seg.map(x=>+x.hp||0));
 seg.forEach((p,i)=>{const s=(+p.rpm||0)/Math.max(1,peakR)+(+p.kmh||0)/Math.max(1,peakV)+(+p.hp||0)/segMaxHp;if(s>peakScore){peakScore=s;peakIndex=i}});
 if(peakIndex>=6)seg=seg.slice(0,peakIndex+1);
 return seg;
}

function displayCurve(input){
 const seg=extractDynoSegment(calibrateData(input));
 if(seg.length<4)return seg;
 const minR=Math.min(...seg.map(p=>+p.rpm||0)),maxR=Math.max(...seg.map(p=>+p.rpm||0));
 const binSize=Math.max(100,Math.min(250,Math.round((maxR-minR)/28/50)*50||150));
 const bins=new Map();for(const p of seg){const b=Math.round((+p.rpm||0)/binSize)*binSize;if(!bins.has(b))bins.set(b,[]);bins.get(b).push(p)}
 let out=[...bins.entries()].sort((a,b)=>a[0]-b[0]).map(([rpm,a])=>({...a[Math.floor(a.length/2)],rpm,hp:avg(a,'hp'),nm:avg(a,'nm'),kmh:avg(a,'kmh'),quality:avg(a,'quality')}));
 if(out.length>=5)out=out.map((p,i)=>{if(i===0||i===out.length-1)return p;const a=out.slice(i-1,i+2);return {...p,hp:avg(a,'hp'),nm:avg(a,'nm')}});
 return out;
}
function cleanedRun(r){const data=displayCurve(r?.data||[]);return {...r,data,maxHp:data.length?Math.max(0,...data.map(x=>+x.hp||0)):r.maxHp,maxNm:data.length?Math.max(0,...data.map(x=>+x.nm||0)):r.maxNm,powerCalibration:GPS_POWER_CALIBRATION}}

if(typeof drawChart==='function'){const originalDrawChart=drawChart;drawChart=function(canvas,rr,torque=true,zoom=1,center=7000){return originalDrawChart(canvas,(rr||[]).map(cleanedRun),torque,zoom,center)}}

if(typeof handleRunComplete==='function'){
 const originalHandleRunComplete=handleRunComplete;
 handleRunComplete=async function(r,reason){
   let seg=extractDynoSegment(r?.data||[]);
   if(seg.length>=8){seg=calibrateData(seg);r.data=seg;r.maxHp=Math.max(0,...seg.map(x=>+x.hp||0));r.maxNm=Math.max(0,...seg.map(x=>+x.nm||0));r.maxRpm=Math.max(0,...seg.map(x=>+x.rpm||0));r.quality=Math.round(avg(seg,'quality'));r.status=r.quality>=78?'good':r.quality>=55?'warn':'bad';r.slipPct=Math.round(100*seg.filter(x=>x.slip).length/Math.max(1,seg.length));r.powerCalibration=GPS_POWER_CALIBRATION;r.dynoSegment={version:MODULE_VERSION,autoTrimmed:true,startT:seg[0]?.t||null,endT:seg[seg.length-1]?.t||null}}
   const shownReason=(manualAutoStopRequested&&reason==='STOP')?'Manual auto-stop':reason;manualAutoStopRequested=false;return originalHandleRunComplete(r,shownReason)
 };
}

let manualTrack=null,manualAutoStopRequested=false;
if(typeof renderLive==='function'){
 const originalRenderLive=renderLive;
 renderLive=function(d,m){
   try{const isManual=!!m?.recording&&m?.mode==='manual';if(!isManual){manualTrack=null}else{const now=Date.now(),rpm=+d.rpm||0,kmh=+d.kmh||0,g=+d.g||0;if(!manualTrack)manualTrack={startRpm:rpm,startKmh:kmh,maxRpm:rpm,maxKmh:kmh,maxG:g,started:false,endSince:0,stopSent:false};const t=manualTrack;t.maxRpm=Math.max(t.maxRpm,rpm);t.maxKmh=Math.max(t.maxKmh,kmh);t.maxG=Math.max(t.maxG,g);if(!t.started&&((t.maxKmh-t.startKmh>=3&&t.maxG>.035)||(t.maxRpm-t.startRpm>=700&&t.maxG>.025)))t.started=true;if(t.started&&!t.stopSent){const speedDropped=kmh<t.maxKmh-.7;const pullGone=g<.012&&kmh<t.maxKmh+.15;if(speedDropped||pullGone){if(!t.endSince)t.endSince=now}else t.endSince=0;const delay=Math.max(550,((+document.getElementById('autoStopDelay')?.value)||.7)*1000);if(t.endSince&&now-t.endSince>=delay){t.stopSent=true;manualAutoStopRequested=true;if(typeof measurementWorker!=='undefined')measurementWorker.postMessage({type:'stop'})}}}
   }catch(e){}
   const shown={...d,hp:(+d.hp||0)*GPS_POWER_CALIBRATION,nm:(+d.nm||0)*GPS_POWER_CALIBRATION};return originalRenderLive(shown,m)
 };
}

try{if(typeof infoDefs==='object'){infoDefs.manual='Manuaaliveto käynnistyy painalluksesta. Varsinainen dynoveto rajataan automaattisesti yhteen kiihtyvään vetoon ja päättyy, kun kiihtyvyys loppuu tai nopeus alkaa laskea. RAW-tallennus säilyy erillään.';infoDefs.stop='STOP lopettaa vedon heti. Manuaalivedossa MotoLab osaa myös päättää varsinaisen dynosegmentin automaattisesti, kun veto loppuu.'}}catch(e){}
window.MotoLabDynoCurveV2={version:MODULE_VERSION,powerCalibration:GPS_POWER_CALIBRATION,extractDynoSegment,displayCurve};
})();