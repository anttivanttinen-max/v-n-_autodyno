'use strict';
const fs=require('fs');
const path=require('path');

function bool(v){return /^(1|true|yes|on)$/i.test(String(v||''))}
function safe(s,fallback='query'){const v=String(s||fallback).replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120);return v||fallback}
function extractText(response){
  if(typeof response?.output_text==='string')return response.output_text;
  const out=[];
  for(const item of response?.output||[]){
    if(item?.type!=='message')continue;
    for(const c of item.content||[])if(c?.type==='output_text'&&typeof c.text==='string')out.push(c.text);
  }
  return out.join('\n').trim();
}
function parseJsonText(text){
  let s=String(text||'').trim();
  if(s.startsWith('```'))s=s.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try{return JSON.parse(s)}catch{}
  const a=s.indexOf('{'),b=s.lastIndexOf('}');
  if(a>=0&&b>a)return JSON.parse(s.slice(a,b+1));
  throw new Error('Vehicle research response was not valid JSON');
}
function normalizeResult(query,data){
  const candidates=Array.isArray(data?.candidates)?data.candidates.slice(0,5):[];
  for(const c of candidates){
    c.confidence=String(c.confidence||'pending').toLowerCase();
    if(!['verified','probable','pending'].includes(c.confidence))c.confidence='pending';
    c.sources=Array.isArray(c.sources)?c.sources.filter(x=>x&&x.url).slice(0,12):[];
    c.fields=c.fields&&typeof c.fields==='object'?c.fields:{};
  }
  return {schema:'motolab_vehicle_web_research_v1',query,researchedAt:new Date().toISOString(),status:candidates.length?'found':'not_found',candidates};
}
function createVehicleWebSearch({dataDir}){
  const enabled=()=>bool(process.env.VEHICLE_WEB_SEARCH_ENABLED);
  const model=()=>String(process.env.VEHICLE_WEB_SEARCH_MODEL||'gpt-5');
  const apiKey=()=>String(process.env.OPENAI_API_KEY||'');
  const root=path.join(dataDir,'vehicle_research');
  fs.mkdirSync(root,{recursive:true});
  function status(){return {enabled:enabled(),provider:'openai_responses_web_search',model:model(),configured:!!apiKey()}}
  async function research(query){
    query=String(query||'').trim();
    if(query.length<2)throw Object.assign(new Error('Search query too short'),{status:400});
    if(!enabled())throw Object.assign(new Error('Vehicle web search is prepared but not enabled'),{status:503,code:'SEARCH_DISABLED'});
    if(!apiKey())throw Object.assign(new Error('OPENAI_API_KEY missing'),{status:503,code:'SEARCH_NOT_CONFIGURED'});
    const prompt=`You are MotoLab vehicle-spec research. Research this motorcycle/moped query on the public web: ${JSON.stringify(query)}.\n\nUse multiple independent sources whenever possible. Prefer manufacturer manuals, official parts/service documentation, homologation/spec sheets and reputable technical databases. Do not invent missing values. If sources disagree, preserve the disagreement and lower confidence.\n\nReturn JSON only, with this shape:\n{\n  \"candidates\": [\n    {\n      \"make\": string|null, \"model\": string|null, \"variant\": string|null, \"yearFrom\": number|null, \"yearTo\": number|null, \"engineType\": \"2T\"|\"4T\"|null,\n      \"confidence\": \"verified\"|\"probable\"|\"pending\",\n      \"fields\": {\n        \"engine\": {\"displacementCc\":number|null,\"boreMm\":number|null,\"strokeMm\":number|null,\"engineCode\":string|null,\"carburetor\":string|null,\"carburetorMm\":number|null,\"sparkPlug\":string|null,\"sparkPlugGapMm\":number|null},\n        \"drivetrain\": {\"primaryRatio\":number|null,\"frontSprocket\":number|null,\"rearSprocket\":number|null,\"gearRatios\":[number|null]},\n        \"fluids\": {\"transmissionOilTotalL\":number|null,\"transmissionOilChangeL\":number|null,\"coolantL\":number|null,\"twoStrokeOilTankL\":number|null},\n        \"chassis\": {\"frontTyre\":string|null,\"rearTyre\":string|null,\"wheelCircMm\":number|null}\n      },\n      \"fieldConfidence\": {\"field.path\":\"verified|probable|pending\"},\n      \"conflicts\": [{\"field\":string,\"values\":[string],\"note\":string}],\n      \"sources\": [{\"url\":string,\"title\":string,\"kind\":\"official|manual|database|forum|other\"}],\n      \"notes\": string\n    }\n  ]\n}\n\nConfidence rule: verified = same important value supported by at least two credible independent sources or a strong official/manual source; probable = one credible source or multiple weaker matching sources; pending = conflicting/uncertain/weakly supported. Do not silently resolve conflicts.`;
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':'Bearer '+apiKey(),'Content-Type':'application/json'},body:JSON.stringify({model:model(),tools:[{type:'web_search',search_context_size:'high'}],input:prompt,store:false})});
    const body=await r.json().catch(()=>null);
    if(!r.ok)throw Object.assign(new Error(body?.error?.message||('OpenAI HTTP '+r.status)),{status:502,code:'PROVIDER_ERROR'});
    const text=extractText(body);const result=normalizeResult(query,parseJsonText(text));
    const stamp=new Date().toISOString().replace(/[:.]/g,'-'),file=path.join(root,stamp+'-'+safe(query)+'.json');
    fs.writeFileSync(file,JSON.stringify({provider:{model:model(),responseId:body?.id||null},...result},null,2));
    return result;
  }
  return {status,research};
}
module.exports={createVehicleWebSearch};
