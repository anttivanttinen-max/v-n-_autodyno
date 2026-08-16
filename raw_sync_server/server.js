'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const PORT=Number(process.env.PORT||3000);
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const INGEST_KEY=String(process.env.INGEST_KEY||'');
const READ_KEY=String(process.env.READ_KEY||'');
const ALLOWED_ORIGIN=process.env.ALLOWED_ORIGIN||'https://anttivanttinen-max.github.io';
const MAX_BODY=Number(process.env.MAX_BODY_BYTES||8*1024*1024);

fs.mkdirSync(DATA_DIR,{recursive:true});

function json(res,status,obj,origin){
 const body=Buffer.from(JSON.stringify(obj));
 res.writeHead(status,{
  'Content-Type':'application/json; charset=utf-8',
  'Content-Length':body.length,
  'Cache-Control':'no-store',
  ...(origin?corsHeaders(origin):{})
 });
 res.end(body);
}
function corsHeaders(origin){
 const allow=origin===ALLOWED_ORIGIN?origin:'';
 return {
  ...(allow?{'Access-Control-Allow-Origin':allow}:{}),
  'Vary':'Origin',
  'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type,X-MotoLab-Ingest-Key,X-MotoLab-Read-Key',
  'Access-Control-Max-Age':'86400'
 };
}
function safe(s,fallback='unknown'){const v=String(s||fallback).replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120);return v||fallback}
function timingSafeEqual(a,b){const aa=Buffer.from(String(a||'')),bb=Buffer.from(String(b||''));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
function parseUrl(req){return new URL(req.url,'http://localhost')}
function authIngest(req){return INGEST_KEY&&timingSafeEqual(req.headers['x-motolab-ingest-key'],INGEST_KEY)}
function authRead(req,u){const key=req.headers['x-motolab-read-key']||u.searchParams.get('readKey')||'';return READ_KEY&&timingSafeEqual(key,READ_KEY)}
function readBody(req){return new Promise((resolve,reject)=>{let size=0,chunks=[];req.on('data',c=>{size+=c.length;if(size>MAX_BODY){reject(Object.assign(new Error('Payload too large'),{status:413}));req.destroy();return}chunks.push(c)});req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject)})}
function walkJson(dir,out=[]){if(!fs.existsSync(dir))return out;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walkJson(p,out);else if(e.isFile()&&e.name.endsWith('.json'))out.push(p)}return out}

async function handlePost(req,res,u,origin){
 if(u.pathname!=='/api/raw/v1/chunk')return json(res,404,{ok:false,error:'Not found'},origin);
 if(!authIngest(req))return json(res,401,{ok:false,error:'Invalid ingest key'},origin);
 let body;try{body=await readBody(req)}catch(e){return json(res,e.status||400,{ok:false,error:e.message},origin)}
 let env;try{env=JSON.parse(body.toString('utf8'))}catch{return json(res,400,{ok:false,error:'Invalid JSON'},origin)}
 if(!env||env.schema!=='motolab_raw_sync_envelope_v1'||!env.chunk||!env.chunk.id)return json(res,400,{ok:false,error:'Invalid RAW envelope'},origin);
 const device=safe(env.deviceId),session=safe(env.chunk.sessionId||'no-session'),chunkId=safe(env.chunk.id);
 const dir=path.join(DATA_DIR,device,session);fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,chunkId+'.json');
 if(fs.existsSync(file))return json(res,200,{ok:true,duplicate:true,id:env.chunk.id},origin);
 const tmp=file+'.tmp-'+process.pid+'-'+Date.now();
 fs.writeFileSync(tmp,JSON.stringify(env));fs.renameSync(tmp,file);
 return json(res,201,{ok:true,id:env.chunk.id,deviceId:env.deviceId,sessionId:env.chunk.sessionId||null},origin);
}

function handleRead(req,res,u,origin){
 if(u.pathname==='/health')return json(res,200,{ok:true,service:'vana-motolab-raw-sync',time:new Date().toISOString()},origin);
 if(u.pathname!=='/api/raw/v1/chunks')return json(res,404,{ok:false,error:'Not found'},origin);
 if(!authRead(req,u))return json(res,401,{ok:false,error:'Invalid read key'},origin);
 const limit=Math.max(1,Math.min(100,Number(u.searchParams.get('limit')||25)));
 const after=Date.parse(u.searchParams.get('after')||'')||0;
 const files=walkJson(DATA_DIR).map(f=>({f,mtime:fs.statSync(f).mtimeMs})).filter(x=>x.mtime>after).sort((a,b)=>a.mtime-b.mtime).slice(0,limit);
 const items=[];for(const x of files){try{items.push(JSON.parse(fs.readFileSync(x.f,'utf8')))}catch{}}
 return json(res,200,{ok:true,count:items.length,serverTime:new Date().toISOString(),nextAfter:files.length?new Date(files[files.length-1].mtime).toISOString():null,items},origin);
}

const server=http.createServer(async(req,res)=>{
 const origin=String(req.headers.origin||'');
 if(req.method==='OPTIONS'){
  if(origin&&origin!==ALLOWED_ORIGIN){res.writeHead(403);return res.end()}
  res.writeHead(204,corsHeaders(origin));return res.end();
 }
 const u=parseUrl(req);
 try{
  if(req.method==='POST')return await handlePost(req,res,u,origin);
  if(req.method==='GET')return handleRead(req,res,u,origin);
  return json(res,405,{ok:false,error:'Method not allowed'},origin);
 }catch(e){console.error(e);return json(res,500,{ok:false,error:'Internal server error'},origin)}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`MotoLab RAW sync listening on :${PORT}, data=${DATA_DIR}`));
