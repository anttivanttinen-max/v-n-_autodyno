const test=require('node:test'),assert=require('node:assert/strict');
test('RPM formula covers ignition types',()=>{const rpm=(hz,ppr)=>60*hz/ppr;assert.equal(rpm(100,1),6000);assert.equal(rpm(50,.5),6000);assert.equal(rpm(200,2),6000)});
test('reference error is signed percent',()=>assert.equal(100*(6120-6000)/6000,2));
