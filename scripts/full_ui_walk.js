'use strict';
const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fail=m=>{throw new Error(m)};
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'fi-FI',geolocation:{latitude:60.17,longitude:24.94},permissions:['geolocation']});
  const page=await context.newPage();
  const errors=[],tested=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
  page.on('dialog',async d=>{try{await d.accept()}catch{}});
  await page.addInitScript(()=>{
    try{Object.defineProperty(navigator,'bluetooth',{configurable:true,value:{requestDevice:async()=>({name:'MotoLab Fake BT',gatt:{connect:async()=>({connected:true})}})}})}catch{}
    try{Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async()=>({released:false,release:async()=>{}})}})}catch{}
  });
  await page.route('https://v-n-autodyno-production.up.railway.app/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"items":[],"user":null}'}));
  const url=process.env.MOTOLAB_SMOKE_URL||'http://127.0.0.1:8080/';
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!globalThis.MotoLabV34UI&&!!globalThis.MotoLabSimpleUI,{timeout:20000});
  if(await page.locator('#motolabBootSplash').count()){
    await page.waitForSelector('#motolabBootLogin',{state:'visible',timeout:13000});
    await page.locator('#motolabBootGuest').click();
    await page.waitForSelector('#motolabBootSplash',{state:'detached',timeout:7000});
  }
  await page.waitForFunction(()=>!!globalThis.MotoLabRunAnalysis,{timeout:15000});
  const release=await page.evaluate(()=>globalThis.MOTOLAB_RELEASE);
  if(release?.version!=='34.7')fail('unexpected version '+release?.version);
  await page.evaluate(()=>{
    const p=getCurrentProfile();
    const pts=g=>[2500,3500,4500,5500,6500,7500,8500].map((rpm,i)=>({rpm,hp:(4+i*2)*g,nm:(7+i)*g,kmh:25+i*9}));
    runs=[
      {id:'walk-a',date:new Date(Date.now()-120000).toISOString(),mode:'MANUAL',quality:86,status:'good',maxHp:16,maxNm:13,maxRpm:8500,gear:3,profileId:p.id,profileName:p.name,carb:{mainJet:165,pilotJet:45,needleType:'X7',needleClip:'3',airScrew:1.5,slide:40},tuning:{ignitionMap:'A',ypvs:'std'},notes:'walk A',data:pts(1)},
      {id:'walk-b',date:new Date().toISOString(),mode:'AUTO',quality:93,status:'good',maxHp:17.5,maxNm:14.4,maxRpm:8500,gear:3,profileId:p.id,profileName:p.name,carb:{mainJet:168,pilotJet:45,needleType:'X7',needleClip:'2',airScrew:1.25,slide:40},tuning:{ignitionMap:'B',ypvs:'early'},notes:'walk B',data:pts(1.1)}
    ];
    renderRuns();renderAnalysis();globalThis.MotoLabRunAnalysis.refresh();
  });
  async function clearOverlays(){
    await page.evaluate(()=>{
      for(const e of document.querySelectorAll('.modal.show,.fullchart.show'))e.classList.remove('show');
      const bm=document.querySelector('.mlbm-overlay,.mlbm-backdrop');if(bm)bm.remove();
    });
    await sleep(80);
  }
  async function nav(screen){
    await clearOverlays();
    const b=page.locator(`.bottomNav .nav[data-screen="${screen}"]`).first();
    if(!await b.count())fail('missing nav '+screen);
    await b.click({force:true});await sleep(180);
    const active=await page.locator('.screen.active').getAttribute('id');
    if(active!=='screen-'+screen)fail('nav failed '+screen+' -> '+active);
    tested.push('nav:'+screen);
  }
  function benign(x){return /favicon|Failed to load resource|NotFoundError|NotAllowedError|Bluetooth|media device|permission|404|smoke-test/i.test(x)}
  async function assertClean(tag){const real=errors.filter(x=>!benign(x));if(real.length)fail(tag+' runtime errors:\n'+real.join('\n'))}
  async function clickAndVerify(locator,label){
    const n=await locator.count();if(!n)return false;
    const el=locator.first();if(!await el.isVisible().catch(()=>false))return false;
    const before=await page.evaluate(()=>({active:document.querySelector('.screen.active')?.id||'',modals:[...document.querySelectorAll('.modal.show,.fullchart.show')].map(x=>x.id),body:document.body.className}));
    try{await el.scrollIntoViewIfNeeded().catch(()=>{});await el.click({force:true,timeout:4000});await sleep(140)}catch(e){fail('click failed '+label+': '+e.message)}
    const after=await page.evaluate(()=>({active:document.querySelector('.screen.active')?.id||'',modals:[...document.querySelectorAll('.modal.show,.fullchart.show')].map(x=>x.id),body:document.body.className}));
    tested.push(label+' '+JSON.stringify({before,after}));await assertClean(label);return true;
  }
  for(const screen of ['measure','runs','analysis','settings']){
    await nav(screen);
    const heads=page.locator(`#screen-${screen} .panel .phead[role="button"],#screen-${screen} .panel.ml-accordion > .phead`);
    for(let i=0;i<await heads.count();i++){
      const h=heads.nth(i);if(await h.isVisible().catch(()=>false)){await h.scrollIntoViewIfNeeded().catch(()=>{});await h.click({force:true});await sleep(80);tested.push(`${screen}:accordion:${i}`);await assertClean(`${screen}:accordion:${i}`)}
    }
    const buttons=page.locator(`#screen-${screen} button:visible`);
    const ids=await buttons.evaluateAll(es=>es.map((e,i)=>e.id||e.getAttribute('data-act')||e.getAttribute('data-screen')||e.textContent.trim().slice(0,40)||('button-'+i)));
    for(const id of ids){
      await nav(screen);if(id.startsWith('button-'))continue;
      let target=page.locator(`#screen-${screen} button`).filter({hasText:id}).first();
      const byId=page.locator(`[id="${String(id).replace(/"/g,'\\"')}"]`);
      if(await byId.count())target=byId.first();
      if(!await target.count())continue;
      await clickAndVerify(target,`${screen}:button:${id}`);await clearOverlays();
    }
  }
  await nav('analysis');
  for(let i=0;i<await page.locator('#mlAnalysisLaunch .ml-analysis-item').count();i++){
    const x=page.locator('#mlAnalysisLaunch .ml-analysis-item').nth(i);
    await x.evaluate(el=>{el.scrollIntoView({block:'center'});el.click()});
    await sleep(120);tested.push('analysis:item:'+i);await assertClean('analysis:item:'+i);
  }
  await page.selectOption('#mlRunA','walk-a');await page.selectOption('#mlRunB','walk-b');await page.click('#mlCompareAB',{force:true});
  const ab=(await page.locator('#mlABSummary').innerText()).toUpperCase();if(!ab.includes('MITATTU ERO')||!ab.includes('PÄÄSUUTIN'))fail('A/B comparison did not execute');tested.push('analysis:A/B compare');
  await page.evaluate(()=>globalThis.MotoLabRunAnalysis.editRun('walk-a'));await page.waitForSelector('#mlRunEditModal.show');
  await page.fill('#mlMetaIgnMap','WALK-C');await page.fill('#mlMetaNotes','full ui walk edit');await page.click('#mlMetaSave',{force:true});
  const edit=await page.evaluate(()=>{const r=runs.find(x=>x.id==='walk-a');return [r?.tuning?.ignitionMap,r?.tuning?.notes,r?.notes,r?.data?.length,r?.tuning?.metadataEditedAfterRun]});
  if(edit[0]!=='WALK-C'||edit[1]!=='full ui walk edit'||edit[2]!=='walk A'||edit[3]!==7||edit[4]!==true)fail('metadata edit produced wrong result '+JSON.stringify(edit));tested.push('run metadata save');
  await nav('settings');
  const profile=await page.evaluate(()=>{const original=getCurrentProfile().id;newProfile();const created=getCurrentProfile().id;const s=document.getElementById('profileSelect');s.value=original;s.dispatchEvent(new Event('change',{bubbles:true}));return {original,created,current:getCurrentProfile().id,stored:localStorage.getItem('motolab_v26_profile')}});
  if(profile.current!==profile.original||profile.stored!==profile.original)fail('profile selection did not persist '+JSON.stringify(profile));tested.push('profile create/select/persist');
  const userNav=page.locator('.bottomNav .ml-user-nav');
  if(await userNav.count()){
    await userNav.click({force:true});await page.waitForSelector('.mlbm-card',{timeout:5000});
    const acts=await page.locator('.mlbm-card [data-act]').evaluateAll(es=>es.map(e=>e.getAttribute('data-act')));
    for(const act of acts){
      if(!act)continue;if(!await page.locator('.mlbm-card').count()){await userNav.click({force:true});await page.waitForSelector('.mlbm-card')}
      const b=page.locator(`.mlbm-card [data-act="${act}"]`).first();if(await b.isVisible().catch(()=>false)){await b.evaluate(el=>el.click());await sleep(140);tested.push('user-menu:'+act);await assertClean('user-menu:'+act);await clearOverlays()}
    }
  }
  await nav('measure');
  for(const id of ['gpsBtn','imuBtn','extMicBtn','autoBtn','manualBtn','stopBtn']){
    const b=page.locator('#'+id);if(await b.count()&&await b.isVisible().catch(()=>false)){await b.evaluate(el=>el.click());await sleep(180);tested.push('measure-control:'+id);await assertClean('measure-control:'+id)}
  }
  const uncaught=errors.filter(x=>!benign(x));if(uncaught.length)fail('uncaught errors:\n'+uncaught.join('\n'));if(tested.length<20)fail('too few UI actions exercised: '+tested.length);
  console.log('V34_FULL_UI_WALK_OK',JSON.stringify({version:release.version,actions:tested.length,errors:errors.length,ab:true,metadata:true,profile:true,menus:true}));
  await browser.close();
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
