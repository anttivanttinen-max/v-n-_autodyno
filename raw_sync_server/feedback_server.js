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
const FEEDBACK_FILE=path.join(DATA_DIR,'users','feedback.json');

function unb64(v){return Buffer.from(v,'base64url').toString('utf8')}
function verify(token){if(!BETA_SECRET||!token)return null;const [body,sig]=String(token).split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',BETA_SECRET).update(body).digest('base64url');const a=Buffer.from(sig),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;try{const p=JSON.parse(unb64(body));if(p.exp&&Date.now()>p.exp)return null;return p}catch{return null}}
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+process.pid+'-'+Date.now();fs.writeFileSync(tmp,data);fs.renameSync(tmp,file)}
function send(res,status,obj,origin=''){const body=Buffer.from(JSON.stringify(obj));const h={'Content-Type':'application/json; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'};if(origin===ALLOWED_ORIGIN){h['Access-Control-Allow-Origin']=origin;h['Vary']='Origin'}res.writeHead(status,h);res.end(body)}
function readBody(req,max=131072){return new Promise((resolve,reject)=>{let size=0,a=[];req.on('data',c=>{size+=c.length;if(size>max){reject(Object.assign(new Error('Payload too large'),{status:413}));req.destroy();return}a.push(c)});req.on('end',()=>resolve(Buffer.concat(a)));req.on('error',reject)})}
function identity(req){const p=verify(String(req.headers['x-motolab-beta-token']||''));if(!p||!p.deviceId)return null;const db=readJson(USERS_FILE,{users:[]});const u=(p.userId?db.users.find(x=>x.userId===p.userId):null)||db.users.find(x=>(x.devices||[]).some(d=>d.deviceId===p.deviceId));if(!u)return null;const d=(u.devices||[]).find(x=>x.deviceId===p.deviceId);if(!d)return null;return {payload:p,user:u,device:d}}
function cleanText(v,n){return String(v||'').replace(/[<>]/g,'').trim().slice(0,n)}
function readFeedback(){return readJson(FEEDBACK_FILE,{schema:'motolab_feedback_v1',items:[]})}
function writeFeedback(x){x.updatedAt=new Date().toISOString();atomic(FEEDBACK_FILE,JSON.stringify(x,null,2))}
async function submit(req,res,origin){const x=identity(req);if(!x||x.user.status!=='active')return send(res,401,{ok:false,error:'Active user required'},origin);let data;try{data=JSON.parse((await readBody(req)).toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'},origin)}const message=cleanText(data.message,5000),category=['problem','update','development','other'].includes(data.category)?data.category:'other';if(!message)return send(res,400,{ok:false,error:'Comment required'},origin);const db=readFeedback(),item={feedbackId:'fb_'+crypto.randomBytes(10).toString('hex'),userId:x.user.userId,nickname:x.user.nickname||'',deviceId:x.device.deviceId,category,message,appVersion:cleanText(data.appVersion,80),page:cleanText(data.page,200),createdAt:new Date().toISOString(),status:'new',adminNote:''};db.items.push(item);writeFeedback(db);return send(res,201,{ok:true,feedbackId:item.feedbackId,status:item.status},origin)}
function list(req,res,origin){const x=identity(req);if(!x||x.user.role!=='admin')return send(res,403,{ok:false,error:'Admin required'},origin);const db=readFeedback(),items=db.items.slice().sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));return send(res,200,{ok:true,items},origin)}
async function update(req,res,origin){const x=identity(req);if(!x||x.user.role!=='admin')return send(res,403,{ok:false,error:'Admin required'},origin);let data;try{data=JSON.parse((await readBody(req)).toString('utf8'))}catch{return send(res,400,{ok:false,error:'Invalid JSON'},origin)}const db=readFeedback(),item=db.items.find(i=>i.feedbackId===String(data.feedbackId||''));if(!item)return send(res,404,{ok:false,error:'Feedback not found'},origin);if(['new','reviewing','done','archived'].includes(data.status))item.status=data.status;if(data.adminNote!==undefined)item.adminNote=cleanText(data.adminNote,3000);item.updatedAt=new Date().toISOString();item.updatedBy=x.user.userId;writeFeedback(db);return send(res,200,{ok:true,item},origin)}

http.createServer=function(listener){return originalCreateServer(async(req,res)=>{const origin=String(req.headers.origin||'');let u;try{u=new URL(req.url,'http://localhost')}catch{return listener(req,res)}
 if(req.method==='OPTIONS'&&origin===ALLOWED_ORIGIN&&(u.pathname.startsWith('/api/feedback/')||u.pathname.startsWith('/api/admin/v1/feedback'))){res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-MotoLab-Beta-Token','Access-Control-Max-Age':'86400'});return res.end()}
 if(req.method==='POST'&&u.pathname==='/api/feedback/v1/comment')return submit(req,res,origin);
 if(req.method==='GET'&&u.pathname==='/api/admin/v1/feedback')return list(req,res,origin);
 if(req.method==='POST'&&u.pathname==='/api/admin/v1/feedback-status')return update(req,res,origin);
 return listener(req,res)});};
console.log('MotoLab feedback API enabled');
