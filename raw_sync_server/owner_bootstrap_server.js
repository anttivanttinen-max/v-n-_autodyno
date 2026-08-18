'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const originalCreateServer=http.createServer.bind(http);
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const BETA_SECRET=String(process.env.BETA_TOKEN_SECRET||'');
const ALLOWED_ORIGIN=process.env.ALLOWED_ORIGIN||'https://anttivanttinen-max.github.io';
const USERS_FILE=path.join(DATA_DIR,'users','registry.json');
const OWNER_NICKNAME='VäNä';
const OWNER_BOOTSTRAP_HASH='a06d049c865ff8a3f974a40e517e232db5bfdc3e30692a94db85d772abe7de7a';

function hash(v){return crypto.createHash('sha256').update(String(v||'')).digest('hex')}
function eq(a,b){const aa=Buffer.from(String(a||'')),bb=Buffer.from(String(b||''));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
function safe(v,n=160){return String(v||'').trim().replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,n)}
function id(prefix){return prefix+'_'+crypto.randomBytes(12).toString('hex')}
function b64(v){return Buffer.from(v).toString('base64url')}
function sign(payload){const body=b64(JSON.stringify(payload));const sig=crypto.createHmac('sha256',BETA_SECRET).update(body).digest('base64url');return `${body}.${sig}`}
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+process.pid+'-'+Date.now();fs.writeFileSync(tmp,data);fs.renameSync(tmp,file)}
function send(res,status,obj,origin=''){const body=Buffer.from(JSON.stringify(obj));const h={'Content-Type':'application/json; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'};if(origin===ALLOWED_ORIGIN){h['Access-Control-Allow-Origin']=origin;h['Vary']='Origin'}res.writeHead(status,h);res.end(body)}
function readBody(req,max=65536){return new Promise((resolve,reject)=>{let size=0,a=[];req.on('data',c=>{size+=c.length;if(size>max){reject(new Error('Payload too large'));req.destroy();return}a.push(c)});req.on('end',()=>resolve(Buffer.concat(a)));req.on('error',reject)})}
function publicUser(u){return {userId:u.userId,nickname:u.nickname,status:u.status,role:u.role||'user',invitedBy:u.invitedBy||null,createdAt:u.createdAt,approvedAt:u.approvedAt||null,devices:(u.devices||[]).map(d=>({deviceId:d.deviceId,label:d.label||'',createdAt:d.createdAt,lastSeenAt:d.lastSeenAt||null}))}}
function bootstrapState(){const db=readJson(USERS_FILE,{schema:'motolab_users_v1',users:[]});const admin=(db.users||[]).find(u=>u.role==='admin');return {db,armed:!db.ownerBootstrapConsumedAt&&!admin,consumed:!!db.ownerBootstrapConsumedAt,adminExists:!!admin}}

async function tryBootstrap(req,res,origin){
 let data;try{data=JSON.parse((await readBody(req)).toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'},origin)}
 const code=String(data.code||data.invite||'').trim();
 if(!eq(hash(code),OWNER_BOOTSTRAP_HASH))return false;
 if(!BETA_SECRET)return send(res,503,{ok:false,error:'Device identity is not configured'},origin);
 const deviceId=safe(data.deviceId),label=String(data.deviceLabel||'').slice(0,80);
 if(!deviceId)return send(res,400,{ok:false,error:'deviceId required'},origin);
 const {db,consumed,adminExists}=bootstrapState();
 if(consumed)return send(res,410,{ok:false,error:'Owner bootstrap already used'},origin);
 if(adminExists)return send(res,409,{ok:false,error:'Owner already exists'},origin);
 let u=(db.users||[]).find(x=>(x.devices||[]).some(d=>d.deviceId===deviceId));
 const now=new Date().toISOString();
 if(!u){
   u={userId:id('usr'),nickname:OWNER_NICKNAME,status:'active',role:'admin',invitedBy:null,inviteId:'owner_bootstrap_once',createdAt:now,approvedAt:now,devices:[{deviceId,label,createdAt:now,lastSeenAt:now}]};
   db.users.push(u);
 }else{
   u.nickname=OWNER_NICKNAME;u.status='active';u.role='admin';u.approvedAt=u.approvedAt||now;
   const d=(u.devices||[]).find(x=>x.deviceId===deviceId);if(d){d.lastSeenAt=now;if(label)d.label=label}
 }
 u.ownerClaimedAt=now;u.ownerClaimedDeviceId=deviceId;u.ownerClaimSource='one_time_bootstrap';
 db.ownerBootstrapConsumedAt=now;db.ownerBootstrapConsumedByDeviceId=deviceId;db.updatedAt=now;
 atomic(USERS_FILE,JSON.stringify(db,null,2));
 const ms=365*86400000,t=Date.now(),exp=t+ms,token=sign({v:2,kind:'device',userId:u.userId,deviceId,iat:t,exp});
 return send(res,200,{ok:true,token,expiresAt:new Date(exp).toISOString(),deviceId,user:publicUser(u),status:'active',owner:true},origin);
}

http.createServer=function(listener){return originalCreateServer(async(req,res)=>{
 const origin=String(req.headers.origin||'');let u;try{u=new URL(req.url,'http://localhost')}catch{return listener(req,res)}
 if(req.method==='GET'&&u.pathname==='/api/users/v1/owner-bootstrap-status'){
   const s=bootstrapState();return send(res,200,{ok:true,armed:s.armed,consumed:s.consumed,adminExists:s.adminExists},origin)
 }
 if(req.method==='POST'&&u.pathname==='/api/beta/v1/activate'){
   const handled=await tryBootstrap(req,res,origin);
   if(handled!==false)return handled;
 }
 return listener(req,res)
})};
console.log('MotoLab one-time owner bootstrap: armed by hash, self-disables after first successful claim');
