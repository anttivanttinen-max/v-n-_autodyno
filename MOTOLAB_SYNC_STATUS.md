# VÄNÄ MotoLab — shared development sync status

Updated: 2026-08-17

## Current application line
- Active published line on `main`: **v33.1 / build `2026-08-17f-user-feedback`**.
- v32.7 introduced full persistent diagnostics; v32.8 corrected the false microphone stale reconnect storm; v32.9 added the dedicated LIVE technical inspection page; v33.0 added user identity/approval/cloud state; v33.1 added in-app user feedback.
- `version.js` is the release-identity source and the Service Worker/app shell must remain aligned with it.
- v31 remains the historical core baseline; newer modules layer onto the published PWA shell.
- Yamaha DT125R Athena 170 remains the startup-bike line used by the current development flow.
- Current temporary GPS power calibration in `dyno_curve_v2.js` remains **1.07** (`v32-dyno-curve-2.2`); earlier 1.85 experiment is superseded.

## Measurement strategy and safety
- Road-test / learning work uses **GPS MASTER + MIC LEARN** unless an explicit test mode says otherwise.
- GPS/speed + selected gear remains the control RPM authority.
- Phone microphone RPM remains shadow/learning data in GPS MASTER and must not alter displayed RPM, run acceptance or gear learning.
- GPS reference RPM may come from saved gear calibration or calculated drivetrain data.
- Camera RPM remains disabled.
- Preserve raw/top-candidate/harmonic information for replay and later trainer evaluation.
- User identity, feedback, LIVE and diagnostics layers are non-measurement layers and must not change RPM authority, gear-learning authority, run acceptance or dyno calculations.

## Phone microphone / RPM basis
- Standalone Phone RPM Tester v3.6 reference: 34.642 s / 1040 frames / displayed 1620–9890 rpm; all frames captured with chunked IndexedDB storage.
- Practical target accuracy remains roughly ±200 rpm, with temporary ±300 rpm tolerable; continuity and rejection of x2/÷2 harmonic jumps matter more than exact single-frame equality.
- `phone_rpm_smart.js` / `phone-rpm-smart-v1` evaluates H1–H6 and simultaneous 0.5x / 1x / 2x hypotheses using spectral strength, continuity, prediction, candidate gap and soft GPS reference.
- Historical v32.4 RAW/contact baseline remains valid reference material, including the ~6600 rpm truth / 6591 rpm audio / 92.2% confidence contact result.

## Adaptive GPS-taught RPM learning
- `rpm-learning-model.json` uses schema `motolab_rpm_learning_model_v1`; checked-in baseline still starts with no learned bands.
- Learning is organized around 500-rpm regions and may prefer 0.5x / 1x / 2x branches when GPS-supervised evidence supports them.
- Candidate continuity/prediction remains part of selection.
- Existing local RAW history can be replayed through newer logic.
- Auto Gear Learn must not receive microphone authority in GPS MASTER + MIC LEARN.
- Trainer may publish only validated improving models; reject bad/non-improving models and retain rollback history in `Motolab-data`.

## Research / RAW sync
- Third-gear GPS + MIC research uses GPS MASTER and a gear-confirm guard; microphone/raw research capture pauses when the required gear is not confirmed.
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

## v32.8 microphone stability correction — retained
- `sensor_persistence.js` is `sensor-persistence-v5`.
- Root cause of the earlier OFF/ON reconnect storm was use of `globalThis.MOTOLAB_AUDIO_LAST?.t` as a destructive frame-stale trigger without a reliable producer-backed timestamp.
- `audio_frames_stale` no longer causes destructive reconnect; a live enabled track on an active stream is authoritative.
- Fresh-stream teardown/recreation remains for genuinely non-live/ended tracks with existing backoff and manual recovery.
- Real-device validation remains required: live mic must stay continuously ON while a genuinely ended/disconnected track must still recover.
- Details: `MIC_STABILITY_V32_8.md`.

## v32.7 persistent diagnostics — retained
- `diagnostics.js` / `motolab-diagnostics-v1` is always-on and observational.
- It records global JS errors, unhandled rejections, console warnings/errors, failed fetch/non-OK HTTP, network/visibility/page lifecycle, media-device changes and selected Service Worker events.
- A 500-event persistent local ring, session marker and heartbeat survive app restarts/crashes.
- Known queue states plus other `queue` localStorage keys are summarized without copying secrets/arbitrary payloads.
- Pending diagnostics replay into normal RAW/learning stream as `diagnostic_replay` when available.
- Diagnostics must never gain measurement or recovery authority.
- Details: `MOTOLAB_DIAGNOSTICS.md`.

## v32.9 LIVE technical status page — retained
- `live_status.js` / `motolab-live-status-v1` adds the dedicated **LIVE** bottom-navigation page; `live_status_guard.js` preserves compatibility with legacy self-test/navigation behavior.
- LIVE summary: GPS / MIC / IMU / RAW / SYNC traffic-light states.
- Expandable cards: GPS, MIC/RPM, IMU, GEAR, DYNO/RUN, RAW/SYNC/QUEUES, DIAGNOSTICS/EVENT LOG and SYSTEM.
- LIVE reads runtime state only and refreshes only while active, about every 750 ms.
- LIVE must not alter sensors, GPS MASTER, RPM, run acceptance, gear learning, recovery, adaptive learning or sync decisions.
- Details: `LIVE_STATUS_V32_9.md`.

## v33.0 user identity / approval / cloud state — active foundation
- v33.0 release identity was `2026-08-17e-user-identity`; v33.1 supersedes it only as the visible release number, not functionally.
- `user_identity.js` / `motolab-user-identity-v1` creates/preserves device identity and resolves a server-side user record through the existing beta server/token path.
- `raw_sync_server/user_server.js` adds persistent user registry, invites and per-user cloud-state storage.
- User status values: `pending`, `active`, `blocked`.
- Pending users see an approval lock screen and can set nickname; active users receive account UI.
- Active users can create invitation links; admin users can list users and approve/block accounts.
- Dynamic invites are one-use and expire after seven days; invitation values are stored hashed server-side.
- Device tokens are HMAC-signed using `BETA_TOKEN_SECRET`; default lifetime 365 days unless configured otherwise.
- RAW/research requests carrying beta identity are tied to an active resolved user/device identity.
- Per-user cloud state uses `/api/users/v1/state`; selected profiles/runs/learning/sync/consent/dev state is synchronized. Existing remote state is preferred on initial sync when present, otherwise local state is uploaded. Change checks occur about every 6 seconds after activation.

## v33.1 in-app user feedback — active on main
- Current release: **v33.1 / build `2026-08-17f-user-feedback`**.
- `raw_sync_server/feedback_server.js` adds authenticated feedback storage/API using `data/users/feedback.json`.
- Active users can submit `problem`, `update`, `development` or `other` feedback through `/api/feedback/v1/comment`.
- Feedback items retain user/nickname/device attribution, category, message, app version, page, creation time and workflow status.
- Workflow statuses: `new`, `reviewing`, `done`, `archived`; admin notes are supported.
- Admin endpoints list feedback and update status.
- `feedback.js` / `motolab-feedback-v1` adds in-app **PALAUTE** UI for users and **PALAUTTEET** admin review UI.
- App shell/server wiring and Service Worker include the identity and feedback modules in the published PWA.

## ARM AUTO / pull comparison
- ARM AUTO remains persistent across multiple pulls; each detected pull saves separately, cooldown/reset hysteresis re-arms automatically, STOP explicitly disarms.
- Development comparisons should primarily use the previous MotoLab pull as the 100% reference; PerfExpert can be compared against the same reference.
- Compare peak power, peak torque and useful-range/curve performance, not only one peak point.

## Current validation priorities
- Real-device validate v32.8 mic stability: no false OFF/ON cycle and genuine ended-track recovery still works.
- Real-device validate v32.9 LIVE navigation, traffic lights, queue/error details and no measurement-performance regression.
- Validate v32.7 diagnostics persistence across abrupt termination and RAW replay.
- Validate v33.0 identity end-to-end: invite → pending nickname → admin approval → active, blocked state, token persistence, multi-device behavior and cloud-state restore/sync.
- Confirm RAW/research uploads are correctly associated with active user/device identity and rejected for non-active users.
- Validate v33.1 feedback end-to-end: submission, attribution/version capture, admin list/status workflow and server-restart persistence.
- Validate adaptive candidate tracking against GPS, 500-rpm band learning and Auto Gear Learn interaction without weakening GPS MASTER.

## Deferred work
- Automatic knock / ignition autotune remains intentionally parked.
- Full Knowledge Base integration across every porting/pipe/carb/ignition tuning calculator remains parked.
- FI/EN language-system work exists only on a separate unpromoted development branch and is not active until explicitly resumed.
- User identity/cloud sync and in-app feedback are newly published and still require real multi-user/device field validation.

## Durable project-memory rule
- GitHub is the durable MotoLab project memory.
- Archive important decisions, tests, RAW interpretations, build changes, regressions/fixes and unfinished work in `MOTOLAB_CONVERSATION_ARCHIVE.md` and, when they change active handoff, here.
- The recurring archive job updates documentation only; it must not alter application code or create empty commits.
- Before implementation, check current `main`, this status, archive and relevant technical notes.

## Regression rule
Before merging measurement changes, preserve GPS, GPS MASTER + MIC LEARN, GPS ONLY, explicit phone-mic modes, continuous ARM AUTO, AutoRide, manual run recording, run persistence, profiles, Knowledge Base, learning/raw data and RAW JSON export/replay, full-trip research capture, automatic research/RAW sync, vehicle lookup, maintenance, compact Settings UI, DT startup profile, release identity/PWA behavior, persistent diagnostics, v32.8 microphone stability, LIVE technical inspection, v33.x identity/cloud/feedback layers, and keep native AirPods motion experimental until validated on a real device.