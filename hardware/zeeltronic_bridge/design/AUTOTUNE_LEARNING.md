# MotoLab Zeeltronic autotune and learning design

Status: suggestion-only research design. Initial versions never write CDI settings automatically.

## Aligned timeline

Create an immutable run bundle containing monotonic and UTC anchors for GPS, wheel/run timing, RPM,
knock, throttle/load if available, Zeeltronic snapshot, commanded timing and quality metadata. Preserve
raw sensor streams and alignment transforms. Resampling produces derived views, not replacement data.

GPS remains the authority during RPM learning. Camera-derived RPM is excluded. Audio-derived RPM or
knock is excluded until raw audio has been verified as a real engine signal with repeatable calibration.

## Quality gates

A segment is eligible only when alignment uncertainty, GPS quality, RPM stability, sampling gaps,
gear/ratio consistency, temperature/power state and knock-sensor health pass configured limits. Reject
wheelspin, shifts, limiter contact, transient throttle, GPS jumps, signal clipping and unverified sources.
Every exclusion has a machine-readable reason.

## Suggestion engine

- Learn per RPM bin, optionally conditioned on load/gear/environment when supported by evidence.
- Compare repeated before/after runs on matched operating windows.
- Estimate effect size and uncertainty; do not treat a faster unmatched run as timing evidence.
- Penalize sparse bins and conflicting outcomes.
- Produce a proposed map diff, rationale, evidence links, confidence and expected validation run.
- Never emit a suggestion beyond configured ignition, limiter, YPVS, temperature or knock boundaries.

## Confidence

Confidence combines sensor quality, alignment uncertainty, repeat count, matched-run similarity,
effect consistency and distance from safety limits. Low confidence means collect more data, not apply a
larger change. Knock evidence vetoes advance suggestions; missing knock data never means safe.

## Validation and rollback

Each accepted manual experiment starts from a verified snapshot, changes the smallest useful RPM
region, records an immutable post-write/readback snapshot, and runs matched A/B/A validation when
practical. Regressions, knock, sensor faults or boundary violations recommend immediate rollback to the
named snapshot. Learning never overwrites historical evidence after rollback.
