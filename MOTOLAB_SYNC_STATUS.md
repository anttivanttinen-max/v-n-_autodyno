# VÄNÄ MotoLab — shared development sync status

Updated: 2026-08-17

## Current application line
- Active published line on `main`: **v32.7 / build `2026-08-17b-full-diagnostics`**.
- v32.7 was promoted by fast-forward from `agent/v32.7-full-diagnostics` after confirming no competing `main` commits had appeared and the diff contained only diagnostics, release/PWA loading and project-memory files.
- `version.js` is the release-identity source and the Service Worker/app shell must stay aligned with it.
- v31 remains the historical core baseline; v32.x modules are integrated into the published PWA shell.
- Yamaha DT125R Athena 170 remains the startup-bike line used by the current development flow.
- Current temporary GPS power calibration in `dyno_curve_v2.js` remains **1.07** (`v32-dyno-curve-2.2`); the earlier 1.85 experiment is superseded.

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
- A stream watchdog restarts ended/muted/stalled microphone streams when the page is visible and the microphone mode remains wanted.
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
- Sensor state persistence / automatic restoration work exists, but iOS field stability still requires validation.
- **Confirmed from RAW on 2026-08-17:** persisted desired state can remain `mic=true` while the active microphone stays false; repeated `sensor-persistence-v3` reconnect attempts fail with `track_not_live` while GPS and IMU remain active.

## v32.6 iOS microphone recovery implementation
- `sensor_persistence.js` is `sensor-persistence-v4` on `main`.
- When a previously live wanted microphone becomes non-live/stalled, recovery fully calls the existing `stopAudio()` teardown before `startAudio()` requests a fresh `getUserMedia()` stream and rebuilds the AudioContext/worklet chain.
- Automatic retry is bounded/backed off through approximately **0.5 s → 1 s → 2 s → 5 s**, with the 5 s delay retained for further failures instead of a tight loop.
- Recovery telemetry adds `mic_recovery_attempt`, `mic_stream_recreated`, `mic_recovery_success`, `mic_recovery_failure`, teardown-error detail and user-gesture recovery events.
- After three failed automatic recovery attempts, a visible **MIC RECOVERY • PALAUTA MIKROFONI** action is exposed; tapping it performs a forced fresh-stream attempt from an iOS user gesture.
- Manual microphone-off and a newly selected microphone reset recovery/backoff state and hide the recovery action.
- The implementation does **not** change GPS MASTER, displayed-RPM authority, run acceptance, gear learning, smart-RPM candidate selection or dyno calculations.
- Field report after v32.6: the microphone repeatedly toggles OFF/ON. Code inspection found `micFramesFresh()` relies on `globalThis.MOTOLAB_AUDIO_LAST`, but no producer for that timestamp exists in the repository. This makes a live microphone appear stale and can trigger destructive recovery repeatedly. Treat this as an open v32.6 regression.
- The intended stability correction is to stop using the invalid frame-stale condition as a reason to tear down a live microphone. Fresh-stream recreation should be reserved for a genuinely non-live/ended track or another independently validated stall signal.

## v32.7 full persistent diagnostics — active on main
- New `diagnostics.js` / `motolab-diagnostics-v1` is always-on and observational only.
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
- Fix and field-validate the v32.6 microphone OFF/ON reconnect storm without weakening real dead-track recovery.
- Validate v32.7 diagnostics on a real iPhone: confirm errors/queue transitions survive reload, `previous_session_unclean` appears after an abrupt termination, and retained diagnostic events replay into RAW.
- Validate adaptive candidate tracking against GPS across acceleration, steady throttle and deceleration.
- Validate 500 rpm region learning and ensure no region gets worse when a model is accepted.
- Validate Auto Gear Learn interaction without weakening GPS MASTER authority.
- Preserve all raw/top-candidate/harmonic information for replay and trainer evaluation.

## Deferred work
- Automatic knock / ignition autotune remains intentionally parked.
- Full Knowledge Base integration across every porting/pipe/carb/ignition tuning calculator remains intentionally parked.

## Durable project-memory rule
- GitHub is the durable MotoLab project memory.
- Important decisions, test results, RAW interpretations, build changes, regressions/fixes and unfinished work must be archived in `MOTOLAB_CONVERSATION_ARCHIVE.md` and, when they change the active handoff, here.
- A recurring archive job checks for new relevant MotoLab information and updates documentation only; it must not alter application code or create empty commits.
- Before new implementation work, check current `main`, this status, the conversation archive and relevant technical notes.

## Regression rule
Before merging measurement changes, preserve GPS, GPS MASTER + MIC LEARN, GPS ONLY, explicit phone-mic modes, continuous ARM AUTO multi-pull capture, AutoRide, manual run recording, run persistence, profiles, Knowledge Base, learning/raw data and RAW JSON export, RAW replay, full-trip research capture, automatic research/RAW sync, vehicle lookup, maintenance, compact Settings UI, DT startup profile, release identity/version validation, PWA update behavior, persistent diagnostics, and keep native AirPods motion experimental until validated on a real device.
