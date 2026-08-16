# VÄNÄ MotoLab v32 development roadmap

Development baseline: v31 Core Sprint.

## Priority 1 — Measurement reliability
- RPM Fusion quality gates: candidate ambiguity, continuity and plausibility.
- GPS + learned gear ratio used as independent RPM plausibility reference.
- Preserve raw observations separately from derived RPM.
- Run quality flags for GPS degradation, RPM jumps, uncertain gear and wheel slip suspicion.

## Priority 2 — Vehicle / Engine Knowledge Base
- One profile-level source of truth for engine, gearing, tyre, carburetor, exhaust and ignition setup.
- Snapshot setup signature into every run and learning session.
- Keep algorithm version separate from physical setup version.

## Priority 3 — Auto Gear Learn
- Confidence per learned gear ratio.
- Reject samples during shifts and implausible acceleration states.
- Use learned ratios for gear detection and RPM cross-checking.

## Priority 4 — Tuning modules
- Carburetor comparison based on repeatable runs.
- Porting and pipe calculations consume the same engine profile.
- Ignition autotune remains developer-only until validation and safety limits are complete.

## Regression gate
Before publishing a development change to the main user flow, verify GPS, BT MIC, GPS ONLY, AUTO FUSION, AutoRide, manual run recording, run persistence, profiles, learning/raw data and PWA startup.

Camera RPM remains outside the active measurement path. Phone internal microphone must not be treated as a validated RPM source until its RPM algorithm is separately corrected and tested.
