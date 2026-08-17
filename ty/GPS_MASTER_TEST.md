# GPS MASTER + MIC LEARN test workflow

## Purpose
Use GPS-derived RPM as the control/reference path while the selected BT/contact microphone runs only as a shadow learning sensor.

## Control authority
- Displayed/recorded RPM: GPS speed + selected gear reference.
- GPS reference source priority: profile drivetrain calculation when primary ratio + selected gear ratio + final ratio + wheel circumference are available; otherwise saved GPS gear calibration.
- BT MIC: no influence on displayed RPM, run acceptance, stop RPM, or gear learning in this mode.
- Camera RPM: disabled.
- Phone internal microphone: not a validated RPM source.

## One-button preparation
In Settings select `GPS MASTER + MIC LEARN` and press `VALMISTELE GPS + MIC TESTI`.
The button starts GPS and attempts to open the explicitly selected external/BT microphone. Browser permission and device routing still apply.

## Per-sample RAW/shadow fields
The learning stream preserves normal source fields plus:
- `learningPhase = gps_master_mic_learn`
- `rpmControlAuthority = gps`
- `gpsReferenceSource`
- `gpsReferenceRpmPerKmh`
- `gpsReferenceRpm`, `gpsReferenceConf`, `gpsReferenceKmh`, `gpsReferenceGear`
- `micShadowRpm`, `micShadowRawRpm`
- `micShadowDeltaRpm`, `micShadowErrorPct`, `micShadowRatioToGps`
- audio confidence, observed f0, fingerprint score, candidate gap, runner RPM, audio level
- GPS accuracy, acceleration, motion, estimated power/torque and sample quality

## Development phases
1. GPS BASELINE — evaluate run repeatability; MIC is shadow-only.
2. GPS-SYNC MIC — use the GPS reference to analyze audio RPM candidate/harmonic behavior.
3. FUSION SHADOW — only after sufficient data, evaluate a future fusion algorithm against the same GPS reference without giving it control authority.
