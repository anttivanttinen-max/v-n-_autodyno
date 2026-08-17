'use strict';
const fs=require('fs');
const path=require('path');
const cp=require('child_process');
const root=path.resolve(__dirname,'..');
let fails=0,passes=0;
function read(p){return fs.readFileSync(path.join(root,p),'utf8')}
function ok(cond,msg){if(cond){passes++;console.log('PASS',msg)}else{fails++;console.error('FAIL',msg)}}
function has(file,s,msg){ok(read(file).includes(s),msg||`${file} contains ${s}`)}
function notHas(file,s,msg){ok(!read(file).includes(s),msg||`${file} excludes ${s}`)}

const browserFiles=['adaptive_rpm_learning.js','admin_test_tools.js','app_shell_v34.js','beta_menu.js','beta_release.js','community.js','diagnostics.js','dyno_curve_v2.js','feedback.js','gps_master_learning.js','i18n.js','i18n_safety.js','live_status.js','live_status_guard.js','maintenance.js','merit.js','mic_authority.js','phone_rpm_smart.js','raw_sync.js','research_sync.js','sensor_autostart.js','sensor_persistence.js','technical_specs.js','trip_gear_guard.js','trip_gear_marker.js','trip_phone_raw.js','trip_research.js','ui_compact.js','user_features.js','user_identity.js','vehicle_lookup.js','version.js','sw.js'];
for(const f of browserFiles){const r=cp.spawnSync(process.execPath,['--check',path.join(root,f)],{encoding:'utf8'});ok(r.status===0,`syntax ${f}`);if(r.status!==0)console.error(r.stderr)}
for(const f of fs.readdirSync(path.join(root,'raw_sync_server')).filter(x=>x.endsWith('.js'))){const r=cp.spawnSync(process.execPath,['--check',path.join(root,'raw_sync_server',f)],{encoding:'utf8'});ok(r.status===0,`server syntax ${f}`);if(r.status!==0)console.error(r.stderr)}

has('version.js','version:"34.0"','release is v34.0');
has('version.js','2026-08-17o-rebuild-ui-i18n','release build identity matches');
for(const m of ['diagnostics.js','user_identity.js','user_features.js','feedback.js','community.js','merit.js','beta_menu.js','mic_authority.js','sensor_persistence.js','sensor_autostart.js','admin_test_tools.js','trip_research.js','trip_gear_guard.js','live_status.js','app_shell_v34.js','i18n_safety.js','i18n.js'])has('sw.js',m,`SW loads ${m}`);
has('sw.js','VERSION=globalThis.MOTOLAB_RELEASE?.version||"34.0"','SW fallback version is v34.0');
has('sw.js','2026-08-17o-rebuild-ui-i18n','SW build matches v34 release');

has('app_shell_v34.js','KÄYTTÄJÄ / BETA','integrated User/Beta menu exists');
for(const s of ['OMA TILI','PALAUTE & VIESTIT','BETA-KESKUSTELU','JAETUT VEDOT','TESTERITASO','KUTSU TESTAAJA'])has('app_shell_v34.js',s,`user menu contains ${s}`);
for(const s of ['KÄYTTÄJIEN HYVÄKSYNNÄT','MERIT-ARVIOINTI','KÄYTTÖOIKEUDET','YHTEISÖ / DIAGNOSTIIKKA'])has('app_shell_v34.js',s,`admin menu supports ${s}`);
has('app_shell_v34.js','${admin?','admin section is conditional, not universally rendered');
has('app_shell_v34.js','u.role===\'admin\'&&u.status===\'active\'','admin requires resolved active admin role');
has('app_shell_v34.js','#mlBetaMenuBtn,#motolabUserPill{display:none!important}','legacy floating user controls are removed from visible UI');

has('i18n.js','motolab_language','language preference has persistent key');
has('i18n.js','motolab_v32_beta_consent','language preference is mirrored into cloud-synced beta state');
has('i18n.js',"'MITTAUS':'MEASURE'",'English measurement navigation exists');
has('i18n.js',"'VEDOT':'RUNS'",'English runs navigation exists');
has('i18n.js',"'ASETUKSET':'SETTINGS'",'English settings navigation exists');
has('i18n.js',"'MIKÄ VAIHDE KÄYTÖSSÄ?':'WHICH GEAR IS ENGAGED?'",'English gear prompt exists');
has('i18n_safety.js','tripResearchState','translation cannot mutate research machine state');

has('admin_test_tools.js','const HOLD_MS=2000','gear prompt confirmation delay is 2.0 seconds');
has('admin_test_tools.js','gearPromptAllUsers:true','third gear prompt is enabled for all beta users');
has('admin_test_tools.js','if(!isAdmin())','audio input selector remains admin-only');
has('admin_test_tools.js','data-mgear="2"','gear prompt offers 2nd gear');
has('admin_test_tools.js','data-mgear="3"','gear prompt offers 3rd gear');
has('admin_test_tools.js','data-mgear="4"','gear prompt offers 4th gear');
has('admin_test_tools.js','motolabGearSkip','gear prompt offers skip');

has('mic_authority.js','motolab-mic-authority-v2','unified MIC authority v2 retained');
has('mic_authority.js','mic_command_start','MIC command telemetry retained');
has('mic_authority.js','mic_command_done','MIC serialized command completion retained');
notHas('sensor_persistence.js','audio_frames_stale','false stale-frame reconnect trigger stays removed');

has('raw_sync_server/package.json','user_features_server.js','server starts user feature layer');
has('raw_sync_server/package.json','community_server.js','server starts community layer');
has('raw_sync_server/package.json','merit_server.js','server starts merit layer');
has('raw_sync_server/user_server.js','ADMIN_DEVICE_IDS','owner/admin device allowlist retained');
notHas('raw_sync_server/user_server.js',"nickname===OWNER_NICKNAME",'nickname alone cannot grant owner role');
ok(!fs.existsSync(path.join(root,'raw_sync_server','owner_recovery_server.js')),'no ambiguous owner recovery server is present');

const index=read('index.html');
for(const s of ['data-screen="measure"','data-screen="runs"','data-screen="analysis"','data-screen="settings"'])ok(index.includes(s),`base navigation contains ${s}`);
has('live_status.js',"b.dataset.screen='live'",'LIVE is inserted into bottom navigation');
has('app_shell_v34.js',"wanted=['measure','runs','live','analysis','settings']",'visible primary navigation order is fixed');

console.log(`\nV34 STATIC RESULT: ${passes} passed, ${fails} failed`);
if(fails)process.exit(1);
