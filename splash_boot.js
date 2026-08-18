(() => {
'use strict';
const VERSION='motolab-splash-boot-v1';
const MIN_MS=2600, LOGIN_AFTER_MS=3200, FAILSAFE_MS=12000;
const started=performance.now();
const $=id=>document.getElementById(id);
let finished=false, loginShown=false;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function root(){return $('motolabBootSplash')}
function status(t){const e=$('motolabBootStatus');if(e)e.textContent=t}
function user(){return globalThis.MotoLabUser?.user||null}
function readyUser(){const u=user();return !!u&&u.status==='active'}
function elapsed(){return performance.now()-started}
function afterMin(fn){setTimeout(fn,Math.max(0,MIN_MS-elapsed()))}
function closeSplash(){if(finished)return;finished=true;afterMin(()=>{const r=root();if(!r)return;r.classList.add('mls-out');setTimeout(()=>r.remove(),520)})}
function setBusy(on){for(const id of ['motolabBootActivate','motolabBootRefresh','motolabBootGuest']){const b=$(id);if(b)b.disabled=!!on}}
function loginMarkup(){return `<div class="mls-login" id="motolabBootLogin"><div class="mls-login-title">KIRJAUDU / AKTIVOI</div><div class="mls-login-copy">MotorLab on valmis. Käyttäjätili tarvitaan pilvitallennukseen, Beta-yhteisöön, viesteihin ja jaettuihin vetoihin.</div><label>Nimimerkki</label><input id="motolabBootNick" maxlength="32" autocomplete="nickname" value="${esc(localStorage.getItem('motolab_user_nickname')||'')}"><label>Kutsukoodi</label><input id="motolabBootCode" autocomplete="one-time-code" placeholder="Kutsukoodi"><button id="motolabBootActivate" class="mls-primary">AKTIVOI TÄMÄ LAITE</button><button id="motolabBootRefresh" class="mls-secondary">PÄIVITÄ TILA</button><button id="motolabBootGuest" class="mls-ghost">JATKA ILMAN TILIÄ</button><div class="mls-msg" id="motolabBootLoginMsg"></div></div>`}
function showLogin(message=''){if(finished||loginShown)return;loginShown=true;const slot=$('motolabBootPanel');if(!slot)return;slot.innerHTML=loginMarkup();slot.classList.add('mls-panel-on');const msg=$('motolabBootLoginMsg');if(msg)msg.textContent=message;const act=$('motolabBootActivate'),ref=$('motolabBootRefresh'),guest=$('motolabBootGuest');
 if(act)act.onclick=async()=>{const code=String($('motolabBootCode')?.value||'').trim(),nick=String($('motolabBootNick')?.value||'').trim();if(!code){if(msg)msg.textContent='Anna kutsukoodi.';return}setBusy(true);if(msg)msg.textContent='Aktivoidaan laitetta…';try{const u=await globalThis.MotoLabUser?.activate?.(code,nick);if(u?.status==='active'){status('VALMIS');if(msg)msg.textContent='Kirjautuminen valmis.';closeSplash()}else if(u){if(msg)msg.textContent='Laite rekisteröity. Odottaa ylläpidon hyväksyntää.'}else if(msg)msg.textContent='Kirjautumista ei voitu vahvistaa.'}catch(e){if(msg)msg.textContent='Aktivointi epäonnistui: '+(e?.message||e)}finally{setBusy(false)}};
 if(ref)ref.onclick=async()=>{setBusy(true);if(msg)msg.textContent='Tarkistetaan käyttäjäistunto…';try{const u=await globalThis.MotoLabUser?.refresh?.();if(u?.status==='active'){status('VALMIS');if(msg)msg.textContent='Istunto palautettu.';closeSplash()}else if(msg)msg.textContent=u?'Käyttäjä odottaa hyväksyntää.':'Tällä laitteella ei ole aktiivista istuntoa.'}catch(e){if(msg)msg.textContent='Yhteys epäonnistui: '+(e?.message||e)}finally{setBusy(false)}};
 if(guest)guest.onclick=()=>{status('VALMIS');closeSplash()};
}
function inspect(){if(finished)return;if(readyUser()){status('VALMIS');closeSplash();return}const api=globalThis.MotoLabUser;if(api){status('KÄYTTÄJÄTILA TARKISTETTU');if(elapsed()>=LOGIN_AFTER_MS)showLogin()}else status('LADATAAN MOTORLABIA…')}
function boot(){const r=root();if(!r)return;status('LADATAAN MOTORLABIA…');const img=$('motolabBootImage');if(img){if(img.complete&&img.naturalWidth>0)r.classList.add('mls-image-ok');img.addEventListener('load',()=>r.classList.add('mls-image-ok'),{once:true});img.addEventListener('error',()=>{r.classList.add('mls-image-fallback');status('MOTORLAB')},{once:true})}
 document.addEventListener('motorlab-user-ready',()=>{if(readyUser()){status('VALMIS');closeSplash()}else inspect()});
 let n=0;const t=setInterval(()=>{inspect();if(finished||++n>60)clearInterval(t)},200);
 setTimeout(()=>{if(!finished)showLogin('Kirjautuminen ei estä mittausta. Voit myös jatkaa ilman tiliä.')},FAILSAFE_MS);
}
globalThis.MotoLabSplash={version:VERSION,close:closeSplash,showLogin,status};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
