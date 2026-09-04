'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const vm = require('vm');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PROD = 'https://v-n-autodyno-production.up.railway.app';
const BUILD = '2026-09-04-stable-raw-pwa-v1';

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function makeLocalStorage() {
  const m = new Map();
  return {
    getItem(k) { return m.has(String(k)) ? m.get(String(k)) : null; },
    setItem(k, v) { m.set(String(k), String(v)); },
    removeItem(k) { m.delete(String(k)); },
    clear() { m.clear(); }
  };
}

async function testClientQueue() {
  const chunks = Array.from({ length: 5 }, (_, i) => ({
    id: `bench-${i}`,
    sessionId: 'bench-session',
    created: new Date(1700000000000 + i * 1000).toISOString(),
    schema: 'learning_raw_v2',
    samples: [{ t: i, gpsKmh: 20 + i }]
  }));
  const attempts = {};
  const localStorage = makeLocalStorage();
  localStorage.setItem('motolab_v32_beta_token', 'bench-token');
  const document = { readyState:'loading', getElementById(){return null;}, addEventListener(){}, documentElement:{} };
  const ctx = {
    console, URL, Request, Response, localStorage, document,
    navigator:{serviceWorker:{addEventListener(){}}},
    window:{addEventListener(){}},
    MutationObserver:class{observe(){}},
    setTimeout, clearTimeout,
    crypto:{randomUUID:crypto.randomUUID},
    getLearningChunks:async()=>chunks,
    putRawChunk:async()=>{},
    MotoLabUser:{user:{status:'active'},productionServer:PROD},
    fetch:async(url,opts={})=>{
      assert(String(url)===PROD+'/api/users/v1/raw-chunk','Learning RAW used wrong route: '+url);
      assert(opts.headers?.['X-MotoLab-Beta-Token']==='bench-token','Beta token missing');
      const payload=JSON.parse(opts.body||'{}');
      const id=payload?.chunk?.id;
      assert(id,'RAW payload missing chunk id');
      attempts[id]=(attempts[id]||0)+1;
      if(id==='bench-0') return new Response(JSON.stringify({ok:false,error:'already exists',chunkId:id,alreadyExists:true}),{status:409,headers:{'content-type':'application/json'}});
      if(id==='bench-2'&&attempts[id]===1) return new Response(JSON.stringify({ok:false,error:'temporary receiver failure'}),{status:500,headers:{'content-type':'application/json'}});
      return new Response(JSON.stringify({ok:true,chunkId:id,receivedAt:new Date().toISOString()}),{status:201,headers:{'content-type':'application/json'}});
    }
  };
  ctx.globalThis=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT,'raw_sync.js'),'utf8'),ctx,{filename:'raw_sync.js'});
  const state=await ctx.MotoLabRawSync.flushAll();
  assert(state.pending===0,'Queue did not drain: '+JSON.stringify(state));
  assert(state.sent===5,'Expected 5 sent, got '+state.sent);
  assert(attempts['bench-0']===1,'Duplicate retried unexpectedly');
  assert(attempts['bench-2']===2,'Temporary failure retry count wrong');
  assert(attempts['bench-3']===1&&attempts['bench-4']===1,'Later chunks did not continue past failure');
  const addedAgain=await ctx.MotoLabRawSync.queueAllLocal();
  assert(addedAgain===0,'Acknowledged chunks re-queued: '+addedAgain);
  return {state,attempts};
}

class MockElement {
  constructor(tag,doc){this.tagName=tag;this.doc=doc;this.children=[];this.listeners={};this.dataset={};this.style={};this.textContent='';this.className='';this.disabled=false;this.isConnected=false;this._id='';this._html='';}
  set id(v){this._id=String(v||'');if(this._id)this.doc.map.set(this._id,this);}
  get id(){return this._id;}
  set innerHTML(v){this._html=String(v||'');for(const m of this._html.matchAll(/id="([^"]+)"/g)){const id=m[1];if(!this.doc.map.has(id)){const el=new MockElement('mock',this.doc);el.id=id;el.isConnected=true;if(id==='mlRawDataSend'&&this._html.includes('data-ml-learning-raw-bound="1"'))el.dataset.mlLearningRawBound='1';}}}
  get innerHTML(){return this._html;}
  appendChild(el){this.children.push(el);el.isConnected=true;if(el.id)this.doc.map.set(el.id,el);return el;}
  insertAdjacentElement(_where,el){return this.appendChild(el);}
  addEventListener(type,fn){this.listeners[type]=fn;}
  remove(){this.isConnected=false;if(this.id)this.doc.map.delete(this.id);}
}
function makeDocument(){
  const doc={map:new Map(),readyState:'complete',createElement(tag){return new MockElement(tag,doc);},getElementById(id){return doc.map.get(id)||null;},addEventListener(){}};
  doc.head=new MockElement('head',doc);doc.body=new MockElement('body',doc);doc.head.isConnected=doc.body.isConnected=true;return doc;
}

async function testRawUi(){
  const document=makeDocument();let researchCalls=0,learningCalls=0;
  const ctx={console,document,globalThis:null,setTimeout(){return 1;},clearTimeout(){},
    MotoLabV34RuntimeFixes:{async syncResearchRaw(){researchCalls++;return {after:{sessions:1,timelineChunks:1,sessionsMarkedSent:1,timelineChunksMarkedSent:1},sentThisRun:{sessions:1,timelineChunks:1}};}},
    MotoLabRawSync:{async flushAll(){learningCalls++;return {pending:0,sent:5,lastError:null};}}
  };
  ctx.globalThis=ctx;vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT,'raw_data_ui_light.js'),'utf8'),ctx,{filename:'raw_data_ui_light.js'});
  assert(typeof ctx.MotoLabV34RuntimeFixes.openResearchRawData==='function','OMA RAW open handler missing');
  const panel=ctx.MotoLabV34RuntimeFixes.openResearchRawData();
  assert(panel?.isConnected,'OMA RAW panel did not open');
  const send=document.getElementById('mlRawDataSend');
  assert(send,'RAW send button missing');
  assert(panel.innerHTML.includes('LÄHETÄ KAIKKI RAW-DATA NYT'),'Dual RAW label missing');
  assert(send.dataset.mlLearningRawBound==='1','Learning duplicate-listener guard missing');
  await send.onclick();
  assert(researchCalls===1,'Research RAW call count '+researchCalls);
  assert(learningCalls===1,'Learning RAW call count '+learningCalls);
  const status=document.getElementById('mlRawDataStatus')?.textContent||'';
  assert(status.includes('Research RAW'),'Research result missing');
  assert(status.includes('LEARNING RAW'),'Learning result missing');
  assert(status.includes('KAIKKI RAW-LÄHETYKSET VALMIIT'),'Combined success missing');
  const source=fs.readFileSync(path.join(ROOT,'raw_data_ui_light.js'),'utf8');
  assert(source.includes('touch-action:pan-y'),'iOS pan guard missing');
  assert(source.includes('touch-action:manipulation'),'iOS button guard missing');
  const beta=fs.readFileSync(path.join(ROOT,'beta_menu.js'),'utf8');
  assert(/rawdata'\)\{close\(\);requestAnimationFrame/.test(beta),'Menu close/frame handoff missing');
  return {researchCalls,learningCalls,status};
}

function testWorkerBoot(){
  const versionCode=fs.readFileSync(path.join(ROOT,'version.js'),'utf8');
  const swCode=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
  const events={};
  const ctx={console,globalThis:null,self:{addEventListener(type,fn){events[type]=fn;},clients:{async claim(){},async matchAll(){return[];}},skipWaiting(){}},
    importScripts(spec){assert(spec.includes('version.js'),'SW import missing');vm.runInContext(versionCode,ctx,{filename:'version.js(worker)'});},
    caches:{},fetch:async()=>{throw new Error('not executed');},Request:class{},Response:class{},URL,location:{origin:'http://bench.local'}};
  ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(swCode,ctx,{filename:'sw.js'});
  assert(ctx.MOTOLAB_RELEASE?.build===BUILD,'Worker build mismatch');
  for(const ev of ['install','activate','fetch','message'])assert(typeof events[ev]==='function','SW missing '+ev);
  const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const regs=[...index.matchAll(/serviceWorker\.register\(/g)];
  assert(regs.length===1,'Expected one SW registration, got '+regs.length);
  assert(index.includes('navigator.serviceWorker.register("./sw.js?build="'),'Canonical sw.js registration missing');
  assert(!fs.existsSync(path.join(ROOT,'sw-live.js')),'Competing sw-live.js exists');
  const rawSync=fs.readFileSync(path.join(ROOT,'raw_sync.js'),'utf8');
  assert(!rawSync.includes('tail3764b7.ts.net'),'Direct Tailscale client route remains');
  assert(rawSync.includes("PRODUCTION_SERVER+'/api/users/v1/raw-chunk'"),'Public RAW route missing');
  const runtime=fs.readFileSync(path.join(ROOT,'v34_runtime_fixes.js'),'utf8');
  assert(runtime.includes("productionServer||'https://v-n-autodyno-production.up.railway.app'"),'Research route wrong');
  return {build:ctx.MOTOLAB_RELEASE.build,handlers:Object.keys(events),registrations:regs.length};
}

function makeToken(secret,payload){
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig=crypto.createHmac('sha256',secret).update(body).digest('base64url');
  return body+'.'+sig;
}
function waitForServer(child,needle,timeoutMs=10000){
  return new Promise((resolve,reject)=>{let buf='';const timer=setTimeout(()=>reject(new Error('Server start timeout: '+buf)),timeoutMs);
    const onData=d=>{buf+=d.toString();if(buf.includes(needle)){clearTimeout(timer);child.stdout.off('data',onData);resolve(buf);}};
    child.stdout.on('data',onData);child.stderr.on('data',d=>{buf+=d.toString();});
    child.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exited '+code+': '+buf));});
  });
}

async function testLocalServerRoute(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'motolab-raw-bench-'));
  fs.mkdirSync(path.join(tmp,'users'),{recursive:true});
  fs.writeFileSync(path.join(tmp,'users','registry.json'),JSON.stringify({users:[{userId:'bench-user',status:'active',role:'tester',devices:[{deviceId:'bench-device'}]}]}));
  const secret='bench-secret-'+process.pid,port=21000+(process.pid%1000);
  const child=spawn(process.execPath,[path.join(ROOT,'raw_sync_server','server.js')],{cwd:ROOT,env:{...process.env,PORT:String(port),DATA_DIR:tmp,BETA_TOKEN_SECRET:secret,ALLOWED_ORIGIN:'http://bench.local',GITHUB_TOKEN:'',GITHUB_REPO:''},stdio:['ignore','pipe','pipe']});
  try{
    await waitForServer(child,'MotoLab sync listening');
    const base=`http://127.0.0.1:${port}`;
    const health=await fetch(base+'/health');assert(health.status===200,'Local health '+health.status);
    const preflight=await fetch(base+'/api/users/v1/raw-chunk',{method:'OPTIONS',headers:{Origin:'http://bench.local','Access-Control-Request-Method':'POST'}});
    assert(preflight.status===204,'Local preflight '+preflight.status);
    assert(preflight.headers.get('access-control-allow-origin')==='http://bench.local','Local CORS mismatch');
    const token=makeToken(secret,{userId:'bench-user',deviceId:'bench-device',exp:Date.now()+60000});
    const chunk={id:'bench-route-1',sessionId:'bench-route-session',created:new Date().toISOString(),schema:'learning_raw_v2',samples:[{t:1}]};
    const send=async()=>{const r=await fetch(base+'/api/users/v1/raw-chunk',{method:'POST',headers:{Origin:'http://bench.local','Content-Type':'application/json','X-MotoLab-Beta-Token':token},body:JSON.stringify({moduleVersion:'bench',deviceLabel:'bench',chunk})});return {r,body:await r.json()};};
    const first=await send();assert(first.r.status===201&&first.body.ok===true,'Local POST failed '+JSON.stringify(first.body));assert(first.body.chunkId===chunk.id,'Local receipt id mismatch');
    const second=await send();assert(second.r.status===201&&second.body.chunkId===chunk.id,'Local duplicate/idempotent POST failed');
    assert(fs.existsSync(path.join(tmp,'users','raw','bench-user',chunk.id+'.json')),'Local RAW file missing');
    assert(fs.existsSync(path.join(tmp,'users','raw','bench-user',chunk.sessionId+'.zip')),'Local session ZIP missing');
    return {health:health.status,preflight:preflight.status,post:first.r.status,duplicate:second.r.status};
  }finally{child.kill('SIGTERM');await new Promise(r=>setTimeout(r,150));fs.rmSync(tmp,{recursive:true,force:true});}
}

async function testPublicRoute(){
  const health=await fetch(PROD+'/health',{headers:{'Cache-Control':'no-cache'}});assert(health.status===200,'Public health '+health.status);
  const preflight=await fetch(PROD+'/api/users/v1/raw-chunk',{method:'OPTIONS',headers:{Origin:'https://anttivanttinen-max.github.io','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-motolab-beta-token'}});
  assert(preflight.status===204,'Public preflight '+preflight.status);
  assert(preflight.headers.get('access-control-allow-origin')==='https://anttivanttinen-max.github.io','Public CORS mismatch');
  const unauth=await fetch(PROD+'/api/users/v1/raw-chunk',{method:'POST',headers:{Origin:'https://anttivanttinen-max.github.io','Content-Type':'application/json'},body:JSON.stringify({moduleVersion:'route-probe',chunk:{id:'route-probe',sessionId:'route-probe',samples:[]}})});
  assert(unauth.status===401,'Public unauth guard expected 401 got '+unauth.status);
  return {health:health.status,preflight:preflight.status,unauth:unauth.status};
}

(async()=>{
  const results={};
  results.clientQueue=await testClientQueue();
  results.rawUi=await testRawUi();
  results.worker=testWorkerBoot();
  results.localServer=await testLocalServerRoute();
  results.publicRoute=await testPublicRoute();
  console.log('MOTORLAB_RAW_PWA_VIRTUAL_BENCH_OK');
  console.log(JSON.stringify(results,null,2));
})().catch(err=>{console.error('MOTORLAB_RAW_PWA_VIRTUAL_BENCH_FAIL');console.error(err.stack||err);process.exit(1);});
