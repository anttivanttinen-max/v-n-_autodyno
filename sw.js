const CACHE="vana-motolab-v32-3-update-fix";
const VERSION="v32.3";
const CORE=["./manifest.webmanifest?v=32.3","./bike.png","./icon-192.png","./icon-512.png","./vehicle_lookup.js?v=32.3","./vehicle_catalog.json?v=32.3","./maintenance.js?v=32.3","./maintenance_catalog.json?v=32.3","./technical_specs.js?v=32.3","./gps_master_learning.js?v=32.3"];

function injectModules(html){
 const scripts=[];
 if(!html.includes("vehicle_lookup.js"))scripts.push('<script src="./vehicle_lookup.js?v=32.3"></script>');
 if(!html.includes("technical_specs.js"))scripts.push('<script src="./technical_specs.js?v=32.3"></script>');
 if(!html.includes("maintenance.js"))scripts.push('<script src="./maintenance.js?v=32.3"></script>');
 if(!html.includes("gps_master_learning.js"))scripts.push('<script src="./gps_master_learning.js?v=32.3"></script>');
 const banner='<style>#motolabFullVersion{position:sticky;top:0;z-index:99999;text-align:center;padding:7px 9px;background:#110508;border-bottom:1px solid #ff263f;color:#fff;font:800 11px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;letter-spacing:.2px}</style><div id="motolabFullVersion">VÄNÄ MotoLab v32.3 • build 2026-08-16</div><script>document.addEventListener("DOMContentLoaded",function(){var b=document.querySelector(".ver");if(b)b.textContent="v32.3";document.title="VÄNÄ MOTOLAB v32.3"})</script>';
 html=html.replace(/<link rel="manifest" href="manifest\.webmanifest(?:\?[^\"]*)?">/,'<link rel="manifest" href="manifest.webmanifest?v=32.3">');
 html=html.replace(/navigator\.serviceWorker\.register\("\.\/sw\.js\?v=31"\)/g,'navigator.serviceWorker.register("./sw.js?v=32.3",{updateViaCache:"none"})');
 if(!html.includes('motolabFullVersion'))html=html.replace('<body>','<body>'+banner);
 return scripts.length?html.replace("</body>",scripts.join("")+"</body>"):html;
}
async function cacheInjectedIndex(cache){const r=await fetch("./index.html?v=32.3",{cache:"no-store"});if(!r.ok)throw new Error("index "+r.status);const html=injectModules(await r.text());await cache.put("./index.html?v=32.3",new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache, no-store, must-revalidate"}}));}
self.addEventListener("message",event=>{if(event.data&&event.data.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("install",event=>{event.waitUntil((async()=>{const c=await caches.open(CACHE);for(const u of CORE){try{const req=new Request(u,{cache:"reload"});const r=await fetch(req);if(r.ok)await c.put(req,r.clone())}catch(e){}}await cacheInjectedIndex(c);await self.skipWaiting()})())});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith("vana-motolab-")).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;const url=new URL(event.request.url);if(url.origin!==location.origin)return;if(event.request.mode==="navigate"){event.respondWith((async()=>{try{const r=await fetch(event.request,{cache:"no-store"});if(!r.ok)throw new Error("navigation "+r.status);const html=injectModules(await r.text());const out=new Response(html,{status:r.status,statusText:r.statusText,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache, no-store, must-revalidate"}});const c=await caches.open(CACHE);await c.put("./index.html?v=32.3",out.clone());return out}catch(e){return(await caches.match("./index.html?v=32.3"))||Response.error()}})());return}const fresh=/\.(?:js|json|webmanifest)$/.test(url.pathname);if(fresh){event.respondWith(fetch(new Request(event.request,{cache:"reload"})).then(async r=>{if(r.ok){const c=await caches.open(CACHE);await c.put(event.request,r.clone())}return r}).catch(()=>caches.match(event.request)));return}event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy))}return r}))) });
