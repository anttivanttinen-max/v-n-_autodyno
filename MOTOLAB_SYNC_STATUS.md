# VÄNÄ MotoLab — shared development sync status

Updated: 2026-08-16

## Current application line
- Active published line: **v32.5 / build 2026-08-16s-phone-rpm** on `main`.
- v31 remains the historical core baseline; v32.x modules are integrated into the published PWA shell.
- Release identity is source-native through `version.js` and aligned with the Service Worker/app shell.
- The app has an explicit **UUSI MOTOLAB-VERSIO SAATAVILLA → PÄIVITÄ NYT** flow.
- Permanent GitHub Actions validation is version-agnostic.
- Yamaha DT125R Athena 170 is the current startup-bike line from the parallel MotoLab development thread.
- Current temporary GPS power calibration in `dyno_curve_v2.js` is **1.07** (`v32-dyno-curve-2.2`); the earlier 1.85 experiment is superseded.

## Measurement strategy
- First road-test / learning phase uses **GPS MASTER + MIC LEARN**.
- GPS/speed + selected gear remains the control RPM authority.
- Phone microphone RPM is now a smart shadow/learning sensor in v32.5 and must not alter displayed RPM, run acceptance, or gear learning while GPS MASTER is selected.
- GPS reference RPM can come from saved gear calibration or calculated drivetrain data.
- Camera RPM remains disabled.
- BT/contact microphone is temporarily sidelined for the phone-mic development line; its historical data remains useful reference material.
- v32.4/build 2026-08-16h remains the earlier RAW baseline for BT/contact microphone/harmonic comparisons.

## Phone microphone RPM — validated development basis
- Standalone Phone RPM Tester v3.6 produced the first complete long sweep suitable for full-range development: **34.642 s / 1040 frames / displayed 1620–9890 rpm**.
- All 1040 frames were captured with chunked IndexedDB storage; no small-area filtering is used for algorithm development.
- User observation during the sweep: displayed RPM stayed close enough to the real engine RPM for the target use; practical target accuracy is approximately **±200 rpm**, with continuity and avoidance of harmonic jumps more important than exact single-frame equality.
- No single-frame ≥1000 rpm jumps were found in the displayed v3.6 RPM track. Largest observed one-frame increases were roughly 590 and 500 rpm, which may include genuine throttle transients.
- Raw/harmonic data repeatedly contains usable RPM information even when the strongest spectral candidate is not the final correct branch.
- Development rule: retain the complete raw candidate/harmonic information; do not discard frames merely because confidence is low.

## v32.5 phone smart RPM sensor
- New injected module: **`phone_rpm_smart.js` / `phone-rpm-smart-v1`**.
- The Service Worker injects and precaches the module in the normal MotoLab PWA shell; `version.js` is v32.5/build `2026-08-16s-phone-rpm`.
- Uses the phone's own default microphone with echo cancellation, noise suppression and automatic gain control requested OFF.
- Spectral tracking scans the engine-frequency range and scores H1–H6 harmonic structure.
- For each strong raw spectral candidate, simultaneous **0.5× / 1× / 2× RPM hypotheses** are evaluated.
- Candidate selection uses spectral strength, harmonic count, previous RPM, predicted RPM/velocity, temporal continuity, candidate gap and a soft GPS reference when one is available.
- Large implausible branch jumps require confirmation; the tracker can hold/follow the predicted branch instead of accepting a one-frame harmonic jump.
- A physical rate limiter still allows rapid motorcycle rev changes (calibrated around the fast transitions observed in v3.6) while blocking impossible discontinuities.
- The phone sensor has a stream watchdog: ended/muted/stalled microphone streams are restarted when the page is visible and microphone mode remains active.
- The previous external-mic UI is repurposed in this development build to **PHONE MIC / PUHELINMIC**; `PHONE MIC ONLY` and `PHONE MIC + GPS FUSION` labels map onto the existing audio pipeline when those modes are explicitly selected.
- **GPS MASTER remains the recommended/default learning mode.** In that mode the smart phone RPM is shadow data only.
- Rich phone telemetry is attached to learning rows: smart RPM, raw RPM, corrected candidate, predicted RPM, RPM velocity, chosen harmonic ratio, confidence, candidate gap, runner-up, observed f0, RMS dB, harmonic count, H1–H6 data, top candidates, GPS-assist reference and hold/jump state.

## Full-trip 3rd-gear GPS + MIC research
- Build **2026-08-16k** added `trip_research.js` and the Measurement-screen panel **3. VAIHTEEN GPS + MIC TUTKIMUSAJO**.
- Starting research selects gear 3 and GPS MASTER + MIC LEARN; GPS remains the only RPM control authority.
- Historical BT estimator research exposed complete scored candidate sets for offline analysis.
- Candidate export format is compact: `[rpm, observedHz, rawRpm, correlation, fingerprintScore, totalScore, multiplier]`.
- Research timeline records GPS/speed-derived RPM reference, GPS confidence/accuracy, acceleration and timestamps at 5 Hz, plus timestamped candidate frames.
- Research data uses a separate `VanaMotoLabResearch` IndexedDB so normal runs and learning RAW storage are not disturbed.

## Automatic multi-phone research sync
- Build **2026-08-16l** added `research_sync.js` and **AUTO RESEARCH SYNC** in Settings.
- Each phone has a persistent `deviceId` plus editable **Kuski** and **Puhelin** labels, so simultaneous tests from different users/devices remain separate.
- Research sync is local-first: the phone keeps all research data in IndexedDB and retries automatically after network loss or later app reopening.
- Receiver endpoints: `/api/research/v1/start`, `/api/research/v1/data`, `/api/research/v1/audio`, `/api/research/v1/finish`.
- Read endpoints for analysis: `/api/research/v1/sessions` and `/api/research/v1/session`, protected by `READ_KEY`.
- Railway still needs the receiver deployment/environment configuration and a persistent Volume before automatic cloud collection is operational.

## Next RPM algorithm line
- Validate v32.5 Smart Phone RPM against GPS reference across acceleration, steady throttle and deceleration.
- Keep the working v3.6-style spectral information and compare smart tracker output to raw/top-candidate branches rather than replacing the signal extractor blindly.
- Accuracy goal is practical: normally about ±200 rpm, temporarily ±300 rpm acceptable, but x2 / ÷2 harmonic jumps are not acceptable.
- GPS-supervised learning should identify any persistent RPM-region bias before adding a piecewise calibration.
- Do not add a global scale correction without reference evidence.
- GPS MASTER remains authoritative until phone-mic validation is strong enough to deliberately change this rule.

## UI / usability
- `ui_compact.js` keeps the direct home-screen microphone control.
- In v32.5 the microphone control is presented as the phone microphone Smart RPM sensor.
- Settings panels are collapsible with **AVAA / SULJE** controls and remember their open/closed state locally.
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
- Preferred historical contact reference mounting: extension nut + aluminium shim + tightly coupled BT earbud/contact microphone.
- Strong reference: approximately 6600 rpm truth, 6591 rpm audio average, 92.2% confidence, f0 ~109–112 Hz, harmonics ~220/330/440/550/660 Hz.
- Keep older tests without the extension nut in a separate calibration set.

## Native iOS / AirPods motion research
- `ios/AirPodsMotionTest/` contains the native SwiftUI `CMHeadphoneMotionManager` test.
- GitHub Actions macOS CI builds the unsigned Simulator app without requiring the user to own a Mac.
- Real-device installation/code signing is postponed while Apple Developer enrollment is unresolved.
- AirPods motion remains experimental and is not a validated MotoLab RPM source.

## RAW / learning data
- Preserve raw/source-specific data separately from derived/fused values so old runs can be reprocessed with future algorithms.
- GPS MASTER learning rows include synchronized GPS reference and microphone shadow data.
- v32.5 adds full phone smart-tracker telemetry to learning rows without granting the phone mic control authority in GPS MASTER mode.
- Existing local-first RAW sync behavior is preserved; local RAW data is not deleted by auto sync.
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
Before merging measurement changes, preserve GPS, GPS MASTER + MIC LEARN, GPS ONLY, explicit phone-mic modes, continuous ARM AUTO multi-pull capture, AutoRide, manual run recording, run persistence, profiles, Knowledge Base, learning/raw data and RAW JSON export, full-trip research capture, automatic research sync, RAW auto sync, vehicle lookup, maintenance, compact Settings UI, DT startup profile, source-native release identity, version validation, PWA update behavior, and keep native AirPods motion experimental until validated on a real device.
