const fs=require('fs');
function must(s,oldText,newText,label){if(s.includes(newText))return s;if(!s.includes(oldText))throw new Error('Missing patch target: '+label);return s.replace(oldText,newText)}
let s=fs.readFileSync('index.html','utf8');
s=must(s,
'     scored.push({rpm:rr,rawRpm:f*60,q:c.q,fp,score,f});',
'     scored.push({rpm:rr,rawRpm:f*60,q:c.q,fp,score,f,mult});',
'candidate multiplier');
s=must(s,
' scored.sort((a,b)=>b.score-a.score);const b=scored[0];',
' scored.sort((a,b)=>b.score-a.score);const allCandidates=scored.map(x=>[Math.round(x.rpm*10)/10,Math.round(x.f*100)/100,Math.round(x.rawRpm*10)/10,Math.round(x.q*10000)/10000,Math.round(x.fp*10000)/10000,Math.round(x.score*10000)/10000,x.mult]);const b=scored[0];',
'all candidates compact array');
s=must(s,
' if(conf<.14)return {rpm:0,conf,rawRpm:b.rawRpm,fpScore:b.fp,observedF0:b.f,level:rms,candidateGap,runnerRpm:runner?.rpm||0};',
' if(conf<.14)return {rpm:0,conf,rawRpm:b.rawRpm,fpScore:b.fp,observedF0:b.f,level:rms,candidateGap,runnerRpm:runner?.rpm||0,candidates:allCandidates};',
'low confidence candidates');
s=must(s,
' return {rpm:last[source],conf:clamp(conf,0,1),rawRpm:b.rawRpm,fpScore:b.fp,observedF0:b.f,level:rms,candidateGap,runnerRpm:runner?.rpm||0};',
' return {rpm:last[source],conf:clamp(conf,0,1),rawRpm:b.rawRpm,fpScore:b.fp,observedF0:b.f,level:rms,candidateGap,runnerRpm:runner?.rpm||0,candidates:allCandidates};',
'normal candidates');
s=must(s,
'   postMessage({type:"rpm",source:"ext",rpm:r.rpm,rawRpm:r.rawRpm,conf:r.conf,fpScore:r.fpScore||0,observedF0:r.observedF0||0,level:r.level||0,candidateGap:r.candidateGap||0,runnerRpm:r.runnerRpm||0,t:Date.now()})',
'   postMessage({type:"rpm",source:"ext",rpm:r.rpm,rawRpm:r.rawRpm,conf:r.conf,fpScore:r.fpScore||0,observedF0:r.observedF0||0,level:r.level||0,candidateGap:r.candidateGap||0,runnerRpm:r.runnerRpm||0,candidates:r.candidates||[],t:Date.now()})',
'worker candidate output');
s=must(s,
'rpmWorker.onmessage=e=>{if(e.data.type==="rpm")measurementWorker.postMessage(e.data)};',
'rpmWorker.onmessage=e=>{if(e.data.type==="rpm"){globalThis.MOTOLAB_AUDIO_LAST=e.data;window.dispatchEvent(new CustomEvent("motolab-audio-candidates",{detail:e.data}));const {candidates,...core}=e.data;measurementWorker.postMessage(core)}};',
'audio candidate event bridge');
s=s.replace(/<script src="\.\/version\.js\?build=[^"]+"><\/script>/,'<script src="./version.js?build=2026-08-16k"></script>');
s=s.replace(/build\|\|"2026-08-16j"/g,'build||"2026-08-16k"');
fs.writeFileSync('index.html',s);

let v=fs.readFileSync('version.js','utf8');
v=v.replace(/build:"2026-08-16j"/,'build:"2026-08-16k"');
fs.writeFileSync('version.js',v);

let sw=fs.readFileSync('sw.js','utf8');
sw=sw.replace(/version\.js\?build=2026-08-16j/g,'version.js?build=2026-08-16k').replace(/build\|\|"2026-08-16j"/g,'build||"2026-08-16k"');
sw=sw.replace('"./default_dt.js","./version.js"','"./default_dt.js","./trip_research.js","./version.js"');
sw=must(sw,
' if(!html.includes("default_dt.js"))scripts.push(\'<script src="./default_dt.js?v=\'+V+\'&build=\'+B+\'"></script>\');',
' if(!html.includes("default_dt.js"))scripts.push(\'<script src="./default_dt.js?v=\'+V+\'&build=\'+B+\'"></script>\');\n if(!html.includes("trip_research.js"))scripts.push(\'<script src="./trip_research.js?v=\'+V+\'&build=\'+B+\'"></script>\');',
'trip research injection');
sw=sw.replace('(vehicle_lookup|technical_specs|maintenance|gps_master_learning|raw_sync|dyno_curve_v2|ui_compact|default_dt)', '(vehicle_lookup|technical_specs|maintenance|gps_master_learning|raw_sync|dyno_curve_v2|ui_compact|default_dt|trip_research)');
fs.writeFileSync('sw.js',sw);
console.log('trip research patch applied');
