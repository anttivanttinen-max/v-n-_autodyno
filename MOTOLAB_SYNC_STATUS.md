# VÄNÄ MotoLab — shared development sync status

Updated: 2026-08-17

## Current application line
- Active published line on `main`: **v33.9 / build `2026-08-17n-owner-gear-beta`**.
- v32.7 introduced persistent diagnostics; v32.8 corrected the false microphone stale reconnect storm; v32.9 added LIVE technical inspection; v33.0 added user identity/approval/cloud state; v33.1 introduced feedback; v33.2 added Beta community/private diagnostics/run sharing; v33.3 added private feedback conversations; v33.4 added Tester Merit; v33.5 added visible User/Beta navigation; v33.6 enforced explicit user MIC OFF authority; v33.7 unified MIC controls through one command queue; v33.8 added admin-only audio-source and third-gear research test tools; v33.9 promoted the third-gear prompt to all beta users and added VäNä owner bootstrap/recovery support.
- `version.js` remains the release-identity source and the Service Worker/app shell must stay aligned with it.
- v31 remains the historical core baseline; newer modules layer onto the published PWA shell.
- Yamaha DT125R Athena 170 remains the startup-bike line used by the current development flow.
- Current temporary GPS power calibration in `dyno_curve_v2.js` remains **1.07** (`v32-dyno-curve-2.2`); the earlier 1.85 experiment is superseded.

## Measurement strategy and safety
- Road-test / learning work uses **GPS MASTER + MIC LEARN** unless an explicit test mode says otherwise.
- GPS/speed + selected gear remains the control RPM authority.
- Phone microphone RPM remains shadow/learning data in GPS MASTER and must not alter displayed RPM, run acceptance or gear learning.
- Camera RPM remains disabled.
- Preserve raw/top-candidate/harmonic information for replay and later trainer evaluation.
- Identity, feedback, run-sharing, community, Tester Merit, Beta navigation, LIVE, diagnostics, admin tools, owner/recovery and language/presentation layers must not change RPM authority, gear-learning authority, run acceptance or dyno calculations.

## Phone microphone / RPM basis
- Standalone Phone RPM Tester v3.6 reference: 34.642 s / 1040 frames / displayed 1620–9890 rpm; all frames captured with chunked IndexedDB storage.
- Practical target accuracy remains roughly ±200 rpm, with temporary ±300 rpm tolerable; continuity and rejection of x2/÷2 harmonic jumps matter more than exact single-frame equality.
- `phone_rpm_smart.js` / `phone-rpm-smart-v1` evaluates H1–H6 and simultaneous 0.5x / 1x / 2x hypotheses using spectral strength, continuity, prediction, candidate gap and soft GPS reference.
- Historical v32.4 RAW/contact baseline remains valid reference material, including ~6600 rpm truth / 6591 rpm audio / 92.2% confidence.

## Adaptive GPS-taught RPM learning
- `rpm-learning-model.json` uses schema `motolab_rpm_learning_model_v1`; baseline still starts with no learned bands.
- Learning is organized around 500-rpm regions and may prefer 0.5x / 1x / 2x branches when GPS-supervised evidence supports them.
- Candidate continuity/prediction remains part of selection and old local RAW can be replayed through newer logic.
- Auto Gear Learn must not receive microphone authority in GPS MASTER + MIC LEARN.
- Trainer may publish only validated improving models; reject bad/non-improving models and retain rollback history in `Motolab-data`.

## Research / RAW sync
- Third-gear GPS + MIC research uses GPS MASTER and a gear-confirm guard; microphone/raw research capture pauses when required gear is not confirmed.
- Research storage remains separate from normal run/learning storage.
- RAW/research is local-first and retried after network loss/reopen.
- Multi-phone data is separated by persistent device identity/labels.
- Railway mirrors accepted RAW/research into private `anttivanttinen-max/Motolab-data`.
- Receiver/read secrets must never be committed to the public app repository.

## Vehicle / maintenance / UI
- Finland vehicle database v2, Yamaha DT125R and Derbi Senda 50 families, editable drivetrain data, technical-spec editor and maintenance/history remain active.
- Home-screen microphone control remains directly reachable.
- Settings contains user-adjustable configuration; LIVE contains deep technical sensor/queue/diagnostic state.
- Settings/maintenance sections should remain compact/collapsible.
- Publication-facing product name is **VäNä MotorLab**; internal legacy identifiers may remain where renaming would risk compatibility.
- Current accepted redesign direction: dark black/deep-red racing UI, translucent cards, subtle workshop environment and less technical clutter on normal screens.
- **Throttle is removed from normal UI** until a real TPS/throttle-position signal exists.
- Proposed normal navigation direction is **ETUSIVU / VEDOT / ANALYYSI / ASETUKSET / KÄYTTÄJÄ**; deep LIVE/RAW/diagnostic/admin information remains separately accessible and must be reconciled safely with existing navigation during implementation.
- Settings redesign target: accordion sections initially closed, only one open at a time.
- Floating bottom navigation must respect safe-area insets and never cover the last control/content.
- Splash/branding must use the real DT asset; only modest cleanup/lighting/crop/background changes are allowed, no AI-invented replacement bike or major component/geometry redesign.

## v32.8 microphone stability correction — retained
- `sensor_persistence.js` is `sensor-persistence-v5`.
- Root cause of the earlier OFF/ON reconnect storm was use of `MOTOLAB_AUDIO_LAST?.t` as a destructive stale-frame trigger without a reliable producer.
- `audio_frames_stale` no longer causes destructive reconnect; a live enabled track on an active stream is authoritative.
- Fresh-stream teardown/recreation remains for genuinely non-live/ended tracks with existing backoff and manual recovery.
- Real-device validation remains required.

## v32.7 persistent diagnostics — retained
- `diagnostics.js` / `motolab-diagnostics-v1` is always-on and observational.
- It records JS errors, unhandled rejections, console warnings/errors, failed fetch/non-OK HTTP, network/lifecycle/media-device and selected Service Worker events.
- A 500-event persistent local ring, session marker and heartbeat survive restarts/crashes.
- Pending diagnostics replay into RAW/learning as `diagnostic_replay` when available.
- Diagnostics never gains measurement or recovery authority.

## v32.9 LIVE technical status — retained
- `live_status.js` / `motolab-live-status-v1` adds **LIVE** bottom navigation; `live_status_guard.js` preserves legacy self-test/navigation compatibility.
- LIVE summary: GPS / MIC / IMU / RAW / SYNC.
- Expandable cards: GPS, MIC/RPM, IMU, GEAR, DYNO/RUN, RAW/SYNC/QUEUES, DIAGNOSTICS/EVENT LOG and SYSTEM.
- LIVE is observational only.

## v33.0-v33.3 user/community foundation — retained
- v33.0 identity layer creates/preserves device identity, user registry, invite/approval/block states and per-user cloud state.
- RAW/research beta requests are tied to active resolved user/device identity.
- v33.2 graphical run sharing is reduced-only: recipients receive no RAW payload and no edit rights; own-run and best-own comparisons are supported.
- v33.2 Beta community separates public issue data from private contact/device/app/sensor/diagnostic metadata and can attach ~60 seconds of private technical history.
- v33.3 feedback is a two-way private conversation system. Users only see their own threads; admin can reply and anonymously publish a private issue to the community without exposing private identity/conversation content.

## v33.4 Tester Merit — retained
- Release build: **`2026-08-17i-tester-merit`**.
- `raw_sync_server/merit_server.js` stores quality-based tester merit in `tester_merit.json`; `merit.js` / `motolab-tester-merit-v1` provides user/admin UI.
- Categories: data, reports, activity, community, reliability, ideas.
- Levels: 0–39 Beta Tester, 40–64 Active Tester, 65–84 Advanced Tester, 85–100 Core Tester.
- Merit rewards useful/reproducible contributions, not message volume. Same source can only be reviewed once; admin can award bonus merit.
- Technical problems can be classified by cause (`user`, `device`, `app`, `sensor`, `unknown`, `none`) and do not automatically penalize a user when not user-caused.
- Users see level/general explanation; admin sees exact score, categories, history and review candidates.
- Merit level does not automatically grant experimental feature access; admin permissions remain authoritative.
- Policy: `TESTER_MERIT_V33_4.md`.

## v33.5 visible User / Beta navigation — retained
- Release build: **`2026-08-17j-beta-navigation`**.
- `beta_menu.js` / `motolab-beta-menu-v1` adds visible **KÄYTTÄJÄ / BETA** navigation.
- User destinations: own account, private feedback/messages, Beta community, shared runs, tester level and invite tester.
- Admin destinations additionally include approvals, feedback admin, Merit review, per-user permissions and community/diagnostics.
- Login remains automatic through device MotoLab identity; no password flow was added.

## v33.6 explicit MIC OFF authority — retained
- Release build: **`2026-08-17k-mic-off-authority`**.
- `mic_authority.js` / `motolab-mic-authority-v1` made explicit user MIC OFF authoritative over automatic opening/recovery.
- Desired OFF state persisted to `motolab_v32_sensor_prefs.mic=false`; `startAudio()` was guarded and any still-live stream was stopped.
- This complements v32.8 recovery: explicit OFF stays OFF; explicit ON may still recover genuinely ended tracks.

## v33.7 unified MIC command queue — retained
- Release build: **`2026-08-17l-unified-mic-command`**.
- `mic_authority.js` is now **`motolab-mic-authority-v2`**.
- All main MIC actions are serialized through one Promise-backed command queue, preventing overlapping ON/OFF operations from separate UI/recovery callers.
- Commands support `toggle`, `on` and `off`; result includes command id/source, desired state, actual active state, success and error.
- `mic_command_start` and `mic_command_done` telemetry make command ordering and failures reconstructable.
- Main controls `#extMicBtn`, `#extChip` and explicit OFF controls are intercepted and routed through this queue.
- `MotoLabMicAuthority` exposes `command`, `toggle`, `on`, `off`, `setDesired`, `desired` and `active`.
- v33.7 preserves explicit OFF authority while reducing MIC race conditions.

## v33.8 admin audio / third-gear research tools — retained under v33.9
- v33.8 build: **`2026-08-17m-admin-audio-gear-test`**.
- `admin_test_tools.js` originally shipped as `motolab-admin-test-tools-v1`.
- Only active admin sees the additional audio-source selector; ordinary users keep the normal audio path.
- Admin can select a specific input device. The chosen id is stored locally and applied with exact `deviceId` to audio `getUserMedia()` constraints.
- If MIC is desired ON when the admin changes source, v33.7 authority performs ordered `off` → `on` so the stream reopens on the selected device.
- The third-gear overlay uses a continuous **2-second** 2nd/4th suspicion hold before prompting.
- Confirmation emits `trip_gear_manual_reference`, dispatches `motolab-trip-gear-reference`, stores a global manual reference and writes a `manual_gear_reference` marker into active research when possible.
- This is testing/reference instrumentation only; it must not silently change GPS MASTER displayed-RPM authority, run acceptance or normal gear-learning authority.

## v33.9 owner / gear beta — active on main
- Current release: **v33.9 / build `2026-08-17n-owner-gear-beta`**.
- `admin_test_tools.js` is **`motolab-admin-test-tools-v2`**.
- Third-gear research prompt is now visible to **all beta users** during an active third-gear research session; admin audio-input selection remains admin-only.
- Suspected 2nd/4th still requires a continuous 2.0 s hold. User can confirm 2/3/4 or OHITA; manual gear evidence remains shadow/reference data only.
- `user_identity.js` is **`motolab-user-identity-v2`** with explicit VäNä owner activation support.
- Server-side role/status is authoritative. The nickname `VäNä` alone never grants admin access.
- First-owner bootstrap can promote the existing device identity to active admin and reissue a signed device token.
- `raw_sync_server/owner_recovery_server.js` adds a single-use owner bootstrap marker plus server-configured recovery for a lost/new local device. Recovery uses server-side `MOTOLAB_OWNER_RECOVERY_CODE`; no plaintext owner credential belongs in the public app UI/repository.
- Ordinary PWA updates must preserve device identity and owner/admin session state; this still needs real update/reload validation.

## Locked next-release plan / FI-EN language
- `NEXT_RELEASE_PLAN.md` is the current cross-conversation handoff and must be re-read before the next implementation/deploy.
- `LANGUAGE_PACK_EN_V1.md` is **READY FOR NEXT RELEASE, NOT YET DEPLOYED**.
- FI/EN is now explicitly part of the next release plan. Existing Finnish remains default/fallback; Settings adds Suomi / English.
- Language preference persists locally and in per-user cloud state.
- Active visible strings should use translation keys; missing English keys fall back to Finnish.
- Language switching must not reload/reset sensors, active run state, identity, stored data, RPM authority, gear-learning, RAW or dyno calculations.
- Preferred English dyno terminology: RPM, POWER, TORQUE, RUN, GEAR, CONFIDENCE, AUDIO INPUT, RAW DATA.

## ARM AUTO / pull comparison
- ARM AUTO remains persistent across multiple pulls; each detected pull saves separately, cooldown/reset hysteresis re-arms automatically, STOP explicitly disarms.
- Development comparisons should primarily use the previous MotoLab pull as the 100% reference; PerfExpert can use the same reference.
- Compare peak power, peak torque and useful-range/curve performance, not only one peak point.

## Current validation priorities
- Validate v33.9 on real iPhone: explicit MIC OFF stays OFF, MIC ON still recovers genuinely ended/disconnected tracks, rapid taps/visibility changes do not create races, and admin source switching reliably opens the intended device.
- Validate third-gear beta UI with ordinary beta users: only active research shows it, 2-second 2nd/4th hold, 2/3/4/OHITA behavior, return-to-3rd behavior, telemetry and IndexedDB marker persistence.
- Validate VäNä owner activation, one-time bootstrap consumption, ordinary update/reload persistence and configured recovery without creating an unintended admin path.
- Validate v33.4 Tester Merit with real active/admin users: scoring, one-review rule, bonus merit, persistence, privacy and no accidental permission escalation.
- Validate v33.5 User/Beta navigation on phone: all user/admin destinations and invite sharing.
- Continue validation of identity lifecycle, blocked state, token persistence, multi-device cloud-state restore/sync and RAW/research attribution.
- Validate run sharing, Beta community/private diagnostics, Railway persistence/restart and v33.3 private chat/anonymized publishing.
- Validate LIVE/diagnostics persistence and no measurement-performance regression.
- Validate adaptive candidate tracking, 500-rpm band learning and Auto Gear Learn interaction without weakening GPS MASTER.
- Implement and validate the locked FI/EN language system before calling the next wider release complete.

## Deferred / unfinished work
- Automatic knock / ignition autotune remains intentionally parked.
- Full Knowledge Base integration across every porting/pipe/carb/ignition tuning calculator remains parked.
- FI/EN language work is no longer parked; specification is ready and included in the next release, but not yet deployed.
- Identity/cloud, run sharing, Beta community/private diagnostics, private feedback, Tester Merit, v33.7 unified MIC control and v33.9 owner/gear-beta paths require real multi-user/device/server field validation before being treated as fully proven.
- New UI/branding direction is accepted as an implementation plan; current v33.9 should not be described as already matching the new mockups.

## Durable project-memory rule
- GitHub is the durable MotoLab project memory.
- Archive important decisions, tests, RAW interpretations, build changes, regressions/fixes and unfinished work in `MOTOLAB_CONVERSATION_ARCHIVE.md` and, when they change active handoff, here.
- The recurring archive job updates documentation only; it must not alter application code or create empty commits.
- Before implementation, check current `main`, this status, archive and relevant technical notes.

## Regression rule
Before merging measurement changes, preserve GPS, GPS MASTER + MIC LEARN, GPS ONLY, explicit phone-mic modes, continuous ARM AUTO, AutoRide, manual run recording, run persistence, profiles, Knowledge Base, learning/raw data and RAW JSON export/replay, full-trip research capture, automatic research/RAW sync, vehicle lookup, maintenance, compact Settings UI, DT startup profile, release identity/PWA behavior, persistent diagnostics, v32.8 microphone stability, LIVE technical inspection, v33.x identity/cloud/run-sharing/community/private-feedback/Tester-Merit/Beta-menu layers, v33.7 unified MIC command authority, v33.9 owner/gear-beta behavior, admin-only audio-source selection, language presentation isolation, and keep native AirPods motion experimental until validated on a real device.