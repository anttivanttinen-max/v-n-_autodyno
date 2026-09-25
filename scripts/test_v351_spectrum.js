'use strict';
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const m=html.match(/const rpmWorkerSource=`([\s\S]*?)`;\nconst rpmWorker=/);
if(!m)throw new Error('rpmWorkerSource not found');
const src=m[1];
const pre=src.split('onmessage=e=>')[0];
const api=new Function(pre+'; return {wideSpectrum,estimate};')();
const sr=48000,n=4096,x=new Float32Array(n);
for(let i=0;i<n;i++){const t=i/sr;x[i]=0.55*Math.sin(2*Math.PI*100*t)+0.18*Math.sin(2*Math.PI*200*t);}
const r=api.estimate(x,sr,'ext');
if(!Array.isArray(r.spectrumDb)||r.spectrumDb.length!==197)throw new Error('expected 197 spectrum bins, got '+(r.spectrumDb&&r.spectrumDb.length));
if(!r.spectrumDb.every(Number.isFinite))throw new Error('non-finite spectrum data');
const peak=Math.max(...r.spectrumDb),idx=r.spectrumDb.indexOf(peak),hz=20+idx*5;
if(Math.abs(hz-100)>10)throw new Error('unexpected spectrum peak '+hz+' Hz');
if(!html.includes('audioSpectrum:{startHz:20,endHz:1000,stepHz:5,frames:spectra}'))throw new Error('run spectrum payload missing');
console.log('V351_SPECTRUM_OK',JSON.stringify({bins:r.spectrumDb.length,startHz:20,endHz:1000,stepHz:5,peakHz:hz,rpm:Math.round(r.rpm||0),conf:+(r.conf||0).toFixed(3)}));
