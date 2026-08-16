# VÄNÄ MotoLab — shared development sync status

Updated: 2026-08-16

## Current application line
- Active published line: **v32.4 / build 2026-08-16k** on `main`.
- v31 remains the historical core baseline; v32.x modules are integrated into the published PWA shell.
- Release identity is source-native through `version.js` and aligned with the Service Worker/app shell.
- The app has an explicit **UUSI MOTOLAB-VERSIO SAATAVILLA → PÄIVITÄ NYT** flow.
- Permanent GitHub Actions validation is version-agnostic.
- Yamaha DT125R Athena 170 is the current startup-bike line from the parallel MotoLab development thread.
- Current temporary GPS power calibration in `dyno_curve_v2.js` is **1.07** (`v32-dyno-curve-2.2`); the earlier 1.85 experiment is superseded.

## Measurement strategy
- First road-test phase uses **GPS MASTER + MIC LEARN**.
- GPS/speed + selected gear is the control RPM authority.
- BT/contact microphone is a shadow/learning sensor and must not alter displayed RPM, run acceptance, or gear learning in this mode.
- GPS reference RPM can come from saved gear calibration or calculated drivetrain data.
- Camera RPM remains disabled.
- Phone internal microphone remains unvalidated as an RPM source.
- v32.4/build 2026-08-16h remains the RAW-algorithm baseline for microphone/harmonic comparisons; later builds add UI/research capture without redefining that baseline selector behavior.

## Full-trip 3rd-gear GPS + MIC research
- Build **2026-08-16k** adds `trip_research.js` and the Measurement-screen panel **3. VAIHTEEN GPS + MIC TUTKIMUSAJO**.
- Starting research selects gear 3 and GPS MASTER + MIC LEARN, starts GPS and the selected BT MIC, but GPS remains the only RPM control authority.
- The current audio estimator still chooses its winner exactly as before, but now also exposes its **complete scored candidate set** for research capture: up to 12 correlation-lag candidates × multipliers 1 / 0.5 / 2.
- Candidate export format is compact: `[rpm, observedHz, rawRpm, correlation, fingerprintScore, totalScore, multiplier]`.
- Research timeline records GPS/speed-derived RPM reference, GPS confidence/accuracy, acceleration and timestamps at 5 Hz, plus timestamped candidate frames.
- The complete selected BT MediaStream is also recorded continuously with `MediaRecorder` and persisted as **5-second audio chunks**.
- Research data uses a separate `VanaMotoLabResearch` IndexedDB so normal runs and learning RAW storage are not disturbed.
- **STOP & TALLENNA** closes the research session. **VIE VIIMEISIN • JSON + AUDIO** exports the full timeline/manifest plus a combined audio file for offline analysis.
- Goal: search the whole ride for continuous candidate/harmonic tracks that follow GPS RPM through acceleration, steady throttle and deceleration, including tracks the current selector did not choose as winner.

## Next microphone algorithm line
- Target: harmonic identification, RPM continuity tracking, and GPS-supervised microphone learning.
- Good GPS–MIC pairs are retained as positive training data; harmonic errors are retained as negative/weak training data.
- Planned learning-window policy: ≤12% excellent, 12–20% good, 20–30% weak/harmonic-training, >30% harmonic suspect.
- Full-trip candidate data should be analyzed before giving any new microphone algorithm more control. GPS MASTER remains authoritative.

## UI / usability
- `ui_compact.js` adds the direct home-screen **BT MIC** control using the existing external-mic toggle.
- Settings panels are collapsible with **AVAA / SULJE** controls and remember their open/closed state locally.
- Dynamically inserted Settings panels are also collapse-capable, including maintenance, technical specs and RAW/learning panels.
- SMART BIKE PROFILES and MITTAUS & RPM default open; other long Settings sections default collapsed.

## ARM AUTO / multi-pull capture
- **v32.4 fixes ARM AUTO as a persistent session.** One ARM AUTO press remains active across multiple pulls.
- Every detected pull is completed and saved as its own run; no new ARM press is required between pulls.
- Re-arm uses cooldown/reset hysteresis and clears the pre-buffer so the previous pull tail is not merged into the next pull.
- **STOP explicitly ends/disarms the continuous ARM AUTO session.**

## Pull comparison rule
- Development comparisons should primarily show change relative to the **previous MotoLab pull**, treated as the 100% reference.
- PerfExpert results can be compared against the same previous MotoLab reference.
- Compare peak power, peak torque and useful-range/curve performance, not only one peak point.

## Contact RPM reference
- Preferred current contact reference mounting: extension nut + aluminium shim + tightly coupled BT earbud/contact microphone.
- Strong reference: approximately 6600 rpm truth, 6591 rpm audio average, 92.2% confidence, f0 ~109–112 Hz, harmonics ~220/330/440/550/660 Hz.
- Older pipe mounting is still a valid comparison configuration because the first application could be calibrated accurately with it; do not switch mounting solely on current winner-selection errors before full-trip candidate analysis.
- Keep older tests without the extension nut in a separate calibration set.

## Native iOS / AirPods motion research
- `ios/AirPodsMotionTest/` contains the native SwiftUI `CMHeadphoneMotionManager` test.
- GitHub Actions macOS CI builds the unsigned Simulator app without requiring the user to own a Mac.
- Real-device installation/code signing is postponed while Apple Developer enrollment is unresolved.
- AirPods motion remains experimental and is not a validated MotoLab RPM source.

## RAW / learning data
- Preserve raw/source-specific data separately from derived/fused values so old runs can be reprocessed with future algorithms.
- GPS MASTER learning rows include synchronized GPS reference and MIC shadow data.
- Existing learning RAW stores the audio winner/raw/runner and summary metrics; pre-16k historical RAW does **not** contain the complete candidate set.
- Build 16k full-trip research capture adds complete candidate-set logging separately for future offline tracking.
- RAW AUTO SYNC is integrated and remains local-first; auto sync never deletes local RAW data.
- RAW JSON export is integrated in `raw_sync.js`; Settings → RAW AUTO SYNC contains **VIE RAW DATA • JSON**.
- No ingest/read secrets are committed to the public repository.

## Vehicle / maintenance work
- Vehicle lookup includes Yamaha DT125R and Derbi Senda 50 families and editable drivetrain data.
- Technical-spec editor and maintenance/history modules are active.
- Vehicle lookup / technical-spec refresh fixes from v32.3 must be preserved.

## Cross-thread synchronization rule
- Both MotoLab conversations use this repository/status file as the shared implementation state.
- Before new implementation work, check the latest decisions/test results and current `main` from both MotoLab threads when available.
- After implementation, update the shared repository/status so the other thread inherits the same decisions and code state.

## Regression rule
Before merging measurement changes, preserve GPS, GPS MASTER + MIC LEARN, BT MIC, GPS ONLY, AUTO FUSION, continuous ARM AUTO multi-pull capture, AutoRide, manual run recording, run persistence, profiles, Knowledge Base, learning/raw data and RAW JSON export, full-trip research capture, RAW auto sync, vehicle lookup, maintenance, compact Settings UI, DT startup profile, source-native release identity, version validation, PWA update behavior, and keep native AirPods motion experimental until validated on a real device.
