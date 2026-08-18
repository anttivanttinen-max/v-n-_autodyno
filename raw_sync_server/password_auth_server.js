'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const originalCreateServer=http.createServer.bind(http);
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const USERS_FILE=path.join(DATA_DIR,'users','registry.json');
const BETA_SECRET=String(process.env.BETA_TOKEN_SECRET||'');
const ALLOWED_ORIGIN=process.env.ALLOWED_ORIGIN||'https://anttivanttinen-max.github.io';
const TOKEN_DAYS=Math.max(7,Number(process.env.MOTOLAB_DEVICE_TOKEN_DAYS||365));
const MIN_PASSWORD=8;
const attemptBuckets=new Map();

function b64(v){return Buffer.from(v).toString('base64url')}
function unb64(v){return Buffer.from(v,'base64url').toString('utf8')}
function safe(v,n=160){return String(v||'').trim().replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,n)}
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+process.pid+'-'+Date.now();fs.writeFileSync(tmp,data);fs.renameSync(tmp,file)}
function writeUsers(db){db.updatedAt=new Date().toISOString();atomic(USERS_FILE,JSON.stringify(db,null,2))}
function send(res,status,obj,origin=''){const body=Buffer.from(JSON.stringify(obj));const h={'Content-Type':'application/json; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'};if(origin===ALLOWED_ORIGIN){h['Access-Control-Allow-Origin']=origin;h['Vary']='Origin'}res.writeHead(status,h);res.end(body)}
function readBody(req,max=32768){return new Promise((resolve,reject)=>{let size=0,a=[];req.on('data',c=>{size+=c.length;if(size>max){reject(new Error('Payload too large'));req.destroy();return}a.push(c)});req.on('end',()=>resolve(Buffer.concat(a)));req.on('error',reject)})}
function sign(payload){const body=b64(JSON.stringify(payload));const sig=crypto.createHmac('sha256',BETA_SECRET).update(body).digest('base64url');return `${body}.${sig}`}
function verifyToken(token){if(!BETA_SECRET||!token)return null;const [body,sig]=String(token).split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',BETA_SECRET).update(body).digest('base64url');const a=Buffer.from(sig),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;try{const p=JSON.parse(unb64(body));if(p.exp&&Date.now()>p.exp)return null;return p}catch{return null}}
function tokenFor(u,deviceId){const now=Date.now(),exp=now+TOKEN_DAYS*86400000;return {token:sign({v:2,kind:'device',userId:u.userId,deviceId,iat:now,exp}),expiresAt:new Date(exp).toISOString()}}
function publicUser(u){return {userId:u.userId,nickname:u.nickname,status:u.status,role:u.role||'user',invitedBy:u.invitedBy||null,createdAt:u.createdAt,approvedAt:u.approvedAt||null,devices:(u.devices||[]).map(d=>({deviceId:d.deviceId,label:d.label||'',createdAt:d.createdAt,lastSeenAt:d.lastSeenAt||null})),passwordSet:!!u.passwordAuth}}
function nicknameValue(v){return String(v||'').trim().replace(/[<>\r\n]/g,'').slice(0,32)}
function nicknameKey(v){return nicknameValue(v).toLocaleLowerCase('fi-FI')}
function validPassword(v){return typeof v==='string'&&v.length>=MIN_PASSWORD&&v.length<=128}
function makePassword(password){const salt=crypto.randomBytes(16),derived=crypto.scryptSync(password,salt,64);return {scheme:'scrypt-v1',salt:salt.toString('base64'),hash:derived.toString('base64'),setAt:new Date().toISOString()}}
function matchesPassword(u,password){const a=u?.passwordAuth;if(!a||a.scheme!=='scrypt-v1'||!a.salt||!a.hash)return false;try{const expected=Buffer.from(a.hash,'base64'),got=crypto.scryptSync(password,Buffer.from(a.salt,'base64'),expected.length);return expected.length===got.length&&crypto.timingSafeEqual(expected,got)}catch{return false}}
function attemptKey(req,kind,name=''){return `${kind}:${String(req.socket?.remoteAddress||'unknown')}:${nicknameKey(name)}`}
function allowAttempt(req,kind,name,limit=10,windowMs=10*60*1000){const key=attemptKey(req,kind,name),now=Date.now();let a=attemptBuckets.get(key);if(!a||now-a.start>windowMs)a={start:now,count:0};a.count++;attemptBuckets.set(key,a);if(attemptBuckets.size>2000)for(const [k,v] of attemptBuckets)if(now-v.start>windowMs)attemptBuckets.delete(k);return a.count<=limit}

async function registerPassword(req,res,origin){
 if(!BETA_SECRET)return send(res,503,{ok:false,error:'Device identity is not configured'},origin);
 let data;try{data=JSON.parse((await readBody(req)).toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'},origin)}
 const nickname=nicknameValue(data.nickname),password=String(data.password||''),deviceId=safe(data.deviceId),label=String(data.deviceLabel||'').slice(0,80);
 if(!nickname||nickname.length<2)return send(res,400,{ok:false,error:'Nickname must be at least 2 characters'},origin);
 if(!validPassword(password))return send(res,400,{ok:false,error:`Password must be ${MIN_PASSWORD}-128 characters`},origin);
 if(!deviceId)return send(res,400,{ok:false,error:'deviceId required'},origin);
 if(!allowAttempt(req,'register',nickname,6,30*60*1000))return send(res,429,{ok:false,error:'Too many registration attempts. Try again later.'},origin);
 const db=readJson(USERS_FILE,{schema:'motolab_users_v1',users:[]});
 if((db.users||[]).some(u=>nicknameKey(u.nickname)===nicknameKey(nickname)))return send(res,409,{ok:false,error:'Nickname is already in use'},origin);
 if((db.users||[]).some(u=>(u.devices||[]).some(d=>d.deviceId===deviceId)))return send(res,409,{ok:false,error:'This device is already linked to a user'},origin);
 const now=new Date().toISOString(),u={userId:'usr_'+crypto.randomBytes(12).toString('hex'),nickname,status:'pending',role:'user',invitedBy:null,inviteId:null,createdAt:now,approvedAt:null,registrationSource:'password_self_registration',passwordAuth:makePassword(password),passwordChangedAt:now,devices:[{deviceId,label,createdAt:now,lastSeenAt:now}]};
 db.users=Array.isArray(db.users)?db.users:[];db.users.push(u);writeUsers(db);
 return send(res,201,{ok:true,...tokenFor(u,deviceId),deviceId,user:publicUser(u),status:'pending',registration:true},origin)
}

async function setPassword(req,res,origin){
 const p=verifyToken(String(req.headers['x-motolab-beta-token']||''));if(!p?.userId||!p?.deviceId)return send(res,401,{ok:false,error:'Valid user session required'},origin);
 let data;try{data=JSON.parse((await readBody(req)).toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'},origin)}
 const password=String(data.password||'');if(!validPassword(password))return send(res,400,{ok:false,error:`Password must be ${MIN_PASSWORD}-128 characters`},origin);
 const db=readJson(USERS_FILE,{schema:'motolab_users_v1',users:[]}),u=(db.users||[]).find(x=>x.userId===p.userId);if(!u)return send(res,404,{ok:false,error:'User not found'},origin);
 if(!(u.devices||[]).some(d=>d.deviceId===p.deviceId))return send(res,401,{ok:false,error:'Device is not linked to user'},origin);
 u.passwordAuth=makePassword(password);u.passwordChangedAt=new Date().toISOString();writeUsers(db);
 return send(res,200,{ok:true,user:publicUser(u),passwordSet:true},origin)
}

async function passwordLogin(req,res,origin){
 if(!BETA_SECRET)return send(res,503,{ok:false,error:'Device identity is not configured'},origin);
 let data;try{data=JSON.parse((await readBody(req)).toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'},origin)}
 const nickname=nicknameKey(data.nickname),password=String(data.password||''),deviceId=safe(data.deviceId),label=String(data.deviceLabel||'').slice(0,80);
 if(!nickname||!password||!deviceId)return send(res,400,{ok:false,error:'Nickname, password and deviceId required'},origin);
 if(!allowAttempt(req,'login',nickname,12,10*60*1000))return send(res,429,{ok:false,error:'Too many login attempts. Try again later.'},origin);
 const db=readJson(USERS_FILE,{schema:'motolab_users_v1',users:[]});
 const candidates=(db.users||[]).filter(u=>nicknameKey(u.nickname)===nickname&&u.passwordAuth);
 let u=null;for(const candidate of candidates){if(matchesPassword(candidate,password)){u=candidate;break}}
 if(!u)return send(res,401,{ok:false,error:'Wrong nickname or password'},origin);
 if(u.status==='blocked')return send(res,403,{ok:false,error:'User is blocked'},origin);
 const now=new Date().toISOString();u.devices=Array.isArray(u.devices)?u.devices:[];let d=u.devices.find(x=>x.deviceId===deviceId);if(!d){d={deviceId,label,createdAt:now,lastSeenAt:now};u.devices.push(d)}else{d.lastSeenAt=now;if(label)d.label=label}u.passwordLoginAt=now;writeUsers(db);
 return send(res,200,{ok:true,...tokenFor(u,deviceId),deviceId,user:publicUser(u),status:u.status,passwordLogin:true},origin)
}

http.createServer=function(listener){return originalCreateServer(async(req,res)=>{const origin=String(req.headers.origin||'');let u;try{u=new URL(req.url,'http://localhost')}catch{return listener(req,res)}
 const passwordPaths=['/api/users/v1/password','/api/users/v1/password-login','/api/users/v1/password-register'];
 if(req.method==='OPTIONS'&&origin===ALLOWED_ORIGIN&&passwordPaths.includes(u.pathname)){res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-MotoLab-Beta-Token','Access-Control-Max-Age':'86400'});return res.end()}
 if(req.method==='POST'&&u.pathname==='/api/users/v1/password')return setPassword(req,res,origin);
 if(req.method==='POST'&&u.pathname==='/api/users/v1/password-login')return passwordLogin(req,res,origin);
 if(req.method==='POST'&&u.pathname==='/api/users/v1/password-register')return registerPassword(req,res,origin);
 return listener(req,res)
})};
console.log('MotoLab password auth: enabled (scrypt-v1, invite-free registration)');
