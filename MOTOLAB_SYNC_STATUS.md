# VÄNÄ MotoLab — shared development sync status

Updated: 2026-08-17

## Current application line
- Active published line on `main`: **v34.0 / build `2026-08-17o-motorlab-ui-fi-en`**.
- `version.js`, Service Worker cache identity and PWA manifest are aligned to v34.0.
- v34.0 is a presentation/navigation/language release layered on top of the retained v33.9 measurement/server foundation.
- Yamaha DT125R Athena 170 remains the startup-bike/development profile line.
- Current temporary GPS power calibration in `dyno_curve_v2.js` remains **1.07** (`v32-dyno-curve-2.2`).

## v34.0 MotorLab UI / branding / language release
- Publication-facing product name is **VäNä MotorLab** under the broader **VäNä Motorsport** brand direction. Internal legacy MotoLab/AutoDyno identifiers remain where renaming could risk RAW/API/storage/diagnostic compatibility.
- Approved splash/loading visual is stored as `assets/motorlab_splash_approved.webp` and loaded by `motorlab_branding.js` / `motorlab-branding-v1`.
- Splash is presentation-only: it does not delay sensor/identity initialization more than the bounded visual interval and does not gain measurement authority.
- Normal-user navigation direction is now **ETUSIVU / VEDOT / ANALYYSI / ASETUKSET / KÄYTTÄJÄ**. Deep LIVE/RAW/diagnostic/admin tooling remains available to admin/development roles rather than cluttering normal use.
- Bottom navigation is fixed/floating with explicit iPhone safe-area spacing so page-end text/buttons are not covered.
- Settings use compact accordion sections that start closed; opening one closes the previous section.
- Normal user UI hides deep technical panels and removes invented **Throttle/TPS** display because no real throttle-position signal exists.
- Home keeps direct MIC access while reducing technical clutter.
- `simple_user_ui.js` / `motorlab-simple-user-ui-v34` implements the simplified role-aware presentation without changing measurement calculations.
- `motorlab_i18n.js` / `motorlab-i18n-v1` adds **Suomi / English** switching. Finnish remains fallback.
- Language preference key `motolab_language` is included in per-user cloud state so the selected language can restore with the user state.
- Language switching is presentation-only and must not reset sensors, active run state, identity, stored data, RPM authority, gear learning, RAW or dyno calculations.
- Preferred English dyno terminology remains RPM, POWER, TORQUE, RUN, GEAR, CONFIDENCE, AUDIO INPUT and RAW DATA.

## Measurement strategy and safety — unchanged in v34.0
- Road-test / learning work uses **GPS MASTER + MIC LEARN** unless an explicit test mode says otherwise.
- GPS/speed + selected gear remains control RPM authority.
- Phone/BT/contact microphone remains shadow/learning/reference data in GPS MASTER and must not alter displayed RPM, run acceptance or normal gear learning.
- Camera RPM remains disabled.
- Preserve raw/top-candidate/harmonic information for replay and trainer evaluation.
- UI, branding, language, identity, feedback, sharing, community, Tester Merit, LIVE and diagnostics layers must not change dyno calculations or measurement authority.

## Retained microphone stability / diagnostics
- `sensor_persistence.js` remains `sensor-persistence-v5`: a genuinely live enabled track is authoritative; `audio_frames_stale` no longer triggers destructive reconnect storms.
- Genuine ended/non-live tracks may recover only when desired MIC state is ON.
- `mic_authority.js` remains `motolab-mic-authority-v2`: explicit user MIC OFF is authoritative and MIC actions are serialized through one command queue.
- `mic_command_start` / `mic_command_done` telemetry remains available for ordering/failure reconstruction.
- `diagnostics.js` / `motolab-diagnostics-v1` remains always-on and observational, with persistent error/event history and crash-surviving local ring/heartbeat behavior.
- Diagnostics never gains recovery or measurement authority.

## Retained LIVE / technical inspection
- `live_status.js` / `motolab-live-status-v1` remains the deep technical inspection layer.
- LIVE covers GPS, MIC/RPM, IMU, GEAR, DYNO/RUN, RAW/SYNC/QUEUES, DIAGNOSTICS/EVENT LOG and SYSTEM.
- v34.0 hides this depth from normal users by default but retains it for admin/development use.

## Retained identity / cloud / Beta systems
- v33.0+ device-bound identity, pending/active/blocked lifecycle and per-user cloud state remain active.
- Login remains automatic through device identity; no routine password login was introduced for normal beta users.
- v33.1-v33.3 private feedback, Beta community, private diagnostics and reduced graphical run sharing remain active.
- Shared runs contain no RAW payload and recipients have no edit rights; own-run and best-own comparison support is retained.
- v33.4 Tester Merit remains quality-based with server-side scoring/review and no automatic feature unlock from score alone.
- v33.5 User/Beta destinations remain: own account, private feedback/messages, Beta community, shared runs, tester level and invite tester; admin additions remain approvals, feedback admin, merit review, feature permissions and community/private diagnostics.

## Retained v33.8-v33.9 gear/admin/owner behavior
- Admin-only selectable audio input remains available and uses exact deviceId constraints where the browser exposes them.
- Audio-source changes use the serialized MIC authority path; unavailable selected input must not silently be treated as the same sensor through fallback.
- Third-gear research prompt remains available to all beta users only during active third-gear research.
- Suspected 2nd/4th must persist continuously for 2.0 s before prompting; 2/3/4 confirmation is manual shadow/reference evidence only; OHITA skips without trusted teaching evidence.
- GPS MASTER remains authoritative for displayed RPM, run acceptance and normal gear-learning authority.
- `user_identity.js` retains secure VäNä owner/admin bootstrap/recovery behavior; nickname alone never grants admin rights and recovery secrets remain server-side only.

## Adaptive GPS-taught RPM learning / RAW
- `rpm-learning-model.json` remains schema `motolab_rpm_learning_model_v1` with 500-rpm learning regions and 0.5x / 1x / 2x branch evidence.
- Candidate continuity/prediction remains part of selection; old RAW can be replayed through newer logic.
- Auto Gear Learn must not receive microphone authority in GPS MASTER + MIC LEARN.
- Third-gear research storage stays separate from normal run/learning storage.
- RAW/research remains local-first with retry after network loss/reopen and multi-device attribution.
- Railway/private `Motolab-data` remains the research/raw archive target; public repo must not contain receiver/read secrets.

## Vehicle / maintenance
- Finland vehicle database v2, Yamaha DT125R and Derbi Senda 50 families, editable drivetrain data, technical-spec editor and maintenance/history remain active.
- Settings remains the user-changeable configuration area; deep technical state belongs under LIVE/admin tooling.

## Validation priorities after v34.0 deploy
- Real iPhone: verify v34.0 splash, fixed bottom nav safe area, page-end spacing, settings one-open-at-a-time behavior, User menu, normal/admin role visibility and no UI loop/jank.
- Verify Finnish/English switching across active screens, reload/update persistence and per-user cloud restore without sensor/run reset.
- Re-test explicit MIC OFF -> ON, genuine ended-track recovery, rapid taps/visibility transitions and admin audio-source switching.
- Validate third-gear beta UI with ordinary beta users and confirm telemetry/IndexedDB research markers.
- Validate owner/admin persistence across normal PWA update/reload and configured recovery.
- Continue multi-user/device validation for identity/cloud state, feedback/community privacy, reduced run sharing and Tester Merit.
- Validate LIVE/diagnostics/RAW replay show no measurement-performance regression.

## Deferred / unfinished work
- Automatic knock / ignition autotune remains intentionally parked.
- Full Knowledge Base integration across all porting/pipe/carb/ignition tuning calculators remains parked.
- Camera RPM remains disabled.
- Native AirPods motion remains experimental until validated on a real device.
- v34.0 visual layer is deployed, but real-device visual polish and field validation remain open; do not treat mockup-level styling as proof of all-screen pixel-perfect behavior until tested on phone.

## Durable project-memory rule
- GitHub is the durable MotoLab project memory.
- Archive important decisions, tests, RAW interpretations, build changes, regressions/fixes and unfinished work in `MOTOLAB_CONVERSATION_ARCHIVE.md` and this status when they affect active handoff.
- Before implementation, inspect current `main`, this file, the conversation archive and relevant technical notes.

## Regression rule
Before merging measurement changes, preserve GPS, GPS MASTER + MIC LEARN, GPS ONLY, explicit phone-mic modes, continuous ARM AUTO, AutoRide, manual run recording, run persistence, profiles, Knowledge Base, learning/raw data and RAW JSON export/replay, full-trip research capture, automatic research/RAW sync, vehicle lookup, maintenance, DT startup profile, release identity/PWA behavior, persistent diagnostics, v32.8 microphone stability, LIVE technical inspection, v33.x identity/cloud/run-sharing/community/private-feedback/Tester-Merit/Beta-menu layers, v33.7 unified MIC command authority, v33.9 owner/gear-beta behavior, admin-only audio-source selection and v34.0 language/UI presentation isolation.