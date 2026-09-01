importScripts('./version.js?build=2026-09-01-gps-mic-fusion-v1');

const VERSION=globalThis.MOTOLAB_RELEASE?.version||'34.9';
const LABEL=globalThis.MOTOLAB_RELEASE?.label||'v34.9 BETA';
const BUILD=globalThis.MOTOLAB_RELEASE?.build||'2026-09-01-gps-mic-fusion-v1';
const V=encodeURIComponent(VERSION),B=encodeURIComponent(BUILD);
const CACHE='vana-motorlab-v34-9-i-'+BUILD.replace(/[^a-z0-9]+/gi,'-');

const MODULES=[
 'splash_boot',
 'diagnostics','vehicle_catalog_finland_v2_loader','vehicle_lookup','technical_specs','maintenance',
 'gps_master_learning','raw_sync','dyno_curve_v2','ui_compact','default_dt','trip_research','research_sync',
 'user_identity','auth_session_guard','admin_pending_notify','password_login','user_features','feedback','community','merit','beta_menu','beta_release',
 'mic_authority','sensor_persistence','sensor_autostart','admin_test_tools','phone_rpm_smart','adaptive_rpm_learning',
 'imu_autocal_v1','trip_phone_raw','trip_gear_guard','trip_gear_marker','live_status','live_status_guard',
 'motorlab_branding','simple_user_ui','v34_dashboard_ui','motorlab_i18n','run_analysis_v34','v34_runtime_fixes','raw_data_ui_light'
];
const STATIC=[
 'manifest.webmanifest','bike.png','icon-192.png','icon-512.png','rpm-learning-model.json',
 'vehicle_catalog.json','maintenance_catalog.json','version.js','assets/motolab-start-v34.png'
];
const bust=p=>'./'+p+'?v='+V+'&build='+B;
const CORE=[...MODULES.map(n=>bust(n+'.js')),...STATIC.map(bust)];

function inject(html){
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
