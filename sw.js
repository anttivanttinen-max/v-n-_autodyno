importScripts('./version.js?build=2026-09-05-0538-phone-bridge-v1');

const VERSION=globalThis.MOTOLAB_RELEASE?.version||'34.9';
const LABEL=globalThis.MOTOLAB_RELEASE?.label||'v34.9 BETA';
const BUILD=globalThis.MOTOLAB_RELEASE?.build||'2026-09-05-0538-phone-bridge-v1';
const V=encodeURIComponent(VERSION),B=encodeURIComponent(BUILD);
const CACHE='vana-motorlab-v34-9-stable-'+BUILD.replace(/[^a-z0-9]+/gi,'-');

const MODULES=[
 'splash_boot',
 'diagnostics','vehicle_catalog_finland_v2_loader','vehicle_lookup','technical_specs','maintenance',
 'gps_master_learning','raw_sync','dyno_curve_v2','post_run_curve_check_v1','ui_compact','default_dt','trip_research','research_sync',
 'user_identity','auth_session_guard','admin_pending_notify','password_login','user_features','feedback','community','merit','beta_menu','beta_release',
 'mic_authority','sensor_persistence','sensor_autostart','imu_autocal_v1','admin_test_tools','phone_rpm_smart','adaptive_rpm_learning',
 'trip_phone_raw','trip_gear_guard','trip_gear_marker','live_status','live_status_guard',
 'motorlab_branding','simple_user_ui','v34_dashboard_ui','motorlab_i18n','run_analysis_v34','v34_runtime_fixes','raw_data_ui_light','phone_bridge'
];
const STATIC=[
 'manifest.webmanifest','bike.png','icon-192.png','icon-512.png','rpm-learning-model.json',
 'vehicle_catalog.json','maintenance_catalog.json','version.js','assets/motolab-start-v34.png'
];
const bust=p=>'./'+p+'?v='+V+'&build='+B;
const CORE=[...MODULES.map(n=>bust(n+'.js')),...STATIC.map(bust)];

function inject(html){
 html=html.replace("let lastGear=null,lastGearConf=0,lastFusionRpm=0;\n","let lastGear=null,lastGearConf=0,lastFusionRpm=0,pendingGear=null,pendingGearAt=0;\n");
 html=html.replace(" const ratios=[...(cfg.gearRatios||[])].sort((a,b)=>b.ratio-a.ratio);\n"," let ratios=[...(cfg.gearRatios||[])].sort((a,b)=>b.ratio-a.ratio);if(!ratios.length){const c=(cfg.gpsCalibrations||[]).find(x=>+x.gear===3&&x.ratio>0);if(c){const gs=[2.833,1.875,1.412,1.143,.957,.818],g3=gs[2];ratios=gs.map(g=>({ratio:+c.ratio*(g/g3)}))}}\n");
 html=html.replace(" ratios.forEach((r,i)=>{const err=Math.abs(ratio-r.ratio)/Math.max(r.ratio,1e-9);if(!best||err<best.err)best={gear:i+1,err,r}});\n if(best&&best.err<.13)return {gear:best.gear,gearConf:clamp(1-best.err/.13,0,1),gearRatio:best.r.ratio};\n"," ratios.forEach((r,i)=>[.5,2/3,1,1.5,2,3].forEach(h=>{const e=r.ratio*h,err=Math.abs(ratio-e)/Math.max(e,1e-9),score=err+(h===1?0:.02)+(lastGear&&i+1!==lastGear?(Math.abs(i+1-lastGear)===1?.02:.12):0);if(!best||score<best.score)best={gear:i+1,err,score,r,h}}));\n if(best&&best.err<.13){const now=Date.now();if(lastGear&&best.gear!==lastGear){if(Math.abs(best.gear-lastGear)>1)return {gear:lastGear,gearConf:Math.max(.35,lastGearConf*.92),gearRatio:ratios[lastGear-1]?.ratio||0};if(pendingGear!==best.gear){pendingGear=best.gear;pendingGearAt=now;return {gear:lastGear,gearConf:Math.max(.35,lastGearConf*.92),gearRatio:ratios[lastGear-1]?.ratio||0};}if(now-pendingGearAt<850)return {gear:lastGear,gearConf:Math.max(.35,lastGearConf*.92),gearRatio:ratios[lastGear-1]?.ratio||0};}pendingGear=null;pendingGearAt=0;return {gear:best.gear,gearConf:clamp(1-best.err/.13,0,1),gearRatio:best.r.ratio};}\n");
 html=html.replace(" const a=audioEstimate();\n"," const a=audioEstimate();\n const gpsAgeMs=gps.t?Math.max(0,Date.now()-gps.t):99999;\n const gpsFreshness=gpsAgeMs<=350?1:gpsAgeMs>=2500?0:clamp(1-(gpsAgeMs-350)/2150,0,1);\n");
 html=html.replace(" if(a.rpm>0&&gps.kmh>=cfg.speedRpmMinKmh){\n"," if(a.rpm>0&&gps.kmh>=cfg.speedRpmMinKmh&&gpsFreshness>.35){\n");
 html=html.replace(" if(!gear&&lastGear&&sorted[lastGear-1]){gear=lastGear;gearConf=Math.max(.35,lastGearConf*.92);gearRatio=sorted[lastGear-1].ratio}\n if(selectedCal&&(!gearRatio||cfg.rpmSourceMode===\"gps\")){gear=+cfg.selectedGear||selectedCal.gear;gearConf=.96;gearRatio=selectedCal.ratio}\n"," if(!gear&&lastGear&&sorted[lastGear-1]&&gpsFreshness>0){gear=lastGear;gearConf=Math.max(.35,lastGearConf*.92)*gpsFreshness;gearRatio=sorted[lastGear-1].ratio}\n if(cfg.rpmSourceMode===\"gps\"&&selectedCal&&gpsFreshness>0){gear=+cfg.selectedGear||selectedCal.gear;gearConf=.96*gpsFreshness;gearRatio=selectedCal.ratio}\n");
 html=html.replace(" if(gps.kmh>=cfg.speedRpmMinKmh){\n   if(gearRatio>0){speedRpm=gps.kmh*gearRatio;speedConf=selectedCal?.ratio===gearRatio?.82:clamp(.48+.42*gearConf,0,.92)}\n   else if(cfg.manualRatio>0){speedRpm=gps.kmh*cfg.manualRatio;speedConf=.58}\n"," if(gps.kmh>=cfg.speedRpmMinKmh&&gpsFreshness>0){\n   if(gearRatio>0){speedRpm=gps.kmh*gearRatio;speedConf=(selectedCal?.ratio===gearRatio?.82:clamp(.48+.42*gearConf,0,.92))*gpsFreshness}\n   else if(cfg.manualRatio>0){speedRpm=gps.kmh*cfg.manualRatio;speedConf=.58*gpsFreshness}\n");
 html=html.replace("   audioRpm:f.audioRpm,audioRawRpm:f.audioRawRpm,audioFpScore:f.audioFpScore,audioObservedF0:f.audioObservedF0,audioLevel:f.audioLevel,audioConf:f.audioConf,audioCandidateGap:f.audioCandidateGap,audioRunnerRpm:f.audioRunnerRpm,speedRpm:f.speedRpm,speedConf:f.speedConf,fusionRpm:f.rpm,fusionMode:f.fusionMode,slip:f.slip,agreement:f.agreement,motionMag:motion.mag||0,motionAgeMs:motion.t?Math.max(0,Date.now()-motion.t):null};\n","   audioRpm:f.audioRpm,audioRawRpm:f.audioRawRpm,audioFpScore:f.audioFpScore,audioObservedF0:f.audioObservedF0,audioLevel:f.audioLevel,audioConf:f.audioConf,audioCandidateGap:f.audioCandidateGap,audioRunnerRpm:f.audioRunnerRpm,speedRpm:f.speedRpm,speedConf:f.speedConf,gpsAgeMs:gps.t?Math.max(0,Date.now()-gps.t):null,fusionRpm:f.rpm,fusionMode:f.fusionMode,slip:f.slip,agreement:f.agreement,motionMag:motion.mag||0,motionAgeMs:motion.t?Math.max(0,Date.now()-motion.t):null};\n");
 html=html.replace(/<script src=["']\.\/version\.js[^"']*["']><\/script>/i,`<script src="./version.js?v=${V}&build=${B}"></script>`);
 html=html.replace(/<link rel=["']manifest["'] href=["'][^"']+["']>/i,`<link rel="manifest" href="./manifest.webmanifest?v=${V}&build=${B}">`);
 html=html.replace('run=pre.slice();accelEnd=0;postMessage({type:"state",state:"AUTO RUN"})','run=pre.filter(x=>x.g>=cfg.autoSensitivity);accelEnd=0;postMessage({type:"state",state:"AUTO RUN"})');
 html=html.replace('if(recording){\n   run.push(s);','if(recording){\n   if(mode!=="auto"||g>=.03)run.push(s);');
 html=html.replace('if(data.length<12){postMessage({type:"state",state:"TOO SHORT"});return}','if(data.length<12){postMessage({type:"state",state:"TOO SHORT"});if(keepAuto)setTimeout(()=>postMessage({type:"state",state:"ARMED"}),250);return}');
 html=html.replace('$("armBtn").onclick=async e=>{if(!e.target.classList.contains("ib")){requestWake();if(!gpsOn)await startGPS();if($("rpmSourceMode").value!=="gps"&&!extMicOn)await startAudio();pushConfig();addLearningEvent("arm_auto");measurementWorker.postMessage({type:"arm"})}}','$("armBtn").onclick=async e=>{if(!e.target.classList.contains("ib")){measurementTrace=[];handleEngineState("ARMED");measurementWorker.postMessage({type:"arm"});requestWake();pushConfig();addLearningEvent("arm_auto");if(!gpsOn)await startGPS();if($("rpmSourceMode").value!=="gps"&&!extMicOn)await startAudio();pushConfig()}}');
 const tags=[];
 for(const n of MODULES){
   if(!new RegExp(`(?:\\/|\\.)${n}\\.js(?:[?"'])`).test(html))tags.push(`<script src="./${n}.js?v=${V}&build=${B}"></script>`);
 }
 if(!html.includes('motolabFullVersion')){
   html=html.replace('<body>',`<body><div id="motolabFullVersion" style="position:sticky;top:0;z-index:99990;text-align:center;padding:5px 8px;background:#08090b;border-bottom:1px solid #2b1419;color:#8f949c;font:800 8px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">VÄNÄ MotorLab ${LABEL} • ${BUILD}</div>`);
 }
 return tags.length?html.replace('</body>',tags.join('')+'</body>'):html;
}

async function freshIndex(){
 const r=await fetch(bust('index.html'),{cache:'no-store'});
 if(!r.ok)throw Error('index '+r.status);
 return new Response(inject(await r.text()),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate'}});
}

async function networkFirst(req){
 try{
   const r=await fetch(new Request(req,{cache:'reload'}));
   if(r.ok){const c=await caches.open(CACHE);c.put(req,r.clone()).catch(()=>{});}
   return r;
 }catch(e){
   const hit=await caches.match(req);
   if(hit)return hit;
   throw e;
 }
}

self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('notificationclick',e=>{
 e.notification.close();
 const target=e.notification?.data?.url||'./?adminUsers=1';
 e.waitUntil((async()=>{
  const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of list){
   try{if('navigate'in client)await client.navigate(target);await client.focus();return}catch{}
  }
  if(self.clients.openWindow)await self.clients.openWindow(target);
 })());
});
self.addEventListener('install',e=>{
 self.skipWaiting();
 e.waitUntil((async()=>{
   const c=await caches.open(CACHE);
   for(const u of CORE){
     try{const r=await fetch(new Request(u,{cache:'reload'}));if(r.ok)await c.put(u,r.clone())}catch{}
   }
   try{await c.put(bust('index.html'),await freshIndex())}catch{}
 })());
});
self.addEventListener('activate',e=>e.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(k=>k!==CACHE&&(k.startsWith('vana-motolab-')||k.startsWith('vana-motorlab-'))).map(k=>caches.delete(k)));
 await self.clients.claim();
 const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 for(const client of clients)client.postMessage({type:'MOTOLAB_SW_ACTIVE',build:BUILD});
})()));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url);
 if(u.origin!==location.origin)return;
 if(e.request.mode==='navigate'){
   e.respondWith(freshIndex().then(async r=>{const c=await caches.open(CACHE);await c.put(bust('index.html'),r.clone());return r}).catch(()=>caches.match(bust('index.html'))));
   return;
 }
 if(/\.(?:js|json|webmanifest|png|webp)$/.test(u.pathname)){
   e.respondWith(networkFirst(e.request));
   return;
 }
 e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request)));
});
