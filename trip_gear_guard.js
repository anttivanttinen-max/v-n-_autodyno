(() => {
'use strict';
const MODULE='trip-gear-guard-v4';
const TARGET_GEAR=3;
const ENTER_TOL=.12, EXIT_TOL=.18;
const HOLD_MS=650;
const MANUAL_HOLD_MS=2500;
const MIN_KMH=10, MIN_RPM=1400;
const $g=id=>document.getElementById(id);
let state='unknown',pending=null,pendingAt=0,lastPaint='',manualGearUntil=0,manualGear=null;

function ui(){try{return typeof lastUi!=='undefined'&&lastUi?lastUi:{}}catch{return {}}}
function phone(){return globalThis.MOTOLAB_PHONE_RPM||{}}
function thirdRatio(){
 try{
  const a=typeof getGpsCalibrations==='function'?getGpsCalibrations():[];
  const c=(a||[]).find(x=>+x.gear===TARGET_GEAR&&+x.ratio>0);
  if(c)return +c.ratio;
 }catch{}
 try{
  const p=typeof getCurrentProfile==='function'?getCurrentProfile():null,d=p?.knowledge?.drivetrain||{};
  const primary=+d.primaryRatio,gr=+(Array.isArray(d.gearRatios)?d.gearRatios[TARGET_GEAR-1]:0),fr=+d.frontSprocket,rr=+d.rearSprocket,final=+d.finalRatio||(fr>0&&rr>0?rr/fr:0),circ=+d.wheelCircMm;
  if(primary>0&&gr>0&&final>0&&circ>0)return (16666.6666667/circ)*primary*gr*final;
 }catch{}
 return null
}
function researchActive(){return $g('tripResearchState')?.textContent?.trim()==='TALLENTAA'}
function evidence(){
 const u=ui(),p=phone(),kmh=+u.kmh||0,rpm=+p.rpm||0,conf=+p.conf||0,ratio3=thirdRatio();
 const appGear=+u.gear||0,gearConf=+u.gearConf||0;
 if(Date.now()<manualGearUntil&&manualGear)return {kind:'manual',isThird:manualGear===3,detectedGear:manualGear,kmh,rpm,ratio3};
 if(appGear>0&&gearConf>=.65)return {kind:'gear',isThird:appGear===TARGET_GEAR,detectedGear:appGear,gearConf,kmh,rpm,ratio3};
 if(!(ratio3>0&&kmh>=MIN_KMH&&rpm>=MIN_RPM&&conf>=.35))return {kind:'none',isThird:null,kmh,rpm,conf,ratio3};
 const actual=rpm/kmh,err=Math.abs(actual-ratio3)/ratio3;
 if(state==='third')return {kind:'ratio',isThird:err<=EXIT_TOL,ratio3,actual,err,kmh,rpm,conf};
 return {kind:'ratio',isThird:err<=ENTER_TOL,ratio3,actual,err,kmh,rpm,conf};
}
function publish(ev){
 const payload={module:MODULE,state,gear3:state==='third',learningAllowed:state==='third',micDataAllowed:true,t:Date.now(),evidence:ev||null,manualGear};
 globalThis.MOTOLAB_TRIP_GEAR_GUARD=payload;
 try{globalThis.dispatchEvent(new CustomEvent('motolab-trip-gear-guard',{detail:payload}))}catch{}
}
function commit(next,ev){
 if(state===next){publish(ev);return}
 state=next;pending=null;pendingAt=0;publish(ev);
 try{if(typeof addLearningEvent==='function')addLearningEvent('trip_gear_guard_state',{module:MODULE,state,evidence:ev,micDataAllowed:true})}catch{}
 paint(ev);
}
function update(){
 if(!researchActive()){
   manualGearUntil=0;manualGear=null;
   if(state!=='unknown')commit('unknown',{reason:'research_inactive'});
   paint();return;
 }
 const ev=evidence();
 if(ev.isThird==null){paint(ev);return}
 const next=ev.isThird?'third':'other',now=Date.now();
 if(next===state){pending=null;pendingAt=0;paint(ev);return}
 if(pending!==next){pending=next;pendingAt=now;paint(ev);return}
 if(now-pendingAt>=HOLD_MS)commit(next,ev);else paint(ev)
}
function confirmGear(gear){
 if(!researchActive())return;
 manualGear=gear;manualGearUntil=Date.now()+MANUAL_HOLD_MS;
 const next=gear===3?'third':'other';
 commit(next,{kind:'manual',isThird:gear===3,detectedGear:gear,confirmedAt:Date.now()});
 try{if(typeof addLearningEvent==='function')addLearningEvent('trip_gear_manual_confirm',{module:MODULE,gear})}catch{}
 paint();
}
function ensureUi(){
 const panel=$g('tripResearchPanel');if(!panel||$g('tripGearGuardBox'))return !!panel;
 const box=document.createElement('div');box.id='tripGearGuardBox';box.className='statusbox';box.style.marginTop='8px';box.innerHTML=`<div style="font-weight:900;margin-bottom:7px">VAIHDE-EPÄILY</div><div id="tripGearButtons" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px"><button id="tripGear2" class="action" type="button" style="font-size:26px;padding:18px 4px">2</button><button id="tripGear3" class="action" type="button" style="font-size:26px;padding:18px 4px">3</button><button id="tripGear4" class="action" type="button" style="font-size:26px;padding:18px 4px">4</button></div><div id="tripGearGuardStatus">Vaihteen tunnistus odottaa tutkimusajoa.</div>`;
 const st=$g('tripResearchStatus');if(st)st.insertAdjacentElement('beforebegin',box);else panel.appendChild(box);
 $g('tripGear2').onclick=()=>confirmGear(2);$g('tripGear3').onclick=()=>confirmGear(3);$g('tripGear4').onclick=()=>confirmGear(4);
 return true
}
function suspectedGear(ev){
 if(ev?.kind==='gear'&&[2,3,4].includes(+ev.detectedGear))return +ev.detectedGear;
 if(ev?.kind==='manual'&&[2,3,4].includes(+ev.detectedGear))return +ev.detectedGear;
 if(state==='third')return 3;
 return null;
}
function paint(ev){
 ensureUi();const s=$g('tripGearGuardStatus');if(!s)return;
 let text='Vaihteen tunnistus odottaa tutkimusajoa.';
 const e=ev||evidence(),sus=suspectedGear(e);
 if(researchActive()){
   if(e?.kind==='manual')text=`Vahvistettu: ${e.detectedGear}. vaihde`;
   else if(sus)text=`Sovellus epäilee: ${sus}. vaihde`;
   else text='Sovellus ei ole vielä varma vaihteesta.';
   if(e?.kind==='gear'&&Number.isFinite(e.gearConf))text+=` • ${Math.round(e.gearConf*100)} %`;
   else if(e?.kind==='ratio'&&Number.isFinite(e.err))text+=` • suhde-ero ${Math.round(e.err*100)} %`;
 }
 if(text!==lastPaint){s.textContent=text;lastPaint=text}
 for(const g of [2,3,4]){
   const b=$g('tripGear'+g);if(!b)continue;
   const isSus=sus===g&&e?.kind!=='manual';
   const isManual=manualGear===g&&Date.now()<manualGearUntil;
   b.style.background=isSus?'#a3131d':'';
   b.style.borderColor=isSus?'#ff4b59':'';
   b.style.boxShadow=isSus?'0 0 0 2px rgba(255,75,89,.25)':'';
   b.classList.toggle('on',isManual);
 }
 publish(e||null);
}
function patchLearning(){
 try{
  if(typeof collectLearningSample!=='function'||collectLearningSample.__tripGearGuardPatched)return false;
  const orig=collectLearningSample;
  const wrapped=function(s){
    const before=Array.isArray(learningBuffer)?learningBuffer.length:0,out=orig(s);
    try{if(researchActive()&&Array.isArray(learningBuffer)&&learningBuffer.length>before){const row=learningBuffer[learningBuffer.length-1],g=globalThis.MOTOLAB_TRIP_GEAR_GUARD||{};row.tripGearGuardState=g.state||'unknown';row.tripGear3Confirmed=g.state==='third';row.tripGearLearningAllowed=g.state==='third';row.tripMicDataAllowed=true;row.tripConfirmedGear=manualGear||null;row.tripDetectedGear=g.evidence?.detectedGear||null;if(g.state!=='third')row.micLearningEligible=false}}
    catch{}
    return out
  };
  wrapped.__tripGearGuardPatched=true;collectLearningSample=wrapped;return true
 }catch{return false}
}
function boot(){ensureUi();patchLearning();paint();setInterval(()=>{patchLearning();update()},200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
