# Zeeltronic autotune and learning design

Status: offline suggestion design only. Initial versions never write to Zeeltronic and never silently alter a map.

## Safety invariants

- GPS remains the RPM learning authority. Selected gear and drivetrain/gear calibration produce the reference RPM.
- Camera RPM is excluded.
- Audio RPM is shadow-only and excluded from training/features until its saved raw audio is verified to contain a real engine-correlated signal under a documented validation procedure. Metadata or an RPM estimate alone is insufficient.
- Knock is a safety signal, not permission to advance timing when absent.
- Only evidence-backed Zeeltronic snapshots participate; unknown map meaning or incompatible model/firmware blocks suggestions.
- Suggestions require operator review. There is no automatic write path initially.

## Aligned timeline

Create an immutable `learning_run` manifest linking the original run, GPS, GPS-derived RPM, selected gear, knock, Zeeltronic snapshot/timing map and optional raw audio. Preserve each source clock and alignment transform.

Use monotonic run time as the analysis axis. Estimate clock offset and drift from shared start markers/events; record method, residual error and confidence. Resample only into a derived view. Retain original samples, missingness and interpolation flags. Map each sample to the active ignition/YPVS point or interpolation region without losing its source points.

Minimum derived row:

`t`, GPS time/position/speed/accuracy, gear, GPS-authority RPM/confidence, acceleration, run direction/segment, knock value/event/quality, active map snapshot/hash, ignition value and contributing RPM points, YPVS value, limiter proximity, alignment uncertainty, sample quality, exclusion reasons, and source IDs.

Raw audio, when present, remains an evidence object. Audio-derived candidates are shadow columns until signal validation is recorded with repeatable RPM correlation, harmonic-family/continuity evidence and acceptable comparison against GPS-authority RPM.

## Quality and confidence gates

A sample is eligible only when:

- GPS accuracy, update continuity and RPM confidence meet configured thresholds;
- gear is known and stable, no shift/transient exclusion window applies;
- clocks are aligned within a declared error budget;
- throttle/load/test protocol is comparable or explicitly modelled;
- no limiter, wheelspin, braking, route anomaly or sensor dropout contaminates the window;
- map snapshot is complete, compatible and active for the run;
- knock sensor status and calibration are known; any knock event applies a conservative exclusion/safety response.

Run-level gates require sufficient eligible duration and RPM-bin coverage, repeatability, matched route/direction and environmental metadata. Report why data was rejected. A confidence score combines source quality, alignment, coverage, repeatability and effect consistency; it cannot override a hard safety gate.

## Suggestion engine

Phase 1 is observational. For fixed RPM bins, summarize eligible samples and runs: acceleration/performance metric, variance, knock incidence/margin, current timing, sample/run counts and conditions. Avoid using multiple adjacent samples from one pull as independent evidence; aggregate by run first.

Phase 2 compares intentionally controlled map versions. A before/after comparison requires compatible device/firmware, identical non-target settings or explicit covariates, the same gear and comparable route/direction/conditions. Use paired run summaries where possible. Show effect size and uncertainty, not only a winner.

A suggestion contains target RPM point/range, current and proposed value, maximum step applied, evidence runs, before/after metrics, knock result, confidence, quality warnings, affected neighboring points and a human-readable rationale. `No suggestion` is a valid and common result.

Per-RPM learning uses bounded bins aligned to supported map points. Require coverage from multiple accepted runs and consistent direction of effect. Smoothness constraints prevent isolated spikes, but smoothing never fabricates evidence for an unobserved bin. Extrapolation outside observed RPM/load space is prohibited.

## Safety boundaries

- Configured absolute timing/YPVS/limiter bounds and per-iteration delta limits are hard gates, scoped by supported device/model.
- Knock, uncertain knock status, low GPS quality, unknown gear, limiter proximity, poor alignment or insufficient repeatability blocks performance-increasing suggestions for the affected range.
- Never recommend disabling/raising safety limits merely to improve a score.
- Keep a protected baseline snapshot and a full lineage from suggestion to source runs and RAW protocol evidence.
- Applying a suggestion, if a separately approved write feature exists later, must go through the UI write interlock, pre-write snapshot and read-back verification. The learner itself has no device-write capability.

## Before/after and rollback

Treat each experiment as baseline snapshot → reviewed proposal → applied snapshot → validation runs. Compare accepted paired runs and surface regressions in performance, knock or coverage. A regression or uncertain result recommends returning to the protected baseline; rollback remains an explicit, safety-gated UI operation. Never relabel a failed/partial write as an experiment result.

## Acceptance criteria

- Reprocessing yields the same derived timeline from the same source hashes and algorithm version.
- Synthetic clock offset/drift tests stay within the alignment error budget and flag excess uncertainty.
- Camera RPM cannot enter the dataset; unverified audio cannot become a feature or target.
- GPS-authority loss or unknown gear excludes affected samples with a visible reason.
- Before/after analysis does not count correlated samples as independent runs.
- Sparse or contradictory RPM bins return `No suggestion`.
- Knock and hard-bound fixtures block unsafe suggestions.
- Every suggestion resolves to runs, snapshot points and RAW Zeeltronic evidence.


