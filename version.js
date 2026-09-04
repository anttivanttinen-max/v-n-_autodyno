globalThis.MOTOLAB_RELEASE={version:"34.9",label:"v34.9 BETA",build:"2026-09-04-raw-ui-touch-fix-v5"};

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