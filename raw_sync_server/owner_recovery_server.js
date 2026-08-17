'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const originalCreateServer=http.createServer.bind(http);
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const BETA_SECRET=String(process.env.BETA_TOKEN_SECRET||'');
const RECOVERY_SECRET=String(process.env.MOTOLAB_OWNER_RECOVERY_CODE||'');
const OWNER_NICKNAME=String(process.env.MOTOLAB_OWNER_NICKNAME||'VäNä').trim()||'VäNä';
const USERS_FILE=path.join(DATA_DIR,'users','registry.json');
const BOOTSTRAP_FILE=path.join(DATA_DIR,'users','owner-bootstrap.json');
const TOKEN_DAYS=Math.max(7,Number(process.env.MOTOLAB_DEVICE_TOKEN_DAYS||365));
const BOOTSTRAP_HASH='917302f4daee9c095d9c263744743651d4057fdb848590d5ecd5f9a9c2748ddb';

function b64(v){return Buffer.from(v).toString('base64url')}
function unb64(v){return Buffer.from(v,'base64url').toString('utf8')}
function hash(v){return crypto.createHash('sha256').update(String(v||'')).digest('hex')}
function safe(v,n=160){return String(v||'').trim().replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,n)}
function eq(a,b){const aa=Buffer.from(String(a||'')),bb=Buffer.from(String(b||''));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
function sign(payload){const body=b64(JSON.stringify(payload));const sig=crypto.createHmac('sha256',BETA_SECRET).update(body).digest('base64url');return `${body}.${sig}`}
function verify(token){if(!BETA_SECRET||!token)return null;const [body,sig]=String(token).split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',BETA_SECRET).update(body).digest('base64url');if(!eq(sig,expected))return null;try{const p=JSON.parse(unb64(body));if(p.exp&&Date.now()>p.exp)return null;return p}catch{return null}}
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function atomic(file,obj){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+process.pid+'-'+Date.now();fs.writeFileSync(tmp,JSON.stringify(obj,null,2));fs.renameSync(tmp,file)}
function readUsers(){return readJson(USERS_FILE,{schema:'motolab_users_v1',users:[]})}
function writeUsers(db){db.updatedAt=new Date().toISOString();atomic(USERS_FILE,db)}
function send(res,status,obj){const body=Buffer.from(JSON.stringify(obj));res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'});res.end(body)}
function readBody(req,max=32768){return new Promise((resolve,reject)=>{let size=0,a=[];req.on('data',c=>{size+=c.length;if(size>max){reject(new Error('Payload too large'));req.destroy();return}a.push(c)});req.on('end',()=>resolve(Buffer.concat(a)));req.on('error',reject)})}
function tokenFor(u,deviceId){const now=Date.now(),exp=now+TOKEN_DAYS*86400000;return {token:sign({v:2,kind:'device',userId:u.userId,deviceId,iat:now,exp}),expiresAt:new Date(exp).toISOString()}}
function publicUser(u){return {userId:u.userId,nickname:u.nickname,status:u.status,role:u.role||'user',createdAt:u.createdAt,approvedAt:u.approvedAt||null,devices:(u.devices||[]).map(d=>({deviceId:d.deviceId,label:d.label||'',createdAt:d.createdAt,lastSeenAt:d.lastSeenAt||null}))}}
function findByToken(req,db){const p=verify(String(req.headers['x-motolab-beta-token']||''));if(!p||!p.deviceId)return null;const u=(db.users||[]).find(x=>x.userId===p.userId||(x.devices||[]).some(d=>d.deviceId===p.deviceId));if(!u)return null;const d=(u.devices||[]).find(x=>x.deviceId===p.deviceId);return d?{p,u,d}:null}
function promote(db,u,deviceId,source){const now=new Date().toISOString();u.nickname=OWNER_NICKNAME;u.role='admin';u.status='active';u.approvedAt=u.approvedAt||now;u.ownerClaimedAt=now;u.ownerClaimedDeviceId=deviceId;u.ownerClaimSource=source;writeUsers(db);return u}
function bootstrapUsed(){return !!readJson(BOOTSTRAP_FILE,null)?.usedAt}
function markBootstrap(u,deviceId){atomic(BOOTSTRAP_FILE,{schema:'motolab_owner_bootstrap_v1',usedAt:new Date().toISOString(),userId:u.userId,deviceId})}

async function claimOnce(req,res){
 if(!BETA_SECRET)return send(res,503,{ok:false,error:'Device identity is not configured'});
 const db=readUsers(),x=findByToken(req,db);if(!x)return send(res,401,{ok:false,error:'Valid MotoLab device session required'});
 if(x.u.role==='admin')return send(res,200,{ok:true,...tokenFor(x.u,x.p.deviceId),user:publicUser(x.u),owner:true,alreadyOwner:true});
 if((db.users||[]).some(u=>u.role==='admin')||bootstrapUsed())return send(res,409,{ok:false,error:'Owner bootstrap already used'});
 let data;try{data=JSON.parse((await readBody(req)).toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'})}
 if(!eq(hash(String(data.code||'').trim()),BOOTSTRAP_HASH))return send(res,403,{ok:false,error:'Owner password invalid'});
 const u=promote(db,x.u,x.p.deviceId,'single_use_bootstrap');markBootstrap(u,x.p.deviceId);
 return send(res,200,{ok:true,...tokenFor(u,x.p.deviceId),user:publicUser(u),owner:true,bootstrapConsumed:true});
}

async function recoverOwner(req,res){
 if(!BETA_SECRET)return send(res,503,{ok:false,error:'Device identity is not configured'});
 if(!RECOVERY_SECRET)return send(res,503,{ok:false,error:'Owner recovery is not configured'});
 let data;try{data=JSON.parse((await readBody(req)).toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'})}
 const code=String(data.code||'').trim(),deviceId=safe(data.deviceId),label=String(data.deviceLabel||'Recovered device').slice(0,80);
 if(!deviceId||!code)return send(res,400,{ok:false,error:'Recovery code and deviceId required'});
 if(!eq(code,RECOVERY_SECRET))return send(res,403,{ok:false,error:'Owner recovery code invalid'});
 const db=readUsers(),u=(db.users||[]).find(x=>x.role==='admin');
 if(!u)return send(res,409,{ok:false,error:'No owner account exists; use first-owner activation'});
 const now=new Date().toISOString();u.nickname=OWNER_NICKNAME;u.status='active';u.role='admin';u.devices=Array.isArray(u.devices)?u.devices:[];
 let d=u.devices.find(x=>x.deviceId===deviceId);
 if(!d){d={deviceId,label,createdAt:now,lastSeenAt:now,recoveredAt:now};u.devices.push(d)}else{d.lastSeenAt=now;d.recoveredAt=now;if(label)d.label=label}
 u.ownerRecoveredAt=now;u.ownerRecoveredDeviceId=deviceId;writeUsers(db);
 return send(res,200,{ok:true,...tokenFor(u,deviceId),user:publicUser(u),owner:true,recovered:true});
}

http.createServer=function(listener){return originalCreateServer(async(req,res)=>{
 let u;try{u=new URL(req.url,'http://localhost')}catch{return listener(req,res)}
 if(req.method==='POST'&&u.pathname==='/api/users/v1/claim-owner-once')return claimOnce(req,res);
 if(req.method==='POST'&&u.pathname==='/api/users/v1/owner-recovery')return recoverOwner(req,res);
 return listener(req,res);
})};
console.log(`MotoLab owner recovery layer: bootstrap=single-use; recovery=${RECOVERY_SECRET?'configured':'not configured'}`);
