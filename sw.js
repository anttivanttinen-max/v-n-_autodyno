importScripts("./version.js?build=2026-08-16u-phone-raw");
const VERSION=globalThis.MOTOLAB_RELEASE?.version||"32.5";
const VERSION_LABEL=globalThis.MOTOLAB_RELEASE?.label||("v"+VERSION);
const BUILD=globalThis.MOTOLAB_RELEASE?.build||"2026-08-16u-phone-raw";
const V=encodeURIComponent(VERSION);
const B=encodeURIComponent(BUILD);
const CACHE="vana-motolab-"+VERSION.replace(/[^a-z0-9]+/gi,"-")+"-"+BUILD.replace(/[^a-z0-9]+/gi,"-");
const CORE=["./manifest.webmanifest","./bike.png","./icon-192.png","./icon-512.png","./vehicle_lookup.js","./vehicle_catalog.json","./maintenance.js","./maintenance_catalog.json","./technical_specs.js","./gps_master_learning.js","./raw_sync.js","./dyno_curve_v2.js","./ui_compact.js","./default_dt.js","./trip_research.js","./research_sync.js","./beta_release.js","./sensor_persistence.js","./sensor_autostart.js","./phone_rpm_smart.js","./adaptive_rpm_learning.js","./trip_phone_raw.js","./rpm-learning-model.json","./version.js"].map(u=>/\.(?:js|json|webmanifest)$/.test(u)?u+"?v="+V+"&build="+B:u);

function injectModules(html){
 const scripts=[];
 if(!html.includes("vehicle_lookup.js"))scripts.push('<script src="./vehicle_lookup.js?v='+V+'&build='+B+'"></script>');
 if(!html.includes("technical_specs.js"))scripts.push('<script src="./technical_specs.js?v='+V+'&build='+B+'"></script>');
 if(!html.includes("maintenance.js"))scripts.push('<script src="./maintenance.js?v='+V+'&build='+B+'"></script>');
 if(!html.includes("gps_master_learning.js"))scripts.push('<script src="./gps_master_learning.js?v='+V+'&build='+B+'"></script>');
 if(!html.includes("raw_sync.js"))scripts.push('<script src="./raw_sync.js?v='+V+'&build='+B+'"></script>');
 if(!html.includes("dyno_curve_v2.js"))scripts.push('<script src="./dyno_curve_v2.js?v='+V+'&build='+B+'"></script>');
 if(!html.includes("ui_compact.js"))scripts.push('<script src="./ui_compact.js?v='+V+'&build='+B+'"></script>');
 if(!html.includes("default_dt.js"))scripts.push('<script src="./default_dt.js?v='+V+'&build='+B+'"></script>');
 if(!html.includes("trip_research.js"))scripts.push('<script src="./trip_research.js?v='+V+'&build='+B+'"></script>');
 if(!html.includes("research_sync.js"))scripts.push('<script src="./research_sync.js?v='+V+'&build='+B+'"></script>');
 if(!html.includes("beta_release.js"))scripts.push('<script src="./beta_release.js?v='+V+'&build='+B+'"></script>');
 if(!html.includes("sensor_persistence.js"))scripts.push('<script src="./sensor_persistence.js?v='+V+'&build='+B+'"></script>');
 if(!html.includes("sensor_autostart.js"))scripts.push('<script src="./sensor_autostart.js?v='+V+'&build='+B+'"></script>');
 if(!html.includes("phone_rpm_smart.js"))scripts.push('<script src="./phone_rpm_smart.js?v='+V+'&build='+B+'"></script>');
 if(!html.includes("adaptive_rpm_learning.js"))scripts.push('<script src="./adaptive_rpm_learning.js?v='+V+'&build='+B+'"></script>');
 if(!html.includes("trip_phone_raw.js"))scripts.push('<script src="./trip_phone_raw.js?v='+V+'&build='+B+'"></script>');
 const banner='<style>#motolabFullVersion{position:sticky;top:0;z-index:99999;text-align:center;padding:7px 9px;background:#110508;border-bottom:1px solid #ff263f;color:#fff;font:800 11px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;letter-spacing:.2px}</style><div id="motolabFullVersion">VÄNÄ MotoLab '+VERSION_LABEL+' • build '+BUILD+'</div><script>document.addEventListener("DOMContentLoaded",function(){var b=document.querySelector(".ver");if(b)b.textContent="'+VERSION_LABEL+'";document.title="VÄNÄ MOTOLAB '+VERSION_LABEL+'"})</script>';
 html=html.replace(/<link rel="manifest" href="manifest\.webmanifest(?:\?[^\"]*)?">/,'<link rel="manifest" href="manifest.webmanifest?v='+V+'&build='+B+'">');
 html=html.replace(/navigator\.serviceWorker\.register\("\.\/sw\.js\?[^"]*"(?:,\{[^}]*\})?\)/g,'navigator.serviceWorker.register("./sw.js?build='+BUILD+'",{updateViaCache:"none"})');
 html=html.replace(/<script src="\.\/(vehicle_lookup|technical_specs|maintenance|gps_master_learning|raw_sync|dyno_curve_v2|ui_compact|default_dt|trip_research|research_sync|beta_release|sensor_persistence|sensor_autostart|phone_rpm_smart|adaptive_rpm_learning|trip_phone_raw)\.js(?:\?[^\"]*)?"><\/script>/g,(m,n)=>'<script src="./'+n+'.js?v='+V+'&build='+B+'"></script>');
 if(!html.includes('motolabFullVersion'))html=html.replace('<body>','<body>'+banner);
 return scripts.length?html.replace("</body>",scripts.join("")+"</body>"):html;
}
async function cacheInjectedIndex(cache){const r=await fetch("./index.html?v="+V+"&build="+B,{cache:"no-store"});if(!r.ok)throw new Error("index "+r.status);const html=injectModules(await r.text());await cache.put("./index.html?v="+V+"&build="+B,new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache, no-store, must-revalidate"}}));}
self.addEventListener("message",event=>{if(event.data&&event.data.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("install",event=>{event.waitUntil((async()=>{const c=await caches.open(CACHE);for(const u of CORE){try{const req=new Request(u,{cache:"reload"});const r=await fetch(req);if(r.ok)await c.put(req,r.clone())}catch(e){}}await cacheInjectedIndex(c)})())});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith("vana-motolab-")).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;const url=new URL(event.request.url);if(url.origin!==location.origin)return;if(event.request.mode==="navigate"){event.respondWith((async()=>{try{const r=await fetch(event.request,{cache:"no-store"});if(!r.ok)throw new Error("navigation "+r.status);const html=injectModules(await r.text());const out=new Response(html,{status:r.status,statusText:r.statusText,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache, no-store, must-revalidate"}});const c=await caches.open(CACHE);await c.put("./index.html?v="+V+"&build="+B,out.clone());return out}catch(e){return(await caches.match("./index.html?v="+V+"&build="+B))||Response.error()}})());return}const fresh=/\.(?:js|json|webmanifest)$/.test(url.pathname);if(fresh){event.respondWith(fetch(new Request(event.request,{cache:"reload"})).then(async r=>{if(r.ok){const c=await caches.open(CACHE);await c.put(event.request,r.clone())}return r}).catch(()=>caches.match(event.request)));return}event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy))}return r}))) });
