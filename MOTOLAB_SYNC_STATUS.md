# VÄNÄ MotoLab — shared development sync status

Updated: 2026-08-17

## Current application line
- Active published line on `main`: **v32.9.1 FIELD / build `2026-08-17u-field-recovery`**.
- Field-recovery release identity was created without changing measurement logic, then the Service Worker was changed to force a clean field-recovery cache and clear older MotoLab/MotorLab caches on activation.
- `main` contains documentation-only memory commits above the application line; do not infer a newer published application build from those archive commits.
- v32.9 remains the LIVE telemetry base beneath the field-recovery identity; v32.8 microphone-stability correction and v32.7 persistent diagnostics are preserved.
- `version.js` is the release-identity source and the Service Worker/app shell must stay aligned with it.
- v31 remains the historical core baseline; v32.x modules are integrated into the published PWA shell.
- Yamaha DT125R Athena 170 remains the startup-bike line used by the current development flow.
- Current temporary GPS power calibration in `dyno_curve_v2.js` remains **1.07** (`v32-dyno-curve-2.2`); the earlier 1.85 experiment is superseded.

## Separate v34 line — do not confuse with main
- v34 remains separate and is **not** the currently published `main` field line.
- Older release branch `release/v34.0-2026-08-17` remains at `58d270274b979847fd760f7681818d9e7034b2ec` / v34.0 build `2026-08-17o-rebuild-ui-i18n`.
- Current inspected rebuild work is newer: **`dev/v34-rebuild` at `ae6f10036be8152f14ddef1b5afe1c8d1c2229d0`**. Its app identity remains **v34.6 DEV / build `2026-08-17w-v34-rebuild-swfix`**; the two newer commits adjust user-submenu layering and its browser regression test rather than changing release identity.
- User decision: the completed v34 visual appearance is finished and **locked as the approved visual baseline**. Functional work should preserve that appearance unless UI design is explicitly reopened.
- v34 has not been promoted/installed by the memory job; explicit promotion approval and remaining real-device validation are still required.

## v34.6 DEV validation / Service Worker fix
- Chromium + Service Worker browser smoke testing is part of the v34 rebuild validation flow.
- The smoke test found a real reload-only runtime bug: Service Worker HTML injection regex-rewrote inline `navigator.serviceWorker.register(...)` and truncated JavaScript at the inner `encodeURIComponent(build)` parenthesis, preventing navigation handlers from initializing after SW reload.
- Commit `f203b3e` fixes this by stopping regex rewriting of inline JavaScript and bumps the dev build/cache identity to `2026-08-17w-v34-rebuild-swfix`.
- GitHub Actions run `32044453957` is green. It passed app/server JS syntax, static rebuild validation x3, identity/server integration x3, measurement invariant markers, and **Browser + Service Worker smoke x2** for that validated point.
- Browser/SW runtime validation is therefore green at `f203b3e`. This does not replace real iPhone GPS/microphone testing.

## v34 user-submenu overlap correction
- A phone UI report identified the **KÄYTTÄJÄ submenu overlapping the notification/status area**.
- Commit `cd244ecad4902229d0c4d17a3460e3ab2e1e7d5e` changes `beta_menu.js` to `motolab-beta-menu-v4`, adds safe-area-aware top clearance, bounds menu height with `100dvh`, and keeps toast/status layering above the menu without redesigning the approved UI.
- Commit `ae6f10036be8152f14ddef1b5afe1c8d1c2229d0` extends the 390×844 browser smoke test and explicitly fails if the submenu top is inside the notification/status clearance (`menuBox.y < 88`).
- No combined CI status is published for `ae6f100`; therefore preserve the earlier green `f203b3e` validation record and treat the newer overlap fix as code/test-complete but still needing an actual-phone confirmation or later green CI run.
- The separate v34 login/Railway auth-origin issue remains unresolved by these submenu commits.

## Measurement strategy
- Road-test / learning work uses **GPS MASTER + MIC LEARN** unless a specific explicit test mode says otherwise.
- GPS/speed + selected gear remains the control RPM authority.
- Phone microphone RPM remains a shadow/learning sensor in GPS MASTER and must not alter displayed RPM, run acceptance or gear learning.
- GPS reference RPM may come from saved gear calibration or calculated drivetrain data.
- Camera RPM remains disabled.
- Historical BT/contact microphone data is retained as reference material even though the active development line focuses on the phone microphone.
- v32.4/build 2026-08-16h remains the earlier RAW baseline for BT/contact microphone/harmonic comparisons.

## Phone microphone RPM basis
- Standalone Phone RPM Tester v3.6 produced a complete long sweep suitable for full-range development: **34.642 s / 1040 frames / displayed 1620–9890 rpm**.
- All 1040 frames were captured with chunked IndexedDB storage.
- Practical target accuracy is roughly **±200 rpm**, with temporary ±300 rpm tolerable; continuity and rejection of x2 / ÷2 harmonic jumps matter more than exact single-frame equality.
- No single-frame ≥1000 rpm jumps were found in the displayed v3.6 track.
- Raw/harmonic data repeatedly contains usable RPM information even when the strongest spectral candidate is not the final correct branch.
- Preserve complete candidate/harmonic information; do not discard frames only because confidence is low.

## Smart phone RPM sensor
- Active smart-phone sensor module: `phone_rpm_smart.js` / `phone-rpm-smart-v1`.
- It evaluates H1–H6 harmonic structure and simultaneous **0.5x / 1x / 2x RPM hypotheses**.
- Candidate selection uses spectral strength, harmonic count, previous RPM, predicted RPM/velocity, temporal continuity, candidate gap and a soft GPS reference when available.
- Large implausible branch jumps require confirmation; the tracker may hold/follow the predicted branch instead of accepting a one-frame harmonic jump.
- Rich phone telemetry is stored in learning rows, including smart/raw/corrected/predicted RPM, chosen ratio, confidence, gap, runner-up, f0, RMS, harmonic data, top candidates and GPS assist.

## Adaptive GPS-taught RPM learning
- `rpm-learning-model.json` exists in the app repository using schema `motolab_rpm_learning_model_v1`.
- The checked-in baseline model currently contains no learned bands; it defines acceptance limits for later validated models.
- Adaptive GPS-taught RPM learning and local RAW replay were added in commits `58c1feb`, `fd6cfe4` and `fe66331`.
- Learning is designed around **500 rpm regions**, where GPS-supervised evidence may prefer 0.5x / 1x / 2x harmonic branches.
- Candidate continuity/prediction is part of the selection logic.
- Existing local RAW history can be replayed through newer learning logic instead of requiring only new road data after every algorithm change.
- Auto Gear Learn remains present, but GPS MASTER + MIC LEARN must not let microphone shadow RPM gain gear-learning authority.
- The overnight trainer may publish a replacement model only after validation; bad/non-improving models must be rejected and rollback history kept in `Motolab-data`.

## Full-trip 3rd-gear GPS + MIC research
- `trip_research.js` provides the **3. VAIHTEEN GPS + MIC TUTKIMUSAJO** flow.
- The research path uses GPS MASTER and third gear as the reference structure.
- Phone RAW research capture is intentionally non-invasive relative to normal MotoLab measurement logic.
- The current gear-confirm development adds a third-gear guard: microphone/raw research capture pauses when the third-gear condition is not active/confirmed and resumes only deliberately.
- Gear-guard transitions are logged in the research timeline.
- Research data uses a separate `VanaMotoLabResearch` IndexedDB so normal runs and learning RAW storage are not disturbed.

## Automatic multi-phone research / RAW sync
- Research sync is local-first; the phone retains research data and retries later after network loss/app reopen.
- Per-device persistent identity plus driver/phone labels separate simultaneous tests.
- RAW remains local-first and is not deleted by automatic sync.
- Beta auth has been enabled for automatic RAW sync.
- Receiver/read secrets must never be committed to the public application repository.
- Received RAW/research data belongs in private `anttivanttinen-max/Motolab-data`.

## Vehicle / maintenance work
- Finland vehicle database v2 files are installed in the application repository.
- Vehicle lookup includes Yamaha DT125R and Derbi Senda 50 families and editable drivetrain data.
- Technical-spec editor and maintenance/history modules remain active.
- Vehicle lookup / technical-spec refresh fixes from v32.3 must be preserved.

## UI / usability
- Home-screen microphone control remains directly reachable.
- Settings panels remain collapsible with remembered open/closed state.
- Third-gear research confirmation buttons are part of the current build.
- Dedicated bottom-navigation **LIVE** inspection page is active in the v32.9 base used by v32.9.1 FIELD.
- Product split: normal measurement/home stays focused; Settings contains user-adjustable choices; LIVE contains deep technical state and observability.
- LIVE provides a traffic-light GPS / MIC / IMU / RAW / SYNC summary and expandable cards for GPS, MIC/RPM, IMU, GEAR, DYNO/RUN, RAW/SYNC/QUEUES, DIAGNOSTICS/EVENT LOG and SYSTEM.
- The newer v34 appearance is approved and locked, but it remains on the separate v34 line until explicitly promoted.

## v32.6 iOS microphone recovery implementation
- v32.6 introduced fresh-stream recovery through `stopAudio()` + `startAudio()`, bounded approximately **0.5 s → 1 s → 2 s → 5 s** retry, structured recovery telemetry, and the **MIC RECOVERY • PALAUTA MIKROFONI** user-gesture action.
- The implementation did not change GPS MASTER, displayed-RPM authority, run acceptance, gear learning, smart-RPM candidate selection or dyno calculations.
- Field report after v32.6 showed repeated microphone OFF/ON cycling.

## v32.8 microphone stability correction
- `sensor_persistence.js` is now `sensor-persistence-v5`.
- Root cause of the OFF/ON reconnect storm was the use of `globalThis.MOTOLAB_AUDIO_LAST?.t` as a destructive frame-stale trigger without a reliable producer-backed timestamp in the active repository line.
- v32.8 removes `audio_frames_stale` as a destructive reconnect reason.
- A live, enabled track on an active stream is authoritative for the persistence watchdog.
- Fresh-stream teardown/recreation remains available for genuinely non-live/ended tracks and existing backoff/manual recovery behavior is retained.
- Details are recorded in `MIC_STABILITY_V32_8.md`.
- Real-device validation remains required: live mic must stay continuously ON while a real ended/disconnected track must still recover correctly.

## v32.7 full persistent diagnostics
- `diagnostics.js` / `motolab-diagnostics-v1` is always-on and observational only.
- It records `window.error`, `unhandledrejection`, `console.error`, `console.warn`, failed fetches, non-OK HTTP responses, network changes, visibility/page lifecycle, media-device changes and selected Service Worker state messages.
- It mirrors central `addLearningEvent` traffic into a local persistent ring without changing the original event call.
- Every diagnostic record carries build/release identity, session id and a sensor snapshot where available.
- A 500-event persistent local ring, session marker and heartbeat survive app restarts/crashes.
- Previous sessions without a reliable clean shutdown produce `previous_session_unclean` on the next boot with the last heartbeat, sensor state and queue summary.
- iOS `pagehide` is intentionally **not** treated as proof of clean shutdown, because the PWA may be backgrounded and later killed.
- All known persistent queue states plus other localStorage keys containing `queue` are summarized. Queue counts/status/errors are captured without copying authentication secrets or arbitrary payload contents.
- Pending diagnostic events carry `rawMirrored=false` and are replayed in bounded batches into the normal MotoLab RAW/learning stream as `diagnostic_replay` once `addLearningEvent` is available again.
- Detailed architecture and safety rules are documented in `MOTOLAB_DIAGNOSTICS.md`.
- Diagnostics must never gain authority over GPS MASTER, RPM, run acceptance, gear learning, candidate selection, sensor recovery or dyno calculations.

## v32.9 LIVE technical status page — retained under v32.9.1 FIELD
- `live_status.js` / `motolab-live-status-v1` dynamically adds a **LIVE** button to the bottom navigation and a dedicated technical status page.
- Normal visible navigation becomes effectively MITTAUS / VEDOT / LIVE / ANALYYSI / ASETUKSET; developer-only AUTOTUNE remains controlled by existing developer mode.
- LIVE reads existing runtime state only. It does not write measurement configuration or control sensors.
- GPS card exposes active state, speed, GPS-derived RPM and control-authority context where available.
- MIC/RPM card exposes wanted state, track state/enabled/muted/device, audio/raw RPM, confidence, f0, candidate gap and runner-up when available.
- Additional cards expose IMU, gear/fusion/slip, live dyno/run state, RAW learning counters, RAW/sync queue status, all diagnostics queue summaries, recent diagnostic events and system/build/PWA state.
- `live_status_guard.js` keeps the dynamically injected LIVE page outside the legacy `.screen` count used by the existing self-test while ensuring leaving LIVE through any normal nav button hides the page correctly.
- LIVE refreshes only while its page is active, approximately every 750 ms, to limit unnecessary UI work.
- Details and validation checklist are documented in `LIVE_STATUS_V32_9.md`.
- LIVE is strictly observational and must not alter GPS MASTER, RPM, run acceptance, gear learning, microphone recovery, adaptive learning or dyno calculations.

## ARM AUTO / multi-pull capture
- ARM AUTO remains a persistent session across multiple pulls.
- Every detected pull is completed and saved as its own run; no new ARM press is required between pulls.
- Re-arm uses cooldown/reset hysteresis and clears the pre-buffer so the previous pull tail is not merged into the next pull.
- STOP explicitly ends/disarms the continuous ARM AUTO session.

## Pull comparison rule
- Development comparisons should primarily show change relative to the **previous MotoLab pull**, treated as the 100% reference.
- PerfExpert results may be compared against the same previous MotoLab reference.
- Compare peak power, peak torque and useful-range/curve performance, not only one peak point.

## Contact RPM reference
- Preferred historical contact mounting: extension nut + aluminium shim + tightly coupled BT earbud/contact microphone.
- Strong reference: approximately 6600 rpm truth, 6591 rpm audio average, 92.2% confidence, f0 ~109–112 Hz, harmonics ~220/330/440/550/660 Hz.
- Older tests without the extension nut remain a separate calibration set.

## Native iOS / AirPods motion research
- `ios/AirPodsMotionTest/` contains the native SwiftUI `CMHeadphoneMotionManager` experiment.
- Real-device installation/code signing remains postponed while Apple Developer enrollment is unresolved.
- AirPods motion remains experimental and is not a validated MotoLab RPM source.

## Current validation priorities
- Keep `main` v32.9.1 FIELD stable while v34 validation remains separate.
- Preserve the green Chromium + Service Worker smoke result from `f203b3e` and keep the submenu-overlap assertion added at `ae6f100`.
- Resolve and real-device validate the v34 GitHub Pages/Railway login-auth origin path end-to-end; submenu fixes do not prove login works.
- Confirm the v34 user submenu clears the notification/status area on the actual phone viewport.
- Real-device validate v34 on iPhone for GPS/microphone behavior before promotion; browser smoke does not prove hardware sensor behavior.
- Real-device validate v32.8 microphone stability: no false OFF/ON cycle while still recovering a genuinely ended track.
- Real-device validate LIVE navigation and telemetry on the v32.9.1 field line without measurement-performance regression.
- Confirm LIVE GPS/MIC/IMU/RAW/SYNC traffic lights match actual states and that queue/error details are readable.
- Validate v32.7 diagnostics on a real iPhone: confirm errors/queue transitions survive reload, `previous_session_unclean` appears after an abrupt termination, and retained diagnostic events replay into RAW.
- Validate adaptive candidate tracking against GPS across acceleration, steady throttle and deceleration.
- Validate 500 rpm region learning and ensure no region gets worse when a model is accepted.
- Validate Auto Gear Learn interaction without weakening GPS MASTER authority.
- Preserve all raw/top-candidate/harmonic information for replay and trainer evaluation.
- Before any v34 promotion, re-check current `main`, release/cache identity and measurement invariants, preserve the locked approved UI, and require explicit promotion/install approval.

## Deferred work
- Automatic knock / ignition autotune remains intentionally parked.
- Full Knowledge Base integration across every porting/pipe/carb/ignition tuning calculator remains intentionally parked.
- Camera RPM remains disabled.

## Durable project-memory rule
- GitHub is the durable MotoLab project memory.
- Important decisions, test results, RAW interpretations, build changes, regressions/fixes and unfinished work must be archived in `MOTOLAB_CONVERSATION_ARCHIVE.md` and, when they change the active handoff, here.
- A recurring archive job checks for new relevant MotoLab information and updates documentation only; it must not alter application code or create empty commits.
- Before new implementation work, check current `main`, this status, the conversation archive and relevant technical notes.

## Regression rule
Before merging measurement changes, preserve GPS, GPS MASTER + MIC LEARN, GPS ONLY, explicit phone-mic modes, continuous ARM AUTO multi-pull capture, AutoRide, manual run recording, run persistence, profiles, Knowledge Base, learning/raw data and RAW JSON export, RAW replay, full-trip research capture, automatic research/RAW sync, vehicle lookup, maintenance, compact Settings UI, DT startup profile, release identity/version validation, PWA update behavior, persistent diagnostics, v32.8 microphone-stability correction, LIVE technical inspection, v34 browser/Service Worker smoke regression coverage, v34 user-submenu notification-area clearance assertion, and keep native AirPods motion experimental until validated on a real device.