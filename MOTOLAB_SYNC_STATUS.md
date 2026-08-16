# VÄNÄ MotoLab — shared development sync status

Updated: 2026-08-16

## Current application line
- Active published line: **v32.3** on `main`.
- v31 remains the historical core baseline; v32.x modules are now integrated into the published PWA shell.

## Measurement strategy
- First road-test phase uses **GPS MASTER + MIC LEARN**.
- GPS/speed + selected gear is the control RPM authority.
- BT/contact microphone is a shadow/learning sensor and must not alter displayed RPM, run acceptance, or gear learning in this mode.
- GPS reference RPM can come from saved gear calibration or calculated drivetrain data when primary ratio, gear ratio, final drive, and wheel circumference are available.
- Camera RPM remains disabled.
- Phone internal microphone remains unvalidated as an RPM source.

## Contact RPM reference
- Preferred reference mounting: extension nut + aluminium shim + tightly coupled BT earbud/contact microphone.
- Strong reference: approximately 6600 rpm truth, 6591 rpm audio average, 92.2% confidence, f0 ~109–112 Hz, harmonics ~220/330/440/550/660 Hz.
- Keep older tests without the extension nut in a separate calibration set.

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
Before merging measurement changes, preserve GPS, GPS MASTER + MIC LEARN, BT MIC, GPS ONLY, AUTO FUSION, AutoRide, manual run recording, run persistence, profiles, Knowledge Base, learning/raw data, RAW auto sync, vehicle lookup, maintenance, and PWA update behavior.
