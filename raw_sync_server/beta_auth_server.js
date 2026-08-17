'use strict';
require('./user_server');
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const originalCreateServer=http.createServer.bind(http);
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const INGEST_KEY=String(process.env.INGEST_KEY||'');
const BETA_SECRET=String(process.env.BETA_TOKEN_SECRET||'');
const INVITE_CODES=String(process.env.BETA_INVITE_CODES||'').split(',').map(x=>x.trim()).filter(Boolean);
const MAX_DEVICES=Math.max(1,Number(process.env.BETA_MAX_DEVICES||2));
const ALLOWED_ORIGIN=process.env.ALLOWED_ORIGIN||'https://anttivanttinen-max.github.io';
const CLAIMS_FILE=path.join(DATA_DIR,'beta','claims.json');

function b64(v){return Buffer.from(v).toString('base64url')}
function unb64(v){return Buffer.from(v,'base64url').toString('utf8')}
function hash(v){return crypto.createHash('sha256').update(String(v||'')).digest('hex')}
function sign(payload){const body=b64(JSON.stringify(payload));const sig=crypto.createHmac('sha256',BETA_SECRET).update(body).digest('base64url');return `${body}.${sig}`}
function verify(token){if(!BETA_SECRET||!token)return null;const [body,sig]=String(token).split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',BETA_SECRET).update(body).digest('base64url');const a=Buffer.from(sig),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;try{const p=JSON.parse(unb64(body));if(p.exp&&Date.now()>p.exp)return null;return p}catch{return null}}
function readClaims(){try{return JSON.parse(fs.readFileSync(CLAIMS_FILE,'utf8'))}catch{return {schema:'motolab_beta_claims_v1',invites:{}}}}
function writeClaims(x){fs.mkdirSync(path.dirname(CLAIMS_FILE),{recursive:true});const tmp=CLAIMS_FILE+'.tmp-'+process.pid;fs.writeFileSync(tmp,JSON.stringify(x,null,2));fs.renameSync(tmp,CLAIMS_FILE)}
function send(res,status,obj,origin=''){const body=Buffer.from(JSON.stringify(obj));const h={'Content-Type':'application/json; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'};if(origin===ALLOWED_ORIGIN){h['Access-Control-Allow-Origin']=origin;h['Vary']='Origin'}res.writeHead(status,h);res.end(body)}
function readBody(req,max=65536){return new Promise((resolve,reject)=>{let size=0,a=[];req.on('data',c=>{size+=c.length;if(size>max){reject(new Error('Payload too large'));req.destroy();return}a.push(c)});req.on('end',()=>resolve(Buffer.concat(a)));req.on('error',reject)})}
function inviteValid(code){return INVITE_CODES.some(x=>{const a=Buffer.from(x),b=Buffer.from(String(code||''));return a.length===b.length&&crypto.timingSafeEqual(a,b)})}
async function activate(req,res,origin){if(!BETA_SECRET||!INVITE_CODES.length)return send(res,503,{ok:false,error:'Beta invitations are not configured'},origin);let data;try{data=JSON.parse((await readBody(req)).toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'},origin)}const code=String(data.code||'').trim(),deviceId=String(data.deviceId||'').trim();if(!code||!deviceId)return send(res,400,{ok:false,error:'Invitation code and deviceId required'},origin);if(!inviteValid(code))return send(res,401,{ok:false,error:'Invalid invitation'},origin);const key=hash(code),claims=readClaims(),item=claims.invites[key]||{devices:[],createdAt:new Date().toISOString()};if(!item.devices.includes(deviceId)){if(item.devices.length>=MAX_DEVICES)return send(res,403,{ok:false,error:'Invitation device limit reached'},origin);item.devices.push(deviceId)}item.lastActivatedAt=new Date().toISOString();claims.invites[key]=item;writeClaims(claims);const now=Date.now(),token=sign({v:1,invite:key.slice(0,16),deviceId,iat:now,exp:now+1000*60*60*24*90});return send(res,200,{ok:true,token,deviceId,maxDevices:MAX_DEVICES,expiresAt:new Date(now+1000*60*60*24*90).toISOString()},origin)}
async function validate(req,res,origin){let data;try{data=JSON.parse((await readBody(req)).toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'},origin)}const p=verify(data.token);if(!p||String(data.deviceId||'')!==String(p.deviceId||''))return send(res,401,{ok:false,error:'Invalid beta token'},origin);return send(res,200,{ok:true,deviceId:p.deviceId,expiresAt:new Date(p.exp).toISOString()},origin)}

http.createServer=function(listener){return originalCreateServer(async(req,res)=>{const origin=String(req.headers.origin||'');let u;try{u=new URL(req.url,'http://localhost')}catch{return listener(req,res)}
 if(req.method==='OPTIONS'&&origin===ALLOWED_ORIGIN){res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,HEAD,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-MotoLab-Ingest-Key,X-MotoLab-Read-Key,X-MotoLab-Beta-Token','Access-Control-Max-Age':'86400'});return res.end()}
 if(req.method==='POST'&&u.pathname==='/api/beta/v1/activate')return activate(req,res,origin);
 if(req.method==='POST'&&u.pathname==='/api/beta/v1/validate')return validate(req,res,origin);
 const betaToken=String(req.headers['x-motolab-beta-token']||'');if(betaToken){const p=verify(betaToken);if(!p)return send(res,401,{ok:false,error:'Invalid beta token'},origin);if((u.pathname==='/api/raw/v1/chunk'||u.pathname.startsWith('/api/research/v1/'))&&INGEST_KEY)req.headers['x-motolab-ingest-key']=INGEST_KEY;req.betaIdentity=p}
 return listener(req,res)});
};
console.log(`MotoLab beta auth layer: ${BETA_SECRET&&INVITE_CODES.length?'enabled':'not configured'}; invites=${INVITE_CODES.length}; maxDevices=${MAX_DEVICES}`);
