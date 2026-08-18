# MotoLab Black Box + Replay

Purpose: keep every run reproducible. A Black Box session stores the raw evidence first, then builds indexes and replay streams on top of it. Old rides can be reprocessed later with newer RPM, GPS, gear-learning, knock or Zeeltronic logic without riding again.

Status: design + first tooling scaffold. This does not change the production MotoLab app.

## Core rules

- Raw data is immutable. Never overwrite original sensor streams.
- Every derived result must reference the session, stream, byte/time range and algorithm version that produced it.
- GPS remains the authority during RPM-learning. External RPM sensors can become learning-eligible only after plausibility and agreement checks.
- Camera RPM stays excluded.
- Audio/microphone RPM is not learning-eligible until the signal itself is verified as real engine sound.
- Measurement continuity and low overhead are priority number one.

## Session layout

```text
blackbox/<session_id>/
  manifest.json
  streams/
    gps.jsonl
    imu.jsonl
    rpm_external.jsonl
    rpm_audio_candidates.jsonl
    zeeltronic.jsonl
    knock.jsonl
    app_events.jsonl
  raw/
    original files copied or referenced here
  derived/
    replay.timeline.jsonl
    diagnostics.json
    indexes.json
    algorithm_runs/<algorithm_id>/result.json
```

## Manifest minimum

```json
{
  "schema": "motolab_blackbox_session_v1",
  "session_id": "2026-08-18T20-00-00Z-bike-dt170",
  "created_utc": "2026-08-18T20:00:00Z",
  "bike_profile_id": "dt170",
  "app_build": "unknown",
  "sources": [
    {"name":"gps", "path":"streams/gps.jsonl", "timebase":"utc_ms"},
    {"name":"rpm_external", "path":"streams/rpm_external.jsonl", "timebase":"utc_ms"}
  ],
  "rules": {
    "gps_authority_for_learning": true,
    "camera_rpm_enabled": false,
    "raw_is_immutable": true
  }
}
```

## Replay model

Replay emits a single ordered timeline:

```json
{"t_ms": 1234, "source":"gps", "payload": {"speed_kmh": 52.1, "lat": 0, "lon": 0}}
{"t_ms": 1240, "source":"rpm_external", "payload": {"rpm": 6120, "confidence": 0.94}}
```

The MotoLab measurement engine should later be able to consume this stream exactly like live sensor input.

## Milestones

1. Session schema and file layout.
2. Import existing RAW/JSONL/CSV files into a Black Box session.
3. Build unified timeline and indexes.
4. Replay timeline into a test harness.
5. Compare algorithm A vs B on the same session.
6. Add UI only after the engine is proven.

## Test criteria

- Import never mutates original files.
- Replay ordering is stable and deterministic.
- Same session + same algorithm version produces identical output.
- Diagnostics can explain why data was rejected from learning.
- Missing streams do not break replay; they produce warnings.
