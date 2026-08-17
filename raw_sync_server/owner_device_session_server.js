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
const TOKEN_DAYS=Math.max(7,Number(process.env.MOTOLAB_DEVICE_TOKEN_DAYS||365));
function b64(v){return Buffer.from(v).toString('base64url')}
function sign(payload){const body=b64(JSON.stringify(payload));const sig=crypto.createHmac('sha256',BETA_SECRET).update(body).digest('base64url');return `${body}.${sig}`}
function safe(v,n=160){return String(v||'').trim().replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,n)}
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+process.pid+'-'+Date.now();fs.writeFileSync(tmp,data);fs.renameSync(tmp,file)}
function send(res,status,obj,origin=''){const body=Buffer.from(JSON.stringify(obj));const h={'Content-Type':'application/json; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'};if(origin===ALLOWED_ORIGIN){h['Access-Control-Allow-Origin']=origin;h['Vary']='Origin'}res.writeHead(status,h);res.end(body)}
function readBody(req,max=32768){return new Promise((resolve,reject)=>{let size=0,a=[];req.on('data',c=>{size+=c.length;if(size>max){reject(new Error('Payload too large'));req.destroy();return}a.push(c)});req.on('end',()=>resolve(Buffer.concat(a)));req.on('error',reject)})}
function publicUser(u){return {userId:u.userId,nickname:u.nickname,status:u.status,role:u.role||'user',invitedBy:u.invitedBy||null,createdAt:u.createdAt,approvedAt:u.approvedAt||null,devices:(u.devices||[]).map(d=>({deviceId:d.deviceId,label:d.label||'',createdAt:d.createdAt,lastSeenAt:d.lastSeenAt||null}))}}
function tokenFor(u,deviceId){const now=Date.now(),exp=now+TOKEN_DAYS*86400000;return {token:sign({v:2,kind:'device',userId:u.userId,deviceId,iat:now,exp}),expiresAt:new Date(exp).toISOString()}}
async function restore(req,res,origin){
 if(!BETA_SECRET)return send(res,503,{ok:false,error:'Device identity is not configured'},origin);
 let data;try{data=JSON.parse((await readBody(req)).toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'},origin)}
 const deviceId=safe(data.deviceId),label=String(data.deviceLabel||'').slice(0,80);if(!deviceId)return send(res,400,{ok:false,error:'deviceId required'},origin);
 const db=readJson(USERS_FILE,{schema:'motolab_users_v1',users:[]});
 const u=(db.users||[]).find(x=>x.role==='admin'&&x.status==='active'&&(x.devices||[]).some(d=>d.deviceId===deviceId));
 if(!u)return send(res,404,{ok:false,error:'No active owner session for this device'},origin);
 const d=(u.devices||[]).find(x=>x.deviceId===deviceId),now=new Date().toISOString();d.lastSeenAt=now;if(label)d.label=label;u.ownerSessionRestoredAt=now;db.updatedAt=now;atomic(USERS_FILE,JSON.stringify(db,null,2));
 return send(res,200,{ok:true,...tokenFor(u,deviceId),user:publicUser(u),owner:true,sameDevice:true},origin)
}
http.createServer=function(listener){return originalCreateServer(async(req,res)=>{let u;try{u=new URL(req.url,'http://localhost')}catch{return listener(req,res)}const origin=String(req.headers.origin||'');if(req.method==='POST'&&u.pathname==='/api/users/v1/owner-device-session')return restore(req,res,origin);return listener(req,res)})};
console.log('MotoLab owner same-device session recovery: enabled');
