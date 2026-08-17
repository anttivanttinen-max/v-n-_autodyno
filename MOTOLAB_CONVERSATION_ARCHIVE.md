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
- Harmonic jumping motivated retention of multiple candidates and continuity tracking.
- Preferred historical contact mounting: extension nut + aluminium shim + tightly coupled BT earbud/contact microphone.
- Strong contact reference: about 6600 rpm truth, 6591 rpm audio average, ~92.2% confidence, f0 ~109–112 Hz and harmonics around 220/330/440/550/660 Hz.

## iOS microphone recovery history
- RAW from the earlier 32.5 session showed persisted wanted state `gps=true, imu=true, mic=true` while repeated checks reported mic inactive and recovery failures with `track_not_live`; GPS and IMU stayed active.
- v32.6 added full fresh-stream recovery through existing `stopAudio()` + `startAudio()`, bounded retries (~0.5 s → 1 s → 2 s → 5 s), recovery telemetry and the visible **MIC RECOVERY • PALAUTA MIKROFONI** user-gesture action.
- Field testing then found a repeated OFF/ON reconnect storm. Root cause was use of `globalThis.MOTOLAB_AUDIO_LAST?.t` as a destructive frame-stale trigger without a reliable producer-backed timestamp.
- v32.8 / build `2026-08-17c-mic-stability` corrected this in `sensor-persistence-v5`: `audio_frames_stale` no longer causes destructive reconnect; a live enabled track on an active stream is authoritative. Genuine non-live/ended tracks still use recovery with existing backoff/manual recovery.
- Real-device validation remains required to prove both: no false OFF/ON storm and genuine ended-track recovery still works. Details: `MIC_STABILITY_V32_8.md`.

## v32.7 persistent diagnostics
- User decision: MotoLab needs always-on comprehensive diagnostics, not only microphone logging.
- `diagnostics.js` / `motolab-diagnostics-v1` records global JS errors, unhandled rejections, console warnings/errors, failed fetch/non-OK HTTP, network/visibility/page lifecycle, media-device changes and selected Service Worker events.
- Central `addLearningEvent` traffic is mirrored without changing the original event call.
- Diagnostic records carry release/build identity, session id and sensor snapshots where available.
- A persistent 500-event local ring plus heartbeat/session marker survives restarts/crashes.
- iOS `pagehide` is not proof of clean shutdown.
- Known queue states and other localStorage keys containing `queue` are summarized without copying secrets/arbitrary payloads.
- Pending diagnostics are replayed into RAW as `diagnostic_replay` once the normal learning/event path is available.
- Diagnostics is observational only and must never influence GPS MASTER, displayed RPM, run acceptance, gear learning, adaptive candidate choice, dyno calculations or recovery decisions.
- Details: `MOTOLAB_DIAGNOSTICS.md`.

## v32.9 LIVE technical inspection — active and retained
- User decision: deep operating state should not crowd the normal measurement/home view or Settings.
- Normal visible navigation is effectively **MITTAUS / VEDOT / LIVE / ANALYYSI / ASETUKSET**; developer-only AUTOTUNE remains behind developer mode.
- `live_status.js` / `motolab-live-status-v1` adds the dedicated LIVE page; `live_status_guard.js` keeps it compatible with the legacy self-test/navigation assumptions.
- LIVE summary shows traffic-light state for **GPS / MIC / IMU / RAW / SYNC**.
- Expandable cards cover GPS, MIC/RPM, IMU, GEAR, DYNO/RUN, RAW/SYNC/EVENT QUEUES, DIAGNOSTICS/EVENT LOG and SYSTEM.
- MIC/RPM includes wanted state, track live/ended/enabled/muted/device, audio/raw RPM, confidence, f0, candidate gap and runner-up when available.
- LIVE refreshes only while active, roughly every 750 ms.
- LIVE is strictly observational; it must not control sensors, measurement authority, adaptive learning, recovery or sync decisions.
- Details: `LIVE_STATUS_V32_9.md`.

## v33.0 user identity / approval / cloud state — active foundation
- New release line: **v33.0 / build `2026-08-17e-user-identity`** before the subsequent v33.1 feedback release.
- New client module `user_identity.js` / `motolab-user-identity-v1` creates/preserves a device identity, uses the existing beta token/server configuration and resolves a server-side user record.
- Server-side `raw_sync_server/user_server.js` adds a persistent user registry, invitation records and per-user cloud-state storage.
- User states are `pending`, `active` and `blocked`; admin users can approve or block users. An admin cannot be blocked through the normal admin status endpoint.
- New devices can register via invitation. Invitations are stored as hashes, are one-use where dynamically generated, and dynamic invites expire after seven days.
- Pending users see an approval lock screen and can set a nickname; active users get an account pill/panel.
- Active users can create invitation links. Admin users can view users and approval state from the app UI.
- Device tokens are HMAC-signed using `BETA_TOKEN_SECRET`; default lifetime is 365 days unless configured otherwise.
- RAW/research server requests carrying a beta token are now tied to an active resolved user/device identity before continuing.
- Per-user cloud state uses `/api/users/v1/state`; selected local state keys (profiles, runs, RAW fallback/learning preference, RAW sync config, consent/dev state) are synchronized. Existing remote state is preferred on initial sync when present; otherwise current local state is uploaded.
- Automatic state upload checks for changes about every 6 seconds after an active user is established.
- The identity layer must not change GPS MASTER, RPM measurement, run acceptance, gear learning or dyno calculations.

## v33.1 in-app user feedback — current active release
- Current release identity on `main`: **v33.1 / build `2026-08-17f-user-feedback`**.
- New `raw_sync_server/feedback_server.js` provides authenticated feedback APIs backed by `data/users/feedback.json`.
- Active users can submit feedback through `/api/feedback/v1/comment`; supported categories are `problem`, `update`, `development` and `other`.
- Each feedback item stores a generated feedback ID, resolved user/nickname/device, category, message, app version, current page, timestamp and workflow status.
- Feedback status workflow supports `new`, `reviewing`, `done` and `archived`, plus an admin note field.
- Admin endpoints list feedback and update feedback status; admin identity is required.
- New `feedback.js` / `motolab-feedback-v1` adds an in-app **PALAUTE** action and modal for users to send problems, update ideas, development suggestions or other comments directly to MotoLab administration.
- Admin users also receive **PALAUTTEET** UI to review incoming feedback and mark items `KÄSITTELYYN` / `VALMIS`.
- App shell/server wiring and Service Worker were updated so identity and feedback modules are loaded in the published PWA.
- v33.1 supersedes v33.0 only as release identity; the v33.0 user-identity/approval/cloud-state foundation remains active underneath it.

## Adaptive GPS-taught RPM learning
- `rpm-learning-model.json` uses schema `motolab_rpm_learning_model_v1`; baseline has no learned bands and explicit acceptance limits.
- Adaptive GPS-taught RPM learning and RAW replay were added on 2026-08-16 (`58c1feb`, `fd6cfe4`, `fe66331`).
- Learning works in 500-rpm regions and may prefer 0.5x / 1x / 2x harmonic branches when GPS-supervised evidence supports them.
- Continuity/prediction is part of candidate selection; old local RAW can be replayed through newer logic.
- Auto Gear Learn must never receive microphone authority while GPS MASTER + MIC LEARN is selected.
- Trainer may publish only validated improving models; reject bad/non-improving models and retain rollback history in `Motolab-data`.

## Research / RAW pipeline
- Third-gear GPS + MIC research uses GPS MASTER and a third-gear guard/confirmation flow; raw research capture pauses when the required gear condition is not confirmed.
- Research data is kept separate from normal run/learning storage.
- RAW/research is local-first; retained locally and retried after network loss/reopen.
- Multi-phone data is separated by persistent device identity/labels.
- Railway receiver mirrors received RAW/research into private `anttivanttinen-max/Motolab-data`.
- Receiver/read secrets must never be committed to the public app repository.

## Vehicle / maintenance / UI decisions
- Finland vehicle database v2 is installed; Yamaha DT125R and Derbi Senda 50 families and editable drivetrain data are retained.
- Technical-spec editor and maintenance/history modules remain active.
- Home-screen microphone control stays directly reachable.
- Settings contains user-changeable configuration; LIVE contains deep technical sensor/queue/diagnostic state.
- Settings/maintenance sections should remain compact/collapsible.
- A selected unavailable audio input must not silently fall back to a different microphone and be treated as the same sensor.

## Current build handoff and validation priorities
- Active `main`: **v33.1 / build `2026-08-17f-user-feedback`**.
- v32.8 microphone stability, v32.7 persistent diagnostics and v32.9 LIVE telemetry are all retained under the newer identity/feedback layer.
- Validate v32.8 mic behavior on real iPhone: continuous live track must not cycle; genuine ended/disconnected track must recover.
- Validate v32.9 LIVE navigation/status/queue/event visibility without measurement-performance regression.
- Validate diagnostics persistence across abrupt termination and RAW replay.
- Validate v33.0 identity lifecycle end-to-end: invite → pending nickname → admin approval → active login, blocked-state behavior, token persistence and per-user cloud-state restore/sync.
- Validate that RAW/research uploads from authenticated devices are correctly associated with active user/device identity and rejected for non-active users.
- Validate v33.1 feedback end-to-end: normal user submission, user/version/device attribution, admin list, status changes and persistence across server restart.
- Validate adaptive candidate tracking against GPS, 500-rpm region learning and Auto Gear Learn interaction without weakening GPS MASTER.

## Deferred / unfinished work
- Automatic knock / ignition autotune remains intentionally parked.
- Full Knowledge Base integration across every porting/pipe/carb/ignition tuning calculator remains parked.
- FI/EN language-system work exists only on a separate unpromoted development branch and is not active until explicitly resumed.
- User identity/cloud state and in-app feedback are newly published and require real multi-user/device field validation before being treated as fully proven.

## Project-wide durable-memory instruction
Archive at minimum: accepted decisions/constraints, measured test/reference results, algorithm changes and reasons, regressions/fixes, build identity, unresolved/deferred work, RAW interpretations, deployment/sync changes and cross-thread handoff notes. Full chat transcripts are not automatically available through the GitHub connector; structured project-relevant memory remains the durable source of truth.