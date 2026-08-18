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

http.createServer=function(listener){return originalCreateServer(async(req,res)=>{
 const origin=String(req.headers.origin||'');let u;try{u=new URL(req.url,'http://localhost')}catch{return listener(req,res)}
 if(req.method==='OPTIONS'&&u.pathname==='/api/users/v1/raw-chunk'){
  if(origin&&origin!==ALLOWED_ORIGIN){res.writeHead(403);return res.end()}
  res.writeHead(204,{'Access-Control-Allow-Origin':origin||ALLOWED_ORIGIN,'Vary':'Origin','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-MotoLab-Beta-Token','Access-Control-Max-Age':'86400'});return res.end()
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
 return send(res,201,{ok:true,userId:x.user.userId,chunkId,receivedAt:item.receivedAt},origin)
})};
console.log('MotoLab authenticated user RAW endpoint enabled');
