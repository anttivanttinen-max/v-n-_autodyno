# VÄNÄ MotoLab — shared development sync status

Updated: 2026-08-16

## Current application line
- Active published line: **v32.4** on `main`.
- v31 remains the historical core baseline; v32.x modules are now integrated into the published PWA shell.
- Release identity is **source-native**: `version.js` is the shared release source for the app shell and Service Worker, and `index.html` itself identifies as v32.4 rather than relying on Service Worker banner rewriting.
- The app has an explicit **UUSI MOTOLAB-VERSIO SAATAVILLA → PÄIVITÄ NYT** flow.
- Permanent GitHub Actions validation is version-agnostic.

## Measurement strategy
- First road-test phase uses **GPS MASTER + MIC LEARN**.
- GPS/speed + selected gear is the control RPM authority.
- BT/contact microphone is a shadow/learning sensor and must not alter displayed RPM, run acceptance, or gear learning in this mode.
- GPS reference RPM can come from saved gear calibration or calculated drivetrain data.
- Camera RPM remains disabled.
- Phone internal microphone remains unvalidated as an RPM source.

## ARM AUTO / multi-pull capture
- **v32.4 fixes ARM AUTO as a persistent session.** One ARM AUTO press remains active across multiple pulls.
- Every detected pull is completed and saved as its own run; no new ARM press is required between pulls.
- Re-arm uses cooldown/reset hysteresis and clears the pre-buffer so the previous pull tail is not merged into the next pull.
- **STOP explicitly ends/disarms the continuous ARM AUTO session.**

## Pull comparison rule
- Development comparisons should primarily show change relative to the **previous MotoLab pull**, treated as the 100% reference.
- PerfExpert results can be compared against the same previous MotoLab reference so absolute calibration differences do not hide whether performance improved or worsened.
- Compare peak power, peak torque and useful-range/curve performance, not only one peak point.

## Contact RPM reference
- Preferred reference mounting: extension nut + aluminium shim + tightly coupled BT earbud/contact microphone.
- Strong reference: approximately 6600 rpm truth, 6591 rpm audio average, 92.2% confidence, f0 ~109–112 Hz, harmonics ~220/330/440/550/660 Hz.
- Keep older tests without the extension nut in a separate calibration set.

## Native iOS / AirPods motion research
- `ios/AirPodsMotionTest/` contains the native SwiftUI `CMHeadphoneMotionManager` test.
- GitHub Actions macOS CI builds the unsigned Simulator app without requiring the user to own a Mac.
- Real-device installation/code signing is postponed while Apple Developer enrollment is unresolved.
- AirPods motion remains experimental and is not a validated MotoLab RPM source.

## RAW / learning data
- Preserve raw/source-specific data separately from derived/fused values so old runs can be reprocessed with future algorithms.
- GPS MASTER learning rows include synchronized GPS reference and MIC shadow data.
- RAW AUTO SYNC is integrated and remains local-first; auto sync never deletes local RAW data.
- **RAW JSON export is now integrated in `raw_sync.js` (`v32-raw-auto-sync-2`).** Settings → RAW AUTO SYNC contains **VIE RAW DATA • JSON**.
- Export gathers all local learning/RAW chunks into `motolab_raw_export_v1`, includes release/device metadata, and opens the iPhone share sheet when file sharing is supported; otherwise it downloads the JSON file.
- This export works without the RAW receiver and is the immediate path for inspecting rejected pulls and learning data.
- No ingest/read secrets are committed to the public repository.

## RAW receiver
- Receiver implementation lives in `raw_sync_server/`.
- Deployment is still required before phone-to-server RAW upload can operate.

## Vehicle / maintenance work
- Vehicle lookup includes Yamaha DT125R and Derbi Senda 50 families and editable drivetrain data.
- Technical-spec editor and maintenance/history modules are active.
- Vehicle lookup / technical-spec refresh fixes from v32.3 must be preserved.

## Cross-thread synchronization rule
- Both MotoLab conversations use this repository/status file as the shared implementation state.
- Before new implementation work, check the latest decisions/test results from both MotoLab threads when available.
- After implementation, update the shared repository/status so the other thread inherits the same decisions and code state.

## Regression rule
Before merging measurement changes, preserve GPS, GPS MASTER + MIC LEARN, BT MIC, GPS ONLY, AUTO FUSION, continuous ARM AUTO multi-pull capture, AutoRide, manual run recording, run persistence, profiles, Knowledge Base, learning/raw data and RAW JSON export, RAW auto sync, vehicle lookup, maintenance, source-native release identity, version validation, PWA update behavior, and keep native AirPods motion experimental until validated on a real device.
