# RPM do-no-harm guard validation — 2026-08-19

## Scope

Validation target: `adaptive_rpm_learning.js` v2.1 on branch `sprint/rpm-stuck-branch-guard-20260818`.

The change is intentionally limited to adaptive microphone RPM candidate selection. It does not change the measurement worker contract, GPS-master authority, calibration storage, RAW learning bank, vehicle/gear data, dyno views, export, or later RAW replay interfaces.

## Guard behavior

The existing correction set remains `0.5x / 0.75x / 1x / 1.25x / 2x`.

When the raw best candidate is an intermediate `0.75x` or `1.25x` branch, the new guard compares it to the best `1x` candidate:

- stuck-branch state may still use the intermediate branch immediately;
- without GPS, an intermediate branch is blocked and the best `1x` branch is preferred;
- with GPS, the intermediate branch needs a material GPS-score gain (`>= 0.08`) while retaining score advantage;
- if the `1x` branch is already weak (`gpsScore < 0.50`), a smaller GPS gain (`>= 0.04`) is enough;
- guard decisions are written to RAW learning rows as `adaptiveGuardedFrom` and `adaptiveGuardReason` for later replay/debugging.

## Offline regression replay

Dataset: 2026-08-17 MotoLab learning export, 63,522 total samples, 4,763 frames with usable simultaneous GPS reference and phone/audio candidates.

Baseline stuck-v2:

- within ±5%: 11.78%
- within ±10%: 18.92%
- median absolute RPM error: 70.11%
- frames where yesterday tracker was within ±10% but v2 moved beyond ±20%: 21
- frames rescued from >20% yesterday error to within ±10%: 510

v2.1 do-no-harm guard:

- within ±5%: 12.95%
- within ±10%: 20.32%
- median absolute RPM error: 69.02%
- frames where yesterday tracker was within ±10% but v2.1 moved beyond ±20%: 3
- frames rescued from >20% yesterday error to within ±10%: 545

Result: the guard improves both ±5% and ±10% hit rate while reducing severe regressions against already-good frames by about 86% (21 -> 3). It therefore passes this offline regression gate.

## Important limitation

This is not a claim that microphone RPM is finished. The full-data median error remains high because several sweeps still track the wrong spectral branch for long periods. The next work item is to improve candidate formation/tracking and separately harden learned band publication so a locally learned model cannot reduce blind-test accuracy.

## Release status

Keep this change on the sprint branch. Do not merge/deploy to the production/main application until field validation confirms the guard does not degrade the previously accurate engine-audio sweeps.