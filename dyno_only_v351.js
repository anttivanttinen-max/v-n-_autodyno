"use strict";
(function(){
  if(globalThis.MotoLabDynoOnlyV351?.installed)return;
  const api=globalThis.MotoLabDynoOnlyV351={installed:true,version:"35.1"};
  const $=id=>document.getElementById(id);

  function hidePanelByTitle(words){
    document.querySelectorAll("#screen-settings .panel").forEach(p=>{
      const t=(p.querySelector(".ptitle")?.textContent||"").trim().toUpperCase();
      if(words.some(w=>t.includes(w)))p.classList.add("dyno-hidden");
    });
  }

  function simplify(){
    document.body.classList.add("dyno-only-v351");
    const tag=document.querySelector(".tag"); if(tag)tag.textContent="ROAD DYNO";

    document.querySelectorAll(".bottomNav .nav").forEach(n=>{
      const s=n.dataset.screen||"";
      if(!["measure","runs","settings"].includes(s))n.classList.add("dyno-hidden");
    });
    document.querySelectorAll(".bottomNav .ml-user-nav").forEach(n=>n.classList.add("dyno-hidden"));

    const mnav=document.querySelector('.nav[data-screen="measure"] .txt'); if(mnav&&mnav.textContent!=="DYNO")mnav.textContent="DYNO";
    const rnav=document.querySelector('.nav[data-screen="runs"] .txt'); if(rnav&&rnav.textContent!=="VEDOT")rnav.textContent="VEDOT";
    const snav=document.querySelector('.nav[data-screen="settings"] .txt'); if(snav&&snav.textContent!=="ASETUKSET")snav.textContent="ASETUKSET";

    const arm=$("armBtn"); if(arm){
      const ico=arm.querySelector(".ico"),lbl=arm.querySelector(".lbl");
      if(ico)ico.textContent="▶"; if(lbl)lbl.textContent="ALOITA DYNO";
    }
    const stop=$("stopBtn"); if(stop){
      const lbl=stop.querySelector(".lbl"); if(lbl)lbl.textContent="LOPETA";
    }

    hidePanelByTitle(["VEHICLE / ENGINE KNOWLEDGE BASE","OPPIVA DATA","SOVELLUS","RAW AUDIO FINGERPRINT"]);

    const keep=new Set(["GPS tarkkuus","RPM Fusion","BT Audio RPM","Vedon laatu","Delta edelliseen","Mittausputki"]);
    document.querySelectorAll("#screen-measure .card").forEach(c=>{
      const n=(c.querySelector("span")?.textContent||"").trim();
      if(!keep.has(n))c.classList.add("dyno-hidden");
    });

    const grid=document.querySelector("#screen-measure .grid2");
    if(grid && !$("dynoReady")){
      const box=document.createElement("div");
      box.id="dynoReady";box.className="dynoReady";
      box.innerHTML='<div class="dynoReadyTitle">DYNO VALMIUS</div><div class="dynoReadyGrid"><div id="dynoReadyGps" class="dynoReadyItem"><span>GPS</span><b>ODOTTAA</b></div><div id="dynoReadyAudio" class="dynoReadyItem"><span>AUDIO</span><b>ODOTTAA</b></div><div id="dynoReadyRpm" class="dynoReadyItem"><span>RPM</span><b>ODOTTAA</b></div></div><div id="dynoReadyStatus">Paina ALOITA DYNO. Sovellus käynnistää GPS:n, IMU:n ja valitun mikrofonin.</div>';
      grid.parentNode.insertBefore(box,grid);
    }

    if($("measureStatus") && !/VETO|ARMED|DYNOA EI|VALMISTELLAAN/i.test($("measureStatus").textContent||"")){
      $("measureStatus").textContent="Valmis dynomittaukseen. Paina ALOITA DYNO.";
    }

    if(typeof learningEnabled!=="undefined" && !learningEnabled){
      learningEnabled=true;
      try{localStorage.setItem(LEARNING_DATA_KEY,"1")}catch{}
      try{ensureLearningSession()}catch{}
    }
  }

  function keepScreenAwake(){
    const wake=$("wakeToggle");
    if(wake&&!wake.classList.contains("on"))wake.classList.add("on");
    if(wake&&!wake.dataset.dynoWakeLocked){
      wake.dataset.dynoWakeLocked="1";
      wake.onclick=e=>{
        e.preventDefault();
        wake.classList.add("on");
        try{saveSettings()}catch{}
        try{requestWake()}catch{}
      };
    }
    if(document.visibilityState==="visible"&&typeof requestWake==="function")requestWake();
  }

  function cls(el,state){
    if(!el)return;
    el.classList.remove("ok","warn","bad");
    el.classList.add(state);
  }

  function updateReady(){
    const gps=$("dynoReadyGps"),audio=$("dynoReadyAudio"),rpm=$("dynoReadyRpm"),status=$("dynoReadyStatus");
    const ga=parseFloat(($("gpsAccuracy")?.textContent||"").replace(",","."));
    const gpsGood=Number.isFinite(ga)&&ga<=15, gpsSome=Number.isFinite(ga)&&ga<=30;
    if(gps){
      gps.querySelector("b").textContent=Number.isFinite(ga)?Math.round(ga)+" m":(typeof gpsOn!=="undefined"&&gpsOn?"HAKEE":"ODOTTAA");
      cls(gps,gpsGood?"ok":gpsSome?"warn":"bad");
    }

    const ar=parseFloat(($("audioRpmState")?.textContent||"").replace(/[^\d.,-]/g,"").replace(",","."));
    const audioOn=typeof extMicOn!=="undefined"&&extMicOn;
    if(audio){
      audio.querySelector("b").textContent=audioOn?(Number.isFinite(ar)&&ar>0?Math.round(ar)+" rpm":"AKTIIVINEN"):"ODOTTAA";
      cls(audio,audioOn?"ok":"bad");
    }

    const rr=typeof lastUi!=="undefined"?+lastUi.rpm:0;
    if(rpm){
      rpm.querySelector("b").textContent=rr>0?Math.round(rr)+" rpm":"ODOTTAA";
      cls(rpm,rr>=900?"ok":"warn");
    }

    if(status){
      const es=$("engineHealth")?.textContent||"";
      if(es==="AUTO RUN")status.textContent="VETO KÄYNNISSÄ • pidä kaasu tasaisesti auki.";
      else if(es==="ARMED")status.textContent="VALMIS • odottaa kierrosten nousua ja kiihtyvyyttä.";
      else if(gpsGood&&audioOn)status.textContent="SIGNAALIT OK • paina ALOITA DYNO.";
      else status.textContent="Paina ALOITA DYNO. Sovellus käynnistää ja tarkistaa mittauslähteet.";
    }
  }

  function installDynoStart(){
    const arm=$("armBtn"); if(!arm)return;
    arm.onclick=async e=>{
      if(e.target.classList.contains("ib"))return;
      requestWake();
      if($("measureStatus"))$("measureStatus").textContent="Valmistellaan dynoa…";

      const imuOk=(typeof imuOn!=="undefined"&&imuOn)||await startIMU();
      const gpsOk=(typeof gpsOn!=="undefined"&&gpsOn)||await startGPS();
      let audioOk=true;
      if($("rpmSourceMode")?.value!=="gps"){
        audioOk=(typeof extMicOn!=="undefined"&&extMicOn)||await startAudio();
      }

      if(!gpsOk){
        $("measureStatus").textContent="Dynoa ei käynnistetty: GPS ei käynnistynyt.";
        return;
      }
      if($("rpmSourceMode")?.value!=="gps"&&!audioOk){
        $("measureStatus").textContent="Dynoa ei käynnistetty: valittu mikrofonitulo ei käynnistynyt.";
        return;
      }

      pushConfig();
      addLearningEvent("dyno_auto_arm_v351");
      measurementWorker.postMessage({type:"arm"});
      $("measureStatus").textContent=imuOk?"DYNO ARMED • odottaa vetoa.":"DYNO ARMED • IMU ei käytössä, RPM + GPS jatkavat.";
      updateReady();
    };
  }

  function installAutoResult(){
    if(globalThis.__MotoLabV351RunWrap || typeof handleRunComplete!=="function")return;
    globalThis.__MotoLabV351RunWrap=true;
    const old=handleRunComplete;
    handleRunComplete=async function(r,reason){
      await old(r,reason);
      try{
        switchScreen("runs");
        renderRuns();
        setTimeout(()=>openRun(r.id),80);
      }catch{}
    };
  }

  function enforce(){
    simplify();
    keepScreenAwake();
    installDynoStart();
    installAutoResult();
    updateReady();
  }

  function boot(){
    enforce();
    setTimeout(enforce,300);
    setTimeout(enforce,1000);
    setTimeout(enforce,2500);
    setInterval(updateReady,350);
    const nav=document.querySelector(".bottomNav");
    if(nav)new MutationObserver(()=>{simplify();installDynoStart()}).observe(nav,{childList:true,subtree:true,characterData:true});
  }

  api.enforce=enforce;
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();