# VÄNÄ MotoLab — shared development sync status

Updated: 2026-08-17

## Current application line
- Active published line on `main`: **v33.6 / build `2026-08-17k-mic-off-authority`**.
- v32.7 introduced persistent diagnostics; v32.8 corrected the false microphone stale reconnect storm; v32.9 added LIVE technical inspection; v33.0 added user identity/approval/cloud state; v33.1 introduced feedback; v33.2 added Beta community/private diagnostics/run sharing; v33.3 added private feedback conversations; v33.4 added Tester Merit; v33.5 added visible User/Beta navigation; v33.6 enforces explicit user MIC OFF authority.
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
- Identity, feedback, run-sharing, community, Tester Merit, Beta navigation, LIVE and diagnostics layers are non-measurement layers and must not change RPM authority, gear-learning authority, run acceptance or dyno calculations.

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

## v33.6 MIC OFF authority — active on main
- Current release: **v33.6 / build `2026-08-17k-mic-off-authority`**.
- `mic_authority.js` / `motolab-mic-authority-v1` makes explicit user MIC OFF state authoritative.
- MIC OFF writes `motolab_v32_sensor_prefs.mic=false` as early as pointer/touch/click capture and records user-authority telemetry.
- Wrapped `startAudio()` refuses to open the microphone while desired state is OFF and logs `mic_start_blocked_user_off`.
- If a live stream exists while desired state is OFF, existing `stopAudio()` is used and `mic_forced_stop_user_off` is logged.
- The guard rechecks periodically and on visibility return, preventing autostart/recovery code from silently reopening a microphone the user disabled.
- This complements rather than replaces v32.8 recovery: explicit OFF must stay OFF; explicit ON may still recover genuinely ended tracks.

## ARM AUTO / pull comparison
- ARM AUTO remains persistent across multiple pulls; each detected pull saves separately, cooldown/reset hysteresis re-arms automatically, STOP explicitly disarms.
- Development comparisons should primarily use the previous MotoLab pull as the 100% reference; PerfExpert can use the same reference.
- Compare peak power, peak torque and useful-range/curve performance, not only one peak point.

## Current validation priorities
- Validate v33.6 on real iPhone: explicit MIC OFF stays OFF across autostart/recovery/visibility transitions, while MIC ON still recovers genuinely ended/disconnected tracks.
- Validate v33.4 Tester Merit with real active/admin users: scoring, one-review rule, bonus merit, persistence, privacy and no accidental permission escalation.
- Validate v33.5 User/Beta navigation on phone: all user/admin destinations and invite sharing.
- Continue validation of identity lifecycle, blocked state, token persistence, multi-device cloud-state restore/sync and RAW/research attribution.
- Validate run sharing, Beta community/private diagnostics, Railway persistence/restart and v33.3 private chat/anonymized publishing.
- Validate LIVE/diagnostics persistence and no measurement-performance regression.
- Validate adaptive candidate tracking, 500-rpm band learning and Auto Gear Learn interaction without weakening GPS MASTER.

## Deferred work
- Automatic knock / ignition autotune remains intentionally parked.
- Full Knowledge Base integration across every porting/pipe/carb/ignition tuning calculator remains parked.
- FI/EN language-system work exists only on a separate unpromoted development branch and is not active until explicitly resumed.
- Identity/cloud, run sharing, Beta community/private diagnostics, private feedback, Tester Merit and MIC OFF authority require real multi-user/device/server field validation before being treated as fully proven.

## Durable project-memory rule
- GitHub is the durable MotoLab project memory.
- Archive important decisions, tests, RAW interpretations, build changes, regressions/fixes and unfinished work in `MOTOLAB_CONVERSATION_ARCHIVE.md` and, when they change active handoff, here.
- The recurring archive job updates documentation only; it must not alter application code or create empty commits.
- Before implementation, check current `main`, this status, archive and relevant technical notes.

## Regression rule
Before merging measurement changes, preserve GPS, GPS MASTER + MIC LEARN, GPS ONLY, explicit phone-mic modes, continuous ARM AUTO, AutoRide, manual run recording, run persistence, profiles, Knowledge Base, learning/raw data and RAW JSON export/replay, full-trip research capture, automatic research/RAW sync, vehicle lookup, maintenance, compact Settings UI, DT startup profile, release identity/PWA behavior, persistent diagnostics, v32.8 microphone stability, LIVE technical inspection, v33.x identity/cloud/run-sharing/community/private-feedback/Tester-Merit/Beta-menu layers, v33.6 explicit MIC OFF authority, and keep native AirPods motion experimental until validated on a real device.