'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const originalCreateServer=http.createServer.bind(http);
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const BETA_SECRET=String(process.env.BETA_TOKEN_SECRET||'');
const READ_KEY=String(process.env.LIVE_READ_KEY||process.env.READ_KEY||'');
const ALLOWED_ORIGIN=process.env.ALLOWED_ORIGIN||'https://anttivanttinen-max.github.io';
const USERS_FILE=path.join(DATA_DIR,'users','registry.json');
const LIVE_DIR=path.join(DATA_DIR,'users','live');
const MAX_BODY=128*1024;

function unb64(v){return Buffer.from(v,'base64url').toString('utf8')}
function verify(token){
 if(!BETA_SECRET||!token)return null;
 const [body,sig]=String(token).split('.');if(!body||!sig)return null;
 const expected=crypto.createHmac('sha256',BETA_SECRET).update(body).digest('base64url');
 const a=Buffer.from(sig),b=Buffer.from(expected);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
 try{const p=JSON.parse(unb64(body));if(p.exp&&Date.now()>p.exp)return null;return p}catch{return null}
}
function eq(a,b){const aa=Buffer.from(String(a||'')),bb=Buffer.from(String(b||''));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function safe(v,n=160){return String(v||'').replace(/[^a-zA-Z0-9._:-]/g,'_').slice(0,n)}
function send(res,status,obj,origin=''){
 const body=Buffer.from(JSON.stringify(obj));
 const h={'Content-Type':'application/json; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'};
 if(origin===ALLOWED_ORIGIN){h['Access-Control-Allow-Origin']=origin;h['Vary']='Origin'}
 res.writeHead(status,h);res.end(body)
}
function readBody(req){return new Promise((resolve,reject)=>{let size=0,a=[];req.on('data',c=>{size+=c.length;if(size>MAX_BODY){reject(Object.assign(new Error('Payload too large'),{status:413}));req.destroy();return}a.push(c)});req.on('end',()=>resolve(Buffer.concat(a)));req.on('error',reject)})}
function identity(req){
 const p=verify(String(req.headers['x-motolab-beta-token']||''));
 if(!p||!p.userId||!p.deviceId)return null;
 const db=readJson(USERS_FILE,{users:[]});const u=(db.users||[]).find(x=>x.userId===p.userId);
 if(!u||u.status!=='active'||!(u.devices||[]).some(d=>d.deviceId===p.deviceId))return null;
 return {payload:p,user:u};
}
function atomicJson(file,obj){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+process.pid+'-'+Date.now();fs.writeFileSync(tmp,JSON.stringify(obj));fs.renameSync(tmp,file)}
function num(v,fallback=null){const x=Number(v);return Number.isFinite(x)?x:fallback}
function clamp(v,lo,hi,fallback=0){const x=num(v,fallback);return Math.max(lo,Math.min(hi,x))}
function normalizeTelemetry(t){
 const ts=num(t?.t,Date.now());
 return {
  t:Math.round(ts),sessionId:safe(t?.sessionId||'live'),seq:Math.max(0,Math.round(num(t?.seq,0))),
  kmh:Math.max(0,num(t?.kmh,0)),rpm:Math.max(0,Math.round(num(t?.rpm,0))),gear:num(t?.gear,null),
  confidence:clamp(t?.confidence,0,1,0),quality:clamp(t?.quality,0,100,0),
  source:String(t?.source||'').slice(0,48),fusionMode:String(t?.fusionMode||'').slice(0,48),
  gpsAgeMs:num(t?.gpsAgeMs,null),gpsAcc:num(t?.gpsAcc,null),hp:num(t?.hp,0),nm:num(t?.nm,0),
  accelMps2:num(t?.accelMps2,null),pageVisible:t?.pageVisible===true
 };
}

http.createServer=function(listener){return originalCreateServer(async(req,res)=>{
 const origin=String(req.headers.origin||'');let u;try{u=new URL(req.url,'http://localhost')}catch{return listener(req,res)}
 const isPost=u.pathname==='/api/users/v1/live-telemetry';
 const isRead=u.pathname==='/api/live/v1/latest';
 if(req.method==='OPTIONS'&&(isPost||isRead)){
  if(origin&&origin!==ALLOWED_ORIGIN){res.writeHead(403);return res.end()}
  res.writeHead(204,{'Access-Control-Allow-Origin':origin||ALLOWED_ORIGIN,'Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-MotoLab-Beta-Token,X-MotoLab-Read-Key','Access-Control-Max-Age':'86400'});return res.end()
 }
 if(req.method==='POST'&&isPost){
  const x=identity(req);if(!x)return send(res,401,{ok:false,error:'Active user session required'},origin);
  let data;try{data=JSON.parse((await readBody(req)).toString('utf8'))}catch(e){return send(res,e.status||400,{ok:false,error:e.message||'Invalid JSON'},origin)}
  if(!data||typeof data.telemetry!=='object')return send(res,400,{ok:false,error:'Telemetry required'},origin);
  const tel=normalizeTelemetry(data.telemetry),now=Date.now(),age=now-tel.t;
  if(age>120000||age< -30000)return send(res,409,{ok:false,error:'Telemetry timestamp out of range'},origin);
  const item={schema:'motolab_user_live_v1',moduleVersion:String(data.moduleVersion||'').slice(0,80),userId:x.user.userId,deviceId:x.payload.deviceId,receivedAt:new Date(now).toISOString(),telemetry:tel};
  atomicJson(path.join(LIVE_DIR,safe(x.user.userId),'latest.json'),item);
  return send(res,201,{ok:true,userId:x.user.userId,receivedAt:item.receivedAt,sessionId:tel.sessionId,seq:tel.seq},origin)
 }
 if(req.method==='GET'&&isRead){
  if(!READ_KEY||!eq(req.headers['x-motolab-read-key']||u.searchParams.get('readKey')||'',READ_KEY))return send(res,401,{ok:false,error:'Invalid read key'},origin);
  const userId=safe(u.searchParams.get('userId')||'');if(!userId)return send(res,400,{ok:false,error:'userId required'},origin);
  const item=readJson(path.join(LIVE_DIR,userId,'latest.json'),null);if(!item)return send(res,404,{ok:false,error:'Live telemetry not found'},origin);
  const receivedMs=Date.parse(item.receivedAt||'')||0,ageMs=Math.max(0,Date.now()-receivedMs);
  return send(res,200,{ok:true,ageMs,fresh:ageMs<=15000,item},origin)
 }
 return listener(req,res)
})};
console.log('MotoLab Railway live telemetry endpoint enabled');
