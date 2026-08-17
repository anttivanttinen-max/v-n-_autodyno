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
- Release line began as **v33.0 / build `2026-08-17e-user-identity`** and remains the identity foundation under later v33.x builds.
- `user_identity.js` / `motolab-user-identity-v1` creates/preserves a device identity, uses the existing beta token/server configuration and resolves a server-side user record.
- `raw_sync_server/user_server.js` adds persistent user registry, invitation records and per-user cloud-state storage.
- User states are `pending`, `active` and `blocked`; admin users can approve or block users. An admin cannot be blocked through the normal admin status endpoint.
- New devices can register via invitation. Dynamic invitation values are stored hashed, one-use and expire after seven days.
- Pending users see an approval lock screen and can set a nickname; active users get account UI and can create invite links.
- Device tokens are HMAC-signed using `BETA_TOKEN_SECRET`; default lifetime is 365 days unless configured otherwise.
- RAW/research requests carrying beta identity are tied to an active resolved user/device identity.
- Per-user cloud state uses `/api/users/v1/state`; selected profiles/runs/learning/sync/consent/dev state is synchronized. Existing remote state is preferred on initial sync when present; otherwise local state is uploaded. Change checks occur about every 6 seconds after activation.

## v33.1 in-app user feedback — retained foundation
- v33.1 release identity was **`2026-08-17f-user-feedback`**.
- `raw_sync_server/feedback_server.js` introduced authenticated feedback APIs and persistent feedback storage.
- Active users could submit problem/update/development/other feedback with user/nickname/device, app version, page and workflow status.
- `feedback.js` / `motolab-feedback-v1` added **PALAUTE** for users and **PALAUTTEET** for admin review.
- v33.1 is superseded by v33.2/v33.3 but remains the base of the current private-feedback system.

## v33.2 Beta community / private diagnostics / user rollout — retained under v33.3
- v33.2 release build: **`2026-08-17g-beta-community`**.
- The rollout combined the v33.0 identity/approval layer with per-user feature permissions and client version/build heartbeat.
- Nickname-based run sharing is graphical/reduced only: recipients do not receive RAW data or edit rights.
- Shared runs can be compared to a selected own run with run-quality/success percentage, and to the best comparable own run automatically.
- New Beta community/issue bank supports user comments, peer troubleshooting, `Minulla sama ongelma`, issue states `open`, `working`, `resolved`, `fixed`, `not reproduced`, and admin-selected working solutions.
- Invite flow includes normal share plus WhatsApp action. Users may optionally provide a private contact route such as WhatsApp, phone, email, Telegram or other.
- Public community data is deliberately reduced to nickname/title/description/category/status/comments/same-problem count. Device IDs, contact details, app/device metadata, sensor state, diagnostics and technical history are private/admin-only.
- Issue creation and `Minulla sama ongelma` attach a private diagnostic package containing release/build, platform metadata, sensor/queue snapshots, recent diagnostic events and roughly 60 seconds of rolling technical history.
- The diagnostic package is not intended to capture listenable microphone audio; it contains technical sensor/app state for reproduction.
- `BETA_COMMUNITY_V33_2.md` records the release and privacy rules.
- PR #15 and the associated v33.2 community/Railway preload rollout were merged with explicit user approval. Railway success still needs field confirmation before server rollout is considered validated.
- The community/user layer must not change GPS MASTER authority, RPM calculation, run acceptance, Auto Gear Learn or dyno computation.

## v33.3 two-way private feedback conversations — current active release
- Current `main` release identity: **v33.3 / build `2026-08-17h-private-feedback-chat`**.
- `feedback.js` advanced to `motolab-feedback-v2` and the feedback server storage/API migrated toward `motolab_feedback_v2` conversation semantics.
- A user can now see their own private feedback threads, open a new private feedback conversation and reply to the admin inside the same thread.
- Admin can reply to the user in the same thread. Thread states now include `waiting_admin`, `waiting_user`, `working` and `resolved` in addition to migration handling for older statuses.
- Private thread messages preserve role (`user` / `admin`) and timestamps. User-facing APIs only return that user's own threads; admin list returns the administrative metadata needed for handling.
- Admin can publish a private feedback item into the Beta community as an **anonymous** public issue. The published community issue omits the user's identity and links internally back to the source feedback for administration.
- Once anonymized to the community, the user is told that the issue was published without exposing their nickname/private conversation to other users.
- The feedback server can write the anonymized issue to the community issue store while preserving the private original thread separately.
- Service Worker/release bundling was aligned to v33.3 so the private feedback chat is included in the published PWA.
- v33.3 supersedes v33.2 only as release/build identity; v33.2 community/private diagnostics and earlier identity/cloud foundations remain active.

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
- Active `main`: **v33.3 / build `2026-08-17h-private-feedback-chat`**.
- v32.8 microphone stability, v32.7 persistent diagnostics, v32.9 LIVE telemetry, v33.0 identity/cloud, v33.2 Beta community/private diagnostics and v33.3 private feedback chat are all retained.
- Validate v32.8 mic behavior on real iPhone: continuous live track must not cycle; genuine ended/disconnected track must recover.
- Validate v32.9 LIVE navigation/status/queue/event visibility without measurement-performance regression.
- Validate diagnostics persistence across abrupt termination and RAW replay.
- Validate identity lifecycle end-to-end: invite → pending nickname → admin approval → active login, blocked-state behavior, token persistence and per-user cloud-state restore/sync.
- Validate RAW/research attribution to active user/device identity and rejection for non-active users.
- Validate v33.2 community end-to-end: issue creation, comments, same-problem, public/private data separation, diagnostic package capture, admin-only diagnostic access and Railway persistence/restart behavior.
- Validate run sharing permissions and reduced graphical-only payload, selected-own comparison and automatic best-own comparison.
- Validate v33.3 private conversations end-to-end: user thread list/new message/reply, admin reply, state transitions, old v33.1 feedback migration, anonymous community publication and strict privacy separation.
- Validate adaptive candidate tracking against GPS, 500-rpm region learning and Auto Gear Learn interaction without weakening GPS MASTER.

## Deferred / unfinished work
- Automatic knock / ignition autotune remains intentionally parked.
- Full Knowledge Base integration across every porting/pipe/carb/ignition tuning calculator remains parked.
- FI/EN language-system work exists only on a separate unpromoted development branch and is not active until explicitly resumed.
- User identity/cloud, run sharing, Beta community/private diagnostics and two-way feedback are newly published and require real multi-user/device/server field validation before being treated as fully proven.

## Project-wide durable-memory instruction
Archive at minimum: accepted decisions/constraints, measured test/reference results, algorithm changes and reasons, regressions/fixes, build identity, unresolved/deferred work, RAW interpretations, deployment/sync changes and cross-thread handoff notes. Full chat transcripts are not automatically available through the GitHub connector; structured project-relevant memory remains the durable source of truth.
