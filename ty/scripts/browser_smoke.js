'use strict';
const { chromium } = require('playwright');

const fail = (m) => { throw new Error(m); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'fi-FI'});
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror', e => errors.push('pageerror: '+e.message));
  page.on('console', m => { if(m.type()==='error') errors.push('console: '+m.text()); });
  await page.route('https://v-n-autodyno-production.up.railway.app/**', route => route.fulfill({status:404,contentType:'application/json',body:'{"ok":false,"error":"smoke-test offline backend"}'}));

  const url=process.env.MOTOLAB_SMOKE_URL||'http://127.0.0.1:8080/';
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('.bottomNav',{timeout:20000});
  await page.waitForFunction(() => !!globalThis.MOTOLAB_RELEASE && !!globalThis.MotoLabV34UI && !!globalThis.MotoLabSimpleUI,{timeout:20000});
  await page.evaluate(async()=>{if('serviceWorker' in navigator)await navigator.serviceWorker.ready});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('.bottomNav',{timeout:20000});
  await page.waitForFunction(() => !!globalThis.MotoLabV34UI && !!globalThis.MotoLabSimpleUI,{timeout:20000});
  await page.waitForFunction(() => !('serviceWorker' in navigator) || !!navigator.serviceWorker.controller,{timeout:15000});

  const release=await page.evaluate(()=>globalThis.MOTOLAB_RELEASE);
  if(!release?.version || !release?.build) fail('Release identity missing after SW reload');
  if(await page.locator('#betaConsentOverlay').count()) fail('Blocking beta consent overlay returned');

  async function nav(screen){
    const b=page.locator(`.bottomNav .nav[data-screen="${screen}"]`).first();
    if(!await b.count()) fail('Missing nav '+screen);
    console.log('SMOKE_NAV_CLICK',screen,'from',await page.locator('.screen.active').getAttribute('id').catch(()=>null));
    await b.click();
    await sleep(250);
    const state=await page.evaluate(s=>({active:document.querySelector('.screen.active')?.id||'',target:document.querySelector('#screen-'+s)?.className||'',buttonClass:document.querySelector(`.bottomNav .nav[data-screen="${s}"]`)?.className||'',hasSwitch:typeof switchScreen==='function'}),screen);
    console.log('SMOKE_NAV_STATE',screen,JSON.stringify(state));
    if(state.active!=='screen-'+screen) fail('Navigation failed for '+screen+': '+JSON.stringify(state));
  }

  for(const s of ['measure','runs','analysis','settings']) await nav(s);
  const labels=await page.locator('.bottomNav .nav .txt').allTextContents();
  for(const wanted of ['ETUSIVU','VEDOT','ANALYYSI','ASETUKSET','KÄYTTÄJÄ']) if(!labels.some(x=>x.trim().toUpperCase()===wanted)) fail('Missing approved nav label '+wanted+' in '+JSON.stringify(labels));

  await nav('analysis');
  const analysis=page.locator('#mlAnalysisLaunch .ml-analysis-item');
  if(await analysis.count()!==4) fail('Analysis launch menu must contain four agreed items');
  const analysisText=(await analysis.allTextContents()).join(' | ').toUpperCase();
  for(const x of ['SUORITUSKYKY','KAASUTTIMEN SÄÄTÖ','SUUTIN-EHDOTUS','SYTYTYS']) if(!analysisText.includes(x)) fail('Missing analysis item '+x);
  await analysis.nth(3).click();
  const disabledMsg=await page.locator('#analysisText').textContent();
  if(!/tarkoituksella pois käytöstä/i.test(disabledMsg||'')) fail('Ignition beta guard message missing');

  await nav('settings');
  const accordions=page.locator('#screen-settings .panel.ml-accordion:not(.ml-hidden-user)');
  if(await accordions.count()<3) fail('Too few user settings accordions');
  await accordions.nth(0).locator(':scope > .phead').click();
  if(!await accordions.nth(0).evaluate(e=>e.classList.contains('ml-open'))) fail('First settings accordion did not open');
  await accordions.nth(1).locator(':scope > .phead').click();
  if(await accordions.nth(0).evaluate(e=>e.classList.contains('ml-open'))) fail('Settings accordion did not close previous item');
  if(!await accordions.nth(1).evaluate(e=>e.classList.contains('ml-open'))) fail('Second settings accordion did not open');

  const userNav=page.locator('.bottomNav .ml-user-nav');
  if(!await userNav.count()) fail('User nav missing');
  await userNav.click();
  await page.waitForSelector('.mlbm-card',{timeout:5000});
  const menuText=(await page.locator('.mlbm-card').innerText()).toUpperCase();
  for(const x of ['OMA TILI','PALAUTE & VIESTIT','JAETUT VEDOT','BETA-YHTEISÖ','TESTERITASO','LIVE / ANTURIT','KUTSU TESTAAJA']) if(!menuText.includes(x)) fail('User menu missing '+x);
  await page.locator('#mlbmClose').click();

  const mic=page.locator('#extMicBtn');
  if(!await mic.count() || !await mic.isVisible()) fail('Normal-user MIC control is not visible');
  const micState=await page.locator('#extState').textContent();
  if(/AKTIIVINEN|ACTIVE/i.test(micState||'')) fail('MIC falsely active at browser startup');

  await userNav.click();
  const liveBtn=page.locator('.mlbm-btn[data-act="live"]');
  if(!await liveBtn.count()) fail('LIVE menu action missing');
  await liveBtn.click();
  await sleep(300);
  if(!await page.locator('#screen-live').evaluate(e=>e.classList.contains('active'))) fail('LIVE did not become active from user menu');
  const authority=await page.evaluate(()=>String(globalThis.MOTOLAB_RPM_CONTROL_AUTHORITY||''));
  if(authority && !/gps/i.test(authority)) fail('Unexpected RPM authority after LIVE navigation: '+authority);

  await sleep(1200);
  const benign=/favicon|404 \(Not Found\)|smoke-test offline backend|Failed to load resource/i;
  const realErrors=errors.filter(x=>!benign.test(x));
  if(realErrors.length) fail('Browser runtime errors:\n'+realErrors.join('\n'));
  console.log('V34_BROWSER_SMOKE_OK',JSON.stringify({version:release.version,build:release.build,viewport:'390x844',menus:'home/runs/analysis/settings/user/live',serviceWorker:true}));
  await browser.close();
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
