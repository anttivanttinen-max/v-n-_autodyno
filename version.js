globalThis.MOTOLAB_RELEASE={version:"34.9",label:"v34.9 BETA",build:"2026-09-04-raw-sync-public-route-v1"};

(()=>{
 const OLD_RAW='https://motorlab-server.tail3764b7.ts.net/raw/api/users/v1/raw-chunk';
 const PUBLIC_RAW='https://v-n-autodyno-production.up.railway.app/api/users/v1/raw-chunk';
 const originalFetch=globalThis.fetch?.bind(globalThis);
 if(!originalFetch||globalThis.__MOTOLAB_RAW_PUBLIC_ROUTE_PATCHED)return;
 globalThis.__MOTOLAB_RAW_PUBLIC_ROUTE_PATCHED=true;
 globalThis.fetch=(input,init)=>{
  try{
   const url=typeof input==='string'?input:input?.url;
   if(url===OLD_RAW){
    if(typeof input==='string')return originalFetch(PUBLIC_RAW,init);
    return originalFetch(new Request(PUBLIC_RAW,input),init);
   }
  }catch{}
  return originalFetch(input,init);
 };
})();

window.addEventListener("DOMContentLoaded",()=>{
 const originalSuggestProfile=window.suggestProfile;
 if(typeof originalSuggestProfile!=="function")return;
 window.suggestProfile=function(r){
  const p=getCurrentProfile(),good=comparableRuns(p.id).filter(x=>x.id!==r.id).slice(0,5);
  if(!good.length)return;
  let ratioMismatch=false;
  if(r.gearRatioMedian&&p.gearRatios?.length){
   const err=Math.min(...p.gearRatios.map(g=>Math.abs(r.gearRatioMedian-g.ratio)/g.ratio));
   ratioMismatch=err>.14;
  }
  if(ratioMismatch)return originalSuggestProfile(r);
 };
});
