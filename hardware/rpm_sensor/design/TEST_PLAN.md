# RPM sensor v1 — test plan and acceptance criteria

## Test hierarchy

### 1. Bench and synthetic

- Inject sine/harmonic families, sweeps, amplitude changes, clipping, noise and deliberate 0.5x/2x distractors.
- Feed inductive conditioner with pulse trains covering the expected RPM/pulses-per-rev range, bounce and missing/extra pulses.
- Verify timestamps, timer overflow handling, CRC, sequence gaps, reset/boot ID and RAW replay determinism.
- Stress BLE disconnect/reconnect and slow storage while acquisition continues.

### 2. Engine-off and stationary engine

- Capture engine-off noise, touch/cable-strike/frame vibration and radio activity.
- Repeat the documented extension-nut/aluminium-shim BT contact measurement.
- Run the wired contact sensor and inductive pickup simultaneously at idle and safe stepped holds.
- Confirm the contact signature changes with engine speed and contains a coherent family; do not admit it to learning based on audio level alone.

### 3. Mount repeatability

- Remove/remount at least three times with recorded orientation/torque class.
- Compare resonance, candidate ranking, latency, gain/noise and RPM error.
- Repeat after a thermal cycle and inspect witness marks/cable strain.

### 4. GPS-master road validation

- Use known gear and good GPS conditions. GPS/profile RPM is control authority; contact/inductive channels are shadow-only.
- Include steady segments, roll-on/roll-off, shifts, clutch operation and natural vibration/noise disturbances.
- Keep poor-GPS, wheel-slip, unknown-gear and shift windows labelled and out of numerical accuracy scoring.
- Split calibration and held-out sessions by ride/remount; never validate on the same windows used to choose multipliers.

## Required logged evidence

Device RAW/features/decisions, boot/config/calibration IDs, BLE loss, phone receive time, time-sync uncertainty, GPS speed/accuracy, selected gear, drivetrain-derived reference, setup signature, mount metadata and operator event labels. Preserve rejected and invalid samples.

## Acceptance criteria for v1 reference candidate

All criteria apply before requesting production integration:

- Acquisition continuity: >=99.9% expected summary frames over each 20-minute test; no unexplained device clock reversal; all gaps/reset boundaries explicit.
- BLE resilience: a 60-second disconnect causes no acquisition stop and all locally retained summaries/RAW indexes are recoverable afterward.
- Contact engine verification: coherent speed-following fundamental/harmonic family in at least three RPM regions and two separate mounts; engine-off/cable-strike controls do not pass the same verification.
- Accuracy in eligible held-out GPS-master windows: median absolute percentage error <=1.5%, 95th percentile <=4%, and >=98% within 5% of GPS-derived reference.
- Gross errors: zero accepted 0.5x/2x harmonic errors lasting >200 ms; zero accepted impossible jumps. Rejected/invalid is preferable to a wrong reference.
- Dropout behavior: no measured flag during held prediction; prediction <=150 ms; invalid thereafter.
- Latency: stable sensor-to-frame group delay documented, jitter <=20 ms p95 after device/phone time alignment.
- Confidence calibration: >=95% of frames at confidence >=90 are within 3% in eligible held-out windows; low-quality/disturbed cases lower confidence or become invalid.
- Independent agreement: inductive/contact median disagreement <=1% in stable stationary/road windows after pulses-per-rev calibration.
- Remount robustness: each accepted remount independently meets <=3% median error without hand-selecting a new harmonic multiplier per run.
- Resource health: no acquisition queue overrun, watchdog reset or storage corruption in the 20-minute test; feature processing remains within measured CPU/memory budget.
- Traceability: every published frame links to config/calibration and a RAW chunk or explicit no-RAW reason; offline replay reproduces decisions within integer rounding.

The documented ~6600 -> 6591 rpm / ~92.2% contact result is a baseline expected to repeat, not a substitute for these criteria.

## Stop/reject conditions

Stop vehicle testing on loose mount, changed witness mark, unsafe temperature, damaged insulation, unexpected ignition coupling, repeated resets or cable proximity to moving/hot parts. Reject a session for missing setup/mount identity, unsynchronized clocks, unversioned configuration, unverifiable engine signature or materially poor GPS authority.

