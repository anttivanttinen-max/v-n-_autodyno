# RPM sensor — superseded contact-first roadmap

> The active non-contact inductive V1 roadmap is [`hardware/rpm_bt_sensor/ROADMAP.md`](../../rpm_bt_sensor/ROADMAP.md). Contact vibration and BT microphone remain research/fallback only.

## Phase 0 — evidence freeze (now)

- Keep the documented extension-nut/aluminium-shim/AirPod observation as its own reference cohort.
- Freeze requirements, RAW fields, BLE v1 draft and acceptance gates.
- No production MotoLab code changes.

## Phase 1 — bench proof

- Select contact sensor/front end after oscilloscope captures; build one ESP32-S3 node and protected inductive conditioner.
- Implement DMA/timer capture, append-only chunk log, replay fixtures and synthetic harmonic/jump/dropout tests.
- Exit: deterministic replay, no acquisition loss under BLE/storage stress, electrical/mechanical safety review complete.

## Phase 2 — stationary comparison

- Repeat BT contact baseline and collect wired contact + inductive data at safe stepped RPM.
- Validate engine-signature gate, pulses-per-rev hypotheses, clipping limits and remount/thermal behavior.
- Exit: signal verified as engine-related across multiple RPM regions and two mounts; unsafe/ambiguous channels fail closed.

## Phase 3 — GPS-master shadow road tests

- Developer recorder joins device monotonic time to GPS/profile RPM and selected gear.
- Run calibration and held-out sessions. Sensor has no control authority and cannot teach gear ratios.
- Exit: numerical, continuity, harmonic and confidence acceptance criteria in TEST_PLAN.md met.

## Phase 4 — user-specific learning evaluation

- Train versioned per-profile/mount priors offline from accepted data only.
- Evaluate promotion/rollback and confidence reliability on held-out rides and remounts.
- Exit: learned model improves or preserves gross-error rate and accuracy; no unverified audio or GPS-invalid sample enters training.

## Phase 5 — integration decision gate

- Present evidence, BOM revision, risks, resource budget and replayable sessions to the user.
- Only explicit user approval can authorize a developer MotoLab adapter or any move toward production.
- Initial approved integration, if any, remains shadow/reference mode with a kill switch and rollback.

## Open decisions after measurements

- ADXL1002-class sensor versus piezo cost-down path.
- MCU ADC versus external ADC based on measured ENOB/jitter.
- Exact analog filter corner/gain and sample rate.
- Inductive probe geometry, comparator/isolation details and pulses-per-rev handling by ignition type.
- RAW retention size and CBOR versus packed binary transport.

## Deliverables checklist

- Schematics/PCB and mechanical drawing with mount safety notes.
- Firmware source, protocol constants, decoder and replay tests.
- Versioned example RAW session and metadata schema.
- Bench/stationary/GPS-master reports against fixed criteria.
- Integration proposal kept separate from production MotoLab until approval.

