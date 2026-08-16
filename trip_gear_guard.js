(() => {
'use strict';
const MODULE='trip-gear-guard-v3';
const TARGET_GEAR=3;
const ENTER_TOL=.12, EXIT_TOL=.18;
const HOLD_MS=650;
const MANUAL_HOLD_MS=2500;
const MIN_KMH=10, MIN_RPM=1400;
const $g=id=>document.getElementById(id);
let state='unknown',pending=null,pendingAt=0,lastPaint='',manualThirdUntil=0;

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
 if(Date.now()<manualThirdUntil)return {kind:'manual',isThird:true,detectedGear:3,kmh,rpm,ratio3};
 if(appGear>0&&gearConf>=.65)return {kind:'gear',isThird:appGear===TARGET_GEAR,detectedGear:appGear,gearConf,kmh,rpm,ratio3};
 if(!(ratio3>0&&kmh>=MIN_KMH&&rpm>=MIN_RPM&&conf>=.35))return {kind:'none',isThird:null,kmh,rpm,conf,ratio3};
 const actual=rpm/kmh,err=Math.abs(actual-ratio3)/ratio3;
 if(state==='third')return {kind:'ratio',isThird:err<=EXIT_TOL,ratio3,actual,err,kmh,rpm,conf};
 return {kind:'ratio',isThird:err<=ENTER_TOL,ratio3,actual,err,kmh,rpm,conf};
}
function publish(ev){
 const payload={module:MODULE,state,gear3:state==='third',learningAllowed:state==='third',micDataAllowed:state==='third',t:Date.now(),evidence:ev||null};
 globalThis.MOTOLAB_TRIP_GEAR_GUARD=payload;
 try{globalThis.dispatchEvent(new CustomEvent('motolab-trip-gear-guard',{detail:payload}))}catch{}
}
function commit(next,ev){
 if(state===next){publish(ev);return}
 state=next;pending=null;pendingAt=0;publish(ev);
 try{if(typeof addLearningEvent==='function')addLearningEvent('trip_gear_guard_state',{module:MODULE,state,evidence:ev,micDataAllowed:state==='third'})}catch{}
 paint(ev);
}
function update(){
 if(!researchActive()){
   manualThirdUntil=0;
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
function confirmThird(){
 if(!researchActive())return;
 manualThirdUntil=Date.now()+MANUAL_HOLD_MS;
 const m=$g('manualGear');if(m){m.value='3';m.dispatchEvent(new Event('change',{bubbles:true}))}
 commit('third',{kind:'manual',isThird:true,detectedGear:3,confirmedAt:Date.now()});
 try{if(typeof addLearningEvent==='function')addLearningEvent('trip_gear3_manual_confirm',{module:MODULE})}catch{}
}
function ensureUi(){
 const panel=$g('tripResearchPanel');if(!panel||$g('tripGearGuardBox'))return !!panel;
 const box=document.createElement('div');box.id='tripGearGuardBox';box.className='statusbox';box.style.marginTop='8px';box.innerHTML=`<button id="tripGear3Confirm" class="action full" type="button" style="margin-bottom:7px">3. VAIHDE PÄÄLLÄ</button><div id="tripGearGuardStatus">3. vaihteen valvonta odottaa tutkimusajoa.</div>`;
 const st=$g('tripResearchStatus');if(st)st.insertAdjacentElement('beforebegin',box);else panel.appendChild(box);
 $g('tripGear3Confirm').onclick=confirmThird;
 const warn=document.createElement('div');warn.id='tripGearWarning';warn.style.cssText='display:none;position:sticky;top:34px;z-index:99998;padding:12px;margin:8px 0;border-radius:12px;background:#8d1018;color:#fff;text-align:center;font-weight:900;border:2px solid #ff4b59';warn.innerHTML='⚠️ VAIHDE VAIHTUI — MIKROFONIDATA TAUOLLA<br><span style="font-size:12px;font-weight:700">Vaihda takaisin 3. vaihteelle tai paina “3. VAIHDE PÄÄLLÄ”.</span>';
 panel.insertAdjacentElement('afterbegin',warn);
 return true
}
function paint(ev){
 ensureUi();const s=$g('tripGearGuardStatus'),b=$g('tripGear3Confirm'),w=$g('tripGearWarning');if(!s)return;
 let text='3. vaihteen valvonta odottaa tutkimusajoa.';
 if(researchActive()){
   if(state==='third')text='✅ 3. VAIHDE • mikrofonidata tallentuu';
   else if(state==='other')text='⚠️ VAIHDE VAIHTUI • mikrofonidata tauolla';
   else text='… TUNNISTETAAN VAIHDETTA';
   const e=ev||evidence();
   if(e?.kind==='manual')text+=' • vahvistettu napista';
   else if(e?.kind==='gear'&&e.detectedGear)text+=` • havaittu ${e.detectedGear}. vaihde`;
   else if(e?.kind==='ratio'&&Number.isFinite(e.err))text+=` • suhde-ero ${Math.round(e.err*100)} %`;
 }
 if(text!==lastPaint){s.textContent=text;lastPaint=text}
 if(b){b.classList.toggle('on',state==='third');b.textContent=state==='third'?'✅ 3. VAIHDE PÄÄLLÄ':'3. VAIHDE PÄÄLLÄ'}
 if(w)w.style.display=researchActive()&&state==='other'?'block':'none';
 publish(ev||null);
}
function patchLearning(){
 try{
  if(typeof collectLearningSample!=='function'||collectLearningSample.__tripGearGuardPatched)return false;
  const orig=collectLearningSample;
  const wrapped=function(s){
    const before=Array.isArray(learningBuffer)?learningBuffer.length:0,out=orig(s);
    try{if(researchActive()&&Array.isArray(learningBuffer)&&learningBuffer.length>before){const row=learningBuffer[learningBuffer.length-1],g=globalThis.MOTOLAB_TRIP_GEAR_GUARD||{};row.tripGearGuardState=g.state||'unknown';row.tripGear3Confirmed=g.state==='third';row.tripGearLearningAllowed=g.state==='third';row.tripMicDataAllowed=g.state==='third';if(g.state!=='third')row.micLearningEligible=false}}
    catch{}
    return out
  };
  wrapped.__tripGearGuardPatched=true;collectLearningSample=wrapped;return true
 }catch{return false}
}
function boot(){ensureUi();patchLearning();paint();setInterval(()=>{patchLearning();update()},200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
