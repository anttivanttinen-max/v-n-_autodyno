# VÄNÄ MotoLab — Fusion Master v1 shadow

Status: development / shadow only
Branch: `dev/v34-fusion-shadow-v1`
Base: `release/v34.0-2026-08-17`
Module: `sensor_fusion_shadow.js` / `motolab-sensor-fusion-shadow-v1`

## Goal

Combine GPS, RPM/audio, phone IMU and phone orientation/rotation evidence dynamically. No fixed source percentages are used. Each source receives a moment-by-moment confidence and the shadow fusion weights change with sensor quality and cross-sensor agreement.

## Authority invariant

Fusion v1 is strictly observational.

- It does not write the displayed RPM.
- It does not change GPS MASTER authority.
- It does not control run acceptance.
- It does not change Auto Gear Learn.
- It does not write dyno power/torque calculations.
- It does not start/stop GPS, microphone or IMU.
- It does not change sensor settings.

Only after real-device RAW/replay validation may a later version be considered for measurement authority.

## Sources

### GPS

GPS is the absolute speed anchor. Confidence is reduced by poor reported accuracy and implausible single-sample acceleration spikes. A bad spike is not allowed to dominate the shadow state.

### RPM / audio

RPM confidence starts from the current MotoLab RPM confidence. When a gear ratio is known, RPM is converted to an independent speed estimate and compared with GPS. Large disagreement lowers RPM confidence. Audio candidate-gap information is also used when available so a likely harmonic branch does not dominate the fusion.

### IMU

The module records phone acceleration, acceleration including gravity and rotation rate at source event rate. A vehicle-forward axis is learned only during periods where GPS and phone mounting are sufficiently trustworthy. Until the forward axis is learned, IMU remains low-confidence observational evidence.

### Phone mounting / pocket detection

A rolling approximately 2.2 s window evaluates:

- rotation RMS,
- gravity-vector direction jitter,
- acceleration-magnitude jitter.

The resulting mount state is one of:

- `fixed`
- `unstable`
- `pocket_suspected`
- `imu_unavailable`

When `pocket_suspected` is active, IMU fusion confidence is capped near zero. The fusion therefore falls back toward GPS and RPM instead of treating body/pocket movement as motorcycle acceleration.

This rule was added because the 2026-08-17 long learning-data ride contains a second ride where the phone was carried in a pocket.

## Shadow outputs

The latest state is exposed as:

- `globalThis.MOTOLAB_FUSION_SHADOW`
- `globalThis.MOTOLAB_FUSION_SHADOW_API`
- browser event `motolab-fusion-shadow`

Each state includes raw source observations, source confidences, normalized weights, mount confidence/state, reason codes and shadow speed/acceleration/RPM/gear values.

## Research storage

Shadow samples are written locally to IndexedDB database `VanaMotoLabFusionShadow`, store `chunks`, about 10 Hz and 300 samples/chunk. This storage is separate from current measurement/run storage and cannot change measurement results.

The API provides:

- `snapshot()`
- `exportData()`
- `clearData()`
- `setEnabled(boolean)`
- `isEnabled()`

## Historical-data limitation

The previously exported long learning JSON contains acceleration/motion summary values but not enough raw phone rotation/gravity-vector history to validate pocket classification retrospectively. Therefore pocket detection must be validated on the next real iPhone ride. New Fusion v1 recording preserves the raw motion fields needed for that validation.

## Next validation

1. Fixed phone mount ride: verify mount state remains `fixed` and forward axis converges.
2. Pocket ride: verify state changes to `unstable` / `pocket_suspected` and IMU weight approaches zero.
3. GPS spike test: verify GPS weight drops briefly without destabilizing shadow speed.
4. Audio harmonic jump: verify RPM weight drops when RPM-derived speed conflicts with GPS/gear.
5. Normal acceleration: compare shadow speed/acceleration against current GPS MASTER and RAW replay.
6. No authority regression: displayed RPM, run acceptance, gear learning and dyno result must remain identical with shadow enabled vs disabled.
