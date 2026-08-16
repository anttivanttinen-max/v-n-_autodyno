const fs=require('fs');
const path='index.html';
let s=fs.readFileSync(path,'utf8');
function rep(oldText,newText,label){
  if(s.includes(newText)) return;
  if(!s.includes(oldText)) throw new Error('Missing patch target: '+label);
  s=s.replace(oldText,newText);
}
rep('let armed=false,recording=false,mode="none",pre=[],run=[],lastGps=null,accel=0,accelEnd=0,lastUi=0,gearClusters=[];',
'let armed=false,recording=false,mode="none",pre=[],run=[],lastGps=null,accel=0,accelEnd=0,lastUi=0,gearClusters=[],autoSession=false,rearmPending=false,rearmReadyAt=0;',
'worker state declaration');
rep('if(armed&&!recording&&f.rpm>=cfg.recordFrom&&g>=cfg.autoSensitivity){recording=true;mode="auto";run=pre.slice();accelEnd=0;postMessage({type:"state",state:"AUTO RUN"})}',
'if(armed&&!recording&&rearmPending&&Date.now()>=rearmReadyAt&&(g<.03||f.rpm<cfg.stopRpm*.92)){rearmPending=false;pre=[];postMessage({type:"state",state:"ARMED"})}\n if(armed&&!recording&&!rearmPending&&f.rpm>=cfg.recordFrom&&g>=cfg.autoSensitivity){recording=true;mode="auto";run=pre.slice();accelEnd=0;postMessage({type:"state",state:"AUTO RUN"})}',
'continuous auto trigger');
rep('const data=run.slice();recording=false;armed=false;mode="none";run=[];accelEnd=0;',
'const completedMode=mode,keepAuto=completedMode==="auto"&&autoSession&&reason!=="STOP";\n const data=run.slice();recording=false;mode="none";run=[];accelEnd=0;\n if(keepAuto){armed=true;rearmPending=true;rearmReadyAt=Date.now()+450}else{armed=false;rearmPending=false;rearmReadyAt=0}',
'finish keeps auto armed');
rep('mode:reason==="STOP"?"manual":"AUTO RIDE"','mode:completedMode==="auto"?"AUTO RIDE":"MANUAL"','run mode classification');
rep('postMessage({type:"state",state:"READY"});','postMessage({type:"state",state:keepAuto?"ARMED":"READY"});','post finish state');
rep('if(m.type==="arm"){armed=true;recording=false;mode="none";run=[];pre=[];postMessage({type:"state",state:"ARMED"})}',
'if(m.type==="arm"){autoSession=true;armed=true;recording=false;rearmPending=false;rearmReadyAt=0;mode="none";run=[];pre=[];postMessage({type:"state",state:"ARMED"})}','arm starts continuous session');
rep('if(m.type==="manual"){armed=false;recording=true;mode="manual";run=[];pre=[];postMessage({type:"state",state:"MANUAL RUN"})}',
'if(m.type==="manual"){autoSession=false;armed=false;rearmPending=false;rearmReadyAt=0;recording=true;mode="manual";run=[];pre=[];postMessage({type:"state",state:"MANUAL RUN"})}','manual disables auto session');
rep('if(m.type==="stop")finish("STOP")',
'if(m.type==="stop"){autoSession=false;rearmPending=false;rearmReadyAt=0;if(recording)finish("STOP");else{armed=false;mode="none";run=[];postMessage({type:"state",state:"STOPPED"})}}','stop disarms auto session');
rep('if(m.type==="cancel"){armed=false;recording=false;mode="none";run=[];postMessage({type:"state",state:"CANCELLED"})}',
'if(m.type==="cancel"){autoSession=false;armed=false;recording=false;rearmPending=false;rearmReadyAt=0;mode="none";run=[];postMessage({type:"state",state:"CANCELLED"})}','cancel resets auto session');

s=s.replace(/<title>VÄNÄ MOTOLAB v32\.3<\/title>/,'<title>VÄNÄ MOTOLAB v32.4</title>');
s=s.replace('MOTOLAB_RELEASE?.version||"32.3"','MOTOLAB_RELEASE?.version||"32.4"');
s=s.replace('id="appVersionBadge">v32.3<','id="appVersionBadge">v32.4<');
s=s.replace('./version.js?build=2026-08-16b','./version.js?build=2026-08-16f');
s=s.replace('build||"2026-08-16b"','build||"2026-08-16f"');
fs.writeFileSync(path,s);

let v=fs.readFileSync('version.js','utf8');
v=v.replace(/version:"32\.3",label:"v32\.3",build:"2026-08-16e"/,'version:"32.4",label:"v32.4",build:"2026-08-16f"');
fs.writeFileSync('version.js',v);

let sw=fs.readFileSync('sw.js','utf8');
sw=sw.replace('version.js?build=2026-08-16b','version.js?build=2026-08-16f');
sw=sw.replace('version||"32.3"','version||"32.4"');
sw=sw.replace('build||"2026-08-16b"','build||"2026-08-16f"');
fs.writeFileSync('sw.js',sw);
console.log('continuous ARM AUTO patch applied');
