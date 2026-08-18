(() => {
'use strict';
const MODULE='motolab-admin-test-tools-v2';
const AUDIO_KEY='motolab_admin_audio_device';
const HOLD_MS=2000;
const DB='VanaMotoLabResearch',VER=1,STORE='timelineChunks';
let nativeGum=null,gumWrapped=false,gearSeq=0,lastGuard=null,otherSince=0,lastOtherGear=null,suppressedGear=null;
const $=id=>document.getElementById(id);
function isAdmin(){try{return globalThis.MotoLabUser?.user?.role==='admin'&&globalThis.MotoLabUser?.user?.status==='active'}catch{return false}}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function selectedDevice(){return localStorage.getItem(AUDIO_KEY)||''}
function log(type,data={}){try{if(typeof addLearningEvent==='function')addLearningEvent(type,{module:MODULE,...data})}catch{}}
function installGumGuard(){
 if(gumWrapped||!navigator.mediaDevices?.getUserMedia)return;
 nativeGum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
 const wrapped=async constraints=>{
   let c=constraints;
   try{
     const id=selectedDevice();
     if(isAdmin()&&id&&constraints?.audio){
       const a=constraints.audio===true?{}:{...(constraints.audio||{})};
       a.deviceId={exact:id};c={...constraints,audio:a};
       log('admin_audio_source_applied',{deviceId:id});
     }
   }catch{}
   return nativeGum(c);
 };
 try{navigator.mediaDevices.getUserMedia=wrapped;gumWrapped=true}catch{}
}
async function enumerateInputs(requestLabels=false){
 if(!navigator.mediaDevices?.enumerateDevices)return [];
 let ds=await navigator.mediaDevices.enumerateDevices();
 let ins=ds.filter(d=>d.kind==='audioinput');
 if(requestLabels&&ins.length&&!ins.some(d=>d.label)&&nativeGum){
   try{const s=await nativeGum({audio:true});s.getTracks().forEach(t=>t.stop());ds=await navigator.mediaDevices.enumerateDevices();ins=ds.filter(d=>d.kind==='audioinput')}catch{}
 }
 return ins;
}
function ensureAudioUi(){
 if(!isAdmin()){$('motolabAdminAudioBox')?.remove();return false}
 const route=$('btRouteStatus');if(!route)return false;
 if($('motolabAdminAudioBox'))return true;
 const box=document.createElement('div');box.id='motolabAdminAudioBox';box.className='statusbox';box.style.cssText='margin-top:8px;border-color:#7b2530';
 box.innerHTML='<div style="font-weight:900;margin-bottom:6px">ADMIN • AUDIOLÄHDE</div><div style="font-size:9px;color:#aaa;margin-bottom:7px">Vain ylläpidolle. Tavallinen käyttäjä käyttää puhelimen oletusmikrofonia.</div><select id="motolabAdminAudioSelect" style="width:100%;margin-bottom:7px"></select><button id="motolabAdminAudioRefresh" class="action" type="button" style="width:100%">PÄIVITÄ LÄHTEET</button><div id="motolabAdminAudioState" style="font-size:9px;margin-top:7px;color:#bbb"></div>';
 route.insertAdjacentElement('afterend',box);
 $('motolabAdminAudioRefresh').onclick=()=>refreshAudioUi(true);
 $('motolabAdminAudioSelect').onchange=async e=>{
   const id=e.target.value||'';localStorage.setItem(AUDIO_KEY,id);log('admin_audio_source_selected',{deviceId:id||'default'});
   const wasWanted=!!globalThis.MotoLabMicAuthority?.desired;
   if(wasWanted&&globalThis.MotoLabMicAuthority){await globalThis.MotoLabMicAuthority.off('admin-audio-source-change');await globalThis.MotoLabMicAuthority.on('admin-audio-source-change')}
   refreshAudioUi(false);
 };
 refreshAudioUi(false);return true;
}
async function refreshAudioUi(requestLabels=false){
 const sel=$('motolabAdminAudioSelect'),st=$('motolabAdminAudioState');if(!sel||!isAdmin())return;
 const ins=await enumerateInputs(requestLabels),chosen=selectedDevice();
 sel.innerHTML='<option value="">JÄRJESTELMÄN OLETUS</option>'+ins.map((d,i)=>`<option value="${esc(d.deviceId)}">${esc(d.label||('Mikrofoni '+(i+1)))}</option>`).join('');
 if([...sel.options].some(o=>o.value===chosen))sel.value=chosen;else if(chosen){localStorage.removeItem(AUDIO_KEY);sel.value=''}
 const live=globalThis.audioSessions?.ext?.track||globalThis.audioSessions?.ext?.stream?.getAudioTracks?.()[0];
 if(st)st.textContent='Valittu: '+(sel.options[sel.selectedIndex]?.textContent||'oletus')+(live?.label?' • aktiivinen: '+live.label:'');
}
function researchActive(){return $('tripResearchState')?.textContent?.trim()==='TALLENTAA'}
function ensureGearUi(){
 if(!researchActive()){$('motolabGearTestFloat')?.remove();return false}
 if($('motolabGearTestFloat'))return true;
 const box=document.createElement('div');box.id='motolabGearTestFloat';box.style.cssText='position:fixed;right:10px;top:calc(54px + env(safe-area-inset-top));z-index:180000;width:min(310px,calc(100vw - 20px));background:#0b0c0ff2;border:1px solid #ff263f;border-radius:14px;padding:10px;color:#fff;box-shadow:0 10px 35px #000;font:800 10px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
 box.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>3. VAIHTEEN TESTI</b><span id="motolabGearTestState" style="color:#aaa">ODOTTAA</span></div><div id="motolabGearQuestion" style="display:none;margin-top:9px;border-top:1px solid #333;padding-top:9px"><div style="font-size:13px;margin-bottom:8px">MIKÄ VAIHDE KÄYTÖSSÄ?</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px"><button data-mgear="2" class="action" type="button">2</button><button data-mgear="3" class="action" type="button">3</button><button data-mgear="4" class="action" type="button">4</button></div><button id="motolabGearSkip" class="action" type="button" style="width:100%;margin-top:6px">OHITA</button><div id="motolabGearHint" style="font-size:8px;color:#aaa;margin-top:6px"></div></div>';
 document.body.appendChild(box);
 box.querySelectorAll('[data-mgear]').forEach(b=>b.onclick=()=>confirmGear(+b.dataset.mgear));
 $('motolabGearSkip').onclick=skipGear;return true;
}
function detectedOtherGear(g){const n=+g?.evidence?.detectedGear||0;return n===2||n===4?n:null}
function paintGear(){
 if(!ensureGearUi())return;
 const state=$('motolabGearTestState'),q=$('motolabGearQuestion'),hint=$('motolabGearHint');const g=lastGuard||globalThis.MOTOLAB_TRIP_GEAR_GUARD||{};const now=Date.now();
 if(g.state==='third'){
   otherSince=0;lastOtherGear=null;suppressedGear=null;if(q)q.style.display='none';if(state){state.textContent='3. VAIHDE';state.style.color='#7ee787'};return;
 }
 const candidate=detectedOtherGear(g);
 if(candidate){
   if(lastOtherGear!==candidate){lastOtherGear=candidate;otherSince=now;suppressedGear=null}
   if(!otherSince)otherSince=now;
   const elapsed=now-otherSince,remain=Math.max(0,HOLD_MS-elapsed);
   if(state){state.textContent=elapsed>=HOLD_MS?candidate+'. VAIHDE?':'VAHVISTETAAN '+candidate+'. • '+(remain/1000).toFixed(1)+' s';state.style.color='#ffb86b'}
   if(q)q.style.display=(elapsed>=HOLD_MS&&suppressedGear!==candidate)?'block':'none';
   if(hint)hint.textContent='Sovellus epäilee '+candidate+'. vaihdetta • kysely avautuu vasta 2 s yhtäjaksoisen havainnon jälkeen.';
 }else{
   otherSince=0;lastOtherGear=null;if(q)q.style.display='none';if(state){state.textContent=g.state==='other'?'VAIHDE POIKKEAA':'ODOTTAA';state.style.color='#aaa'}
 }
}
function skipGear(){const cand=detectedOtherGear(lastGuard||globalThis.MOTOLAB_TRIP_GEAR_GUARD||{});suppressedGear=cand||lastOtherGear||-1;$('motolabGearQuestion')?.style.setProperty('display','none');log('trip_gear_question_skipped',{suspectedGear:cand});}
async function confirmGear(gear){
 const g=lastGuard||globalThis.MOTOLAB_TRIP_GEAR_GUARD||{};suppressedGear=detectedOtherGear(g)||lastOtherGear||-1;
 const detail={gear,at:Date.now(),suspectedGear:detectedOtherGear(g),guardState:g.state||'unknown',evidence:g.evidence||null,source:'manual_reference'};
 globalThis.MOTOLAB_TRIP_MANUAL_GEAR_REFERENCE=detail;window.dispatchEvent(new CustomEvent('motolab-trip-gear-reference',{detail}));log('trip_gear_manual_reference',detail);writeMarker(detail).catch(()=>{});$('motolabGearQuestion')?.style.setProperty('display','none');
 const st=$('motolabGearTestState');if(st){st.textContent='VAHVISTETTU '+gear+'.';st.style.color='#7ee787'}
}
function reqP(r){return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function txDone(tx){return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||new Error('abort'))})}
async function openDb(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,VER);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function writeMarker(detail){const d=await openDb();if(!d.objectStoreNames.contains('sessions')||!d.objectStoreNames.contains(STORE))return;let tx=d.transaction('sessions','readonly'),all=await reqP(tx.objectStore('sessions').getAll());await txDone(tx);const s=(all||[]).filter(x=>!x.endedAt).sort((a,b)=>(b.startedAtMs||0)-(a.startedAtMs||0))[0];if(!s)return;const t=Date.now(),idx=980000+(gearSeq++);tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).put({id:`${s.id}-manual-gear-${String(idx).padStart(6,'0')}`,sessionId:s.id,index:idx,createdAt:new Date(t).toISOString(),source:MODULE,frames:[{t,kind:'manual_gear_reference',module:MODULE,...detail}]});await txDone(tx);d.close()}
function boot(){installGumGuard();window.addEventListener('motolab-trip-gear-guard',e=>{lastGuard=e.detail||{};paintGear()});navigator.mediaDevices?.addEventListener?.('devicechange',()=>refreshAudioUi(false));setInterval(()=>{installGumGuard();ensureAudioUi();paintGear();if(isAdmin()&&$('motolabAdminAudioBox'))refreshAudioUi(false)},500);log('admin_test_tools_loaded',{gearPromptHoldMs:HOLD_MS,gearPromptAllUsers:true,adminAudioOnly:true})}
globalThis.MotoLabAdminTestTools={version:MODULE,refreshAudio:()=>refreshAudioUi(true),get selectedAudioDevice(){return selectedDevice()}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
