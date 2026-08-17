# VÄNÄ MotoLab — conversation archive and durable project memory

Updated: 2026-08-17

## Purpose and archiving rule
This file is the durable GitHub memory for MotoLab development conversations. Important decisions, test results, constraints, implementation notes, unfinished work, data-analysis findings and cross-thread handoff notes must be retained here so they are not lost when a chat ends.

- Treat GitHub as the source of truth for durable MotoLab project memory.
- Before implementation, read latest `main`, `MOTOLAB_SYNC_STATUS.md`, this archive and relevant technical notes.
- After implementation, retain important decisions, tests, regressions, builds and remaining work.
- Raw measurement data belongs in private `Motolab-data`; implementation/project memory belongs in `v-n-_autodyno`.
- The recurring memory job is documentation-only: it must not modify application code or create no-op commits.

## Current core constraints
- GPS MASTER remains authoritative during GPS + microphone learning. Microphone data must not alter displayed RPM, run acceptance or gear learning while GPS MASTER is selected.
- Preserve raw/source-specific measurements separately from derived/fused values so old data can be reprocessed later.
- Camera RPM remains disabled unless explicitly reopened.
- Microphone RPM development must retain candidate/harmonic information, continuity information and reference comparisons, not only final RPM.
- Measurement continuity and logging reliability take priority over UI smoothness.
- Always inspect current `main` HEAD before editing; parallel MotoLab work must not create competing “latest” states.

## Important RAW / microphone findings
- v32.4 / build `2026-08-16h` is the earlier RAW baseline for GPS-master and BT/contact microphone comparisons.
- A prior RAW set contained 70 chunks and 14,709 samples.
- GPS-master structure behaved correctly: `rpmControlAuthority = gps`; microphone stayed out of displayed RPM, acceptance and gear-learning authority.
- BT/contact microphone contains real engine-RPM information but candidate/harmonic selection was not yet stable enough to trust alone.
- Useful examples: GPS 5191 rpm vs mic 5512 rpm (~6.2% error), GPS 4261 rpm vs mic 3807 rpm (~10.6%, lower confidence).
- Harmonic jumping motivated retaining multiple candidate alternatives and continuity tracking.
- Preferred contact mounting: extension nut + aluminium shim + tightly coupled BT earbud/contact microphone.
- Strong contact reference: ~6600 rpm truth, 6591 rpm audio average, ~92.2% confidence, f0 ~109–112 Hz, harmonics ~220/330/440/550/660 Hz.

## iOS microphone recovery finding and fixes
- Session `learn-1786918521880-f44c5b485d4888` showed repeatable microphone recovery failure while GPS/IMU stayed active: wanted `gps=true, imu=true, mic=true`, but repeated checks reported mic false and `track_not_live`.
- GPS MASTER safety remained correct in those RAW rows: mic did not influence displayed RPM, run acceptance or gear learning.
- v32.6 added fresh-stream recovery via `stopAudio()`/`startAudio()`, bounded ~0.5 s → 1 s → 2 s → 5 s retry, telemetry and a manual user-gesture recovery action.
- Field report after v32.6 showed an OFF/ON reconnect storm. Root cause was destructive use of `MOTOLAB_AUDIO_LAST?.t` as a stale-frame trigger without a reliable producer-backed timestamp.
- v32.8 / build `2026-08-17c-mic-stability`, `sensor-persistence-v5`, removed `audio_frames_stale` as a destructive reconnect trigger. A live enabled track on an active stream is authoritative; destructive recovery remains only for genuinely non-live/ended tracks.
- Real-device validation remains required: prove both no false OFF/ON storm and recovery of a genuinely ended track.

## Persistent diagnostics — v32.7
- MotoLab has an always-on observational diagnostics design (`diagnostics.js` / `motolab-diagnostics-v1`).
- It captures window errors, unhandled rejections, console errors/warnings, failed/non-OK fetches, network/visibility/page/media-device/SW lifecycle state and mirrors central learning events.
- Records include release/build, diagnostic session and sensor snapshots. A 500-event local ring, heartbeat and session marker survive restart/crash.
- iOS `pagehide` is not proof of clean shutdown. An unfinished previous session can emit `previous_session_unclean` on next boot.
- Queue diagnostics retain safe count/status/error metadata without secrets or arbitrary payloads.
- Pending diagnostics can replay into RAW as `diagnostic_replay` once the normal learning path is available.
- Diagnostics must never gain authority over GPS MASTER, RPM, run acceptance, gear learning, candidate choice, dyno calculations or sensor recovery.

## LIVE technical inspection — v32.9 base
- Product decision: deep technical operating state belongs on a dedicated **LIVE** bottom-navigation page, not crowded into normal measurement/home or Settings.
- Normal navigation is effectively MITTAUS / VEDOT / LIVE / ANALYYSI / ASETUKSET; developer AUTOTUNE remains developer-only.
- `live_status.js` / `motolab-live-status-v1` adds observational GPS / MIC / IMU / RAW / SYNC traffic-light status and expandable cards for sensor, gear, dyno/run, queues, diagnostics/events and system state.
- `live_status_guard.js` keeps LIVE outside legacy self-test screen counts and handles leaving LIVE through normal navigation.
- LIVE refreshes only while active (~750 ms) and must not control measurement or recovery logic.

## Adaptive RPM learning
- `rpm-learning-model.json` uses schema `motolab_rpm_learning_model_v1`; baseline has no learned bands and explicit acceptance limits.
- Adaptive GPS-taught RPM learning and RAW replay were added in commits `58c1feb`, `fd6cfe4`, `fe66331`.
- Learning uses 500 rpm regions and can prefer 0.5x / 1x / 2x harmonic branches when GPS-supervised evidence supports it; continuity/prediction discourages one-frame harmonic jumps.
- Existing RAW history can be replayed through newer logic.
- Auto Gear Learn remains available but GPS MASTER + MIC LEARN must never give microphone shadow RPM gear-learning authority.
- Overnight trainer may publish only validated improving models, with rollback history retained in `Motolab-data`.

## Published field line on root main
- The root published application line remains **v32.9.1 FIELD / build `2026-08-17u-field-recovery`** beneath documentation/test-folder commits.
- Field-recovery identity did not change measurement logic; Service Worker recovery forces a clean cache and removes old MotoLab/MotorLab caches.
- v32.8 microphone stability and v32.7 diagnostics remain preserved under this line.
- Third-gear research includes confirmation/guard flow and logs gear-guard transitions; phone raw research capture is non-invasive.
- Finland vehicle database v2 is installed. Beta auth is enabled for automatic RAW sync.

## v34 development/release line and locked appearance
- v34 is separate from the root v32.9.1 FIELD line and must not be confused with it.
- Older `release/v34.0-2026-08-17` points to `58d270274b979847fd760f7681818d9e7034b2ec` / build `2026-08-17o-rebuild-ui-i18n`.
- User-approved v34 direction includes rebuilt UI/navigation, user identity/cloud work, language support and agreed v34 systems.
- User decision: the completed visual appearance is **finished and locked as the approved visual baseline**. Functional work should preserve it unless UI design is explicitly reopened.
- Install/deploy/merge actions require explicit approval; this memory job never performs them.

## v34.6 DEV browser/Service Worker validation
- Validated rebuild work is on `dev/v34-rebuild`; archived validated point `f203b3e2fb95afbbd0a04ff27319b5f40d7f8dcb`, identity **v34.6 DEV / build `2026-08-17w-v34-rebuild-swfix`**.
- Chromium + real Service Worker smoke testing was added so runtime behavior is exercised after SW-controlled reload.
- It found a real reload-only bug: SW HTML injection regex rewrote inline `navigator.serviceWorker.register(...)` and truncated JS at an inner `encodeURIComponent(build)` parenthesis, preventing navigation handlers from initializing after reload.
- Fix `f203b3e`: stop regex-rewriting inline JS/register calls; bump build/cache identity.
- GitHub Actions run `32044453957` passed app/server syntax, static validation x3, identity/server integration x3, measurement invariant markers and Browser + Service Worker smoke x2.
- This does not replace real iPhone GPS/microphone validation.

## New main test publication and auth-origin regression — 2026-08-17 evening
- Current `main/HEAD` checked by the archive job is `6493bd0384e3e9ef2a9cf0bb1571f6321d79edf9`, commit **“Publish v34 test build under ty folder”** (2026-08-17 18:36:25Z).
- This commit adds a **test copy under `ty/`**; it does not mean the root v32.9.1 FIELD application line was replaced or that v34 was promoted as the production/root application.
- `ty/version.js` identifies the copied test build as **v34.6 DEV / `2026-08-17w-v34-rebuild-swfix`**.
- After the test publication, a real user test reported **login not working**.
- Code inspection confirmed `user_identity.js` targets Railway production server `https://v-n-autodyno-production.up.railway.app`, while the backend CORS contract allows the GitHub Pages origin `https://anttivanttinen-max.github.io` for user/admin requests.
- The test-launch approach had used a different/CDN origin in the v34 test path, so browser CORS could block auth requests before actual activation/session logic reached Railway. Treat this as a **test-host/origin integration regression**, not proof that the underlying user registry/token logic itself is broken.
- Required follow-up: ensure the test app executes under the allowed GitHub Pages origin (or deliberately update the backend CORS contract), then perform a real end-to-end owner/session/activation test against Railway. Do not declare login fixed based only on UI/static/browser smoke tests.
- A separate UI field report also noted an **alavalikko/submenu overlapping the notification/status area**. This belongs to the locked-UI regression list: functional layering/z-index fixes are allowed, but the approved visual design should not be redesigned.
- No new RAW measurement finding was identified in this archive interval.

## Data pipeline
- MotoLab stores RAW locally first and syncs new chunks to Railway when configured.
- Railway mirrors received RAW into private `anttivanttinen-max/Motolab-data`.
- Multi-phone/device data is separated by persistent device identity/labels.
- GitHub data can be analyzed manually; an overnight trainer checks new RAW/research data.
- Bad/non-improving models must not replace the accepted model; rollback history must be kept.

## Sensor / microphone UI decisions
- Sensor ON/OFF preferences should persist across restarts.
- Microphone choice should be directly reachable from home.
- Known audio inputs should be selectable; unavailable selected devices must not silently fall back to a different microphone and be treated as the same sensor.
- iOS may require a user gesture before opening audio; desired selection/state can persist while activation waits for a tap.
- Settings/maintenance sections should remain compact/collapsible; deep technical state belongs primarily under LIVE.

## Current implementation direction / unfinished validation
- Keep the root v32.9.1 FIELD line stable while v34 is validated separately.
- Preserve the locked v34 appearance; fix only functional regressions unless design is explicitly reopened.
- Resolve and real-device validate v34 test login/auth origin end-to-end against Railway.
- Validate submenu/notification layering on the actual phone viewport.
- Real-device validate v34 GPS/microphone behavior before any production promotion.
- Real-device validate v32.8 microphone stability, v32.9/LIVE behavior and v32.7 diagnostics persistence/replay.
- Validate adaptive candidate tracking, 500 rpm band learning and Auto Gear Learn interaction without weakening GPS MASTER.
- Preserve all raw/top-candidate/harmonic information for replay and trainer evaluation.
- Before any eventual v34 promotion, re-check current `main`, release/cache identity, measurement invariants and require explicit promotion/install approval.

## Deferred work explicitly parked
- Automatic knock / ignition autotune.
- Full Knowledge Base integration across every porting/pipe/carb/ignition tuning calculator.
- Camera RPM remains disabled.
- Native AirPods motion remains experimental until validated on a real device.

## Project-wide durable-memory instruction
When a MotoLab conversation contains information that would matter after that conversation ends, archive accepted decisions/constraints, measured tests/reference values, algorithm changes and reasons, regressions/fixes, build/version identity, unresolved/deferred work, RAW interpretation, deployment/sync architecture and cross-thread handoff notes. Full verbatim chat transcripts are not automatically available through the GitHub connector; structured project-relevant memory is the durable source of truth.