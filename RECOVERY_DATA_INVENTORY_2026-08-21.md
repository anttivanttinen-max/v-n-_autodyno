# VÄNÄ MotoLab — recovered data inventory

Created: 2026-08-21
Purpose: durable, non-destructive inventory of recovered/known MotoLab data. This file does NOT change application behavior.

## Preservation rule
- Never delete historical measurement, calibration, profile, gearing, RPM, microphone, research or test data merely because it is obsolete for the current build.
- Archive obsolete material separately instead of deleting it.
- Preserve source/raw values separately from derived/fused values so old data can be replayed with future algorithms.
- RAW measurement payloads belong in private `Motolab-data`; implementation/project-memory references belong in `v-n-_autodyno`.

## Protected repository snapshots
- `archive/pre-cleanup-2026-08-18`: repository state before the 2026-08-18 cleanup/removal sequence. Protects old `ty/` material, v31 artifacts and one-off workflows.
- `archive/pre-tester-removal-2026-08-16`: repository state before tester removal. Protects `tester/index.html`, `tester/mic-test.html`, `tester/refresh.html` and the surrounding historical state.

## Recovered v31 artifacts
- `VANA_MotoLab_v31_CoreSprint.zip` existed before cleanup; historical blob SHA: `5b8e54674c1f245e36e3f47c2de6bc40800edfdb`.
- `V31_index.patch` preserves the v31 Core Sprint delta.
- v31 profile model contained `gearRatios`, `gpsCalibrations`, carb settings and later the Vehicle / Engine Knowledge Base.
- Profile snapshots included `gearRatios`, `gpsCalibrations`, RPM source/settings, mass, CdA, Crr, air density, microphone thresholds/device and knowledge snapshot.
- Actual learned `gearRatios` were profile/local-storage data, not necessarily hard-coded source values. Therefore an empty source default `gearRatios: []` is NOT evidence that learned ratios never existed.

## Vehicle / Engine Knowledge Base fields recovered from v31 patch
- displacement cc
- cylinders
- bore mm
- stroke mm
- cylinder/kit
- squish mm
- chamber cc
- carburetor size mm
- exhaust system
- ignition/controller
- front sprocket
- rear sprocket
- wheel circumference mm
- setup tag
- notes

## RPM / microphone reference data retained
- v32.4 / build `2026-08-16h` is an earlier GPS-master + BT/contact-mic RAW baseline.
- Known RAW set: 70 chunks / 14,709 samples.
- GPS MASTER authority: `rpmControlAuthority = gps`; microphone must not affect displayed RPM, run acceptance or gear learning during GPS-master learning.
- Example match: GPS 5191 rpm vs microphone 5512 rpm (~6.2% error).
- Example match: GPS 4261 rpm vs microphone 3807 rpm (~10.6% error, lower confidence).
- Strong contact reference: true/reference ~6600 rpm; audio average 6591 rpm; confidence ~92.2%; f0 ~109–112 Hz; harmonics ~220/330/440/550/660 Hz.
- Contact mounting reference: extension nut + aluminium shim + tightly coupled BT earbud/contact microphone.
- Earlier sweep/reference finding: strongest RPM-following component averaged around ~1.9x engine fundamental, making the 2nd harmonic an important tracker candidate.
- Preserve candidate alternatives, harmonic family, confidence, continuity and reference comparison — not only final RPM.

## RPM learning / replay
- Learning model schema: `motolab_rpm_learning_model_v1`.
- Adaptive GPS-taught learning uses 500-rpm regions and may prefer 0.5x / 1x / 2x harmonic branches when supervised evidence supports them.
- Existing RAW history is intended to be replayable through newer logic.
- Bad/non-improving learned models must not overwrite the accepted model; rollback history must be retained.

## iOS microphone recovery evidence
- Session `learn-1786918521880-f44c5b485d4888` showed microphone recovery failure while GPS/IMU remained active; repeated mic state was false / `track_not_live`.
- v32.6 added fresh-stream recovery and bounded retry.
- Field report then exposed OFF/ON reconnect storm caused by destructive stale-frame logic.
- v32.8 / build `2026-08-17c-mic-stability` removed `audio_frames_stale` as a destructive reconnect trigger.

## Tester material protected
Historical tester state includes:
- `tester/index.html`: VÄNÄ MotoLab AirPod RPM Tester v2.3.
- `tester/mic-test.html`: microphone diagnostic tester.
- `tester/refresh.html`: historical tester refresh/cache page.
- Tester v2.3 stored accepted test results in localStorage key `vanaAirpodTesterResultsV23` and calibration data in local storage. Therefore some historical test/calibration values may only have existed on the original browser/device unless exported/synced.

## Data pipeline / where more recoverable data can exist
1. Git history and protected archive branches in `v-n-_autodyno`.
2. Private `Motolab-data` RAW/research archive.
3. Railway RAW mirror/backend storage.
4. Browser/device localStorage and IndexedDB from phones used for tests.
5. Exported profile/Knowledge JSON files.
6. Shared/downloaded tester JSON, WAV, video and sweep packages.
7. Chat/project-memory notes and technical markdown files.

## Important recovery limitation
Git history can recover source files and committed artifacts, but it cannot reconstruct arbitrary localStorage/IndexedDB values that were never committed, exported or synchronized. Learned gear ratios, calibration points and tester results are specifically candidates for device-only recovery. Do not replace missing values with guesses.

## Current recovery status
- Repository pre-cleanup state: protected.
- Repository pre-tester-removal state: protected.
- v31 patch/archive references: located.
- RPM/contact reference values: documented.
- RAW baseline identity/count: documented.
- Learned gear-ratio numeric values: not yet proven recovered from repository source; search private RAW/profile/device exports before declaring them lost.
- Device-only localStorage/IndexedDB: requires extraction from original phone/browser backup if not synchronized.

## Next recovery targets
- Inventory private `Motolab-data` for profile snapshots, `gearRatios`, `gpsCalibrations`, calibration points, setup snapshots and candidate/harmonic arrays.
- Cross-reference Railway copies against GitHub RAW so missing chunks can be identified without deleting duplicates.
- Locate any exported `VANA_MotoLab_profile_*.json`, tester exports, WAV/video/JSON sweeps and old ZIPs.
- Build a manifest keyed by source + timestamp + session/device + SHA/hash where available.

Nothing in this recovery branch should be merged into the application/runtime merely to preserve data. Preservation and application restoration are separate operations.