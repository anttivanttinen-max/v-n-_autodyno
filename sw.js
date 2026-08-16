const CACHE="vana-motolab-v32-gps-master-mic-learn";
const CORE=["./manifest.webmanifest","./bike.png","./icon-192.png","./icon-512.png","./vehicle_lookup.js","./vehicle_catalog.json","./maintenance.js","./maintenance_catalog.json","./technical_specs.js","./gps_master_learning.js"];

function injectModules(html){
 const scripts=[];
 if(!html.includes("vehicle_lookup.js"))scripts.push('<script src="./vehicle_lookup.js?v=32.2"></script>');
 if(!html.includes("technical_specs.js"))scripts.push('<script src="./technical_specs.js?v=32.1"></script>');
 if(!html.includes("maintenance.js"))scripts.push('<script src="./maintenance.js?v=32.1"></script>');
 if(!html.includes("gps_master_learning.js"))scripts.push('<script src="./gps_master_learning.js?v=32.1"></script>');
 return scripts.length?html.replace("</body>",scripts.join("")+"</body>"):html;
}
async function cacheInjectedIndex(cache){const r=await fetch("./index.html",{cache:"no-store"});if(!r.ok)throw new Error("index "+r.status);const html=injectModules(await r.text());await cache.put("./index.html",new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}}));}
self.addEventListener("install",event=>{event.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(CORE);await cacheInjectedIndex(c);await self.skipWaiting()})())});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith("vana-motolab-")).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;const url=new URL(event.request.url);if(url.origin!==location.origin)return;if(event.request.mode==="navigate"){event.respondWith((async()=>{try{const r=await fetch(event.request,{cache:"no-store"});if(!r.ok)throw new Error("navigation "+r.status);const html=injectModules(await r.text());const out=new Response(html,{status:r.status,statusText:r.statusText,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}});const c=await caches.open(CACHE);await c.put("./index.html",out.clone());return out}catch(e){return(await caches.match("./index.html"))||Response.error()}})());return}event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy))}return r}))) });