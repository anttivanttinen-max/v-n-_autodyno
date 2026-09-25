'use strict';
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('index.html','utf8');
let code=fs.readFileSync('sw.js','utf8');
const sandbox={
  console,
  globalThis:null,
  importScripts:()=>{},
  self:{addEventListener:()=>{},skipWaiting:()=>{}},
  caches:{open:async()=>({}),keys:async()=>[],delete:async()=>true},
  fetch:async()=>{throw new Error('no fetch in inject test')},
  Request:function(){},
  Response:function(){},
  URL
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
code+='\n;globalThis.__inject=inject;';
vm.runInContext(code,sandbox);
const out=sandbox.__inject(html);
function need(ok,msg){if(!ok)throw new Error(msg)}
need(out.includes('dyno_only_v351.js'),'dyno module missing after SW inject');
need(out.includes('audioSpectrum:{startHz:20,endHz:1000,stepHz:5,frames:spectra}'),'spectrum payload lost in SW injection');
need(out.includes('spectrumFrames.push'),'spectrum capture lost in SW injection');
need(out.includes('dyno_only_v351.css'),'dyno css missing after SW injection');
const scripts=(out.match(/dyno_only_v351\.js/g)||[]).length;
need(scripts===1,'dyno module duplicated by SW inject: '+scripts);
console.log('V351_SW_INJECT_OK',JSON.stringify({dynoScriptRefs:scripts,length:out.length}));
