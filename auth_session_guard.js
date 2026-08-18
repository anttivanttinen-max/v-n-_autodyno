(() => {
'use strict';
const VERSION='motolab-auth-session-guard-v1';
let installed=false,recovery=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function install(){
 const api=globalThis.MotoLabUser;
 if(!api||installed||typeof api.refresh!=='function')return false;
 const original=api.refresh.bind(api);
 async function guardedRefresh(){
  if(recovery)return recovery;
  recovery=(async()=>{
   let u=await original();
   if(u)return u;
   await sleep(300);
   u=await original();
   if(u)return u;
   await sleep(900);
   return await original();
  })().finally(()=>{recovery=null});
  return recovery;
 }
 api.refresh=guardedRefresh;
 installed=true;
 if(localStorage.getItem('motolab_v32_beta_token')&&!api.user){
  setTimeout(()=>guardedRefresh().catch(()=>{}),0);
 }
 return true;
}

if(!install()){
 let tries=0;
 const t=setInterval(()=>{if(install()||++tries>80)clearInterval(t)},100);
}
globalThis.MotoLabAuthSessionGuard={version:VERSION,install};
})();
