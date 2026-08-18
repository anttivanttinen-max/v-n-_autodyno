# VÄNÄ MotoLab — conversation archive and durable project memory

Updated: 2026-08-18

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

## Historical root field line — v32.9.1
- The earlier root published application line was **v32.9.1 FIELD / build `2026-08-17u-field-recovery`**.
- Field-recovery identity did not change measurement logic; Service Worker recovery forced a clean cache and removed old MotoLab/MotorLab caches.
- v32.8 microphone stability and v32.7 diagnostics were preserved under that line.
- Third-gear research included confirmation/guard flow and gear-guard transitions; phone RAW research capture was non-invasive.
- Finland vehicle database v2 and beta-auth RAW sync were already present.
- This line is now historical: `main` was later explicitly promoted to v34.8 BETA.

## v34 development and locked appearance
- Older `release/v34.0-2026-08-17` points to `58d270274b979847fd760f7681818d9e7034b2ec` / build `2026-08-17o-rebuild-ui-i18n`.
- User-approved v34 direction includes rebuilt UI/navigation, user identity/cloud work, language support and agreed v34 systems.
- User decision: the completed visual appearance is **finished and locked as the approved visual baseline**. Functional work should preserve it unless UI design is explicitly reopened.
- Install/deploy/merge actions require explicit approval; this memory job itself never performs application promotion or deployment.

## v34.6 DEV browser/Service Worker validation
- Validated rebuild point `f203b3e2fb95afbbd0a04ff27319b5f40d7f8dcb` used identity **v34.6 DEV / build `2026-08-17w-v34-rebuild-swfix`**.
- Chromium + real Service Worker smoke testing found a reload-only bug: SW HTML injection regex rewrote inline `navigator.serviceWorker.register(...)` and truncated JS at an inner `encodeURIComponent(build)` parenthesis, preventing navigation handlers from initializing after reload.
- Fix `f203b3e`: stop regex-rewriting inline JS/register calls and bump build/cache identity.
- GitHub Actions run `32044453957` passed app/server syntax, static validation x3, identity/server integration x3, measurement invariant markers and Browser + Service Worker smoke x2.
- Browser/SW validation does not replace real iPhone GPS/microphone validation.

## 2026-08-17 test publication and auth-origin regression
- `main` gained commit `6493bd0384e3e9ef2a9cf0bb1571f6321d79edf9`, publishing a v34 test copy under `ty/`; it did not promote v34 to root at that time.
- `ty/version.js` identified v34.6 DEV / `2026-08-17w-v34-rebuild-swfix`.
- Real test report: login did not work.
- `user_identity.js` targeted Railway production while backend CORS allowed GitHub Pages origin. A different/CDN test origin could therefore block auth before Railway activation/session logic.
- Treat this as a test-host/origin integration regression, not proof that registry/token logic itself was broken.
- Required recovery was to run under the allowed GitHub Pages origin or deliberately change backend CORS, then validate owner/session/activation end-to-end against Railway.
- A separate phone UI report identified KÄYTTÄJÄ submenu overlap with notification/status area.

## v34 submenu/notification overlap fix
- `cd244ecad4902229d0c4d17a3460e3ab2e1e7d5e` changed `beta_menu.js` to `motolab-beta-menu-v4`, added safe-area-aware top clearance, bounded menu height with `100dvh`, and kept toast/status layering above the menu without redesigning the approved UI.
- `ae6f10036be8152f14ddef1b5afe1c8d1c2229d0` extended 390×844 browser smoke and fails if submenu clearance is violated (`menuBox.y < 88`).
- This converted the overlap report into an explicit regression assertion; actual-phone viewport validation remained desirable.

## 2026-08-18 repository cleanup and v34.7 BETA handoff
- Cleanup removed obsolete duplicate `ty/` tester copy, obsolete one-off patch workflows and old v31 patch/zip artifacts. These were repository-maintenance changes, not a measurement build.
- `dev/v34-rebuild` advanced to **v34.7 BETA / build `2026-08-18b-splash-run-analysis`**.
- v34.7 fixed bike/profile selection so the selected bike immediately updates and persists as active profile.
- Analysis added explicit **Run A / Run B** selectors for comparing two stored runs, including measured power/torque and recorded tuning/setup differences.
- Run tuning/setup metadata may be completed or corrected after a run. Post-run edits must never rewrite `run.data`, RAW/source-specific samples or learning data; edited metadata is marked with post-run origin/timestamp information.
- A/B comparison warns when bike profile, gear, quality or setup signatures make runs insufficiently comparable and must not claim tuning causation from weak/non-comparable pairs.
- v34.7 browser coverage added splash/login handoff, real profile selection, A/B analysis, post-run metadata persistence and a full UI walk.
- No new RAW measurement result was established by these UI/analysis changes.

## v34.8 BETA finalization and promotion — 2026-08-18
- v34.8 final identity is **v34.8 BETA / build `2026-08-18c-final-ui-gear-auth`**.
- Approved splash is part of startup on both first uncontrolled load and Service Worker-controlled reloads. The splash uses local `assets/motorlab_splash_approved.webp`, a minimum display time, centered safe login card and guest fallback.
- First uncontrolled load can bootstrap `user_identity.js` before Service Worker control, allowing owner/session lookup to begin behind the splash instead of waiting for the first SW reload.
- Owner/admin device-session recovery remains wired through `owner_device_session_server.js` and loaded by beta auth.
- User menu remains the home for Feedback & Messages, community, shared runs, Tester Merit, LIVE and invites; legacy floating feedback/admin-feedback buttons are suppressed.
- v34.8 includes the centered safe-area gear-suspicion confirmation flow, associated gear metadata handling and the phone candidate bridge covered by the final browser regressions.
- Final validated commit before promotion: `21c396cbb0a55bc33ea65f85db2c9b53bf4fced1`.
- GitHub Actions run `32111288808` completed successfully: application JS syntax, server/validation-script syntax, static rebuild validation x3, identity/server integration x3, measurement invariant markers, Browser + Service Worker smoke x2 and Full user UI walk all passed.
- Browser regression coverage includes first-load splash, splash/login safe area, Run A/B comparison, post-run metadata persistence, gear metadata editing without measurement-data mutation, centered gear confirmation colors/confirmation, phone candidate bridge, user-menu feedback placement, profile selection, LIVE navigation and main-menu runtime behavior.
- Commit `a37013ef85b4b089f7544a7a8753d8ca2d8670d9` explicitly **promoted v34.8 BETA to root `main` while preserving project-memory files**.
- Root `version.js` initially identified v34.8 BETA / `2026-08-18c-final-ui-gear-auth`; later startup/cache-reset maintenance advanced the build identity without changing the v34.8 release label.
- This promotion does not by itself prove physical iPhone GPS/MIC/IMU routing; hardware validation remains separate.

## VäNä owner/admin recovery after v34.8 promotion
- After the v34.8 promotion, `main` added a **one-time VäNä owner bootstrap** for admin recovery.
- Commit `167341692750b597ef99f691348aa42016303cc4` added `raw_sync_server/owner_bootstrap_server.js` with a hash-gated one-time activation path. A successful claim creates/restores nickname `VäNä`, sets `status=active` and `role=admin`, binds the claiming device, records owner-claim metadata, marks the bootstrap consumed and issues a signed one-year device token.
- Original bootstrap safety: initial bootstrap refuses after consumption, refuses when an admin already exists, requires configured `BETA_TOKEN_SECRET`, requires a deviceId, and ordinary nickname `VäNä` alone does not grant admin rights.
- Commit `9af0fcd900ca354c58e8d75eb3016b6165220a1e` explicitly loads the owner bootstrap through `beta_auth_server.js` while preserving the existing owner-device-session layer.
- Commit `a9551311c2b658c1a162cd7ab5a8ff1679fffc92` added `/api/users/v1/owner-bootstrap-status` for operational recovery checks.
- Commit `fc1ae50fd0c6eeca05f6df8016fe89a92fb0aded` changed the bootstrap hash to the current short one-time VäNä owner bootstrap code. **The plaintext recovery code must not be archived here or exposed in project memory.**
- Commit `df6e07477ccaf3e2a28c2c9deb82eed627ed660a` adds a separate **single post-bootstrap owner recovery** path for the case where bootstrap is already consumed and an admin exists. It rebinds/adds the claiming device to the existing admin, refreshes VäNä active/admin state-��_-�G����ƭy� re-normalizes weights but caps confidence; clipping, prediction and source disagreement impose hard caps.

Suggested caps: prediction <=35, contact-only without verified engine signature <=0 for learning, contact-only verified <=85, inductive-only with unknown pulses/rev <=60. Confidence calibration is later measured with reliability plots; thresholds remain configuration-versioned.

## GPS cross-validation and calibration

GPS reference RPM is derived from speed plus selected gear using drivetrain/profile ratios or a saved gear calibration. During learning it is the authority, but only in steady, high-quality windows: valid accuracy, sufficient speed, known gear, no clutch slip/shift, and limited wheel slip/acceleration transients.

Calibration sequence:

1. Static health/noise check with engine off.
2. Idle and stepped stationary holds to verify signal follows engine changes; if available compare with trusted service tach/inductive path.
3. GPS-master road pulls in known gears; sensor remains shadow-only.
4. Fit pulses-per-rev and contact harmonic mapping per vehicle/setup/mount. Never choose a multiplier merely because it makes one run agree.
5. Validate on held-out runs and a remount before marking the calibration usable.

## User-specific learning

Learning state is keyed by user/profile, vehicle ID, setup signature, sensor hardware ID, firmware/algorithm version and mount ID. Store priors for pulses/rev, reliable band, harmonic preference, noise floor, gain and latency. Promotion requires diverse accepted sessions and held-out validation; rollback preserves the previous model. No cross-user sharing by default, and no learning from unverified audio, rejected frames, predicted samples, unknown gear, clutch slip or poor GPS.

## Gear-learning compatibility

The node publishes synchronized timestamps and source latency so MotoLab can join RPM evidence to GPS speed. In GPS-authority mode, gear learning remains GPS/profile-controlled. After separate approval, an accepted external reference could validate ratios, but it must never create a gear ratio from a harmonic candidate without GPS agreement and stable known-gear segments.

## RAW evidence contract

Preserve session metadata, monotonic/device time sync, calibration/config hashes, mount/setup identity, ADC rate/gain, waveform window references, spectral/autocorrelation candidates, inductive edges, selected RPM, runner-up, confidence components, rejection flags, GPS join fields, firmware resets and BLE loss counters. RAW is append-only for a session; derived algorithms write a new versioned result rather than rewriting observations.

