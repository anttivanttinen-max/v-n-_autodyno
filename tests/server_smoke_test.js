'use strict';
const cp=require('child_process');
const fs=require('fs');
const os=require('os');
const path=require('path');
const http=require('http');
const root=path.resolve(__dirname,'..');
const serverDir=path.join(root,'raw_sync_server');
const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'motolab-v34-'));
const port=34567+Math.floor(Math.random()*1000);
const base=`http://127.0.0.1:${port}`;
let child;
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
async function request(url,opt={}){const r=await fetch(base+url,opt);let body={};try{body=await r.json()}catch{}return {status:r.status,headers:r.headers,body}}
function assert(cond,msg){if(!cond)throw Error(msg)}
async function ready(){for(let i=0;i<60;i++){try{const r=await request('/health');if(r.status===200&&r.body.ok)return r.body}catch{}await wait(100)}throw Error('server did not become ready')}
async function main(){
 const env={...process.env,PORT:String(port),DATA_DIR:dataDir,BETA_TOKEN_SECRET:'v34-smoke-secret',BETA_INVITE_CODES:'v34-owner-invite,v34-user-invite',BETA_MAX_DEVICES:'2',INGEST_KEY:'v34-ingest',READ_KEY:'v34-read',ALLOWED_ORIGIN:'https://anttivanttinen-max.github.io',GITHUB_MIRROR_ENABLED:'0'};
 child=cp.spawn(process.execPath,['-r','./beta_auth_server.js','-r','./user_features_server.js','-r','./community_server.js','-r','./merit_server.js','server.js'],{cwd:serverDir,env,stdio:['ignore','pipe','pipe']});
 let err='';child.stderr.on('data',d=>err+=d.toString());
 child.on('exit',code=>{if(code&&code!==0)console.error(err)});
 const health=await ready();assert(health.service==='vana-motolab-raw-sync','health service identity');
 const deviceId='dev-v34-smoke-owner';
 let r=await request('/api/beta/v1/activate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:'v34-owner-invite',deviceId})});
 assert(r.status===200&&r.body.token,'beta activation returns token');const token=r.body.token;
 r=await request('/api/users/v1/me',{headers:{'x-motolab-beta-token':token}});assert(r.status===200&&r.body.user,'user identity resolves');assert(r.body.user.role==='admin','first primary invite migrates to admin owner');assert(r.body.user.status==='active','owner is active');
 r=await request('/api/admin/v1/users',{headers:{'x-motolab-beta-token':token}});assert(r.status===200&&Array.isArray(r.body.users)&&r.body.users.length>=1,'admin user list works');
 const cloud={motolab_v32_beta_consent:JSON.stringify({accepted:true,uiLanguage:'en'})};
 r=await request('/api/users/v1/state',{method:'PUT',headers:{'content-type':'application/json','x-motolab-beta-token':token},body:JSON.stringify({state:cloud})});assert(r.status===200&&r.body.revision,'cloud state PUT works');
 r=await request('/api/users/v1/state',{headers:{'x-motolab-beta-token':token}});assert(r.status===200&&r.body.item?.state?.motolab_v32_beta_consent===cloud.motolab_v32_beta_consent,'cloud state GET preserves language/user state');
 r=await request('/api/admin/v1/users');assert(r.status===401,'admin endpoint rejects unauthenticated request');
 r=await request('/api/raw/v1/chunks?readKey=v34-read');assert(r.status===200&&Array.isArray(r.body.items),'read endpoint works with read key');
 console.log('V34 SERVER SMOKE: PASS');
}
main().catch(e=>{console.error('V34 SERVER SMOKE: FAIL',e.stack||e);process.exitCode=1}).finally(async()=>{if(child&&!child.killed)child.kill('SIGTERM');await wait(100);try{fs.rmSync(dataDir,{recursive:true,force:true})}catch{}});
