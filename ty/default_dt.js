(() => {
'use strict';
const MODULE_VERSION='v32-default-dt-1.0';
const PROFILE_KEY='motolab_v26_profile';
const DT_ID='p1';
const DT_NAME='Yamaha DT125R OMA DT / VÄNÄ Athena 170 – nykyinen kokoonpano';

function dtProfile(){
 return {
  id:DT_ID,
  name:DT_NAME,
  engineType:'2T',
  gearRatios:[],
  gpsCalibrations:[{gear:3,rpm:6000,kmh:46.7,ratio:128.4796573875803,mode:'MANUAL'}],
  carb:{mainJet:165,pilotJet:45,needleType:'X7',needleClip:'3',airScrew:1.5,slide:40},
  baselineHp:null,
  knowledge:{
   schema:'vehicle_engine_kb_v1',
   engine:{displacementCc:170,cylinders:1,boreMm:65,strokeMm:50.7,cylinderKit:'Athena 170 cc',squishMm:0.8,chamberCc:12.7},
   intake:{carbSizeMm:34},
   exhaust:{system:'Athena'},
   ignition:{controller:'Zeeltronic'},
   drivetrain:{frontSprocket:16,rearSprocket:57,wheelCircMm:null},
   setupTag:'OMA DT / VÄNÄ Athena 170',
   notes:'Oma Yamaha DT125R / Athena 170. Sylinteriä ei ole nostettu. Mäntä noin 0,15 mm yli deckin. Sorvattu kansi.'
  }
 };
}

function boot(){
 try{
  if(typeof getProfiles!=='function'||typeof setProfiles!=='function')return;
  const hasStoredProfiles=!!localStorage.getItem(typeof PROFILES_KEY==='string'?PROFILES_KEY:'motolab_v26_profiles');
  let ps=getProfiles();
  let dt=ps.find(p=>/yamaha.*dt125|dt125.*athena|oma dt/i.test(String(p?.name||'')));
  if(!hasStoredProfiles){
   const p=typeof normalizeProfile==='function'?normalizeProfile(dtProfile()):dtProfile();
   setProfiles([p]);ps=[p];dt=p;
  }
  if(dt){
   localStorage.setItem(PROFILE_KEY,dt.id);
   if(typeof renderProfiles==='function')renderProfiles();
   if(typeof pushConfig==='function')pushConfig();
   window.dispatchEvent(new CustomEvent('motolab:profile-updated',{detail:{profileId:dt.id,startupDefault:true,module:MODULE_VERSION}}));
  }
 }catch(e){console.warn('MotoLab default DT:',e)}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
window.MotoLabDefaultDT={version:MODULE_VERSION,name:DT_NAME};
})();
