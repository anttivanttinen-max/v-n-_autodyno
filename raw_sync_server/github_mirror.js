'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

function createGitHubMirror(opts={}){
 const dataDir=opts.dataDir;
 const token=String(process.env.GITHUB_DATA_TOKEN||'').trim();
 const repo=String(process.env.GITHUB_DATA_REPO||'').trim();
 const branch=String(process.env.GITHUB_DATA_BRANCH||'main').trim()||'main';
 const prefix=String(process.env.GITHUB_DATA_PREFIX||'motolab-data').trim().replace(/^\/+|\/+$/g,'')||'motolab-data';
 const queueDir=path.join(dataDir,'.github-mirror-queue');
 const enabled=!!(token&&/^[-A-Za-z0-9_.]+\/[-A-Za-z0-9_.]+$/.test(repo));
 let busy=false,lastOk=null,lastError=null,sent=0;
 fs.mkdirSync(queueDir,{recursive:true});

 function safeRel(file){
  const rel=path.relative(dataDir,file).replace(/\\/g,'/');
  if(!rel||rel.startsWith('..')||rel.includes('/.github-mirror-queue/')||rel.startsWith('.github-mirror-queue/'))return null;
  return rel;
 }
 function queueName(repoPath){return crypto.createHash('sha256').update(repoPath).digest('hex')+'.json'}
 async function queueLocal(file){
  if(!enabled)return false;
  const rel=safeRel(file);if(!rel||!fs.existsSync(file)||!fs.statSync(file).isFile())return false;
  const repoPath=`${prefix}/${rel}`;
  const meta={schema:'motolab_github_mirror_queue_v1',local:file,repoPath,queuedAt:new Date().toISOString(),tries:0};
  fs.writeFileSync(path.join(queueDir,queueName(repoPath)),JSON.stringify(meta));
  schedule(50);return true;
 }
 function headers(){return {'Authorization':`Bearer ${token}`,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json','User-Agent':'vana-motolab-receiver'} }
 async function existingSha(repoPath){
  const u=`https://api.github.com/repos/${repo}/contents/${repoPath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`;
  const r=await fetch(u,{headers:headers()});
  if(r.status===404)return null;
  if(!r.ok)throw Error(`GitHub lookup HTTP ${r.status}`);
  const j=await r.json();return j?.sha||null;
 }
 async function upload(meta){
  if(!fs.existsSync(meta.local))return 'missing';
  const raw=fs.readFileSync(meta.local),sha=await existingSha(meta.repoPath);
  const u=`https://api.github.com/repos/${repo}/contents/${meta.repoPath.split('/').map(encodeURIComponent).join('/')}`;
  const body={message:`MotoLab data: ${meta.repoPath}`,content:raw.toString('base64'),branch};if(sha)body.sha=sha;
  const r=await fetch(u,{method:'PUT',headers:headers(),body:JSON.stringify(body)});
  if(!r.ok){let t='';try{t=await r.text()}catch{}throw Error(`GitHub upload HTTP ${r.status}${t?' '+t.slice(0,180):''}`)}
  return 'ok';
 }
 async function run(){
  if(!enabled||busy)return;busy=true;
  try{
   const files=fs.readdirSync(queueDir).filter(x=>x.endsWith('.json')).slice(0,8);
   for(const name of files){
    const qf=path.join(queueDir,name);let meta;try{meta=JSON.parse(fs.readFileSync(qf,'utf8'))}catch{fs.unlinkSync(qf);continue}
    try{await upload(meta);fs.unlinkSync(qf);sent++;lastOk=new Date().toISOString();lastError=null}
    catch(e){meta.tries=(meta.tries||0)+1;meta.lastError=String(e.message||e);meta.lastTry=new Date().toISOString();fs.writeFileSync(qf,JSON.stringify(meta));lastError=meta.lastError;break}
   }
  }finally{busy=false;if(enabled&&fs.readdirSync(queueDir).some(x=>x.endsWith('.json')))schedule(15000)}
 }
 let timer=null;function schedule(ms){if(timer)return;timer=setTimeout(()=>{timer=null;run().catch(e=>{lastError=String(e.message||e)})},ms)}
 function walk(dir,out=[]){if(!fs.existsSync(dir))return out;for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name==='.github-mirror-queue')continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p,out);else if(e.isFile())out.push(p)}return out}
 async function backfill(){if(!enabled)return {enabled:false,queued:0};let n=0;for(const f of walk(dataDir)){if(await queueLocal(f))n++}schedule(100);return {enabled:true,queued:n}}
 function status(){let pending=0;try{pending=fs.readdirSync(queueDir).filter(x=>x.endsWith('.json')).length}catch{}return {enabled,repo:enabled?repo:null,branch:enabled?branch:null,prefix:enabled?prefix:null,pending,sent,lastOk,lastError}}
 const api={enabled,queueLocal,run,backfill,status};globalThis.MotoLabGitHubMirror=api;return api;
}
module.exports={createGitHubMirror};
