'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const originalCreateServer=http.createServer.bind(http);
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const BETA_SECRET=String(process.env.BETA_TOKEN_SECRET||'');
const STATIC_INVITES=String(process.env.BETA_INVITE_CODES||'').split(',').map(x=>x.trim()).filter(Boolean);
const ADMIN_DEVICE_IDS=String(process.env.MOTOLAB_ADMIN_DEVICE_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
const ALLOWED_ORIGIN=process.env.ALLOWED_ORIGIN||'https://anttivanttinen-max.github.io';
const USERS_FILE=path.join(DATA_DIR,'users','registry.json');
const INVITES_FILE=path.join(DATA_DIR,'users','invites.json');
const USER_STATE_DIR=path.join(DATA_DIR,'users','state');
const TOKEN_DAYS=Math.max(7,Number(process.env.MOTOLAB_DEVICE_TOKEN_DAYS||365));
const MAX_STATE_BYTES=Math.max(65536,Number(process.env.MOTOLAB_USER_STATE_MAX_BYTES||2*1024*1024));

function b64(v){return Buffer.from(v).toString('base64url')}
function unb64(v){return Buffer.from(v,'base64url').toString('utf8')}
function hash(v){return crypto.createHash('sha256').update(String(v||'')).digest('hex')}
function safe(v,n=160){return String(v||'').trim().replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,n)}
function id(prefix){return prefix+'_'+crypto.randomBytes(12).toString('hex')}
function eq(a,b){const aa=Buffer.from(String(a||'')),bb=Buffer.from(String(b||''));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
function sign(payload){const body=b64(JSON.stringify(payload));const sig=crypto.createHmac('sha256',BETA_SECRET).update(body).digest('base64url');return `${body}.${sig}`}
function verify(token){if(!BETA_SECRET||!token)return null;const [body,sig]=String(token).split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',BETA_SECRET).update(body).digest('base64url');const a=Buffer.from(sig),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;try{const p=JSON.parse(unb64(body));if(p.exp&&Date.now()>p.exp)return null;return p}catch{return null}}
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+process.pid+'-'+Date.now();fs.writeFileSync(tmp,data);fs.renameSync(tmp,file)}
function readUsers(){return readJson(USERS_FILE,{schema:'motolab_users_v1',users:[]})}
function writeUsers(x){x.updatedAt=new Date().toISOString();atomic(USERS_FILE,JSON.stringify(x,null,2))}
function readInvites(){return readJson(INVITES_FILE,{schema:'motolab_user_invites_v1',invites:[]})}
function writeInvites(x){x.updatedAt=new Date().toISOString();atomic(INVITES_FILE,JSON.stringify(x,null,2))}
function send(res,status,obj,origin=''){const body=Buffer.from(JSON.stringify(obj));const h={'Content-Type':'application/json; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'};if(origin===ALLOWED_ORIGIN){h['Access-Control-Allow-Origin']=origin;h['Vary']='Origin'}res.writeHead(status,h);res.end(body)}
function readBody(req,max=65536){return new Promise((resolve,reject)=>{let size=0,a=[];req.on('data',c=>{size+=c.length;if(size>max){reject(Object.assign(new Error('Payload too large'),{status:413}));req.destroy();return}a.push(c)});req.on('end',()=>resolve(Buffer.concat(a)));req.on('error',reject)})}
function normalizeNickname(v){return String(v||'').trim().replace(/[<>\r\n]/g,'').slice(0,32)}
function findUser(db,userId){return db.users.find(u=>u.userId===userId)||null}
function findByDevice(db,deviceId){return db.users.find(u=>(u.devices||[]).some(d=>d.deviceId===deviceId))||null}
function publicUser(u){return {userId:u.userId,nickname:u.nickname,status:u.status,role:u.role||'user',invitedBy:u.invitedBy||null,createdAt:u.createdAt,approvedAt:u.approvedAt||null,devices:(u.devices||[]).map(d=>({deviceId:d.deviceId,label:d.label||'',createdAt:d.createdAt,lastSeenAt:d.lastSeenAt||null}))}}
function tokenFor(u,deviceId){const now=Date.now(),exp=now+TOKEN_DAYS*86400000;return {token:sign({v:2,kind:'device',userId:u.userId,deviceId,iat:now,exp}),expiresAt:new Date(exp).toISOString()}}
function staticInviteIndex(code){return STATIC_INVITES.findIndex(x=>eq(x,code))}
function consumeInvite(code,deviceId){const now=Date.now(),db=readInvites(),item=db.invites.find(x=>x.codeHash===hash(code)&&!x.usedAt&&Date.parse(x.expiresAt||0)>now);if(item){item.usedAt=new Date().toISOString();item.usedByDeviceId=deviceId;writeInvites(db);return {ok:true,invitedBy:item.createdByUserId,inviteId:item.inviteId}}const i=staticInviteIndex(code);return i>=0?{ok:true,invitedBy:null,inviteId:'static_'+hash(code).slice(0,12),staticIndex:i}:{ok:false}}
function migrateLegacy(p,db){if(!p||p.v!==1||!p.deviceId||!p.invite)return null;const i=STATIC_INVITES.findIndex(code=>hash(code).slice(0,16)===p.invite);if(i<0)return null;const admin=(i===0&&!db.users.some(x=>x.role==='admin'))||ADMIN_DEVICE_IDS.includes(p.deviceId);const u={userId:id('usr'),nickname:admin?'Owner':'MotoLab user',status:'active',role:admin?'admin':'user',invitedBy:null,inviteId:'legacy_'+p.invite,createdAt:new Date().toISOString(),approvedAt:new Date().toISOString(),legacyMigrated:true,devices:[{deviceId:p.deviceId,label:'Legacy beta device',createdAt:new Date().toISOString(),lastSeenAt:new Date().toISOString()}]};db.users.push(u);writeUsers(db);return u}
function identity(req){const p=verify(String(req.headers['x-motolab-beta-token']||''));if(!p||!p.deviceId)return null;const db=readUsers();let u=p.userId?findUser(db,p.userId):findByDevice(db,p.deviceId);if(!u)u=migrateLegacy(p,db);if(!u)return null;const d=(u.devices||[]).find(x=>x.deviceId===p.deviceId);if(!d)return null;d.lastSeenAt=new Date().toISOString();writeUsers(db);return {payload:p,user:u,device:d}}
function requireIdentity(req,res,origin,{active=false,admin=false}={}){const x=identity(req);if(!x){send(res,401,{ok:false,error:'Invalid device session'},origin);return null}if(active&&x.user.status!=='active'){send(res,403,{ok:false,error:'User not approved',status:x.user.status,user:publicUser(x.user)},origin);return null}if(admin&&x.user.role!=='admin'){send(res,403,{ok:false,error:'Admin required'},origin);return null}return x}
async function registerData(data,res,origin,legacyStatus=201){if(!BETA_SECRET)return send(res,503,{ok:false,error:'Device identity is not configured'},origin);const deviceId=safe(data.deviceId),nickname=normalizeNickname(data.nickname||'MotoLab user'),code=String(data.invite||data.code||'').trim(),label=String(data.deviceLabel||'').slice(0,80);if(!deviceId||!code)return send(res,400,{ok:false,error:'Invitation and deviceId required'},origin);const db=readUsers();let u=findByDevice(db,deviceId);if(!u){const inv=consumeInvite(code,deviceId);if(!inv.ok)return send(res,401,{ok:false,error:'Invalid invitation'},origin);const admin=ADMIN_DEVICE_IDS.includes(deviceId);u={userId:id('usr'),nickname:nickname||'MotoLab user',status:admin?'active':'pending',role:admin?'admin':'user',invitedBy:inv.invitedBy||null,inviteId:inv.inviteId,createdAt:new Date().toISOString(),approvedAt:admin?new Date().toISOString():null,devices:[{deviceId,label,createdAt:new Date().toISOString(),lastSeenAt:new Date().toISOString()}]};db.users.push(u);writeUsers(db)}else if(nickname&&nickname!=='MotoLab user'&&u.nickname!==nickname){u.nickname=nickname;writeUsers(db)}const t=tokenFor(u,deviceId);return send(res,legacyStatus,{ok:true,...t,deviceId,user:publicUser(u),status:u.status},origin)}
async function register(req,res,origin,status=201){let data;try{data=JSON.parse((await readBody(req)).toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'},origin)}return registerData(data,res,origin,status)}
async function validate(req,res,origin){let data;try{data=JSON.parse((await readBody(req)).toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'},origin)}const p=verify(data.token);if(!p||String(data.deviceId||'')!==String(p.deviceId||''))return send(res,401,{ok:false,error:'Invalid beta token'},origin);const fake={headers:{'x-motolab-beta-token':data.token}},x=identity(fake);if(!x)return send(res,401,{ok:false,error:'Unknown device'},origin);return send(res,200,{ok:true,deviceId:p.deviceId,user:publicUser(x.user),status:x.user.status,expiresAt:p.exp?new Date(p.exp).toISOString():null},origin)}
async function nickname(req,res,origin){const x=requireIdentity(req,res,origin);if(!x)return;let data;try{data=JSON.parse((await readBody(req)).toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'},origin)}const n=normalizeNickname(data.nickname);if(!n)return send(res,400,{ok:false,error:'Nickname required'},origin);const db=readUsers(),u=findUser(db,x.user.userId);u.nickname=n;writeUsers(db);return send(res,200,{ok:true,user:publicUser(u)},origin)}
async function createInvite(req,res,origin){const x=requireIdentity(req,res,origin,{active:true});if(!x)return;const code=crypto.randomBytes(18).toString('base64url'),now=Date.now(),db=readInvites(),item={inviteId:id('inv'),codeHash:hash(code),createdByUserId:x.user.userId,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+7*86400000).toISOString(),usedAt:null};db.invites.push(item);writeInvites(db);return send(res,201,{ok:true,inviteId:item.inviteId,invite:code,expiresAt:item.expiresAt},origin)}
function stateFile(userId){return path.join(USER_STATE_DIR,safe(userId,100)+'.json')}
function getState(req,res,origin){const x=requireIdentity(req,res,origin,{active:true});if(!x)return;const item=readJson(stateFile(x.user.userId),null)||{schema:'motolab_user_state_v1',userId:x.user.userId,updatedAt:null,revision:null,state:{}};return send(res,200,{ok:true,item},origin)}
async function putState(req,res,origin){const x=requireIdentity(req,res,origin,{active:true});if(!x)return;let body;try{body=await readBody(req,MAX_STATE_BYTES)}catch(e){return send(res,e.status||400,{ok:false,error:e.message},origin)}let data;try{data=JSON.parse(body.toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'},origin)}const item={schema:'motolab_user_state_v1',userId:x.user.userId,updatedAt:new Date().toISOString(),revision:id('rev'),state:data.state??data};atomic(stateFile(x.user.userId),JSON.stringify(item));return send(res,200,{ok:true,revision:item.revision,updatedAt:item.updatedAt},origin)}
function listUsers(req,res,origin){const x=requireIdentity(req,res,origin,{admin:true});if(!x)return;const db=readUsers();return send(res,200,{ok:true,users:db.users.map(publicUser).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))},origin)}
async function userStatus(req,res,origin){const x=requireIdentity(req,res,origin,{admin:true});if(!x)return;let data;try{data=JSON.parse((await readBody(req)).toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'},origin)}const status=String(data.status||''),db=readUsers(),u=findUser(db,String(data.userId||''));if(!u)return send(res,404,{ok:false,error:'User not found'},origin);if(!['active','pending','blocked'].includes(status))return send(res,400,{ok:false,error:'Invalid status'},origin);if(u.role==='admin'&&status!=='active')return send(res,400,{ok:false,error:'Admin cannot be blocked here'},origin);u.status=status;u.approvedAt=status==='active'?(u.approvedAt||new Date().toISOString()):null;u.statusChangedAt=new Date().toISOString();u.statusChangedBy=x.user.userId;writeUsers(db);return send(res,200,{ok:true,user:publicUser(u)},origin)}

http.createServer=function(listener){return originalCreateServer(async(req,res)=>{const origin=String(req.headers.origin||'');let u;try{u=new URL(req.url,'http://localhost')}catch{return listener(req,res)}
 if(req.method==='OPTIONS'&&origin===ALLOWED_ORIGIN&&(u.pathname.startsWith('/api/users/')||u.pathname.startsWith('/api/admin/'))){res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,PUT,HEAD,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-MotoLab-Beta-Token','Access-Control-Max-Age':'86400'});return res.end()}
 if(req.method==='POST'&&u.pathname==='/api/users/v1/register')return register(req,res,origin,201);
 if(req.method==='POST'&&u.pathname==='/api/beta/v1/activate')return register(req,res,origin,200);
 if(req.method==='POST'&&u.pathname==='/api/beta/v1/validate')return validate(req,res,origin);
 if(req.method==='GET'&&u.pathname==='/api/users/v1/me'){const x=requireIdentity(req,res,origin);if(!x)return;return send(res,200,{ok:true,user:publicUser(x.user)},origin)}
 if(req.method==='POST'&&u.pathname==='/api/users/v1/nickname')return nickname(req,res,origin);
 if(req.method==='POST'&&u.pathname==='/api/users/v1/invite')return createInvite(req,res,origin);
 if(req.method==='GET'&&u.pathname==='/api/users/v1/state')return getState(req,res,origin);
 if(req.method==='PUT'&&u.pathname==='/api/users/v1/state')return putState(req,res,origin);
 if(req.method==='GET'&&u.pathname==='/api/admin/v1/users')return listUsers(req,res,origin);
 if(req.method==='POST'&&u.pathname==='/api/admin/v1/user-status')return userStatus(req,res,origin);
 const t=String(req.headers['x-motolab-beta-token']||'');if(t&&(u.pathname==='/api/raw/v1/chunk'||u.pathname.startsWith('/api/research/v1/'))){const x=requireIdentity(req,res,origin,{active:true});if(!x)return;req.motolabUser={userId:x.user.userId,deviceId:x.device.deviceId,status:x.user.status,role:x.user.role}}
 return listener(req,res)});};
console.log(`MotoLab user server: ${BETA_SECRET?'enabled':'not configured'}; staticInvites=${STATIC_INVITES.length}; adminDevices=${ADMIN_DEVICE_IDS.length}`);
