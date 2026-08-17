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

## Historical RAW / microphone findings
- v32.4 / build `2026-08-16h` remains an earlier RAW baseline for GPS-master and BT/contact microphone comparisons.
- One baseline RAW set contained 70 chunks and 14,709 samples.
- GPS-master behavior was correct: `rpmControlAuthority = gps`; microphone stayed out of displayed RPM, run acceptance and gear-learning authority.
- BT/contact microphone contained genuine engine-RPM information but harmonic/candidate selection was not stable enough to trust alone.
- Useful examples: GPS 5191 rpm vs mic 5512 rpm (~6.2% error); GPS 4261 rpm vs mic 3807 rpm (~10.6% error with lower confidence).
- Preferred historical contact mounting: extension nut + aluminium shim + tightly coupled BT earbud/contact microphone.
- Strong contact reference: about 6600 rpm truth, 6591 rpm audio average, ~92.2% confidence, f0 ~109–112 Hz and harmonics around 220/330/440/550/660 Hz.

## iOS microphone recovery history
- Earlier RAW showed wanted state `gps=true, imu=true, mic=true` while mic remained inactive and recovery failed with `track_not_live`; GPS and IMU stayed active.
- v32.6 added fresh-stream recovery, bounded retries and a visible user-gesture recovery action.
- Field testing then found repeated OFF/ON reconnecting because `MOTOLAB_AUDIO_LAST?.t` was used as a destructive stale-frame signal without a reliable producer.
- v32.8 / build `2026-08-17c-mic-stability` corrected this in `sensor-persistence-v5`: `audio_frames_stale` no longer causes destructive reconnect; a genuinely live enabled track is authoritative. Genuine ended/non-live tracks still recover.
- Real-device validation remains required for both no-false-reconnect and genuine ended-track recovery.

## v32.7 persistent diagnostics
- `diagnostics.js` / `motolab-diagnostics-v1` records global JS errors, rejected promises, console warnings/errors, fetch/HTTP failures, lifecycle/network/media-device events and selected Service Worker events.
- Central `addLearningEvent` traffic is mirrored observationally.
- A persistent 500-event local ring plus heartbeat/session marker survives restarts/crashes.
- iOS `pagehide` is not treated as proof of clean shutdown.
- Queue metadata is summarized without copying secrets or arbitrary payload contents.
- Pending diagnostics replay into RAW as `diagnostic_replay` when the normal event path becomes available.
- Diagnostics never gains measurement or recovery authority.

## v32.9 LIVE technical inspection
- Normal visible navigation is effectively **MITTAUS / VEDOT / LIVE / ANALYYSI / ASETUKSET**; experimental AUTOTUNE remains developer-only.
- `live_status.js` / `motolab-live-status-v1` adds LIVE; `live_status_guard.js` preserves legacy self-test/navigation compatibility.
- LIVE summary shows GPS / MIC / IMU / RAW / SYNC traffic-light state.
- Expandable cards cover GPS, MIC/RPM, IMU, GEAR, DYNO/RUN, RAW/SYNC/QUEUES, DIAGNOSTICS/EVENT LOG and SYSTEM.
- LIVE is strictly observational.

## v33.0 identity / approval / cloud-state foundation
- `user_identity.js` / `motolab-user-identity-v1` creates/preserves device identity and resolves a server-side user record.
- `raw_sync_server/user_server.js` stores user registry, one-use invitations and per-user cloud state.
- User states: `pending`, `active`, `blocked`; admins approve/block users.
- Invitation values are hashed, one-use and expire after seven days.
- Device tokens are HMAC-signed using `BETA_TOKEN_SECRET`; default lifetime 365 days unless configured otherwise.
- RAW/research beta requests are tied to an active resolved user/device identity.
- Per-user cloud state uses `/api/users/v1/state`; remote state is preferred on initial sync when available, otherwise local state is uploaded.

## v33.1-v33.3 feedback / community / run-sharing foundation
- v33.1 introduced authenticated in-app feedback.
- v33.2 added Beta community, private diagnostic packages, per-user feature permissions and reduced graphical run sharing. Shared runs contain no RAW payload and recipients have no edit rights.
- v33.2 community supports issue threads, comments, `Minulla sama ongelma`, statuses, working solutions and private admin-only diagnostics with roughly 60 seconds of technical history.
- Public issue data stays separate from device/contact/app/sensor/diagnostic metadata.
- v33.3 converted feedback into two-way private conversations. Users see only their own threads; admin can reply and manage states.
- Admin can publish a private feedback item anonymously into the public Beta community while retaining the private source thread separately.

## v33.4 Tester Merit — retained
- v33.4 build: **`2026-08-17i-tester-merit`**.
- `raw_sync_server/merit_server.js` adds quality-based tester merit using persistent `tester_merit.json` storage.
- Merit categories: `data`, `reports`, `activity`, `community`, `reliability`, `ideas`.
- Tester levels: 0–39 **Beta Tester**, 40–64 **Active Tester**, 65–84 **Advanced Tester**, 85–100 **Core Tester**.
- Merit rewards useful participation, reproducible bug reports, good test data, working solutions, community help and strong development ideas; it is not based on message count.
- Technical failure can be classified as `user`, `device`, `app`, `sensor`, `unknown` or `none`; device/app/sensor failures do not automatically penalize the user.
- The same feedback/issue/comment can be reviewed only once. Admin can also award separate bonus merit.
- Normal users see their tester level and general explanation, not the exact scoring formula/history. Admin sees exact score, category totals, event history and review candidates.
- Tester Merit does **not** automatically grant experimental features. Admin keeps explicit per-user feature-permission authority.
- `merit.js` / `motolab-tester-merit-v1` adds user Tester Level UI plus admin scoring/review UI.
- Detailed policy is in `TESTER_MERIT_V33_4.md`.

## v33.5 visible User / Beta navigation — retained
- v33.5 build: **`2026-08-17j-beta-navigation`**.
- `beta_menu.js` / `motolab-beta-menu-v1` adds a clearly visible **KÄYTTÄJÄ / BETA** entry point instead of leaving identity/community/feedback/sharing functions scattered or hidden.
- User menu groups: own account, private feedback/messages, Beta community, shared runs, tester level and invite tester.
- Admin menu additionally exposes user approvals, private feedback admin, Merit scoring, feature permissions and community/diagnostics.
- Account login remains automatic through the device MotoLab identity; no password flow was introduced.
- Invitation action reuses existing invite creation and system share/clipboard behavior.

## v33.6 explicit user MIC OFF authority — retained
- v33.6 build: **`2026-08-17k-mic-off-authority`**.
- `mic_authority.js` / `motolab-mic-authority-v1` made explicit user MIC OFF state authoritative over automatic microphone opening/recovery.
- MIC OFF persisted `motolab_v32_sensor_prefs.mic=false`; guarded `startAudio()` blocked automatic reopening and logged `mic_start_blocked_user_off`.
- If a microphone stream remained live while desired state was OFF, existing `stopAudio()` was used and `mic_forced_stop_user_off` logged.
- This complemented v32.8 recovery: OFF means stay OFF; ON may still recover genuinely ended tracks.

## v33.7 unified MIC command queue — retained
- v33.7 build: **`2026-08-17l-unified-mic-command`**.
- `mic_authority.js` advanced to **`motolab-mic-authority-v2`**.
- MIC actions are serialized through one Promise-backed command queue instead of letting multiple UI/recovery callers race each other.
- Commands support `toggle`, `on` and `off`; result data includes command id, source, desired state, actual active state, success and error.
- New telemetry includes `mic_command_start` and `mic_command_done`; desired-state changes still emit `mic_user_authority` with source information.
- Main MIC controls `#extMicBtn` and `#extChip` are intercepted in capture phase and routed to the unified queue. Explicit OFF controls are also routed through the same authority path.
- `MotoLabMicAuthority` exposes `command`, `toggle`, `on`, `off`, `setDesired`, `desired` and `active`.
- v33.7 keeps v33.6 OFF authority semantics while reducing ON/OFF race conditions between UI, autostart, recovery and other callers.
- Real-device validation is still required to prove rapid repeated taps, visibility transitions and recovery no longer create command races.

## v33.8 admin audio source + third-gear test tools — retained under v33.9
- v33.8 build: **`2026-08-17m-admin-audio-gear-test`**.
- `admin_test_tools.js` originally shipped as **`motolab-admin-test-tools-v1`**.
- Active approved admin can choose a specific audio input for test work. The selected device id is stored locally in `motolab_admin_audio_device` and applied as an exact `deviceId` constraint to audio `getUserMedia()` calls.
- Normal users are intentionally unaffected by the audio-source selector and continue using the normal microphone path.
- Changing admin audio source while MIC is wanted cycles the microphone through the v33.7 unified authority queue (`off` then `on`) so the new source is reopened in a controlled order.
- A floating **3. VAIHTEEN TESTI** overlay watches gear-guard evidence during active third-gear research.
- A suspected 2nd or 4th gear must persist continuously for **2 seconds** before asking for manual confirmation, reducing one-frame/short transient prompts.
- Confirmation creates `trip_gear_manual_reference` telemetry, dispatches `motolab-trip-gear-reference`, stores `MOTOLAB_TRIP_MANUAL_GEAR_REFERENCE`, and writes a `manual_gear_reference` marker into the active `VanaMotoLabResearch` timeline when available.
- Skip action logs `trip_gear_question_skipped` and suppresses repeated prompting for the same current suspected gear.
- These tools are testing/reference instrumentation and do not grant microphone or manual gear reference authority over GPS MASTER displayed RPM, run acceptance or normal gear-learning rules.

## v33.9 owner / gear beta release — current active release
- Current `main` release identity is **v33.9 / build `2026-08-17n-owner-gear-beta`**; `version.js` and Service Worker cache identity are aligned to v33.9.
- `admin_test_tools.js` advanced to **`motolab-admin-test-tools-v2`**: the third-gear research prompt is now available to **all beta users** during an active research session, while selectable audio input remains admin-only.
- Manual gear confirmation source is generalized to `manual_reference`; 2-second hold, 2/3/4 confirmation, OHITA, event logging and research marker behavior are retained.
- GPS MASTER remains authoritative; beta gear confirmation is reference/shadow teaching evidence only.
- `user_identity.js` advanced to **`motolab-user-identity-v2`** with explicit VäNä owner activation UI/API support. Owner nickname alone never grants admin rights; server-side role/status remains authoritative.
- Owner bootstrap supports first-owner promotion to active admin and issues a fresh signed device token after promotion.
- `raw_sync_server/owner_recovery_server.js` adds a single-use first-owner bootstrap plus server-configured owner recovery for site-data loss/new device. Recovery requires server-side configuration (`MOTOLAB_OWNER_RECOVERY_CODE`); recovery secrets are not stored as plaintext public app credentials.
- Bootstrap consumption is persisted in `owner-bootstrap.json`, preventing reuse after successful first-owner activation; owner recovery attaches/reuses a device on the existing admin account and reissues a device token.
- v33.9 owner/admin persistence across ordinary PWA updates remains a required field-validation item.

## Next release locked handoff / language system
- `NEXT_RELEASE_PLAN.md` is the current locked cross-conversation handoff for the next server/app release. Re-check current main immediately before implementing/deploying it.
- The plan retains v33.9 measurement invariants, all-beta third-gear teaching UI, admin-only audio source selection, owner persistence/recovery, MIC regression validation, User/Beta navigation, per-user cloud validation, feedback/community privacy, Tester Merit and LIVE/UI simplification.
- English support is now explicitly **included in the next release plan**, not parked as an unrelated branch.
- `LANGUAGE_PACK_EN_V1.md` is **READY FOR NEXT RELEASE, NOT YET DEPLOYED**.
- Existing Finnish remains the default/fallback. Settings will add **Suomi / English**, with preference persisted locally and in per-user cloud state.
- Language is presentation-only: switching language must not reset sensors, an active run, identity, stored data, RPM/gear-learning authority, RAW behavior or dyno logic.
- Active visible UI strings should move to translation keys; missing English keys fall back to Finnish. Established terminology includes RPM, POWER, TORQUE, RUN, GEAR, CONFIDENCE, AUDIO INPUT and RAW DATA.

## Adaptive GPS-taught RPM learning
- `rpm-learning-model.json` uses schema `motolab_rpm_learning_model_v1`; baseline starts with no learned bands.
- Learning works in 500-rpm regions and may prefer 0.5x / 1x / 2x harmonic branches when GPS-supervised evidence supports them.
- Continuity/prediction is part of candidate selection; old local RAW can be replayed through newer logic.
- Auto Gear Learn must never receive microphone authority while GPS MASTER + MIC LEARN is selected.
- Trainer may publish only validated improving models; reject bad/non-improving models and retain rollback history in `Motolab-data`.

## Research / RAW pipeline
- Third-gear GPS + MIC research uses GPS MASTER and a gear-confirm guard.
- Research storage stays separate from normal run/learning storage.
- RAW/research is local-first and retried after network loss/reopen.
- Multi-phone data is separated by persistent device identity/labels.
- Railway mirrors accepted RAW/research into private `anttivanttinen-max/Motolab-data`.
- Receiver/read secrets must never be committed to the public app repository.

## Vehicle / maintenance / UI decisions
- Finland vehicle database v2, Yamaha DT125R and Derbi Senda 50 families, editable drivetrain data, technical-spec editor and maintenance/history remain active.
- Home-screen microphone control stays directly reachable.
- Settings contains user-changeable configuration; LIVE contains deep technical state.
- Settings/maintenance sections should remain compact/collapsible.
- An unavailable selected audio input must not silently fall back to another microphone and be treated as the same sensor.
- Publication-facing product name is **VäNä MotorLab**; internal legacy MotoLab/AutoDyno identifiers may stay unchanged where renaming would risk RAW/API/storage/diagnostic compatibility.
- Current redesign direction is dark black/deep-red racing UI with translucent cards and a subtle workshop environment; normal screens should show only information that helps run measurement, result review or tuning decisions.
- **Throttle must be removed from the normal UI** because no throttle-position/TPS signal is currently available; do not show invented throttle data.
- Proposed normal navigation direction: **ETUSIVU / VEDOT / ANALYYSI / ASETUKSET / KÄYTTÄJÄ**, while deep technical sensor/RAW/diagnostic information remains separately reachable through LIVE/admin/developer tooling as implementation is reconciled with the existing navigation.
- Settings redesign rule: compact accordion sections, initially closed, with only one section open at a time.
- Floating bottom navigation must respect iPhone safe area and must not cover the last content/control on a page; full-screen graph views may hide it.
- Splash/branding may use the real repository DT image. The DT may be cleaned visually with lighting/contrast/crop/background treatment, but must remain recognizably the same real bike with no major geometry/component redesign. Do not substitute an AI-invented motorcycle for the actual DT asset.

## Approved visual mockup refinement — 2026-08-17
- The **workshop + white DT composition is now the accepted visual base** for the MotorLab redesign mockups. The motorcycle should read as naturally embedded in the garage scene rather than pasted over it.
- The accepted DT presentation is slightly more side-on than the earliest draft while retaining enough three-quarter angle to show the engine/expansion chamber and overall stance clearly.
- The loading/splash concept is approved in a **portrait smartphone proportion**, not as a landscape desktop composition.
- Splash hierarchy is intentionally simple: **VÄNÄ** and **MOTORLAB** branding occupy the free upper area, the DT/workshop remains the hero visual, and loading state/progress sits in the lower part of the phone screen.
- For this splash/loading view, avoid extra product-name clutter such as separate “Tester” branding; the visible top branding should remain VäNä + MotorLab.
- The mockup may include restrained red racing illumination and workshop depth, but the visual treatment must not imply that the current published v33.9 UI already contains this screen.
- These are **approved design-reference decisions only**. Implementation must preserve the existing measurement/sensor/identity/RAW invariants and should use the real DT asset or a faithful derived presentation rather than an invented replacement bike.

## Current build handoff and validation priorities
- Active `main`: **v33.9 / build `2026-08-17n-owner-gear-beta`**.
- Retained foundations include v32.7 diagnostics, v32.8 mic stability, v32.9 LIVE, v33.0 identity/cloud, v33.2 community/private diagnostics/run sharing, v33.3 private feedback chat, v33.4 Tester Merit, v33.5 Beta navigation, v33.6 MIC OFF authority, v33.7 unified MIC command queue and v33.8 admin audio-source tooling.
- Validate v33.9 on real iPhone: explicit MIC OFF stays OFF, MIC ON recovers genuinely ended tracks, rapid controls do not race, admin source switching reliably reopens the intended audio input, and the third-gear prompt appears for ordinary beta users only during active research.
- Validate third-gear behavior: 2-second 2nd/4th hold, 2/3/4 confirmation, OHITA, automatic close/return behavior, telemetry and IndexedDB marker persistence.
- Validate VäNä owner activation, single-use bootstrap, ordinary-update persistence and recovery behavior without creating an unintended admin path.
- Validate v33.4 Tester Merit end-to-end with real active/admin users, one-time review behavior, bonus merit, persistence and privacy.
- Validate v33.5 User/Beta navigation on phone, including all user/admin destinations and invite flow.
- Continue validation of identity lifecycle, multi-device cloud state, RAW/research user attribution, run sharing, Beta community/private diagnostics and v33.3 private conversations.
- Validate LIVE/diagnostics persistence and no measurement-performance regression.
- Validate adaptive candidate tracking, 500-rpm learning and Auto Gear Learn without weakening GPS MASTER.
- Before the next wider beta, implement/validate the locked FI/EN language system without disturbing measurement state.

## Deferred / unfinished work
- Automatic knock / ignition autotune remains intentionally parked.
- Full Knowledge Base integration across every porting/pipe/carb/ignition tuning calculator remains parked.
- FI/EN language work is no longer parked: its v1 specification is ready and included in the next release, but it is **not yet deployed**.
- Identity/cloud, run sharing, Beta community/private diagnostics, feedback conversations, Tester Merit, unified MIC control, v33.9 owner/recovery and gear-beta behavior remain newly published and need field validation before being treated as fully proven.
- The UI/branding redesign is an accepted direction/implementation plan, not yet a claim that the current published app already matches the new mockups.
- The approved workshop/DT portrait splash remains a **design reference still to be implemented and validated on real phone layouts**; safe-area behavior, readability and asset fidelity must be checked during implementation.

## Project-wide durable-memory instruction
Archive at minimum: accepted decisions/constraints, measured test/reference results, algorithm changes and reasons, regressions/fixes, build identity, unresolved/deferred work, RAW interpretations, deployment/sync changes and cross-thread handoff notes. Full chat transcripts are not automatically available through the GitHub connector; structured project-relevant memory remains the durable source of truth.