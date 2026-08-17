'use strict';
const {spawn}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');
const assert=(v,m)=>{if(!v)throw Error(m)};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function json(url,opt={}){const r=await fetch(url,opt);let j={};try{j=await r.json()}catch{}return {r,j}}
const H=(token,origin='https://anttivanttinen-max.github.io')=>({'Content-Type':'application/json','X-MotoLab-Beta-Token':token,Origin:origin});
async function main(){
 const port=39000+Math.floor(Math.random()*1500),dir=fs.mkdtempSync(path.join(os.tmpdir(),'motolab-id-')),base=`http://127.0.0.1:${port}`;
 const env={...process.env,PORT:String(port),DATA_DIR:dir,BETA_TOKEN_SECRET:'test-secret-32-bytes-minimum',BETA_INVITE_CODES:'OWNER-TEST',MOTOLAB_ADMIN_DEVICE_IDS:'owner-device',MOTOLAB_OWNER_NICKNAME:'VäNä',INGEST_KEY:'ingest-test',READ_KEY:'read-test',ALLOWED_ORIGIN:'https://anttivanttinen-max.github.io'};
 const child=spawn(process.execPath,['-r','./beta_auth_server.js','-r','./user_features_server.js','-r','./community_server.js','-r','./merit_server.js','-r','./owner_device_session_server.js','server.js'],{cwd:__dirname,env,stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
 try{
  let up=false;for(let i=0;i<60;i++){try{const r=await fetch(base+'/health');if(r.ok){up=true;break}}catch{}await sleep(100)}assert(up,'server failed to start\n'+logs);
  const cors=await fetch(base+'/api/users/v1/state',{method:'OPTIONS',headers:{Origin:env.ALLOWED_ORIGIN,'Access-Control-Request-Method':'PUT','Access-Control-Request-Headers':'content-type,x-motolab-beta-token'}});assert(cors.status===204,'user OPTIONS failed');assert((cors.headers.get('access-control-allow-methods')||'').includes('PUT'),'PUT missing from CORS');
  let x=await json(base+'/api/beta/v1/activate',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.ALLOWED_ORIGIN},body:JSON.stringify({code:'OWNER-TEST',deviceId:'owner-device',nickname:'VäNä'})});assert(x.r.ok&&x.j.token,'owner activation failed '+JSON.stringify(x.j));assert(x.j.user?.role==='admin'&&x.j.user?.status==='active','owner role/status wrong');const ownerToken=x.j.token,ownerId=x.j.user.userId;
  x=await json(base+'/api/users/v1/me',{headers:H(ownerToken)});assert(x.r.ok&&x.j.user?.role==='admin','owner /me failed');
  x=await json(base+'/api/users/v1/invite',{method:'POST',headers:H(ownerToken),body:'{}'});assert(x.r.status===201&&x.j.invite,'dynamic invite creation failed');const invite=x.j.invite;
  x=await json(base+'/api/beta/v1/activate',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.ALLOWED_ORIGIN},body:JSON.stringify({code:invite,deviceId:'tester-device',nickname:'Tester'})});assert(x.r.ok&&x.j.token,'dynamic invite activation failed '+JSON.stringify(x.j));assert(x.j.user?.status==='pending','new tester should be pending');const testerToken=x.j.token,testerId=x.j.user.userId;
  x=await json(base+'/api/admin/v1/user-status',{method:'POST',headers:H(ownerToken),body:JSON.stringify({userId:testerId,status:'active'})});assert(x.r.ok&&x.j.user?.status==='active','tester approval failed');
  const state={motolab_language:'en',example:'ok'};x=await json(base+'/api/users/v1/state',{method:'PUT',headers:H(testerToken),body:JSON.stringify({state})});assert(x.r.ok,'state PUT failed '+JSON.stringify(x.j));x=await json(base+'/api/users/v1/state',{headers:H(testerToken)});assert(x.r.ok&&x.j.item?.state?.motolab_language==='en','state GET failed');
  // Feature permissions and heartbeat.
  x=await json(base+'/api/features/v1/me',{headers:H(testerToken)});assert(x.r.ok&&x.j.permissions?.phone_mic===true,'normal tester phone mic permission missing');assert(x.j.permissions?.run_sharing===true,'run sharing should default on');
  x=await json(base+'/api/features/v1/heartbeat',{method:'POST',headers:H(testerToken),body:JSON.stringify({appVersion:'34.6-dev',build:'test',platform:'iOS',deviceModel:'iPhone'})});assert(x.r.ok,'feature heartbeat failed');
  // Shared run: owner -> tester, tester accepts. Only graph data is stored.
  const run={id:'run-test',profileName:'DT 170',date:new Date().toISOString(),quality:94,maxHp:31.4,maxNm:28.6,maxRpm:10180,curve:[{rpm:4000,hp:8,nm:14},{rpm:7000,hp:22,nm:23},{rpm:10000,hp:31,nm:22}]};
  x=await json(base+'/api/shares/v1/runs',{method:'POST',headers:H(ownerToken),body:JSON.stringify({receiverUserId:testerId,run})});assert(x.r.status===201&&x.j.share?.status==='pending','run share create failed '+JSON.stringify(x.j));const shareId=x.j.share.shareId;assert(!('raw' in (x.j.share.run||{})),'shared run must not contain RAW');
  x=await json(base+'/api/shares/v1/inbox',{headers:H(testerToken)});assert(x.r.ok&&x.j.shares.some(s=>s.shareId===shareId),'shared run missing from inbox');
  x=await json(base+'/api/shares/v1/respond',{method:'POST',headers:H(testerToken),body:JSON.stringify({shareId,action:'accepted'})});assert(x.r.ok&&x.j.share?.status==='accepted','share accept failed');
  // Private feedback conversation remains scoped to the user, while admin can reply.
  x=await json(base+'/api/feedback/v1/comment',{method:'POST',headers:H(testerToken),body:JSON.stringify({category:'problem',message:'Test feedback message',appVersion:'34.6-dev',page:'dashboard'})});assert(x.r.status===201&&x.j.item?.feedbackId,'feedback submit failed');const feedbackId=x.j.item.feedbackId;
  x=await json(base+'/api/feedback/v1/mine',{headers:H(testerToken)});assert(x.r.ok&&x.j.items.some(i=>i.feedbackId===feedbackId),'private feedback mine failed');
  x=await json(base+'/api/admin/v1/feedback',{headers:H(ownerToken)});assert(x.r.ok&&x.j.items.some(i=>i.feedbackId===feedbackId&&i.userId===testerId),'admin feedback list failed');
  x=await json(base+'/api/admin/v1/feedback-reply',{method:'POST',headers:H(ownerToken),body:JSON.stringify({feedbackId,message:'Admin reply'})});assert(x.r.status===201,'admin feedback reply failed');
  x=await json(base+'/api/feedback/v1/reply',{method:'POST',headers:H(testerToken),body:JSON.stringify({feedbackId,message:'Tester follow-up'})});assert(x.r.status===201,'tester feedback reply failed');
  // Community flow including same-problem and admin solution/status.
  x=await json(base+'/api/community/v1/issues',{method:'POST',headers:H(testerToken),body:JSON.stringify({title:'Test issue',description:'Runtime test issue',category:'Ongelma'})});assert(x.r.status===201&&x.j.issue?.issueId,'community issue create failed');const issueId=x.j.issue.issueId;
  x=await json(base+'/api/community/v1/comments',{method:'POST',headers:H(ownerToken),body:JSON.stringify({issueId,text:'Working solution'})});assert(x.r.status===201&&x.j.comment?.commentId,'community comment failed');const commentId=x.j.comment.commentId;
  x=await json(base+'/api/community/v1/same',{method:'POST',headers:H(ownerToken),body:JSON.stringify({issueId})});assert(x.r.ok&&x.j.sameCount>=2,'same-problem count failed');
  x=await json(base+'/api/admin/v1/community/solution',{method:'POST',headers:H(ownerToken),body:JSON.stringify({issueId,commentId})});assert(x.r.ok&&x.j.issue?.status==='resolved'&&x.j.issue?.solutionCommentId===commentId,'community solution failed');
  // Tester Merit is qualitative/admin-awarded, not automatic activity spam.
  x=await json(base+'/api/admin/v1/merit/bonus',{method:'POST',headers:H(ownerToken),body:JSON.stringify({userId:testerId,category:'reliability',points:5,reason:'Integration test quality'})});assert(x.r.ok,'merit bonus failed');
  x=await json(base+'/api/merit/v1/me',{headers:H(testerToken)});assert(x.r.ok&&x.j.merit?.levelName,'tester merit me failed');
  x=await json(base+'/api/admin/v1/merit/users',{headers:H(ownerToken)});assert(x.r.ok&&x.j.users.some(u=>u.userId===testerId),'admin merit users failed');
  // Same-device owner recovery; unknown devices must never be promoted.
  x=await json(base+'/api/users/v1/owner-device-session',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.ALLOWED_ORIGIN},body:JSON.stringify({deviceId:'owner-device',deviceLabel:'same iPhone'})});assert(x.r.ok&&x.j.token&&x.j.user?.role==='admin','same-device owner restore failed '+JSON.stringify(x.j));const restored=x.j.token;
  x=await json(base+'/api/users/v1/me',{headers:H(restored)});assert(x.r.ok&&x.j.user?.nickname==='VäNä','restored owner /me failed');
  x=await json(base+'/api/users/v1/owner-device-session',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.ALLOWED_ORIGIN},body:JSON.stringify({deviceId:'unknown-device'})});assert(x.r.status===404,'unknown owner device must not recover');
  console.log('IDENTITY_FLOW_OK',JSON.stringify({owner:'active/admin',tester:'pending->active',state:'put/get',features:'phone-mic/share',sharing:'curve-only accepted',feedback:'private two-way',community:'issue/solution',merit:'admin-quality',ownerRestore:'same-device-only',ownerId,testerId,port}));
 }finally{child.kill('SIGTERM');await sleep(80);fs.rmSync(dir,{recursive:true,force:true})}
}
main().catch(e=>{console.error(e.stack||e);process.exit(1)});
