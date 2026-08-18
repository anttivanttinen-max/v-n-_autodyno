'use strict';
const fs=require('fs');
const path=require('path');

const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const USERS_DIR=path.join(DATA_DIR,'users');
const USERS_FILE=path.join(USERS_DIR,'registry.json');
const LEGACY_USERS_FILE=path.join(DATA_DIR,'registry.json');

function ensurePersistentUserStorage(){
 fs.mkdirSync(USERS_DIR,{recursive:true});
 if(!fs.existsSync(USERS_FILE)&&fs.existsSync(LEGACY_USERS_FILE)){
  try{
   const raw=fs.readFileSync(LEGACY_USERS_FILE,'utf8');
   const db=JSON.parse(raw);
   if(db&&Array.isArray(db.users)){
    const tmp=USERS_FILE+'.tmp-'+process.pid+'-'+Date.now();
    fs.writeFileSync(tmp,JSON.stringify(db,null,2));
    fs.renameSync(tmp,USERS_FILE);
    console.log(`MotoLab storage guard: migrated legacy users -> ${USERS_FILE}`);
   }
  }catch(e){
   console.error('MotoLab storage guard: legacy migration skipped:',e.message);
  }
 }
 console.log(`MotoLab storage guard: DATA_DIR=${DATA_DIR}; users=${USERS_FILE}`);
}

ensurePersistentUserStorage();
module.exports={DATA_DIR,USERS_DIR,USERS_FILE,LEGACY_USERS_FILE,ensurePersistentUserStorage};
