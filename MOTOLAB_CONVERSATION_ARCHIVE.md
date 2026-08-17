# VÄNÄ MotoLab — conversation archive and durable project memory

Updated: 2026-08-17

## Purpose
This file is the durable GitHub memory for MotoLab development conversations. Important decisions, test results, constraints, implementation notes, unfinished work, data-analysis findings and cross-thread handoff notes must be copied here so they are not lost when a ChatGPT conversation is closed or becomes unavailable.

## Archiving rule
- Treat GitHub as the source of truth for durable MotoLab project memory.
- Before implementation work, read the latest `main`, `MOTOLAB_SYNC_STATUS.md`, this archive, and relevant technical notes.
- After implementation, append the important decisions, test results, regressions, new files/builds and remaining work here or into the matching dedicated document.
- Do not rely on one chat thread as the only place where a decision exists.
- When two MotoLab conversations run in parallel, both must inherit the same repository state and neither should create a competing "latest" version.
- Raw measurement data belongs in the private `Motolab-data` repository; implementation/project memory belongs in `v-n-_autodyno`.
- A recurring project-memory job checks for new MotoLab decisions/results and updates this archive and, when needed, `MOTOLAB_SYNC_STATUS.md`. It must not modify application code and must avoid empty/no-op commits.

## Current core constraints
- GPS MASTER remains authoritative during GPS + microphone learning. Microphone data must not alter displayed RPM, run acceptance or gear learning while GPS MASTER is selected.
- Preserve raw/source-specific measurements separately from derived/fused values so old data can be reprocessed later.
- Camera RPM remains disabled unless explicitly reopened as a development topic.
- Microphone RPM development must retain candidate/harmonic information, continuity information and reference comparisons rather than only the finally chosen RPM.
- Measurement continuity and logging reliability take priority over UI smoothness.
- Main development happens on one shared GitHub `main`; always inspect current HEAD before editing.

## Important RAW / microphone findings retained from earlier conversations
- v32.4 / build 2026-08-16h is the earlier RAW baseline for GPS-master and BT/contact microphone comparisons.
- A prior RAW set contained 70 chunks and 14,709 samples.
- GPS-master structure behaved as intended: `rpmControlAuthority = gps` and microphone stayed out of displayed RPM / acceptance / gear-learning authority during the learning phase.
- BT/contact microphone contained real engine-RPM information but candidate/harmonic selection was not yet stable enough to trust alone.
- Useful examples found in RAW included roughly GPS 5191 rpm vs mic 5512 rpm (~6.2% error) and GPS 4261 rpm vs mic 3807 rpm (~10.6% error with lower confidence).
- Harmonic jumping was visible in historical microphone data, which motivated retaining multiple candidate alternatives and continuity tracking.
- Preferred historical contact mounting: extension nut + aluminium shim + tightly coupled BT earbud/contact microphone.
- Strong contact reference: about 6600 rpm truth, 6591 rpm audio average, ~92.2% confidence, f0 about 109–112 Hz and harmonics near 220/330/440/550/660 Hz.

## New RAW finding — iOS microphone recovery
- New `Motolab-data` RAW chunks from the active 32.5 session `learn-1786918521880-f44c5b485d4888` show a repeatable microphone recovery failure while GPS and IMU stay active.
- The persisted desired sensor state is `gps=true, imu=true, mic=true`, but repeated `sensor_autostart_check` events report `gps=true, imu=true, mic=false`.
- `sensor-persistence-v3` repeatedly logs `mic_auto_reconnect` with `ok:false` and reason `track_not_live`; `phone-rpm-smart-v1` also emits repeated `phone_rpm_off` events.
- The same RAW rows preserve the GPS MASTER safety rule correctly: `rpmControlAuthority=gps`, `micInfluencesDisplayedRpm=false`, `micInfluencesRunAcceptance=false`, and `micInfluencesGearLearning=false`.
- This is now a confirmed field-data regression/unfinished item: microphone persistence/reconnect on iOS is not yet reliable even though GPS/IMU persistence remains active. Do not mark sensor recovery complete until a new RAW session shows the microphone returning live without repeated `track_not_live` failures.

## v32.6 iOS microphone recovery implementation — published, field validation pending
- Recovery implementation started from `main` HEAD `c847317864fc7696b15295dd9d743a2e20ec553e` on branch `agent/v32.6-ios-mic-recovery` and was promoted to `main` by fast-forward after confirming no competing `main` commits had appeared.
- Active release identity became **v32.6 / build `2026-08-17a-mic-recovery`**; Service Worker cache identity was aligned with it.
- `sensor_persistence.js` advanced from `sensor-persistence-v3` to `sensor-persistence-v4`.
- The recovery path fully tears down the stale microphone pipeline through existing `stopAudio()` and then calls existing `startAudio()`, which requests a fresh exact-device `getUserMedia()` stream and rebuilds the AudioContext/worklet graph.
- Automatic retries use bounded backoff of approximately **500 ms → 1 s → 2 s → 5 s**, with 5 s retained for continued failures instead of the old fixed reconnect loop.
- Recovery telemetry includes `mic_recovery_attempt`, `mic_stream_recreated`, `mic_recovery_success`, `mic_recovery_failure`, teardown-error detail, and `mic_recovery_user_gesture`.
- After three failed automatic recovery attempts, the UI exposes **MIC RECOVERY • PALAUTA MIKROFONI**. Its tap is used as an explicit iOS user gesture and forces another fresh-stream recovery attempt.
- Manual microphone-off and explicit microphone reselection reset retry state and hide the recovery action.
- GPS MASTER safety is intentionally untouched: no changes were made to displayed-RPM authority, run acceptance, gear learning, GPS reference logic, smart-phone RPM candidate selection or dyno calculations.

## New field regression after v32.6 — microphone OFF/ON reconnect storm
- User field report after publishing v32.6: the microphone remains in a repeated OFF/ON cycle instead of staying live.
- Code inspection found the v32.6 watchdog function `micFramesFresh()` reads `globalThis.MOTOLAB_AUDIO_LAST?.t`, but repository search found no producer for `MOTOLAB_AUDIO_LAST`.
- As a result, `micFramesFresh()` can remain false even while the microphone track is genuinely live. The v32.6 health check can then call fresh-stream recovery with reason `audio_frames_stale`, tearing down and reopening a working microphone repeatedly.
- This is a confirmed implementation regression in the v32.6 recovery logic, not evidence that iOS itself must toggle the microphone this way.
- Planned correction: do not use the invalid frame-stale signal as a destructive recovery trigger. Fresh-stream teardown/recreation should be reserved for a genuinely non-live/ended track or another independently validated stall indicator.
- Keep this fix separate from the full diagnostics work so measurement/recovery behavior is not accidentally changed by observability code.

## v32.7 full persistent diagnostics — implementation prepared
- User decision: MotoLab must have an always-on comprehensive error-detection/diagnostic mode, not only microphone-specific logging.
- The system must retain not just crashes but other error states and all relevant event/queue state needed to prove application operation and reconstruct what happened before a failure.
- New file `diagnostics.js` uses module id `motolab-diagnostics-v1` and is loaded early by the PWA shell.
- Prepared release identity is **v32.7 / build `2026-08-17b-full-diagnostics`** on branch `agent/v32.7-full-diagnostics` before promotion.
- Captured error classes include `window.error`, `unhandledrejection`, `console.error`, `console.warn`, failed `fetch()` calls and non-OK HTTP responses.
- Captured state/lifecycle classes include network online/offline, visibility/page transitions, media-device changes, selected Service Worker messages and controller changes.
- Central `addLearningEvent` traffic is mirrored into diagnostics without changing the original event call.
- Diagnostic records include release/build identity, diagnostic session id and sensor state snapshots where available.
- A persistent local ring keeps the last 500 diagnostic events in `localStorage`; a separate heartbeat and session marker support detection of an unfinished previous session after restart.
- iOS `pagehide` is explicitly **not** considered proof of a clean shutdown because backgrounded PWAs may later be killed by the OS.
- Queue diagnostics summarize all known persistent MotoLab queue keys and also scan other localStorage keys containing `queue`. Only safe count/status/error metadata is retained; authentication secrets and arbitrary payload contents are not copied.
- Pending local diagnostics use `rawMirrored=false`. Once the normal `addLearningEvent` path becomes available, retained diagnostic records are replayed in bounded batches into RAW as `diagnostic_replay`, allowing pre-crash history to reach the normal RAW pipeline on a later boot.
- A boot following an unfinished session can emit `previous_session_unclean` with the previous heartbeat, sensor snapshot and queue state.
- Detailed architecture is recorded in `MOTOLAB_DIAGNOSTICS.md`.
- Diagnostics is observational only and must never influence GPS MASTER authority, displayed RPM, run acceptance, gear learning, adaptive candidate choice, dyno calculations or sensor recovery decisions.

## Adaptive RPM-learning implementation retained from current development
- `rpm-learning-model.json` exists in the application repository using schema `motolab_rpm_learning_model_v1`.
- Baseline model starts with no learned bands and explicit acceptance limits; later accepted trainer models may replace the baseline only after validation.
- Adaptive GPS-taught RPM learning and RAW replay were added on 2026-08-16 (`58c1feb`, `fd6cfe4`, `fe66331`).
- The design learns RPM-region behavior in 500 rpm bands and can prefer 0.5x / 1x / 2x harmonic branches when GPS-reference evidence supports the choice.
- Continuity/prediction is part of candidate selection so one-frame harmonic jumps are disfavored.
- Local RAW history can be replayed through newer learning logic instead of requiring every algorithm revision to be tested only with new rides.
- Auto Gear Learn remains available but GPS MASTER + MIC LEARN must not let microphone shadow RPM gain gear-learning authority.
- The overnight trainer is instructed to keep rollback history in `Motolab-data` and only publish a validated accepted model to the app repository; it must not change unrelated application code.

## Current research / build handoff
- Published `main` at the start of v32.7 diagnostics work is **v32.6 / build `2026-08-17a-mic-recovery`**.
- Prepared next line is **v32.7 / build `2026-08-17b-full-diagnostics`** with persistent diagnostics only; the microphone OFF/ON stability correction remains a separate open fix.
- Third-gear research has a guard/confirmation flow so research microphone/raw collection can be paused when the third-gear condition is not confirmed and resumed deliberately.
- Gear guard transitions are logged into the research timeline.
- Phone raw research capture is non-invasive relative to the normal MotoLab measurement logic.
- Finland vehicle database v2 files have been installed in the application repository.
- Beta auth was enabled for automatic RAW sync.

## Data pipeline retained from conversations
- MotoLab stores RAW locally first.
- RAW auto-sync sends new chunks to the Railway receiver when configured.
- Railway mirrors received RAW into private GitHub repository `anttivanttinen-max/Motolab-data`.
- Multi-phone/device data is separated by persistent device identity/labels.
- GitHub data can be analyzed manually at any time; an overnight trainer task also exists for new RAW/research data.
- Night trainer must validate candidate models against held-out/reference data before replacing the accepted model.
- Bad or non-improving models must not replace the accepted model; rollback history must be kept.

## Sensor / microphone UI decisions retained from conversations
- Sensor ON/OFF preferences should persist across app restarts.
- A microphone choice should be directly reachable from the home screen.
- Known/available audio inputs should be selectable; an unavailable previously selected device must not silently fall back to a different microphone and be treated as the same sensor.
- iOS may require a user gesture before opening the audio stream; desired selection/state can persist even when activation waits for a tap.
- Settings/maintenance sections should be collapsible to keep the interface compact.

## Current implementation direction
- First microphone task remains fixing the v32.6 OFF/ON reconnect storm without weakening genuine dead-track recovery.
- v32.7 diagnostics must then be validated on a real iPhone, including persistence across abrupt termination and RAW replay of retained diagnostic events.
- GPS-supervised microphone learning should improve candidate/harmonic choice and RPM continuity without weakening GPS MASTER authority.
- Keep raw candidate sets and region-specific behavior so later models can learn 0.5x / 1x / 2x branch preference by RPM region if reference data supports it.
- Auto Gear Learn exists but should only learn from data paths that are explicitly allowed by the selected control mode.
- Existing RAW history should remain usable for later replay/reprocessing.
- Field validation is still required for adaptive candidate tracking, 500 rpm band learning, Auto Gear Learn interaction and iOS sensor/microphone stability.

## Deferred work explicitly parked for later
- Automatic knock/ignition autotune.
- Full Knowledge Base integration across every porting/pipe/carb/ignition tuning calculator.

## Project-wide durable-memory instruction
When a MotoLab conversation contains information that would matter after that conversation ends, archive it in GitHub. This includes at minimum:
1. accepted decisions and constraints,
2. measured test results and reference values,
3. new algorithms and why they were changed,
4. known regressions and fixes,
5. build/version identity,
6. unresolved tasks and intentionally deferred work,
7. RAW-data interpretation notes,
8. deployment/sync architecture changes,
9. cross-thread handoff notes.

Full verbatim chat transcripts are not automatically available through the GitHub connector. Therefore the durable archive stores project-relevant content and decisions, while any transcript that is manually exported/provided can be added under a future `conversation-exports/` directory without replacing these structured notes.
