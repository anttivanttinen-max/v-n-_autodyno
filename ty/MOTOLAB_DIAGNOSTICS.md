# VÄNÄ MotoLab — persistent diagnostics

Updated: 2026-08-17

## Purpose
MotoLab v32.7 adds an always-on, non-authoritative diagnostics layer. It must never change GPS/RPM/gear/dyno decisions. Its job is to preserve enough state to reconstruct what happened before crashes, freezes, sensor failures, reconnect storms, queue stalls and network/sync failures.

## Module
- File: `diagnostics.js`
- Module id: `motolab-diagnostics-v1`
- Persistent local ring: `motolab_v32_diagnostics_ring`
- Session marker: `motolab_v32_diagnostics_session`
- Heartbeat: `motolab_v32_diagnostics_heartbeat`
- Ring capacity: last 500 diagnostic events.

## Captured error classes
- `window.error` including filename, line, column, message and stack when available.
- `unhandledrejection` including rejection name/message/stack.
- `console.error` and `console.warn` mirrors.
- Failed `fetch()` calls and HTTP responses with non-OK status.
- Previous session left unclean / no reliable clean shutdown marker.
- Network online/offline transitions.
- Service Worker controller changes and error/fail/queue/sync messages when emitted.
- Media-device changes.

## Captured application/event context
- Central `addLearningEvent` traffic is mirrored into the diagnostics ring without changing the original call result.
- Visibility/page lifecycle transitions are recorded.
- `motolab-audio-candidates` activity is recorded as an application event.
- Desired and observed GPS/IMU/microphone state is attached to diagnostic events where available.
- Microphone track state includes readyState, enabled, muted and label where available.

## Queue diagnostics
The diagnostics layer snapshots all known persistent queue stores and also scans localStorage for other keys containing `queue`. It records queue length/pending count plus safe status metadata such as sent count, last success and last error. It intentionally does not copy authentication secrets or arbitrary queue payloads.

Known queue keys include at least:
- `motolab_v32_raw_sync_queue`
- `motolab_v32_research_sync_queue`
- `motolab_v32_sensor_autostart_queue`

Queue state is sampled periodically and only written again when it changes, plus at important lifecycle transitions.

## Crash persistence and RAW replay
Diagnostic events are written immediately to localStorage and carry `rawMirrored=false` until mirrored into the normal MotoLab learning/RAW event stream. When `addLearningEvent` is available, pending diagnostic records are replayed in bounded batches as `diagnostic_replay` events. This allows events that survived an abrupt crash locally to enter the normal RAW pipeline on a later successful boot.

A heartbeat is refreshed while the app is alive. `pagehide` is not treated as proof of a clean exit because iOS may background and later kill the PWA. `beforeunload`, when actually delivered, is the clean-shutdown marker. A later boot can therefore emit `previous_session_unclean` with the previous heartbeat, sensor snapshot and queue state.

## Safety / non-interference rule
Diagnostics is observational only. It must not influence:
- GPS MASTER authority,
- displayed RPM,
- run acceptance,
- gear learning,
- adaptive RPM candidate choice,
- dyno calculations,
- sensor recovery decisions.

If diagnostics itself fails, its writes are wrapped so normal MotoLab operation should continue.

## v32.6 microphone reconnect regression retained separately
Immediately after v32.6 field use, the microphone was observed repeatedly toggling off/on. Code inspection found the v32.6 watchdog checked `MOTOLAB_AUDIO_LAST`, but that producer does not exist in the repository, so a live microphone could be treated as stale and unnecessarily recreated. This is a separate open microphone-stability regression and must not be hidden by the diagnostics work. The intended correction is to avoid destructive fresh-stream recovery solely because of the invalid frame-stale signal and reserve teardown/recreation for a genuinely non-live/ended track or another validated stall signal.
