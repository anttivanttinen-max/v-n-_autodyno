# VÄNÄ MotoLab — conversation archive and durable project memory

Updated: 2026-08-17

## Purpose and archiving rule
This file is the durable GitHub memory for MotoLab development conversations. Important decisions, test results, constraints, implementation notes, unfinished work, data-analysis findings and cross-thread handoff notes must be kept here so they are not lost when a chat ends.

- Treat GitHub as the source of truth for durable MotoLab project memory.
- Before implementation work, read current `main`, `MOTOLAB_SYNC_STATUS.md`, this archive and relevant technical notes.
- After implementation, archive important decisions, tests, regressions, builds and unfinished work.
- When parallel MotoLab conversations exist, both inherit the same repository state; do not create competing “latest” versions.
- Raw measurement data belongs in private `anttivanttinen-max/Motolab-data`; implementation/project memory belongs in `v-n-_autodyno`.
- The recurring memory job updates documentation only; it must not modify application code or create empty/no-op commits.

## Current core constraints
- GPS MASTER remains authoritative during GPS + microphone learning. Microphone data must not alter displayed RPM, run acceptance or gear learning while GPS MASTER is selected.
- Preserve raw/source-specific values separately from derived/fused values so old RAW can be reprocessed later.
- Camera RPM remains disabled unless explicitly reopened.
- Microphone RPM development must retain candidate/harmonic, continuity and reference-comparison information rather than only the selected RPM.
- Measurement continuity and logging reliability take priority over UI smoothness.
- Always inspect current `main` HEAD before editing.
- Publication-facing product name is **VäNä MotorLab**; internal MotoLab/AutoDyno identifiers may remain where renaming would risk RAW/API/storage/diagnostic compatibility.

## Historical RAW / microphone findings
- v32.4 / build `2026-08-16h` remains an earlier RAW baseline for GPS-master and BT/contact microphone comparisons.
- One baseline RAW set contained **70 chunks / 14,709 samples**.
- GPS-master behavior was correct: `rpmControlAuthority = gps`; microphone stayed out of displayed RPM, run acceptance and gear-learning authority.
- BT/contact microphone contained genuine engine-RPM information but harmonic/candidate selection was not stable enough to trust alone.
- Useful examples: GPS 5191 rpm vs mic 5512 rpm (~6.2% error); GPS 4261 rpm vs mic 3807 rpm (~10.6% error with lower confidence).
- Preferred historical contact mounting: extension nut + aluminium shim + tightly coupled BT earbud/contact microphone.
- Strong contact reference: about 6600 rpm truth, 6591 rpm audio average, ~92.2% confidence, f0 ~109–112 Hz and harmonics around 220/330/440/550/660 Hz.

## iOS microphone recovery / authority history
- Earlier RAW showed wanted state `gps=true, imu=true, mic=true` while mic remained inactive and recovery failed with `track_not_live`; GPS and IMU stayed active.
- v32.6 added fresh-stream recovery, bounded retries and a visible user-gesture recovery action.
- Field testing then found repeated OFF/ON reconnecting because `MOTOLAB_AUDIO_LAST?.t` was used as a destructive stale-frame signal without a reliable producer.
- v32.8 / build `2026-08-17c-mic-stability` corrected this in `sensor-persistence-v5`: `audio_frames_stale` no longer causes destructive reconnect; a genuinely live enabled track is authoritative. Genuine ended/non-live tracks still recover.
- v33.6 / build `2026-08-17k-mic-off-authority` made explicit user MIC OFF authoritative over automatic opening/recovery.
- v33.7 / build `2026-08-17l-unified-mic-command` advanced `mic_authority.js` to `motolab-mic-authority-v2`: MIC operations are serialized through one Promise-backed command queue; `mic_command_start` / `mic_command_done` telemetry reconstruct ordering/failures.
- Main MIC controls and explicit OFF actions share the same authority path. OFF means stay OFF; ON may recover genuinely ended tracks.
- Real-device validation remains required for rapid taps, visibility transitions, genuine ended-track recovery and no false reconnect loops.

## v32.7 diagnostics / v32.9 LIVE
- `diagnostics.js` / `motolab-diagnostics-v1` records global JS errors, rejected promises, console warnings/errors, fetch/HTTP failures, lifecycle/network/media-device events and selected Service Worker events.
- A persistent 500-event local ring plus heartbeat/session marker survives restarts/crashes; pending diagnostics can replay into RAW as `diagnostic_replay`.
- Diagnostics is observational only and never gains measurement/recovery authority.
- `live_status.js` / `motolab-live-status-v1` adds deep LIVE technical inspection. Cards cover GPS, MIC/RPM, IMU, GEAR, DYNO/RUN, RAW/SYNC/QUEUES, DIAGNOSTICS/EVENT LOG and SYSTEM.
- v34 hides this depth from normal users by default while retaining admin/development access.

## v33.0-v33.5 identity / cloud / community / sharing / merit
- v33.0 introduced device-bound identity, server-side user registry and per-user cloud state. User states are `pending`, `active`, `blocked`.
- Invitations are one-use/expiring; device sessions are signed server-side. RAW/research beta requests resolve to active user + device.
- Per-user cloud state uses `/api/users/v1/state`; remote state is preferred on initial sync when available, otherwise local state is uploaded.
- v33.1 introduced authenticated in-app feedback.
- v33.2 added Beta community, private diagnostic packages, per-user feature permissions and reduced graphical run sharing. Shared runs contain no RAW payload and recipients have no edit rights.
- v33.3 converted feedback into private two-way user/admin conversations. Admin may publish an issue anonymously into the public Beta community while retaining the private source thread separately.
- v33.4 / build `2026-08-17i-tester-merit` introduced quality-based Tester Merit. Categories: `data`, `reports`, `activity`, `community`, `reliability`, `ideas`; levels 0–39 Beta Tester, 40–64 Active Tester, 65–84 Advanced Tester, 85–100 Core Tester.
- Merit rewards useful/reproducible participation, not message volume. Device/app/sensor-caused failures do not automatically penalize the user. Merit does not automatically grant experimental permissions.
- v33.5 / build `2026-08-17j-beta-navigation` added visible KÄYTTÄJÄ / BETA navigation: account, private feedback/messages, Beta community, shared runs, tester level and invite tester; admin gets approvals, feedback admin, Merit review, permissions and community/private diagnostics.

## v33.8-v33.9 admin audio / gear beta / owner
- v33.8 added admin-only audio-source selection using an exact exposed `deviceId`, with controlled OFF -> source change -> ON through the unified MIC queue.
- An unavailable selected input must not silently fall back to another microphone and be treated as the same sensor.
- Third-gear research overlay asks for manual 2/3/4/OHITA confirmation only after a suspected 2nd/4th gear persists continuously for 2 seconds.
- Manual confirmation is shadow/reference teaching evidence only. GPS MASTER remains authoritative for displayed RPM, run acceptance and normal gear-learning authority.
- v33.9 / build `2026-08-17n-owner-gear-beta` made the third-gear prompt available to all beta users during active research while audio-source selection remains admin-only.
- `user_identity.js` v2 added secure VäNä owner activation. Nickname alone never grants admin; server-side role/status is authoritative.
- Owner bootstrap is single-use and recovery is server-controlled; recovery secrets must never be committed to public app code.

## Adaptive GPS-taught RPM learning / RAW pipeline
- `rpm-learning-model.json` uses schema `motolab_rpm_learning_model_v1`; learning operates in 500-rpm regions and can prefer 0.5x / 1x / 2x harmonic branches when GPS-supervised evidence supports them.
- Continuity/prediction is part of candidate selection; old local RAW can be replayed through newer logic.
- Auto Gear Learn must never receive microphone authority while GPS MASTER + MIC LEARN is selected.
- Trainer may publish only validated improving models; reject bad/non-improving models and retain rollback history in `Motolab-data`.
- Third-gear research storage stays separate from normal run/learning storage.
- RAW/research is local-first and retried after network loss/reopen; multi-phone data is separated by persistent device identity/labels.
- Railway mirrors accepted RAW/research into private `anttivanttinen-max/Motolab-data`; receiver/read secrets must never be committed to the public repo.

## Vehicle / maintenance / UI decisions retained
- Finland vehicle database v2, Yamaha DT125R and Derbi Senda 50 families, editable drivetrain data, technical-spec editor and maintenance/history remain active.
- Home-screen microphone control stays directly reachable.
- Settings contains user-changeable configuration; deep technical sensor/RAW/diagnostic information belongs under LIVE/admin/developer tooling.
- Throttle/TPS must not appear in the normal UI until a real throttle-position signal exists.
- Bottom navigation must respect iPhone safe area and must not cover page-end controls/content; full-screen graphs may hide it.

## Approved visual baseline — locked 2026-08-17
- The **workshop + white DT composition** is the accepted visual base. The bike should read as naturally embedded in the garage scene, with a slightly side-on three-quarter view that still shows the engine/expansion chamber and stance.
- Splash/loading composition is portrait-smartphone oriented. **VÄNÄ + MOTORLAB** branding occupies the free upper area, DT/workshop is the hero visual and loading state/progress belongs in the lower area.
- Avoid extra product-name clutter such as separate Tester branding on the splash.
- Restrained red racing illumination/workshop depth are accepted. Use the real DT asset or a faithful derived presentation; do not substitute an invented motorcycle or materially redesign its geometry/components.
- The user has now explicitly stated that the **appearance is finished**. Treat the accepted UI/look as a **locked baseline**: future functional development should preserve it unless the user explicitly reopens visual redesign.

## v34.0 MotorLab UI / branding / FI-EN release
- Active published `main` release is **v34.0 / build `2026-08-17o-motorlab-ui-fi-en`**.
- `version.js`, Service Worker cache identity and PWA manifest are aligned to v34.0.
- v34.0 is a presentation/navigation/language release layered on the retained v33.9 measurement/server foundation; measurement authority/calculations were not intentionally changed.
- `simple_user_ui.js` / `motorlab-simple-user-ui-v34` implements role-aware simplification: normal navigation is **ETUSIVU / VEDOT / ANALYYSI / ASETUKSET / KÄYTTÄJÄ**, deep technical panels are hidden from normal users, settings are compact accordions with one section open at a time, and the bottom nav is fixed/floating with safe-area spacing.
- `motorlab_i18n.js` / `motorlab-i18n-v1` adds Suomi / English presentation switching. Finnish remains fallback; `motolab_language` is included in per-user cloud state.
- Language switching must not reset sensors, active run state, identity, stored data, RPM authority, gear learning, RAW or dyno calculations.
- Preferred English dyno terminology: RPM, POWER, TORQUE, RUN, GEAR, CONFIDENCE, AUDIO INPUT, RAW DATA.
- Approved splash asset is `assets/motorlab_splash_approved.webp`; branding/display logic is in `motorlab_branding.js` / `motorlab-branding-v1`.

## v34.0 real-device bug discovered after deploy
- User field report after v34.0: **the splash does not appear at all on the phone**.
- This invalidates any assumption that splash integration has been successfully validated merely because the asset/module exists in the repository.
- Next debugging should verify real runtime module injection/order, Service Worker/PWA update/cache behavior, splash session/timing gate and actual asset loading/display on the phone.
- Keep the accepted splash artwork unchanged while diagnosing the visibility path; do not redesign the locked visual baseline to work around this bug.

## Current handoff / validation priorities
- Highest immediate visual defect: reproduce and fix the **splash-not-visible** issue on the real phone without changing the approved appearance.
- Validate v34 fixed bottom-nav safe area, page-end spacing, one-open-at-a-time settings, User menu, role visibility and absence of UI loop/jank on iPhone.
- Validate FI/EN switching across active screens, reload/update persistence and per-user cloud restore without disturbing measurement state.
- Re-test MIC OFF -> ON, genuine ended-track recovery, rapid taps/visibility transitions and admin source switching.
- Validate third-gear beta UI with ordinary users, including 2-second hold, 2/3/4/OHITA, telemetry and IndexedDB research markers.
- Validate owner/admin persistence across normal PWA updates and configured recovery.
- Continue multi-user/device validation of identity/cloud, feedback/community privacy, reduced run sharing and Tester Merit.
- Validate LIVE/diagnostics/RAW replay show no measurement-performance regression.

## Deferred / unfinished work
- Automatic knock / ignition autotune remains intentionally parked.
- Full Knowledge Base integration across every porting/pipe/carb/ignition tuning calculator remains parked.
- Camera RPM remains disabled.
- Native AirPods motion remains experimental until validated on a real device.
- v34.0 UI is deployed and visually locked, but field validation remains incomplete; the first confirmed v34 UI defect is the missing splash on the user's phone.

## Project-wide durable-memory instruction
Archive at minimum: accepted decisions/constraints, measured test/reference results, algorithm changes and reasons, regressions/fixes, build identity, unresolved/deferred work, RAW interpretations, deployment/sync changes and cross-thread handoff notes. Full chat transcripts are not automatically available through the GitHub connector; structured project-relevant memory remains the durable source of truth.