importScripts('./version.js?build=2026-08-18b-splash-run-analysis');
const VERSION=globalThis.MOTOLAB_RELEASE?.version||'34.7';
const LABEL=globalThis.MOTOLAB_RELEASE?.label||'v34.7 BETA';
const BUILD=globalThis.MOTOLAB_RELEASE?.build||'2026-08-18b-splash-run-analysis';
const V=encodeURIComponent(VERSION),B=encodeURIComponent(BUILD);
const CACHE='vana-motorlab-v34-rebuild-'+BUILD.replace(/[^a-z0-9]+/gi,'-');
const MODULES=[
 'splash_boot',
 'diagnostics','vehicle_catalog_finland_v2_loader','vehicle_lookup','technical_specs','maintenance',
 'gps_master_learning','raw_sync','dyno_curve_v2','ui_compact','default_dt','trip_research','research_sync',
 'user_identity','user_features','feedback','community','merit','beta_menu','beta_release',
 'mic_authority','sensor_persistence','sensor_autostart','admin_test_tools','phone_rpm_smart','adaptive_rpm_learning',
 'trip_phone_raw','trip_gear_guard','trip_gear_marker','live_status','live_status_guard',
 'motorlab_branding','simple_user_ui','v34_dashboard_ui','motorlab_i18n','run_analysis_v34'
];
const STATIC=['manifest.webmanifest','bike.png','icon-192.png','icon-512.png','rpm-learning-model.json','vehicle_catalog.json','maintenance_catalog.json','version.js','assets/motorlab_splash_approved.webp'];
const bust=p=>'./'+p+'?v='+V+'&build='+B;
const CORE=[...MODULES.map(n=>bust(n+'.js')),...STATIC.map(bust)];
const SPLASH=`<style id="motolabBootSplashStyle">
#motolabBootSplash{position:fixed;inset:0;z-index:1000000;background:#030304;color:#fff;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;opacity:1;transition:opacity .45s ease;isolation:isolate}
#motolabBootSplash.mls-out{opacity:0;pointer-events:none}
#motolabBootImage{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 48%;transform:translateZ(0);image-rendering:auto;filter:none}
#motolabBootSplash:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.04) 0%,rgba(0,0,0,.02) 48%,rgba(0,0,0,.58) 100%);pointer-events:none;z-index:1}
#motolabBootFallback{display:none;position:absolute;inset:0;z-index:0;background:radial-gradient(circle at 50% 25%,rgba(255,38,63,.16),transparent 34%),#030304;align-items:center;justify-content:center;text-align:center;font-weight:1000;font-style:italic;font-size:34px}#motolabBootFallback b{color:#ff263f}
#motolabBootSplash.mls-image-fallback #motolabBootFallback{display:flex}#motolabBootSplash.mls-image-fallback #motolabBootImage{display:none}
.mls-boot-bottom{position:absolute;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:3;width:min(90vw,430px);text-align:center}
.mls-boot-brand{font-size:12px;font-weight:1000;font-style:italic;letter-spacing:.02em;text-shadow:0 2px 10px #000}.mls-boot-brand b{color:#ff263f}
#motolabBootStatus{margin-top:7px;font-size:9px;font-weight:900;letter-spacing:.15em;color:#e9eaed;text-shadow:0 2px 8px #000}
.mls-loader{width:96px;height:3px;margin:11px auto 0;border-radius:99px;overflow:hidden;background:#ffffff22}.mls-loader:after{content:"";display:block;width:42%;height:100%;background:#ff263f;border-radius:99px;animation:mlsload 1.05s ease-in-out infinite alternate}@keyframes mlsload{from{transform:translateX(-10%)}to{transform:translateX(150%)}}
#motolabBootPanel{position:absolute;inset:calc(72px + env(safe-area-inset-top)) 12px calc(72px + env(safe-area-inset-bottom));z-index:4;display:flex;align-items:center;justify-content:center;pointer-events:none}
#motolabBootPanel.mls-panel-on{pointer-events:auto}
.mls-login{width:min(90vw,430px);max-height:72vh;overflow:auto;background:rgba(7,8,11,.92);backdrop-filter:blur(17px);-webkit-backdrop-filter:blur(17px);border:1px solid #ff263f;border-radius:22px;padding:16px 16px 14px;box-shadow:0 24px 70px #000d;text-align:left}
.mls-login-title{font-size:20px;font-weight:1000;font-style:italic}.mls-login-copy{margin:7px 0 11px;color:#c2c6cc;font-size:10px;line-height:1.45}.mls-login label{display:block;margin-top:8px;color:#aeb4bc;font-size:9px}.mls-login input{width:100%;margin-top:5px;padding:12px;border-radius:11px;border:1px solid #42464d;background:#050609;color:#fff;font-size:16px;outline:none}.mls-login input:focus{border-color:#ff263f;box-shadow:0 0 0 2px rgba(255,38,63,.15)}
.mls-login button{width:100%;min-height:52px;margin-top:9px;border-radius:12px;color:#fff;font-weight:1000;letter-spacing:.02em}.mls-primary{border:1px solid #ff263f;background:linear-gradient(#c81630,#8f0b1e)}.mls-secondary{border:1px solid #555b65;background:#17191e}.mls-ghost{border:1px solid #3b3f47;background:#0b0c0f;color:#d6d9dd!important}.mls-login button:disabled{opacity:.48}.mls-msg{min-height:18px;margin-top:9px;color:#d0d4da;font-size:9px;line-height:1.4;text-align:center}
@media (max-height:700px){.mls-login{max-height:66vh;padding:12px}.mls-login-copy{display:none}.mls-login button{min-height:46px}.mls-boot-bottom{bottom:calc(9px + env(safe-area-inset-bottom))}}
</style><div id="motolabBootSplash" role="status" aria-live="polite"><img id="motolabBootImage" src="./assets/motorlab_splash_approved.webp?v=${V}&build=${B}" alt="VäNä Motorsport MotorLab"><div id="motolabBootFallback">VÄNÄ&nbsp;<b>MotorLab</b></div><div id="motolabBootPanel"></div><div class="mls-boot-bottom"><div class="mls-boot-brand">VÄNÄ <b>MotorLab</b></div><div id="motolabBootStatus">LADATAAN MOTORLABIA…</div><div class="mls-loader"></div></div></div>`;
function inject(html){
 html=html.replace(/<script src=["']\.\/version\.js[^"']*["']><\/script>/i,`<script src="./version.js?v=${V}&build=${B}"></script>`);
 html=html.replace(/<link rel=["']manifest["'] href=["'][^"']+["']>/i,`<link rel="manifest" href="./manifest.webmanifest?v=${V}&build=${B}">`);
 // Do not regex-rewrite inline JavaScript. Splash is inserted as inert HTML only.
 if(!html.includes('motolabBootSplash'))html=html.replace('<body>','<body>'+SPLASH);
 const tags=[];for(const n of MODULES)if(!new RegExp(`(?:\\/|\\.)${n}\\.js(?:[?"'])`).test(html))tags.push(`<script src="./${n}.js?v=${V}&build=${B}"></script>`);
 if(!html.includes('motolabFullVersion'))html=html.replace('<body>',`<body><div id="motolabFullVersion" style="position:sticky;top:0;z-index:99990;text-align:center;padding:5px 8px;background:#08090b;border-bottom:1px solid #2b1419;color:#8f949c;font:800 8px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">VÄNÄ MotorLab ${LABEL} • ${BUILD}</div>`);
 return tags.length?html.replace('</body>',tags.join('')+'</body>'):html
}
async function freshIndex(){const r=await fetch(bust('index.html'),{cache:'no-store'});if(!r.ok)throw Error('index '+r.status);return new Response(inject(await r.text()),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})}
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil((async()=>{const c=await caches.open(CACHE);for(const u of CORE){try{const r=await fetch(new Request(u,{cache:'reload'}));if(r.ok)await c.put(u,r.clone())}catch{}}try{await c.put(bust('index.html'),await freshIndex())}catch{}})())});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('vana-motolab-')||k.startsWith('vana-motorlab-'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==location.origin)return;
 if(e.request.mode==='navigate'){e.respondWith(freshIndex().then(async r=>{const c=await caches.open(CACHE);await c.put(bust('index.html'),r.clone());return r}).catch(()=>caches.match(bust('index.html'))));return}
 if(/\.(?:js|json|webmanifest)$/.test(u.pathname)){e.respondWith(fetch(new Request(e.request,{cache:'reload'})).then(async r=>{if(r.ok)(await caches.open(CACHE)).put(e.request,r.clone());return r}).catch(()=>caches.match(e.request)));return}
 e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request)))
});
