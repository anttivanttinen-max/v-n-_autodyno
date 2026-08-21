# MotoLab legacy replay baseline

Date: 2026-08-21
Status: permanent project requirement

## Requirement

Every new MotoLab / AutoDyno dataset must remain replayable with the best previously validated analysis method, unchanged, in addition to any newer analysis methods.

The legacy method must never be silently replaced by a new algorithm. New algorithms are additive and are compared side-by-side against the frozen legacy baseline.

## Why

Historical analysis already reached very strong RPM results on validated engine-audio data. Those results are a regression baseline. If a new algorithm performs worse on the same data, that must be visible immediately. Likewise, new datasets must be processed by the same legacy rules so their performance can be compared directly with historical datasets.

## Legacy replay contract

For every dataset, retain and run:

1. The original RAW / ZIP input unchanged.
2. The frozen legacy replay implementation and exact version/commit SHA.
3. The exact legacy configuration and thresholds.
4. The candidate/harmonic multiplier set used by that baseline.
5. GPS-master / reference selection rules.
6. Audio validity rules, including the requirement that learning/reference audio must be real engine audio.
7. Confidence thresholds and sample-selection filters.
8. Continuity, acceleration and gear-change interpretation rules used by the baseline.
9. All output metrics, including sample counts, median error, percentile errors and acceptance-band hit rates.
10. Rejection reasons and excluded samples.

## Mandatory comparison flow

Every new dataset must produce at least two result families:

- `legacy-baseline`: frozen, previously validated method, no behavioral changes.
- `current-candidate`: newest method under development.

Both must use the same source data and produce comparable metrics. Historical baseline outputs are never overwritten.

## Versioning

If the legacy method needs a bug fix, do not mutate the old baseline. Create a new named baseline version and keep both reproducible.

Example naming:

- `legacy-rpm-replay-v1`
- `legacy-rpm-replay-v1.1-fixed`
- `current-rpm-replay-vN`

## Regression gate

A new method is not considered better merely because it looks better on one new ride. It must be compared against the frozen legacy baseline on both historical validated datasets and new datasets.

The legacy baseline therefore remains permanently runnable against future RAW data.
