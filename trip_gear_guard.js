(() => {
'use strict';
const MODULE='trip-gear-guard-v6';
const TARGET_GEAR=3;
const ENTER_TOL=.12, EXIT_TOL=.18;
const HOLD_MS=650;
const MANUAL_HOLD_MS=3500;
const MIN_KMH=10, MIN_RPM=1400;
const $g=id=>document.getElementById(id);
let state='unknown',pending=null,pendingAt=0,lastPaint='',manualGearUntil=0,manualGear=null;
let lastPromptKey='',lastPromptAt=0,promptOpen=false;

function ui(){try{return typeof lastUi!=='undefined'&&lastUi?lastUi:{}}catch{return {}}}
function phone(){return globalThis.MOTOLAB_PHONE_RPM||{}}
function thirdRatio(){
 try{const a=typeof getGpsCalibrations==='function'?getGpsCalibrations():[];const c=(a||[]).find(x=>+x.gear===TARGET_GEAR&&+x.ratio>0);if(c)return +c.ratio}catch{}
 try{const p=typeof getCurrentProfile==='function'?getCurrentProfile():null,d=p?.knowledge?.drivetrain||{};const primary=+d.primaryRatio,gr=+(Array.isArray(d.gearRatios)?d.gearRatios[TARGET_GEAR-1]:0),fr=+d.frontSprocket,rr=+d.rearSprocket,final=+d.finalRatio||(fr>0&&rr>0?rr/fr:0),circ=+d.wheelCircMm;if(primary>0&&gr>0&&final>0&&circ>0)return (16666.6666667/circ)*primary*gr*final}catch{}
 return null
}
function researchActive(){return $g('tripResearchState')?.textContent?.trim()==='TALLENTAA'}
function evidence(){
 const u=ui(),p=phone(),kmh=+u.kmh||0,rpm=+p.rpm||0,conf=+p.conf||0,ratio3=thirdRatio();const appGear=+u.gear||0,gearConf=+u.gearConf||0;
 if(Date.now()<manualGearUntil&&manualGear)return {kind:'manual',isThird:manualGear===3,detectedGear:manualGear,kmh,rpm,ratio3};
 if(appGear>0&&gearConf>=.65)return {kind:'gear',isThird:appGear===TARGET_GEAR,detectedGear:appGear,gearConf,kmh,rpm,ratio3};
 if(!(ratio3>0&&kmh>=MIN_KMH&&rpm>=MIN_RPM&&conf>=.35))return {kind:'none',isThird:null,kmh,rpm,conf,ratio3};
 const actual=rpm/kmh,err=Math.abs(actual-ratio3)/ratio3;
 if(state==='third')return {kind:'ratio',isThird:err<=EXIT_TOL,ratio3,actual,err,kmh,rpm,conf};
 return {kind:'ratio',isThird:err<=ENTER_TOL,ratio3,actual,err,kmh,rpm,conf};
}
function publish(ev){const payload={module:MODULE,state,gear3:state==='third',learningAllowed:state==='third',micDataAllowed:true,t:Date.now(),evidence:ev||null,manualGear};globalThis.MOTOLAB_TRIP_GEAR_GUARD=payload;try{globalThis.dispatchEvent(new CustomEvent('motolab-trip-gear-guard',{detail:payload}))}catch{}}
function suspectedGear(ev){if(ev?.kind==='gear'&&[2,3,4].includes(+ev.detectedGear))return +ev.detectedGear;if(ev?.kind==='manual'&&[2,3,4].includes(+ev.detectedGear))return +ev.detectedGear;if(state==='third')return 3;return null}
function styles(){if($g('tripGearPromptStyle'))return;const s=document.createElement('style');s.id='tripGearPromptStyle';s.textContent=`
#tripGearPrompt{position:fixed;inset:0;z-index:360000;background:rgba(0,0,0,.76);display:flex;align-items:center;justify-content:center;padding:calc(24px + env(safe-area-inset-top)) 18px calc(24px + env(safe-area-inset-bottom));box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}
#tripGearPrompt .tgp-card{width:min(92vw,430px);max-height:calc(100dvh - 72px - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow:auto;background:#0b0d11;border:2px solid #ff263f;border-radius:24px;padding:18px;box-shadow:0 24px 80px #000;color:#fff;text-align:center}
#tripGearPrompt h2{font-size:20px;margin:0 0 8px;font-style:italic}#tripGearPrompt p{margin:0 0 14px;color:#c5c9cf;font-size:11px;line-height:1.45}
.tgp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.tgp-btn{min-height:92px;border-radius:17px;border:2px solid #555b64;background:#2a2d33;color:#fff;font-size:36px;font-weight:1000;transition:.12s transform,.12s background,.12s border-color}.tgp-btn:active{transform:scale(.97)}.tgp-btn.suspect{background:#9e111e;border-color:#ff4a5c;box-shadow:0 0 0 3px rgba(255,54,73,.18)}.tgp-btn.confirmed{background:#126b2a;border-color:#4ff072;box-shadow:0 0 0 3px rgba(79,240,114,.18)}
.tgp-note{margin-top:12px;color:#9098a3;font-size:9px}.tgp-close{width:100%;min-height:48px;margin-top:12px;border-radius:12px;border:1px solid #4b5058;background:#15181d;color:#fff;font-weight:900}
@media(max-width:360px){.tgp-grid{gap:7px}.tgp-btn{min-height:80px;font-size:31px}}
`;document.head.appendChild(s)}
function closePrompt(){const o=$g('tripGearPrompt');o?.remove();promptOpen=false}
function promptGear(sus,ev,force=false){
 if(![2,3,4].includes(+sus))return;if(!force&&!researchActive())return;const key=`${state}:${sus}`;if(!force&&(promptOpen||(key===lastPromptKey&&Date.now()-lastPromptAt<5000)))return;
 styles();closePrompt();promptOpen=true;lastPromptKey=key;lastPromptAt=Date.now();const o=document.createElement('div');o.id='tripGearPrompt';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.innerHTML=`<div class="tgp-card"><h2>VAIHTEEN VAIHTO HAVAITTU</h2><p>Sovellus epäilee <b>${sus}. vaihdetta</b>. Vahvista oikea vaihde.</p><div class="tgp-grid">${[2,3,4].map(g=>`<button type="button" class="tgp-btn ${g===sus?'suspect':''}" data-gear="${g}">${g}</button>`).join('')}</div><div class="tgp-note">HARMAA = vaihtoehto • PUNAINEN = sovelluksen epäily • VIHREÄ = vahvistettu</div><button class="tgp-close" type="button">JATKA ILMAN VAHVISTUSTA</button></div>`;document.body.appendChild(o);
 o.querySelector('.tgp-close').onclick=closePrompt;o.querySelectorAll('[data-gear]').forEach(b=>b.onclick=()=>{const g=+b.dataset.gear;o.querySelectorAll('[data-gear]').forEach(x=>x.classList.remove('confirmed'));b.classList.add('confirmed');confirmGear(g);setTimeout(closePrompt,420)});
 try{globalThis.MOTOLAB_DIAGNOSTICS?.record?.('gear_prompt_opened',{suspectedGear:sus,state,module:MODULE,evidence:ev||null})}catch{}
}
function maybePrompt(prev,next,ev){
 const sus=suspectedGear(ev);if(!sus||ev?.kind==='manual')return;
 if(prev!=='unknown'&&prev!==next)promptGear(sus,ev);
 else if(ev?.kind==='gear'&&sus!==TARGET_GEAR&&state!=='other')promptGear(sus,ev);
}
function commit(next,ev){const prev=state;if(state===next){publish(ev);return}state=next;pending=null;pendingAt=0;publish(ev);try{if(typeof addLearningEvent==='function')addLearningEvent('trip_gear_guard_state',{module:MODULE,state,evidence:ev,micDataAllowed:true})}catch{}paint(ev);maybePrompt(prev,next,ev)}
function update(){
 if(!researchActive()){manualGearUntil=0;manualGear=null;if(state!=='unknown')commit('unknown',{reason:'research_inactive'});paint();return}
 const ev=evidence();if(ev.isThird==null){paint(ev);return}const next=ev.isThird?'third':'other',now=Date.now();if(next===state){pending=null;pendingAt=0;paint(ev);return}if(pending!==next){pending=next;pendingAt=now;paint(ev);return}if(now-pendingAt>=HOLD_MS)commit(next,ev);else paint(ev)
}
function confirmGear(gear){
 gear=+gear;if(![2,3,4].includes(gear))return;manualGear=gear;manualGearUntil=Date.now()+MANUAL_HOLD_MS;const next=gear===3?'third':'other';const t=Date.now();globalThis.MOTOLAB_CONFIRMED_GEAR={gear,t,origin:'user_confirmed'};commit(next,{kind:'manual',isThird:gear===3,detectedGear:gear,confirmedAt:t});try{if(typeof addLearningEvent==='function')addLearningEvent('trip_gear_manual_confirm',{module:MODULE,gear})}catch{}try{globalThis.dispatchEvent(new CustomEvent('motolab-gear-confirmed',{detail:{gear,t,origin:'user_confirmed',module:MODULE}}))}catch{}paint()
}
function ensureUi(){
 const panel=$g('tripResearchPanel');if(!panel||$g('tripGearGuardBox'))return !!panel;const box=document.createElement('div');box.id='tripGearGuardBox';box.className='statusbox';box.style.marginTop='8px';box.innerHTML=`<div style="font-weight:900;margin-bottom:5px">VAIHDEVAHTI</div><div id="tripGearGuardStatus">Vaihteen tunnistus odottaa tutkimusajoa.</div><div style="margin-top:5px;color:#8f969f;font-size:8px">Kun vaihteen vaihtoa epäillään, vahvistus avautuu keskelle näyttöä.</div>`;const st=$g('tripResearchStatus');if(st)st.insertAdjacentElement('beforebegin',box);else panel.appendChild(box);return true
}
function paint(ev){ensureUi();const s=$g('tripGearGuardStatus');if(!s)return;let text='Vaihteen tunnistus odottaa tutkimusajoa.';const e=ev||evidence(),sus=suspectedGear(e);if(researchActive()){if(e?.kind==='manual')text=`Vahvistettu: ${e.detectedGear}. vaihde`;else if(sus)text=`Sovellus seuraa: ${sus}. vaihde`;else text='Sovellus ei ole vielä varma vaihteesta.';if(e?.kind==='gear'&&Number.isFinite(e.gearConf))text+=` • ${Math.round(e.gearConf*100)} %`;else if(e?.kind==='ratio'&&Number.isFinite(e.err))text+=` • suhde-ero ${Math.round(e.err*100)} %`}if(text!==lastPaint){s.textContent=text;lastPaint=text}publish(e||null)}
function patchLearning(){
 try{if(typeof collectLearningSample!=='function'||collectLearningSample.__tripGearGuardPatched)return false;const orig=collectLearningSample;const wrapped=function(s){const before=Array.isArray(learningBuffer)?learningBuffer.length:0,out=orig(s);try{if(researchActive()&&Array.isArray(learningBuffer)&&learningBuffer.length>before){const row=learningBuffer[learningBuffer.length-1],g=globalThis.MOTOLAB_TRIP_GEAR_GUARD||{};row.tripGearGuardState=g.state||'unknown';row.tripGear3Confirmed=g.state==='third';row.tripGearLearningAllowed=g.state==='third';row.tripMicDataAllowed=true;row.tripConfirmedGear=manualGear||null;row.tripDetectedGear=g.evidence?.detectedGear||null;if(g.state!=='third')row.micLearningEligible=false}}catch{}return out};wrapped.__tripGearGuardPatched=true;collectLearningSample=wrapped;return true}catch{return false}
}
function boot(){ensureUi();styles();patchLearning();paint();setInterval(()=>{patchLearning();update()},200)}
globalThis.MotoLabTripGearGuard={version:MODULE,confirm:confirmGear,testPrompt:g=>promptGear(+g||3,{kind:'test',detectedGear:+g||3},true),closePrompt};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
