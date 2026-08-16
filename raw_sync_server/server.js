'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {createGitHubMirror}=require('./github_mirror');

const PORT=Number(process.env.PORT||3000);
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const INGEST_KEY=String(process.env.INGEST_KEY||'');
const READ_KEY=String(process.env.READ_KEY||'');
const ALLOWED_ORIGIN=process.env.ALLOWED_ORIGIN||'https://anttivanttinen-max.github.io';
const MAX_BODY=Number(process.env.MAX_BODY_BYTES||8*1024*1024);
fs.mkdirSync(DATA_DIR,{recursive:true});
const mirror=createGitHubMirror({dataDir:DATA_DIR});

function corsHeaders(origin){const allow=origin===ALLOWED_ORIGIN?origin:'';return {...(allow?{'Access-Control-Allow-Origin':allow}:{}),'Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,HEAD,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-MotoLab-Ingest-Key,X-MotoLab-Read-Key','Access-Control-Max-Age':'86400'}}
function json(res,status,obj,origin,headOnly=false){const body=Buffer.from(JSON.stringify(obj));res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store',...(origin?corsHeaders(origin):{})});res.end(headOnly?undefined:body)}
function safe(s,fallback='unknown'){const v=String(s||fallback).replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,160);return v||fallback}
function eq(a,b){const aa=Buffer.from(String(a||'')),bb=Buffer.from(String(b||''));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
function parseUrl(req){return new URL(req.url,'http://localhost')}
function authIngest(req){return INGEST_KEY&&eq(req.headers['x-motolab-ingest-key'],INGEST_KEY)}
function authRead(req,u){return READ_KEY&&eq(req.headers['x-motolab-read-key']||u.searchParams.get('readKey')||'',READ_KEY)}
function readBody(req){return new Promise((resolve,reject)=>{let size=0,chunks=[];req.on('data',c=>{size+=c.length;if(size>MAX_BODY){reject(Object.assign(new Error('Payload too large'),{status:413}));req.destroy();return}chunks.push(c)});req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject)})}
function parseJson(buf){return JSON.parse(buf.toString('utf8'))}
function atomicWrite(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+process.pid+'-'+Date.now();fs.writeFileSync(tmp,data);fs.renameSync(tmp,file);mirror.queueLocal(file).catch(e=>console.error('MotoLab mirror queue:',e))}
function readJson(file){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return null}}
function walkJson(dir,out=[]){if(!fs.existsSync(dir))return out;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walkJson(p,out);else if(e.isFile()&&e.name.endsWith('.json'))out.push(p)}return out}
function researchDir(deviceId,sessionId){return path.join(DATA_DIR,'research',safe(deviceId),safe(sessionId))}

async function handleRawPost(req,res,u,origin){
 if(!authIngest(req))return json(res,401,{ok:false,error:'Invalid ingest key'},origin);
 let body;try{body=await readBody(req)}catch(e){return json(res,e.status||400,{ok:false,error:e.message},origin)}
 let env;try{env=parseJson(body)}catch{return json(res,400,{ok:false,error:'Invalid JSON'},origin)}
 if(!env||env.schema!=='motolab_raw_sync_envelope_v1'||!env.chunk||!env.chunk.id)return json(res,400,{ok:false,error:'Invalid RAW envelope'},origin);
 const device=safe(env.deviceId),session=safe(env.chunk.sessionId||'no-session'),chunkId=safe(env.chunk.id),dir=path.join(DATA_DIR,'raw',device,session),file=path.join(dir,chunkId+'.json');
 if(fs.existsSync(file))return json(res,200,{ok:true,duplicate:true,id:env.chunk.id},origin);
 atomicWrite(file,JSON.stringify(env));return json(res,201,{ok:true,id:env.chunk.id,deviceId:env.deviceId,sessionId:env.chunk.sessionId||null},origin)
}

async function handleResearchPost(req,res,u,origin){
 if(!authIngest(req))return json(res,401,{ok:false,error:'Invalid ingest key'},origin);
 if(u.pathname==='/api/research/v1/audio'){
  const deviceId=u.searchParams.get('deviceId'),sessionId=u.searchParams.get('sessionId'),index=Number(u.searchParams.get('index'));
  if(!deviceId||!sessionId||!Number.isInteger(index)||index<0)return json(res,400,{ok:false,error:'Missing audio metadata'},origin);
  let body;try{body=await readBody(req)}catch(e){return json(res,e.status||400,{ok:false,error:e.message},origin)}
  const dir=researchDir(deviceId,sessionId),ext=(u.searchParams.get('mime')||req.headers['content-type']||'').includes('webm')?'webm':'m4a',stem='audio-'+String(index).padStart(6,'0'),file=path.join(dir,stem+'.'+ext),metaFile=path.join(dir,stem+'.json');
  if(!fs.existsSync(file))atomicWrite(file,body);
  if(!fs.existsSync(metaFile))atomicWrite(metaFile,JSON.stringify({schema:'motolab_research_audio_v1',deviceId,sessionId,index,startMs:Number(u.searchParams.get('startMs')||0),endMs:Number(u.searchParams.get('endMs')||0),mime:u.searchParams.get('mime')||req.headers['content-type']||'',size:body.length,driver:u.searchParams.get('driver')||'',phone:u.searchParams.get('phone')||'',receivedAt:new Date().toISOString(),file:path.basename(file)}));
  return json(res,201,{ok:true,sessionId,index,size:body.length},origin)
 }
 let body;try{body=await readBody(req)}catch(e){return json(res,e.status||400,{ok:false,error:e.message},origin)}
 let env;try{env=parseJson(body)}catch{return json(res,400,{ok:false,error:'Invalid JSON'},origin)}
 const deviceId=env.deviceId,sessionId=env.sessionId||env.session?.id;if(!deviceId||!sessionId)return json(res,400,{ok:false,error:'deviceId/sessionId missing'},origin);
 const dir=researchDir(deviceId,sessionId);fs.mkdirSync(dir,{recursive:true});
 if(u.pathname==='/api/research/v1/start'){
  if(env.schema!=='motolab_research_session_v1'||!env.session)return json(res,400,{ok:false,error:'Invalid research start'},origin);
  const file=path.join(dir,'manifest.json');if(!fs.existsSync(file))atomicWrite(file,JSON.stringify({...env,status:'UPLOADING',receivedAt:new Date().toISOString()}));
  return json(res,201,{ok:true,deviceId,sessionId,status:'UPLOADING'},origin)
 }
 if(u.pathname==='/api/research/v1/data'){
  if(env.schema!=='motolab_research_data_v1'||!Number.isInteger(env.index)||!Array.isArray(env.frames))return json(res,400,{ok:false,error:'Invalid research data'},origin);
  const file=path.join(dir,'timeline-'+String(env.index).padStart(6,'0')+'.json');if(!fs.existsSync(file))atomicWrite(file,JSON.stringify(env));
  return json(res,201,{ok:true,deviceId,sessionId,index:env.index,frames:env.frames.length},origin)
 }
 if(u.pathname==='/api/research/v1/finish'){
  if(env.schema!=='motolab_research_finish_v1')return json(res,400,{ok:false,error:'Invalid research finish'},origin);
  atomicWrite(path.join(dir,'complete.json'),JSON.stringify({...env,status:'COMPLETE',receivedAt:new Date().toISOString()}));
  const mf=readJson(path.join(dir,'manifest.json'));if(mf)atomicWrite(path.join(dir,'manifest.json'),JSON.stringify({...mf,status:'COMPLETE',completedAt:new Date().toISOString(),finish:env}));
  return json(res,201,{ok:true,deviceId,sessionId,status:'COMPLETE'},origin)
 }
 return json(res,404,{ok:false,error:'Not found'},origin)
}

function listResearch(){const root=path.join(DATA_DIR,'research'),items=[];if(!fs.existsSync(root))return items;for(const device of fs.readdirSync(root)){const dd=path.join(root,device);if(!fs.statSync(dd).isDirectory())continue;for(const session of fs.readdirSync(dd)){const sd=path.join(dd,session);if(!fs.statSync(sd).isDirectory())continue;const manifest=readJson(path.join(sd,'manifest.json')),complete=readJson(path.join(sd,'complete.json'));if(!manifest)continue;const files=fs.readdirSync(sd),audio=files.filter(x=>/^audio-\d+\.(m4a|webm)$/.test(x)),timeline=files.filter(x=>/^timeline-\d+\.json$/.test(x));items.push({deviceId:manifest.deviceId||device,driver:manifest.driver||'',phone:manifest.phone||'',sessionId:manifest.session?.id||session,startedAt:manifest.session?.startedAt||null,endedAt:complete?.endedAt||manifest.finish?.endedAt||null,status:complete?'COMPLETE':(manifest.status||'UPLOADING'),profile:manifest.session?.profile||null,audioChunks:audio.length,timelineChunks:timeline.length,frameCount:complete?.frameCount||manifest.session?.frameCount||null,candidateFrameCount:complete?.candidateFrameCount||manifest.session?.candidateFrameCount||null,path:`${device}/${session}`})}}return items.sort((a,b)=>Date.parse(b.startedAt||0)-Date.parse(a.startedAt||0))}
function readResearchSession(deviceId,sessionId,includeTimeline){const dir=researchDir(deviceId,sessionId),manifest=readJson(path.join(dir,'manifest.json'));if(!manifest)return null;const files=fs.readdirSync(dir),audioMeta=files.filter(x=>/^audio-\d+\.json$/.test(x)).sort().map(x=>readJson(path.join(dir,x))).filter(Boolean),timelineFiles=files.filter(x=>/^timeline-\d+\.json$/.test(x)).sort(),finish=readJson(path.join(dir,'complete.json'));const out={manifest,finish,audio:audioMeta,timelineFiles};if(includeTimeline)out.timeline=timelineFiles.flatMap(x=>readJson(path.join(dir,x))?.frames||[]);return out}
function handleRead(req,res,u,origin,headOnly=false){
 if(u.pathname==='/health')return json(res,200,{ok:true,service:'vana-motolab-raw-sync',researchSync:true,githubMirror:mirror.status(),time:new Date().toISOString()},origin,headOnly);
 if(headOnly)return json(res,404,{ok:false,error:'Not found'},origin,true);
 if(u.pathname==='/api/raw/v1/chunks'){
  if(!authRead(req,u))return json(res,401,{ok:false,error:'Invalid read key'},origin);const limit=Math.max(1,Math.min(100,Number(u.searchParams.get('limit')||25))),after=Date.parse(u.searchParams.get('after')||'')||0,root=path.join(DATA_DIR,'raw');const files=walkJson(root).map(f=>({f,mtime:fs.statSync(f).mtimeMs})).filter(x=>x.mtime>after).sort((a,b)=>a.mtime-b.mtime).slice(0,limit),items=[];for(const x of files){const j=readJson(x.f);if(j)items.push(j)}return json(res,200,{ok:true,count:items.length,serverTime:new Date().toISOString(),nextAfter:files.length?new Date(files[files.length-1].mtime).toISOString():null,items},origin)
 }
 if(u.pathname==='/api/research/v1/sessions'){
  if(!authRead(req,u))return json(res,401,{ok:false,error:'Invalid read key'},origin);const limit=Math.max(1,Math.min(100,Number(u.searchParams.get('limit')||25))),items=listResearch().slice(0,limit);return json(res,200,{ok:true,count:items.length,serverTime:new Date().toISOString(),items},origin)
 }
 if(u.pathname==='/api/research/v1/session'){
  if(!authRead(req,u))return json(res,401,{ok:false,error:'Invalid read key'},origin);const deviceId=u.searchParams.get('deviceId'),sessionId=u.searchParams.get('sessionId');if(!deviceId||!sessionId)return json(res,400,{ok:false,error:'deviceId/sessionId missing'},origin);const item=readResearchSession(deviceId,sessionId,u.searchParams.get('timeline')==='1');if(!item)return json(res,404,{ok:false,error:'Session not found'},origin);return json(res,200,{ok:true,item},origin)
 }
 return json(res,404,{ok:false,error:'Not found'},origin)
}

const server=http.createServer(async(req,res)=>{const origin=String(req.headers.origin||'');if(req.method==='OPTIONS'){if(origin&&origin!==ALLOWED_ORIGIN){res.writeHead(403);return res.end()}res.writeHead(204,corsHeaders(origin));return res.end()}const u=parseUrl(req);try{if(req.method==='POST'&&u.pathname==='/api/raw/v1/chunk')return await handleRawPost(req,res,u,origin);if(req.method==='POST'&&u.pathname.startsWith('/api/research/v1/'))return await handleResearchPost(req,res,u,origin);if(req.method==='GET'||req.method==='HEAD')return handleRead(req,res,u,origin,req.method==='HEAD');return json(res,405,{ok:false,error:'Method not allowed'},origin)}catch(e){console.error(e);return json(res,500,{ok:false,error:'Internal server error'},origin)}});
server.listen(PORT,'0.0.0.0',()=>{console.log(`MotoLab sync listening on :${PORT}, data=${DATA_DIR}`);mirror.backfill().then(x=>{if(x.enabled)console.log(`MotoLab GitHub mirror backfill queued ${x.queued} files`);else console.log('MotoLab GitHub mirror disabled')}).catch(e=>console.error('MotoLab mirror backfill:',e))});
setInterval(()=>mirror.run().catch(e=>console.error('MotoLab mirror:',e)),30000).unref();
