'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const originalCreateServer=http.createServer.bind(http);
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const BETA_SECRET=String(process.env.BETA_TOKEN_SECRET||'');
const ALLOWED_ORIGIN=process.env.ALLOWED_ORIGIN||'https://anttivanttinen-max.github.io';
const MAX_BODY_BYTES=Math.max(65536,Number(process.env.MAX_BODY_BYTES||8*1024*1024));
const USERS_FILE=path.join(DATA_DIR,'users','registry.json');
const RAW_DIR=path.join(DATA_DIR,'users','raw');
const RAW_FORCE_DIR=path.join(DATA_DIR,'users','raw-force');

function unb64(v){return Buffer.from(v,'base64url').toString('utf8')}
function verify(token){
 if(!BETA_SECRET||!token)return null;
 const [body,sig]=String(token).split('.');
 if(!body||!sig)return null;
 const expected=crypto.createHmac('sha256',BETA_SECRET).update(body).digest('base64url');
 const a=Buffer.from(sig),b=Buffer.from(expected);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
 try{const p=JSON.parse(unb64(body));if(p.exp&&Date.now()>p.exp)return null;return p}catch{return null}
}
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function safe(v,n=120){return String(v||'').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,n)}
function send(res,status,obj,origin=''){
 const body=Buffer.from(JSON.stringify(obj));
 const h={'Content-Type':'application/json; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'};
 if(origin===ALLOWED_ORIGIN){h['Access-Control-Allow-Origin']=origin;h['Vary']='Origin'}
 res.writeHead(status,h);res.end(body)
}
function readBody(req,max=MAX_BODY_BYTES){return new Promise((resolve,reject)=>{let size=0,a=[];req.on('data',c=>{size+=c.length;if(size>max){reject(Object.assign(new Error('Payload too large'),{status:413}));req.destroy();return}a.push(c)});req.on('end',()=>resolve(Buffer.concat(a)));req.on('error',reject)})}
function identity(req){
 const p=verify(String(req.headers['x-motolab-beta-token']||''));
 if(!p||!p.userId||!p.deviceId)return null;
 const db=readJson(USERS_FILE,{users:[]});
 const u=(db.users||[]).find(x=>x.userId===p.userId);
 if(!u||u.status!=='active')return null;
 if(!(u.devices||[]).some(d=>d.deviceId===p.deviceId))return null;
 return {payload:p,user:u};
}
function atomicJson(file,obj){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+process.pid+'-'+Date.now();fs.writeFileSync(tmp,JSON.stringify(obj));fs.renameSync(tmp,file)}
function forceFile(userId){return path.join(RAW_FORCE_DIR,safe(userId)+'.json')}
function forceState(userId){return readJson(forceFile(userId),null)}
function setForce(userId,by){const current=forceState(userId);if(current?.status==='pending')return current;const cmd={schema:'motolab_raw_force_v1',userId,requestedAt:new Date().toISOString(),requestedBy:by,status:'pending',attempts:0};atomicJson(forceFile(userId),cmd);return cmd}
function ackForce(userId,deviceId,ok,state){const f=forceFile(userId),cmd=readJson(f,null);if(!cmd)return null;cmd.attempts=Number(cmd.attempts||0)+1;cmd.lastAttemptAt=new Date().toISOString();cmd.lastDeviceId=deviceId;cmd.result=state||null;if(ok){cmd.status='done';cmd.completedAt=cmd.lastAttemptAt}else cmd.status='pending';atomicJson(f,cmd);return cmd}
function crc32(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
function zipStore(entries){const locals=[],centrals=[];let offset=0;for(const e of entries){const name=Buffer.from(e.name.replace(/\\/g,'/')),data=Buffer.isBuffer(e.data)?e.data:Buffer.from(String(e.data)),crc=crc32(data),lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(0x0800,6);lh.writeUInt32LE(crc,14);lh.writeUInt32LE(data.length,18);lh.writeUInt32LE(data.length,22);lh.writeUInt16LE(name.length,26);locals.push(lh,name,data);const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(0x0800,8);ch.writeUInt32LE(crc,16);ch.writeUInt32LE(data.length,20);ch.writeUInt32LE(data.length,24);ch.writeUInt16LE(name.length,28);ch.writeUInt32LE(offset,42);centrals.push(ch,name);offset+=lh.length+name.length+data.length}const central=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,central,end])}
function writeSessionZip(userId,sessionId){const dir=path.join(RAW_DIR,safe(userId)),files=fs.existsSync(dir)?fs.readdirSync(dir).filter(n=>n.endsWith('.json')):[],entries=[],chunks=[];for(const n of files){const f=path.join(dir,n),j=readJson(f,null);if(j?.chunk?.sessionId!==sessionId)continue;entries.push({name:'chunks/'+n,data:fs.readFileSync(f)});chunks.push({file:n,chunkId:j?.chunk?.id||null,receivedAt:j?.receivedAt||null,deviceId:j?.deviceId||null,deviceLabel:j?.deviceLabel||''})}if(!entries.length)return null;const manifest={schema:'motolab_user_raw_session_zip_v1',userId,sessionId,createdAt:new Date().toISOString(),chunkCount:entries.length,chunks};entries.unshift({name:'manifest.json',data:JSON.stringify(manifest,null,2)});const zipFile=path.join(dir,safe(sessionId)+'.zip'),tmp=zipFile+'.tmp-'+process.pid+'-'+Date.now();fs.writeFileSync(tmp,zipStore(entries));fs.renameSync(tmp,zipFile);globalThis.MotoLabGitHubMirror?.queueLocal?.(zipFile).catch(()=>{});return zipFile}

http.createServer=function(listener){return originalCreateServer(async(req,res)=>{
 const origin=String(req.headers.origin||'');let u;try{u=new URL(req.url,'http://localhost')}catch{return listener(req,res)}
 const forcePath=u.pathname==='/api/users/v1/raw-force'||u.pathname==='/api/admin/v1/raw-force'||u.pathname==='/api/admin/v1/raw-force-all';
 if(req.method==='OPTIONS'&&(u.pathname==='/api/users/v1/raw-chunk'||forcePath)){
  if(origin&&origin!==ALLOWED_ORIGIN){res.writeHead(403);return res.end()}
  res.writeHead(204,{'Access-Control-Allow-Origin':origin||ALLOWED_ORIGIN,'Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-MotoLab-Beta-Token','Access-Control-Max-Age':'86400'});return res.end()
 }
 if(req.method==='GET'&&u.pathname==='/api/users/v1/raw-force'){
  const x=identity(req);if(!x)return send(res,401,{ok:false,error:'Active user session required'},origin);
  const cmd=forceState(x.user.userId);return send(res,200,{ok:true,pending:!!cmd&&cmd.status==='pending',command:cmd&&cmd.status==='pending'?cmd:null},origin)
 }
 if(req.method==='POST'&&u.pathname==='/api/users/v1/raw-force'){
  const x=identity(req);if(!x)return send(res,401,{ok:false,error:'Active user session required'},origin);
  let data={};try{data=JSON.parse((await readBody(req,65536)).toString('utf8'))}catch{}
  return send(res,200,{ok:true,command:ackForce(x.user.userId,x.payload.deviceId,data.ok===true,data.state||null)},origin)
 }
 if(req.method==='POST'&&u.pathname==='/api/admin/v1/raw-force'){
  const x=identity(req);if(!x||x.user.role!=='admin')return send(res,403,{ok:false,error:'Admin required'},origin);
  let data;try{data=JSON.parse((await readBody(req,65536)).toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'},origin)}
  const target=safe(data.userId),db=readJson(USERS_FILE,{users:[]});if(!(db.users||[]).some(v=>v.userId===target&&v.status==='active'))return send(res,404,{ok:false,error:'Active target user not found'},origin);
  return send(res,201,{ok:true,command:setForce(target,x.user.userId)},origin)
 }
 if(req.method==='POST'&&u.pathname==='/api/admin/v1/raw-force-all'){
  const x=identity(req);if(!x||x.user.role!=='admin')return send(res,403,{ok:false,error:'Admin required'},origin);
  const db=readJson(USERS_FILE,{users:[]}),commands=[];for(const target of (db.users||[]).filter(v=>v.status==='active'))commands.push(setForce(target.userId,x.user.userId));
  return send(res,201,{ok:true,count:commands.length,pending:commands.filter(c=>c.status==='pending').length,commands:commands.map(c=>({userId:c.userId,status:c.status,requestedAt:c.requestedAt}))},origin)
 }
 if(req.method!=='POST'||u.pathname!=='/api/users/v1/raw-chunk')return listener(req,res);
 const x=identity(req);if(!x)return send(res,401,{ok:false,error:'Active user session required'},origin);
 let body;try{body=await readBody(req)}catch(e){return send(res,e.status||400,{ok:false,error:e.message},origin)}
 let data;try{data=JSON.parse(body.toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'},origin)}
 const chunk=data&&data.chunk;if(!chunk||typeof chunk!=='object')return send(res,400,{ok:false,error:'RAW chunk required'},origin);
 const chunkId=safe(chunk.id||('raw_'+Date.now()));
 const item={schema:'motolab_user_raw_v1',userId:x.user.userId,deviceId:x.payload.deviceId,receivedAt:new Date().toISOString(),deviceLabel:String(data.deviceLabel||'').slice(0,80),moduleVersion:String(data.moduleVersion||'').slice(0,80),chunk};
 const file=path.join(RAW_DIR,safe(x.user.userId),chunkId+'.json');
 atomicJson(file,item);
 const sessionId=safe(chunk.sessionId||'no-session');let sessionZip=null;try{sessionZip=writeSessionZip(x.user.userId,sessionId)}catch(e){console.error('MotoLab session ZIP:',e)}
 return send(res,201,{ok:true,userId:x.user.userId,chunkId,sessionId,sessionZip:sessionZip?path.basename(sessionZip):null,receivedAt:item.receivedAt},origin)
})};
console.log('MotoLab authenticated user RAW endpoint enabled');
