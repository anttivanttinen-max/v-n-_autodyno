# Proposed MotoLab integration boundary (not implemented)

No production MotoLab files are changed by this package.

## Sensor-hub adapter

Create a future development-only `RpmBtAdapter` that parses `MeasurementV1` and emits an immutable sample:

```text
source=rpm_bt_inductive
deviceTimestampMs, hostTimestampMs, seq
rpm, rawCandidateRpm, rawFrequencyHz
confidence, signal, valid, learningEligible
engineValidated, dropout, jumpRejected, harmonicAdjusted
```

The adapter owns BLE reconnect/backoff and sequence-gap accounting. It must not render UI or run FFT. The measurement worker consumes a bounded latest-sample queue so a slow UI cannot stall timing.

## Learning authority

During RPM learning:

1. GPS speed + selected gear/drivetrain calibration remains the authority and controls displayed/recorded reference RPM.
2. RPM-BT is shadow/reference evidence. Save synchronized deltas, ratio to GPS, confidence, flags and source.
3. Firmware `learningEligible` is always false in V1. A future host adapter may derive `learningEligible=true` only when the sensor is valid and calibrated, GPS quality is adequate, the selected gear is known, acceleration/shift/clutch/slip gates pass, timestamps are aligned, and external RPM agrees with the GPS reference inside a versioned threshold. It may not replace GPS authority in this phase.
4. Audio/contact rows additionally require `engineValidated`; absence means `learningEligible=false` regardless of numeric confidence.
5. Camera RPM remains disabled.

## UI proposal

Show a compact sensor badge: connection, RPM, confidence, validity, source and rejection reason. Use neutral `SHADOW` wording. Never display an invalid last value as live. Diagnostics may show sequence gaps and latency; normal measurement remains lightweight.

## Stored learning row additions

`rpmBtProtocolVersion`, `rpmBtSource`, `rpmBtSeq`, `rpmBtDeviceTimestampMs`, `rpmBtHostTimestampMs`, `rpmBtRpm`, `rpmBtRawCandidateRpm`, `rpmBtRawFrequencyHz`, `rpmBtConfidence`, `rpmBtSignal`, `rpmBtFlags`, `rpmBtValid`, `rpmBtLearningEligible`, `rpmBtDeltaToGps`, `rpmBtErrorPctToGps`, `rpmBtRatioToGps`.

## Integration gate

Only after `TEST_PROTOCOL.md` passes: implement behind an off-by-default development flag, run replay tests, then request explicit user permission before any production merge.

