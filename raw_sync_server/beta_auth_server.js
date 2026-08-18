'use strict';

// Normalize the configured browser origin before loading modules that read it.
// Railway variables are sometimes entered with a trailing slash or the full
// GitHub Pages app path. CORS compares only the URL origin, so normalize it
// once here and make every auth/user module see the same canonical value.
const CANONICAL_PAGES_ORIGIN='https://anttivanttinen-max.github.io';
const configuredOrigin=String(process.env.ALLOWED_ORIGIN||CANONICAL_PAGES_ORIGIN).trim();
try{process.env.ALLOWED_ORIGIN=new URL(configuredOrigin).origin}catch{process.env.ALLOWED_ORIGIN=CANONICAL_PAGES_ORIGIN}

require('./feedback_server');
require('./owner_bootstrap_server');
require('./user_server');
require('./password_auth_server');
require('./owner_device_session_server');
const http=require('http');
const crypto=require('crypto');

const originalCreateServer=http.createServer.bind(http);
const INGEST_KEY=String(process.env.INGEST_KEY||'');
const BETA_SECRET=String(process.env.BETA_TOKEN_SECRET||'');
const ALLOWED_ORIGIN=process.env.ALLOWED_ORIGIN||CANONICAL_PAGES_ORIGIN;

function unb64(v){return Buffer.from(v,'base64url').toString('utf8')}
function verify(token){
 if(!BETA_SECRET||!token)return null;
 const [body,sig]=String(token).split('.');if(!body||!sig)return null;
 const expected=crypto.createHmac('sha256',BETA_SECRET).update(body).digest('base64url');
 const a=Buffer.from(sig),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
 try{const p=JSON.parse(unb64(body));if(p.exp&&Date.now()>p.exp)return null;return p}catch{return null}
}
function send(res,status,obj,origin=''){
 const body=Buffer.from(JSON.stringify(obj));
 const h={'Content-Type':'application/json; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'};
 if(origin===ALLOWED_ORIGIN){h['Access-Control-Allow-Origin']=origin;h['Vary']='Origin'}
 res.writeHead(status,h);res.end(body)
}

http.createServer=function(listener){return originalCreateServer(async(req,res)=>{
 const origin=String(req.headers.origin||'');let u;try{u=new URL(req.url,'http://localhost')}catch{return listener(req,res)}
 if(req.method==='OPTIONS'){
  if(u.pathname.startsWith('/api/users/')||u.pathname.startsWith('/api/admin/'))return listener(req,res);
  if(origin&&origin!==ALLOWED_ORIGIN){res.writeHead(403);return res.end()}
  res.writeHead(204,{'Access-Control-Allow-Origin':origin||ALLOWED_ORIGIN,'Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,PUT,HEAD,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-MotoLab-Ingest-Key,X-MotoLab-Read-Key,X-MotoLab-Beta-Token','Access-Control-Max-Age':'86400'});return res.end()
 }
 const betaToken=String(req.headers['x-motolab-beta-token']||'');
 if(betaToken){
  const p=verify(betaToken);if(!p)return send(res,401,{ok:false,error:'Invalid beta token'},origin);
  if((u.pathname==='/api/raw/v1/chunk'||u.pathname.startsWith('/api/research/v1/'))&&INGEST_KEY)req.headers['x-motolab-ingest-key']=INGEST_KEY;
  req.betaIdentity=p
 }
 return listener(req,res)
})};
console.log(`MotoLab beta auth compatibility layer: ${BETA_SECRET?'enabled':'not configured'}; activation=user_server; password-auth=enabled; owner-bootstrap=first; owner-device-session=enabled; origin=${ALLOWED_ORIGIN}`);
