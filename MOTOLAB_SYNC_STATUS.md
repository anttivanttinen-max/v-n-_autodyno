# VÄNÄ MotoLab — shared development sync status

Updated: 2026-08-16

## Current application line
- Active published line: **v32.4** on `main`.
- v31 remains the historical core baseline; v32.x modules are now integrated into the published PWA shell.
- Release identity is **source-native**: `version.js` is the shared release source for the app shell and Service Worker, and `index.html` itself identifies as v32.4 rather than relying on Service Worker banner rewriting.
- The app has an explicit **UUSI MOTOLAB-VERSIO SAATAVILLA → PÄIVITÄ NYT** flow. A newly installed Service Worker waits until the user accepts the update, then the app reloads on `controllerchange`.
- Permanent GitHub Actions validation is version-agnostic and checks the release identity, old v31 runtime/SW identifiers, Service Worker syntax, and inline application JavaScript syntax.

## Measurement strategy
- First road-test phase uses **GPS MASTER + MIC LEARN**.
- GPS/speed + selected gear is the control RPM authority.
- BT/contact microphone is a shadow/learning sensor and must not alter displayed RPM, run acceptance, or gear learning in this mode.
- GPS reference RPM can come from saved gear calibration or calculated drivetrain data when primary ratio, gear ratio, final drive, and wheel circumference are available.
- Camera RPM remains disabled.
- Phone internal microphone remains unvalidated as an RPM source.

## ARM AUTO / multi-pull capture
- **v32.4 fixes ARM AUTO as a persistent session.** One ARM AUTO press must remain active across multiple pulls.
- Every detected pull is completed and saved as its own run; no new ARM press is required between pulls.
- After an automatic stop, the worker keeps the auto session armed but blocks retriggering through a short re-arm hysteresis/reset phase.
- Re-arm becomes ready after the cooldown and when acceleration has settled or RPM has dropped sufficiently, and the pre-buffer is cleared so the previous pull tail is not merged into the next pull.
- **STOP explicitly ends/disarms the continuous ARM AUTO session.** Manual run mode and cancel also reset the auto session.
- Auto-run mode labeling is based on the actual completed mode, so a stopped auto pull is not mislabeled as a manual run.

## Contact RPM reference
- Preferred reference mounting: extension nut + aluminium shim + tightly coupled BT earbud/contact microphone.
- Strong reference: approximately 6600 rpm truth, 6591 rpm audio average, 92.2% confidence, f0 ~109–112 Hz, harmonics ~220/330/440/550/660 Hz.
- Keep older tests without the extension nut in a separate calibration set.

## Native iOS / AirPods motion research
- `ios/AirPodsMotionTest/` now contains a native SwiftUI test app for `CMHeadphoneMotionManager`.
- The test reports `isDeviceMotionAvailable`, Core Motion authorization, active state, and live user acceleration, gravity, rotation rate and attitude values when supported.
- `NSMotionUsageDescription` is included as required by iOS.
- GitHub Actions macOS CI generates the Xcode project with XcodeGen and successfully builds an unsigned iOS Simulator app, so source/build validation does not require the user to own a Mac.
- A real iPhone is still required to determine whether the connected AirPods 2 actually exposes headphone motion.
- Real-device installation requires Apple code signing; no signing certificates, private keys or provisioning profiles are stored in the public repository.
- This native test is separate from the current PWA measurement logic; AirPods motion is not treated as a validated MotoLab RPM source until real-device testing succeeds.

## RAW / learning data
- Preserve raw/source-specific data separately from derived/fused values so old runs can be reprocessed with future algorithms.
- GPS MASTER learning rows include synchronized GPS reference and MIC shadow data.
- **RAW AUTO SYNC is now integrated**: local-first chunk storage, upload queue, retry/backoff, queue-all-local, receiver test, and manual sync-now.
- Auto sync never deletes local RAW data.
- No ingest/read secrets are committed to the public repository.

## RAW receiver
- Receiver implementation lives in `raw_sync_server/`.
- Zero-dependency Node service, idempotent chunk writes, separate `INGEST_KEY` and `READ_KEY`, restricted CORS, persistent data directory support.
- Deployment target can be Railway or another HTTPS Node host.
- Deployment is still required before phone-to-server RAW upload can operate.
- Once a receiver URL and ingest key are configured in MotoLab, new chunks can upload automatically. A separate read endpoint exists for automated analysis access.

## Vehicle / maintenance work
- Vehicle lookup includes Yamaha DT125R and Derbi Senda 50 families and editable drivetrain data.
- Technical-spec editor and maintenance/history modules are active.
- Vehicle lookup / technical-spec refresh fixes from v32.3 must be preserved in all subsequent branches.

## Regression rule
Before merging measurement changes, preserve GPS, GPS MASTER + MIC LEARN, BT MIC, GPS ONLY, AUTO FUSION, continuous ARM AUTO multi-pull capture, AutoRide, manual run recording, run persistence, profiles, Knowledge Base, learning/raw data, RAW auto sync, vehicle lookup, maintenance, source-native release identity, version validation, PWA update behavior, and keep native AirPods motion experimental until validated on a real device.
