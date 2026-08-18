# Black Box + Replay Roadmap

## Phase 0 — Current scaffold

- `blackbox_replay.py create-session` creates immutable session folders.
- Source files are hashed and optionally copied into `raw/`.
- JSONL/CSV sources can be merged into `derived/replay.timeline.jsonl`.
- Binary RAW sources are indexed and preserved, but not decoded unless a stream adapter is later added.

## Phase 1 — Import adapters

Add adapters for existing MotoLab data formats:

- GPS/IMU live samples
- run summary and pull metadata
- RPM-BT sensor JSONL/CSV
- Zeel Capture JSONL/CSV/RAW
- mic/audio RPM candidate dumps
- knock sensor logs

Each adapter must output the unified replay event shape:

```json
{"t_ms":0,"source":"gps","payload":{},"source_file":"...","source_index":0}
```

## Phase 2 — Measurement-engine replay

Add a replay sink that feeds events into the measurement engine with the same interface as live sensors. This must run offline on a laptop and be deterministic.

Acceptance:

- Same input session + same algorithm build -> same result hash.
- Missing source streams produce warnings, not crashes.
- UI lag cannot affect replay result.

## Phase 3 — Algorithm comparison

Run algorithm A and B on the same session and write:

```text
derived/algorithm_runs/<algorithm_id>/result.json
derived/algorithm_runs/<algorithm_id>/diagnostics.json
derived/compare/<A>_vs_<B>.json
```

Compare:

- RPM trace differences
- gear-learning differences
- run start/end detection
- power/torque estimate changes
- rejection reasons and confidence

## Phase 4 — Black Box export from app

MotoLab app should later export a single `.motolab-blackbox.zip` containing manifest, streams, raw evidence and diagnostics. Do not integrate until explicitly approved.

## Safety / learning gates

- GPS remains authority during RPM learning.
- External RPM can be learning-eligible only after reference agreement.
- Audio requires engine-signal validation.
- Camera RPM remains disabled.
- Every derived result stores algorithm version and source references.

## Immediate next test

Create a test session from an existing Zeel Capture CSV or JSONL:

```powershell
python tools/black_box_replay/blackbox_replay.py create-session --output C:\MotoLabBlackBox --session-id test1 --source zeel=C:\path\timeline.csv --copy-raw
python tools/black_box_replay/blackbox_replay.py build-timeline C:\MotoLabBlackBox\test1
python tools/black_box_replay/blackbox_replay.py replay C:\MotoLabBlackBox\test1\derived\replay.timeline.jsonl --limit 20
```
