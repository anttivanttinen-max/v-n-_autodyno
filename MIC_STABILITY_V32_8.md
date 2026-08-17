# VÄNÄ MotoLab v32.8 — iOS microphone stability correction

Updated: 2026-08-17

## Release
- Version: **v32.8**
- Build: **2026-08-17c-mic-stability**
- `sensor_persistence.js`: **sensor-persistence-v5**

## Confirmed regression in v32.6/v32.7 line
The microphone recovery watchdog used `globalThis.MOTOLAB_AUDIO_LAST?.t` as a frame-freshness signal. Repository inspection showed that this timestamp was not a reliable producer-backed health signal in the active line. A live microphone track could therefore be treated as stale and the recovery path would destructively call `stopAudio()` followed by `startAudio()`, causing the observed repeated microphone OFF/ON cycle.

## v32.8 correction
- Removed `audio_frames_stale` as a destructive reconnect trigger.
- A live, enabled audio track on an active stream is now authoritative for the persistence watchdog.
- Automatic destructive recovery remains enabled when the microphone track is genuinely non-live / ended.
- Existing bounded retry/backoff remains in place for genuine recovery failures.
- Existing manual **MIC RECOVERY • PALAUTA MIKROFONI** user-gesture path remains available.
- `ended`, `mute`, `unmute`, `devicechange` and visibility transitions remain observed.

## Safety / regression constraints
This change does **not** alter:
- GPS MASTER authority,
- displayed RPM source selection,
- run acceptance,
- gear learning authority,
- Smart Phone RPM candidate selection,
- adaptive RPM learning,
- dyno power/torque calculations,
- RAW storage/replay,
- vehicle/maintenance databases,
- diagnostics collection.

## Validation still required
Field-test on iPhone and confirm:
1. A live microphone remains continuously ON instead of cycling OFF/ON.
2. A genuinely ended/disconnected track still triggers recovery.
3. Recovery events are recorded by persistent diagnostics/RAW.
4. GPS and IMU remain unaffected during microphone failure/recovery.

## Deployment state at implementation time
The GitHub/Railway deployment status for commit `04230876a5844d71ad06e86c3ab077584c7ba2b2` was still **pending** when this note was written.
